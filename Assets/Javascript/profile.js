const firebaseConfig = {
    apiKey: "AIzaSyB5pHK1U6Oy5Ta9oPOcL5LfWXGP_U3838E",
    authDomain: "liftascend.firebaseapp.com",
    projectId: "liftascend",
    storageBucket: "liftascend.appspot.com",
    messagingSenderId: "403461421933",
    appId: "1:403461421933:web:52452b598fb853c3cb3864",
    measurementId: "G-RFR3H01R2N"
};
let currentWeightUnit = 'lbs'; // Default unit is pounds
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

function getUserIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('userId'); // Get the userId from the URL
}

function returnName(name) {
    return name;
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize variables

const db = firebase.database();

// Function to search for lifters based on user input
function searchLifters(query) {
    const suggestionsContainer = document.getElementById('suggestionsContainer');
    const suggestionsList = document.getElementById('suggestionsList');
    suggestionsList.innerHTML = ''; // Clear previous suggestions

    // Only search if the query has at least 1 character
    if (query.length < 1) {
        suggestionsContainer.style.display = 'none'; // Hide suggestions if no input
        return;
    }

    // Query the database for lifters matching the search query
    db.ref('users').orderByChild('full_name').startAt(query).endAt(query + '\uf8ff').once('value')
        .then((snapshot) => {
            const results = [];
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                results.push(data.full_name); // Assuming 'full_name' is the field to display
            });

            // Display LOs
            if (results.length > 0) {
                suggestionsContainer.style.display = 'block'; // Show suggestions
                results.forEach((name) => {
                    const listItem = document.createElement('li');
                    listItem.textContent = name;
                    listItem.onclick = () => selectSuggestion(name); // Handle suggestion click
                    suggestionsList.appendChild(listItem);
                });
            } else {
                suggestionsContainer.style.display = 'none'; // Hide if no results
            }
        })
        .catch((error) => {
            console.error('Error searching lifters:', error);
        });
}

// Function to handle selecting a suggestion
function selectSuggestion(name) {
    const searchBar = document.querySelector('.search-bar');
    searchBar.value = name; // Set the search bar value to the selected suggestion
    document.getElementById('suggestionsContainer').style.display = 'none'; // Hide suggestions
}

// Event listener for input changes in the search bar
document.querySelector('.search-bar').addEventListener('input', (event) => {
    const query = event.target.value;
    searchLifters(query); // Call search function with current input
});

// Mock function to simulate fetching users from Firebase
// Function to fetch users from Firebase and make it case-insensitive
function searchUsers(query) {
  return firebase.database().ref('/users').once('value').then(snapshot => {
      const users = [];
      snapshot.forEach(childSnapshot => {
          const userData = childSnapshot.val();
          if (userData && userData.full_name) {
              users.push(userData.full_name);
          }
      });

      // Convert both the query and the user names to lowercase for case-insensitive comparison
      const filteredUsers = users.filter(user => user.toLowerCase().includes(query.toLowerCase()));
      return filteredUsers;
  });
}

document.getElementById('searchInput').addEventListener('input', async function () {
  const query = this.value;

  if (query.length === 0) {
      document.getElementById('suggestionsContainer').style.display = 'none';
      return;
  }

  // Fetch filtered users based on non-case-sensitive query
  const results = await searchUsers(query);
  
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const suggestionsList = document.getElementById('suggestionsList');

  // Clear any previous suggestions
  suggestionsList.innerHTML = '';

  if (results.length > 0) {
      suggestionsContainer.style.display = 'block';
      
      // Populate the suggestions list
      results.forEach((user) => {
          const li = document.createElement('li');
          li.textContent = user;
          li.addEventListener('click', () => {
              // Handle user selection (e.g., filling in the input field)
              document.getElementById('searchInput').value = user;
              suggestionsContainer.style.display = 'none'; // Hide suggestions after selection
          });
          suggestionsList.appendChild(li);
      });
  } else {
      suggestionsContainer.style.display = 'none';
  }
});



