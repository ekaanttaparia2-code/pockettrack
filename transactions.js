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

// ── PRIVACY MODE & PIN LOCK (PROTECT BALANCE, GOALS & ENTRIES) ──
window.isPrivacyUnlockedSession = false;
let pendingUnlockCallback = null;

function isPrivacyActive() {
  const mode = localStorage.getItem('pocketTrackPrivacyMode') === 'true';
  return mode && !window.isPrivacyUnlockedSession;
}
window.isPrivacyActive = isPrivacyActive;

function openSetPinModal() {
  const m = document.getElementById('privacy-set-pin-modal');
  const pinInput = document.getElementById('set-pin-input');
  const pinConfirm = document.getElementById('set-pin-confirm');
  const errEl = document.getElementById('set-pin-error');
  if (pinInput) pinInput.value = '';
  if (pinConfirm) pinConfirm.value = '';
  if (errEl) errEl.textContent = '';
  if (m) {
    m.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
    if (pinInput) setTimeout(() => pinInput.focus(), 100);
  }
}
window.openSetPinModal = openSetPinModal;

function closeSetPinModal() {
  const m = document.getElementById('privacy-set-pin-modal');
  if (m) {
    m.style.display = 'none';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
  }
}
window.closeSetPinModal = closeSetPinModal;

function saveNewPrivacyPin() {
  const pinInput = document.getElementById('set-pin-input');
  const pinConfirm = document.getElementById('set-pin-confirm');
  const errEl = document.getElementById('set-pin-error');

  const p1 = pinInput ? pinInput.value.trim() : '';
  const p2 = pinConfirm ? pinConfirm.value.trim() : '';

  if (!p1 || p1.length < 4) {
    if (errEl) errEl.textContent = 'PIN must be at least 4 digits';
    return;
  }
  if (p1 !== p2) {
    if (errEl) errEl.textContent = 'PINs do not match. Please re-enter.';
    return;
  }

  localStorage.setItem('pocketTrackPrivacyPin', p1);
  localStorage.setItem('pocketTrackPrivacyMode', 'true');
  window.isPrivacyUnlockedSession = false;
  closeSetPinModal();
  updateHeaderStats();
  const privacySettingToggle = document.getElementById('setting-privacy-toggle');
  if (privacySettingToggle) privacySettingToggle.checked = true;
  toast('Privacy PIN set! Balance & transactions are locked 🔒', 'success');
}
window.saveNewPrivacyPin = saveNewPrivacyPin;

function openUnlockPinModal(callback = null) {
  pendingUnlockCallback = callback;
  const pin = localStorage.getItem('pocketTrackPrivacyPin');
  if (!pin) {
    openSetPinModal();
    return;
  }
  const m = document.getElementById('privacy-unlock-modal');
  const pinInput = document.getElementById('unlock-pin-input');
  const errEl = document.getElementById('unlock-pin-error');
  if (pinInput) pinInput.value = '';
  if (errEl) errEl.textContent = '';
  if (m) {
    m.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
    if (pinInput) setTimeout(() => pinInput.focus(), 100);
  }
}
window.openUnlockPinModal = openUnlockPinModal;

function closeUnlockPinModal() {
  pendingUnlockCallback = null;
  const m = document.getElementById('privacy-unlock-modal');
  if (m) {
    m.style.display = 'none';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
  }
}
window.closeUnlockPinModal = closeUnlockPinModal;

function submitUnlockPin() {
  const pinInput = document.getElementById('unlock-pin-input');
  const errEl = document.getElementById('unlock-pin-error');
  const entered = pinInput ? pinInput.value.trim() : '';
  const stored = localStorage.getItem('pocketTrackPrivacyPin') || '0000';

  if (entered === stored) {
    window.isPrivacyUnlockedSession = true;
    closeUnlockPinModal();
    updateHeaderStats();
    toast('Unlocked for this session 🔓', 'success');
    if (typeof pendingUnlockCallback === 'function') {
      const cb = pendingUnlockCallback;
      pendingUnlockCallback = null;
      cb();
    }
  } else {
    if (errEl) errEl.textContent = 'Incorrect PIN. Try again.';
    if (pinInput) { pinInput.value = ''; pinInput.focus(); }
  }
}
window.submitUnlockPin = submitUnlockPin;

function toggleBalancePrivacy() {
  if (isPrivacyActive()) {
    openUnlockPinModal();
  } else {
    window.isPrivacyUnlockedSession = false;
    localStorage.setItem('pocketTrackPrivacyMode', 'true');
    updateHeaderStats();
    toast('Privacy lock engaged 🔒', 'info');
  }
}
window.toggleBalancePrivacy = toggleBalancePrivacy;

