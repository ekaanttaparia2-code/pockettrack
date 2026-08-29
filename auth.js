/* Authentication flows and signed-in state handling. */

function setAuthButtonsLoading(isLoading){
  const loginBtn=document.getElementById('auth-login-btn');
  const signupBtn=document.getElementById('auth-signup-btn');
  [loginBtn, signupBtn].forEach(btn=>{
    btn.disabled = isLoading;
    btn.style.opacity = isLoading ? '0.6' : '1';
    btn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
  });
}

function authAction(mode){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  const errEl=document.getElementById('auth-error');
  errEl.style.display='none';
  if(!email||!pass||pass.length<6){
    errEl.textContent = currentLang==='hi' ? 'सही ईमेल और कम से कम 6 अक्षरों का पासवर्ड डालें।' : 'Enter a valid email and a password with 6+ characters.';
    errEl.style.display='block';
    return;
  }
  setAuthButtonsLoading(true);
  const action = mode==='login'
    ? auth.signInWithEmailAndPassword(email,pass)
    : auth.createUserWithEmailAndPassword(email,pass);
  action.then(cred=>{
    if(mode==='signup' && cred.user && !cred.user.emailVerified){
      cred.user.sendEmailVerification().catch(e=>console.log('Verification email failed:',e));
    }
  }).catch(err=>{
    errEl.textContent=err.message;
    errEl.style.display='block';
  }).finally(()=>{
    setAuthButtonsLoading(false);
  });
}

function handleForgotPassword(){
  const email=document.getElementById('auth-email').value.trim();
  const errEl=document.getElementById('auth-error');
  errEl.style.display='none';
  if(!email){
    errEl.textContent = currentLang==='hi' ? 'पासवर्ड रीसेट लिंक पाने के लिए पहले अपना ईमेल डालें।' : 'Enter your email above first to get a reset link.';
    errEl.style.display='block';
    return;
  }
  auth.sendPasswordResetEmail(email).then(()=>{
    toast(currentLang==='hi' ? 'पासवर्ड रीसेट लिंक आपके ईमेल पर भेज दिया गया है' : 'Password reset link sent to your email', 'success');
  }).catch(err=>{
    errEl.textContent=err.message;
    errEl.style.display='block';
  });
}

function signInWithGoogle(){
  const errEl=document.getElementById('auth-error');
  errEl.style.display='none';
  const btn=document.getElementById('auth-google-btn');
  const originalHTML=btn.innerHTML;
  btn.disabled=true;
  btn.style.opacity='0.6';
  btn.innerHTML='<span class="mini-spinner"></span>';
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err=>{
    if(err.code==='auth/popup-blocked' || err.code==='auth/cancelled-popup-request'){
      auth.signInWithRedirect(provider);
      return;
    }
    if(err.code!=='auth/popup-closed-by-user'){
      errEl.textContent=err.message;
      errEl.style.display='block';
    }
  }).finally(()=>{
    btn.disabled=false;
    btn.style.opacity='1';
    btn.innerHTML=originalHTML;
  });
}

function logOut(){
  showAppConfirm(currentLang==='hi'?'क्या आप लॉग आउट करना चाहते हैं?':'Log out?', ()=>{
    if(unsubscribeEntries) unsubscribeEntries();
    if(unsubscribeEvents) unsubscribeEvents();
    if(typeof resetLedgerLocal==='function') resetLedgerLocal();
    if(typeof resetRecurringLocal==='function') resetRecurringLocal();
    auth.signOut();
  });
}

