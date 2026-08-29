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

function computeSyncLabel() {
  if (!navigator.onLine) {
    return currentLang === 'hi' ? '📴 ऑफ़लाइन' : '📴 Offline';
  }
  if (isAnyWritePending()) {
    return currentLang === 'hi' ? '⏳ सिंक हो रहा है…' : '⏳ Syncing…';
  }
  return currentLang === 'hi' ? '✅ सिंक' : '✅ Synced';
}

function computeSyncDetail() {
  if (!navigator.onLine) {
    return currentLang === 'hi' 
      ? 'ऑफ़लाइन हैं — सभी बदलाव सुरक्षित हैं, कनेक्ट होते ही सिंक होंगे' 
      : 'Offline — all changes are cached locally and will sync when reconnected';
  }
  if (isAnyWritePending()) {
    const pendingSystems = Object.keys(pendingWriteState).filter(k => pendingWriteState[k]);
    return currentLang === 'hi' 
      ? `क्लाउड पर सिंक हो रहा है (${pendingSystems.join(', ')})…` 
      : `Syncing pending changes to cloud (${pendingSystems.join(', ')})…`;
  }
  return currentLang === 'hi' ? 'सब कुछ क्लाउड से सिंक है' : 'All systems synced to the cloud';
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

