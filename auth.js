// =====================================================================
// POCKETTRACK PURE — AUTHENTICATION & CLOUD SYNC
// =====================================================================

let currentUser = null;
window.currentUser = null;
window.isGuestMode = false;

function initAuth() {
  if (typeof auth === 'undefined') return;

  auth.onAuthStateChanged(user => {
    const syncStatus = document.getElementById('sync-status');
    const syncDot = document.querySelector('#sync-pill-btn .dot');

    if (user) {
      currentUser = user;
      window.currentUser = user;
      window.isGuestMode = false;
      const authScreen = document.getElementById('auth-screen');
      const emailEl = document.getElementById('settings-user-email');

      if (authScreen) authScreen.style.display = 'none';
      if (emailEl) emailEl.textContent = user.email || 'Signed in User';
      if (syncStatus) syncStatus.textContent = 'Cloud';
      if (syncDot) {
        syncDot.style.background = 'var(--green)';
        syncDot.style.boxShadow = '0 0 6px var(--green)';
      }

      listenToCloudEntries();
    } else {
      currentUser = null;
      window.currentUser = null;
      if (!window.isGuestMode) {
        startGuestSandboxMode();
      }
      if (syncStatus) syncStatus.textContent = 'Local';
      if (syncDot) {
        syncDot.style.background = '#f59e0b';
        syncDot.style.boxShadow = '0 0 6px #f59e0b';
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
  
  // Save parent snapshot
  db.collection('users').doc(currentUser.uid).set({
    entries: list,
    wallets: window.wallets || [],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(err => console.warn('Cloud sync parent error:', err));

  // Also sync individual documents to entries subcollection for legacy compatibility
  list.forEach(e => {
    if (e.id) {
      db.collection('users').doc(currentUser.uid).collection('entries').doc(e.id).set(e, { merge: true })
        .catch(err => console.warn('Cloud entry write error:', err));
    }
  });
}
window.syncEntriesToCloud = syncEntriesToCloud;
window.syncWalletsToCloud = syncEntriesToCloud;

function listenToCloudEntries() {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined') return;
  
  // 1. Listen to subcollection entries (where all legacy records are stored)
  db.collection('users').doc(currentUser.uid).collection('entries').onSnapshot(snap => {
    if (snap && snap.docs && snap.docs.length > 0) {
      const cloudEntries = snap.docs.map(doc => {
        const d = doc.data();
        return typeof normalizeEntry === 'function' ? normalizeEntry({ ...d, id: doc.id }) : { ...d, id: doc.id };
      }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      window.entries = cloudEntries;
      localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
      localStorage.setItem('pockettrack_entries', JSON.stringify(window.entries));
      localStorage.setItem('pockettrack_entries_cache_' + currentUser.uid, JSON.stringify(window.entries));
      if (typeof updateHeaderStats === 'function') updateHeaderStats();
    } else {
      // 2. Check parent document fallback
      db.collection('users').doc(currentUser.uid).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data.entries && Array.isArray(data.entries) && data.entries.length > 0) {
            window.entries = data.entries.map(normalizeEntry);
            localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
            localStorage.setItem('pockettrack_entries', JSON.stringify(window.entries));
            if (typeof updateHeaderStats === 'function') updateHeaderStats();
          }
          if (data.wallets && Array.isArray(data.wallets)) {
            window.wallets = data.wallets;
            localStorage.setItem('pocketTrackWallets', JSON.stringify(window.wallets));
            localStorage.setItem('pockettrack_wallets', JSON.stringify(window.wallets));
            if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
          }
        }
      }).catch(err => console.warn('Cloud parent read error:', err));
    }
  }, err => console.warn('Cloud subcollection listen error:', err));
}

function triggerManualSync() {
  if (!currentUser || currentUser.isGuest) {
    toast('📱 Data is saved safely on your device! Sign in for real-time Cloud backup.', 'info');
    showAuthScreen();
    return;
  }
  toast('Syncing with cloud...', 'info');
  syncEntriesToCloud();
  setTimeout(() => toast('Cloud backup synced! ☁️', 'success'), 350);
}
window.triggerManualSync = triggerManualSync;
