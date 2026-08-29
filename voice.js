(function() {
  const trans = (typeof window !== 'undefined' && window.TRANSLATIONS) ? window.TRANSLATIONS : ((typeof global !== 'undefined' && global.TRANSLATIONS) ? global.TRANSLATIONS : {});
  Object.assign(trans, {
    voice_entry_title: { en: 'Voice Expense Log', hi: 'वॉयस खर्च रिकॉर्डर' },
    voice_listening: { en: 'Listening... Speak now!', hi: 'सुन रहा है... अब बोलें!' },
    voice_not_supported: { en: 'Voice recognition is not supported in this browser. Type below instead:', hi: 'वॉयस सपोर्ट नहीं है। नीचे टाइप करें:' },
    voice_parse_error: { en: 'Could not detect amount. Try: "Spent 450 on dinner"', hi: 'राशि समझ नहीं आई। उदाहरण: "Spent 450 on food"' }
  });
})();

let recognition = null;
let isListening = false;
let parsedVoiceData = null;

function ensureVoiceListeningOverlay() {
  let backdrop = document.getElementById('voice-listening-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'voice-listening-backdrop';
    backdrop.className = 'voice-listening-backdrop';
    backdrop.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(9,5,30,0.85);z-index:99999;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);';
    backdrop.innerHTML = `
      <div class="voice-listening-card" style="text-align:center;max-width:360px;width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.18);border-radius:26px;padding:28px 20px;box-shadow:0 24px 60px rgba(0,0,0,0.6);">
        <div class="voice-pulse-ring" style="width:76px;height:76px;border-radius:50%;margin:0 auto 16px;background:linear-gradient(135deg,#9b5cff,#ff3db8);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(155,92,255,0.6);animation:voicePulse 1.5s infinite ease-in-out;">
          <i class="ti ti-microphone" style="font-size:34px;color:#fff;"></i>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 6px;" id="voice-listening-title">Listening...</h3>
        <p style="font-size:12.5px;color:var(--text-dim,#c4b9e7);margin:0 0 16px;" id="voice-listening-sub">Speak your transaction (e.g. "Spent 350 on petrol")</p>
        <div id="voice-live-transcript" style="min-height:48px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);border-radius:14px;padding:10px 14px;font-size:14px;color:#fff;font-style:italic;margin-bottom:18px;border:1px dashed rgba(255,255,255,0.25);">
          Speak now...
        </div>
        <button class="btn danger" onclick="stopVoiceRecognition()" style="font-size:12px;padding:8px 20px;border-radius:99px;"><i class="ti ti-square"></i> Stop Listening</button>
      </div>
    `;
    document.body.appendChild(backdrop);
  }
  return backdrop;
}

function showListeningOverlay() {
  const backdrop = ensureVoiceListeningOverlay();
  const title = document.getElementById('voice-listening-title');
  const sub = document.getElementById('voice-listening-sub');
  const transcript = document.getElementById('voice-live-transcript');
  const isHi = (window.currentLang === 'hi');

  if (title) title.textContent = isHi ? 'सुन रहा है... बोलें' : 'Listening... Speak now';
  if (sub) sub.textContent = isHi ? 'उदाहरण: "350 रुपये पेट्रोल पर खर्च किए"' : 'e.g. "Spent 350 on petrol" or "Got 15000 salary"';
  if (transcript) transcript.textContent = isHi ? 'बोलना शुरू करें...' : 'Speak now...';
  if (backdrop) backdrop.style.display = 'flex';
}