// Initialize variables
const auth = firebase.auth();
const database = firebase.database();

function displayLiftData(data, name) {
    
    document.getElementById('user-bench').textContent = (data.bench)+ " " + currentWeightUnit;
    document.getElementById('user-squat').textContent = data.squat + " " + currentWeightUnit;
    document.getElementById('user-deadlift').textContent = data.deadlift + " " + currentWeightUnit;
}

function fetchLiftData(uid, name) {
    const liftDataRef = firebase.database().ref(`users/${uid}/liftData`);
    const userId = getUserIdFromUrl();
  
    document.getElementById('user-full-name').textContent = name;
    document.getElementById('user-id').textContent = userId;
  
    liftDataRef.once('value')
      .then((snapshot) => {
        if (snapshot.exists()) {
          firebase.database().ref('users/' + uid + '/liftData').limitToLast(1).once('value')
            .then((snapshot) => {
              const userData = snapshot.val();
  
              if (userData) {
                const lastEntry = Object.values(userData)[0];
  
                // Store original values and unit when data is first loaded
                originalSquatValue = parseFloat(lastEntry.squat);
                originalBenchValue = parseFloat(lastEntry.bench);
                originalDeadliftValue = parseFloat(lastEntry.deadlift);
                originalWeightValue = parseFloat(lastEntry.weight);
                
                currentWeightUnit = lastEntry.unit;
                // Display initial values
                const total = originalSquatValue + originalBenchValue + originalDeadliftValue;
                document.getElementById("total").innerHTML =
                  total.toFixed(1) + " <strong>" + currentWeightUnit + "</strong>";
  
                document.getElementById('bodyweight').textContent = originalWeightValue + " " + currentWeightUnit;
                document.getElementById('age').textContent = lastEntry.age;
                updateProfileDisplay(lastEntry)
                const dotsScore = calculateLifterDOTS(
                  lastEntry.weight,
                  lastEntry.squat,
                  lastEntry.bench,
                  lastEntry.deadlift,
                  lastEntry.gender.toLowerCase() === 'male',
                  currentWeightUnit
                );
              
               
                // Update UI with DOTS score
                document.getElementById('dots').textContent = ` ${dotsScore}`;
  
                displayUserStrengthComparison(
                  originalSquatValue,
                  originalBenchValue,
                  originalDeadliftValue,
                  {
                    gender: lastEntry.gender.trim(),
                    weightClass: lastEntry.weightClass,
                    ageGroup: getAgeGroup(parseInt(lastEntry.age))
                  }
                );
                selectWeightUnit(currentWeightUnit)
                displayLiftData(lastEntry, name);
              }
            })
        } else {
          console.log("No lift data found for this user.");
        }
      });
  }
  function calculateLifterDOTS(weight, squat, bench, deadlift, isMale, unit) {
    const maleCoeff = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
    const femaleCoeff = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];

    // Convert weight to kg if in lbs
    let bw = unit === 'lbs' ? weight * 0.453592 : weight;

    // Set the max allowed bodyweight (in kg)
    let maxbw = isMale ? 210 : 150;
    bw = Math.min(Math.max(bw, 40), maxbw);

    // Select coefficient set
    let coeff = isMale ? maleCoeff : femaleCoeff;

    // Calculate denominator
    let denominator = coeff[0];
    for (let i = 1; i < coeff.length; i++) {
        denominator += coeff[i] * Math.pow(bw, i);
    }

    // Convert lifts to kg if in lbs
    let total = unit === 'lbs' ? 
        (squat + bench + deadlift) * 0.453592 :
        squat + bench + deadlift;

    // Calculate the DOTS score
    let score = (500 / denominator) * total;
    return score.toFixed(2);
}

firebase.initializeApp(firebaseConfig);

// Check if user is logged in
firebase.auth().onAuthStateChanged((user) => {
    const logoLink = document.getElementById("logoLink");

    if (user) {
        // User is logged in, set link to loggedin.html
        logoLink.href = "loggedin.html";
    } else {
        // User is not logged in, set link to index.html
        logoLink.href = "index.html";
    }
});
  
