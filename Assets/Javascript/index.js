/**
 * Austin Ryu (1/25/2025)
 * This script handles Firebase authentication with Google Sign-In, user login/register, weightlifting data entry, 
 * percentile calculations, unit conversions, and leaderboard functionality for Lift Ascend.
 */

const firebaseConfig = {
    apiKey: "AIzaSyB5pHK1U6Oy5Ta9oPOcL5LfWXGP_U3838E",
    authDomain: "liftascend.firebaseapp.com",
    projectId: "liftascend",
    storageBucket: "liftascend.appspot.com",
    messagingSenderId: "403461421933",
    appId: "1:403461421933:web:52452b598fb853c3cb3864",
    measurementId: "G-RFR3H01R2N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize variables
const auth = firebase.auth();
const database = firebase.database();

// Google Sign-In Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Configure Google provider
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// DOM elements
let googleSignInBtn, signOutBtn, userInfo, googleSigninContainer;

// Initialize Google Sign-In
function initializeGoogleSignIn() {
    console.log('Initializing Google Sign-In...');
    
    googleSignInBtn = document.getElementById('googleSignInBtn');
    signOutBtn = document.getElementById('signOutBtn');
    userInfo = document.getElementById('userInfo');
    googleSigninContainer = document.getElementById('google-signin-container');

    console.log('Google Sign-In elements found:', {
        googleSignInBtn: !!googleSignInBtn,
        signOutBtn: !!signOutBtn,
        userInfo: !!userInfo,
        googleSigninContainer: !!googleSigninContainer
    });

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', signInWithGoogle);
        console.log('Google Sign-In button event listener attached');
    } else {
        console.error('Google Sign-In button not found!');
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
        if (user) {
            // User is signed in
            handleUserSignIn(user);
        } else {
            // User is signed out
            handleUserSignOut();
        }
    });
    
    console.log('Google Sign-In initialization complete');
}

// Sign in with Google
async function signInWithGoogle() {
    try {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        // Save user data to database
        await saveUserData(user);
        
        // Redirect to loggedin.html
        window.location.href = 'loggedin.html';
        
    } catch (error) {
        console.error('Error signing in with Google:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error signing in with Google. Please try again.';
        
        if (error.code) {
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage = 'Sign-in was cancelled. Please try again.';
                    break;
                case 'auth/popup-blocked':
                    errorMessage = 'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.';
                    break;
                case 'auth/cancelled-popup-request':
                    errorMessage = 'Sign-in was cancelled. Please try again.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your internet connection and try again.';
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage = 'This domain is not authorized for Google Sign-In. Please contact support.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Google Sign-In is not enabled. Please contact support.';
                    break;
                default:
                    errorMessage = `Sign-in error: ${error.message}`;
            }
        }
        
        alert(errorMessage);
        
        // Reset button
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = `
            <svg class="google-icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
        `;
    }
}

// Save user data to database
async function saveUserData(user) {
    const lastFiveChars = user.uid.slice(-5);
    
    // First, check if user already exists and has a custom name
    const existingUserRef = database.ref('users/' + user.uid);
    const existingSnapshot = await existingUserRef.once('value');
    const existingUserData = existingSnapshot.val();
    
    // If user exists and has a custom name, preserve it; otherwise use Google display name
    const displayName = existingUserData && existingUserData.name ? existingUserData.name : user.displayName;
    
    const userData = {
        email: user.email,
        full_name: displayName + " " + lastFiveChars,
        name: displayName,
        photoURL: user.photoURL,
        last_login: Date.now(),
        created_at: existingUserData ? existingUserData.created_at : Date.now(),
        provider: 'google'
    };

    try {
        await database.ref('users/' + user.uid).set(userData);
        console.log('User data saved successfully');
    } catch (error) {
        console.error('Error saving user data:', error);
        throw error;
    }
}

// Handle user sign in
function handleUserSignIn(user) {
    if (googleSigninContainer) {
        googleSigninContainer.innerHTML = `
            <div class="text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Welcome back!</h2>
                <p class="text-gray-600 mb-4">You're signed in as ${user.displayName}</p>
            </div>
            
            <div class="flex items-center space-x-3 mb-4">
                <img src="${user.photoURL}" alt="User Photo" class="w-10 h-10 rounded-full">
                <div>
                    <p class="font-semibold text-gray-800">${user.displayName}</p>
                    <p class="text-sm text-gray-600">${user.email}</p>
                </div>
            </div>
            
            <button id="signOutBtn" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition duration-300">
                Sign Out
            </button>
        `;
        
        // Re-attach event listener for sign out
        const newSignOutBtn = document.getElementById('signOutBtn');
        if (newSignOutBtn) {
            newSignOutBtn.addEventListener('click', signOut);
        }
    }
}

