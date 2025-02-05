/**
 * Utility Functions for Lift Ascend
 * 
 * This file contains shared functions used across different scripts, 
 * including percentile calculations, DOTS score calculations, and more.
 */

/**
 * Convert pounds to kilograms.
 * @param {number} lbs 
 * @returns {number}
 */
function lbsToKg(lbs) {
    return lbs * 0.453592;
}

/**
 * Convert kilograms to pounds.
 * @param {number} kg 
 * @returns {number}
 */
function kgToLbs(kg) {
    return kg * 2.20462;
}

/**
 * Calculate DOTS score.
 * @param {number} weight 
 * @param {number} squat 
 * @param {number} bench 
 * @param {number} deadlift 
 * @param {boolean} isMale 
 * @param {string} unit - 'lbs' or 'kgs'
 * @returns {number}
 */
function calculateLifterDOTS(weight, squat, bench, deadlift, isMale, unit) {
    const maleCoeff = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
    const femaleCoeff = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
    
    let bw = unit === 'lbs' ? lbsToKg(weight) : weight;
    let maxbw = isMale ? 210 : 150;
    bw = Math.min(Math.max(bw, 40), maxbw);
    
    let coeff = isMale ? maleCoeff : femaleCoeff;
    let denominator = coeff[0];
    for (let i = 1; i < coeff.length; i++) {
        denominator += coeff[i] * Math.pow(bw, i);
    }
    
    let total = unit === 'lbs' ? (squat + bench + deadlift) * 0.453592 : squat + bench + deadlift;
    let score = (500 / denominator) * total;
    return parseFloat(score.toFixed(2));
}

/**
 * Calculate the user's percentile based on lift data with interpolation.
 * @param {number} lift 
 * @param {object} liftData 
 * @returns {number}
 */
function getPercentile(lift, liftData) {
    const percentiles = Object.keys(liftData).map(Number).sort((a, b) => a - b);
    
    if (lift >= liftData[percentiles[percentiles.length - 1]]) {
        return 100;
    }

    let lowerWeight = null;
    let upperWeight = null;

    for (const percentile of percentiles) {
        if (lift > liftData[percentile]) {
            lowerWeight = percentile;
        } else if (lift <= liftData[percentile] && upperWeight === null) {
            upperWeight = percentile;
            break;
        }
    }

    if (lowerWeight === null) {
        return percentiles[0];
    }

    const lowerValue = liftData[lowerWeight];
    const upperValue = liftData[upperWeight];

    const percentileScore = lowerWeight + ((lift - lowerValue) * (upperWeight - lowerWeight)) / (upperValue - lowerWeight);
    return Math.round(percentileScore);
}

/**
 * Update rank based on average percentile.
 * @param {number} percentile 
 * @returns {string}
 */