function hideListeningOverlay() {
  const backdrop = document.getElementById('voice-listening-backdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function initVoiceEngine() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onstart = function() {
        isListening = true;
        showListeningOverlay();
        const fab = document.getElementById('voice-fab');
        if (fab) fab.classList.add('listening');
      };
      
      recognition.onresult = function(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const transcriptEl = document.getElementById('voice-live-transcript');
        if (transcriptEl) {
          transcriptEl.textContent = finalTranscript || interimTranscript || 'Listening...';
        }

        if (finalTranscript && finalTranscript.trim()) {
          hideListeningOverlay();
          parseVoiceInput(finalTranscript.trim());
        }
      };
      
      recognition.onerror = function(event) {
        console.warn('Speech recognition error', event.error);
        stopVoiceRecognition();
        hideListeningOverlay();
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast('Microphone access denied. Enable mic permissions in browser settings.', 'error');
        } else if (event.error !== 'no-speech') {
          promptManualVoiceInput();
        }
      };
      
      recognition.onend = function() {
        stopVoiceRecognition();
        hideListeningOverlay();
      };
    } catch(e) {
      console.warn('Voice engine init failed:', e);
      recognition = null;
    }
  }
}

function updateVoiceFabVisibility() {
  const fab = document.getElementById('voice-fab');
  if (!fab) return;
  const auth = document.getElementById('auth-screen');
  const onAuthScreen = auth && auth.style.display !== 'none';
  fab.style.display = onAuthScreen ? 'none' : 'flex';
}

function startVoiceRecognition() {
  if (typeof canUseVoiceEntry === 'function' && !canUseVoiceEntry()) {
    showProLimitModal('Voice Transactions', '100 voice entries');
    return;
  }
  if (!navigator.onLine) {
    if (typeof showAppAlert === 'function') {
      showAppAlert(
        window.currentLang === 'hi' ? 'ऑफ़लाइन' : 'Voice unavailable offline',
        window.currentLang === 'hi'
          ? 'क्षमा करें, वॉइस सुविधा ऑफ़लाइन काम नहीं करती। कृपया इंटरनेट से जुड़ें।'
          : 'Sorry, voice recognition requires an active internet connection.'
      );
    } else {
      toast('Voice recognition requires an internet connection.', 'error');
    }
    return;
  }

  if (!recognition) {
    initVoiceEngine();
  }

  if (!recognition) {
    promptManualVoiceInput();
    return;
  }
  
  recognition.lang = (window.currentLang === 'hi') ? 'hi-IN' : 'en-US';
  
  if (isListening) {
    stopVoiceRecognition();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition start exception:', e);
      stopVoiceRecognition();
      promptManualVoiceInput();
    }
  }
}
window.startVoiceRecognition = startVoiceRecognition;

function stopVoiceRecognition() {
  isListening = false;
  hideListeningOverlay();
  const fab = document.getElementById('voice-fab');
  if (fab) fab.classList.remove('listening');
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }
}
window.stopVoiceRecognition = stopVoiceRecognition;

function promptManualVoiceInput() {
  if (typeof showAppPrompt === 'function') {
    showAppPrompt(
      TT('voice_entry_title') + '<br><span style="font-size:12px;color:var(--text-dim);">e.g. "Spent 350 on petrol" or "Got 15000 salary"</span>',
      '',
      (input) => {
        if (input && input.trim()) {
          parseVoiceInput(input.trim());
        }
      },
      '🎙️ Voice Input (Type / Speak)'
    );
  }
}