// Handle user sign out
function handleUserSignOut() {
    if (googleSigninContainer) {
        googleSigninContainer.innerHTML = `
            <div class="text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Welcome to Lift Ascend</h2>
                <p class="text-gray-600 mb-4">Sign in with your Google account to get started</p>
            </div>
            
            <button id="googleSignInBtn" class="google-signin-button">
                <svg class="google-icon" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
            </button>
        `;
        
        // Re-attach event listener for sign in
        const newGoogleSignInBtn = document.getElementById('googleSignInBtn');
        if (newGoogleSignInBtn) {
            newGoogleSignInBtn.addEventListener('click', signInWithGoogle);
        }
    }
}

// Sign out function
function signOut() {
    auth.signOut()
        .then(() => {
            console.log("User signed out successfully");
            window.location.href = "index.html";
        })
        .catch((error) => {
            console.error("Error signing out:", error);
            alert("An error occurred while signing out. Please try again.");
        });
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



// Helper function to normalize gender string
function normalizeGender(gender) {
    gender = gender.toLowerCase().trim();
    return gender === 'male' || gender === 'm' ? 'male' : 
           gender === 'female' || gender === 'f' ? 'female' : gender;
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
    

    alert(
        "You are:\n" +
        `- ${userPercentiles.squat}% stronger than others in your category for squat.\n` +
        `- ${userPercentiles.bench}% stronger than others in your category for bench press.\n` +
        `- ${userPercentiles.deadlift}% stronger than others in your category for deadlift.`
      );
      
}





// Function to add a new row to the lift data table
function addRow() {
    const tbody = document.getElementById('liftDataBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="number" class="age w-full p-2 border rounded" placeholder="Age"></td>
                    <td><input type="number" class="weight w-full p-2 border rounded" placeholder="Weight"></td>
                                            <td>
                            <select class="gender w-full p-2 border rounded">
                                <option value="" disabled selected>Gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </td>
                    <td><input type="number" class="squat w-full p-2 border rounded" placeholder="Squat"></td>
                    <td><input type="number" class="bench w-full p-2 border rounded" placeholder="Bench"></td>
                    <td><input type="number" class="deadlift w-full p-2 border rounded" placeholder="Deadlift"></td>
                    <td><button onclick="removeRow(this)" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition duration-300">Remove</button></td>
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


// DOTS Calculation Function
function calculateDOTS(weight, totalLift, isMale, unit) {
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

    let totalKg = unit === 'lbs' ? totalLift * 0.453592 : totalLift;
    let score = (500 / denominator) * totalKg;
    return score.toFixed(2);
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
    document.getElementById('user-bench').textContent = data.bench ? data.bench + ' lbs' : 'N/A';
    document.getElementById('user-squat').textContent = data.squat ? data.squat + ' lbs' : 'N/A';
    document.getElementById('user-deadlift').textContent = data.deadlift ? data.deadlift + ' lbs' : 'N/A';
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

currentWeightUnit = 'lbs'; // Default unit is pounds

// Event listener for clicking outside dropdown
document.addEventListener('click', function(event) {
    const content = document.querySelector('.weight-unit-content');
    const button = document.querySelector('.weight-unit-btn');
    
    if (!button.contains(event.target) && !content.contains(event.target)) {
        content.style.display = 'none';
    }
});

function toggleWeightUnit() {
    const content = document.querySelector('.weight-unit-content');
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
}

// Helper functions for conversions
function lbsToKg(lbs) {
    return lbs / 2.2046226218487757;
}

function kgToLbs(kg) {
    return kg *2.2046226218487757;
}

function selectWeightUnit(unit) {
    const weightHeader = document.getElementById('weightHeader');
    const squatHeader = document.getElementById('squatHeader');
    const benchHeader = document.getElementById('benchHeader');
    const deadliftHeader = document.getElementById('deadliftHeader');

    const button = document.getElementById('weightUnitButton');
   
    
    const content = document.querySelector('.weight-unit-content');
    content.style.display = 'none';

    if (unit === 'kgs' && currentWeightUnit !== 'kgs') {
        if ((document.getElementById('total').textContent).trim() === "N/A") {
            document.getElementById('total').textContent = '0 ' + unit
            document.getElementById('bodyweight').textContent = '0 '+ unit
        }
        weightHeader.textContent = 'Weight (kgs)';
        squatHeader.textContent = 'Squat (kgs)';
        benchHeader.textContent = 'Bench (kgs)';
        deadliftHeader.textContent = 'Deadlift (kgs)';
        button.textContent = `${unit} ▼`;
        currentWeightUnit = 'kgs';

        document.getElementById('total').textContent = lbsToKg(parseFloat(document.getElementById('total').textContent)).toFixed(1) + " " + currentWeightUnit;
    
        document.getElementById('bodyweight').textContent = lbsToKg(parseFloat(document.getElementById('bodyweight').textContent)).toFixed(1) + " " + currentWeightUnit;
    
        // Calculate and display the DOTS score
        const dotsScore = calculateDOTS(bodyweight, totalLiftSum, gender === 'male', currentWeightUnit);
     

    } else if (unit === 'lbs' && currentWeightUnit !== 'lbs') {
        if ((document.getElementById('age').textContent).trim() === "N/A") {
            document.getElementById('total').textContent = '0 ' + unit
            document.getElementById('bodyweight').textContent = '0 '+ unit
        }
        weightHeader.textContent = 'Weight (lbs)';
        squatHeader.textContent = 'Squat (lbs)';
        benchHeader.textContent = 'Bench (lbs)';
        deadliftHeader.textContent = 'Deadlift (lbs)';
      
        currentWeightUnit = 'lbs';
        document.getElementById('total').textContent = kgToLbs(parseFloat(document.getElementById('total').textContent)).toFixed(1) + " " + currentWeightUnit;
      
        document.getElementById('bodyweight').textContent = kgToLbs(parseFloat(document.getElementById('bodyweight').textContent)).toFixed(1) + " " + currentWeightUnit;
    }
}

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


// Remove the old auth state change listener - Google Sign-In handles this now
// firebase.auth().onAuthStateChanged((user) => {
//     if (user) {
//       // User is signed in, delay redirection by 500 milliseconds
//       setTimeout(() => {
//         window.location.href = 'loggedin.html';
//       }, 1000);
//     } 
//   });
  

async function calculateUserPercentile(squat, bench, deadlift, userCategory) {
    const percentilesData = await loadPercentileData('percentile.json');
    
    const weightClassNum = userCategory.weightClass.replace('kg', '');
    let formattedWeightClass = weightClassNum.endsWith('.5') ? weightClassNum : weightClassNum + ".0";
    
   

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
    const weightClassData = percentilesData[userCategory.gender]?.[formattedWeightClass]?.[mappedAgeGroup];
    
    console.log("Weight Class Data:", weightClassData);
    console.log("Current Weight Unit:", currentWeightUnit);
    console.log("Original values - Squat:", squat, "Bench:", bench, "Deadlift:", deadlift);

    if (!weightClassData) {
        console.error("No data found for the given user category:", {
            original: userCategory,
            mapped: {
                gender: userCategory.gender,
                weightClass: formattedWeightClass,
                ageGroup: mappedAgeGroup
            }
        });
        return { squat: 0, bench: 0, deadlift: 0 };
    }

    // Convert input values to kg if they're in lbs
    const squatKg = currentWeightUnit === 'lbs' ? lbsToKg(squat) : squat;
    const benchKg = currentWeightUnit === 'lbs' ? lbsToKg(bench) : bench;
    const deadliftKg = currentWeightUnit === 'lbs' ? lbsToKg(deadlift) : deadlift;

    console.log("Converted values (kg) - Squat:", squatKg, "Bench:", benchKg, "Deadlift:", deadliftKg);

    function findPercentileFromBrackets(value, brackets) {
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

    const results = {
        squat: Number(findPercentileFromBrackets(squatKg, weightClassData.Best3SquatKg).toFixed(2)),
        bench: Number(findPercentileFromBrackets(benchKg, weightClassData.Best3BenchKg).toFixed(2)),
        deadlift: Number(findPercentileFromBrackets(deadliftKg, weightClassData.Best3DeadliftKg).toFixed(2))
    };

    console.log("Calculated percentiles:", results);
    return results;
}

// Helper function to format percentile for display
function formatPercentile(percentile) {
    return Number(percentile).toFixed(2);
}

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
function keepRank(userRank) {
    return userRank;
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

function showLogin() {
    document.getElementById('form_header').textContent = 'Login';
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('reset-password-form').classList.add('hidden');
}

function showRegister() {
    document.getElementById('form_header').textContent = 'Register';
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('reset-password-form').classList.add('hidden');
}

function showResetPassword() {
    document.getElementById('form_header').textContent = 'Reset Password';
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('reset-password-form').classList.remove('hidden');
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
    suggestionsContainer.classList.add('z-20'); // Ensure overlap
    results.forEach((name) => {
        const listItem = document.createElement('li');
        listItem.textContent = name;
        listItem.classList.add('p-2', 'cursor-pointer', 'hover:bg-gray-200');
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
            console.log(userData.full_name)
            console.log(query)
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

// Initialize Google Sign-In when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeGoogleSignIn();
});