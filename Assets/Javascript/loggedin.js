/*
 * Lift Ascend - signed-in dashboard.
 *
 * Shows the lifter's latest numbers and rank, saves new lift entries, and
 * manages the display name, Instagram link, friends and friends leaderboard.
 */

let currentUser = null;
let latestResult = null;
let currentCriteria = 'By Total';

auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    loadUserData();
    loadFriends();
    offerUsernameIfNeeded(user);
});

/* ---------- Profile and latest lifts ---------- */

async function loadUserData() {
    const uid = currentUser.uid;
    setText('user-id', publicId(uid));

    try {
        const record = (await database.ref(`users/${uid}`).once('value')).val() || {};
        setText('user-full-name', displayNameOf(record));
        if (record.username) {
            setText('user-username', record.username);
            $('usernameMeta').hidden = false;
        }
        renderInstagram(record.instagram);
    } catch (error) {
        console.error('Could not load profile:', error);
        showNotice('Could not load your profile. Refresh to try again.', 'error');
    }

    try {
        const snapshot = await database.ref(`users/${uid}/liftData`).limitToLast(1).once('value');
        const entry = latestLift(snapshot.val());
        if (!entry) {
            latestResult = null;
            clearScoreboard();
            return;
        }
        // Show numbers in the unit the lifter last saved in.
        setWeightUnit(entry.unit === 'kgs' ? 'kgs' : 'lbs');
        latestResult = await analyseEntry(entry);
        renderScoreboard(latestResult);
        setText('scoreboardNote', 'Each percentage is the share of lifters in your category that you out-lift.');
    } catch (error) {
        console.error('Could not load lift data:', error);
        showNotice('Could not load your lifts. Refresh to try again.', 'error');
    }
}

async function submitLiftData() {
    if (!currentUser) {
        showNotice('Log in to save your lifts.', 'error');
        return;
    }

    const { entries, error } = readLiftRows();
    if (error) {
        showNotice(error, 'error');
        return;
    }

    const button = $('submitLiftButton');
    button.disabled = true;

    try {
        const liftsRef = database.ref(`users/${currentUser.uid}/liftData`);
        for (const entry of entries) {
            const result = await analyseEntry(entry);
            await liftsRef.push({
                age: result.age,
                weight: result.weight,
                gender: result.gender,
                squat: result.squat,
                bench: result.bench,
                deadlift: result.deadlift,
                total: result.total,
                timestamp: Date.now(),
                weightClass: result.weightClass,
                ageGroup: result.ageGroup,
                unit: result.unit,
                rank: result.rank
            });
        }
        showNotice(entries.length > 1 ? 'Lifts saved.' : 'Lift saved.', 'success');
        clearLiftDataTable();
        await loadUserData();
    } catch (err) {
        console.error('Could not save lift data:', err);
        showNotice('Could not save your lifts. Try again.', 'error');
    } finally {
        button.disabled = false;
    }
}

/* ---------- Display name ---------- */

function editField() {
    const current = $('user-full-name').textContent;
    $('editNameInput').value = current === 'Lifter' ? '' : current;
    $('editModal').showModal();
}

function closeEditModal() {
    $('editModal').close();
}

async function saveEdit() {
    const newName = $('editNameInput').value.trim();
    if (!newName) {
        showNotice('Enter a display name.', 'error');
        return;
    }

    try {
        await database.ref(`users/${currentUser.uid}`).update({
            name: newName,
            full_name: `${newName} ${publicId(currentUser.uid)}`
        });
        setText('user-full-name', newName);
        closeEditModal();
        showNotice('Display name saved.', 'success');
    } catch (error) {
        console.error('Could not save name:', error);
        showNotice('Could not save your name. Try again.', 'error');
    }
}

/* ---------- Instagram ---------- */

function renderInstagram(link) {
    const display = $('instagramDisplay');
    display.textContent = '';

    if (isInstagramLink(link)) {
        const anchor = document.createElement('a');
        anchor.href = link;
        anchor.target = '_blank';
        anchor.rel = 'noopener';
        anchor.textContent = link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        display.appendChild(anchor);
        display.classList.remove('muted');
        setText('updateInstagram', 'Change link');
        $('instagramInput').value = link;
    } else {
        display.textContent = 'No Instagram profile linked.';
        display.classList.add('muted');
        setText('updateInstagram', 'Add link');
    }
}

async function saveInstagramLink() {
    const link = $('instagramInput').value.trim();
    if (!isInstagramLink(link)) {
        showNotice('Enter a link like https://www.instagram.com/yourname', 'error');
        return;
    }

    try {
        await database.ref(`users/${currentUser.uid}/instagram`).set(link);
        renderInstagram(link);
        $('instagramPopup').close();
        showNotice('Instagram link saved.', 'success');
    } catch (error) {
        console.error('Could not save Instagram link:', error);
        showNotice('Could not save the link. Try again.', 'error');
    }
}

