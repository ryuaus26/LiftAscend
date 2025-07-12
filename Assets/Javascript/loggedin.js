/*  
   Austin Ryu 1/28/2025  
   
   This JavaScript file initializes Firebase and handles user authentication,  
   leaderboard population, and weightlifting data management. It allows users  
   to track their lifts, compare performance with friends, and toggle between  
   different ranking criteria. The script also ensures accurate unit conversion,  
   calculates lifting percentiles, and updates UI elements dynamically.  
*/

const firebaseConfig = {
    apiKey: "AIzaSyB5pHK1U6Oy5Ta9oPOcL5LfWXGP_U3838E",
    authDomain: "liftascend.firebaseapp.com",
    projectId: "liftascend",
    storageBucket: "liftascend.firebasestorage.app",
    messagingSenderId: "403461421933",
    appId: "1:403461421933:web:52452b598fb853c3cb3864",
    measurementId: "G-RFR3H01R2N"

};




let currentCriteria = "By Total"; // Initialize with a default value
let currentWeightUnit = 'lbs'; 
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize variables
const auth = firebase.auth();
const database = firebase.database();


auth.onAuthStateChanged((user) => {
    if (!user) {
        // User is not logged in, redirect to index.html
        window.location.href = "index.html";
    }
   
});
//Percentiles
async function loadPercentileData(filepath) {
    try {
        const response = await fetch(filepath);
        const data = await response.json();
        console.log("Loaded JSON data structure:", data); 
        return data;
    } catch (error) {
        console.error("Error loading percentile data:", error);
        throw error;
    }
}



function calculateLifterDOTS(weight, squat, bench, deadlift, isMale, unit) {
    const maleCoeff = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
    const femaleCoeff = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];

    // Convert weight to kilograms if needed
    let bw = unit === 'lbs' ? weight * 0.453592 : weight;

    // Select coefficients based on gender
    const coeff = isMale ? maleCoeff : femaleCoeff;

    // Calculate the denominator polynomial
    let denominator = coeff[0];
    for (let i = 1; i < coeff.length; i++) {
        denominator += coeff[i] * Math.pow(bw, i);
    }

    // Convert total lifted to kilograms if needed
    let total = unit === 'lbs'
        ? (squat + bench + deadlift) * 0.453592
        : (squat + bench + deadlift);

    // Compute the DOTS score
    let score = (500 / denominator) * total;

    return score.toFixed(2);
}



async function calculateUserPercentile(squat, bench, deadlift, userCategory) {
    const percentilesData = await loadPercentileData('percentile.json');
    
  
 
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
    document.addEventListener('DOMContentLoaded', function() {
        const instagramContainer = document.getElementById('instagramContainer');
        const popup = document.getElementById('instagramPopup');
        const closeBtn = document.getElementById('closePopup');
        const saveBtn = document.getElementById('saveInstagram');
        const input = document.getElementById('instagramInput');
        let instagramLink = '';
    
        // Function to fetch Instagram link from Firebase
        async function fetchInstagramLink() {
            try {
                const userId = firebase.auth().currentUser?.uid;
                if (userId) {
                    const snapshot = await firebase.database().ref(`users/${userId}/instagramLink`).once('value');
                    instagramLink = snapshot.val() || '';
                    // Update input value if popup is open
                    input.value = instagramLink;
                }
            } catch (error) {
                console.error('Error fetching Instagram link:', error);
            }
        }
    
        // Function to save Instagram link to Firebase
        async function saveInstagramLink(link) {
            try {
                const userId = firebase.auth().currentUser?.uid;
                if (!userId) throw new Error('User not authenticated');
    
                // Save to Firebase
                await firebase.database().ref(`users/${userId}`).update({
                    instagramLink: link
                });
                
                instagramLink = link;
                popup.classList.add('hidden');
            } catch (error) {
                console.error('Error saving Instagram link:', error);
                alert('Failed to save Instagram link. Please try again.');
            }
        }
    
        // Event listener for Instagram icon click
        instagramContainer.querySelector('.fa-instagram').addEventListener('click', function() {
            if (instagramLink) {
                window.open(instagramLink, '_blank');
            } else {
                popup.classList.remove('hidden');
            }
        });
    
        // Event listener for close button
        closeBtn.addEventListener('click', function() {
            popup.classList.add('hidden');
        });
    
        // Event listener for save button
        saveBtn.addEventListener('click', function() {
            const link = input.value.trim();
            if (link) {
                saveInstagramLink(link);
            } else {
                alert('Please enter a valid Instagram profile link');
            }
        });
    
        // Close popup when clicking outside
        popup.addEventListener('click', function(e) {
            if (e.target === popup) {
                popup.classList.add('hidden');
            }
        });
    
        // Fetch Instagram link when user logs in
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                fetchInstagramLink();
            }
        });
    });
    function findPercentileFromBrackets(value, brackets) {
        // Convert brackets to arrays for easier manipulation
        const percentiles = Object.keys(brackets).map(Number).sort((a, b) => a - b);
        const values = percentiles.map(p => brackets[p]);
        
        if (value < values[0]) {
     
            const slope = percentiles[0] / values[0];
            return Math.max(0, value * slope);
        }
        
      
        if (value >= values[values.length - 1]) {
 
            const lastPercentile = percentiles[percentiles.length - 1];
            const remainingPercentile = 100 - lastPercentile;
            const exceedance = value - values[values.length - 1];
            const scale = remainingPercentile / (values[values.length - 1] * 0.1); 
            return Math.min(100, lastPercentile + (exceedance * scale));
        }
        
  
        for (let i = 0; i < values.length - 1; i++) {
            if (value >= values[i] && value < values[i + 1]) {
                const lowerValue = values[i];
                const upperValue = values[i + 1];
                const lowerPercentile = percentiles[i];
                const upperPercentile = percentiles[i + 1];
                
            
                const position = (value - lowerValue) / (upperValue - lowerValue);
                
      
                const t = position;
                const smoothPosition = t * t * (3 - 2 * t);
                
                return lowerPercentile + (smoothPosition * (upperPercentile - lowerPercentile));
            }
        }
        
        return 100;
    }


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

function formatPercentile(percentile) {
    return Number(percentile).toFixed(2);
}


function normalizeGender(gender) {
    gender = gender.toLowerCase().trim();
    return gender === 'male' || gender === 'm' ? 'male' : 
           gender === 'female' || gender === 'f' ? 'female' : gender;
}



