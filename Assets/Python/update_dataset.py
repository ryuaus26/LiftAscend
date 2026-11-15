
import json
import re
import sys
import zipfile
from datetime import date
from pathlib import Path

import pandas as pd

ASSETS = Path(__file__).resolve().parent.parent
COLUMNS = ['Sex', 'Equipment', 'Age', 'BodyweightKg',
           'Best3SquatKg', 'Best3BenchKg', 'Best3DeadliftKg']
LIFTS = ['Best3SquatKg', 'Best3BenchKg', 'Best3DeadliftKg']
MALE_CLASSES = [52.0, 56.0, 60.0, 67.5, 75.0, 82.5, 90.0, 100.0, 110.0, 125.0, 140.0]
FEMALE_CLASSES = [44.0, 48.0, 52.0, 56.0, 60.0, 67.5, 75.0, 82.5, 90.0]
AGE_GROUPS = ['Youth', 'Teen1', 'Teen2', 'Teen3', 'Open', 'Sub-Master', 'Master I', 'Master II']


def read_export(path):
    """Return (dataframe, name of the csv inside the export)."""
    kwargs = dict(usecols=COLUMNS, dtype={'Sex': 'category', 'Equipment': 'category'})
    if path.suffix.lower() == '.zip':
        with zipfile.ZipFile(path) as archive:
            names = [n for n in archive.namelist() if n.lower().endswith('.csv')]
            if not names:
                sys.exit(f'No .csv file found inside {path.name}.')
            with archive.open(names[0]) as handle:
                return pd.read_csv(handle, **kwargs), names[0]
    return pd.read_csv(path, **kwargs), path.name


def weight_class(bodyweight, classes):
    for limit in classes:
        if bodyweight <= limit:
            return limit
    return classes[-1]


def age_group(age):
    if age < 14:
        return 'Youth'
    if age <= 15:
        return 'Teen1'
    if age <= 17:
        return 'Teen2'
    if age <= 19:
        return 'Teen3'
    if age >= 50:
        return 'Master II'
    if age >= 40:
        return 'Master I'
    if age >= 35:
        return 'Sub-Master'
    return 'Open'


def percentiles_for(frame, classes):
    frame = frame.copy()
    frame['WeightClass'] = frame['BodyweightKg'].apply(lambda bw: weight_class(bw, classes))
    frame['AgeGroup'] = frame['Age'].apply(age_group)

    result = {}
    for (wc, ag), group in frame.groupby(['WeightClass', 'AgeGroup']):
        table = result.setdefault(str(float(wc)), {}).setdefault(ag, {})
        for lift in LIFTS:
            values = group[lift]
            table[lift] = {
                '20': float(values.quantile(0.2)),
                '40': float(values.quantile(0.4)),
                '60': float(values.quantile(0.6)),
                '80': float(values.quantile(0.8)),
                '100': float(values.max()),
            }
    return result


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1]).expanduser()
    if not source.exists():
        sys.exit(f'File not found: {source}')

    print(f'Reading {source.name} ...')
    data, csv_name = read_export(source)
    total_rows = len(data)

    data = data[data['Equipment'] == 'Raw'].dropna(subset=['Sex', 'BodyweightKg', 'Age'] + LIFTS)
    print(f'{total_rows:,} rows in the export, {len(data):,} raw results with complete data.')

    output = {
        'male': percentiles_for(data[data['Sex'] == 'M'], MALE_CLASSES),
        'female': percentiles_for(data[data['Sex'] == 'F'], FEMALE_CLASSES),
    }

    # The site needs every weight class and age group to be present.
    missing = [
        f'{gender} {wc} {ag}'
        for gender, classes in (('male', MALE_CLASSES), ('female', FEMALE_CLASSES))
        for wc in classes for ag in AGE_GROUPS
        if ag not in output[gender].get(str(wc), {})
    ]
    if missing:
        sys.exit('Stopped without writing anything. No data for: ' + ', '.join(missing))

    # OpenPowerlifting names its csv openpowerlifting-YYYY-MM-DD-<revision>.csv
    match = re.search(r'(\d{4}-\d{2}-\d{2})', csv_name)
    data_date = match.group(1) if match else date.today().isoformat()

    (ASSETS / 'percentile.json').write_text(json.dumps(output, indent=4) + '\n')
    (ASSETS / 'dataset.json').write_text(json.dumps({
        'source': 'OpenPowerlifting',
        'dataDate': data_date,
        'results': int(len(data)),
    }, indent=2) + '\n')

    print(f'Wrote Assets/percentile.json and Assets/dataset.json (data dated {data_date}).')
    print('Review the change with "git diff --stat", then run: firebase deploy --only hosting')


if __name__ == '__main__':
    main()
