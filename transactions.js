/* Transaction syncing, entry management, and transaction-list UI. */

function updateHeaderStats(){
  const list = mainEntries();
  const income=list.filter(e=>e.type==='income').reduce((s,e)=>s+e.amt,0);
  const spent=list.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amt,0);
  const balance=income-spent;

  if (typeof animateNumber === 'function') {
    animateNumber('hdr-income', income);
    animateNumber('hdr-spent', spent);
    animateNumber('hdr-balance', balance);
    animateNumber('hdr-count', list.length, '', '');
    animateNumber('hero-income', income);
    animateNumber('hero-spent', spent);
    animateNumber('hero-count', list.length, '', '');
  } else {
    document.getElementById('hdr-income').textContent='₹'+income;
    document.getElementById('hdr-spent').textContent='₹'+spent;
    document.getElementById('hdr-balance').textContent='₹'+balance;
    document.getElementById('hdr-count').textContent=list.length;
    const heroIncome=document.getElementById('hero-income');
    const heroSpent=document.getElementById('hero-spent');
    const heroCount=document.getElementById('hero-count');
    if(heroIncome)heroIncome.textContent='₹'+income;
    if(heroSpent)heroSpent.textContent='₹'+spent;
    if(heroCount)heroCount.textContent=list.length;
  }
  renderHomeSnapshot();
}

function renderHomeSnapshot(){
  const wrap=document.getElementById('home-recent-activity');
  const insight=document.getElementById('home-insight-text');
  if(!wrap)return;
  const list=mainEntries().slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,5);
  if(!list.length){
    wrap.innerHTML='<div class="empty-mini"><i class="ti ti-sparkles"></i><span>'+(currentLang==='hi'?'अपनी पहली आय या खर्च से शुरुआत करें।':'Start with your first income or expense.')+'</span></div>';
    if(insight)insight.textContent=currentLang==='hi'?'कुछ एंट्रीज़ के बाद PocketTrack यहां उपयोगी पैटर्न दिखाना शुरू करेगा।':'Once you have a few entries, PocketTrack will start surfacing useful patterns here.';
    return;
  }
  wrap.innerHTML=list.map(e=>{
    const income=e.type==='income';
    const label=displayCatLabel(e);
    const title=e.label||label||'Entry';
    const date=e.date||'';
    const wBadge = (typeof getWalletBadgeHtml === 'function') ? getWalletBadgeHtml(e.walletId) : '';
    return `<div class="home-entry-row">
      <span class="home-entry-icon ${income?'income':'expense'}"><i class="ti ${income?'ti-arrow-down-left':'ti-arrow-up-right'}"></i></span>
      <div class="home-entry-main"><strong>${escapeHTML(title)} ${wBadge}</strong><span>${escapeHTML(label)} · ${escapeHTML(date)}</span></div>
      <strong class="home-entry-amt ${income?'income':'expense'}">${income?'+':'−'}₹${Number(e.amt||0).toLocaleString('en-IN')}</strong>
    </div>`;
  }).join('');

  if(insight){
    const expenses=mainEntries().filter(e=>e.type==='expense');
    const totals={};
    expenses.forEach(e=>{const key=displayCatLabel(e)||'Other';totals[key]=(totals[key]||0)+Number(e.amt||0);});
    const top=Object.entries(totals).sort((a,b)=>b[1]-a[1])[0];
    if(top){
      const total=expenses.reduce((sum,e)=>sum+Number(e.amt||0),0);
      const pct=total?Math.round((top[1]/total)*100):0;
      insight.textContent=currentLang==='hi'?`${top[0]} अभी आपका सबसे बड़ा खर्च क्षेत्र है — कुल ट्रैक किए गए खर्च का ${pct}%.`:`${top[0]} is your biggest spending area so far — ${pct}% of tracked expenses.`;
    }else{
      insight.textContent=currentLang==='hi'?'अच्छी शुरुआत। लॉग करते रहें और PocketTrack आपकी गतिविधि से उपयोगी पैटर्न निकालेगा।':'Nice start. Keep logging and PocketTrack will turn your activity into useful patterns.';
    }
  }
}

let composerMode='expense';
let composerSelection='food';
let composerWallet='cash';

function selectComposerWallet(btn, value){
  composerWallet = value;
  const group = btn.closest('.composer-chips');
  group?.querySelectorAll('.composer-chip').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
}

function openQuickComposer(mode='expense'){
  composerMode=mode==='income'?'income':'expense';
  const backdrop=document.getElementById('transaction-composer-backdrop');
  if(!backdrop)return;
  document.getElementById('composer-amount').value='';
  document.getElementById('composer-date').value=todayStr();
  document.getElementById('composer-note').value='';
  composerWallet = (typeof activeWalletId !== 'undefined' && activeWalletId !== 'all') ? activeWalletId : (mode === 'income' ? 'bank' : 'cash');
  document.querySelectorAll('#composer-wallet-chips .composer-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.wallet === composerWallet);
  });
  setComposerMode(composerMode);
  backdrop.style.display='flex';
  document.body.classList.add('composer-open');
  setTimeout(()=>document.getElementById('composer-amount')?.focus(),180);
}