function getPercentile(lift, liftData) {

    const percentiles = Object.keys(liftData).map(Number).sort((a, b) => a - b);
    

    if (lift >= liftData[percentiles[percentiles.length - 1]]) {
        return 100; 
    }


    let lowerWeight = null;
    let upperWeight = null;

    for (const percentile of percentiles) {
        if (liftData[percentile] < lift) {
            lowerWeight = percentile; 
        } else if (liftData[percentile] >= lift && upperWeight === null) {
            upperWeight = percentile; 
            break;
        }
    }


    if (lowerWeight === null) {
        return percentiles[0]; 
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
      
}





// Function to add a new row to the lift data table
function addRow() {
    const tbody = document.getElementById('liftDataBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>
        <input inputmode="numeric" type="number" class="age w-full px-2 py-1 border rounded" placeholder="Age"></td>
                        <td><input inputmode="numeric" type="number" class="weight w-full px-2 py-1 border rounded" placeholder="Weight"></td>
                                                <td>
                            <select class="gender w-full p-2 border rounded">
                                <option value="" disabled selected>Gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </td>
                        <td><input inputmode="numeric" type="number" class="squat w-full px-2 py-1 border rounded" placeholder="Squat"></td>
                        <td><input inputmode="numeric" type="number" class="bench w-full px-2 py-1 border rounded" placeholder="Bench"></td>
                        <td><input inputmode="numeric" type="number" class="deadlift w-full px-2 py-1 border rounded" placeholder="Deadlift"></td>
                        <td><button onclick="removeRow(this)" class="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Remove</button></td>
    `;
    tbody.appendChild(newRow);
}

// Function to remove a row from the lift data table
function removeRow(button) {
    const row = button.closest('tr');
    row.remove();
}

// Function to clear the lift data table
function clearLiftDataTable() {
    const tbody = document.getElementById('liftDataBody');
    tbody.innerHTML = ''; // Clear all rows
    addRow(); // Add one empty row
}



const csvFilePath = 'http://localhost/LiftAscend/filtered_lifting_data.csv'; // Replace with your actual CSV file path


async function submitLiftData() {
    const user = firebase.auth().currentUser;

    if (!user) {
        alert('You must be logged in to submit lift data.');
        return;
    }

    const rows = document.querySelectorAll('#liftDataBody tr');
    const liftData = [];

    for (const [index, row] of rows.entries()) {
        const age = row.querySelector('.age').value;
        const weight = row.querySelector('.weight').value; // Get weight
        let gender = row.querySelector('.gender').value; // Updated to match class
        const squat = row.querySelector('.squat').value;
        const bench = row.querySelector('.bench').value;
        const deadlift = row.querySelector('.deadlift').value;

        if (age && weight && gender && squat && bench && deadlift) { // Check all fields
            const totalLift = parseInt(squat) + parseInt(bench) + parseInt(deadlift);
            const weightValue = parseInt(weight);
            let weightClass;

            gender = gender.trim().toLowerCase()
            // Determine weight class based on gender
            if (gender.toLowerCase() === 'male') {
                weightClass = getWeightClassMale(weightValue, currentWeightUnit);
            } else if (gender.toLowerCase() === 'female') {
                weightClass = getWeightClassFemale(weightValue, currentWeightUnit);
            } else {
                alert(`Invalid gender in row ${index + 1}. Please enter 'male' or 'female'.`);
                return;
            }
          
            try {
                // Calculate the user's percentiles to get the rank
                const userPercentiles = await calculateUserPercentile(
                    parseInt(squat),
                    parseInt(bench),
                    parseInt(deadlift),
                    {
                        gender: gender.trim(),
                        weightClass: weightClass,
                        ageGroup: getAgeGroup(parseInt(age))
                    }
                );

                // Calculate the average percentile to determine the rank
                const avgPercentile = (userPercentiles.squat + userPercentiles.bench + userPercentiles.deadlift) / 3;
                const userRank = updateUserRank(avgPercentile); // Get the rank based on average percentile

                // Wrap lift object in an array to create 0 index
                const liftObject = {
                    age: parseInt(age),
                    weight: weightValue,
                    gender: gender.trim(),
                    squat: parseInt(squat),
                    bench: parseInt(bench),
                    deadlift: parseInt(deadlift),
                    total: totalLift,
                    timestamp: Date.now(),
                    weightClass: weightClass,
                    ageGroup: getAgeGroup(parseInt(age)),
                    unit: currentWeightUnit,
                    rank: userRank // Append the calculated rank here
                };

                liftData.push(liftObject);

                // Calculate and display percentiles after creating liftObject
                displayUserStrengthComparison(
                    parseInt(squat),
                    parseInt(bench),
                    parseInt(deadlift),
                    {
                        gender: gender.trim(),
                        weightClass: weightClass,
                        ageGroup: getAgeGroup(parseInt(age))
                    }
                );
            } catch (error) {
                console.error("Error calculating percentiles or rank:", error);
                alert(`Error calculating data for row ${index + 1}.`);
                return; // Stop the submission if there's an error
            }
        } else {
            alert(`Please fill all fields in row ${index + 1}`);
            return;
        }
    }

    if (liftData.length > 0) {
        const database_ref = firebase.database().ref();
        for (const lift of liftData) {
            // Push the lift object to the database
            try {
                await database_ref.child('users/' + user.uid + '/liftData').push(lift);
            } catch (error) {
                console.error('Error submitting lift data:', error);
                alert('Failed to submit lift data. Please check the console for more details.');
                return; // Stop further submissions if there's an error
            }
        }
        alert('Lift data submitted successfully!');
        clearLiftDataTable();
        loadUserData(); // Refresh the displayed data
    } else {
        alert('No valid lift data to submit.');
    }
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
        if (weight > 140) return '140kg';
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
        if (weight > 140) return '140kg';
    }

    
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
        if (weight > 90)return '90kg';

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
        if (weight > 90)return '90kg';
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
    if (age < 14) {
        return 'Youth';
    } else if (age >= 14 && age <= 15) {
        return 'Teen1';
    } else if (age >= 16 && age <= 17) {
        return 'Teen2';
    } else if (age >= 18 && age <= 19) {
        return 'Teen3';
    } else if (age >= 35 && age <= 39) {
        return 'Sub-Master';
    } else if (age >= 40 && age <= 49) {
        return 'Master I';
    } else if (age >= 50) {
        return 'Master II';
    } else {
        return 'Open';  // Default for adults between 20 and 34
    }               // Age Range: 50 years and older

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
    document.getElementById('user-bench').textContent = `${data.bench} ${currentWeightUnit}`;
    document.getElementById('user-squat').textContent = `${data.squat} ${currentWeightUnit}`;
    document.getElementById('user-deadlift').textContent = `${data.deadlift} ${currentWeightUnit}`;
    document.getElementById('user-gender').textContent = `${data.gender}`;
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

function loadUserData() {
    const user = firebase.auth().currentUser;

    if (user) {
        const uid = user.uid;

        // Get the last 5 characters of the uid
        const lastFiveChars = uid.slice(-5);

        // Load user data
        firebase.database().ref('users/' + uid).once('value').then((snapshot) => {
            const userData = snapshot.val();
            console.log('Loading user data from Firebase:', userData); // Debug log
            if (userData) {
                // Update name - prioritize saved custom name over Google display name
                const displayName = userData.name || userData.displayName || user.displayName || 'N/A';
                console.log('Loading name from Firebase:', { 
                    savedName: userData.name, 
                    displayName: userData.displayName, 
                    googleName: user.displayName,
                    finalName: displayName 
                });
                document.getElementById('user-full-name').textContent = displayName;
                document.getElementById('user-id').textContent = lastFiveChars;
                
                // Update age and bodyweight if available (read-only now)
                if (userData.age) {
                    document.getElementById('age').textContent = userData.age;
                }
                if (userData.bodyweight) {
                    let displayWeight = userData.bodyweight;
                    if (currentWeightUnit === 'kgs' && userData.unit === 'lbs') {
                        displayWeight = lbsToKg(userData.bodyweight).toFixed(1);
                    } else if (currentWeightUnit === 'lbs' && userData.unit === 'kgs') {
                        displayWeight = kgToLbs(userData.bodyweight).toFixed(1);
                    }
                    document.getElementById('bodyweight').textContent = `${displayWeight} ${currentWeightUnit}`;
                }
                if (userData.gender) {
                    document.getElementById('user-gender').textContent = userData.gender;
                }
            }
        }).catch((error) => {
            console.error(error);
        });

        // Load lift data and calculate percentiles
        firebase.database().ref('users/' + user.uid + '/liftData').limitToLast(1).once('value')
            .then(async (snapshot) => {
                const userData = snapshot.val();
              
                
              
                if (userData) {
                    const lastEntry = Object.values(userData)[0];
                    updateProfileDisplay(lastEntry);
                    currentWeightUnit = lastEntry.unit;
                   
                    // Store the original weight and lifts
                    let userWeight = lastEntry.weight; // Assuming weight is stored in the database
                    let userSquat = lastEntry.squat;
                    let userBench = lastEntry.bench;
                    let userDeadlift = lastEntry.deadlift;

                    // Calculate percentiles
                    try {
                        const userPercentiles = await calculateUserPercentile(
                            userSquat,
                            userBench,
                            userDeadlift,
                            {
                                gender: lastEntry.gender,
                                weightClass: lastEntry.weightClass,
                                ageGroup: lastEntry.ageGroup
                            }
                        );

                        // Calculate average percentile and rank
                        const avgPercentile = (userPercentiles.squat + userPercentiles.bench + userPercentiles.deadlift) / 3;
                        const userRank = updateUserRank(avgPercentile); // Calculate rank based on average percentile
                        const dotsScore = calculateLifterDOTS(
                            userWeight,
                            userSquat,
                            userBench,
                            userDeadlift,
                            lastEntry.gender.toLowerCase() === 'male',
                            currentWeightUnit
                        );

                        // Calculate total lifts
                        let total = userSquat + userBench + userDeadlift;

                        // Adjust weight and total based on current unit
                        if (currentWeightUnit === 'lbs' && lastEntry.unit === 'kgs') {
                            total = kgToLbs(total); // Convert total to lbs
                            userWeight = kgToLbs(userWeight); // Convert user weight to lbs
                        } else if (currentWeightUnit == 'kgs' && lastEntry.unit === 'lbs') {
                            total = lbsToKg(total); // Convert total to kgs
                            userWeight = lbsToKg(userWeight); // Convert user weight to kgs
                        }

                        // Update UI
                        document.getElementById('age').textContent = lastEntry.age;
                        document.getElementById('bodyweight').textContent = `${userWeight.toFixed(1)} ${currentWeightUnit}`;
                        document.getElementById("total").innerHTML = `${total.toFixed(1)} <strong>${currentWeightUnit}</strong>`;
                        document.getElementById('dots').textContent = ` ${dotsScore}`;
                        displayRank(userRank);
                        displayPercentiles(userPercentiles);
                        
                        // Call selectWeightUnit to ensure units are displayed correctly
                        selectWeightUnit(currentWeightUnit);

                    } catch (error) {
                        console.error("Error calculating percentiles:", error);
                    }
                }
            })
            .catch((error) => {
                console.error("Error loading user data:", error);
            });
    }

    function calculateLifterDOTS(weight, squat, bench, deadlift, isMale, unit) {
        const maleCoeff = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
        const femaleCoeff = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
   
        let bw = unit === 'lbs' ? weight * 0.453592 : weight;
    

        let maxbw = isMale ? 210 : 150;
        bw = Math.min(Math.max(bw, 40), maxbw);
    

        let coeff = isMale ? maleCoeff : femaleCoeff;

        let denominator = coeff[0];
        for (let i = 1; i < coeff.length; i++) {
            denominator += coeff[i] * Math.pow(bw, i);
        }
    
        let total = unit === 'lbs' ? 
            (squat + bench + deadlift) * 0.453592 :
            squat + bench + deadlift;
    
        let score = (500 / denominator) * total;
        return score.toFixed(2);
    }
}


function displayPercentiles(percentiles) {
    const squatPercent = Math.min(Math.max(parseFloat(percentiles.squat) || 0, 0), 100);
    const benchPercent = Math.min(Math.max(parseFloat(percentiles.bench) || 0, 0), 100);
    const deadliftPercent = Math.min(Math.max(parseFloat(percentiles.deadlift) || 0, 0), 100);

    // Update progress bar widths and colors
    updateProgressBar('squat-progress', squatPercent);
    updateProgressBar('bench-progress', benchPercent);
    updateProgressBar('deadlift-progress', deadliftPercent);

    // Update percentile text and individual ranks
    updateLiftDisplay('squat', percentiles.squat);
    updateLiftDisplay('bench', percentiles.bench);
    updateLiftDisplay('deadlift', percentiles.deadlift);
}

function updateProgressBar(elementId, percent) {
    const progressBar = document.getElementById(elementId);
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        // Remove all possible color classes
        progressBar.classList.remove('bg-purple-600', 'bg-yellow-500', 'bg-gray-400', 'bg-red-600');
        // Add appropriate color class
        progressBar.classList.add(getColorClass(percent));
    }
}

function updateLiftDisplay(lift, percentile) {
    const percentileElement = document.getElementById(`${lift}-percentile`);
    const rankImage = document.getElementById(`${lift}-rank`);
    
    if (percentileElement) {
        percentileElement.textContent = `${percentile}%`;
    }
    
    if (rankImage) {
        const rank = getRankFromPercentile(percentile);
        rankImage.src = `./Images/${rank}.png`;
        rankImage.alt = rank;
        rankImage.style.visibility = "visible";
    }
}

function getRankFromPercentile(percentile) {
    if (percentile >= 80) return "Diamond";
    if (percentile >= 65) return "Gold";
    if (percentile >= 45) return "Silver";
    return "Bronze";
}

function getColorClass(percent) {
    if (percent >= 80) return 'bg-purple-600';
    if (percent >= 65) return 'bg-yellow-500';
    if (percent >= 45) return 'bg-gray-400';
    return 'bg-red-600';
}

// Call loadUserData when the page loads
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            loadUserData();
            populateLeaderboard();
        }
    });
});

// Function to logout
function logout() {
    firebase.auth().signOut()
        .then(() => {
            console.log("User signed out successfully");
            window.location.href = "index.html";
        })
        .catch((error) => {
            console.error("Error signing out:", error);
            alert("An error occurred while logging out. Please try again.");
        });
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
    database.ref('users').once('value', function (snapshot) {
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

window.onload = loadUserData;
let isFriendListLoaded = false;

document.getElementById('toggle-friend-list').addEventListener('click', function(event) {
    event.stopPropagation(); // Prevent the click from immediately closing the dropdown
    const friendListContainer = document.getElementById('friend-list-container');
    
    // Toggle visibility
    if (friendListContainer.style.display === 'none' || friendListContainer.style.display === '') {
        friendListContainer.style.display = 'block';
        this.textContent = 'Hide Friends';
        
        // Load friends if they haven't been loaded yet
        if (!isFriendListLoaded) {
            populateFriendList();
            isFriendListLoaded = true;
        }
    } else {
        friendListContainer.style.display = 'none';
        this.textContent = 'Show Friends';
    }
});

function populateFriendList() {
    const user = firebase.auth().currentUser;

    firebase.database().ref(`users/${user.uid}/friends`).once('value')
        .then((snapshot) => {
            const userData = snapshot.val();
            const friendList = document.getElementById('friend-list');
            friendList.innerHTML = '';

            if (userData) {
                // Create a Set to track unique friend IDs
                const uniqueFriends = new Map();

                // First pass: collect unique friends
                for (const friendKey in userData) {
                    if (userData.hasOwnProperty(friendKey)) {
                        const friend = userData[friendKey];
                        if (!uniqueFriends.has(friend.friendId)) {
                            uniqueFriends.set(friend.friendId, {
                                key: friendKey,
                                timestamp: friend.timestamp
                            });
                        } else {
                            // If duplicate found, keep the one with the most recent timestamp
                            if (friend.timestamp > uniqueFriends.get(friend.friendId).timestamp) {
                                // Remove old friend entry from Firebase
                                firebase.database().ref(`users/${user.uid}/friends/${uniqueFriends.get(friend.friendId).key}`).remove();
                                uniqueFriends.set(friend.friendId, {
                                    key: friendKey,
                                    timestamp: friend.timestamp
                                });
                            } else {
                                // Remove new duplicate entry from Firebase
                                firebase.database().ref(`users/${user.uid}/friends/${friendKey}`).remove();
                            }
                        }
                    }
                }

                // Second pass: display unique friends
                firebase.database().ref('users').once('value')
                    .then((usersSnapshot) => {
                        const allUsers = usersSnapshot.val();

                        uniqueFriends.forEach((friendInfo, friendId) => {
                            let friendData = null;

                            // Find friend by either full_name slice or uid slice
                            for (const userId in allUsers) {
                                const currentUser = allUsers[userId];
                                if ((currentUser.full_name && currentUser.full_name.slice(-5) === friendId) ||
                                    userId.slice(-5) === friendId) {
                                    friendData = currentUser;
                                    break;
                                }
                            }

                            const friendName = friendData ? friendData.name : 'Unknown Friend';
                            
                            const listItem = document.createElement('li');
                            
                            const nameSpan = document.createElement('span');
                            nameSpan.classList.add(
                                'text-lg',            // Large text
                                'font-semibold',      // Bold font
                                'text-blue-600',      // Blue text color
                                'hover:text-blue-800', // Darker blue on hover
                                'px-2',               // Padding on the x-axis
                                'py-1',               // Padding on the y-axis
                                'rounded-md',         // Rounded corners
                                'transition-colors',  // Smooth color transition on hover
                                'duration-300'        // 300ms transition duration
                            );
                            nameSpan.textContent = friendName;
                            nameSpan.style.cursor = 'pointer';
                            nameSpan.addEventListener('click', () => {
                                window.location.href = `profile.html?userId=${friendId}`;
                            });

                            const deleteButton = document.createElement('button');
                            deleteButton.textContent = 'X';
                            deleteButton.style.marginLeft = '10px';
                            deleteButton.classList.add(
                                'ml-2',               // Margin-left for spacing
                                'text-white',         // White text color
                                'bg-red-500',         // Red background color
                                'hover:bg-red-700',   // Darker red on hover
                                'font-bold',          // Bold font
                                'px-2',               // Padding on the x-axis
                                'py-1',               // Padding on the y-axis
                                'rounded',            // Rounded corners
                                'transition-colors',  // Smooth color transition on hover
                                'duration-300',
                                'text-xs'          // 300ms transition duration
                            );
                            
                            // Optional: Add an accessible title for screen readers
                            deleteButton.setAttribute('aria-label', 'Delete friend name');
                            deleteButton.addEventListener('click', () => {
                                firebase.database().ref(`users/${user.uid}/friends/${friendInfo.key}`).remove()
                                    .then(() => {
                                        listItem.remove();
                                        populateLeaderboard();
                                    })
                                    .catch((error) => {
                                        console.error("Error removing friend:", error);
                                    });
                            });

                            listItem.appendChild(nameSpan);
                            listItem.appendChild(deleteButton);
                            friendList.appendChild(listItem);
                        });

                        if (friendList.children.length === 0) {
                            const noFriendsItem = document.createElement('li');
                            noFriendsItem.textContent = "No friends found.";
                            friendList.appendChild(noFriendsItem);
                        }
                    })
                    .catch((error) => {
                        console.error("Error fetching users data:", error);
                    });
            } else {
                const noFriendsItem = document.createElement('li');
                noFriendsItem.textContent = "No friends found.";
                friendList.appendChild(noFriendsItem);
            }
        })
        .catch((error) => {
            console.error("Error loading user data:", error);
        });
}
// Close the friend list if the user clicks outside of it
document.addEventListener('click', function(event) {
    const friendListContainer = document.getElementById('friend-list-container');
    const toggleButton = document.getElementById('toggle-friend-list');
    
    if (!friendListContainer.contains(event.target) && event.target !== toggleButton) {
        friendListContainer.style.display = 'none';
        toggleButton.textContent = 'Show Friends';
    }
});
document.addEventListener("DOMContentLoaded", function() {
   
    populateLeaderboard();
});

function sortLeaderboard(criteria) {
    currentCriteria = criteria; // Update the global criteria variable
    toggleColumns(); // Call toggleColumns to reflect the new criteria
    // Implement sorting logic here
   

   populateLeaderboard(); // Call to refresh the leaderboard display
}

function toggleColumns() {
    const unit = getCurrentWeightUnit(); // Get the current unit here
    const scoreHeader = document.querySelector('th[data-column="total"]');
    const totalSpans = document.querySelectorAll('.total-column');
    const dotsSpans = document.querySelectorAll('.dots-column');
    const squatSpans = document.querySelectorAll('.squat-column');
    const benchSpans = document.querySelectorAll('.bench-column');
    const deadliftSpans = document.querySelectorAll('.deadlift-column');

    // Update the total score header and visibility of columns based on current criteria
    if (currentCriteria === "By Total") {
        scoreHeader.textContent = "Total (" + unit + ")"; // Add unit to header
        totalSpans.forEach(span => span.style.display = "inline");
        dotsSpans.forEach(span => span.style.display = "none");
        squatSpans.forEach(span => span.style.display = "none"); // Show squat columns
        benchSpans.forEach(span => span.style.display = "none"); // Show bench columns
        deadliftSpans.forEach(span => span.style.display = "none"); // Show deadlift columns
    } else if (currentCriteria === "By Dots") {
        scoreHeader.textContent = "DOTS Score"; // No unit needed for DOTS
        totalSpans.forEach(span => span.style.display = "none");
        dotsSpans.forEach(span => span.style.display = "inline");
        squatSpans.forEach(span => span.style.display = "none"); // Hide squat columns
        benchSpans.forEach(span => span.style.display = "none"); // Hide bench columns
        deadliftSpans.forEach(span => span.style.display = "none"); // Hide deadlift columns
    } else if (currentCriteria === "By Squat") {
        scoreHeader.textContent = "Squat (" + unit + ")"; // Add unit to squat header
        totalSpans.forEach(span => span.style.display = "none"); // Hide total columns
        dotsSpans.forEach(span => span.style.display = "none"); // Hide DOTS columns
        squatSpans.forEach(span => span.style.display = "inline"); // Show squat columns
        benchSpans.forEach(span => span.style.display = "none"); // Hide bench columns
        deadliftSpans.forEach(span => span.style.display = "none"); // Hide deadlift columns
    } else if (currentCriteria === "By Bench") {
        scoreHeader.textContent = "Bench (" + unit + ")"; // Add unit to bench header
        totalSpans.forEach(span => span.style.display = "none"); // Hide total columns
        dotsSpans.forEach(span => span.style.display = "none"); // Hide DOTS columns
        squatSpans.forEach(span => span.style.display = "none"); // Hide squat columns
        benchSpans.forEach(span => span.style.display = "inline"); // Show bench columns
        deadliftSpans.forEach(span => span.style.display = "none"); // Hide deadlift columns
    } else if (currentCriteria === "By Deadlift") {
        scoreHeader.textContent = "Deadlift (" + unit + ")"; // Add unit to deadlift header
        totalSpans.forEach(span => span.style.display = "none"); // Hide total columns
        dotsSpans.forEach(span => span.style.display = "none"); // Hide DOTS columns
        squatSpans.forEach(span => span.style.display = "none"); // Hide squat columns
        benchSpans.forEach(span => span.style.display = "none"); // Hide bench columns
        deadliftSpans.forEach(span => span.style.display = "inline"); // Show deadlift columns
    }
}
function validateInstagramLink(url) {
    const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/;
    return instagramRegex.test(url);
}

// Function to update the Instagram icon with the saved link
function updateInstagramLinkDisplay(link) {
    const instagramIcon = document.getElementById('instagramIcon');
    const updateButton = document.getElementById('updateInstagram');
    const displayInstagramLink = document.getElementById('displayInstagramLink');

    // Remove existing event listeners to prevent multiple bindings
    const newInstagramIcon = instagramIcon.cloneNode(true);
    instagramIcon.parentNode.replaceChild(newInstagramIcon, instagramIcon);

    if (link) {
        // Show the Update button
        updateButton.style.display = 'block';

        // Update Instagram Icon Click to Open Link
        newInstagramIcon.addEventListener('click', () => {
            window.open(link, '_blank');
        });

        // Update Button Click to Open Popup
        updateButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the icon's click event
            document.getElementById('instagramPopup').classList.remove('hidden');
        });

        // Update the display link
        displayInstagramLink.href = link;
        displayInstagramLink.textContent = link;
    } else {
        // Hide the Update button
        updateButton.style.display = 'none';

        // Update Instagram Icon Click to Open Popup
        newInstagramIcon.addEventListener('click', () => {
            document.getElementById('instagramPopup').classList.remove('hidden');
        });

        // Update the display link
        displayInstagramLink.href = "#";
        displayInstagramLink.textContent = "Not Set";
    }
}

// Function to save Instagram link to Firebase
function saveInstagramLink(link) {
    const user = auth.currentUser;

    if (user) {
        const uid = user.uid;
        database.ref('users/' + uid + '/instagram').set(link)
            .then(() => {
                alert('Instagram profile link saved successfully!');
                document.getElementById('instagramPopup').classList.add('hidden');
                document.getElementById('instagramInput').value = '';
                updateInstagramLinkDisplay(link);
            })
           
    } else {
        alert('No user is currently logged in.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const instagramIcon = document.getElementById('instagramIcon');
    const instagramPopup = document.getElementById('instagramPopup');
    const closePopupButton = document.getElementById('closePopup');
    const saveInstagramButton = document.getElementById('saveInstagram');
    const displayInstagramLink = document.getElementById('displayInstagramLink');

    // Close Instagram popup when the close button is clicked
    closePopupButton.addEventListener('click', () => {
        instagramPopup.classList.add('hidden');
    });

    // Save Instagram link when the save button is clicked
    saveInstagramButton.addEventListener('click', () => {
        const instagramInput = document.getElementById('instagramInput').value.trim();

        if (validateInstagramLink(instagramInput)) {
            saveInstagramLink(instagramInput);
        } else {
            alert('Please enter a valid Instagram profile link.');
        }
    });
});

// Load Instagram link on user authentication
auth.onAuthStateChanged((user) => {
    if (user) {
        const uid = user.uid;
        database.ref('users/' + uid + '/instagram').once('value')
            .then((snapshot) => {
                const instagramLink = snapshot.val();
                updateInstagramLinkDisplay(instagramLink);
            })
            .catch((error) => {
                console.error('Error loading Instagram link:', error);
            });
    } else {
        // Handle user not logged in if necessary
    }
});





// Existing function to populate the leaderboard
// Function to populate the leaderboard
function populateLeaderboard(criteria) {
    const user = firebase.auth().currentUser;
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';

    firebase.database().ref(`users/${user.uid}/friends`).once('value')
        .then((snapshot) => {
            const userData = snapshot.val();
            const leaderboardData = []; // Array to hold leaderboard entries

         
                const friendPromises = []; // Array to hold promises for fetching friend data

                for (const friendKey in userData) {
                    if (userData.hasOwnProperty(friendKey)) {
                        const friend = userData[friendKey];

                        const promise = firebase.database().ref('users').once('value')
                            .then((usersSnapshot) => {
                                const allUsers = usersSnapshot.val();
                                let friendData = null;

                                for (const userId in allUsers) {
                                    if (allUsers[userId].full_name && 
                                        allUsers[userId].full_name.slice(-5) === friend.friendId) {
                                        friendData = allUsers[userId];
                                        break;
                                    }
                                }
                                // Check if friend's data exists
if (friendData) {
    // Set friend's name and profile URL
    const friendName = friendData.name || 'Unknown Friend';
    const friendProfileUrl = `profile.html?userId=${friendData.full_name.slice(-5)}`;

    // Initialize variables for finding the most recent lift data
    let mostRecentLift = null;
    let maxTimestamp = 0;

    // Check if lift data exists and process it if so
    if (friendData.liftData) {
        // Ensure liftData is treated as an array
        const liftEntries = Array.isArray(friendData.liftData) 
            ? friendData.liftData 
            : Object.values(friendData.liftData);

        // Loop through lift entries to find the most recent one
        for (const lift of liftEntries) {
            if (lift.timestamp > maxTimestamp) {
                maxTimestamp = lift.timestamp;
                mostRecentLift = lift;
            }
        }
    }

    // Extract lift data values and calculate the total if lift data is found
    const squat = mostRecentLift ? parseFloat(mostRecentLift.squat) : 0;
    const bench = mostRecentLift ? parseFloat(mostRecentLift.bench) : 0;
    const deadlift = mostRecentLift ? parseFloat(mostRecentLift.deadlift) : 0;
    const total = squat + bench + deadlift;

    // Ensure weight and unit are available for DOTS calculation, defaulting if missing
    const weight = mostRecentLift ? parseFloat(mostRecentLift.weight) : 0;
    const unit = mostRecentLift ? mostRecentLift.unit || 'lbs' : 'lbs';
    const gender = mostRecentLift ? mostRecentLift.gender.toLowerCase() === 'male' : true;

    // Calculate DOTS score
    const dotsScore = calculateLifterDOTS(weight, squat, bench, deadlift, gender, unit);

    // Push data to leaderboardData array
    leaderboardData.push({
        name: friendName,
        profileUrl: friendProfileUrl,
        total,                // Total lift score
        squat,                // Squat value
        bench,                // Bench press value
        deadlift,             // Deadlift value
        dots: dotsScore,      // DOTS score
        rank: mostRecentLift ? mostRecentLift.rank : '', // Rank if available
        unit                  // Weight unit
    });
}

                                
                         
                                // Push data to leaderboardData array
                             
                            });

                        friendPromises.push(promise); // Collect promises
                    }
                }

                // Wait for all promises to resolve
                Promise.all(friendPromises).then(() => {
                    // Sort leaderboardData based on criteria
                    leaderboardData.sort((a, b) => {
                        switch (criteria) {
                            case 'By Total':
                                return b.total - a.total;
                            case 'By Dots':
                                return b.dots - a.dots;
                            case 'By Squat':
                                return b.squat - a.squat;
                            case 'By Bench':
                                return b.bench - a.bench;
                            case 'By Deadlift':
                                return b.deadlift - a.deadlift;
                            default:
                                return 0; // Default case if no criteria matches
                        }
                    });
                
                    // Clear existing content
                    tbody.innerHTML = '';
                  
                    // Populate the leaderboard
                    leaderboardData.forEach((entry, index) => {
                        const row = document.createElement('tr');
                
                        // Place cell
                        const placeCell = document.createElement('td');
                        placeCell.textContent = index + 1;
                        placeCell.classList.add('px-4', 'py-3', 'text-left', 'bg-white', 'text-gray-800', 'font-semibold');
                        row.appendChild(placeCell);
                
                        // Name cell
                        const nameCell = document.createElement('td');
                        const nameLink = document.createElement('a');
                        nameLink.href = entry.profileUrl;
                        nameLink.textContent = entry.name;
                        nameLink.classList.add('bg-white', 'px-3', 'py-2', 'rounded-xl', 'shadow-lg', 'inline-flex', 'items-center', 'transform', 'hover:scale-110', 'hover:bg-gray-200', 'transition-transform', 'transition-colors', 'duration-500', 'ease-in-out', 'hover:shadow-2xl');
                        nameCell.style.whiteSpace = 'nowrap';
                        nameCell.style.width = 'auto';
                        nameCell.classList.add('px-4', 'py-3', 'text-left');
                        nameCell.appendChild(nameLink);
                        row.appendChild(nameCell);
                
                        // Score cell (will show either Total or DOTS based on criteria)
                        const scoreCell = document.createElement('td');
                        scoreCell.classList.add('px-4', 'py-3', 'text-left');
                
                        // Total cell
                        const totalSpan = document.createElement('span');
                        let total = entry.total;
                
                        if (entry.unit === 'kgs' && currentWeightUnit === 'lbs') {
                            total = kgToLbs(entry.total).toFixed(1);
                        } 
                        if (entry.unit === 'lbs' && currentWeightUnit === 'kgs') {
                            total = lbsToKg(entry.total).toFixed(1);
                        }
                        totalSpan.textContent = total + " " + currentWeightUnit;
                        totalSpan.classList.add('px-4', 'py-3', 'text-left', 'total-column');
                        scoreCell.appendChild(totalSpan);
                
                        const dotsSpan = document.createElement('span');
                        dotsSpan.textContent = entry.dots;
                        dotsSpan.classList.add('dots-column');
                        dotsSpan.style.display = 'none'; // Hide DOTS by default
                        scoreCell.appendChild(dotsSpan);
                
                        // Squat conversion
                        const squatSpan = document.createElement('span');
                        let squat = entry.squat;
                
                        if (entry.unit === 'kgs' && currentWeightUnit === 'lbs') {
                            squat = kgToLbs(entry.squat).toFixed(1);
                        } 
                        if (entry.unit === 'lbs' && currentWeightUnit === 'kgs') {
                            squat = lbsToKg(entry.squat).toFixed(1);
                        }
                        squatSpan.textContent = squat + " " + currentWeightUnit; // Add unit
                        squatSpan.classList.add('squat-column');
                        squatSpan.style.display = 'none'; // Initially hide squat
                        scoreCell.appendChild(squatSpan); // Add squat span to score cell
                
                       
                
                        // Bench conversion
                        const benchSpan = document.createElement('span');
                        let bench = entry.bench;
                
                        if (entry.unit === 'kgs' && currentWeightUnit === 'lbs') {
                            bench = kgToLbs(entry.bench).toFixed(1);
                        } 
                        if (entry.unit === 'lbs' && currentWeightUnit === 'kgs') {
                            bench = lbsToKg(entry.bench).toFixed(1);
                        }
                        benchSpan.textContent = bench + " " + currentWeightUnit; // Add unit
                        benchSpan.classList.add('bench-column');
                        benchSpan.style.display = 'none'; // Initially hide bench
                        scoreCell.appendChild(benchSpan); // Add bench span to score cell
                
                        // Deadlift conversion
                        const deadliftSpan = document.createElement('span');
                        let deadlift = entry.deadlift;
                
                        if (entry.unit === 'kgs' && currentWeightUnit === 'lbs') {
                            deadlift = kgToLbs(entry.deadlift).toFixed(1);
                        } 
                        if (entry.unit === 'lbs' && currentWeightUnit === 'kgs') {
                            deadlift = lbsToKg(entry.deadlift).toFixed(1);
                        }
                        deadliftSpan.textContent = deadlift + " " + currentWeightUnit; // Add unit
                        deadliftSpan.classList.add('deadlift-column');
                        deadliftSpan.style.display = 'none'; // Initially hide deadlift
                        scoreCell.appendChild(deadliftSpan); // Add deadlift span to score cell
                
                        // Add the scoreCell to the row
                        row.appendChild(scoreCell);
                     
                        // Rank cell
                        const rankCell = document.createElement('td');
                        const rankImage = document.createElement('img');
                        rankImage.src = `./Images/${entry.rank}.png`;
                        rankImage.alt = `Place ${entry.rank}`;
                        rankImage.classList.add('w-20', 'h-20', 'border', 'border-gray-300', 'rounded-full', 'transition-transform', 'duration-200', 'hover:scale-110', 'shadow-md');
                        rankCell.classList.add('px-4', 'py-3', 'text-left');
                        rankCell.appendChild(rankImage);
                        row.appendChild(rankCell);
                        tbody.appendChild(row);
                    });
                
                    // Update column visibility after populating
                    toggleColumns(criteria);
                });
                
                
            
            
        });
}







// Close the friend list if the user clicks outside of it
document.addEventListener('click', function(event) {
    const friendListContainer = document.getElementById('friend-list-container');
    const toggleButton = document.getElementById('toggle-friend-list');
    
    if (!friendListContainer.contains(event.target) && event.target !== toggleButton) {
        friendListContainer.style.display = 'none';
        toggleButton.textContent = 'Show Friends';
    }
});

// Close the friend list if the user clicks outside of it
document.addEventListener('click', function(event) {
    const friendListContainer = document.getElementById('friend-list-container');
    const toggleButton = document.getElementById('toggle-friend-list');
    
    if (!friendListContainer.contains(event.target) && event.target !== toggleButton) {
        friendListContainer.style.display = 'none';
        toggleButton.textContent = 'Show Friends';
    }
});

function displayFileName() {
    const fileInput = document.getElementById('uploadFile');
    const fileNameContainer = document.getElementById('fileNameContainer');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileNameContainer.textContent = `Uploaded file: ${file.name}`;
    }
}

// Function to toggle weight unit display
function toggleWeightUnit() {
    const content = document.querySelector('.weight-unit-content');
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
}

function kgToLbs(kg) {
    return kg / 0.45359237;
}
// Function to handle weight unit selection

function selectWeightUnit (unit) {
    // Prevent the default action of the button (e.g., form submission)


    // Check if the selected unit is the same as the current unit
    if (unit === currentWeightUnit) {
        return; // Exit the function to avoid unnecessary conversions
    }

    const weightHeader = document.getElementById('weightHeader');
    const squatHeader = document.getElementById('squatHeader');
    const benchHeader = document.getElementById('benchHeader');
    const deadliftHeader = document.getElementById('deadliftHeader');
    const totalHeader = document.getElementById('totalHeader');

    const button = document.getElementById('weightUnitButton');
    button.textContent = `${unit} ▼`;

    // Change headers based on selected unit
    if (unit === 'kgs' && currentWeightUnit !== 'kgs' ) {
        if (((document.getElementById('total').textContent).trim() == "N/A")) {
            document.getElementById('total').textContent = '0 ' + unit;
            document.getElementById('bodyweight').textContent = '0 '+ unit;
            document.getElementById('user-squat').textContent = '0 ' + unit;
            document.getElementById('user-bench').textContent = '0 ' + unit;
            document.getElementById('user-deadlift').textContent = '0 ' + unit;
        }
        weightHeader.textContent = 'Weight (kgs)';
        squatHeader.textContent = 'Squat (kgs)';
        benchHeader.textContent = 'Bench (kgs)';
        deadliftHeader.textContent = 'Deadlift (kgs)';
        button.textContent = `${unit} ▼`;
        // Convert weights from lbs to kgs only if necessary
        if (currentWeightUnit === 'lbs') {
            convertToKgs();
        }
    } else if (unit === 'lbs' && currentWeightUnit !== 'lbs') {
        if (((document.getElementById('total').textContent).trim() == "N/A")) {
            document.getElementById('total').textContent = '0 ' + unit;
            document.getElementById('bodyweight').textContent = '0 '+ unit;
            document.getElementById('user-squat').textContent = '0 ' + unit;
            document.getElementById('user-bench').textContent = '0 ' + unit;
            document.getElementById('user-deadlift').textContent = '0 ' + unit;
        }
        weightHeader.textContent = 'Weight (lbs)';
        squatHeader.textContent = 'Squat (lbs)';
        benchHeader.textContent = 'Bench (lbs)';
        deadliftHeader.textContent = 'Deadlift (lbs)';
        button.textContent = `${unit} ▼`;
        // Convert weights from kgs to lbs only if necessary
        if (currentWeightUnit === 'kgs') {
            convertToLbs();
        }
    }

    currentWeightUnit = unit; // Update the current unit
    populateLeaderboard();
    
    getCurrentWeightUnit(currentWeightUnit);

    isInitialLoad = false; // Mark that the initial load is done
}

function getCurrentWeightUnit() {
    return currentWeightUnit; // Return the current weight unit
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


// Optional: Click outside to close the dropdown
document.addEventListener('click', function(event) {
    const content = document.querySelector('.weight-unit-content');
    const button = document.querySelector('.weight-unit-btn');
    
    if (!button.contains(event.target) && !content.contains(event.target)) {
        content.style.display = 'none';
    }
});

async function displayUserStrengthComparison(squat, bench, deadlift, userCategory) {
    const userPercentiles = await calculateUserPercentile(squat, bench, deadlift, userCategory);
    
    if (typeof displayPercentiles === 'function') {
        displayPercentiles(userPercentiles);
    }

   

    const avgPercentile = (userPercentiles.squat + userPercentiles.bench + userPercentiles.deadlift) / 3;
    const userRank = updateUserRank(avgPercentile);

    console.log(avgPercentile)
    displayRank(userRank);
}
function keepRank(userRank) {
    return userRank;
}
// Adjusted rank logic
function updateUserRank(percentile) {
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
   

    if (rankImage ) {
        // Update the rank image source and visibility
        rankImage.src = `./Images/${rank}.png`;
        rankImage.alt = rank;
        rankImage.style.visibility = "visible"; // Show the image

        // Make the rank container visible after user input
       
    }
}


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
    database.ref('users').orderByChild('full_name').startAt(query).endAt(query + '\uf8ff').once('value')
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
    document.getElementById('suggestionsContainer').style.display = 'none'; // Hide suggestions after selection
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




// Get the dropdown button and content elements
const modeButton = document.getElementById('modeButton');
const dropdownContent = document.getElementById('dropdownContent');

// Initialize the aria-expanded state when the page loads
window.addEventListener('DOMContentLoaded', function() {
    // Make sure the dropdown starts closed
    modeButton.setAttribute('aria-expanded', 'false');
    dropdownContent.classList.add('hidden');
});

function toggleDropdown() {
    const isExpanded = modeButton.getAttribute('aria-expanded') === 'true';
    modeButton.setAttribute('aria-expanded', !isExpanded);
    dropdownContent.classList.toggle('hidden');
}

// Add click event listener to the document
document.addEventListener('click', function(event) {
    // Always check if dropdown is visible (not hidden)
    if (!dropdownContent.classList.contains('hidden')) {
        // Check if click is outside both the button and dropdown content
        const isClickOutside = !modeButton.contains(event.target) && 
                              !dropdownContent.contains(event.target);
        
        if (isClickOutside) {
            modeButton.setAttribute('aria-expanded', 'false');
            dropdownContent.classList.add('hidden');
        }
    }
});

// Prevent clicks on the dropdown menu items from triggering the document click handler
dropdownContent.addEventListener('click', function(event) {
    // Only prevent propagation if clicking on a menu item
    if (event.target.getAttribute('role') === 'menuitem') {
        event.stopPropagation();
        // Close the dropdown after selecting an option
        modeButton.setAttribute('aria-expanded', 'false');
        dropdownContent.classList.add('hidden');
    }
});

// Prevent clicks on the button from triggering the document click handler
modeButton.addEventListener('click', function(event) {
    event.stopPropagation();
});

// Optional: Close dropdown when pressing Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !dropdownContent.classList.contains('hidden')) {
        modeButton.setAttribute('aria-expanded', 'false');
        dropdownContent.classList.add('hidden');
    }
});
function toggleRankExplanation() {
    const explanationDiv = document.getElementById("rankExplanation");
    explanationDiv.classList.toggle("hidden");
}

// Edit Profile Functions
let currentEditField = null;
let currentEditValue = null;

function editField(fieldType) {
    console.log('editField called with:', fieldType); // Debug log
    
    // Only allow name editing
    if (fieldType !== 'name') {
        console.log('Only name editing is allowed');
        return;
    }
    
    currentEditField = fieldType;
    
    // Get current name value
    const nameElement = document.getElementById('user-full-name');
    console.log('Name element found:', nameElement); // Debug log
    
    // Set current value in input
    const currentName = nameElement.textContent !== 'N/A' ? nameElement.textContent : '';
    document.getElementById('editNameInput').value = currentName;
    currentEditValue = currentName;
    
    // Show modal
    const modal = document.getElementById('editModal');
    console.log('Modal element:', modal); // Debug log
    modal.classList.remove('hidden');
    console.log('Modal should now be visible'); // Debug log
}

function closeEditModal() {
    console.log('closeEditModal called'); // Debug log
    document.getElementById('editModal').classList.add('hidden');
    currentEditField = null;
    currentEditValue = null;
}

async function saveEdit() {
    console.log('saveEdit called with field:', currentEditField); // Debug log
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('You must be logged in to edit your profile.');
        return;
    }
    
    // Only handle name editing
    if (currentEditField !== 'name') {
        console.log('Only name editing is supported');
        return;
    }
    
    const newName = document.getElementById('editNameInput').value.trim();
    
    if (!newName) {
        alert('Please enter a valid name.');
        return;
    }
    
    console.log('Saving name:', newName); // Debug log
    
    try {
        // Update Firebase database with both name and full_name
        const updates = {
            'name': newName,
            'full_name': newName + " " + user.uid.slice(-5)
        };
        
        console.log('Firebase updates:', updates); // Debug log
        console.log('User UID:', user.uid); // Debug log
        console.log('Saving to path: users/' + user.uid); // Debug log
        
        // Save to Firebase
        await firebase.database().ref('users/' + user.uid).update(updates);
        
        console.log('Name saved successfully to Firebase'); // Debug log
        
        // Verify the save by reading back from Firebase
        const verificationSnapshot = await firebase.database().ref('users/' + user.uid).once('value');
        const verificationData = verificationSnapshot.val();
        console.log('Verification - saved data:', verificationData); // Debug log
        
        // Update UI immediately
        document.getElementById('user-full-name').textContent = newName;
        
        // Close modal
        closeEditModal();
        
        // Show success message
        alert('Name updated successfully!');
        
    } catch (error) {
        console.error('Error updating name:', error);
        alert('Error updating name. Please try again.');
    }
}

// Update profile display function (enhanced)
function updateProfileDisplayFromEdit() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    // Load user data from Firebase
    firebase.database().ref('users/' + user.uid).once('value')
        .then((snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                // Update name
                if (userData.name) {
                    document.getElementById('user-full-name').textContent = userData.name;
                }
                
                // Update age
                if (userData.age) {
                    document.getElementById('age').textContent = userData.age;
                }
                
                // Update bodyweight
                if (userData.bodyweight) {
                    let displayWeight = userData.bodyweight;
                    if (currentWeightUnit === 'kgs' && userData.unit === 'lbs') {
                        displayWeight = lbsToKg(userData.bodyweight).toFixed(1);
                    } else if (currentWeightUnit === 'lbs' && userData.unit === 'kgs') {
                        displayWeight = kgToLbs(userData.bodyweight).toFixed(1);
                    }
                    document.getElementById('bodyweight').textContent = `${displayWeight} ${currentWeightUnit}`;
                }
                
                // Update gender if available
                if (userData.gender) {
                    document.getElementById('user-gender').textContent = userData.gender;
                }
            }
        })
        .catch((error) => {
            console.error('Error loading user data:', error);
        });
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeEditModal();
    }
});

// Make functions globally accessible for onclick handlers
window.editField = editField;
window.closeEditModal = closeEditModal;
window.saveEdit = saveEdit;

// Test function to verify the script is loading
console.log('loggedin.js loaded successfully');
console.log('editField function available:', typeof editField);

// Test the edit functionality
function testEditFunctionality() {
    console.log('Testing edit functionality...');
    console.log('Modal element exists:', !!document.getElementById('editModal'));
    console.log('Name input exists:', !!document.getElementById('editNameInput'));
    console.log('Edit button exists:', !!document.querySelector('button[onclick="editField(\'name\')"]'));
}

// Run test when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(testEditFunctionality, 1000); // Wait 1 second for everything to load
});

// Function to check current Firebase data
async function checkFirebaseData() {
    const user = firebase.auth().currentUser;
    if (user) {
        try {
            const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
            const userData = snapshot.val();
            console.log('Current Firebase data:', userData);
            return userData;
        } catch (error) {
            console.error('Error checking Firebase data:', error);
        }
    }
}

// Make checkFirebaseData globally accessible for debugging
window.checkFirebaseData = checkFirebaseData;