function extractVoiceAmount(text){
  let m = text.match(/(?:₹|\brs\.?|\brupees?\b|\brupaye\b|\binr\b)\s*(\d+(?:\.\d+)?)\s*(k)?\b/);
  if(m) return { text:m[0], value:parseFloat(m[1])*(m[2]?1000:1) };
  m = text.match(/(\d+(?:\.\d+)?)\s*(k)?\s*(?:₹|\brs\.?|\brupees?\b|\brupaye\b|\binr\b)/);
  if(m) return { text:m[0], value:parseFloat(m[1])*(m[2]?1000:1) };
  m = text.match(/\b(?:for|of)\s+(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\b/i);
  if(m) return { text:m[0], value:parseFloat(m[1]) };
  m = text.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if(m) return { text:m[0], value:parseFloat(m[1])*1000 };
  const nums=[...text.matchAll(/\d+(?:\.\d+)?/g)];
  if(!nums.length) return null;
  let best=nums[0];
  for(const n of nums){ if(parseFloat(n[0])>=parseFloat(best[0])) best=n; }
  return { text:best[0], value:parseFloat(best[0]) };
}

function parseVoiceInput(text) {
  const rawText = text;
  text = text.toLowerCase();
  
  // Extract amount: currency-marked → "for/of" → k-shorthand → largest number
  const extracted = extractVoiceAmount(text);
  if (!extracted) {
    toast(TT('voice_parse_error') + ` ("${rawText}")`, 'error');
    return;
  }
  const amount = extracted.value;
  
  // Determine type
  let type = 'expense';
  const incomeKeywords = ['received', 'got', 'earned', 'income', 'salary', 'allowance', 'आय', 'मिला', 'मिले', 'आया', 'वेतन'];
  if (incomeKeywords.some(kw => text.includes(kw))) {
    type = 'income';
  }
  
  // Determine category (maps to the app's real category set: food/travel/friends/home/shopping/health/education/bills/work/other)
  let category = 'other';
  if (type === 'expense') {
    if (/food|grocer|meal|snack|restaurant|lunch|dinner|tea|coffee|biryani|pizza|burger|chai|sutta|sutte|samosa|canteen|mess|dmart|zepto|blinkit|instamart|swiggy|zomato|doodh|milk|sabji|खाना|चाय|नाश्ता|होटल|सब्जी|दूध|राशन/.test(text)) category = 'food';
    else if (/auto|petrol|fuel|transport|bus|train|cab|taxi|uber|ola|rapido|namma yatri|metro|diesel|cng|toll|fastag|पेट्रोल|बस|टैक्सी|किराया|ऑटो/.test(text)) category = 'travel';
    else if (/friends|party|cafe|movie|game|show|ticket|treat|pvr|cinema|netflix|spotify|दोस्त|पार्टी|मूवी|सिनेमा/.test(text)) category = 'friends';
    else if (/rent|home|house|bill|electricity|water|wifi|internet|recharge|maid|cook|kamwali|dhobi|maintenance|bijli|kiraya|कमरा|बिल|घर|कामवाली|बिजली|किराया/.test(text)) category = 'home';
    else if (/dawai|medicine|doctor|clinic|hospital|chemist|apollo|1mg|cult|gym|दवाई|डॉक्टर|अस्पताल|जिम/.test(text)) category = 'health';
    else if (/fee|fees|tuition|books|xerox|photocopy|coaching|school|college|फीस|ट्यूशन|किताब/.test(text)) category = 'education';
    else if (/emi|loan|insurance|lic|credit card|cred|किस्त|ऋण|बीमा/.test(text)) category = 'bills';
    else if (/client|freelance|project|work|office|प्रोजेक्ट|काम/.test(text)) category = 'work';
    else if (/amazon|flipkart|myntra|shopping|dress|clothes|shoes|कपड़े|शॉपिंग/.test(text)) category = 'shopping';
  }

  // Detect a spoken date if the user mentioned one ("yesterday", "on the 5th", "5 july", "last monday"…)
  let date = (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().split('T')[0]);
  const spoken = parseVoiceDate(rawText);
  if (spoken) date = spoken;

  // Clean up note/description
  let description = rawText.replace(extracted.text, '').replace(/₹/g, '').trim();
  const stopWords = ['spent', 'paid','on','for','rupees','rs','inr','bucks','yesterday','today','kal','parso','aaj','tarikh','tareekh','खर्च','किया','रुपये','का','के','लिए','पर','कल','आज'];
  stopWords.forEach(sw => {
    description = description.replace(new RegExp(`\\b${sw}\\b`, 'gi'), '').trim();
  });
  description = description.replace(/\s+/g, ' ');
  if (!description) description = type === 'income' ? 'Voice Income' : 'Voice Expense';

  // Smart Context Wallet Detection
  const detectedWallet = (typeof detectWalletFromText === 'function')
    ? detectWalletFromText(rawText)
    : ((typeof activeWalletId !== 'undefined' && activeWalletId !== 'all') ? activeWalletId : (type === 'income' ? 'bank' : 'cash'));

  parsedVoiceData = {
    amount,
    type,
    category: type === 'income' ? 'Salary' : category,
    note: description,
    walletId: detectedWallet,
    date
  };
  if (typeof window !== 'undefined') {
    window.parsedVoiceData = parsedVoiceData;
  }

  showVoiceModal();
  return parsedVoiceData;
}

// --- Spoken-date parser: "yesterday", "last monday", "on the 5th", "5 july", "05-07" … ---
function parseVoiceDate(text){
  const raw = String(text || '').trim();
  const t = raw.toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
  const now = new Date();
  now.setHours(12,0,0,0);

  const toStr = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  const validDate = (year, month, day) => {
    const d = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return toStr(d);
  };

  // Relative dates — checked first so "today 17" etc. cannot be mistaken for a numeric date.
  if (/\b(today|todays)\b|आज/.test(t)) return toStr(now);
  if (/\b(yesterday)\b|(^|\s)कल(\s|$)/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate()-1); return toStr(d);
  }
  if (/\b(day before yesterday)\b|परसों/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate()-2); return toStr(d);
  }
  if (/\b(day after tomorrow)\b|परसों के बाद/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate()+2); return toStr(d);
  }
  if (/\b(tomorrow)\b|कल के बाद/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate()+1); return toStr(d);
  }
  // Romanized Hindi (speech engines often type Hindi words in Latin script)
  if (/\baaj\b/.test(t)) return toStr(now);
  if (/\bparso\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate()-2); return toStr(d);
  }
  if (/\bkal\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate()-1); return toStr(d);
  }

  // Relative offsets: "3 days ago", "2 weeks ago", Hindi equivalents.
  let m = t.match(/\b(\d+)\s+days?\s+ago\b/);
  if (m) { const d = new Date(now); d.setDate(d.getDate()-Number(m[1])); return toStr(d); }
  m = t.match(/\b(\d+)\s+weeks?\s+ago\b/);
  if (m) { const d = new Date(now); d.setDate(d.getDate()-7*Number(m[1])); return toStr(d); }
  if (/\b(a week ago|last week|पिछले हफ्ते|पिछले सप्ताह)\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate()-7); return toStr(d);
  }

  // Weekday references: last Monday / Monday / पिछले सोमवार.
  const wd = {
    sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,
    ravivar:0,itwar:0,somvar:1,mangalvar:2,budhwar:3,guruvar:4,guruwar:4,
    shukrawar:5,shukravar:5,shanivar:6,sanivar:6,
    रविवार:0,सोमवार:1,मंगलवार:2,बुधवार:3,गुरुवार:4,शुक्रवार:5,शनिवार:6
  };
  for (const nm in wd){
    const re = new RegExp(`(?:last\\s+|पिछले\\s+|पिछली\\s+)?${nm}(?:\\b|$)`);
    if (re.test(t)){
      const diff = (now.getDay() - wd[nm] + 7) % 7;
      const target = new Date(now);
      target.setDate(target.getDate() - (diff === 0 ? 7 : diff));
      return toStr(target);
    }
  }

  const mo = {
    january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,
    september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12,
    जनवरी:1,फ़रवरी:2,फरवरी:2,मार्च:3,अप्रैल:4,मई:5,जून:6,जुलाई:7,अगस्त:8,
    सितंबर:9,सितम्बर:9,अक्टूबर:10,नवंबर:11,दिसंबर:12
  };

  // "5 August", "5th August", "August 5", "August 5th" — optional year.
  const monthNames = Object.keys(mo).sort((a,b)=>b.length-a.length).join('|');
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+|\\s+of\\s+)(${monthNames})(?:\\s+(\\d{4}))?\\b`, 'i');
  const monthDay = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`, 'i');
  let hit = t.match(dayMonth);
  if (hit){
    const day=Number(hit[1]), month=mo[hit[2].toLowerCase()], year=hit[3]?Number(hit[3]):now.getFullYear();
    const out=validDate(year,month,day); if(out) return out;
  }
  hit = t.match(monthDay);
  if (hit){
    const month=mo[hit[1].toLowerCase()], day=Number(hit[2]), year=hit[3]?Number(hit[3]):now.getFullYear();
    const out=validDate(year,month,day); if(out) return out;
  }

  // "on the 5th" / "on 5th" / "5th".
  // Differentiates between past intent ("paid on the 5th") and future/upcoming intent ("due on the 5th")
  const isFutureIntent = /\b(?:will|due|next|remind|schedule|upcoming|देना है|करना है)\b/i.test(t);
  const onThe = t.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?\b/) ||
                t.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?\b/) ||
                t.match(/\b(\d{1,2})\s*(?:tarikh|tareekh|taareekh)\b/) ||
                t.match(/\b(?:tarikh|tareekh|taareekh)\s+(\d{1,2})\b/);
  if (onThe){
    const day=Number(onThe[1]);
    if(day>=1 && day<=31){
      let target=new Date(now.getFullYear(), now.getMonth(), day, 12,0,0,0);
      if(!isFutureIntent && target > now) target.setMonth(target.getMonth()-1);
      if(isFutureIntent && target < now) target.setMonth(target.getMonth()+1);
      const out=validDate(target.getFullYear(), target.getMonth()+1, target.getDate());
      if(out) return out;
    }
  }

  // Numeric dates: 05/08, 05-08, 05.08, and explicit years such as 05/08/2026.
  // Prefer DD/MM because PocketTrack is India-first.
  const numeric = t.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if(numeric){
    const day=Number(numeric[1]), month=Number(numeric[2]);
    let year=numeric[3] ? Number(numeric[3]) : now.getFullYear();
    if(year<100) year += 2000;
    const out=validDate(year,month,day); if(out) return out;
  }
  const dotted = t.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
  if(dotted){
    const day=Number(dotted[1]), month=Number(dotted[2]);
    let year=dotted[3] ? Number(dotted[3]) : now.getFullYear();
    if(year<100) year += 2000;
    const out=validDate(year,month,day); if(out) return out;
  }

  // Spoken numeric dates: "5 8 2026" is common with speech recognition.
  const spaced = t.match(/\b(?:on\s+)?(\d{1,2})\s+(\d{1,2})(?:\s+(\d{4}))?\b/);
  if(spaced){
    const day=Number(spaced[1]), month=Number(spaced[2]), year=spaced[3]?Number(spaced[3]):now.getFullYear();
    const out=validDate(year,month,day); if(out) return out;
  }

  return null;
}

