/*
 * Lift Ascend - shared code used by every page.
 *
 * Firebase setup, unit conversion, DOTS, weight classes, percentile lookup,
 * rank tiers, lifter search, the lift entry table and small UI helpers.
 * Page scripts (index.js, loggedin.js, profile.js) build on these.
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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const database = firebase.database();

/* ---------- Units ---------- */

const KG_PER_LB = 0.45359237;

function lbsToKg(lbs) {
    return lbs * KG_PER_LB;
}

function kgToLbs(kg) {
    return kg / KG_PER_LB;
}

/** Convert a weight between the stored unit names 'lbs' and 'kgs'. */
function convertWeight(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    return toUnit === 'kgs' ? lbsToKg(value) : kgToLbs(value);
}

function unitLabel(unit) {
    return unit === 'kgs' ? 'kg' : 'lb';
}

/** "405 lb", "183.7 kg". Whole numbers are shown without a decimal. */
function formatWeight(value, unit) {
    if (!isFinite(value)) return '-';
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} ${unitLabel(unit)}`;
}

/* ---------- Categories ---------- */

const MALE_CLASSES = [52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140];
const FEMALE_CLASSES = [44, 48, 52, 56, 60, 67.5, 75, 82.5, 90];

function normalizeGender(gender) {
    const g = String(gender || '').toLowerCase().trim();
    if (g === 'male' || g === 'm') return 'male';
    if (g === 'female' || g === 'f') return 'female';
    return 'unknown';
}

/**
 * Weight class for a bodyweight, e.g. "82.5kg". Lifters above the heaviest
 * class are compared against the heaviest class, which is the largest one
 * the percentile data covers.
 */
function getWeightClass(weight, gender, unit) {
    const g = normalizeGender(gender);
    if (g === 'unknown') return null;
    const kg = unit === 'kgs' ? weight : lbsToKg(weight);
    const classes = g === 'male' ? MALE_CLASSES : FEMALE_CLASSES;
    const match = classes.find((limit) => kg <= limit);
    return `${match || classes[classes.length - 1]}kg`;
}

function getWeightClassMale(weight, unit) {
    return getWeightClass(weight, 'male', unit);
}

function getWeightClassFemale(weight, unit) {
    return getWeightClass(weight, 'female', unit);
}

function getAgeGroup(age) {
    if (age < 14) return 'Youth';
    if (age <= 15) return 'Teen1';
    if (age <= 17) return 'Teen2';
    if (age <= 19) return 'Teen3';
    if (age >= 50) return 'Master II';
    if (age >= 40) return 'Master I';
    if (age >= 35) return 'Sub-Master';
    return 'Open';
}

/* ---------- DOTS ---------- */

function calculateDOTS(bodyweight, total, isMale, unit) {
    const maleCoeff = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
    const femaleCoeff = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
    const coeff = isMale ? maleCoeff : femaleCoeff;

    let bw = unit === 'lbs' ? lbsToKg(bodyweight) : bodyweight;
    bw = Math.min(Math.max(bw, 40), isMale ? 210 : 150);

    let denominator = coeff[0];
    for (let i = 1; i < coeff.length; i++) {
        denominator += coeff[i] * Math.pow(bw, i);
    }

    const totalKg = unit === 'lbs' ? lbsToKg(total) : total;
    return ((500 / denominator) * totalKg).toFixed(2);
}

function calculateLifterDOTS(weight, squat, bench, deadlift, isMale, unit) {
    return calculateDOTS(weight, squat + bench + deadlift, isMale, unit);
}

/* ---------- Percentiles and ranks ---------- */

let percentileDataPromise = null;

function loadPercentileData() {
    if (!percentileDataPromise) {
        percentileDataPromise = fetch('percentile.json').then((response) => {
            if (!response.ok) throw new Error('Could not load percentile data');
            return response.json();
        });
        percentileDataPromise.catch(() => { percentileDataPromise = null; });
    }
    return percentileDataPromise;
}

function findPercentileFromBrackets(value, brackets) {
    const percentiles = Object.keys(brackets).map(Number).sort((a, b) => a - b);
    const values = percentiles.map((p) => brackets[p]);
    const last = values.length - 1;

    if (value < values[0]) {
        return Math.max(0, value * (percentiles[0] / values[0]));
    }

    if (value >= values[last]) {
        const remaining = 100 - percentiles[last];
        const scale = remaining / (values[last] * 0.1);
        return Math.min(100, percentiles[last] + (value - values[last]) * scale);
    }

    for (let i = 0; i < last; i++) {
        if (value >= values[i] && value < values[i + 1]) {
            const t = (value - values[i]) / (values[i + 1] - values[i]);
            const eased = t * t * (3 - 2 * t);
            return percentiles[i] + eased * (percentiles[i + 1] - percentiles[i]);
        }
    }
    return 100;
}

/**
 * Percentile of each lift within the lifter's gender, weight class and age
 * group. `category` is { gender, weightClass, ageGroup }; lifts are in `unit`.
 */
async function calculateUserPercentile(squat, bench, deadlift, category, unit) {
    const data = await loadPercentileData();

    const classNumber = String(category.weightClass || '').replace('+', '').replace('kg', '');
    const classKey = classNumber.includes('.') ? classNumber : `${classNumber}.0`;
    const ageKey = category.ageGroup === 'Youth' || !category.ageGroup ? 'Open' : category.ageGroup;

    const genderData = data[normalizeGender(category.gender)] || {};
    // Older saved entries can carry a class heavier than the data covers.
    const fallbackKey = Object.keys(genderData).sort((a, b) => Number(b) - Number(a))[0];
    const classData = genderData[classKey] || genderData[fallbackKey] || {};
    const brackets = classData[ageKey] || classData.Open;

    if (!brackets) {
        return { squat: 0, bench: 0, deadlift: 0 };
    }

    const toKg = (value) => (unit === 'lbs' ? lbsToKg(value) : value);
    const lookup = (value, key) => Number(findPercentileFromBrackets(toKg(value), brackets[key]).toFixed(2));

    return {
        squat: lookup(squat, 'Best3SquatKg'),
        bench: lookup(bench, 'Best3BenchKg'),
        deadlift: lookup(deadlift, 'Best3DeadliftKg')
    };
}

function getRankFromPercentile(percentile) {
    if (percentile >= 80) return 'Diamond';
    if (percentile >= 65) return 'Gold';
    if (percentile >= 45) return 'Silver';
    return 'Bronze';
}

const updateRank = getRankFromPercentile;

const KNOWN_RANKS = ['Diamond', 'Gold', 'Silver', 'Bronze', 'Unranked'];

function rankImagePath(rank) {
    return `./Images/${KNOWN_RANKS.includes(rank) ? rank : 'Unranked'}.png`;
}

function setRankImage(img, rank) {
    if (!img) return;
    const safe = KNOWN_RANKS.includes(rank) ? rank : 'Unranked';
    img.src = rankImagePath(safe);
    img.alt = `${safe} rank`;
}

/**
 * Work out everything shown for one lift entry.
 * `entry` is { age, weight, gender, squat, bench, deadlift, unit }.
 */
async function analyseEntry(entry) {
    const gender = normalizeGender(entry.gender);
    const unit = entry.unit === 'kgs' ? 'kgs' : 'lbs';
    const squat = Number(entry.squat) || 0;
    const bench = Number(entry.bench) || 0;
    const deadlift = Number(entry.deadlift) || 0;
    const weight = Number(entry.weight) || 0;

    const weightClass = getWeightClass(weight, gender, unit);
    const ageGroup = getAgeGroup(Number(entry.age));
    const percentiles = await calculateUserPercentile(
        squat, bench, deadlift, { gender, weightClass, ageGroup }, unit
    );
    const average = (percentiles.squat + percentiles.bench + percentiles.deadlift) / 3;

    return {
        gender, unit, squat, bench, deadlift, weight,
        age: Number(entry.age),
        total: squat + bench + deadlift,
        weightClass, ageGroup, percentiles,
        rank: getRankFromPercentile(average),
        dots: calculateDOTS(weight, squat + bench + deadlift, gender === 'male', unit)
    };
}

/* ---------- Small UI helpers ---------- */

function $(id) {
    return document.getElementById(id);
}

function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

let noticeTimer = null;

/** Brief message at the bottom of the screen. kind: 'info' | 'success' | 'error'. */
function showNotice(message, kind = 'info') {
    let el = $('notice');
    if (!el) {
        el = document.createElement('div');
        el.id = 'notice';
        el.className = 'notice';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.dataset.kind = kind;
    el.classList.add('is-visible');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.remove('is-visible'), kind === 'error' ? 6000 : 3500);
}

/** Fill the percentile rows. `prefix` is '' on your own pages, 'user-' on a profile. */
function renderPercentiles(percentiles, prefix = '') {
    ['squat', 'bench', 'deadlift'].forEach((lift) => {
        const value = Math.min(Math.max(Number(percentiles[lift]) || 0, 0), 100);
        const rank = getRankFromPercentile(value);
        setText(`${prefix}${lift}-percentile`, `${Math.round(value)}%`);
        const bar = $(`${prefix}${lift}-progress`);
        if (bar) {
            bar.style.width = `${value}%`;
            bar.dataset.rank = rank.toLowerCase();
        }
        setRankImage($(`${prefix}${lift}-rank`), rank);
    });
}

function clearPercentiles(prefix = '') {
    ['squat', 'bench', 'deadlift'].forEach((lift) => {
        setText(`${prefix}${lift}-percentile`, '-');
        const bar = $(`${prefix}${lift}-progress`);
        if (bar) {
            bar.style.width = '0%';
            delete bar.dataset.rank;
        }
        setRankImage($(`${prefix}${lift}-rank`), 'Unranked');
    });
}

/* ---------- Weight unit toggle ---------- */

let currentWeightUnit = 'lbs';

function getCurrentWeightUnit() {
    return currentWeightUnit;
}

/**
 * Wire up the lb / kg switch. `onChange(unit)` runs after the unit changes so
 * the page can redraw its numbers.
 */
function initUnitToggle(onChange) {
    const buttons = document.querySelectorAll('[data-unit]');
    buttons.forEach((button) => {
        button.addEventListener('click', () => setWeightUnit(button.dataset.unit, onChange));
    });
    syncUnitToggle();
}

function setWeightUnit(unit, onChange) {
    if (unit !== 'lbs' && unit !== 'kgs') return;
    const changed = unit !== currentWeightUnit;
    currentWeightUnit = unit;
    syncUnitToggle();
    if (changed && typeof onChange === 'function') onChange(unit);
}

function syncUnitToggle() {
    document.querySelectorAll('[data-unit]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.unit === currentWeightUnit));
    });
    document.querySelectorAll('[data-unit-label]').forEach((el) => {
        el.textContent = unitLabel(currentWeightUnit);
    });
}

/* ---------- Lift entry table ---------- */

const LIFT_FIELDS = [
    { key: 'age', label: 'Age', weight: false },
    { key: 'weight', label: 'Bodyweight', weight: true },
    { key: 'gender', label: 'Gender', weight: false },
    { key: 'squat', label: 'Squat', weight: true },
    { key: 'bench', label: 'Bench', weight: true },
    { key: 'deadlift', label: 'Deadlift', weight: true }
];

function buildLiftRow() {
    const row = document.createElement('tr');

    LIFT_FIELDS.forEach((field) => {
        const cell = document.createElement('td');
        cell.dataset.label = field.label;
        let control;

        if (field.key === 'gender') {
            control = document.createElement('select');
            [['', 'Select'], ['male', 'Male'], ['female', 'Female']].forEach(([value, text]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = text;
                if (!value) {
                    option.disabled = true;
                    option.selected = true;
                }
                control.appendChild(option);
            });
        } else {
            control = document.createElement('input');
            control.type = 'number';
            control.min = '0';
            control.step = 'any';
            control.inputMode = 'decimal';
            control.placeholder = field.key === 'age' ? 'Years' : '0';
        }

        control.className = `${field.key} field`;
        control.setAttribute('aria-label', field.label);
        cell.appendChild(control);
        row.appendChild(cell);
    });

    const actionCell = document.createElement('td');
    actionCell.className = 'row-action';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-quiet';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeRow(remove));
    actionCell.appendChild(remove);
    row.appendChild(actionCell);

    return row;
}

function addRow() {
    $('liftDataBody').appendChild(buildLiftRow());
}

function removeRow(button) {
    const body = $('liftDataBody');
    button.closest('tr').remove();
    if (!body.children.length) addRow();
}

function clearLiftDataTable() {
    $('liftDataBody').innerHTML = '';
    addRow();
}

/**
 * Read every row of the lift table. Returns { entries } on success or
 * { error } describing the first problem found.
 */
function readLiftRows() {
    const rows = Array.from(document.querySelectorAll('#liftDataBody tr'));
    const entries = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const read = (name) => row.querySelector(`.${name}`).value.trim();
        const raw = {
            age: read('age'), weight: read('weight'), gender: read('gender'),
            squat: read('squat'), bench: read('bench'), deadlift: read('deadlift')
        };
        const label = rows.length > 1 ? ` in row ${i + 1}` : '';

        if (Object.values(raw).some((value) => value === '')) {
            return { error: `Fill in every field${label}.` };
        }

        const entry = {
            age: parseInt(raw.age, 10),
            weight: parseFloat(raw.weight),
            gender: normalizeGender(raw.gender),
            squat: parseFloat(raw.squat),
            bench: parseFloat(raw.bench),
            deadlift: parseFloat(raw.deadlift),
            unit: currentWeightUnit
        };

        const numbers = [entry.age, entry.weight, entry.squat, entry.bench, entry.deadlift];
        if (numbers.some((n) => !isFinite(n) || n <= 0)) {
            return { error: `Enter numbers above zero${label}.` };
        }
        if (entry.gender === 'unknown') {
            return { error: `Choose a gender${label}.` };
        }
        entries.push(entry);
    }

    return { entries };
}

/* ---------- Lifter search ---------- */

let userDirectoryPromise = null;

/** Every user record, keyed by uid. Cached for the life of the page. */
function loadAllUsers(forceRefresh = false) {
    if (!userDirectoryPromise || forceRefresh) {
        userDirectoryPromise = database.ref('users').once('value').then((snapshot) => snapshot.val() || {});
        userDirectoryPromise.catch(() => { userDirectoryPromise = null; });
    }
    return userDirectoryPromise;
}

/** The public 5-character ID shown on profiles: the end of the account uid. */
function publicId(uid) {
    return String(uid).slice(-5);
}

function displayNameOf(user) {
    return (user && (user.name || user.username || user.displayName)) || 'Lifter';
}

function findUserByPublicId(users, id) {
    const uid = Object.keys(users).find((key) => publicId(key) === id);
    return uid ? { uid, user: users[uid] } : null;
}

async function searchUsers(query) {
    const users = await loadAllUsers();
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    return Object.keys(users)
        .map((uid) => ({ id: publicId(uid), name: displayNameOf(users[uid]), username: users[uid].username || '' }))
        .filter((u) => `${u.name} ${u.id} ${u.username}`.toLowerCase().includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8);
}

function goToProfile(id) {
    window.location.href = `profile.html?userId=${encodeURIComponent(id)}`;
}

function initSearch() {
    const input = $('searchInput');
    const container = $('suggestionsContainer');
    const list = $('suggestionsList');
    const form = $('searchForm');
    if (!input || !container || !list) return;

    let latest = 0;
    let results = [];

    const close = () => {
        container.hidden = true;
        input.setAttribute('aria-expanded', 'false');
    };

    const render = () => {
        list.innerHTML = '';
        results.forEach((result) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            const name = document.createElement('span');
            name.textContent = result.name;
            const id = document.createElement('span');
            id.className = 'suggestion-id';
            id.textContent = `ID ${result.id}`;
            button.append(name, id);
            button.addEventListener('click', () => goToProfile(result.id));
            item.appendChild(button);
            list.appendChild(item);
        });
        container.hidden = results.length === 0;
        input.setAttribute('aria-expanded', String(results.length > 0));
    };

    input.addEventListener('input', async () => {
        const ticket = ++latest;
        const query = input.value;
        if (!query.trim()) {
            results = [];
            close();
            return;
        }
        try {
            const found = await searchUsers(query);
            if (ticket !== latest) return;
            results = found;
            render();
        } catch (error) {
            console.error('Search failed:', error);
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const query = input.value.trim();
        if (!query) {
            showNotice('Type a name to search.', 'info');
            return;
        }
        try {
            const found = await searchUsers(query);
            if (found.length) {
                goToProfile(found[0].id);
            } else {
                showNotice(`No lifter found for "${query}".`, 'error');
            }
        } catch (error) {
            console.error('Search failed:', error);
            showNotice('Search is unavailable right now. Try again in a moment.', 'error');
        }
    });

    document.addEventListener('click', (event) => {
        if (!form.contains(event.target)) close();
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
    });
}

/* ---------- Instagram links ---------- */

function isInstagramLink(url) {
    return /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/.test(String(url || ''));
}

/* ---------- Usernames ---------- */

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const USERNAME_DOMAIN = 'users.liftascend.com';

function usernameKey(username) {
    return String(username || '').trim().toLowerCase();
}

function describeUsernameProblem(username) {
    const key = usernameKey(username);
    if (key.length < 3 || key.length > 20) return 'Usernames are 3 to 20 characters long.';
    if (!USERNAME_PATTERN.test(key)) return 'Use only letters, numbers and underscores in a username.';
    return null;
}

/**
 * Firebase Auth needs an email-shaped identifier. Accounts use an internal
 * one built from the username, so no real email address is ever collected.
 */
function usernameToAuthId(username) {
    return `${usernameKey(username)}@${USERNAME_DOMAIN}`;
}

/* ---------- Results panel ---------- */

/** Draw an analysed entry (see analyseEntry) in the current display unit. */
function renderScoreboard(result) {
    const show = (value) => formatWeight(convertWeight(value, result.unit, currentWeightUnit), currentWeightUnit);

    renderPercentiles(result.percentiles);
    setRankImage($('rankImage'), result.rank);
    setText('rankName', result.rank);

    setText('user-squat', show(result.squat));
    setText('user-bench', show(result.bench));
    setText('user-deadlift', show(result.deadlift));
    setText('total', show(result.total));
    setText('bodyweight', show(result.weight));
    setText('dots', result.dots);
    setText('age', isFinite(result.age) ? String(result.age) : '-');
    setText('user-gender', result.gender === 'unknown' ? '-' : result.gender[0].toUpperCase() + result.gender.slice(1));
}

function clearScoreboard() {
    clearPercentiles();
    setRankImage($('rankImage'), 'Unranked');
    setText('rankName', 'Unranked');
    ['user-squat', 'user-bench', 'user-deadlift'].forEach((id) => setText(id, ''));
    ['total', 'bodyweight', 'dots', 'age', 'user-gender'].forEach((id) => setText(id, '-'));
}

/** Most recent entry in a user's liftData object, or null. */
function latestLift(liftData) {
    if (!liftData) return null;
    const entries = Array.isArray(liftData) ? liftData.filter(Boolean) : Object.values(liftData);
    return entries.reduce((latest, entry) => {
        if (!latest) return entry;
        return (entry.timestamp || 0) >= (latest.timestamp || 0) ? entry : latest;
    }, null);
}

/* ---------- Dataset date ---------- */

/** Show when the percentile data was last rebuilt (see Python/update_dataset.py). */
async function showDatasetDate() {
    const el = $('datasetDate');
    if (!el) return;
    try {
        const info = await fetch('dataset.json').then((response) => response.json());
        const parts = String(info.dataDate || '').split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return;
        const text = new Date(parts[0], parts[1] - 1, parts[2])
            .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        el.textContent = ` Dataset last updated ${text}.`;
    } catch (error) {
        console.warn('Could not load the dataset date:', error);
    }
}

document.addEventListener('DOMContentLoaded', showDatasetDate);