document.addEventListener('DOMContentLoaded', loadAllUsers);
function addFriend() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        alert("You must be logged in");
        return;
    }

    const profileUserId = getUserIdFromUrl();

    if (currentUser.uid.slice(-5) === profileUserId) {
        alert("You cannot add yourself as a friend.");
        return;
    }

    // Reference to the friends node
    const friendsRef = firebase.database().ref(`users/${currentUser.uid}/friends`);

    // First check if the friend already exists
    friendsRef.once('value')
        .then((snapshot) => {
            const friends = snapshot.val();
            let isDuplicate = false;

            if (friends) {
                // Check each existing friend
                Object.values(friends).forEach(friend => {
                    if (friend.friendId === profileUserId) {
                        isDuplicate = true;
                    }
                });
            }

            if (isDuplicate) {
                alert("This user is already in your friends list.");
                return;
            }

            // If not a duplicate, add the friend
            return friendsRef.push({
                friendId: profileUserId,
                timestamp: Date.now()
            });
        })
        .then((result) => {
            if (result) { // Only show success if we actually added a friend
                alert("Friend added successfully!");
            }
        })
        .catch((error) => {
            console.error("Error adding friend:", error);
            alert("Error adding friend. Please try again.");
        });
}


function loadAllUsers() {
    const usersRef = firebase.database().ref('users');
    const userId = getUserIdFromUrl();

    usersRef.once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const usersList = [];

                // Loop through each user in the users object
                for (const uid in usersData) {
                    if (usersData.hasOwnProperty(uid)) {
                        const user = usersData[uid];
                        const fullName = user.full_name; // Get the user's full name
                        const name = user.name;
                        usersList.push(fullName); // Add to the list of full names

                         // Check if the last 5 characters of the uid match the userId from the URL
                         if (uid.slice(-5) === userId) {
                            console.log(`User Found: ${name}`); // Print user's full name

                            fetchLiftData(uid, name); // Call the function to fetch lift data for this user
                            break; // Exit the loop once the user is found

                        }
                }

            

                // If you want to display in HTML, uncomment below
                // document.getElementById('users-list').innerHTML = usersList.map(name => `<li>${name}</li>`).join('');
            } 
        }
    })
}




async function loadPercentileData(filepath) {
    try {
        const response = await fetch(filepath);
        const data = await response.json();
        console.log("Loaded JSON data structure:", data); // Debug log
        return data;
    } catch (error) {
        console.error("Error loading percentile data:", error);
        throw error;
    }
}

