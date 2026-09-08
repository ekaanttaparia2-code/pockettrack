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
      checkGuestMigration(user);
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

// ── FIRESTORE CLOUD REALTIME SYNC & SETTINGS PERSISTENCE ──
function getSettingsSnapshot() {
  const parseSafe = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  return {
    wallets: window.wallets || [],
    budgets: parseSafe('pocketTrackBudgets', []),
    savingsTargets: parseSafe('pocketTrackSavingsTargets', []),
    savingsTarget: localStorage.getItem('pocketTrackSavingsTarget') || '',
    budget: localStorage.getItem('pocketTrackBudget') || '',
    quickPresets: parseSafe('pocketTrackQuickPresets', []),
    recurringRules: parseSafe('pocketTrackRecurringRules', []),
    friendsLedger: parseSafe('pocketTrackFriendsLedger', []),
    userName: localStorage.getItem('pocketTrackUserName') || '',
    seniorMode: localStorage.getItem('pocketTrackSeniorMode') || 'false',
    theme: localStorage.getItem('pocketTrackTheme') || 'dark',
    updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
      ? firebase.firestore.FieldValue.serverTimestamp()
      : Date.now()
  };
}
window.getSettingsSnapshot = getSettingsSnapshot;

function applySettingsSnapshot(data) {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data.wallets) && data.wallets.length > 0) {
    window.wallets = data.wallets;
    localStorage.setItem('pocketTrackWallets', JSON.stringify(data.wallets));
    if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
  }
  if (Array.isArray(data.budgets)) {
    localStorage.setItem('pocketTrackBudgets', JSON.stringify(data.budgets));
  }
  if (Array.isArray(data.savingsTargets)) {
    localStorage.setItem('pocketTrackSavingsTargets', JSON.stringify(data.savingsTargets));
  }
  if (data.savingsTarget) {
    localStorage.setItem('pocketTrackSavingsTarget', String(data.savingsTarget));
  }
  if (data.budget) {
    localStorage.setItem('pocketTrackBudget', String(data.budget));
  }
  if (Array.isArray(data.quickPresets) && data.quickPresets.length > 0) {
    localStorage.setItem('pocketTrackQuickPresets', JSON.stringify(data.quickPresets));
    if (typeof renderQuickPresetsBar === 'function') renderQuickPresetsBar();
  }
  if (Array.isArray(data.recurringRules)) {
    localStorage.setItem('pocketTrackRecurringRules', JSON.stringify(data.recurringRules));
    if (typeof renderRecurringRules === 'function') renderRecurringRules();
  }
  if (Array.isArray(data.friendsLedger)) {
    localStorage.setItem('pocketTrackFriendsLedger', JSON.stringify(data.friendsLedger));
    if (typeof renderFriendsLedger === 'function') renderFriendsLedger();
  }
  if (data.userName) {
    localStorage.setItem('pocketTrackUserName', String(data.userName));
    const nameInput = document.getElementById('settings-user-name');
    if (nameInput) nameInput.value = data.userName;
  }
  if (data.seniorMode === 'true' && typeof toggleSeniorMode === 'function') {
    const isCurrent = document.body && document.body.classList.contains('senior-mode');
    if (!isCurrent) toggleSeniorMode(true);
  }
}
window.applySettingsSnapshot = applySettingsSnapshot;

async function syncEntriesToCloud() {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined') return { success: true };
  const list = window.entries || [];
  if (typeof trackPendingWrite === 'function') trackPendingWrite('entries', true);

  try {
    // 1. Sync settings & metadata to parent document (NO entries array to prevent 1MB limit)
    const parentPromise = db.collection('users').doc(currentUser.uid).set(getSettingsSnapshot(), { merge: true });

    // 2. Sync transactions exclusively to subcollection
    const entriesCol = db.collection('users').doc(currentUser.uid).collection('entries');
    const entryPromises = list.map(entry => {
      if (!entry || !entry.id) return Promise.resolve();
      return entriesCol.doc(String(entry.id)).set(entry, { merge: true });
    });

    const results = await Promise.allSettled([parentPromise, ...entryPromises]);
    const anyFailed = results.some(r => r.status === 'rejected');

    if (typeof trackPendingWrite === 'function') trackPendingWrite('entries', anyFailed);
    if (typeof updateSyncIndicator === 'function') updateSyncIndicator();

    if (anyFailed) {
      console.warn('Some cloud writes failed');
      return { success: false, error: 'Partial write failure' };
    }
    return { success: true };
  } catch (err) {
    console.warn('syncEntriesToCloud error:', err);
    if (typeof trackPendingWrite === 'function') trackPendingWrite('entries', true);
    if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
    return { success: false, error: err };
  }
}
window.syncEntriesToCloud = syncEntriesToCloud;
window.syncWalletsToCloud = syncEntriesToCloud;