function voiceCatsHtml(type){
  if (type === 'income'){
    return ['Salary','Allowance','Rent received','Other income'].map(c=>`<option value="${c}"${c===parsedVoiceData.category?' selected':''}>${c}</option>`).join('');
  }
  let cats = ['food','travel','friends','home','other'];
  let html = cats.map(c=>{
    const label = (typeof CAT_LABEL==='function') ? CAT_LABEL(c) : c;
    return `<option value="${c}"${c===parsedVoiceData.category?' selected':''}>${escapeHTML(label)}</option>`;
  }).join('');
  if (typeof customExpenseCategories !== 'undefined'){
    customExpenseCategories.forEach(n=>{
      html += `<option value="${n}"${n===parsedVoiceData.category?' selected':''}>${escapeHTML(n)}</option>`;
    });
  }
  return html;
}

function setVoiceType(t){
  parsedVoiceData.type = t;
  const inc = document.getElementById('voice-type-inc');
  const exp = document.getElementById('voice-type-exp');
  const catSel = document.getElementById('voice-cat');
  if (inc && exp){
    inc.classList.toggle('active', t==='income');
    exp.classList.toggle('active', t==='expense');
  }
  const c = (t==='income') ? 'var(--green)' : 'var(--red)';
  const amtWrap = document.getElementById('voice-amt-wrap');
  const signEl = document.getElementById('voice-sign');
  const amtInput = document.getElementById('voice-amount');
  if(amtWrap) amtWrap.style.color = c;
  if(signEl) signEl.textContent = (t==='income') ? '+' : '-';
  if(amtInput) amtInput.style.borderBottomColor = c;
  if (catSel){
    parsedVoiceData.category = (t==='income') ? 'Salary' : 'other';
    catSel.innerHTML = voiceCatsHtml(t);
    catSel.value = parsedVoiceData.category;
  }
}

