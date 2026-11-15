/*
 * Lift Ascend - home page.
 *
 * The public strength calculator, lifter search, and account access:
 * log in and sign up with a username and password, plus a one-time switch
 * for accounts that were created with an email address.
 */

/* ---------- Account access ---------- */

// While a form is mid-flight we hold the automatic redirect, so the account
// record is fully written before the page changes.
let authBusy = false;

auth.onAuthStateChanged((user) => {
    if (user && !authBusy) {
        window.location.href = 'loggedin.html';
    }
});

const AUTH_VIEWS = {
    login: { form: 'login-form', title: 'Log in', tab: 'tabLogin' },
    register: { form: 'register-form', title: 'Create account', tab: 'tabRegister' },
    migrate: { form: 'migrate-form', title: 'Switch to a username', tab: null }
};

function showAuthView(name) {
    const view = AUTH_VIEWS[name];
    Object.values(AUTH_VIEWS).forEach((v) => { $(v.form).hidden = v !== view; });
    setText('form_header', view.title);
    $('authTabs').hidden = name === 'migrate';
    ['tabLogin', 'tabRegister'].forEach((id) => {
        $(id).setAttribute('aria-selected', String(id === view.tab));
    });
    setAuthError(null);

    const dialog = $('authDialog');
    if (!dialog.open) dialog.showModal();
    const first = $(view.form).querySelector('input');
    if (first) first.focus();
}

function showLogin() { showAuthView('login'); }
function showRegister() { showAuthView('register'); }

function setAuthError(message) {
    const el = $('authError');
    el.textContent = message || '';
    el.hidden = !message;
}

function setBusy(buttonId, busy, busyLabel) {
    const button = $(buttonId);
    if (busy) {
        button.dataset.label = button.textContent;
        button.textContent = busyLabel;
    } else if (button.dataset.label) {
        button.textContent = button.dataset.label;
    }
    button.disabled = busy;
}

function authErrorMessage(error) {
    switch (error && error.code) {
        case 'username-taken':
        case 'auth/email-already-in-use':
            return 'That username is taken. Choose a different one.';
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
        case 'auth/invalid-login-credentials':
            return 'Incorrect username or password.';
        case 'auth/weak-password':
            return 'Choose a longer password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Wait a few minutes, then try again.';
        case 'auth/network-request-failed':
            return 'No connection. Check your internet and try again.';
        case 'auth/operation-not-allowed':
            return 'Switching accounts to a username is not turned on for this site yet. Contact Lift Ascend for help.';
        default:
            return 'Something went wrong. Try again.';
    }
}

/** True if the username is already claimed. Falls through to the account
 *  check at sign-up if the lookup itself is unavailable. */
async function isUsernameTaken(key) {
    try {
        const snapshot = await database.ref(`usernames/${key}`).once('value');
        return snapshot.exists();
    } catch (error) {
        console.warn('Username lookup unavailable:', error);
        return false;
    }
}

async function claimUsername(key, uid) {
    try {
        await database.ref(`usernames/${key}`).set(uid);
    } catch (error) {
        // The sign-in account already guarantees the name is unique.
        console.warn('Could not record username in the index:', error);
    }
}

async function register() {
    const username = $('register-username').value.trim();
    const password = $('register-password').value;
    const confirm = $('register-password-confirm').value;

    const problem = describeUsernameProblem(username);
    if (problem) return setAuthError(problem);
    if (password.length < 8) return setAuthError('Use at least 8 characters for your password.');
    if (password !== confirm) return setAuthError('The two passwords do not match.');

    const key = usernameKey(username);
    setAuthError(null);
    setBusy('register-btn', true, 'Creating account...');
    authBusy = true;

    try {
        if (await isUsernameTaken(key)) {
            throw { code: 'username-taken' };
        }

        const credential = await auth.createUserWithEmailAndPassword(usernameToAuthId(key), password);
        const user = credential.user;

        await claimUsername(key, user.uid);
        await database.ref(`users/${user.uid}`).set({
            username: username,
            username_lower: key,
            name: username,
            full_name: `${username} ${publicId(user.uid)}`,
            created_at: Date.now(),
            last_login: Date.now()
        });

        window.location.href = 'loggedin.html';
    } catch (error) {
        console.error('Sign-up failed:', error);
        authBusy = false;
        setBusy('register-btn', false);
        setAuthError(authErrorMessage(error));
    }
}