function startGuestSandboxMode(){
  window.isGuestMode = true;
  currentUser = { uid: 'guest_sandbox_user', email: 'guest@pockettrack.local', isAnonymous: true, isGuest: true };
  const authScreen = document.getElementById('auth-screen');
  const guestBanner = document.getElementById('guest-mode-banner');
  if (authScreen) authScreen.style.display = 'none';
  if (guestBanner) guestBanner.style.display = 'block';

  // If no entries exist yet, populate starter demo data
  if (!entries || entries.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const d1 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const d2 = new Date(Date.now() - 172800000).toISOString().slice(0, 10);
    const d3 = new Date(Date.now() - 345600000).toISOString().slice(0, 10);
    entries = [
      { _id: 'demo_1', type: 'income', amt: 45000, label: 'Monthly Salary', cat: 'income', date: d3, walletId: 'bank' },
      { _id: 'demo_2', type: 'expense', amt: 1450, label: 'Supermarket Groceries', cat: 'food', date: d2, walletId: 'card' },
      { _id: 'demo_3', type: 'expense', amt: 500, label: 'Petrol Fuel', cat: 'travel', date: d1, walletId: 'cash' },
      { _id: 'demo_4', type: 'expense', amt: 850, label: 'Weekend Dinner with Friends', cat: 'food', date: today, walletId: 'bank' }
    ];
    if (typeof window !== 'undefined') window.entries = entries;
    try { localStorage.setItem('pockettrack_entries', JSON.stringify(entries)); } catch(e){}
  }

  updateBottomBarVisibility();
  if (typeof setTab === 'function') setTab('log');
  if (typeof updateHeaderStats === 'function') updateHeaderStats();
  if (typeof renderHomeSnapshot === 'function') renderHomeSnapshot();
  if (typeof renderHomeContextualNudge === 'function') renderHomeContextualNudge();
  toast(currentLang === 'hi' ? 'गैस्ट सैंडबॉक्स मोड सक्रिय — परीक्षण करें!' : 'Guest Sandbox Mode active — feel free to explore!', 'success');
}
window.startGuestSandboxMode = startGuestSandboxMode;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('guest') === 'true' || localStorage.getItem('pockettrack_sandbox_mode') === 'true') {
        localStorage.removeItem('pockettrack_sandbox_mode');
        setTimeout(() => {
          if (!currentUser && typeof startGuestSandboxMode === 'function') {
            startGuestSandboxMode();
          }
        }, 150);
      }
    } catch(e) {}
  });
}

function showAuthScreen(){
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'flex';
  updateBottomBarVisibility();
}
window.showAuthScreen = showAuthScreen;

function purgeAllUserData(){
  const msg = (typeof currentLang !== 'undefined' && currentLang === 'hi')
    ? 'क्या आप अपना सारा डेटा हमेशा के लिए हटाना चाहते हैं? यह क्रिया वापस नहीं ली जा सकती।'
    : 'Are you sure you want to permanently wipe all transactions, budgets, wallets, and ledger balances? This cannot be undone.';
  
  if (typeof showAppConfirm === 'function') {
    showAppConfirm(msg, () => {
      executeDataPurge();
    }, 'Purge All Data');
  } else if (confirm(msg)) {
    executeDataPurge();
  }
}
window.purgeAllUserData = purgeAllUserData;

function executeDataPurge(){
  entries = [];
  if (typeof window !== 'undefined') window.entries = entries;
  events = [];
  try {
    localStorage.removeItem('pockettrack_entries');
    localStorage.removeItem('pockettrack_events');
    localStorage.removeItem('pockettrack_wallets');
    localStorage.removeItem('pockettrack_budgets');
    localStorage.removeItem('pockettrack_ledger');
    localStorage.removeItem('pockettrack_recurring');
  } catch(e){}
  
  if (currentUser && !currentUser.isGuest && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid).collection('entries').get().then(snap => {
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      return batch.commit();
    }).catch(e => console.log('Cloud purge error:', e));
  }

  if (typeof updateHeaderStats === 'function') updateHeaderStats();
  if (typeof renderHomeSnapshot === 'function') renderHomeSnapshot();
  if (typeof renderEntries === 'function') renderEntries();
  if (typeof renderSimpleModePassbook === 'function') renderSimpleModePassbook();
  toast(currentLang === 'hi' ? 'सारा डेटा सफलतापूर्वक हटा दिया गया है' : 'All data permanently purged', 'success');
}
window.executeDataPurge = executeDataPurge;

