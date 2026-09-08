/* PocketTrack Offline-First status (Phase 2)
   Firestore's own IndexedDB persistence (enabled in firebase.js) already handles
   the hard parts: local cache, write queue, auto-reconnect sync, and duplicate-write
   protection (client-generated doc IDs mean a queued .add() never double-inserts).
   This file accurately tracks all 8 client write subsystems:
   - entries, events, ledger, recurring, goals, rewards, settings, budgets. */

const pendingWriteState = {
  entries: false,
  events: false,
  ledger: false,
  recurring: false,
  goals: false,
  rewards: false,
  settings: false,
  budgets: false
};
window.pendingWriteState = pendingWriteState;

function trackPendingWrite(system, isPending) {
  if (system in pendingWriteState) {
    pendingWriteState[system] = Boolean(isPending);
    updateSyncIndicator();
  }
}
window.trackPendingWrite = trackPendingWrite;

function isAnyWritePending() {
  return Object.values(pendingWriteState).some(Boolean);
}
window.isAnyWritePending = isAnyWritePending;

window.currentLang = window.currentLang || 'en';

function getAppLang() {
  if (typeof window !== 'undefined' && window.currentLang) return window.currentLang;
  if (typeof currentLang !== 'undefined') return currentLang;
  return 'en';
}

function computeSyncLabel() {
  const lang = getAppLang();
  if (!navigator.onLine) {
    return lang === 'hi' ? '📴 ऑफ़लाइन' : '📴 Offline';
  }
  if (isAnyWritePending()) {
    return lang === 'hi' ? '⏳ सिंक हो रहा है…' : '⏳ Syncing…';
  }
  return lang === 'hi' ? '✅ सिंक' : '✅ Synced';
}

function computeSyncDetail() {
  const lang = getAppLang();
  let detail = '';
  if (!navigator.onLine) {
    detail = lang === 'hi' 
      ? 'ऑफ़लाइन हैं — सभी बदलाव सुरक्षित हैं, कनेक्ट होते ही सिंक होंगे' 
      : 'Offline — all changes are cached locally and will sync when reconnected';
  } else if (isAnyWritePending()) {
    const pendingSystems = Object.keys(pendingWriteState).filter(k => pendingWriteState[k]);
    detail = lang === 'hi' 
      ? `क्लाउड पर सिंक हो रहा है (${pendingSystems.join(', ')})…` 
      : `Syncing pending changes to cloud (${pendingSystems.join(', ')})…`;
  } else {
    detail = lang === 'hi' ? 'सब कुछ क्लाउड से सिंक है' : 'All systems synced to the cloud';
  }

  if (window.offlinePersistenceState && window.offlinePersistenceState.code === 'failed-precondition') {
    detail += ' (Multi-tab: in-memory cache active)';
  }
  return detail;
}

function updateSyncIndicator() {
  const el = document.getElementById('sync-status');
  if (!el || !currentUser) return;
  el.textContent = computeSyncLabel();
  el.title = computeSyncDetail();
  const pill = el.closest('.pill');
  if (pill) {
    pill.classList.toggle('pill-offline', !navigator.onLine);
    pill.classList.toggle('pill-syncing', navigator.onLine && isAnyWritePending());
  }
}
window.updateSyncIndicator = updateSyncIndicator;

window.addEventListener('online', updateSyncIndicator);
window.addEventListener('offline', updateSyncIndicator);

