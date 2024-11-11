import pandas as pd
import json

# Load the OpenPowerlifting dataset
csv_file = 'filtered_lifting_data.csv'  # Path to the OpenPowerlifting CSV
df = pd.read_csv(csv_file)

# Filter for rows where Equipment is "Raw"
df = df[df['Equipment'] == 'Raw']

# Filter out any rows with missing or invalid data
df = df.dropna(subset=['Sex', 'BodyweightKg', 'Age', 'Best3SquatKg', 'Best3BenchKg', 'Best3DeadliftKg'])

# Define weight classes (adjust them as needed)
weight_classes_male = [52.0, 56.0, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140, 140]
weight_classes_female = [44, 48, 52, 56, 60, 67.5, 75, 82.5, 90, 90]

# Function to assign weight classes
def get_weight_class(bodyweight, gender):
    weight_classes = weight_classes_male if gender == 'M' else weight_classes_female
    for weight_class in weight_classes:
        if bodyweight <= weight_class:
            return weight_class
    return max(weight_classes)

# Define age groups
def get_age_group(age):
    if age < 14:
        return 'Youth'
    elif 14 <= age <= 15:
        return 'Teen1'
    elif 16 <= age <= 17:
        return 'Teen2'
    elif 18 <= age <= 19:
        return 'Teen3'
    elif 35 <= age <= 39:
        return 'Sub-Master'
    elif 40 <= age <= 49:
        return 'Master I'
    elif age >= 50:
        return 'Master II'
    else:
        return 'Open'  # Default for adults between 20 and 34

# Add weight class and age group columns
df['WeightClass'] = df.apply(lambda row: get_weight_class(row['BodyweightKg'], row['Sex']), axis=1)
df['AgeGroup'] = df['Age'].apply(get_age_group)

# Prepare a dictionary to hold percentiles
percentiles_data = {
    'male': {},
    'female': {}
}

# Function to calculate percentiles for each weight class and age group
def calculate_percentiles(group, gender):
    percentiles = {}
    group_by_class_and_age = group.groupby(['WeightClass', 'AgeGroup'])

    for (weight_class, age_group), wc_group in group_by_class_and_age:
        if weight_class not in percentiles:
            percentiles[weight_class] = {}
        if age_group not in percentiles[weight_class]:
            percentiles[weight_class][age_group] = {}

        # Calculate percentiles for squat, bench, and deadlift
        for lift in ['Best3SquatKg', 'Best3BenchKg', 'Best3DeadliftKg']:
            wc_group_sorted = wc_group[lift].sort_values()
            percentiles[weight_class][age_group][lift] = {
                20: wc_group_sorted.quantile(0.2),
                40: wc_group_sorted.quantile(0.4),
                60: wc_group_sorted.quantile(0.6),
                80: wc_group_sorted.quantile(0.8),
                100: wc_group_sorted.max()  # 100th percentile (max value)
            }

    return percentiles

# Split the data into male and female groups
df_male = df[df['Sex'] == 'M']
df_female = df[df['Sex'] == 'F']

# Calculate percentiles for both genders
percentiles_data['male'] = calculate_percentiles(df_male, 'male')
percentiles_data['female'] = calculate_percentiles(df_female, 'female')

# Save the percentile data to a JSON file
with open('percentile.json', 'w') as f:
    json.dump(percentiles_data, f, indent=4)

print('percentile.json')
