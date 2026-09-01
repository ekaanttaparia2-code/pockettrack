// =====================================================================
// POCKETTRACK PURE — TRANSACTIONS & COMPOSER CONTROLLER
// =====================================================================

const CATEGORIES = {
  expense: [
    { id: 'food', name: 'Food & Dining', icon: '🍔' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️' },
    { id: 'transport', name: 'Transport & Auto', icon: '🚕' },
    { id: 'bills', name: 'Bills & Utilities', icon: '⚡' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
    { id: 'health', name: 'Health & Meds', icon: '💊' },
    { id: 'grocery', name: 'Groceries & Milk', icon: '🥦' },
    { id: 'other', name: 'General', icon: '📌' }
  ],
  income: [
    { id: 'salary', name: 'Salary / Pocket Money', icon: '💼' },
    { id: 'freelance', name: 'Freelance & Bonus', icon: '💻' },
    { id: 'gift', name: 'Gift / Envelope', icon: '🎁' },
    { id: 'investment', name: 'Returns & Dividend', icon: '📈' },
    { id: 'other', name: 'Other Income', icon: '💵' }
  ]
};

let currentComposerType = 'expense';
let currentComposerCategory = 'food';
let currentEditingId = null;
window.currentActivityFilter = 'all';
window.currentSearchQuery = '';
let currentActivityFilter = 'all';
let currentSearchQuery = '';

// ── BALANCE & STATS SYNC ──
function updateHeaderStats() {
  const list = window.entries || [];
  const income = list.filter(e => e.type === 'income').reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const spent = list.filter(e => e.type === 'expense').reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const balance = income - spent;

  const b = document.getElementById('hdr-balance');
  const inc = document.getElementById('hero-income');
  const exp = document.getElementById('hero-spent');
  const cnt = document.getElementById('hero-count');

  if (b) b.textContent = (balance < 0 ? '-₹' : '₹') + Math.abs(balance).toLocaleString('en-IN');
  if (inc) inc.textContent = '₹' + income.toLocaleString('en-IN');
  if (exp) exp.textContent = '₹' + spent.toLocaleString('en-IN');
  if (cnt) cnt.textContent = String(list.length);

  // Calculate Daily Safe-to-Spend
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
  const safePerDay = balance > 0 ? Math.floor(balance / daysLeft) : 0;

  const safeEl = document.getElementById('safe-to-spend-val');
  const safeSub = document.getElementById('safe-to-spend-sub');

  if (safeEl) safeEl.textContent = '₹' + safePerDay.toLocaleString('en-IN') + '/day';
  if (safeSub) {
    safeSub.textContent = balance > 0 
      ? `₹${safePerDay.toLocaleString('en-IN')} left today (${daysLeft}d left)`
      : `₹0 left today (${daysLeft}d left in month)`;
  }

  if (typeof animateNumber === 'function') {
    animateNumber('hdr-balance', balance);
    animateNumber('hero-income', income);
    animateNumber('hero-spent', spent);
    animateNumber('hero-count', list.length, '', '');
    if (safeEl) animateNumber('safe-to-spend-val', safePerDay, '₹', '/day');
  }

  renderHomeRecent();
  if (window.currentTab === 'activity') renderActivityList();
  if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
}
window.updateHeaderStats = updateHeaderStats;

// ── RECENT ACTIVITY ON HOME (Top 5) ──
function renderHomeRecent() {
  const container = document.getElementById('home-recent-activity');
  if (!container) return;
  const list = window.entries || [];

  if (!list.length) {
    container.innerHTML = `<div class="empty-mini" style="padding:24px 0;text-align:center;color:var(--text-dim);font-size:13px;">No entries logged yet. Tap <strong>Expense</strong> or <strong>Income</strong> above!</div>`;
    return;
  }

  const top5 = list.slice(0, 5);
  let html = '';
  top5.forEach(e => {
    const isInc = e.type === 'income';
    const isTr = e.cat === 'transfer';
    const amtClass = isTr ? 'transfer' : (isInc ? 'income' : 'expense');
    const sign = isTr ? '' : (isInc ? '+₹' : '-₹');
    const catIcon = getCategoryIcon(e.cat, e.type);

    html += `
      <div class="entry-row" onclick="startEditEntry('${e.id}')">
        <div class="entry-left">
          <div class="entry-icon">${catIcon}</div>
          <div class="entry-main">
            <div class="entry-title">${escapeHtml(e.desc || e.note || e.cat || 'Transaction')}</div>
            <div class="entry-meta">
              <span>${formatDate(e.date)}</span>
              ${typeof getWalletBadgeHtml === 'function' ? getWalletBadgeHtml(e.wallet) : ''}
            </div>
          </div>
        </div>
        <div class="entry-amt ${amtClass}">${sign}${parseFloat(e.amt || 0).toLocaleString('en-IN')}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}
window.renderHomeRecent = renderHomeRecent;
window.renderHomeSnapshot = renderHomeRecent;

// ── FULL ACTIVITY PASSBOOK ──
function renderActivityList() {
  const container = document.getElementById('entries-list');
  if (!container) return;
  let list = window.entries || [];

  // Filter
  if (currentActivityFilter !== 'all') {
    if (currentActivityFilter === 'transfer') {
      list = list.filter(e => e.cat === 'transfer');
    } else {
      list = list.filter(e => e.type === currentActivityFilter && e.cat !== 'transfer');
    }
  }

  // Search
  if (currentSearchQuery.trim()) {
    const q = currentSearchQuery.toLowerCase();
    list = list.filter(e => 
      (e.desc && e.desc.toLowerCase().includes(q)) || 
      (e.note && e.note.toLowerCase().includes(q)) || 
      (e.cat && e.cat.toLowerCase().includes(q)) || 
      String(e.amt).includes(q)
    );
  }

  if (!list.length) {
    container.innerHTML = `<div class="empty-mini" style="padding:32px 0;text-align:center;color:var(--text-dim);font-size:13px;">No transactions match your filter.</div>`;
    return;
  }

  let html = '';
  list.forEach(e => {
    const isInc = e.type === 'income';
    const isTr = e.cat === 'transfer';
    const amtClass = isTr ? 'transfer' : (isInc ? 'income' : 'expense');
    const sign = isTr ? '' : (isInc ? '+₹' : '-₹');
    const catIcon = getCategoryIcon(e.cat, e.type);

    html += `
      <div class="entry-row" onclick="startEditEntry('${e.id}')">
        <div class="entry-left">
          <div class="entry-icon">${catIcon}</div>
          <div class="entry-main">
            <div class="entry-title">${escapeHtml(e.desc || e.note || e.cat || 'Transaction')}</div>
            <div class="entry-meta">
              <span>${formatDate(e.date)}</span>
              ${typeof getWalletBadgeHtml === 'function' ? getWalletBadgeHtml(e.wallet) : ''}
            </div>
          </div>
        </div>
        <div class="entry-amt ${amtClass}">${sign}${parseFloat(e.amt || 0).toLocaleString('en-IN')}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}
window.renderActivityList = renderActivityList;
window.renderEntries = renderActivityList;

function setActivityFilter(filter, btn) {
  currentActivityFilter = filter;
  window.currentActivityFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderActivityList();
}
window.setActivityFilter = setActivityFilter;

function onActivitySearch(val) {
  currentSearchQuery = val;
  window.currentSearchQuery = val;
  renderActivityList();
}
window.onActivitySearch = onActivitySearch;

// ── QUICK COMPOSER MODAL ──
function openQuickComposer(type='expense', editEntry=null) {
  currentComposerType = type;
  currentEditingId = editEntry ? editEntry.id : null;
  const m = document.getElementById('modal-composer');
  if (!m) return;

  setComposerType(type);

  // Populate wallets
  const wSel = document.getElementById('comp-wallet');
  if (wSel && typeof getWallets === 'function') {
    wSel.innerHTML = getWallets().map(w => `<option value="${w.id}">${w.icon} ${w.name}</option>`).join('');
  }

  const amtInput = document.getElementById('comp-amt');
  const noteInput = document.getElementById('comp-note');
  const dateInput = document.getElementById('comp-date');
  const delBtn = document.getElementById('comp-delete-btn');
  const saveBtn = document.getElementById('comp-save-btn');

  if (editEntry) {
    if (amtInput) amtInput.value = editEntry.amt || '';
    if (noteInput) noteInput.value = editEntry.desc || editEntry.note || '';
    if (dateInput) dateInput.value = editEntry.date || new Date().toISOString().split('T')[0];
    if (wSel && editEntry.wallet) wSel.value = editEntry.wallet;
    selectComposerCategory(editEntry.cat || 'other');
    if (delBtn) delBtn.style.display = 'inline-flex';
    if (saveBtn) saveBtn.textContent = 'Update Entry';
  } else {
    if (amtInput) amtInput.value = '';
    if (noteInput) noteInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    selectComposerCategory(currentComposerType === 'income' ? 'salary' : 'food');
    if (delBtn) delBtn.style.display = 'none';
    if (saveBtn) saveBtn.textContent = 'Save Entry';
  }

  m.style.display = 'flex';
  if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
  if (amtInput && !editEntry) amtInput.focus();
}
window.openQuickComposer = openQuickComposer;

function closeQuickComposer() {
  const m = document.getElementById('modal-composer');
  if (m) m.style.display = 'none';
  if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
  currentEditingId = null;
}
window.closeQuickComposer = closeQuickComposer;

function setComposerType(type) {
  currentComposerType = type;
  const expBtn = document.getElementById('comp-type-expense');
  const incBtn = document.getElementById('comp-type-income');
  if (expBtn) expBtn.classList.toggle('active', type === 'expense');
  if (incBtn) incBtn.classList.toggle('active', type === 'income');
  renderCategoryGrid();
}
window.setComposerType = setComposerType;

function renderCategoryGrid() {
  const container = document.getElementById('comp-categories');
  if (!container) return;
  const cats = CATEGORIES[currentComposerType] || CATEGORIES.expense;
  
  let html = '';
  cats.forEach(c => {
    const isActive = (c.id === currentComposerCategory) ? 'active' : '';
    html += `<button type="button" class="composer-cat-chip ${isActive}" onclick="selectComposerCategory('${c.id}')">${c.icon} ${c.name}</button>`;
  });
  container.innerHTML = html;
}

function selectComposerCategory(catId) {
  currentComposerCategory = catId;
  document.querySelectorAll('.composer-cat-chip').forEach(chip => {
    chip.classList.toggle('active', chip.textContent.toLowerCase().includes(catId));
  });
}
window.selectComposerCategory = selectComposerCategory;

function saveComposerEntry() {
  const amtInput = document.getElementById('comp-amt');
  const noteInput = document.getElementById('comp-note');
  const dateInput = document.getElementById('comp-date');
  const wSel = document.getElementById('comp-wallet');

  const amt = parseFloat(amtInput ? amtInput.value : 0);
  if (!amt || amt <= 0) {
    toast('Please enter a valid amount', 'error');
    return;
  }

  const desc = noteInput ? noteInput.value.trim() : '';
  const date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
  const wallet = wSel ? wSel.value : 'cash';
  const type = currentComposerType;
  const cat = currentComposerCategory || 'other';

  if (currentEditingId) {
    // Update existing
    const idx = window.entries.findIndex(e => e.id === currentEditingId);
    if (idx !== -1) {
      window.entries[idx] = {
        ...window.entries[idx],
        amt,
        type,
        cat,
        desc: desc || window.entries[idx].desc,
        date,
        wallet
      };
      toast('Entry updated!', 'success');
    }
  } else {
    // Create new
    const newEntry = {
      id: 'pt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      amt,
      type,
      cat,
      desc: desc || (cat.charAt(0).toUpperCase() + cat.slice(1)),
      date,
      wallet,
      createdAt: Date.now()
    };
    window.entries.unshift(newEntry);
    toast(type === 'income' ? `Added +₹${amt} Income! 💵` : `Added -₹${amt} Expense! 💸`, 'success');
  }

  localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
  updateHeaderStats();
  if (typeof syncEntriesToCloud === 'function') syncEntriesToCloud();
  closeQuickComposer();
}
window.saveComposerEntry = saveComposerEntry;

function startEditEntry(id) {
  const entry = (window.entries || []).find(e => e.id === id);
  if (!entry) return;
  openQuickComposer(entry.type, entry);
}
window.startEditEntry = startEditEntry;
window.startEdit = startEditEntry;

function deleteCurrentComposerEntry() {
  if (!currentEditingId) return;
  deleteEntry(currentEditingId);
  closeQuickComposer();
}
window.deleteCurrentComposerEntry = deleteCurrentComposerEntry;

function deleteEntry(id) {
  const target = (window.entries || []).find(e => e.id === id);
  if (!target) return;

  // If part of an atomic transfer, remove its paired counterpart
  if (target.transferGroupId) {
    window.entries = window.entries.filter(e => e.transferGroupId !== target.transferGroupId);
  } else {
    window.entries = window.entries.filter(e => e.id !== id);
  }

  localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
  updateHeaderStats();
  if (typeof syncEntriesToCloud === 'function') syncEntriesToCloud();
  toast('Entry deleted', 'info');
}
window.deleteEntry = deleteEntry;

// ── 1-TAP UPI PASTE ──
window.pasteFromClipboardAndLog = async function() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast('Clipboard is empty. Copy any UPI alert first!', 'info');
        return;
      }
      
      // Parse amount from text (e.g. Paid Rs 150, Sent INR 250, Received ₹500)
      const amtMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i);
      const isIncome = /received|credited|received from/i.test(text);

      if (amtMatch && amtMatch[1]) {
        const amt = parseFloat(amtMatch[1].replace(/,/g, ''));
        const newEntry = {
          id: 'upi_' + Date.now(),
          amt,
          type: isIncome ? 'income' : 'expense',
          cat: isIncome ? 'other' : 'food',
          desc: text.slice(0, 40) + '...',
          date: new Date().toISOString().split('T')[0],
          wallet: 'bank',
          createdAt: Date.now()
        };
        window.entries.unshift(newEntry);
        localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
        updateHeaderStats();
        if (typeof syncEntriesToCloud === 'function') syncEntriesToCloud();
        toast(`Pasted UPI: ${isIncome ? '+' : '-'}₹${amt} logged! ⚡`, 'success');
      } else {
        // Open composer with text pre-filled in note
        openQuickComposer('expense', { desc: text.slice(0, 50) });
        toast('Could not detect exact amount. Please enter amount.', 'info');
      }
    } else {
      openQuickComposer('expense');
      toast('Please paste manually into composer note', 'info');
    }
  } catch (e) {
    openQuickComposer('expense');
    toast('Please enter transaction details', 'info');
  }
};