async function calculateUserPercentile(squat, bench, deadlift, userCategory) {
    const percentilesData = await loadPercentileData('percentile.json');
    
    // Remove 'kg' from weightClass and convert to string with .0
    const weightClassNum = userCategory.weightClass.replace('kg', '');
    let formattedWeightClass = weightClassNum.endsWith('.5') ? weightClassNum : weightClassNum + ".0";

    // Map age groups to the categories in your JSON
    const ageGroupMapping = {
        'Youth': 'Open',
        'Teen1': 'Teen1',
        'Teen2': 'Teen2',
        'Teen3': 'Teen3',
        'Sub-Master': 'Sub-Master',
        'Master I': 'Master I',
        'Master II': 'Master II'
    };

    const mappedAgeGroup = ageGroupMapping[userCategory.ageGroup] || 'Open';

    // Access data based on mapped categories
    const weightClassData = percentilesData[userCategory.gender]?.[formattedWeightClass]?.[mappedAgeGroup];

    if (!weightClassData) {
        console.error("No data found for the given user category:", {
            original: userCategory,
            mapped: {
                gender: userCategory.gender,
                weightClass: formattedWeightClass,
                ageGroup: mappedAgeGroup
            }
        });
        return {
            squat: 0,
            bench: 0,
            deadlift: 0
        };
    }

    // Improved helper function for more precise percentile interpolation
    function findPercentileFromBrackets(value, brackets) {
        // Convert brackets to arrays for easier manipulation
        const percentiles = Object.keys(brackets).map(Number).sort((a, b) => a - b);
        const values = percentiles.map(p => brackets[p]);
        
        // If value is less than the lowest bracket
        if (value < values[0]) {
            // Interpolate between 0 and first percentile
            const slope = percentiles[0] / values[0];
            return Math.max(0, value * slope);
        }
        
        // If value is greater than the highest bracket
        if (value >= values[values.length - 1]) {
            // Interpolate between last percentile and 100
            const lastPercentile = percentiles[percentiles.length - 1];
            const remainingPercentile = 100 - lastPercentile;
            const exceedance = value - values[values.length - 1];
            const scale = remainingPercentile / (values[values.length - 1] * 0.1); // 10% buffer
            return Math.min(100, lastPercentile + (exceedance * scale));
        }
        
        // Find the bracketing percentiles
        for (let i = 0; i < values.length - 1; i++) {
            if (value >= values[i] && value < values[i + 1]) {
                const lowerValue = values[i];
                const upperValue = values[i + 1];
                const lowerPercentile = percentiles[i];
                const upperPercentile = percentiles[i + 1];
                
                // Calculate position within bracket (0 to 1)
                const position = (value - lowerValue) / (upperValue - lowerValue);
                
                // Interpolate between percentiles using cubic easing
                // This provides smoother transitions between percentile brackets
                const t = position;
                const smoothPosition = t * t * (3 - 2 * t);
                
                return lowerPercentile + (smoothPosition * (upperPercentile - lowerPercentile));
            }
        }
        
        return 100;
    }

    // Calculate percentiles with two decimal precision
    if (currentWeightUnit == "lbs"){

        squat = lbsToKg(squat); 
        bench = lbsToKg(bench);
        deadlift = lbsToKg(deadlift);
    } 
    const userPercentiles = {
        squat: Number(findPercentileFromBrackets(squat, weightClassData.Best3SquatKg).toFixed(2)),
        bench: Number(findPercentileFromBrackets(bench, weightClassData.Best3BenchKg).toFixed(2)),
        deadlift: Number(findPercentileFromBrackets(deadlift, weightClassData.Best3DeadliftKg).toFixed(2))
    };

    return userPercentiles;
}

// Helper function to format percentile for display
function formatPercentile(percentile) {
    return Number(percentile).toFixed(2);
}


// Helper function to determine the user's percentile based on their lift with interpolation
function getPercentile(lift, liftData) {
    // Convert liftData keys to integers and sort them
    const percentiles = Object.keys(liftData).map(Number).sort((a, b) => a - b);
    
    // Check if the lift exceeds the highest in the data
    if (lift >= liftData[percentiles[percentiles.length - 1]]) {
        return 100; // If the lift exceeds the highest percentile
    }

    // Find the closest weights below and above the user's lift
    let lowerWeight = null;
    let upperWeight = null;

    for (const percentile of percentiles) {
        if (liftData[percentile] < lift) {
            lowerWeight = percentile; // this is a lower bound
        } else if (liftData[percentile] >= lift && upperWeight === null) {
            upperWeight = percentile; // this is an upper bound
            break;
        }
    }

    // If lowerWeight is null, it means the user's lift is below all
    if (lowerWeight === null) {
        return percentiles[0]; // The lowest percentile
    }

    // Perform linear interpolation to find the exact percentile
    const lowerValue = liftData[lowerWeight];
    const upperValue = liftData[upperWeight];

    const percentile = lowerWeight + ((lift - lowerValue) * (upperWeight - lowerWeight)) / (upperValue - lowerValue);
    
    return Math.round(percentile);
}

// Function to display the user's percentile
async function displayUserStrengthComparison(squat, bench, deadlift, userCategory) {
    const userPercentiles = await calculateUserPercentile(squat, bench, deadlift, userCategory);
    
    if (typeof displayPercentiles === 'function') {
        displayPercentiles(userPercentiles);
    }
    const avgPercentile = (userPercentiles.squat + userPercentiles.bench + userPercentiles.deadlift) / 3;
    const userRank = updateRank(avgPercentile);

    console.log(avgPercentile)
    displayRank(userRank);
}

