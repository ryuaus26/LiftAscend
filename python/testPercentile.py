import json

# Function to load the JSON data
def load_percentile_data(filepath):
    with open(filepath, 'r') as file:
        return json.load(file)

# Function to calculate the user's percentile
def calculate_user_percentile(user_lifts, user_category, percentiles_data):
    weight_class = user_category['weightClass']
    age_group = user_category['ageGroup']
    
    weight_class_data = percentiles_data[user_category['gender']][weight_class][age_group]

    user_percentiles = {
        'squat': get_percentile(user_lifts['squat'], weight_class_data['Best3SquatKg']),
        'bench': get_percentile(user_lifts['bench'], weight_class_data['Best3BenchKg']),
        'deadlift': get_percentile(user_lifts['deadlift'], weight_class_data['Best3DeadliftKg'])
    }

    return user_percentiles

# Helper function to determine the user's percentile based on their lift with interpolation
def get_percentile(lift, lift_data):
    # Convert lift_data keys to integers and sort them
    percentiles = sorted(map(int, lift_data.keys()))
    
    # Check if the lift exceeds the highest in the data
    if lift >= lift_data[str(percentiles[-1])]:
        return 100  # If the lift exceeds the highest percentile
    
    # Find the closest weights below and above the user's lift
    lower_weight = None
    upper_weight = None
    
    for percentile in percentiles:
        if lift_data[str(percentile)] < lift:
            lower_weight = percentile  # this is a lower bound
        elif lift_data[str(percentile)] >= lift and upper_weight is None:
            upper_weight = percentile  # this is an upper bound
            break

    # If lower_weight is None, it means the user's lift is below all
    if lower_weight is None:
        return percentiles[0]  # The lowest percentile

    # Perform linear interpolation to find the exact percentile
    lower_value = lift_data[str(lower_weight)]
    upper_value = lift_data[str(upper_weight)]

    # Calculate the percentile
    percentile = lower_weight + (lift - lower_value) * (upper_weight - lower_weight) / (upper_value - lower_value)
    
    return round(percentile)

# Function to display the user's percentile
def display_user_strength_comparison(user_lifts, user_category):
    percentiles_data = load_percentile_data('percentile.json')
    user_percentiles = calculate_user_percentile(user_lifts, user_category, percentiles_data)

    print("You are:")
    print(f"- {user_percentiles['squat']}% stronger than others in your category for squat.")
    print(f"- {user_percentiles['bench']}% stronger than others in your category for bench press.")
    print(f"- {user_percentiles['deadlift']}% stronger than others in your category for deadlift.")

# Example user input
user_lifts = {
    'squat': 90,
    'bench': 150,
    'deadlift': 210
}

user_category = {
    'gender': 'male',
    'weightClass': '100.0',  # Ensure this matches the JSON structure
    'ageGroup': 'Teen (16-17 years)'      # Ensure this matches the age groups in your JSON
}

# Display the user's strength comparison
display_user_strength_comparison(user_lifts, user_category)