function setPrivacyModeFromSettings(enabled) {
  if (enabled) {
    const pin = localStorage.getItem('pocketTrackPrivacyPin');
    if (!pin) {
      openSetPinModal();
    } else {
      localStorage.setItem('pocketTrackPrivacyMode', 'true');
      window.isPrivacyUnlockedSession = false;
      updateHeaderStats();
      toast('Privacy Mode enabled 🔒', 'info');
    }
  } else {
    const pin = localStorage.getItem('pocketTrackPrivacyPin');
    if (pin) {
      openUnlockPinModal(() => {
        localStorage.setItem('pocketTrackPrivacyMode', 'false');
        window.isPrivacyUnlockedSession = true;
        const toggle = document.getElementById('setting-privacy-toggle');
        if (toggle) toggle.checked = false;
        updateHeaderStats();
        toast('Privacy Mode turned OFF 👁️', 'info');
      });
    } else {
      localStorage.setItem('pocketTrackPrivacyMode', 'false');
      window.isPrivacyUnlockedSession = true;
      updateHeaderStats();
    }
  }
}
window.setPrivacyModeFromSettings = setPrivacyModeFromSettings;

function onSafeToSpendCardClick() {
  if (isPrivacyActive()) {
    openUnlockPinModal(() => openSavingsTargetModal());
  } else {
    openSavingsTargetModal();
  }
}
window.onSafeToSpendCardClick = onSafeToSpendCardClick;

function onBalanceCardClick() {
  if (isPrivacyActive()) {
    openUnlockPinModal();
  }
}
window.onBalanceCardClick = onBalanceCardClick;

// ── BALANCE & STATS SYNC ──
function updateHeaderStats() {
  const list = window.entries || [];
  const income = list.filter(e => e.type === 'income').reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const spent = list.filter(e => e.type === 'expense').reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const balance = income - spent;
  const locked = isPrivacyActive();

  const b = document.getElementById('hdr-balance');
  const inc = document.getElementById('hero-income');
  const exp = document.getElementById('hero-spent');
  const cnt = document.getElementById('hero-count');
  const eyeIcon = document.getElementById('privacy-eye-icon');

  if (eyeIcon) {
    eyeIcon.className = locked ? 'ti ti-eye-off' : 'ti ti-eye';
    eyeIcon.title = locked ? 'Click to enter PIN & unlock' : 'Click to hide balance';
  }

  if (locked) {
    if (b) { b.textContent = '₹••••••'; b.classList.add('privacy-masked'); }
    if (inc) { inc.textContent = '₹••••'; inc.classList.add('privacy-masked'); }
    if (exp) { exp.textContent = '₹••••'; exp.classList.add('privacy-masked'); }
  } else {
    if (b) { b.textContent = (balance < 0 ? '-₹' : '₹') + Math.abs(balance).toLocaleString('en-IN'); b.classList.remove('privacy-masked'); }
    if (inc) { inc.textContent = '₹' + income.toLocaleString('en-IN'); inc.classList.remove('privacy-masked'); }
    if (exp) { exp.textContent = '₹' + spent.toLocaleString('en-IN'); exp.classList.remove('privacy-masked'); }
  }
  if (cnt) cnt.textContent = String(list.length);

  // Calculate Daily Safe-to-Spend with Monthly Savings Target
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
  const savingsTarget = parseFloat(localStorage.getItem('pocketTrackSavingsTarget')) || 0;
  
  // Spendable balance protects the savings target
  const spendable = Math.max(0, balance - savingsTarget);
  const safePerDay = Math.floor(spendable / daysLeft);

  const safeEl = document.getElementById('safe-to-spend-val');
  const safeSub = document.getElementById('safe-to-spend-sub');

  if (safeEl) {
    if (locked) {
      safeEl.textContent = '₹••••/day';
      safeEl.classList.add('privacy-masked');
    } else {
      safeEl.textContent = '₹' + safePerDay.toLocaleString('en-IN') + '/day';
      safeEl.classList.remove('privacy-masked');
    }
  }

  if (safeSub) {
    if (savingsTarget > 0) {
      safeSub.textContent = `🎯 Saving ₹${savingsTarget.toLocaleString('en-IN')} · ${locked ? '₹••••' : '₹' + safePerDay.toLocaleString('en-IN')} safe today (${daysLeft}d left)`;
    } else {
      safeSub.textContent = balance > 0 
        ? `${locked ? '₹••••' : '₹' + safePerDay.toLocaleString('en-IN')} left today (${daysLeft}d left in month)`
        : `₹0 left today (${daysLeft}d left in month)`;
    }
  }

  if (!locked && typeof animateNumber === 'function') {
    animateNumber('hdr-balance', balance);
    animateNumber('hero-income', income);
    animateNumber('hero-spent', spent);
    animateNumber('hero-count', list.length, '', '');
    if (safeEl) animateNumber('safe-to-spend-val', safePerDay, '₹', '/day');
  }

  renderHomeRecent();
  renderQuickPresets();
  if (window.currentTab === 'activity') renderActivityList();
  if (window.currentTab === 'insights' && typeof renderInsightsTab === 'function') renderInsightsTab();
  if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
}
window.updateHeaderStats = updateHeaderStats;

