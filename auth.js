// =====================================================================
// POCKETTRACK PURE — AUTHENTICATION & CLOUD SYNC
// =====================================================================

let currentUser = null;
window.currentUser = null;
window.isGuestMode = false;

function initAuth() {
  if (typeof auth === 'undefined') return;

  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      window.currentUser = user;
      window.isGuestMode = false;
      const authScreen = document.getElementById('auth-screen');
      const guestBanner = document.getElementById('guest-mode-banner');
      const emailEl = document.getElementById('settings-user-email');
      const syncStatus = document.getElementById('sync-status');

      if (authScreen) authScreen.style.display = 'none';
      if (guestBanner) guestBanner.style.display = 'none';
      if (emailEl) emailEl.textContent = user.email || 'Signed in User';
      if (syncStatus) syncStatus.textContent = 'Synced';

      listenToCloudEntries();
    } else {
      currentUser = null;
      window.currentUser = null;
      if (!window.isGuestMode) {
        // Auto-enable guest mode for frictionless instant use if not logged in
        startGuestSandboxMode();
      }
    }
  });
}
window.initAuth = initAuth;

function authAction(mode) {
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-pass');
  const errEl = document.getElementById('auth-error');

  const email = emailInput ? emailInput.value.trim() : '';
  const pass = passInput ? passInput.value : '';

  if (!email || !pass || pass.length < 6) {
    if (errEl) {
      errEl.textContent = 'Please enter a valid email and 6+ character password.';
      errEl.style.display = 'block';
    }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  const action = (mode === 'login') 
    ? auth.signInWithEmailAndPassword(email, pass)
    : auth.createUserWithEmailAndPassword(email, pass);

  action.catch(err => {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}
window.authAction = authAction;

function signInWithGoogle() {
  const errEl = document.getElementById('auth-error');
  if (errEl) errEl.style.display = 'none';
  const provider = new firebase.auth.GoogleAuthProvider();
  
  auth.signInWithPopup(provider).catch(err => {
    if (err.code !== 'auth/popup-closed-by-user') {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    }
  });
}
window.signInWithGoogle = signInWithGoogle;

function handleSignOut() {
  if (currentUser) {
    auth.signOut().then(() => {
      toast('Signed out', 'info');
      showAuthScreen();
    });
  } else {
    showAuthScreen();
  }
}
window.handleSignOut = handleSignOut;
window.logOut = handleSignOut;

function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'flex';
}
window.showAuthScreen = showAuthScreen;

function startGuestSandboxMode() {
  window.isGuestMode = true;
  currentUser = { uid: 'guest_user', email: 'guest@pockettrack.local', isGuest: true };
  window.currentUser = currentUser;

  const authScreen = document.getElementById('auth-screen');
  const guestBanner = document.getElementById('guest-mode-banner');
  const emailEl = document.getElementById('settings-user-email');

  if (authScreen) authScreen.style.display = 'none';
  if (guestBanner) guestBanner.style.display = 'block';
  if (emailEl) emailEl.textContent = 'Guest Mode (Offline)';

  // If no entries exist yet, add starter sample entries
  if (!window.entries || window.entries.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    window.entries = [
      { id: 'demo_1', type: 'income', amt: 25000, desc: 'Salary / Allowance', cat: 'salary', date: today, wallet: 'bank' },
      { id: 'demo_2', type: 'expense', amt: 350, desc: 'Lunch & Chai', cat: 'food', date: today, wallet: 'cash' },
      { id: 'demo_3', type: 'expense', amt: 1200, desc: 'Groceries & Milk', cat: 'grocery', date: today, wallet: 'card' }
    ];
    localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
  }

  if (typeof updateHeaderStats === 'function') updateHeaderStats();
}
window.startGuestSandboxMode = startGuestSandboxMode;

// ── FIRESTORE CLOUD REALTIME SYNC ──
function syncEntriesToCloud() {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined') return;
  const list = window.entries || [];
  db.collection('users').doc(currentUser.uid).set({
    entries: list,
    wallets: window.wallets || [],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(err => console.warn('Cloud sync write error:', err));
}
window.syncEntriesToCloud = syncEntriesToCloud;
window.syncWalletsToCloud = syncEntriesToCloud;

function listenToCloudEntries() {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined') return;
  db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data.entries) {
        window.entries = data.entries;
        localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
      }
      if (data.wallets) {
        window.wallets = data.wallets;
        localStorage.setItem('pocketTrackWallets', JSON.stringify(window.wallets));
      }
      if (typeof updateHeaderStats === 'function') updateHeaderStats();
    }
  }, err => console.warn('Cloud listen error:', err));
}

function triggerManualSync() {
  toast('Syncing with cloud...', 'info');
  syncEntriesToCloud();
  setTimeout(() => toast('All changes synced! ☁️', 'success'), 400);
}
window.triggerManualSync = triggerManualSync;