function updateRank(percentile) {
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

/**
 * Format percentile for display.
 * @param {number} percentile 
 * @returns {string}
 */
function formatPercentile(percentile) {
    return `${Number(percentile).toFixed(2)}%`;
}

/**
 * Normalize gender input.
 * @param {string} gender 
 * @returns {string}
 */
function normalizeGender(gender) {
    gender = gender.toLowerCase().trim();
    if (gender === 'male' || gender === 'm') return 'male';
    if (gender === 'female' || gender === 'f') return 'female';
    return 'unknown';
}

/**
 * Get the appropriate weight class based on gender and weight.
 * @param {number} weight - The user's bodyweight.
 * @param {string} gender - The user's gender ('male' or 'female').
 * @param {string} unit - The unit of weight ('lbs' or 'kgs').
 * @returns {string} - The weight class.
 */
function getWeightClass(weight, gender, unit) {
    // Normalize gender input
    const normalizedGender = gender.toLowerCase();

    if (normalizedGender === 'male') {
        return getWeightClassMale(weight, unit);
    } else if (normalizedGender === 'female') {
        return getWeightClassFemale(weight, unit);
    } else {
        console.error(`Unknown gender: ${gender}`);
        return null; // or handle the error as needed
    }
}

/**
 * Get the weight class for male lifters.
 * @param {number} weight - The user's bodyweight.
 * @param {string} unit - The unit of weight ('lbs' or 'kgs').
 * @returns {string} - The male weight class.
 */
function getWeightClassMale(weight, unit) {
    if (unit === 'kgs') {
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
        // Convert lbs to kg
        let weightKg = lbsToKg(weight);
        return getWeightClassMale(weightKg, 'kgs');
    }

    return '140+kg';
}

/**
 * Get the weight class for female lifters.
 * @param {number} weight - The user's bodyweight.
 * @param {string} unit - The unit of weight ('lbs' or 'kgs').
 * @returns {string} - The female weight class.
 */
function getWeightClassFemale(weight, unit) {
    if (unit === 'kgs') {
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
        // Convert lbs to kg
        let weightKg = lbsToKg(weight);
        return getWeightClassFemale(weightKg, 'kgs');
    }

    return '100+kg';
}

/**
 * Set default values in the profile display when data is missing.
 */
function setDefaultValues() {
    document.getElementById('user-full-name').textContent = 'N/A';
    document.getElementById('user-id').textContent = 'N/A';
    document.getElementById('age').textContent = 'N/A';
    document.getElementById('bodyweight').textContent = 'N/A';
    document.getElementById('user-gender').textContent = 'N/A';
    document.getElementById('user-squat').textContent = 'N/A';
    document.getElementById('user-bench').textContent = 'N/A';
    document.getElementById('user-deadlift').textContent = 'N/A';
    document.getElementById('total').textContent = 'N/A';
    document.getElementById('dots').textContent = 'N/A';
    document.getElementById('user-squat-percentile').textContent = 'N/A';
    document.getElementById('user-bench-percentile').textContent = 'N/A';
    document.getElementById('user-deadlift-percentile').textContent = 'N/A';
    displayRank('Unranked');
    
    // Update Instagram display to default
    updateInstagramDisplay(null);
}

/**
 * Update the Instagram display based on the fetched link.
 * @param {string|null} instagramLink 
 */
function updateInstagramDisplay(instagramLink) {
    const instagramStatus = document.getElementById('instagramStatus');
    const userInstagramLink = document.getElementById('userInstagramLink');
    
    if (instagramLink) {
        userInstagramLink.href = instagramLink;
        instagramStatus.textContent = 'Connected';
    } else {
        userInstagramLink.href = '#';
        instagramStatus.textContent = 'Not Set';
    }
}

async function fetchLiftData(uid, name) {
    try {
        // ... existing code ...

        // Normalize gender input to lowercase
        const normalizedGender = lastEntry.gender ? lastEntry.gender.toLowerCase() : 'unknown';

        // Set up user category for percentile calculation
        const userCategory = {
            gender: normalizedGender,
            weightClass: getWeightClass(originalWeightValue, normalizedGender, currentWeightUnit),
            ageGroup: getAgeGroup(lastEntry.age)
        };

        // ... existing code ...
    } catch (error) {
        console.error("Error fetching data:", error);
        setDefaultValues();
    }
}

function updateProfileDisplay(data) {
    if (!data) return;
    
    // Update full name if available
    document.getElementById("user-full-name").textContent = data.full_name || "N/A";
    document.getElementById("user-squat").textContent = data.squat || "N/A";
    document.getElementById("user-bench").textContent = data.bench || "N/A";
    document.getElementById("user-deadlift").textContent = data.deadlift || "N/A";
    document.getElementById("bodyweight").textContent = data.weight ? `${data.weight} ${data.unit || 'lbs'}` : "N/A";
    document.getElementById("age").textContent = data.age || "N/A";
    document.getElementById("user-gender").textContent = data.gender || "N/A";
} 