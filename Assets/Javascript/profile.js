/*
 * Lift Ascend - another lifter's profile.
 *
 * Reads the lifter from the ?userId= link, shows their latest lifts and
 * rank, and lets a signed-in visitor add them as a friend.
 */

let viewer = null;
let profileResult = null;

function getUserIdFromUrl() {
    return new URLSearchParams(window.location.search).get('userId');
}

auth.onAuthStateChanged((user) => {
    viewer = user;
    const home = user ? 'loggedin.html' : 'index.html';
    $('logoLink').href = home;
    $('homeLink').href = home;
    setText('homeLink', user ? 'Your lifts' : 'Log in');
    updateFriendButton();
});

function updateFriendButton() {
    const button = $('add-friend-btn');
    const ownProfile = viewer && publicId(viewer.uid) === getUserIdFromUrl();
    button.hidden = Boolean(ownProfile);
}

async function loadProfile() {
    const profileId = getUserIdFromUrl();

    try {
        const users = await loadAllUsers();
        const match = profileId ? findUserByPublicId(users, profileId) : null;

        if (!match) {
            $('profileContent').hidden = true;
            $('profileMissing').hidden = false;
            return;
        }

        const name = displayNameOf(match.user);
        document.title = `${name} - Lift Ascend`;
        setText('user-full-name', name);
        setText('user-id', profileId);
        updateInstagramDisplay(match.user.instagram);

        const entry = latestLift(match.user.liftData);
        if (!entry) {
            clearScoreboard();
            setText('scoreboardNote', `${name} hasn't saved any lifts yet.`);
            return;
        }

        setWeightUnit(entry.unit === 'kgs' ? 'kgs' : 'lbs');
        profileResult = await analyseEntry(entry);
        renderScoreboard(profileResult);
    } catch (error) {
        console.error('Could not load profile:', error);
        showNotice('Could not load this profile. Refresh to try again.', 'error');
    }
}

function updateInstagramDisplay(link) {
    const status = $('instagramStatus');
    status.textContent = '';
    if (!isInstagramLink(link)) return;

    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.id = 'userInstagramLink';
    anchor.textContent = 'Instagram';
    status.appendChild(anchor);
}

async function addFriend() {
    if (!viewer) {
        showNotice('Log in to add friends.', 'error');
        return;
    }

    const profileId = getUserIdFromUrl();
    if (publicId(viewer.uid) === profileId) {
        showNotice("You can't add yourself as a friend.", 'error');
        return;
    }

    const friendsRef = database.ref(`users/${viewer.uid}/friends`);

    try {
        const existing = (await friendsRef.once('value')).val() || {};
        const alreadyFriend = Object.values(existing).some((friend) => friend && friend.friendId === profileId);
        if (alreadyFriend) {
            showNotice('This lifter is already in your friends list.', 'info');
            return;
        }

        await friendsRef.push({ friendId: profileId, timestamp: Date.now() });
        showNotice('Friend added.', 'success');
    } catch (error) {
        console.error('Could not add friend:', error);
        showNotice('Could not add this friend. Try again.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setText('year', String(new Date().getFullYear()));
    initUnitToggle(() => {
        if (profileResult) renderScoreboard(profileResult);
    });
    initSearch();
    $('add-friend-btn').addEventListener('click', addFriend);
    loadProfile();
});