function closeTransactionComposer(){
  const backdrop=document.getElementById('transaction-composer-backdrop');
  if(backdrop)backdrop.style.display='none';
  document.body.classList.remove('composer-open');
}

function setComposerMode(mode){
  composerMode=mode==='income'?'income':'expense';
  const expenseTab=document.getElementById('composer-expense-tab');
  const incomeTab=document.getElementById('composer-income-tab');
  const expenseFields=document.getElementById('composer-expense-fields');
  const incomeFields=document.getElementById('composer-income-fields');
  const save=document.getElementById('composer-save');
  const sub=document.getElementById('composer-subtitle');
  expenseTab?.classList.toggle('active',composerMode==='expense');
  incomeTab?.classList.toggle('active',composerMode==='income');
  if(expenseFields)expenseFields.style.display=composerMode==='expense'?'block':'none';
  if(incomeFields)incomeFields.style.display=composerMode==='income'?'block':'none';
  if(save)save.innerHTML=(composerMode==='expense'?'Save expense':'Save income')+' <span>→</span>';
  if(sub)sub.textContent=composerMode==='expense'?'Add it in a few taps.':'Capture money coming in just as quickly.';
  composerSelection=composerMode==='expense'?'food':'Salary';
  document.querySelectorAll('#composer-expense-fields .composer-chip, #composer-income-fields .composer-chip').forEach(btn=>btn.classList.toggle('active', (composerMode==='expense'&&btn.dataset.cat===composerSelection)||(composerMode==='income'&&btn.dataset.source===composerSelection)));
}

function selectComposerChip(btn,value){
  composerSelection=value;
  const group=btn.closest('.composer-chips');
  group?.querySelectorAll('.composer-chip').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
}

async function submitTransactionComposer(){
  if(!currentUser){toast(currentLang==='hi'?'पहले साइन इन करें':'Please sign in first','error');return;}
  const amt=parseFloat(document.getElementById('composer-amount')?.value);
  const date=document.getElementById('composer-date')?.value||todayStr();
  const note=(document.getElementById('composer-note')?.value||'').trim().slice(0,60);
  if(!isValidAmount(amt)){toast(TT('enter_valid_amount'),'error');return;}
  if(!isValidDate(date)){toast(TT('enter_valid_date'),'error');return;}
  if(!currentUser.emailVerified && (!currentUser.providerData || currentUser.providerData[0].providerId !== 'google.com') && entries.length >= 10){
    showAppAlert(currentLang==='hi'?'सीमा पूरी हुई':'Limit Reached',currentLang==='hi'?'अपनी एंट्रीज़ जोड़ना जारी रखने के लिए अपना ईमेल सत्यापित करें।':"Verify your email to continue adding entries.");
    return;
  }
  const btn=document.getElementById('composer-save');
  if(btn)btn.disabled=true;
  try{
    let payload,offer;
    const chosenWallet = composerWallet || ((typeof activeWalletId !== 'undefined' && activeWalletId !== 'all') ? activeWalletId : (composerMode === 'income' ? 'bank' : 'cash'));
    if(composerMode==='expense'){
      const labels={food:'Food & snacks',travel:'Travel/Convenience',friends:'Friends plan',home:'Household items',shopping:'Shopping',other:'Other'};
      const label=note||labels[composerSelection]||'Expense';
      payload={type:'expense',cat:composerSelection,label,note:note||label,amt:Math.round(amt*100)/100,walletId:chosenWallet,date};
      offer={type:'expense',label,amt:payload.amt,cat:composerSelection};
    }else{
      const label=note||composerSelection||'Income';
      payload={type:'income',cat:'income',label,note:note||label,amt:Math.round(amt*100)/100,walletId:chosenWallet,date};
      offer={type:'income',label,amt:payload.amt,cat:'income'};
    }
    const guardFn = (typeof maybeGuardAndSaveWithSmartEngine === 'function') ? maybeGuardAndSaveWithSmartEngine : maybeGuardAndSave;
    await guardFn(payload, async()=>{
      await saveEntry(payload);
      if (typeof renderWalletSwitcher === 'function') renderWalletSwitcher();
      if(composerMode==='expense'){
        checkBudget();showSpendMoodToast(payload.amt);
        toast(TT('expense_added'),'success');
      }else{
        toast(TT('income_added'),'success');
      }
      if(typeof maybeOfferRecurring==='function') maybeOfferRecurring(offer);
      closeTransactionComposer();
    }, note || composerSelection);
  }catch(e){toast('Could not save: '+e.message,'error');}
  finally{if(btn)btn.disabled=false;}
}

