// =====================================================================
// POCKETTRACK PURE — AUTHENTICATION & CLOUD SYNC
// =====================================================================

let currentUser = null;
window.currentUser = null;
window.isGuestMode = false;

function closeAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'none';
}
window.closeAuthScreen = closeAuthScreen;

function initAuth() {
  if (typeof auth === 'undefined') return;

  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      window.currentUser = user;
      window.isGuestMode = false;
      closeAuthScreen();
      const emailEl = document.getElementById('settings-user-email');

      if (emailEl) emailEl.textContent = user.email || 'Signed in User';
      updateSettingsAuthUI();
      if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
      listenToCloudEntries();
    } else {
      // Cleanly unsubscribe from any previous Firestore cloud listener immediately
      if (cloudEntriesUnsubscribe) {
        cloudEntriesUnsubscribe();
        cloudEntriesUnsubscribe = null;
      }
      currentUser = null;
      window.currentUser = null;
      if (!window.isGuestMode) {
        startGuestSandboxMode();
      }
      updateSettingsAuthUI();
      if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
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

let cloudEntriesUnsubscribe = null;

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

  const rememberEl = document.getElementById('auth-remember');
  const persistence = (rememberEl && rememberEl.checked)
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;

  const doAuth = () => (mode === 'login') 
    ? auth.signInWithEmailAndPassword(email, pass)
    : auth.createUserWithEmailAndPassword(email, pass);

  const action = (typeof auth.setPersistence === 'function')
    ? auth.setPersistence(persistence).then(doAuth)
    : doAuth();

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

  const rememberEl = document.getElementById('auth-remember');
  const persistence = (rememberEl && rememberEl.checked)
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;

  const doGoogle = () => auth.signInWithPopup(provider);

  const action = (typeof auth.setPersistence === 'function')
    ? auth.setPersistence(persistence).then(doGoogle)
    : doGoogle();
  
  action.then(() => {
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
  if (cloudEntriesUnsubscribe) {
    cloudEntriesUnsubscribe();
    cloudEntriesUnsubscribe = null;
  }
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

  closeAuthScreen();

  // Fresh user starts clean - NO automatic sample demo data!
  if (!window.entries) {
    window.entries = [];
  }

  updateSettingsAuthUI();
  if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
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
  }, { merge: true }).catch(err => {
    console.warn('Cloud sync parent error:', err);
    if (err && err.code === 'permission-denied') {
      const syncStatus = document.getElementById('sync-status');
      const syncDot = document.querySelector('#sync-pill-btn .dot');
      if (syncStatus) syncStatus.textContent = 'Rules Needed';
      if (syncDot) {
        syncDot.style.background = '#f59e0b';
        syncDot.style.boxShadow = '0 0 6px #f59e0b';
      }
    }
  });

  // Sync subcollection atomically
  const entriesCol = db.collection('users').doc(currentUser.uid).collection('entries');
  list.forEach(entry => {
    entriesCol.doc(entry.id).set(entry, { merge: true }).catch(err => {
      console.warn('Cloud entry write error:', err);
    });
  });
}
window.syncEntriesToCloud = syncEntriesToCloud;
window.syncWalletsToCloud = syncEntriesToCloud;