function getWeightClassMale(weight, unit) {

    if (unit == 'kgs'){
        if (weight <= 52) return '52kg';
        if (weight > 52 && weight <= 56) return '56kg';
        if (weight > 56 && weight <= 60) return '60kg';
        if (weight > 60 && weight <= 67.5) return '67.5kg';
        if (weight > 67.5 && weight <= 75) return '75kg';
        if (weight > 75 && weight <= 82.5) return '82.5kg';
        if (weight > 82.5 && weight <= 90) return '90kg';
        if (weight > 90 && weight <= 100) return '100kg';
        if (weight > 100 && weight <= 110) return '110kg';
        if (weight > 110 && weight <= 125) return '125kg';
        if (weight > 125 && weight <= 140) return '140kg';
        if (weight > 140) return '140+kg';
    } else {
        weight = lbsToKg(weight)
        if (weight <= 52) return '52kg';
        if (weight > 52 && weight <= 56) return '56kg';
        if (weight > 56 && weight <= 60) return '60kg';
        if (weight > 60 && weight <= 67.5) return '67.5kg';
        if (weight > 67.5 && weight <= 75) return '75kg';
        if (weight > 75 && weight <= 82.5) return '82.5kg';
        if (weight > 82.5 && weight <= 90) return '90kg';
        if (weight > 90 && weight <= 100) return '100kg';
        if (weight > 100 && weight <= 110) return '110kg';
        if (weight > 110 && weight <= 125) return '125kg';
        if (weight > 125 && weight <= 140) return '140kg';
        if (weight > 140) return '140+kg';
    }

    return '140+kg';
}

function getWeightClassFemale(weight, unit) {
    
    if (unit == 'kgs'){
        if (weight <= 44) return '44kg';
        if (weight > 44 && weight <= 48) return '48kg';
        if (weight > 48 && weight <= 52) return '52kg';
        if (weight > 52 && weight <= 56) return '56kg';
        if (weight > 56 && weight <= 60) return '60kg';
        if (weight > 60 && weight <= 67.5) return '67.5kg';
        if (weight > 67.5 && weight <= 75) return '75kg';
        if (weight > 75 && weight <= 82.5) return '82.5kg';
        if (weight > 82.5 && weight <= 90) return '90kg';
        if (weight > 90 && weight <= 100) return '100kg';
        if (weight > 100) return '100+kg';
    } else {
        weight = lbsToKg(weight)
        if (weight <= 44) return '44kg';
        if (weight > 44 && weight <= 48) return '48kg';
        if (weight > 48 && weight <= 52) return '52kg';
        if (weight > 52 && weight <= 56) return '56kg';
        if (weight > 56 && weight <= 60) return '60kg';
        if (weight > 60 && weight <= 67.5) return '67.5kg';
        if (weight > 67.5 && weight <= 75) return '75kg';
        if (weight > 75 && weight <= 82.5) return '82.5kg';
        if (weight > 82.5 && weight <= 90) return '90kg';
        if (weight > 90 && weight <= 100) return '100kg';
        if (weight > 100) return '100+kg';
    }
   
}


function lbsToKg(weight) {
    // Conversion factor: 1 pound is approximately 0.453592 kilograms
    const conversionFactor = 0.453592;
    // Convert the weight
    const weightInKg = weight * conversionFactor;
    return weightInKg;
}

function getAgeGroup(age) {
    if (age < 14) return "Youth"
    if (age >= 14 && age <= 15) return 'Teen1'; // Age Range: 14 to 15 years old
if (age >= 16 && age <= 17) return 'Teen2'; // Age Range: 16 to 17 years old
if (age >= 18 && age <= 19) return 'Teen3'; // Age Range: 18 to 19 years old
if (age >= 35 && age <= 39) return 'Sub-Master';        // Age Range: 35 to 39 years old
if (age >= 40 && age <= 49) return 'Master I';          // Age Range: 40 to 49 years old
if (age >= 50) return 'Master II';                       // Age Range: 50 years and older

}