function goMoreHub(){
  openCommandHubModal();
}

function openCommandHubModal(){
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  const modal = document.createElement('div');
  modal.id = 'command-hub-modal-backdrop';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(7,4,20,0.85);backdrop-filter:blur(24px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.2s ease;';

  modal.innerHTML = `
    <div class="card" style="max-width:500px;width:100%;background:linear-gradient(160deg,#160f33,#0f0926);border:1px solid rgba(139,92,246,0.45);border-radius:28px;padding:26px 22px;box-shadow:0 25px 70px rgba(0,0,0,0.8);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:22px;">⚡</span>
          <div>
            <h3 style="margin:0;font-family:'Space Grotesk',sans-serif;font-size:20px;">${isHi ? 'वित्तीय कमांड हब' : 'Financial Command Hub'}</h3>
            <span style="font-size:11.5px;color:var(--text-dim,#a1a1aa);">${isHi ? 'सभी टूल्स और उन्नत नियंत्रण' : 'All Power Tools & Advanced Controls'}</span>
          </div>
        </div>
        <button onclick="closeCommandHubModal()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
        <div onclick="selectHubTool('ledger')" style="background:rgba(255,255,255,0.04);border:1px solid rgba(52,211,153,0.3);border-radius:18px;padding:16px;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="font-size:24px;margin-bottom:6px;">📑</div>
          <strong style="display:block;font-size:14px;color:#fff;">${isHi ? 'खाता (Ledger)' : 'Ledger Accounts'}</strong>
          <span style="font-size:11px;color:var(--text-dim,#a1a1aa);">${isHi ? 'मित्रों का ऋण और बकाया' : 'P2P debts & settlement'}</span>
        </div>

        <div onclick="selectHubTool('events')" style="background:rgba(255,255,255,0.04);border:1px solid rgba(139,92,246,0.3);border-radius:18px;padding:16px;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="font-size:24px;margin-bottom:6px;">👥</div>
          <strong style="display:block;font-size:14px;color:#fff;">${isHi ? 'स्पेस (Spaces)' : 'Splitwise Spaces'}</strong>
          <span style="font-size:11px;color:var(--text-dim,#a1a1aa);">${isHi ? 'ग्रुप ट्रिप और बिल बंटवारा' : 'Group trips & split bills'}</span>
        </div>

        <div onclick="selectHubTool('upi')" style="background:rgba(255,255,255,0.04);border:1px solid rgba(251,191,36,0.3);border-radius:18px;padding:16px;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="font-size:24px;margin-bottom:6px;">⚡</div>
          <strong style="display:block;font-size:14px;color:#fff;">${isHi ? 'स्मार्ट UPI लॉगर' : 'Smart UPI Logger'}</strong>
          <span style="font-size:11px;color:var(--text-dim,#a1a1aa);">${isHi ? 'पेस्ट करें और ऑटो-लॉग' : 'Paste & auto-detect'}</span>
        </div>

        <div onclick="selectHubTool('pro')" style="background:rgba(236,72,153,0.08);border:1px solid rgba(236,72,153,0.35);border-radius:18px;padding:16px;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="font-size:24px;margin-bottom:6px;">👑</div>
          <strong style="display:block;font-size:14px;color:#f472b6;">${isHi ? 'Pro और थीम' : 'Pro & Luxury Themes'}</strong>
          <span style="font-size:11px;color:var(--text-dim,#a1a1aa);">${isHi ? 'OLED, Emerald, Sunset' : 'OLED, Emerald, Sunset'}</span>
        </div>

        <div onclick="selectHubTool('rewards')" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:16px;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="font-size:24px;margin-bottom:6px;">🏆</div>
          <strong style="display:block;font-size:14px;color:#fff;">${isHi ? 'रिवॉर्ड्स और बैज' : 'Rewards & Badges'}</strong>
          <span style="font-size:11px;color:var(--text-dim,#a1a1aa);">${isHi ? 'स्ट्रीक पॉइंट्स और छूट' : 'Streak points & perks'}</span>
        </div>

        <div onclick="selectHubTool('language')" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:16px;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="font-size:24px;margin-bottom:6px;">🌐</div>
          <strong style="display:block;font-size:14px;color:#fff;">${isHi ? 'भाषा (Language)' : 'Language & Region'}</strong>
          <span style="font-size:11px;color:var(--text-dim,#a1a1aa);">${isHi ? 'हिंदी, English + 6 और' : 'Hindi, English + 6 more'}</span>
        </div>
      </div>

      <div style="display:flex;gap:10px;">
        <button class="btn danger" onclick="closeCommandHubModal();logOut();" style="flex:1;padding:12px;font-size:13px;">
          <i class="ti ti-logout"></i> ${isHi ? 'लॉग आउट' : 'Sign Out'}
        </button>
        <button class="btn" onclick="closeCommandHubModal();" style="flex:1;padding:12px;font-size:13px;">
          ${isHi ? 'बंद करें' : 'Close'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeCommandHubModal(){
  const modal = document.getElementById('command-hub-modal-backdrop');
  if(modal) modal.remove();
}

function selectHubTool(tabName){
  closeCommandHubModal();
  setTab(tabName);
}

function listenToEntries(){
  if(!currentUser) return;
  unsubscribeEntries = db.collection('users').doc(currentUser.uid).collection('entries')
    .onSnapshot({includeMetadataChanges:true}, snap=>{
      entries = snap.docs.map(d=>({...d.data(), _id:d.id}));
      if(typeof pendingWriteState!=='undefined') pendingWriteState.entries = !!snap.metadata && snap.metadata.hasPendingWrites;
      if(typeof updateSyncIndicator==='function') updateSyncIndicator();
      renderEntries();
      renderReport();
      if(typeof renderSubscriptionRadar==='function') renderSubscriptionRadar();
      updateHeaderStats();
      checkBudget();
      refreshEventsViewsIfOpen();
      renderStreak();
      renderQuickAdd();
      if(typeof checkEntryLimit !== 'undefined') checkEntryLimit();
    }, err=>{
      console.error(err);
      document.getElementById('sync-status').textContent = (typeof currentLang!=='undefined' && currentLang==='hi') ? 'सिंक त्रुटि — कनेक्शन जांचें' : 'Sync error — check connection';
    });
}

// --- Quick-add: surfaces your 4 most-repeated exact entries as one-tap chips ---
function renderQuickAdd(){
  const card=document.getElementById('quick-add-card');
  const wrap=document.getElementById('quick-add-chips');
  if(!card||!wrap)return;
  const list=mainEntries().filter(e=>e.type==='expense');
  if(list.length<3){ card.style.display='none'; return; }
  const counts={};
  list.forEach(e=>{
    const key=e.cat+'|'+e.label.toLowerCase()+'|'+e.amt;
    if(!counts[key]) counts[key]={count:0,cat:e.cat,label:e.label,amt:e.amt};
    counts[key].count++;
  });
  const top = Object.values(counts).filter(c=>c.count>=2).sort((a,b)=>b.count-a.count).slice(0,4);
  if(!top.length){ card.style.display='none'; return; }
  card.style.display='block';
  wrap.innerHTML = top.map((t,i)=>`
    <button class="quick-chip" data-qidx="${i}">
      <span>${escapeHTML(t.label)}</span><span class="chip-amt">₹${t.amt}</span>
    </button>`).join('');
  wrap.querySelectorAll('.quick-chip').forEach(btn=>{
    const i=Number(btn.dataset.qidx);
    btn.addEventListener('click', ()=>quickAddExpense(top[i].cat, top[i].label, top[i].amt));
  });
}

async function quickAddExpense(cat, label, amt){
  try{
    await saveEntry({type:'expense',cat,label,amt,date:todayStr()});
    toast(TT('expense_added'),'success');
    checkBudget();
    showSpendMoodToast(amt);
    if(typeof maybeOfferRecurring==='function') maybeOfferRecurring({type:'expense',label:String(label||''),amt,cat});
  }catch(e){toast('Could not save: '+e.message,'error');}
}

// --- Spending mood: light, non-judgmental feedback comparing an expense to your own average ---
function showSpendMoodToast(amt){
  const expenses=mainEntries().filter(e=>e.type==='expense');
  if(expenses.length<4)return; // not enough history for a meaningful average yet
  const avg = expenses.reduce((s,e)=>s+e.amt,0)/expenses.length;
  if(amt > avg*1.5){
    toast(currentLang==='hi' ? '😬 यह आपके औसत से काफी ज्यादा है' : "😬 That's well above your usual spend", 'info');
  } else if(amt < avg*0.5){
    toast(currentLang==='hi' ? '👍 बढ़िया, यह आपके औसत से कम है' : '👍 Nice, that\'s below your usual spend', 'info');
  }
}

function refreshEventsViewsIfOpen(){
  const eventsTab=document.getElementById('tab-events');
  if(!eventsTab || eventsTab.style.display==='none')return;
  if(currentEventId){ renderEventDetail(); }
  else if(document.getElementById('events-list-view').style.display!=='none'){ renderEventsList(); }
}



async function saveEntry(entry){
  if(!currentUser){toast(TT('not_logged_in'),'error');return;}
  await db.collection('users').doc(currentUser.uid).collection('entries').add(entry);
}

/* --- Smart duplicate guard: same amount + similar label within 3 days --- */
function _dupNorm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g,'');}
function _dupUTC(d){return Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10));}

function findDuplicateEntry(payload){
  try{
    if(!Array.isArray(entries)||!entries.length)return null;
    const amt=Math.round((Number(payload.amt)||0)*100)/100;
    if(!(amt>0))return null;
    const tLabel=_dupNorm(payload.label);
    const tNote=_dupNorm(payload.note);
    const target=tLabel.length>=3?tLabel:tNote;
    if(target.length<3)return null;
    const today=todayStr();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(today))return null;
    const tNow=_dupUTC(today);
    let best=null,bestDelta=1e9;
    for(const e of entries){
      if((e.type||'expense')!==payload.type)continue;
      if(Math.round((Number(e.amt)||0)*100)/100!==amt)continue;
      if(!e.date||!/^\d{4}-\d{2}-\d{2}$/.test(e.date))continue;
      const dd=Math.round((tNow-_dupUTC(e.date))/86400000);
      if(dd<0||dd>3)continue;
      const eLabel=_dupNorm(e.label);
      const hay=(eLabel+' '+_dupNorm(e.note)).trim();
      if(!(hay.includes(target)||(eLabel.length>=3&&target.includes(eLabel))))continue;
      if(dd<bestDelta){best=e;bestDelta=dd;}
    }
    return best;
  }catch(err){return null;}
}

function maybeGuardAndSave(payload,doSave){
  const run=()=>Promise.resolve(doSave()).catch(e=>toast('Could not save: '+e.message,'error'));
  const dup=findDuplicateEntry(payload);
  if(!dup){run();return;}
  const isHi=currentLang==='hi';
  const dd=Math.max(0,Math.round((_dupUTC(todayStr())-_dupUTC(dup.date))/86400000));
  const when=isHi?(dd===0?'आज ही':dd===1?'कल':dd+' दिन पहले'):(dd===0?'earlier today':dd===1?'yesterday':dd+' days ago');
  showAppConfirm(
    isHi?`⚠️ "${dup.label}" ₹${dup.amt} ${when} दर्ज हो चुका है। फिर से जोड़ें?`
        :`⚠️ "${dup.label}" ₹${dup.amt} was already logged ${when}. Add it again?`,
    run
  );
}

async function updateEntry(id, entry){
  if(!currentUser){toast(TT('not_logged_in'),'error');return;}
  await db.collection('users').doc(currentUser.uid).collection('entries').doc(id).update(entry);
}

async function removeEntry(id){
  if(!currentUser) return;
  await db.collection('users').doc(currentUser.uid).collection('entries').doc(id).delete();
}

document.getElementById('inc-date').value=todayStr();
document.getElementById('exp-date').value=todayStr();

let editingId=null; // set when editing an existing entry instead of adding new

async function addIncome(){
  await withButtonLoading('add-income-btn', async ()=>{
    if(!editingId && currentUser && !currentUser.emailVerified && (!currentUser.providerData || currentUser.providerData[0].providerId !== 'google.com') && entries.length >= 10){
      showAppAlert(currentLang==='hi'?'सीमा पूरी हुई':'Limit Reached', currentLang==='hi'?'अपनी एंट्रीज़ जोड़ना जारी रखने के लिए अपना ईमेल सत्यापित करें। आपने अपनी सभी 10 मुफ़्त एंट्रीज़ का उपयोग कर लिया है।':"Verify your email to continue adding entries. You've used all 10 free entries.");
      return;
    }
    let src=document.getElementById('inc-src').value;
    let isNewCustom=false;
    if(src==='__add_new__'){
      const custom=document.getElementById('inc-custom').value.trim().slice(0,40);
      if(!custom){toast(TT('give_source_name'),'error');return;}
      src=custom;
      isNewCustom=true;
    }
    const amt=parseFloat(document.getElementById('inc-amt').value);
    const note=document.getElementById('inc-note').value.trim().slice(0,60);
    const date=document.getElementById('inc-date').value||todayStr();
    if(!isValidAmount(amt)){toast(TT('enter_valid_amount'),'error');return;}
    if(!note){toast(TT('add_description'),'error');return;}
    if(!isValidDate(date)){toast(TT('enter_valid_date'),'error');return;}
    const chosenW = (typeof activeWalletId !== 'undefined' && activeWalletId !== 'all') ? activeWalletId : 'bank';
    const payload={type:'income',cat:'income',label:src,note,amt:Math.round(amt*100)/100,walletId:chosenW,date};
    try{
      if(editingId){
        await updateEntry(editingId, payload);
        toast(TT('income_updated'),'success');
        cancelEdit();
      } else {
        const guardFn = (typeof maybeGuardAndSaveWithSmartEngine === 'function') ? maybeGuardAndSaveWithSmartEngine : maybeGuardAndSave;
        await guardFn(payload, async()=>{
          await saveEntry(payload);
          if (typeof renderWalletSwitcher === 'function') renderWalletSwitcher();
          toast(TT('income_added'),'success');
          if(typeof maybeOfferRecurring==='function') maybeOfferRecurring({type:'income',label:src,amt,cat:'income'});
          if(isNewCustom) saveCustomIncomeSource(src);
        }, note || src);
      }
      document.getElementById('inc-amt').value='';
      document.getElementById('inc-note').value='';
      document.getElementById('inc-custom').value='';
      document.getElementById('inc-custom-wrap').style.display='none';
    }catch(e){toast('Could not save: '+e.message,'error');}
  });
}

async function addExpense(){
  await withButtonLoading('add-expense-btn', async ()=>{
    if(!editingId && currentUser && !currentUser.emailVerified && (!currentUser.providerData || currentUser.providerData[0].providerId !== 'google.com') && entries.length >= 10){
      showAppAlert(currentLang==='hi'?'सीमा पूरी हुई':'Limit Reached', currentLang==='hi'?'अपनी एंट्रीज़ जोड़ना जारी रखने के लिए अपना ईमेल सत्यापित करें। आपने अपनी सभी 10 मुफ़्त एंट्रीज़ का उपयोग कर लिया है।':"Verify your email to continue adding entries. You've used all 10 free entries.");
      return;
    }
    let cat=document.getElementById('exp-cat').value;
    let customCat='';
    let isNewCustom=false;
    if(cat==='__add_new__'){
      customCat=document.getElementById('exp-custom').value.trim().slice(0,40);
      if(!customCat){toast(TT('give_category_name'),'error');return;}
      cat='custom';
      isNewCustom=true;
    } else if(cat.startsWith('custom:')){
      customCat=cat.slice(7);
      cat='custom';
    }
    const amt=parseFloat(document.getElementById('exp-amt').value);
    const desc=document.getElementById('exp-desc').value.trim().slice(0,60);
    const date=document.getElementById('exp-date').value||todayStr();
    if(!isValidAmount(amt)){toast(TT('enter_valid_amount'),'error');return;}
    if(!desc){toast(TT('add_description'),'error');return;}
    if(!isValidDate(date)){toast(TT('enter_valid_date'),'error');return;}
    const chosenExpW = (typeof activeWalletId !== 'undefined' && activeWalletId !== 'all') ? activeWalletId : 'cash';
    const payload={type:'expense',cat,customCat,label:desc,amt:Math.round(amt*100)/100,walletId:chosenExpW,date};
    try{
      if(editingId){
        await updateEntry(editingId, payload);
        toast(TT('expense_updated'),'success');
        cancelEdit();
      } else {
        const guardFn = (typeof maybeGuardAndSaveWithSmartEngine === 'function') ? maybeGuardAndSaveWithSmartEngine : maybeGuardAndSave;
        await guardFn(payload, async()=>{
          await saveEntry(payload);
          if (typeof renderWalletSwitcher === 'function') renderWalletSwitcher();
          toast(TT('expense_added'),'success');
          checkBudget();
          showSpendMoodToast(payload.amt);
          if(typeof maybeOfferRecurring==='function') maybeOfferRecurring({type:'expense',label:desc,amt,cat});
          if(isNewCustom) saveCustomExpenseCategory(customCat);
        }, desc);
      }
      document.getElementById('exp-amt').value='';
      document.getElementById('exp-desc').value='';
      document.getElementById('exp-custom').value='';
      document.getElementById('exp-custom-wrap').style.display='none';
    }catch(e){toast('Could not save: '+e.message,'error');}
  });
}

function startEdit(id){
  const entry=entries.find(e=>e._id===id);
  if(!entry)return;
  editingId=id;
  setTab('log');

  if(entry.type==='income'){
    const srcSelect=document.getElementById('inc-src');
    const knownValues=[...srcSelect.options].map(o=>o.value).filter(v=>v!=='__add_new__');
    if(knownValues.includes(entry.label)){
      srcSelect.value=entry.label;
      document.getElementById('inc-custom-wrap').style.display='none';
    } else {
      srcSelect.value='__add_new__';
      document.getElementById('inc-custom-wrap').style.display='block';
      document.getElementById('inc-custom').value=entry.label;
    }
    document.getElementById('inc-amt').value=entry.amt;
    document.getElementById('inc-date').value=entry.date;
    document.getElementById('inc-note').value=entry.note||'';
    document.getElementById('inc-btn-label').textContent=TT('btn_update_income');
  } else {
    if(entry.cat==='custom' && entry.customCat){
      document.getElementById('exp-cat').value='__add_new__';
      document.getElementById('exp-custom-wrap').style.display='block';
      document.getElementById('exp-custom').value=entry.customCat;
    } else {
      document.getElementById('exp-cat').value=entry.cat;
      document.getElementById('exp-custom-wrap').style.display='none';
    }
    document.getElementById('exp-amt').value=entry.amt;
    document.getElementById('exp-date').value=entry.date;
    document.getElementById('exp-desc').value=entry.label;
    document.getElementById('exp-btn-label').textContent=TT('btn_update_expense');
    document.getElementById('cancel-edit-btn').style.display='inline-flex';
  }
  toast(TT('editing_entry'),'info');
}

function cancelEdit(){
  editingId=null;
  document.getElementById('inc-btn-label').textContent=TT('btn_add_income');
  document.getElementById('exp-btn-label').textContent=TT('btn_add_expense');
  document.getElementById('cancel-edit-btn').style.display='none';
  document.getElementById('inc-amt').value='';
  document.getElementById('inc-note').value='';
  document.getElementById('exp-amt').value='';
  document.getElementById('exp-desc').value='';
}

function deleteEntry(id){
  const target = entries.find(e => e._id === id);
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  showAppConfirm(isHi ? 'क्या आप इस एंट्री को हटाना चाहते हैं?' : 'Delete this entry?', async ()=>{
    try {
      if (target && target.transferPeerId) {
        await removeEntry(id);
        await removeEntry(target.transferPeerId);
        entries = entries.filter(e => e._id !== id && e._id !== target.transferPeerId);
      } else {
        await removeEntry(id);
        entries = entries.filter(e => e._id !== id);
      }
      updateHeaderStats();
      renderEntries();
      if (typeof renderHomeSnapshot === 'function') renderHomeSnapshot();
      if (typeof renderWalletSwitcher === 'function') renderWalletSwitcher();
      toast(TT('entry_deleted'),'success');
    } catch(e) {
      toast('Could not delete: '+e.message,'error');
    }
  });
}


function resetFilter(){
  document.getElementById('filter-from').value='';
  document.getElementById('filter-to').value='';
  renderEntries();
}

// "Today"/"Yesterday" for the day-group headers (falls back to fmtDate)
function friendlyDay(d){
  const today=new Date();
  const tStr=dateToStr(today);
  const yest=new Date(today); yest.setDate(today.getDate()-1);
  const yStr=dateToStr(yest);
  if(d===tStr) return currentLang==='hi'?'आज':'Today';
  if(d===yStr) return currentLang==='hi'?'कल':'Yesterday';
  return fmtDate(d);
}

function renderEntries(){
  const from=document.getElementById('filter-from').value;
  const to=document.getElementById('filter-to').value;
  const sortMode=document.getElementById('entry-sort')?document.getElementById('entry-sort').value:'date-desc';
  let list=mainEntries().map(e=>({...e}));
  if(from)list=list.filter(e=>e.date>=from);
  if(to)list=list.filter(e=>e.date<=to);
  const el=document.getElementById('entries-list');
  if(!list.length){el.innerHTML=`<p class="empty">${TT('no_entries_range')}</p>`;return;}

  // Group entries by date to compute per-day balance
  const byDate={};
  list.forEach(e=>{
    if(!byDate[e.date])byDate[e.date]={income:0,expense:0,items:[]};
    if(e.type==='income')byDate[e.date].income+=e.amt;else byDate[e.date].expense+=e.amt;
    byDate[e.date].items.push(e);
  });

  let dateKeys=Object.keys(byDate);
  if(sortMode==='date-desc')dateKeys.sort((a,b)=>b.localeCompare(a));
  else if(sortMode==='date-asc')dateKeys.sort((a,b)=>a.localeCompare(b));
  else if(sortMode==='amt-desc')dateKeys.sort((a,b)=>(byDate[b].income-byDate[b].expense)-(byDate[a].income-byDate[a].expense));
  else if(sortMode==='amt-asc')dateKeys.sort((a,b)=>(byDate[a].income-byDate[a].expense)-(byDate[b].income-byDate[b].expense));

function getWalletBadgeHtml(entry) {
  const wId = (typeof resolveEntryWalletId === 'function') ? resolveEntryWalletId(entry) : (entry.walletId || 'cash');
  if (!wId) return '';
  const wList = (typeof userWallets !== 'undefined' && userWallets.length) ? userWallets : [
    { id: 'cash', name: 'Cash', icon: '💵' },
    { id: 'bank', name: 'Bank / UPI', icon: '📱' },
    { id: 'card', name: 'Card', icon: '💳' }
  ];
  const w = wList.find(x => x.id === wId) || { name: wId, icon: '💳' };
  const cls = wId === 'cash' ? 'wallet-tag-cash' : (wId === 'bank' ? 'wallet-tag-bank' : (wId === 'card' ? 'wallet-tag-card' : ''));
  return `<span class="wallet-badge-tag ${cls}" style="margin-left:4px;">${w.icon || '💳'} ${escapeHTML(w.name)}</span>`;
}

  el.innerHTML=dateKeys.map(d=>{
    const grp=byDate[d];
    const bal=grp.income-grp.expense;
    const balColor=bal>0?'var(--green)':(bal<0?'var(--red)':'var(--text-dim)');
    const items=[...grp.items].sort((a,b)=>sortMode.startsWith('amt')?b.amt-a.amt:0);
    const rows=items.map(e=>{
      const catKey=(e.cat&&e.cat!=='income'?e.cat:'other');
      const dotColor=(typeof CAT_COLORS!=='undefined'&&CAT_COLORS[catKey])||'var(--text-faint)';
      const meta=escapeHTML(displayCatLabel(e))+(e.note?' · '+escapeHTML(e.note):'');
      const wBadge=getWalletBadgeHtml(e);
      return `
      <div class="entry-row entry-card">
        <span class="cat-dot" style="background:${dotColor};color:${dotColor}"></span>
        <div class="entry-main">
          <span class="entry-label">${escapeHTML(e.label)}${e.event?' <span class="event-tag">🎉 '+escapeHTML(e.event)+'</span>':''}${wBadge}</span>
          <span class="entry-meta">${meta}</span>
        </div>
        <span class="entry-amt ${e.type==='income'?'income':'expense'}">${e.type==='income'?'+':'-'}₹${e.amt}</span>
        <div class="row-actions">
          <button class="icon-btn" onclick="startEdit('${e._id}')" aria-label="edit">✏️</button>
          <button class="icon-btn" onclick="deleteEntry('${e._id}')" aria-label="delete">🗑️</button>
        </div>
      </div>`;
    }).join('');
    const dLabel=(typeof friendlyDay==='function')?friendlyDay(d):fmtDate(d);
    return `
      <div class="day-group">
        <div class="day-group-head">
          <span class="day-group-title">${dLabel}</span>
          <span class="day-group-bal" style="color:${balColor}">${bal>=0?'+':'-'}₹${Math.abs(bal)}</span>
        </div>
        ${rows}
      </div>`;
  }).join('');
}

function checkEntryLimit(){
  const banner = document.getElementById('limit-banner');
  if(!banner) return;
  if(!currentUser) { banner.style.display='none'; return; }
  const isGoogle = currentUser.providerData && currentUser.providerData[0].providerId === 'google.com';
  if(!isGoogle && !currentUser.emailVerified){
    banner.style.display = 'block';
    const count = entries.length;
    if(count >= 10) {
      banner.style.background = 'rgba(255,107,107,0.15)';
      banner.style.borderColor = 'rgba(255,107,107,0.3)';
      document.getElementById('limit-banner-text').textContent = currentLang === 'hi' 
        ? 'आपने सभी 10 मुफ्त एंट्रीज़ का उपयोग कर लिया है। असीमित एंट्रीज़ के लिए अपना ईमेल सत्यापित करें।'
        : "You've used all 10 free entries. Verify email for unlimited.";
    } else {
      banner.style.background = 'rgba(255,184,77,0.1)';
      banner.style.borderColor = 'rgba(255,184,77,0.3)';
      document.getElementById('limit-banner-text').textContent = currentLang === 'hi'
        ? `${count}/10 मुफ्त एंट्रीज़ का उपयोग किया गया। असीमित के लिए ईमेल सत्यापित करें।`
        : `${count}/10 free entries used. Verify email for unlimited.`;
    }
  } else {
    banner.style.display = 'none';
  }
}


// ===== PocketTrack Mobile Foundation =====
// Keep the bottom navigation/composer/voice FAB keyboard-aware on mobile.
(function initMobileViewportHandling(){
  const applyViewportState = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const keyboardOpen = (window.innerHeight - vv.height) > 140;
    document.documentElement.classList.toggle('keyboard-open', keyboardOpen);
    document.documentElement.style.setProperty('--pt-visual-height', `${Math.round(vv.height)}px`);
  };
  const bind = () => {
    applyViewportState();
    window.visualViewport?.addEventListener('resize', applyViewportState, {passive:true});
    window.visualViewport?.addEventListener('scroll', applyViewportState, {passive:true});
    window.addEventListener('resize', applyViewportState, {passive:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();

// ===== Manifest app-shortcut actions (?action=expense|income|report) =====
(function initShortcutAction(){
  const run = () => {
    const action = new URLSearchParams(location.search).get('action');
    if(!action) return;
    if(action==='expense' || action==='income'){ if(typeof openQuickComposer==='function') openQuickComposer(action); }
    else if(action==='report'){ if(typeof setTab==='function') setTab('report'); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
  else run();
})();