/* ---------- Friends and leaderboard ---------- */

let friends = [];

async function loadFriends() {
    try {
        const [friendsSnapshot, users] = await Promise.all([
            database.ref(`users/${currentUser.uid}/friends`).once('value'),
            loadAllUsers(true)
        ]);

        // Keep one record per friend; older duplicates are removed.
        const unique = new Map();
        const stored = friendsSnapshot.val() || {};
        Object.keys(stored).forEach((key) => {
            const friend = stored[key];
            if (!friend || !friend.friendId) return;
            const existing = unique.get(friend.friendId);
            if (!existing) {
                unique.set(friend.friendId, { key, timestamp: friend.timestamp || 0 });
                return;
            }
            const keepNew = (friend.timestamp || 0) > existing.timestamp;
            const dropKey = keepNew ? existing.key : key;
            database.ref(`users/${currentUser.uid}/friends/${dropKey}`).remove();
            if (keepNew) unique.set(friend.friendId, { key, timestamp: friend.timestamp || 0 });
        });

        friends = Array.from(unique.entries()).map(([friendId, info]) => {
            const match = findUserByPublicId(users, friendId);
            const lift = match ? latestLift(match.user.liftData) : null;
            return {
                id: friendId,
                key: info.key,
                name: match ? displayNameOf(match.user) : 'Unknown lifter',
                lift
            };
        });

        renderFriendList();
        populateLeaderboard();
    } catch (error) {
        console.error('Could not load friends:', error);
        showNotice('Could not load your friends list.', 'error');
    }
}

function populateFriendList() {
    return loadFriends();
}

function renderFriendList() {
    const list = $('friend-list');
    list.innerHTML = '';
    $('friendsEmpty').hidden = friends.length > 0;

    friends
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((friend) => {
            const item = document.createElement('li');

            const link = document.createElement('a');
            link.href = `profile.html?userId=${encodeURIComponent(friend.id)}`;
            link.textContent = friend.name;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn btn-quiet';
            remove.textContent = 'Remove';
            remove.setAttribute('aria-label', `Remove ${friend.name} from friends`);
            remove.addEventListener('click', () => removeFriend(friend));

            item.append(link, remove);
            list.appendChild(item);
        });
}

async function removeFriend(friend) {
    try {
        await database.ref(`users/${currentUser.uid}/friends/${friend.key}`).remove();
        friends = friends.filter((f) => f.key !== friend.key);
        renderFriendList();
        populateLeaderboard();
        showNotice(`${friend.name} removed from friends.`, 'success');
    } catch (error) {
        console.error('Could not remove friend:', error);
        showNotice('Could not remove that friend. Try again.', 'error');
    }
}

const SORT_COLUMNS = {
    'By Total': { label: 'Total', field: 'total', weight: true },
    'By Dots': { label: 'DOTS', field: 'dots', weight: false },
    'By Squat': { label: 'Squat', field: 'squat', weight: true },
    'By Bench': { label: 'Bench', field: 'bench', weight: true },
    'By Deadlift': { label: 'Deadlift', field: 'deadlift', weight: true }
};

function sortLeaderboard(criteria) {
    if (!SORT_COLUMNS[criteria]) return;
    currentCriteria = criteria;
    document.querySelectorAll('#sortOptions [data-sort]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.sort === criteria));
    });
    populateLeaderboard();
}

function populateLeaderboard() {
    const body = $('leaderboardBody');
    const column = SORT_COLUMNS[currentCriteria];
    const unit = getCurrentWeightUnit();
    body.innerHTML = '';

    setText('totalHeader', column.weight ? `${column.label} (${unitLabel(unit)})` : column.label);
    $('leaderboardEmpty').hidden = friends.length > 0;

    const rows = friends.map((friend) => {
        const lift = friend.lift;
        const liftUnit = lift && lift.unit === 'kgs' ? 'kgs' : 'lbs';
        const squat = lift ? Number(lift.squat) || 0 : 0;
        const bench = lift ? Number(lift.bench) || 0 : 0;
        const deadlift = lift ? Number(lift.deadlift) || 0 : 0;
        const bodyweight = lift ? Number(lift.weight) || 0 : 0;
        const values = { squat, bench, deadlift, total: squat + bench + deadlift };

        let score;
        let sortValue;
        if (!lift) {
            score = '-';
            sortValue = -1;
        } else if (column.weight) {
            // Compare everyone in kilograms so mixed units sort correctly.
            sortValue = convertWeight(values[column.field], liftUnit, 'kgs');
            score = formatWeight(convertWeight(values[column.field], liftUnit, unit), unit);
        } else {
            const isMale = normalizeGender(lift.gender) !== 'female';
            sortValue = Number(calculateDOTS(bodyweight, values.total, isMale, liftUnit));
            score = sortValue.toFixed(2);
        }

        return { friend, score, sortValue, rank: lift ? lift.rank : 'Unranked' };
    });

    rows.sort((a, b) => b.sortValue - a.sortValue);

    rows.forEach((row, index) => {
        const tr = document.createElement('tr');

        const place = document.createElement('td');
        place.className = 'place';
        place.textContent = String(index + 1);

        const name = document.createElement('td');
        const link = document.createElement('a');
        link.href = `profile.html?userId=${encodeURIComponent(row.friend.id)}`;
        link.textContent = row.friend.name;
        name.appendChild(link);

        const score = document.createElement('td');
        score.className = 'score';
        score.textContent = row.score;

        const badge = document.createElement('td');
        badge.className = 'badge';
        const img = document.createElement('img');
        img.width = 40;
        img.height = 40;
        setRankImage(img, row.rank);
        badge.appendChild(img);

        tr.append(place, name, score, badge);
        body.appendChild(tr);
    });
}