function updateProfileDisplay(data) {
    // Update the global unit to match the stored data
    currentWeightUnit = data.unit || 'lbs';
    
    // Update the weight unit button text
    const weightUnitButton = document.getElementById('weightUnitButton');
    if (weightUnitButton) {
        weightUnitButton.textContent = `${currentWeightUnit} ▼`;
    }

    // Update the display values with the correct unit
    document.getElementById('user-bench').textContent = `${data.bench} ${data.unit}`;
    document.getElementById('user-squat').textContent = `${data.squat} ${data.unit}`;
    document.getElementById('user-deadlift').textContent = `${data.deadlift} ${data.unit}`;

    // Update headers to reflect current unit
    const weightHeader = document.getElementById('weightHeader');
    const squatHeader = document.getElementById('squatHeader');
    const benchHeader = document.getElementById('benchHeader');
    const deadliftHeader = document.getElementById('deadliftHeader');

    if (weightHeader) weightHeader.textContent = `Weight (${data.unit})`;
    if (squatHeader) squatHeader.textContent = `Squat (${data.unit})`;
    if (benchHeader) benchHeader.textContent = `Bench (${data.unit})`;
    if (deadliftHeader) deadliftHeader.textContent = `Deadlift (${data.unit})`;
}




function displayPercentiles(percentiles) {
    const percentileDisplay = {
        squat: document.getElementById('user-squat-percentile'),
        bench: document.getElementById('user-bench-percentile'),
        deadlift: document.getElementById('user-deadlift-percentile')
    };
  
    for (const [lift, element] of Object.entries(percentileDisplay)) {
        if (element) {
            element.textContent = `${percentiles[lift]}%`;
        } else {
            console.log(`Element for ${lift} percentile not found. Percentile: ${percentiles[lift]}%`);
        }
    }

    // If none of the elements exist, create a new element to display percentiles
    if (!percentileDisplay.squat && !percentileDisplay.bench && !percentileDisplay.deadlift) {
        const percentileContainer = document.getElementById('percentile-content-container');
        document.getElementById("squat-percentile").textContent = " " + percentiles.squat + "%" + " better than others"
        document.getElementById("bench-percentile").textContent = " " + percentiles.bench + "%" + " better than others"
        document.getElementById("deadlift-percentile").textContent = " " + percentiles.deadlift + "%" + " better than others"
       

     
    }
}


document.querySelector('.search-button').addEventListener('click', function () {
    const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
   

    if (searchQuery) {
        searchForUser(searchQuery);
    } else {
        alert('Please enter a name to search');
    }
});

// Function to search for users by full name (case-insensitive)
function searchForUser(query) {
    db.ref('users').once('value', function (snapshot) {
        let found = false;
        snapshot.forEach(function (childSnapshot) {
            const userId = childSnapshot.key; // Get the user's ID (userId)
            const userData = childSnapshot.val(); // Get the user's data
            
            // Check if full_name exists and matches the query (case-insensitive)
            if (userData && userData.full_name && userData.full_name.toLowerCase() === query.toLowerCase()) {
                console.log(`User found: ${userData.full_name} (ID: ${userId})`);
                found = true;
     
                // Redirect to the profile page with the user ID
                window.location.href = `profile.html?userId=${userData.full_name.slice(-5)}`;
                
                // Exit the loop since we found a match
                return true;
            }
        });
        if (!found) {
            alert('No user found with that name');
        }
    });
}



// Function to toggle weight unit display
function toggleWeightUnit() {
    const content = document.querySelector('.weight-unit-content');
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
}


// Optional: Click outside to close the dropdown
document.addEventListener('click', function(event) {
    const content = document.querySelector('.weight-unit-content');
    const button = document.querySelector('.weight-unit-btn');
    
    if (!button.contains(event.target) && !content.contains(event.target)) {
        content.style.display = 'none';
    }
});