async function deleteEntryFromCloud(entryId) {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined' || !entryId) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('entries').doc(String(entryId)).delete();
    await db.collection('users').doc(currentUser.uid).set({
      updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('Cloud entry delete error:', err);
  }
}
window.deleteEntryFromCloud = deleteEntryFromCloud;
window.deleteCloudEntry = deleteEntryFromCloud;

function listenToCloudEntries() {
  if (!currentUser || currentUser.isGuest || typeof db === 'undefined') return;

  if (cloudEntriesUnsubscribe) {
    cloudEntriesUnsubscribe();
    cloudEntriesUnsubscribe = null;
  }

  // 1. Listen to subcollection entries (single canonical source of truth)
  cloudEntriesUnsubscribe = db.collection('users').doc(currentUser.uid).collection('entries').onSnapshot(snap => {
    if (!currentUser || currentUser.isGuest) return;
    if (snap && snap.docs) {
      const cloudEntries = snap.docs.map(doc => {
        const d = doc.data();
        return typeof normalizeEntry === 'function' ? normalizeEntry({ ...d, id: doc.id }) : { ...d, id: doc.id };
      }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      window.entries = cloudEntries;
      localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
      if (typeof updateHeaderStats === 'function') updateHeaderStats();
      if (typeof renderActivityList === 'function') renderActivityList();
      if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
    }
  }, err => {
    console.warn('Cloud subcollection listen error:', err);
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

  // 2. Fetch parent settings snapshot once to restore user setup across devices
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    if (!currentUser || currentUser.isGuest) return;
    if (doc.exists) {
      applySettingsSnapshot(doc.data());
    }
  }).catch(err => console.warn('Parent settings read error:', err));
}

// ── SAFE GUEST-TO-ACCOUNT MIGRATION ──
function openGuestMigrationModal() {
  const m = document.getElementById('guest-migration-modal');
  if (m) {
    if (typeof smoothOpenModal === 'function') {
      smoothOpenModal(m);
    } else {
      m.style.display = 'flex';
      if (document.body && document.body.style) document.body.style.overflow = 'hidden';
    }
  }
}
window.openGuestMigrationModal = openGuestMigrationModal;

function closeGuestMigrationModal() {
  window._pendingMigrationUser = null;
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('guest-migration-modal');
  } else {
    const m = document.getElementById('guest-migration-modal');
    if (m) {
      m.style.display = 'none';
      if (document.body && document.body.style) document.body.style.overflow = '';
    }
  }
}
window.closeGuestMigrationModal = closeGuestMigrationModal;

async function checkGuestMigration(user) {
  if (!user || user.isGuest || typeof db === 'undefined') return;
  const localList = window.entries || [];
  if (localList.length === 0) {
    listenToCloudEntries();
    return;
  }

  try {
    const snap = await db.collection('users').doc(user.uid).collection('entries').limit(1).get();
    if (!snap.empty) {
      // Both local records and cloud records exist: ask user how to proceed!
      window._pendingMigrationUser = user;
      openGuestMigrationModal();
    } else {
      // Cloud is empty, automatically migrate local guest records to cloud
      toast('Migrating local records to your new cloud account...', 'info');
      await syncEntriesToCloud();
      listenToCloudEntries();
      toast('Records safely backed up to your account! ☁️', 'success');
    }
  } catch (err) {
    console.warn('Error checking guest migration:', err);
    listenToCloudEntries();
  }
}
window.checkGuestMigration = checkGuestMigration;

async function resolveGuestMigration(choice) {
  const user = window._pendingMigrationUser || currentUser;
  if (!user || user.isGuest) {
    closeGuestMigrationModal();
    return;
  }

  if (choice === 'cancel') {
    closeGuestMigrationModal();
    if (typeof auth !== 'undefined') {
      auth.signOut().then(() => {
        startGuestSandboxMode();
        toast('Sign-in cancelled. Local records preserved.', 'info');
      });
    }
    return;
  }

  // Pre-migration safety backup
  if (typeof backupAppDataJSON === 'function') {
    try {
      backupAppDataJSON();
    } catch (e) {
      console.warn('Pre-migration backup notice:', e);
    }
  }

  if (choice === 'merge') {
    toast('Merging local and cloud records...', 'info');
    try {
      const snap = await db.collection('users').doc(user.uid).collection('entries').get();
      const cloudEntries = snap.docs.map(doc => {
        const d = doc.data();
        return typeof normalizeEntry === 'function' ? normalizeEntry({ ...d, id: doc.id }) : { ...d, id: doc.id };
      });

      const localEntries = window.entries || [];
      const entryMap = new Map();
      cloudEntries.forEach(e => { if (e && e.id) entryMap.set(String(e.id), e); });
      localEntries.forEach(e => { if (e && e.id && !entryMap.has(String(e.id))) entryMap.set(String(e.id), e); });

      const merged = Array.from(entryMap.values()).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      window.entries = merged;
      localStorage.setItem('pocketTrackEntries', JSON.stringify(merged));

      closeGuestMigrationModal();
      await syncEntriesToCloud();
      listenToCloudEntries();
      if (typeof updateHeaderStats === 'function') updateHeaderStats();
      if (typeof renderActivityList === 'function') renderActivityList();
      toast('Merged & backed up successfully! ☁️', 'success');
    } catch (err) {
      console.warn('Merge failed:', err);
      toast('Merge encountered an issue. Local data kept safe.', 'error');
      closeGuestMigrationModal();
      listenToCloudEntries();
    }
  } else if (choice === 'cloud_only') {
    toast('Restoring cloud account data...', 'info');
    closeGuestMigrationModal();
    listenToCloudEntries();
    toast('Cloud records restored! ☁️', 'success');
  }
}
window.resolveGuestMigration = resolveGuestMigration;

async function triggerManualSync() {
  if (!currentUser || currentUser.isGuest) {
    toast('📱 Data is saved safely on your device! Sign in for real-time Cloud backup.', 'info');
    showAuthScreen();
    return;
  }
  toast('Syncing with cloud...', 'info');
  const res = await syncEntriesToCloud();
  const syncStatus = document.getElementById('sync-status');
  if (!res.success) {
    if (syncStatus && syncStatus.textContent === 'Rules Needed') {
      toast('⚠️ Cloud rules not published in Firebase Console yet. Data saved locally.', 'warning');
    } else {
      toast('⚠️ Cloud sync encountered an issue. Data remains safe locally.', 'warning');
    }
  } else {
    toast('Cloud backup synced! ☁️', 'success');
  }
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
