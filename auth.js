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

      updateSettingsAuthUI();
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
      updateSettingsAuthUI();
    }
  });
}
window.initAuth = initAuth;

function updateSettingsAuthUI() {
  const emailEl = document.getElementById('settings-user-email');
  const subEl = document.getElementById('settings-user-sub');
  const actionsEl = document.getElementById('settings-auth-actions');
  if (!actionsEl) return;

  const user = window.currentUser || currentUser;
  if (user && !user.isGuest) {
    if (emailEl) emailEl.textContent = user.email || 'Google User';
    if (subEl) subEl.innerHTML = `<span style="color:var(--green);font-weight:700;">🟢 Cloud Synced</span> · Auto-backed up`;
    actionsEl.innerHTML = `
      <button class="btn btn-sm" onclick="handleSignOut()" style="color:var(--red);border-color:rgba(239,68,68,0.3);font-size:12px;padding:6px 14px;border-radius:10px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
        <i class="ti ti-logout"></i> Sign out
      </button>
    `;
  } else {
    if (emailEl) emailEl.textContent = 'Guest User';
    if (subEl) subEl.textContent = 'Your data is saved safely on this device';
    actionsEl.innerHTML = `
      <button class="btn btn-sm btn-primary" onclick="showAuthScreen()" style="font-size:12px;padding:6px 14px;border-radius:10px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">
        <i class="ti ti-login"></i> Cloud Sign in
      </button>
    `;
  }
}
window.updateSettingsAuthUI = updateSettingsAuthUI;

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

  action.then(() => {
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.style.display = 'none';
    toast('Welcome to PocketTrack! ☁️', 'success');
  }).catch(err => {
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
  
  auth.signInWithPopup(provider).then(() => {
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.style.display = 'none';
    toast('Signed in with Google! ☁️', 'success');
  }).catch(err => {
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
  if (currentUser && !currentUser.isGuest) {
    auth.signOut().then(() => {
      currentUser = null;
      window.currentUser = null;
      startGuestSandboxMode();
      toast('Signed out from Cloud', 'info');
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
  if (authScreen) authScreen.style.display = 'none';

  // Fresh user starts clean - NO automatic sample demo data!
  if (!window.entries) {
    window.entries = [];
  }

  updateSettingsAuthUI();
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