function deleteEntryFromCloud(entryId) {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined' || !entryId) return;
  
  db.collection('users').doc(currentUser.uid).collection('entries').doc(entryId).delete().catch(err => {
    console.warn('Cloud entry delete error:', err);
  });

  // Update parent doc snapshot
  const list = window.entries || [];
  db.collection('users').doc(currentUser.uid).set({
    entries: list,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(err => {
    console.warn('Cloud parent update on delete error:', err);
  });
}
window.deleteEntryFromCloud = deleteEntryFromCloud;
window.deleteCloudEntry = deleteEntryFromCloud;

function listenToCloudEntries() {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined') return;

  if (cloudEntriesUnsubscribe) {
    cloudEntriesUnsubscribe();
    cloudEntriesUnsubscribe = null;
  }

  // 1. Listen to subcollection entries
  cloudEntriesUnsubscribe = db.collection('users').doc(currentUser.uid).collection('entries').onSnapshot(snap => {
    if (!currentUser || currentUser.isGuest) return;
    if (snap && snap.docs) {
      if (snap.docs.length > 0) {
        const cloudEntries = snap.docs.map(doc => {
          const d = doc.data();
          return typeof normalizeEntry === 'function' ? normalizeEntry({ ...d, id: doc.id }) : { ...d, id: doc.id };
        }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

        window.entries = cloudEntries;
        localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
        if (typeof updateHeaderStats === 'function') updateHeaderStats();
      } else {
        // 2. Subcollection is empty — check parent document fallback only if local state is empty
        if (!currentUser || currentUser.isGuest) return;
        db.collection('users').doc(currentUser.uid).get().then(doc => {
          if (!currentUser || currentUser.isGuest) return;
          if (doc.exists) {
            const data = doc.data() || {};
            if (data.entries && Array.isArray(data.entries) && data.entries.length > 0 && (!window.entries || window.entries.length === 0)) {
              window.entries = data.entries.map(normalizeEntry);
              localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
              if (typeof updateHeaderStats === 'function') updateHeaderStats();
            }
            if (data.wallets && Array.isArray(data.wallets)) {
              window.wallets = data.wallets;
              localStorage.setItem('pocketTrackWallets', JSON.stringify(window.wallets));
              if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
            }
          }
        }).catch(err => console.warn('Cloud parent read error:', err));
      }
    }
  }, err => {
    console.warn('Cloud subcollection listen error:', err);
    // Fallback to local device cache so offline experience is seamless
    const cached = localStorage.getItem('pocketTrackEntries');
    if (cached && (!window.entries || window.entries.length === 0)) {
      try {
        window.entries = JSON.parse(cached);
        if (typeof updateHeaderStats === 'function') updateHeaderStats();
      } catch (e) {}
    }
    const syncStatus = document.getElementById('sync-status');
    const syncDot = document.querySelector('#sync-pill-btn .dot');
    if (err && err.code === 'permission-denied') {
      if (syncStatus) {
        syncStatus.textContent = 'Rules Needed';
        syncStatus.title = 'Firestore rules in Firebase Console need to be published from firestore.rules';
      }
      if (syncDot) {
        syncDot.style.background = '#f59e0b';
        syncDot.style.boxShadow = '0 0 6px #f59e0b';
      }
    } else {
      if (syncStatus) {
        syncStatus.textContent = 'Local (Offline)';
        syncStatus.title = 'Network or ad-blocker blocked Cloud sync. Data saved locally.';
      }
      if (syncDot) {
        syncDot.style.background = '#f59e0b';
        syncDot.style.boxShadow = '0 0 6px #f59e0b';
      }
    }
  });
}

function triggerManualSync() {
  if (!currentUser || currentUser.isGuest) {
    toast('📱 Data is saved safely on your device! Sign in for real-time Cloud backup.', 'info');
    showAuthScreen();
    return;
  }
  toast('Syncing with cloud...', 'info');
  syncEntriesToCloud();
  setTimeout(() => {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus && syncStatus.textContent === 'Rules Needed') {
      toast('⚠️ Cloud rules not published in Firebase Console yet. Data saved locally.', 'warning');
    } else {
      toast('Cloud backup synced! ☁️', 'success');
    }
  }, 400);
}
window.triggerManualSync = triggerManualSync;

function forgotPassword() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) {
    document.getElementById('auth-error').textContent = 'Please enter your email address first.';
    document.getElementById('auth-error').style.display = 'block';
    return;
  }
  auth.sendPasswordResetEmail(email)
    .then(() => {
      toast('Password reset email sent! Check your inbox.', 'success');
      document.getElementById('auth-error').style.display = 'none';
    })
    .catch((err) => {
      document.getElementById('auth-error').textContent = err.message;
      document.getElementById('auth-error').style.display = 'block';
    });
}
window.forgotPassword = forgotPassword;

function togglePasswordVisibility() {
  const passInput = document.getElementById('auth-pass');
  const toggleIcon = document.getElementById('auth-pass-toggle-icon');
  const toggleText = document.getElementById('auth-pass-toggle-text');
  const toggleBtn = document.getElementById('auth-pass-toggle');
  if (!passInput) return;

  if (passInput.type === 'password') {
    passInput.type = 'text';
    if (toggleIcon) toggleIcon.textContent = '🙈';
    if (toggleText) toggleText.textContent = 'Hide';
    if (!toggleIcon && toggleBtn) toggleBtn.textContent = '🙈 Hide';
  } else {
    passInput.type = 'password';
    if (toggleIcon) toggleIcon.textContent = '👁️';
    if (toggleText) toggleText.textContent = 'Show';
    if (!toggleIcon && toggleBtn) toggleBtn.textContent = '👁️ Show';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;