function showVoiceModal() {
  const backdrop = document.getElementById('voice-modal-backdrop');
  const content = document.getElementById('voice-parsed-content');
  if (!backdrop || !content || !parsedVoiceData) return;

  const isIncome = parsedVoiceData.type === 'income';
  const color = isIncome ? 'var(--green)' : 'var(--red)';
  const sign = isIncome ? '+' : '-';

  content.innerHTML = `
    <div id="voice-amt-wrap" style="font-size:26px; font-weight:800; color:${color}; text-align:center; margin:6px 0 12px;">
      <span id="voice-sign">${sign}</span>₹<input id="voice-amount" type="number" style="width:130px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:26px;background:transparent;border:none;border-bottom:2px solid ${color};color:inherit;outline:none" value="${parsedVoiceData.amount}"/>
    </div>

    <div class="toggle-grp" style="margin-bottom:12px">
      <button id="voice-type-exp" class="${isIncome?'':'active'}" onclick="setVoiceType('expense')">📤 Expense</button>
      <button id="voice-type-inc" class="${isIncome?'active':''}" onclick="setVoiceType('income')">📥 Income</button>
    </div>

    <label style="font-size:11.5px;color:var(--text-dim)">Account / Wallet</label>
    <select id="voice-wallet" onchange="parsedVoiceData.walletId=this.value">
      ${(typeof userWallets !== 'undefined' ? userWallets : [{id:'cash',name:'Cash',icon:'💵'},{id:'bank',name:'Bank / UPI',icon:'📱'},{id:'card',name:'Credit Card',icon:'💳'}]).map(w => `
        <option value="${w.id}" ${w.id===parsedVoiceData.walletId?'selected':''}>${w.icon} ${escapeHTML(w.name)}</option>
      `).join('')}
    </select>

    <label style="font-size:11.5px;color:var(--text-dim)">Category / Source</label>
    <select id="voice-cat" onchange="parsedVoiceData.category=this.value;parsedVoiceData.type=document.getElementById('voice-type-inc').classList.contains('active')?'income':'expense'">${voiceCatsHtml(parsedVoiceData.type)}</select>

    <label style="font-size:11.5px;color:var(--text-dim)">Note</label>
    <input id="voice-note" type="text" value="${escapeHTML(parsedVoiceData.note)}" maxlength="60"/>

    <label style="font-size:11.5px;color:var(--text-dim)">Date</label>
    <input id="voice-date" type="date" value="${parsedVoiceData.date}" onchange="parsedVoiceData.date=this.value"/>
  `;

  backdrop.style.display = 'flex';
}