async function login() {
    const username = $('login-username').value.trim();
    const password = $('login-password').value;

    if (username.includes('@')) {
        showAuthView('migrate');
        $('migrate-email').value = username;
        $('migrate-password').value = password;
        setAuthError('Lift Ascend now uses usernames. Choose one below to switch your account.');
        return;
    }
    if (!username || !password) return setAuthError('Enter your username and password.');
    if (describeUsernameProblem(username)) return setAuthError('Incorrect username or password.');

    const key = usernameKey(username);
    setAuthError(null);
    setBusy('login-btn', true, 'Logging in...');
    authBusy = true;

    try {
        const credential = await auth.signInWithEmailAndPassword(usernameToAuthId(key), password);
        const user = credential.user;
        const ref = database.ref(`users/${user.uid}`);
        const record = (await ref.once('value')).val();

        if (record) {
            const updates = { last_login: Date.now(), email: null };
            if (!record.username) {
                updates.username = username;
                updates.username_lower = key;
            }
            await ref.update(updates);
        } else {
            await ref.set({
                username: username,
                username_lower: key,
                name: username,
                full_name: `${username} ${publicId(user.uid)}`,
                created_at: Date.now(),
                last_login: Date.now()
            });
        }

        window.location.href = 'loggedin.html';
    } catch (error) {
        console.error('Log in failed:', error);
        authBusy = false;
        setBusy('login-btn', false);
        setAuthError(authErrorMessage(error));
    }
}

/**
 * One-time switch for accounts created with an email address: sign in with
 * the old email, replace it with a username, and remove the email from the
 * account record.
 */
async function migrateAccount() {
    const email = $('migrate-email').value.trim();
    const password = $('migrate-password').value;
    const username = $('migrate-username').value.trim();

    if (!email || !password) return setAuthError('Enter the email and password you signed up with.');
    const problem = describeUsernameProblem(username);
    if (problem) return setAuthError(problem);

    const key = usernameKey(username);
    setAuthError(null);
    setBusy('migrate-btn', true, 'Switching...');
    authBusy = true;

    try {
        if (await isUsernameTaken(key)) {
            throw { code: 'username-taken' };
        }

        let credential;
        try {
            credential = await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            const wrong = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found',
                'auth/invalid-email', 'auth/invalid-login-credentials'];
            if (wrong.includes(error.code)) {
                throw { code: 'legacy-credentials' };
            }
            throw error;
        }

        const user = credential.user;
        try {
            await user.updateEmail(usernameToAuthId(key));
        } catch (error) {
            await auth.signOut();
            throw error;
        }

        await claimUsername(key, user.uid);
        await database.ref(`users/${user.uid}`).update({
            username: username,
            username_lower: key,
            email: null,
            last_login: Date.now()
        });

        window.location.href = 'loggedin.html';
    } catch (error) {
        console.error('Account switch failed:', error);
        authBusy = false;
        setBusy('migrate-btn', false);
        setAuthError(error.code === 'legacy-credentials'
            ? 'That email and password do not match an account.'
            : authErrorMessage(error));
    }
}

function logout() {
    return auth.signOut();
}

/* ---------- Calculator ---------- */

let lastResult = null;

async function submitLiftData() {
    const { entries, error } = readLiftRows();
    if (error) {
        showNotice(error, 'error');
        return;
    }

    try {
        // With several rows, the last one is the result shown.
        const results = await Promise.all(entries.map(analyseEntry));
        lastResult = results[results.length - 1];
        renderScoreboard(lastResult);
        if (window.matchMedia('(max-width: 61.99rem)').matches) {
            $('percentile-content-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (err) {
        console.error('Could not calculate percentiles:', err);
        showNotice('Could not load the comparison data. Try again in a moment.', 'error');
    }
}

/* ---------- Page setup ---------- */

document.addEventListener('DOMContentLoaded', () => {
    setText('year', String(new Date().getFullYear()));

    addRow();
    $('addRowButton').addEventListener('click', addRow);
    $('submitLiftButton').addEventListener('click', submitLiftData);
    initUnitToggle(() => {
        if (lastResult) renderScoreboard(lastResult);
    });
    initSearch();

    $('openLogin').addEventListener('click', showLogin);
    $('openRegister').addEventListener('click', showRegister);
    $('tabLogin').addEventListener('click', showLogin);
    $('tabRegister').addEventListener('click', showRegister);
    $('backToLogin').addEventListener('click', showLogin);
    $('closeAuth').addEventListener('click', () => $('authDialog').close());

    $('login-form').addEventListener('submit', (event) => { event.preventDefault(); login(); });
    $('register-form').addEventListener('submit', (event) => { event.preventDefault(); register(); });
    $('migrate-form').addEventListener('submit', (event) => { event.preventDefault(); migrateAccount(); });
});