// ── SAVINGS TARGET MODAL & MULTI-WALLET SETTINGS ──
let currentSavingsTargetWallet = 'all';

function openSavingsTargetModal(walletId = 'all') {
  currentSavingsTargetWallet = walletId || 'all';
  const m = document.getElementById('savings-modal');
  if (m) {
    // Populate wallet select
    const wSel = document.getElementById('savings-wallet-select');
    if (wSel && typeof getWallets === 'function') {
      let opts = `<option value="all">🌐 Overall (All Accounts)</option>`;
      opts += getWallets().map(w => `<option value="${w.id}">${w.icon} ${w.name}</option>`).join('');
      wSel.innerHTML = opts;
      wSel.value = currentSavingsTargetWallet;
    }

    const input = document.getElementById('savings-target-input');
    const targets = typeof getWalletSavingsTargets === 'function' ? getWalletSavingsTargets() : {};
    const current = targets[currentSavingsTargetWallet] || (currentSavingsTargetWallet === 'all' ? (localStorage.getItem('pocketTrackSavingsTarget') || '') : '');
    if (input) input.value = current > 0 ? current : '';

    m.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body && document.body.style) {
      document.body.style.overflow = 'hidden';
    }
    if (input) setTimeout(() => input.focus(), 50);
  }
}
window.openSavingsTargetModal = openSavingsTargetModal;

function closeSavingsTargetModal() {
  const m = document.getElementById('savings-modal');
  if (m) {
    m.style.display = 'none';
    if (typeof document !== 'undefined' && document.body && document.body.style) {
      document.body.style.overflow = '';
    }
  }
}
window.closeSavingsTargetModal = closeSavingsTargetModal;

function onSavingsWalletChange(walletId) {
  currentSavingsTargetWallet = walletId;
  const input = document.getElementById('savings-target-input');
  const targets = typeof getWalletSavingsTargets === 'function' ? getWalletSavingsTargets() : {};
  const current = targets[walletId] || '';
  if (input) input.value = current > 0 ? current : '';
}
window.onSavingsWalletChange = onSavingsWalletChange;

function setSavingsPreset(val) {
  const input = document.getElementById('savings-target-input');
  if (input) input.value = val > 0 ? val : '';
}
window.setSavingsPreset = setSavingsPreset;

function saveSavingsTarget() {
  const input = document.getElementById('savings-target-input');
  const wSel = document.getElementById('savings-wallet-select');
  const walletId = (wSel && wSel.value) ? wSel.value : (currentSavingsTargetWallet || 'all');
  const val = input ? parseFloat(input.value) || 0 : 0;

  if (typeof saveWalletSavingsTarget === 'function') {
    saveWalletSavingsTarget(walletId, val);
  } else {
    localStorage.setItem('pocketTrackSavingsTarget', val > 0 ? String(val) : '');
  }
  
  const settingsInput = document.getElementById('settings-savings-input');
  if (settingsInput && walletId === 'all') settingsInput.value = val > 0 ? String(val) : '';
  
  closeSavingsTargetModal();
  updateHeaderStats();
  const wName = walletId === 'all' ? 'Overall' : ((typeof getWallets === 'function' ? getWallets().find(w => w.id === walletId) : null) || {}).name || walletId;
  toast(val > 0 ? `Savings goal for ${wName} set to ₹${val.toLocaleString('en-IN')}! 🎯` : `Savings goal cleared for ${wName}`, 'success');
}
window.saveSavingsTarget = saveSavingsTarget;