/* ---------- One-time username prompt for older email accounts ---------- */

function offerUsernameIfNeeded(user) {
    const usesUsername = (user.email || '').endsWith(`@${USERNAME_DOMAIN}`);
    $('usernamePrompt').hidden = usesUsername;
}

function setPromptError(message) {
    const el = $('promptError');
    el.textContent = message || '';
    el.hidden = !message;
}

async function saveUsernameFromPrompt() {
    const username = $('prompt-username').value.trim();
    const password = $('prompt-password').value;

    const problem = describeUsernameProblem(username);
    if (problem) return setPromptError(problem);
    if (!password) return setPromptError('Enter your current password.');

    const key = usernameKey(username);
    const button = $('promptButton');
    button.disabled = true;
    setPromptError(null);

    try {
        const taken = await database.ref(`usernames/${key}`).once('value')
            .then((snapshot) => snapshot.exists())
            .catch(() => false);
        if (taken) throw { code: 'auth/email-already-in-use' };

        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updateEmail(usernameToAuthId(key));

        await database.ref(`usernames/${key}`).set(currentUser.uid).catch((error) => {
            console.warn('Could not record username in the index:', error);
        });
        await database.ref(`users/${currentUser.uid}`).update({
            username: username,
            username_lower: key,
            email: null
        });

        $('usernamePrompt').hidden = true;
        setText('user-username', username);
        $('usernameMeta').hidden = false;
        showNotice(`Username saved. Log in as ${username} from now on.`, 'success');
    } catch (error) {
        console.error('Could not save username:', error);
        const messages = {
            'auth/email-already-in-use': 'That username is taken. Choose a different one.',
            'auth/wrong-password': 'That password is not correct.',
            'auth/invalid-credential': 'That password is not correct.',
            'auth/invalid-login-credentials': 'That password is not correct.',
            'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
            'auth/operation-not-allowed': 'Switching accounts to a username is not turned on for this site yet. Contact Lift Ascend for help.'
        };
        setPromptError(messages[error.code] || 'Could not save your username. Try again.');
    } finally {
        button.disabled = false;
    }
}

/* ---------- Session ---------- */

function logout() {
    auth.signOut()
        .then(() => { window.location.href = 'index.html'; })
        .catch((error) => {
            console.error('Could not log out:', error);
            showNotice('Could not log out. Try again.', 'error');
        });
}

/* ---------- Page setup ---------- */

document.addEventListener('DOMContentLoaded', () => {
    setText('year', String(new Date().getFullYear()));

    addRow();
    $('addRowButton').addEventListener('click', addRow);
    $('submitLiftButton').addEventListener('click', submitLiftData);
    $('logoutButton').addEventListener('click', logout);

    initUnitToggle(() => {
        if (latestResult) renderScoreboard(latestResult);
        populateLeaderboard();
    });
    initSearch();

    $('editNameButton').addEventListener('click', editField);
    $('editForm').addEventListener('submit', (event) => { event.preventDefault(); saveEdit(); });

    $('updateInstagram').addEventListener('click', () => $('instagramPopup').showModal());
    $('instagramForm').addEventListener('submit', (event) => { event.preventDefault(); saveInstagramLink(); });

    document.querySelectorAll('dialog [data-close]').forEach((button) => {
        button.addEventListener('click', () => button.closest('dialog').close());
    });

    document.querySelectorAll('#sortOptions [data-sort]').forEach((button) => {
        button.addEventListener('click', () => sortLeaderboard(button.dataset.sort));
    });

    $('usernamePromptForm').addEventListener('submit', (event) => {
        event.preventDefault();
        saveUsernameFromPrompt();
    });
});