function selectWeightUnit(unit) {
    // Check if the selected unit is the same as the current unit
    if (unit === currentWeightUnit ){
        return; // Exit the function to avoid unnecessary conversions
    }
    const weightHeader = document.getElementById('weightHeader');
    const squatHeader = document.getElementById('squatHeader');
    const benchHeader = document.getElementById('benchHeader');
    const deadliftHeader = document.getElementById('deadliftHeader');

    const button = document.getElementById('weightUnitButton');
    button.textContent = `${unit} ▼`;

    // Change headers based on selected unit
    if (unit === 'kgs') {
       

        // Convert weights from lbs to kgs only if necessary
        if (currentWeightUnit === 'lbs') {
            convertToKgs();
        }
    } else if (unit === 'lbs') {
     
        // Convert weights from kgs to lbs only if necessary
        if (currentWeightUnit === 'kgs') {
            convertToLbs();
        }
    }

    currentWeightUnit = unit; // Update the current unit
    isInitialLoad = false; // Mark that the initial load is done
}

// Function to convert all weights to kgs
function convertToKgs() {
    const squatValue = parseFloat(document.getElementById('user-squat').textContent);
    const benchValue = parseFloat(document.getElementById('user-bench').textContent);
    const deadliftValue = parseFloat(document.getElementById('user-deadlift').textContent);
    const bodyWeight = parseFloat(document.getElementById('bodyweight').textContent);
    const total = parseFloat(document.getElementById('total').textContent);

    // Convert values from lbs to kgs
    document.getElementById('user-squat').textContent = Math.round(squatValue * 0.45359237 * 10) / 10 + " kg";
    document.getElementById('user-bench').textContent = Math.round(benchValue * 0.45359237 * 10) / 10 + " kg";
    document.getElementById('user-deadlift').textContent = Math.round(deadliftValue * 0.45359237 * 10) / 10 + " kg";
    document.getElementById('bodyweight').textContent = lbsToKg(bodyWeight).toFixed(1) + " kg";
    document.getElementById('total').textContent = lbsToKg(total).toFixed(1) + " kg";
   
}

// Function to convert all weights to lbs
function convertToLbs() {
    const squatValue = parseFloat(document.getElementById('user-squat').textContent);
    const benchValue = parseFloat(document.getElementById('user-bench').textContent);
    const deadliftValue = parseFloat(document.getElementById('user-deadlift').textContent);
    const bodyWeight = parseFloat(document.getElementById('bodyweight').textContent);
    const total = parseFloat(document.getElementById('total').textContent);

    // Convert values from kgs to lbs
    document.getElementById('user-squat').textContent = Math.round(squatValue / 0.45359237 * 10) / 10 + " lbs";
    document.getElementById('user-bench').textContent = Math.round(benchValue / 0.45359237 * 10) / 10 + " lbs";
    document.getElementById('user-deadlift').textContent = Math.round(deadliftValue / 0.45359237 * 10) / 10 + " lbs";
    document.getElementById('bodyweight').textContent = kgToLbs(bodyWeight).toFixed(1) + " lbs";
    document.getElementById('total').textContent = kgToLbs(total).toFixed(1) + " lbs";
}

function kgToLbs(kg) {
    return kg * 2.20462;
}

function lbsToKg(lbs) {
    return lbs * 0.453592;
}


// Adjusted rank logic
function updateRank(percentile) {
    console.log(percentile)
    if (percentile >= 80) {
        return "Diamond";
    } else if (percentile >= 65) {
        return "Gold";
    } else if (percentile >= 45) {
        return "Silver";
    } else {
        return "Bronze";
    }
}

// Update the rank image dynamically
function displayRank(rank) {
    const rankImage = document.getElementById('rankImage');
    const rankContainer = document.getElementById('rankContainer');
    
    if (rankImage && rankContainer) {
        // Update the rank image
        rankImage.src = `./Images/${rank}.png`;
        rankImage.alt = rank;
        rankImage.style.visibility = "visible"
        // Make the rank container visible after user input
        rankContainer.style.visibility = 'visible';
    }
}