// ── SMART VOICE COMPOSER ENGINE ──
let activeSpeechRecognizer = null;

function parseVoiceTranscript(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Detect Amount (e.g. 250, 1500, 25k, ₹500, 450.50)
  let amt = 0;
  const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) {
    amt = parseFloat(kMatch[1]) * 1000;
  } else {
    const numMatch = lower.match(/(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/);
    if (numMatch && numMatch[1]) {
      amt = parseFloat(numMatch[1].replace(/,/g, ''));
    }
  }

  // 2. Detect Type (Income vs Expense)
  const isIncome = /salary|income|credited|received|earned|bonus|interest|freelance|kamaya|mile|aaye|aaya|pension/i.test(lower);
  const type = isIncome ? 'income' : 'expense';

  // 3. Detect Category
  let cat = isIncome ? 'salary' : 'other';
  if (/pizza|burger|chai|tea|coffee|lunch|dinner|breakfast|samosa|food|swiggy|zomato|restaurant|cafe|khana|biryani|hotel/i.test(lower)) {
    cat = 'food';
  } else if (/uber|ola|auto|cab|metro|petrol|diesel|fuel|flight|train|bus|travel|transport|rapido|rickshaw/i.test(lower)) {
    cat = 'transport';
  } else if (/grocery|groceries|milk|vegetables|sabzi|blinkit|zepto|instamart|supermarket|rashan|dukaan/i.test(lower)) {
    cat = 'grocery';
  } else if (/recharge|wifi|electricity|bijli|water|bill|rent|kiraya|maintenance|gas/i.test(lower)) {
    cat = 'bills';
  } else if (/movie|cinema|netflix|spotify|game|party|gaming|fun/i.test(lower)) {
    cat = 'entertainment';
  } else if (/medicine|doctor|hospital|pharmacy|meds|clinic|test/i.test(lower)) {
    cat = 'health';
  } else if (/amazon|flipkart|clothes|shopping|shoes|shirt|dress/i.test(lower)) {
    cat = 'shopping';
  } else if (/salary|allowance|pocket money|freelance|bonus/i.test(lower)) {
    cat = isIncome ? 'salary' : 'other';
  }

  // 4. Detect Wallet
  let wallet = 'cash';
  if (/card|credit card|debit card/i.test(lower)) {
    wallet = 'card';
  } else if (/upi|gpay|paytm|phonepe|bank|online|transfer/i.test(lower)) {
    wallet = 'bank';
  } else if (/cash|rokda|nagad/i.test(lower)) {
    wallet = 'cash';
  }

  // 5. Clean Note
  let cleanDesc = text
    .replace(/(?:rs\.?|inr|₹)\s*[\d,]+/gi, '')
    .replace(/\b\d+\s*k\b/gi, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\b(?:rupees|rupaye|spent|on|via|paid|for|ko|se|via cash|via card|via upi|via bank|kharch kiya|mile)\b/gi, '')
    .trim();

  if (!cleanDesc || cleanDesc.length < 2) {
    cleanDesc = cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  return { amt, type, cat, wallet, desc: cleanDesc, raw: text };
}
window.parseVoiceTranscript = parseVoiceTranscript;

function startVoiceForComposer() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast('Voice recognition is not supported on this browser', 'error');
    openQuickComposer('expense');
    return;
  }

  const voiceModal = document.getElementById('voice-listening-modal');
  const transcriptEl = document.getElementById('voice-live-transcript');
  if (voiceModal) voiceModal.style.display = 'flex';
  if (transcriptEl) transcriptEl.innerHTML = '<span>🎙️ Listening... speak now</span>';

  try {
    const rec = new SpeechRecognition();
    activeSpeechRecognizer = rec;
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = function(e) {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      if (transcriptEl) transcriptEl.textContent = `"${transcript}"`;

      if (e.results[0].isFinal) {
        const parsed = parseVoiceTranscript(transcript);
        stopVoiceRecording();

        if (parsed) {
          openQuickComposer(parsed.type);
          const amtInput = document.getElementById('comp-amt');
          const noteInput = document.getElementById('comp-note');
          const wSel = document.getElementById('comp-wallet');

          if (amtInput && parsed.amt > 0) amtInput.value = parsed.amt;
          if (noteInput) noteInput.value = parsed.desc;
          if (wSel && parsed.wallet) wSel.value = parsed.wallet;
          if (parsed.cat) selectComposerCategory(parsed.cat);

          toast(`🎙️ Recorded: ₹${parsed.amt || 0} (${parsed.cat})!`, 'success');
        } else {
          openQuickComposer('expense', { desc: transcript });
        }
      }
    };

    rec.onerror = function(err) {
      console.warn('Speech recognition error:', err);
      stopVoiceRecording();
      toast('Could not hear clearly. Opened composer.', 'info');
      openQuickComposer('expense');
    };

    rec.onend = function() {
      if (voiceModal && voiceModal.style.display !== 'none') {
        stopVoiceRecording();
      }
    };

    rec.start();
  } catch (err) {
    console.error('Failed to start speech recognition:', err);
    stopVoiceRecording();
    openQuickComposer('expense');
  }
}
window.startVoiceForComposer = startVoiceForComposer;

