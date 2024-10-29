import pandas as pd

# Load the CSV file
file_path = 'C:\\Users\\yunry\\OneDrive\\바탕 화면\\LiftAscend\\openpowerlifting-2024-10-19\\openpowerlifting-2024-10-19-50627554.csv'  # Replace with your CSV file path
data = pd.read_csv(file_path)

# Display the first few rows to confirm data is loaded correctly
print("Initial Data:")
print(data.head())

# Filter and extract relevant columns
relevant_columns = [
    'Name', 'Age', 'BodyweightKg', 'WeightClassKg', 
    'Best3SquatKg', 'Best3BenchKg', 'Best3DeadliftKg', 
    'TotalKg', 'Event', 'Sex', 'Equipment'
]

# Extract the relevant data
filtered_data = data[relevant_columns]

# Display the filtered data
print("\nFiltered Data:")
print(filtered_data.head())

# Function to calculate total lifts while handling missing values
def calculate_total(row):
    squat = row['Best3SquatKg'] if pd.notna(row['Best3SquatKg']) else 0
    bench = row['Best3BenchKg'] if pd.notna(row['Best3BenchKg']) else 0
    deadlift = row['Best3DeadliftKg'] if pd.notna(row['Best3DeadliftKg']) else 0
    return squat + bench + deadlift

# Calculate the total lift for each row (if TotalKg isn't provided)
filtered_data['TotalKg_Calculated'] = filtered_data.apply(calculate_total, axis=1)

# Display the modified data with calculated total lifts
print("\nModified Data with Total Lifts Calculated:")
print(filtered_data[['Name', 'TotalKg_Calculated']].head())

# Optional: Save the filtered data to a new CSV file
filtered_data.to_csv('filtered_lifting_data.csv', index=False)
print("\nFiltered data saved to 'filtered_lifting_data.csv'.")