function saveSavingsTargetFromSettings() {
  const wSel = document.getElementById('settings-savings-wallet');
  const walletId = wSel ? wSel.value : 'all';
  const input = document.getElementById('settings-savings-input');
  const val = input ? parseFloat(input.value) || 0 : 0;

  if (typeof saveWalletSavingsTarget === 'function') {
    saveWalletSavingsTarget(walletId, val);
  } else {
    localStorage.setItem('pocketTrackSavingsTarget', val > 0 ? String(val) : '');
  }
  updateHeaderStats();
  const wName = walletId === 'all' ? 'Overall' : (getWallets().find(w => w.id === walletId) || {}).name || walletId;
  toast(val > 0 ? `Savings Target for ${wName}: ₹${val.toLocaleString('en-IN')} 🎯` : 'Savings target cleared', 'success');
}
window.saveSavingsTargetFromSettings = saveSavingsTargetFromSettings;

function onSettingsSavingsWalletChange(walletId) {
  const input = document.getElementById('settings-savings-input');
  const targets = typeof getWalletSavingsTargets === 'function' ? getWalletSavingsTargets() : {};
  const current = targets[walletId] || '';
  if (input) input.value = current > 0 ? current : '';
}
window.onSettingsSavingsWalletChange = onSettingsSavingsWalletChange;

function onSettingsBudgetWalletChange(walletId) {
  const input = document.getElementById('budget-input');
  const budgets = typeof getWalletBudgets === 'function' ? getWalletBudgets() : {};
  const current = budgets[walletId] || (walletId === 'all' ? (localStorage.getItem('pocketTrackBudget') || '') : '');
  if (input) input.value = current > 0 ? current : '';
}
window.onSettingsBudgetWalletChange = onSettingsBudgetWalletChange;

// ── RECURRING TRANSACTIONS ENGINE ──
function getRecurringRules() {
  try {
    const raw = localStorage.getItem('pocketTrackRecurringRules');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}
window.getRecurringRules = getRecurringRules;

function saveRecurringRule(rule) {
  const rules = getRecurringRules();
  const idx = rules.findIndex(r => r.id === rule.id);
  if (idx !== -1) rules[idx] = rule;
  else rules.unshift(rule);
  localStorage.setItem('pocketTrackRecurringRules', JSON.stringify(rules));
  renderRecurringList();
}
window.saveRecurringRule = saveRecurringRule;

function deleteRecurringRule(id) {
  let rules = getRecurringRules().filter(r => r.id !== id);
  localStorage.setItem('pocketTrackRecurringRules', JSON.stringify(rules));
  renderRecurringList();
  toast('Recurring rule deleted', 'info');
}
window.deleteRecurringRule = deleteRecurringRule;

function toggleRecurringRule(id) {
  const rules = getRecurringRules();
  const r = rules.find(x => x.id === id);
  if (r) {
    r.active = !r.active;
    localStorage.setItem('pocketTrackRecurringRules', JSON.stringify(rules));
    renderRecurringList();
    toast(r.active ? 'Recurring rule enabled 🔁' : 'Recurring rule paused ⏸️', 'info');
  }
}
window.toggleRecurringRule = toggleRecurringRule;

function advanceDueDate(currentDateStr, freq) {
  const d = new Date(currentDateStr || new Date().toISOString().split('T')[0]);
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // default monthly
  return d.toISOString().split('T')[0];
}
window.advanceDueDate = advanceDueDate;

function checkAndProcessRecurring() {
  const rules = getRecurringRules();
  if (!rules.length) return 0;

  const todayStr = new Date().toISOString().split('T')[0];
  let processed = 0;

  rules.forEach(r => {
    if (!r.active) return;
    const dueDate = r.nextDueDate || todayStr;
    if (dueDate <= todayStr && r.lastProcessedDate !== todayStr) {
      const newEntry = {
        id: 'rec_entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        amt: parseFloat(r.amt),
        type: r.type || 'expense',
        cat: r.cat || 'other',
        desc: `🔁 ${r.desc || 'Recurring Payment'}`,
        date: todayStr,
        wallet: r.wallet || 'cash',
        recurringRuleId: r.id,
        createdAt: Date.now()
      };
      window.entries.unshift(newEntry);
      r.lastProcessedDate = todayStr;
      r.nextDueDate = advanceDueDate(todayStr, r.frequency || 'monthly');
      processed++;
    }
  });

  if (processed > 0) {
    localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
    localStorage.setItem('pocketTrackRecurringRules', JSON.stringify(rules));
    updateHeaderStats();
    toast(`🔁 Automatically processed ${processed} recurring bill/income!`, 'success');
  }
  return processed;
}
window.checkAndProcessRecurring = checkAndProcessRecurring;

function openRecurringModal() {
  const m = document.getElementById('recurring-modal');
  if (m) {
    renderRecurringList();
    m.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body && document.body.style) {
      document.body.style.overflow = 'hidden';
    }
  }
}
window.openRecurringModal = openRecurringModal;