function updateBottomBarVisibility(){
  const bar = document.getElementById('bottom-tab-bar');
  const voiceFab = document.getElementById('voice-fab');
  const authScreen = document.getElementById('auth-screen');
  const isAuthVisible = authScreen && authScreen.style.display !== 'none';
  const shouldShow = ((currentUser !== null || window.isGuestMode) && !isAuthVisible);
  if (bar) bar.style.display = shouldShow ? 'flex' : 'none';
  if (voiceFab) voiceFab.style.display = shouldShow ? 'flex' : 'none';
  if (document.body) document.body.classList.toggle('auth-active', !shouldShow);
}
window.updateBottomBarVisibility = updateBottomBarVisibility;

if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged(user=>{
  if(user){
    currentUser=user;
    window.isGuestMode = false;
    const guestBanner = document.getElementById('guest-mode-banner');
    if (guestBanner) guestBanner.style.display = 'none';
    document.getElementById('auth-screen').style.display='none';
    updateBottomBarVisibility();
    if(typeof updateSyncIndicator==='function') updateSyncIndicator();
    else document.getElementById('sync-status').textContent = (typeof currentLang!=='undefined' && currentLang==='hi') ? 'क्लाउड से जुड़ा' : 'Synced to cloud';
    listenToEntries();
    listenToEvents();
    if(typeof listenToLedger === 'function') listenToLedger();
    if(typeof listenToRecurring === 'function') listenToRecurring();
    if(typeof updateVoiceFabVisibility === 'function') updateVoiceFabVisibility();
    if(typeof updateAIWidgetVisibility === 'function') updateAIWidgetVisibility();
    loadBudget();
    if(typeof db!=='undefined' && typeof PT_STORE!=='undefined'){
      db.collection('users').doc(user.uid).get().then(snap=>{
        const pro = !!(snap.exists && snap.data().pro === true);
        if(pro) localStorage.setItem(PT_STORE.pro,'1');
        else if(snap.exists) localStorage.removeItem(PT_STORE.pro);
        if(typeof renderProTab==='function') renderProTab();
        if(typeof ptSyncGates==='function') ptSyncGates();
      }).catch(()=>{});
    }
    document.getElementById('verify-banner').style.display = user.emailVerified ? 'none' : 'block';
    if (!localStorage.getItem('pockettrack_age_group') && !localStorage.getItem('pockettrack_app_mode_chosen')) {
      setTimeout(() => {
        if (typeof window.openAgeModeModal === 'function') {
          window.openAgeModeModal();
        }
      }, 400);
    }
  } else {
    if (!window.isGuestMode) {
      currentUser=null;
      document.getElementById('auth-screen').style.display='flex';
      if(typeof updateBottomBarVisibility==='function') updateBottomBarVisibility();
      if(unsubscribeEntries) unsubscribeEntries();
      if(unsubscribeEvents) unsubscribeEvents();
      if(typeof updateVoiceFabVisibility === 'function') updateVoiceFabVisibility();
      if(typeof updateAIWidgetVisibility === 'function') updateAIWidgetVisibility();
      entries=[];
      if(typeof window !== 'undefined') window.entries = entries;
      if(typeof resetLedgerLocal==='function') resetLedgerLocal();
      if(typeof resetRecurringLocal==='function') resetRecurringLocal();
      if(typeof pendingWriteState!=='undefined'){ pendingWriteState.entries=false; pendingWriteState.events=false; }
      events=[];
      weeklyBudget=0;
    }
  }
  });
}

function resendVerification(){
  if(!currentUser)return;
  currentUser.sendEmailVerification().then(()=>{
    toast(currentLang==='hi' ? 'सत्यापन ईमेल फिर से भेजा गया' : 'Verification email sent again', 'success');
  }).catch(e=>{
    toast('Could not send: '+e.message, 'error');
  });
}
