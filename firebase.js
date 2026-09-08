/* =====================================================================
 * POCKETTRACK — FIREBASE CLIENT & PERSISTENCE INITIALIZATION
 * =====================================================================
 * FIREBASE ARCHITECTURE & CLIENT IDENTIFIERS:
 * In Google Firebase Web SDKs, the `firebaseConfig` object (including `apiKey` and `projectId`)
 * acts as client routing identifiers for Google Cloud endpoints, NOT secret administrative keys.
 * 
 * SECURITY MODEL:
 * 1. Zero-Trust Client: Data access is strictly guarded server-side by Firestore Security Rules
 *    (`firestore.rules`), which enforce authenticated per-user matching:
 *    `request.auth != null && request.auth.uid == userId` with default deny.
 * 2. Unauthorized or unauthenticated reads/writes are blocked by Google's servers.
 * 3. Guest Mode: Runs 100% locally. Zero telemetry, zero analytics SDKs, zero cloud transmission.
 * ===================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCxs1ltKht43N9JuwAIKymk0drlGsjxCvM",
  authDomain: "pockettrack-23776.firebaseapp.com",
  projectId: "pockettrack-23776",
  storageBucket: "pockettrack-23776.firebasestorage.app",
  messagingSenderId: "376126656745",
  appId: "1:376126656745:web:58a906c7a272d058d6e078"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Offline-first IndexedDB persistence state
window.offlinePersistenceState = { enabled: false, ready: false };

function showPersistenceWarningNotice(code) {
  const syncEl = document.getElementById('sync-status');
  if (syncEl) {
    if (code === 'failed-precondition') {
      syncEl.title = 'Multiple tabs open: cloud changes are cached in-memory for this tab until reload.';
    } else if (code === 'unimplemented') {
      syncEl.title = 'Private browsing mode: cloud caching is in-memory for this session.';
    }
  }
}
window.showPersistenceWarningNotice = showPersistenceWarningNotice;

db.enablePersistence({ synchronizeTabs: true }).then(() => {
  window.offlinePersistenceState = { enabled: true, ready: true };
}).catch(err => {
  window.offlinePersistenceState = { enabled: false, ready: true, code: err.code, message: err.message };
  if (err.code === 'failed-precondition') {
    console.info('Offline persistence: multiple tabs open — using tab in-memory cache.');
  } else if (err.code === 'unimplemented') {
    console.info('Offline persistence: browser storage restrictions — using in-memory cache.');
  } else {
    console.warn('Offline persistence notice:', err.message);
  }
  
  setTimeout(() => {
    showPersistenceWarningNotice(err.code);
  }, 1000);
});