function closeRecurringModal() {
  const m = document.getElementById('recurring-modal');
  if (m) {
    m.style.display = 'none';
    if (typeof document !== 'undefined' && document.body && document.body.style) {
      document.body.style.overflow = '';
    }
  }
}
window.closeRecurringModal = closeRecurringModal;

function renderRecurringList() {
  const container = document.getElementById('recurring-rules-list');
  const settingsContainer = document.getElementById('settings-recurring-list');
  const rules = getRecurringRules();

  let html = '';
  if (!rules.length) {
    html = `<div style="padding:24px 0;text-align:center;color:var(--text-dim);font-size:13px;">No recurring expenses or incomes set yet. Toggle "Repeat" in the Composer to add one! 🔁</div>`;
  } else {
    rules.forEach(r => {
      const isInc = r.type === 'income';
      const catIcon = getCategoryIcon(r.cat, r.type);
      html += `
        <div class="recurring-card ${r.active ? '' : 'paused'}">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-size:22px;">${catIcon}</div>
            <div>
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="font-size:13.5px;color:var(--text);">${escapeHtml(r.desc || 'Recurring')}</strong>
                <span class="recurring-badge">${r.frequency || 'monthly'}</span>
              </div>
              <span style="font-size:11px;color:var(--text-dim);display:block;margin-top:2px;">
                ${isInc ? '+₹' : '-₹'}${parseFloat(r.amt).toLocaleString('en-IN')} · Next: ${r.nextDueDate || 'Today'}
              </span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="icon-btn" onclick="toggleRecurringRule('${r.id}')" title="${r.active ? 'Pause rule' : 'Enable rule'}" style="font-size:16px;">
              <i class="ti ti-${r.active ? 'player-pause' : 'player-play'}"></i>
            </button>
            <button class="icon-btn" onclick="deleteRecurringRule('${r.id}')" title="Delete rule" style="color:var(--red);font-size:15px;">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
  }

  if (container) container.innerHTML = html;
  if (settingsContainer) settingsContainer.innerHTML = html;
}
window.renderRecurringList = renderRecurringList;

// ── RECENT ACTIVITY ON HOME (Top 5) ──
function renderHomeRecent() {
  const container = document.getElementById('home-recent-activity');
  if (!container) return;
  const list = window.entries || [];
  const locked = isPrivacyActive();

  if (!list.length) {
    container.innerHTML = `<div class="empty-mini" style="padding:24px 0;text-align:center;color:var(--text-dim);font-size:13px;">No entries logged yet. Tap <strong>Expense</strong> or <strong>Income</strong> above!</div>`;
    return;
  }

  const top5 = list.slice(0, 5);
  let rowsHtml = '';
  top5.forEach(e => {
    const isInc = e.type === 'income';
    const isTr = e.cat === 'transfer';
    const amtClass = isTr ? 'transfer' : (isInc ? 'income' : 'expense');
    const sign = isTr ? '' : (isInc ? '+₹' : '-₹');
    const catIcon = getCategoryIcon(e.cat, e.type);
    const displayAmt = locked ? '₹••••' : `${sign}${parseFloat(e.amt || 0).toLocaleString('en-IN')}`;

    rowsHtml += `
      <div class="entry-row" onclick="${locked ? 'openUnlockPinModal()' : `startEditEntry('${e.id}')`}">
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
        <div class="entry-amt ${amtClass} ${locked ? 'privacy-masked' : ''}">${displayAmt}</div>
      </div>
    `;
  });

  if (locked) {
    container.innerHTML = `
      <div style="position:relative;">
        <div class="privacy-barrier-overlay" onclick="openUnlockPinModal()">
          <span style="font-size:22px;">🔒</span>
          <span style="font-size:12.5px;font-weight:800;color:var(--text);">Transactions Hidden</span>
          <span style="font-size:11px;color:var(--text-dim);">Tap to enter PIN & unlock</span>
        </div>
        <div class="privacy-blur">
          ${rowsHtml}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = rowsHtml;
  }
}
window.renderHomeRecent = renderHomeRecent;
window.renderHomeSnapshot = renderHomeRecent;

// ── FULL ACTIVITY PASSBOOK ──
function renderActivityList() {
  const container = document.getElementById('entries-list');
  if (!container) return;
  let list = window.entries || [];
  const locked = isPrivacyActive();

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

  let rowsHtml = '';
  list.forEach(e => {
    const isInc = e.type === 'income';
    const isTr = e.cat === 'transfer';
    const amtClass = isTr ? 'transfer' : (isInc ? 'income' : 'expense');
    const sign = isTr ? '' : (isInc ? '+₹' : '-₹');
    const catIcon = getCategoryIcon(e.cat, e.type);
    const displayAmt = locked ? '₹••••' : `${sign}${parseFloat(e.amt || 0).toLocaleString('en-IN')}`;

    rowsHtml += `
      <div class="entry-row" onclick="${locked ? 'openUnlockPinModal()' : `startEditEntry('${e.id}')`}">
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
        <div class="entry-amt ${amtClass} ${locked ? 'privacy-masked' : ''}">${displayAmt}</div>
      </div>
    `;
  });

  if (locked) {
    container.innerHTML = `
      <div style="position:relative;">
        <div class="privacy-barrier-overlay" onclick="openUnlockPinModal()">
          <span style="font-size:24px;">🔒</span>
          <span style="font-size:13.5px;font-weight:800;color:var(--text);">Passbook Locked</span>
          <span style="font-size:11px;color:var(--text-dim);">Tap to enter PIN & view amounts</span>
        </div>
        <div class="privacy-blur">
          ${rowsHtml}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = rowsHtml;
  }
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
    const recCheck = document.getElementById('comp-is-recurring');
    const recFreqWrap = document.getElementById('comp-recurring-freq-wrap');
    if (recCheck) recCheck.checked = false;
    if (recFreqWrap) recFreqWrap.style.display = 'none';
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

function toggleComposerRecurring(checked) {
  const wrap = document.getElementById('comp-recurring-freq-wrap');
  if (wrap) wrap.style.display = checked ? 'flex' : 'none';
}
window.toggleComposerRecurring = toggleComposerRecurring;

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
    
    // Check if recurring option was selected
    const recCheck = document.getElementById('comp-is-recurring');
    const freqSelect = document.getElementById('comp-recurring-freq');
    if (recCheck && recCheck.checked) {
      const freq = freqSelect ? freqSelect.value : 'monthly';
      const rule = {
        id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        amt,
        type,
        cat,
        desc: desc || (cat.charAt(0).toUpperCase() + cat.slice(1)),
        wallet,
        frequency: freq,
        nextDueDate: advanceDueDate(date, freq),
        lastProcessedDate: date,
        active: true,
        createdAt: Date.now()
      };
      saveRecurringRule(rule);
      toast(`Added entry & set ${freq} recurring rule! 🔁`, 'success');
    } else {
      toast(type === 'income' ? `Added +₹${amt} Income! 💵` : `Added -₹${amt} Expense! 💸`, 'success');
    }
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

// ── QUICK SPEND PRESETS ("SPEED DIAL") ──
function getQuickPresets() {
  try {
    const raw = localStorage.getItem('pocketTrackQuickPresets');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    { id: 'p_chai', name: 'Chai', amt: 20, icon: '☕', cat: 'food', wallet: 'cash' },
    { id: 'p_metro', name: 'Metro / Auto', amt: 40, icon: '🚇', cat: 'transport', wallet: 'bank' },
    { id: 'p_snacks', name: 'Snacks', amt: 50, icon: '🥪', cat: 'food', wallet: 'cash' },
    { id: 'p_fuel', name: 'Fuel', amt: 200, icon: '⛽', cat: 'transport', wallet: 'card' }
  ];
}
window.getQuickPresets = getQuickPresets;

function saveQuickPresets(list) {
  localStorage.setItem('pocketTrackQuickPresets', JSON.stringify(list));
  renderQuickPresets();
}
window.saveQuickPresets = saveQuickPresets;

function renderQuickPresets() {
  const container = document.getElementById('quick-presets-bar');
  if (!container) return;
  const presets = getQuickPresets();
  let html = presets.map(p => `
    <button type="button" class="quick-preset-chip" onclick="logQuickPreset('${p.id}')" title="1-Tap Log: ${p.name} ₹${p.amt}">
      <span>${p.icon || '⚡'}</span>
      <span>${escapeHtml(p.name)}</span>
      <span style="color:var(--accent);">₹${p.amt}</span>
    </button>
  `).join('');
  html += `
    <button type="button" class="quick-preset-chip add-chip" onclick="openAddPresetModal()" title="Add Custom Quick Preset">
      <i class="ti ti-plus"></i>
      <span>Add Preset</span>
    </button>
  `;
  container.innerHTML = html;
}
window.renderQuickPresets = renderQuickPresets;

function logQuickPreset(presetId) {
  const preset = getQuickPresets().find(p => p.id === presetId);
  if (!preset) return;
  // Open composer pre-filled with preset values so user can adjust or confirm (2-Tap Quick Log)
  openQuickComposer('expense', {
    amt: preset.amt,
    desc: preset.name,
    cat: preset.cat,
    wallet: preset.wallet
  });
  toast(`⚡ ${preset.icon || ''} ${preset.name} ready — adjust or tap Save!`, 'info');
}
window.logQuickPreset = logQuickPreset;

function openAddPresetModal() {
  const m = document.getElementById('preset-modal');
  if (m) {
    const wSel = document.getElementById('new-preset-wallet');
    if (wSel && typeof getWallets === 'function') {
      wSel.innerHTML = getWallets().map(w => `<option value="${w.id}">${w.icon} ${w.name}</option>`).join('');
    }
    m.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
  }
}
window.openAddPresetModal = openAddPresetModal;

function closeAddPresetModal() {
  const m = document.getElementById('preset-modal');
  if (m) {
    m.style.display = 'none';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
  }
}
window.closeAddPresetModal = closeAddPresetModal;

function saveCustomQuickPreset() {
  const nameInput = document.getElementById('new-preset-name');
  const amtInput = document.getElementById('new-preset-amt');
  const iconInput = document.getElementById('new-preset-icon');
  const catInput = document.getElementById('new-preset-cat');
  const walletInput = document.getElementById('new-preset-wallet');

  if (!nameInput || !nameInput.value.trim()) {
    toast('Please enter a preset name', 'error');
    return;
  }
  const amt = parseFloat(amtInput ? amtInput.value : 0);
  if (!amt || amt <= 0) {
    toast('Please enter a valid amount', 'error');
    return;
  }

  const newPreset = {
    id: 'p_' + Date.now(),
    name: nameInput.value.trim(),
    amt,
    icon: (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : '⚡',
    cat: catInput ? catInput.value : 'food',
    wallet: walletInput ? walletInput.value : 'cash'
  };

  const list = getQuickPresets();
  list.push(newPreset);
  saveQuickPresets(list);
  toast(`Quick preset "${newPreset.name}" added! ⚡`, 'success');
  nameInput.value = '';
  if (amtInput) amtInput.value = '';
  closeAddPresetModal();
}
window.saveCustomQuickPreset = saveCustomQuickPreset;

// ── ENHANCED CSV / EXCEL PASSBOOK EXPORT ──
function exportTransactionsCSV() {
  const list = window.entries || [];
  if (!list.length) {
    toast('No entries to export yet', 'info');
    return;
  }
  
  let csv = '=====================================================\r\n';
  csv += 'POCKETTRACK FINANCIAL PASSBOOK REPORT\r\n';
  csv += `Generated: ${new Date().toLocaleString('en-IN')}\r\n`;
  csv += `Total Entries: ${list.length}\r\n`;
  csv += '=====================================================\r\n\r\n';
  
  csv += '"Transaction ID","Date","Type","Category","Account/Wallet","Description","Amount (INR)","Transfer Group ID"\r\n';
  
  list.forEach(e => {
    const id = e.id || '';
    const date = e.date || '';
    const type = (e.type || '').toUpperCase();
    const cat = (e.cat || '').toUpperCase();
    const wallet = (e.wallet || 'cash').toUpperCase();
    const desc = (e.desc || e.note || '').replace(/"/g, '""');
    const amt = parseFloat(e.amt) || 0;
    const transferId = e.transferGroupId || '';
    csv += `"${id}","${date}","${type}","${cat}","${wallet}","${desc}","${amt}","${transferId}"\r\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PocketTrack_Passbook_${new Date().toISOString().split('T')[0]}.csv`;
  if (typeof document !== 'undefined' && document.body) {
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  URL.revokeObjectURL(url);
  toast('Passbook CSV exported successfully! 📊', 'success');
}
window.exportTransactionsCSV = exportTransactionsCSV;

// ── CLEAN 1-PAGE PDF FINANCIAL STATEMENT ──
function downloadMonthlyPDFStatement(monthStr) {
  if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    toast('PDF library loading, please try again in a moment', 'info');
    return;
  }
  const PDFClass = (typeof window.jspdf !== 'undefined') ? window.jspdf.jsPDF : jsPDF;
  const doc = new PDFClass({ unit: 'pt', format: 'a4' });

  const targetMonth = monthStr || currentInsightsMonth || new Date().toISOString().slice(0, 7);
  const data = typeof getInsightsData === 'function' ? getInsightsData(targetMonth) : null;
  const allEntries = (window.entries || []).filter(e => e.date && e.date.startsWith(targetMonth));

  // 1. Header Banner
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 595, 75, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PocketTrack', 40, 42);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Monthly Financial Statement', 40, 58);

  const monthName = typeof formatMonthLabel === 'function' ? formatMonthLabel(targetMonth) : targetMonth;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(monthName, 555, 42, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, 555, 58, { align: 'right' });

  // 2. Summary Boxes
  let y = 95;
  const inc = data ? data.totalIncome : 0;
  const exp = data ? data.totalExpense : 0;
  const sav = inc - exp;

  // Box 1: Total Income
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.roundedRect(40, y, 160, 46, 6, 6, 'FD');
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL INCOME', 50, y + 16);
  doc.setFontSize(13);
  doc.text(`Rs. ${inc.toLocaleString('en-IN')}`, 50, y + 34);

  // Box 2: Total Spent
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(239, 68, 68);
  doc.roundedRect(217, y, 160, 46, 6, 6, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL SPENT', 227, y + 16);
  doc.setFontSize(13);
  doc.text(`Rs. ${exp.toLocaleString('en-IN')}`, 227, y + 34);

  // Box 3: Net Savings
  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(124, 58, 237);
  doc.roundedRect(395, y, 160, 46, 6, 6, 'FD');
  doc.setTextColor(91, 33, 182);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('NET SAVINGS', 405, y + 16);
  doc.setFontSize(13);
  doc.text(`Rs. ${sav.toLocaleString('en-IN')}`, 405, y + 34);

  // 3. Transactions Table Header
  y = 160;
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Transaction Details', 40, y);

  y += 12;
  doc.setFillColor(241, 245, 249);
  doc.rect(40, y, 515, 20, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DATE', 50, y + 13);
  doc.text('CATEGORY', 120, y + 13);
  doc.text('WALLET', 205, y + 13);
  doc.text('DESCRIPTION / NOTE', 285, y + 13);
  doc.text('AMOUNT', 540, y + 13, { align: 'right' });

  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  if (!allEntries.length) {
    doc.setTextColor(148, 163, 184);
    doc.text('No transaction records found for this month.', 40, y + 18);
  } else {
    allEntries.slice(0, 24).forEach((e, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(40, y - 2, 515, 16, 'F');
      }
      doc.setTextColor(51, 65, 85);
      doc.text(e.date || '-', 50, y + 10);
      doc.text((e.cat || 'other').toUpperCase(), 120, y + 10);
      doc.text((e.wallet || 'cash').toUpperCase(), 205, y + 10);
      const desc = (e.desc || '-').substring(0, 30);
      doc.text(desc, 285, y + 10);

      if (e.type === 'income') {
        doc.setTextColor(22, 163, 74);
        doc.text(`+Rs. ${parseFloat(e.amt).toLocaleString('en-IN')}`, 540, y + 10, { align: 'right' });
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text(`-Rs. ${parseFloat(e.amt).toLocaleString('en-IN')}`, 540, y + 10, { align: 'right' });
      }
      y += 16;
    });
  }

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('PocketTrack · Clean Personal Finance · https://pockettrack-bay.vercel.app', 297, 810, { align: 'center' });

  doc.save(`PocketTrack_Statement_${targetMonth}.pdf`);
  toast('Statement PDF downloaded! 📄', 'success');
}
window.downloadMonthlyPDFStatement = downloadMonthlyPDFStatement;

// ── UTILITIES ──
function getCategoryIcon(catId, type) {
  if (catId === 'transfer') return '⇄';
  const cats = CATEGORIES[type] || CATEGORIES.expense;
  const found = cats.find(c => c.id === catId);
  return found ? found.icon : (type === 'income' ? '💵' : '💸');
}
window.getCategoryIcon = getCategoryIcon;

function formatDate(dateStr) {
  if (!dateStr) return 'Today';
  const today = new Date().toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  return dateStr;
}
window.formatDate = formatDate;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
window.escapeHtml = escapeHtml;