function closeVoiceModal() {
  const backdrop = document.getElementById('voice-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
  parsedVoiceData = null;
}

async function confirmVoiceEntry() {
  if (!parsedVoiceData) return;
  try {
    const amtEl = document.getElementById('voice-amount');
    const noteEl = document.getElementById('voice-note');
    const dateEl = document.getElementById('voice-date');
    const walletEl = document.getElementById('voice-wallet');
    const amt = amtEl ? parseFloat(amtEl.value) : parsedVoiceData.amount;
    if (!isFinite(amt) || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    // keep type & category which the modal mutates live on parsedVoiceData
    parsedVoiceData.amount = amt;
    if (noteEl) parsedVoiceData.note = noteEl.value.trim() || 'Voice Entry';
    if (dateEl) parsedVoiceData.date = dateEl.value;
    if (walletEl) parsedVoiceData.walletId = walletEl.value;
    parsedVoiceData.label = parsedVoiceData.note;
    if (typeof isValidDate === 'function' && !isValidDate(parsedVoiceData.date)) { toast('Enter a valid date', 'error'); return; }
    if (currentUser && !currentUser.emailVerified && (!currentUser.providerData || currentUser.providerData[0].providerId !== 'google.com') && typeof entries !== 'undefined' && entries.length >= 10) {
      if (typeof showAppAlert === 'function') {
        showAppAlert(currentLang==='hi'?'सीमा पूरी हुई':'Limit Reached', currentLang==='hi'?'अपनी एंट्रीज़ जोड़ना जारी रखने के लिए अपना ईमेल सत्यापित करें।':"Verify your email to continue adding entries. You've used all 10 free entries.");
      } else {
        toast(currentLang==='hi'?'ईमेल सत्यापित करें':'Verify your email to continue', 'error');
      }
      return;
    }
    const voicePayload = {
      type: parsedVoiceData.type,
      cat: parsedVoiceData.category,
      label: parsedVoiceData.note,
      note: parsedVoiceData.note,
      amt: parsedVoiceData.amount,
      walletId: parsedVoiceData.walletId || 'cash',
      date: parsedVoiceData.date
    };
    const savedType = parsedVoiceData.type;
    const offerData = { type: savedType, label: parsedVoiceData.note, amt: parsedVoiceData.amount, cat: parsedVoiceData.category };
    const guardFn = (typeof maybeGuardAndSaveWithSmartEngine === 'function') ? maybeGuardAndSaveWithSmartEngine : maybeGuardAndSave;
    await guardFn(voicePayload, async()=>{
      if (typeof saveEntry === 'function') await saveEntry(voicePayload);
      if (typeof incrementVoiceEntriesUsed === 'function') incrementVoiceEntriesUsed();
      if (typeof renderWalletSwitcher === 'function') renderWalletSwitcher();
      toast((savedType === 'income' ? 'Income' : 'Expense') + ' recorded!', 'success');
      clearVoiceState();
      closeVoiceModal();
      if (savedType === 'expense' && typeof checkBudget === 'function') checkBudget();
      if (typeof maybeOfferRecurring === 'function') maybeOfferRecurring(offerData);
    }, parsedVoiceData.raw || parsedVoiceData.note);
  } catch (e) {
    toast('Could not save: ' + e.message, 'error');
  }
}

function clearVoiceState(){ parsedVoiceData = null; }

if (typeof window !== 'undefined') {
  window.extractVoiceAmount = extractVoiceAmount;
  window.parseVoiceInput = parseVoiceInput;
  window.parseVoiceDate = parseVoiceDate;
  window.showVoiceModal = showVoiceModal;
  window.closeVoiceModal = closeVoiceModal;
  window.confirmVoiceEntry = confirmVoiceEntry;
  window.clearVoiceState = clearVoiceState;
  window.initVoiceEngine = initVoiceEngine;
}

// Initialize on DOM load & auth observer
document.addEventListener('DOMContentLoaded', () => {
  initVoiceEngine();
  updateVoiceFabVisibility();
});

if (window.firebase && firebase.auth()) {
  firebase.auth().onAuthStateChanged(() => {
    updateVoiceFabVisibility();
  });
}