function stopVoiceRecording() {
  if (activeSpeechRecognizer) {
    try { activeSpeechRecognizer.stop(); } catch (e) {}
    activeSpeechRecognizer = null;
  }
  const voiceModal = document.getElementById('voice-listening-modal');
  if (voiceModal) voiceModal.style.display = 'none';
}
window.stopVoiceRecording = stopVoiceRecording;

// ── CSV EXPORT ──
function exportTransactionsCSV() {
  const list = window.entries || [];
  if (!list.length) {
    toast('No entries to export', 'info');
    return;
  }
  let csv = 'Date,Type,Amount (INR),Category,Description,Wallet\n';
  list.forEach(e => {
    csv += `"${e.date || ''}","${e.type || ''}","${e.amt || 0}","${e.cat || ''}","${(e.desc||e.note||'').replace(/"/g, '""')}","${e.wallet || 'cash'}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PocketTrack_Statement_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Statement CSV exported!', 'success');
}
window.exportTransactionsCSV = exportTransactionsCSV;

// ── UTILITIES ──
function getCategoryIcon(catId, type) {
  if (catId === 'transfer') return '⇄';
  const cats = CATEGORIES[type] || CATEGORIES.expense;
  const found = cats.find(c => c.id === catId);
  return found ? found.icon : (type === 'income' ? '💵' : '💸');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Today';
  const today = new Date().toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  return dateStr;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
