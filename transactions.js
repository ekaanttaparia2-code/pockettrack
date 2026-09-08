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
    if (typeof smoothOpenModal === 'function') {
      smoothOpenModal(m);
    } else {
      m.style.display = 'flex';
      if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
    }
    if (pinInput) setTimeout(() => pinInput.focus(), 100);
  }
}
window.openSetPinModal = openSetPinModal;

function closeSetPinModal() {
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('privacy-set-pin-modal');
  } else {
    const m = document.getElementById('privacy-set-pin-modal');
    if (m) {
      m.style.display = 'none';
      if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
    }
  }
}
window.closeSetPinModal = closeSetPinModal;

// Salted cryptographic hash for client-side screen privacy shield (prevents plain-text exposure in storage/DevTools)
function hashPrivacyPin(pin) {
  if (!pin) return '';
  const salt = 'pt_salt_x92_';
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const str = salt + pin;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'pt_h_' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
window.hashPrivacyPin = hashPrivacyPin;

function verifyPrivacyPin(entered, stored) {
  if (!stored) return false;
  if (stored.startsWith('pt_h_')) {
    return hashPrivacyPin(entered) === stored;
  }
  // Auto-upgrade legacy plain-text PIN to salted hash
  if (entered === stored) {
    try {
      localStorage.setItem('pocketTrackPrivacyPin', hashPrivacyPin(entered));
    } catch (e) {
      console.warn('Failed upgrading legacy PIN hash:', e);
    }
    return true;
  }
  return false;
}
window.verifyPrivacyPin = verifyPrivacyPin;

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

  // Store only salted cryptographic hash (never plaintext)
  localStorage.setItem('pocketTrackPrivacyPin', hashPrivacyPin(p1));
  localStorage.setItem('pocketTrackPrivacyMode', 'true');
  window.isPrivacyUnlockedSession = false;
  closeSetPinModal();
  updateHeaderStats();
  const privacySettingToggle = document.getElementById('setting-privacy-toggle');
  if (privacySettingToggle) privacySettingToggle.checked = true;
  toast('Screen Privacy Shield active! Balances & transactions are masked 🔒', 'success');
}
window.saveNewPrivacyPin = saveNewPrivacyPin;

function openUnlockPinModal(callback = null) {
  pendingUnlockCallback = callback;
  const pin = localStorage.getItem('pocketTrackPrivacyPin');
  if (!pin) {
    // If user has not set a PIN, unmask instantly without forcing PIN creation
    window.isPrivacyUnlockedSession = true;
    localStorage.setItem('pocketTrackPrivacyMode', 'false');
    updateHeaderStats();
    if (typeof callback === 'function') callback();
    toast('Balance unmasked 👁️', 'info');
    return;
  }
  const m = document.getElementById('privacy-unlock-modal');
  const pinInput = document.getElementById('unlock-pin-input');
  const errEl = document.getElementById('unlock-pin-error');
  if (pinInput) pinInput.value = '';
  if (errEl) errEl.textContent = '';
  if (m) {
    if (typeof smoothOpenModal === 'function') {
      smoothOpenModal(m);
    } else {
      m.style.display = 'flex';
      if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
    }
    if (pinInput) setTimeout(() => pinInput.focus(), 100);
  }
}
window.openUnlockPinModal = openUnlockPinModal;

function closeUnlockPinModal() {
  pendingUnlockCallback = null;
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('privacy-unlock-modal');
  } else {
    const m = document.getElementById('privacy-unlock-modal');
    if (m) {
      m.style.display = 'none';
      if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
    }
  }
}
window.closeUnlockPinModal = closeUnlockPinModal;

function submitUnlockPin() {
  const pinInput = document.getElementById('unlock-pin-input');
  const errEl = document.getElementById('unlock-pin-error');
  const entered = pinInput ? pinInput.value.trim() : '';
  const stored = localStorage.getItem('pocketTrackPrivacyPin') || '';

  if (verifyPrivacyPin(entered, stored)) {
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
  const pin = localStorage.getItem('pocketTrackPrivacyPin');
  if (isPrivacyActive()) {
    if (pin) {
      openUnlockPinModal();
    } else {
      window.isPrivacyUnlockedSession = true;
      localStorage.setItem('pocketTrackPrivacyMode', 'false');
      updateHeaderStats();
      toast('Balance visible 👁️', 'info');
    }
  } else {
    window.isPrivacyUnlockedSession = false;
    localStorage.setItem('pocketTrackPrivacyMode', 'true');
    updateHeaderStats();
    toast('Balance hidden 🙈', 'info');
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
    openUnlockPinModal(() => openSafeToSpendBreakdown());
  } else {
    openSafeToSpendBreakdown();
  }
}
window.onSafeToSpendCardClick = onSafeToSpendCardClick;

function openSafeToSpendBreakdown() {
  if (isPrivacyActive()) {
    openUnlockPinModal(() => openSafeToSpendBreakdown());
    return;
  }
  const m = document.getElementById('safe-to-spend-breakdown-modal');
  if (!m) return;
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
  const savingsTarget = parseFloat(localStorage.getItem('pocketTrackSavingsTarget')) || 0;
  const list = window.entries || [];
  const income = list.filter(e => e.type === 'income').reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const spent = list.filter(e => e.type === 'expense').reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const balance = income - spent;
  const todayStr = today.toISOString().split('T')[0];
  const monthEndStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const recurringRules = typeof getRecurringRules === 'function' ? getRecurringRules() : [];
  const fixedBills = recurringRules
    .filter(r => r.active && r.type === 'expense' && r.nextDueDate && r.nextDueDate >= todayStr && r.nextDueDate <= monthEndStr)
    .reduce((sum, r) => sum + (parseFloat(r.amt) || 0), 0);
  const spendable = Math.max(0, balance - fixedBills - savingsTarget);
  const safePerDay = balance <= 0 ? 0 : Math.floor(spendable / daysLeft);

  const bEl = document.getElementById('breakdown-balance-val');
  const fEl = document.getElementById('breakdown-bills-val');
  const sEl = document.getElementById('breakdown-goal-val');
  const dEl = document.getElementById('breakdown-days-val');
  const resEl = document.getElementById('breakdown-result-val');

  if (bEl) bEl.textContent = '₹' + Math.max(0, balance).toLocaleString('en-IN');
  if (fEl) fEl.textContent = '₹' + fixedBills.toLocaleString('en-IN');
  if (sEl) sEl.textContent = '₹' + savingsTarget.toLocaleString('en-IN');
  if (dEl) dEl.textContent = `${daysLeft} days`;
  if (resEl) resEl.textContent = '₹' + safePerDay.toLocaleString('en-IN') + ' / day';

  if (typeof smoothOpenModal === 'function') {
    smoothOpenModal(m);
  } else {
    m.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body && document.body.style) {
      document.body.style.overflow = 'hidden';
    }
  }
}
window.openSafeToSpendBreakdown = openSafeToSpendBreakdown;

function closeSafeToSpendBreakdown() {
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('safe-to-spend-breakdown-modal');
  } else {
    const m = document.getElementById('safe-to-spend-breakdown-modal');
    if (m) {
      m.style.display = 'none';
      if (typeof document !== 'undefined' && document.body && document.body.style) {
        document.body.style.overflow = '';
      }
    }
  }
}
window.closeSafeToSpendBreakdown = closeSafeToSpendBreakdown;

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
    if (b) { b.textContent = '₹••••••'; b.classList.add('privacy-masked'); b._prevNumVal = undefined; }
    if (inc) { inc.textContent = '₹••••'; inc.classList.add('privacy-masked'); inc._prevNumVal = undefined; }
    if (exp) { exp.textContent = '₹••••'; exp.classList.add('privacy-masked'); exp._prevNumVal = undefined; }
  } else {
    if (b) {
      b.classList.remove('privacy-masked');
      if (typeof animateNumber === 'function') {
        animateNumber('hdr-balance', balance, '₹', '', 320);
      } else {
        b.textContent = (balance < 0 ? '-₹' : '₹') + Math.abs(balance).toLocaleString('en-IN');
      }
    }
  }
  if (cnt) cnt.textContent = String(list.length);

  // Calculate Daily Safe-to-Spend with Monthly Savings Target & Remaining Fixed Bills
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
  const savingsTarget = parseFloat(localStorage.getItem('pocketTrackSavingsTarget')) || 0;
  const todayStr = today.toISOString().split('T')[0];
  const monthEndStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const recurringRules = typeof getRecurringRules === 'function' ? getRecurringRules() : [];
  const fixedBills = recurringRules
    .filter(r => r.active && r.type === 'expense' && r.nextDueDate && r.nextDueDate >= todayStr && r.nextDueDate <= monthEndStr)
    .reduce((sum, r) => sum + (parseFloat(r.amt) || 0), 0);
  
  // Spendable balance protects remaining fixed bills and savings goal: (Balance - fixed bills - savings goal) / days left
  const spendable = Math.max(0, balance - fixedBills - savingsTarget);
  const safePerDay = balance <= 0 ? 0 : Math.floor(spendable / daysLeft);

  const safeEl = document.getElementById('safe-to-spend-val');
  const targetEl = document.getElementById('hero-target-display');
  const balSub = document.getElementById('hero-balance-sub');

  if (balSub) {
    if (locked) {
      balSub.innerHTML = 'Spent <span id="hero-spent" style="font-weight:700;">₹••••</span> this month · <span id="hero-income" style="font-weight:700;">₹••••</span> income';
    } else {
      const curExp = document.getElementById('hero-spent');
      const curInc = document.getElementById('hero-income');
      if (!curExp || !curInc) {
        balSub.innerHTML = 'Spent <span id="hero-spent" style="font-weight:700;">₹' + spent.toLocaleString('en-IN') + '</span> this month · <span id="hero-income" style="font-weight:700;">₹' + income.toLocaleString('en-IN') + '</span> income';
      } else {
        if (typeof animateNumber === 'function') {
          animateNumber('hero-spent', spent, '₹', '', 300);
          animateNumber('hero-income', income, '₹', '', 300);
        } else {
          curExp.textContent = '₹' + spent.toLocaleString('en-IN');
          curInc.textContent = '₹' + income.toLocaleString('en-IN');
        }
      }
    }
  }

  if (safeEl) {
    if (locked) {
      safeEl.textContent = '₹••••';
      safeEl.classList.add('privacy-masked');
      safeEl._prevNumVal = undefined;
    } else {
      safeEl.classList.remove('privacy-masked');
      if (typeof animateNumber === 'function') {
        animateNumber('safe-to-spend-val', safePerDay, '₹', '', 300);
      } else {
        safeEl.textContent = '₹' + safePerDay.toLocaleString('en-IN');
      }
    }
  }

  if (targetEl) {
    if (locked) {
      targetEl.textContent = '₹••••';
      targetEl.style.color = 'var(--text-dim)';
    } else if (savingsTarget > 0) {
      targetEl.textContent = `🎯 ₹${savingsTarget.toLocaleString('en-IN')} goal`;
      targetEl.style.color = 'var(--green)';
    } else {
      targetEl.innerHTML = `<span style="font-size:12px;font-weight:700;color:var(--green);text-decoration:underline;">Set Goal</span>`;
    }
  }

  const safeSub = document.getElementById('safe-to-spend-sub');
  if (safeSub) {
    if (savingsTarget > 0) {
      safeSub.textContent = `🎯 Saving ₹${savingsTarget.toLocaleString('en-IN')} · ${locked ? '₹••••' : '₹' + safePerDay.toLocaleString('en-IN')} safe today (${daysLeft}d left)`;
    } else {
      safeSub.textContent = balance > 0 
        ? `${locked ? '₹••••' : '₹' + safePerDay.toLocaleString('en-IN')} left today (${daysLeft}d left in month)`
        : `₹0 left today (${daysLeft}d left in month)`;
    }
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

    if (typeof smoothOpenModal === 'function') {
      smoothOpenModal(m);
    } else {
      m.style.display = 'flex';
      if (typeof document !== 'undefined' && document.body && document.body.style) {
        document.body.style.overflow = 'hidden';
      }
    }
    if (input) setTimeout(() => input.focus(), 50);
  }
}
window.openSavingsTargetModal = openSavingsTargetModal;

function closeSavingsTargetModal() {
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('savings-modal');
  } else {
    const m = document.getElementById('savings-modal');
    if (m) {
      m.style.display = 'none';
      if (typeof document !== 'undefined' && document.body && document.body.style) {
        document.body.style.overflow = '';
      }
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
  if (!input) return;
  const budgets = typeof getWalletBudgets === 'function' ? getWalletBudgets() : {};
  const current = budgets[walletId] || (walletId === 'all' ? (localStorage.getItem('pocketTrackBudget') || '') : '');
  input.value = current > 0 ? current : '';
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
    if (typeof smoothOpenModal === 'function') {
      smoothOpenModal(m);
    } else {
      m.style.display = 'flex';
      if (typeof document !== 'undefined' && document.body && document.body.style) {
        document.body.style.overflow = 'hidden';
      }
    }
  }
}
window.openRecurringModal = openRecurringModal;

function closeRecurringModal() {
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('recurring-modal');
  } else {
    const m = document.getElementById('recurring-modal');
    if (m) {
      m.style.display = 'none';
      if (typeof document !== 'undefined' && document.body && document.body.style) {
        document.body.style.overflow = '';
      }
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
    container.innerHTML = `<div class="empty-mini" style="padding:24px 0;text-align:center;color:var(--text-dim);font-size:13px;">No entries yet. Tap Expense or Income to start.</div>`;
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

// ── FULL ACTIVITY PASSBOOK (Date-Grouped with Running Balance) ──
let currentActivityCategoryFilter = 'all';
window.currentActivityCategoryFilter = 'all';

function renderActivityList() {
  const container = document.getElementById('entries-list');
  if (!container) return;
  const allEntries = window.entries || [];
  const locked = isPrivacyActive();

  // If no transactions exist at all
  if (!allEntries.length) {
    container.innerHTML = `
      <div class="empty-mini" style="padding:40px 16px;text-align:center;">
        <span style="font-size:32px;display:block;margin-bottom:8px;">📋</span>
        <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0 0 6px;">Nothing logged yet.</h3>
        <p style="font-size:12.5px;color:var(--text-dim);margin:0 0 16px;">Tap <strong>Expense</strong> or <strong>Income</strong> to start tracking.</p>
        <button class="btn btn-primary" onclick="openQuickComposer('expense')" style="padding:10px 20px;font-size:13px;border-radius:12px;font-weight:700;">+ Add Expense</button>
      </div>
    `;
    return;
  }

  // 1. Calculate Running Balance Chronologically (Oldest to Newest)
  const chronological = [...allEntries].sort((a, b) => {
    const dComp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dComp !== 0) return dComp;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  let running = 0;
  const runningBalMap = {};
  chronological.forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') running += amt;
    else if (e.type === 'expense') running -= amt;
    runningBalMap[e.id] = running;
  });

  // 2. Filter & Search on View List (Newest first)
  let filtered = [...allEntries].sort((a, b) => {
    const dComp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dComp !== 0) return dComp;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  // Type filter
  if (currentActivityFilter !== 'all') {
    if (currentActivityFilter === 'transfer') {
      filtered = filtered.filter(e => e.cat === 'transfer');
    } else {
      filtered = filtered.filter(e => e.type === currentActivityFilter && e.cat !== 'transfer');
    }
  }

  // Category filter
  if (currentActivityCategoryFilter !== 'all') {
    filtered = filtered.filter(e => e.cat === currentActivityCategoryFilter);
  }

  // Search filter
  if (currentSearchQuery.trim()) {
    const q = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(e => 
      (e.desc && e.desc.toLowerCase().includes(q)) || 
      (e.note && e.note.toLowerCase().includes(q)) || 
      (e.cat && e.cat.toLowerCase().includes(q)) || 
      String(e.amt).includes(q)
    );
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-mini" style="padding:32px 0;text-align:center;color:var(--text-dim);font-size:13px;">No transactions match your filters.</div>`;
    return;
  }

  // 3. Group by Date
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const dateGroups = {};
  filtered.forEach(e => {
    const d = e.date || todayStr;
    if (!dateGroups[d]) dateGroups[d] = { entries: [], dayTotal: 0 };
    dateGroups[d].entries.push(e);
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') dateGroups[d].dayTotal += amt;
    else if (e.type === 'expense') dateGroups[d].dayTotal -= amt;
  });

  let html = '';
  Object.keys(dateGroups).forEach(dateKey => {
    const group = dateGroups[dateKey];
    let label = formatDate(dateKey);
    if (dateKey === todayStr) label = `Today · ${label}`;
    else if (dateKey === yesterdayStr) label = `Yesterday · ${label}`;

    const totalSign = group.dayTotal >= 0 ? '+₹' : '-₹';
    const totalColor = group.dayTotal >= 0 ? 'var(--green)' : 'var(--text-dim)';
    const dayTotalFormatted = locked ? '₹••••' : `${totalSign}${Math.abs(group.dayTotal).toLocaleString('en-IN')}`;

    html += `
      <div class="activity-date-header">
        <span>${label}</span>
        <span class="activity-date-total" style="color:${totalColor};">${dayTotalFormatted}</span>
      </div>
    `;

    group.entries.forEach(e => {
      const isInc = e.type === 'income';
      const isTr = e.cat === 'transfer';
      const amtClass = isTr ? 'transfer' : (isInc ? 'income' : 'expense');
      const sign = isTr ? '' : (isInc ? '+₹' : '-₹');
      const catIcon = getCategoryIcon(e.cat, e.type);
      const displayAmt = locked ? '₹••••' : `${sign}${parseFloat(e.amt || 0).toLocaleString('en-IN')}`;
      const rBal = runningBalMap[e.id];
      const rBalFormatted = (rBal !== undefined && !locked) ? `Bal: ₹${rBal.toLocaleString('en-IN')}` : '';

      html += `
        <div class="entry-row" onclick="${locked ? 'openUnlockPinModal()' : `startEditEntry('${e.id}')`}">
          <div class="entry-left">
            <div class="entry-icon">${catIcon}</div>
            <div class="entry-main">
              <div class="entry-title">${escapeHtml(e.desc || e.note || e.cat || 'Transaction')}</div>
              <div class="entry-meta">
                ${typeof getWalletBadgeHtml === 'function' ? getWalletBadgeHtml(e.wallet) : ''}
                <span>${typeof getCategoryName === 'function' ? getCategoryName(e.cat, e.type) : e.cat}</span>
              </div>
            </div>
          </div>
          <div class="entry-amt-wrap">
            <div class="entry-amt ${amtClass} ${locked ? 'privacy-masked' : ''}">${displayAmt}</div>
            ${rBalFormatted ? `<div class="entry-running-bal">${rBalFormatted}</div>` : ''}
          </div>
        </div>
      `;
    });
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
          ${html}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = html;
  }
}
window.renderActivityList = renderActivityList;
window.renderEntries = renderActivityList;

function setActivityFilter(filter, btn) {
  currentActivityFilter = filter;
  window.currentActivityFilter = filter;
  document.querySelectorAll('#activity-type-chips .filter-chip').forEach(c => {
    if (c.id !== 'btn-toggle-cat-filters') c.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  renderActivityList();
}
window.setActivityFilter = setActivityFilter;

function toggleActivityCategoryFilters() {
  const container = document.getElementById('activity-category-filter-chips');
  const btn = document.getElementById('btn-toggle-cat-filters');
  if (!container) return;
  const isHidden = container.style.display === 'none' || !container.style.display;
  if (isHidden) {
    container.style.display = 'flex';
    if (btn) {
      btn.classList.add('active');
      const activeCat = window.currentActivityCategoryFilter;
      if (activeCat && activeCat !== 'all') {
        const catName = typeof getCategoryName === 'function' ? getCategoryName(activeCat) : activeCat;
        const catIcon = typeof getCategoryIcon === 'function' ? getCategoryIcon(activeCat) : '🏷️';
        btn.innerHTML = `${catIcon} ${catName} ▴`;
      } else {
        btn.innerHTML = '🏷️ Category ▴';
      }
    }
  } else {
    container.style.display = 'none';
    if (btn) {
      const activeCat = window.currentActivityCategoryFilter;
      if (!activeCat || activeCat === 'all') {
        btn.classList.remove('active');
        btn.innerHTML = '🏷️ Category ▾';
      } else {
        btn.classList.add('active');
        const catName = typeof getCategoryName === 'function' ? getCategoryName(activeCat) : activeCat;
        const catIcon = typeof getCategoryIcon === 'function' ? getCategoryIcon(activeCat) : '🏷️';
        btn.innerHTML = `${catIcon} ${catName} ▾`;
      }
    }
  }
}
window.toggleActivityCategoryFilters = toggleActivityCategoryFilters;

function setActivityCategoryFilter(cat, btn) {
  currentActivityCategoryFilter = cat;
  window.currentActivityCategoryFilter = cat;
  document.querySelectorAll('.activity-cat-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const toggleBtn = document.getElementById('btn-toggle-cat-filters');
  const container = document.getElementById('activity-category-filter-chips');
  const isHidden = container && (container.style.display === 'none' || !container.style.display);
  const arrow = isHidden ? '▾' : '▴';
  if (toggleBtn) {
    if (cat === 'all') {
      toggleBtn.innerHTML = `🏷️ Category ${arrow}`;
      if (isHidden) toggleBtn.classList.remove('active');
    } else {
      const catName = typeof getCategoryName === 'function' ? getCategoryName(cat) : cat;
      const catIcon = typeof getCategoryIcon === 'function' ? getCategoryIcon(cat) : '🏷️';
      toggleBtn.innerHTML = `${catIcon} ${catName} ${arrow}`;
      toggleBtn.classList.add('active');
    }
  }
  renderActivityList();
}
window.setActivityCategoryFilter = setActivityCategoryFilter;

function onActivitySearch(val) {
  currentSearchQuery = val;
  window.currentSearchQuery = val;
  renderActivityList();
}
window.onActivitySearch = onActivitySearch;

// ── QUICK COMPOSER MODAL ──
function openQuickComposer(type='expense', editEntry=null) {
  currentComposerType = type;
  const isEdit = Boolean(editEntry && editEntry.id);
  currentEditingId = isEdit ? editEntry.id : null;
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
    selectComposerCategory(editEntry.cat || (currentComposerType === 'income' ? 'salary' : 'food'));
  } else {
    if (amtInput) amtInput.value = '';
    if (noteInput) noteInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    selectComposerCategory(currentComposerType === 'income' ? 'salary' : 'food');
  }

  if (delBtn) delBtn.style.display = isEdit ? 'inline-flex' : 'none';
  if (saveBtn) saveBtn.textContent = isEdit ? 'Update Entry' : 'Save Entry';

  const recCheck = document.getElementById('comp-is-recurring');
  const recFreqWrap = document.getElementById('comp-recurring-freq-wrap');
  if (recCheck) recCheck.checked = Boolean(editEntry && editEntry.isRecurring);
  if (recFreqWrap) recFreqWrap.style.display = (recCheck && recCheck.checked) ? 'block' : 'none';

  if (typeof smoothOpenModal === 'function') {
    smoothOpenModal(m);
  } else {
    m.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
  }
  if (amtInput && !isEdit) setTimeout(() => amtInput.focus(), 60);
}
window.openQuickComposer = openQuickComposer;

function closeQuickComposer() {
  currentEditingId = null;
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('modal-composer');
  } else {
    const m = document.getElementById('modal-composer');
    if (m) m.style.display = 'none';
    if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
  }
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
    html += `<button type="button" class="composer-cat-chip ${isActive}" data-cat-id="${c.id}" onclick="selectComposerCategory('${c.id}')">${c.icon} ${c.name}</button>`;
  });
  container.innerHTML = html;
}

function selectComposerCategory(catId) {
  currentComposerCategory = catId;
  document.querySelectorAll('.composer-cat-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-cat-id') === catId);
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

  const removedIds = [];
  // If part of an atomic transfer, remove its paired counterpart
  if (target.transferGroupId) {
    (window.entries || []).forEach(e => {
      if (e.transferGroupId === target.transferGroupId && e.id) removedIds.push(e.id);
    });
    window.entries = window.entries.filter(e => e.transferGroupId !== target.transferGroupId);
  } else {
    removedIds.push(id);
    window.entries = window.entries.filter(e => e.id !== id);
  }

  localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
  updateHeaderStats();
  if (typeof deleteCloudEntry === 'function') {
    removedIds.forEach(remId => deleteCloudEntry(remId));
  }
  if (typeof syncEntriesToCloud === 'function') syncEntriesToCloud();
  toast('Entry deleted', 'info');
}
window.deleteEntry = deleteEntry;

// ── SMART UPI SMS & NOTIFICATION PARSER ──
function parseUpiSms(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  const lower = t.toLowerCase();

  // 1. Detect Type (Income vs Expense)
  const isIncome = /(?:credited|received|refunded|deposited|reversal|cashback|added to)/i.test(lower);
  const type = isIncome ? 'income' : 'expense';

  // 2. Detect Amount (e.g. Rs 250, INR 450.00, ₹1,200.50, debited by Rs 150)
  let amt = 0;
  const amtMatch = t.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || 
                   t.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i) ||
                   t.match(/(?:debited by|credited by|paid|sent|amount of)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amtMatch && amtMatch[1]) {
    amt = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  // 3. Extract Merchant / Payee / Beneficiary
  let merchant = '';
  const toMatch = t.match(/(?:to|towards|at|for|vpa|paid to|info:)\s+([A-Za-z0-9\s&'-]{2,30}?)(?:\s+(?:on|ref|upi|via|using|avbl|avl|bal|a\/c|acct|\.|\n|$))/i);
  const fromMatch = t.match(/(?:from|by|received from)\s+([A-Za-z0-9\s&'-]{2,30}?)(?:\s+(?:on|ref|upi|via|using|avbl|avl|bal|a\/c|acct|\.|\n|$))/i);

  if (isIncome && fromMatch && fromMatch[1]) {
    merchant = fromMatch[1].trim();
  } else if (toMatch && toMatch[1]) {
    merchant = toMatch[1].trim();
  }

  if (merchant) {
    merchant = merchant
      .replace(/\b(?:upi|vpa|ref|no|txn|transfer|user|val|dr|cr|a\/c|acct)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 4. Auto-detect Category with Word Boundaries
  let cat = isIncome ? 'other' : 'food';
  const combined = (merchant + ' ' + lower).toLowerCase();

  if (/\b(swiggy|zomato|mcdonald|starbucks|burger|pizza|chai|coffee|cafe|restaurant|dhaba|bakery|eats|food)\b/i.test(combined)) {
    cat = 'food';
  } else if (/\b(uber|ola|rapido|metro|fuel|petrol|diesel|shell|hpcl|bpcl|auto|cab|irctc|flight|indigo)\b/i.test(combined)) {
    cat = 'transport';
  } else if (/\b(blinkit|zepto|instamart|bigbasket|dmart|grocery|supermarket|kirana|milk|vegetable|fruit)\b/i.test(combined)) {
    cat = 'grocery';
  } else if (/\b(amazon|flipkart|myntra|zara|ajio|shopping|mall|retail|trends|nykaa)\b/i.test(combined)) {
    cat = 'shopping';
  } else if (/\b(electricity|bescom|tneb|jio|airtel|broadband|water|gas|bill|bills|recharge|dth)\b/i.test(combined)) {
    cat = 'bills';
  } else if (/\b(pharmacy|apollo|1mg|practo|hospital|clinic|doctor|medplus|netmeds|health)\b/i.test(combined)) {
    cat = 'health';
  } else if (/\b(netflix|spotify|hotstar|prime|pvr|inox|movie|cinema|game|entertainment)\b/i.test(combined)) {
    cat = 'entertainment';
  } else if (/\b(salary|allowance|stipend|payroll)\b/i.test(combined)) {
    cat = 'salary';
  } else if (/\b(freelance|client|project|upwork|fiverr|consulting)\b/i.test(combined)) {
    cat = 'freelance';
  }

  if (!merchant || merchant.length < 2) {
    merchant = isIncome ? 'UPI Received' : (cat.charAt(0).toUpperCase() + cat.slice(1));
  } else {
    // Sanitize merchant to guarantee safe text only (no HTML or script characters)
    merchant = merchant.replace(/[<>&"'`]/g, '').trim();
  }

  return { amt, type, cat, merchant, wallet: 'bank', raw: t };
}
window.parseUpiSms = parseUpiSms;

// ── 1-TAP / 2-TAP UPI PASTE FLOW ──
window.pasteFromClipboardAndLog = async function() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast('Clipboard is empty. Copy any UPI alert or SMS first!', 'info');
        openQuickComposer('expense');
        return;
      }

      const parsed = parseUpiSms(text);
      if (parsed && parsed.amt > 0) {
        // Open composer pre-filled with extracted data so user can review and save in 1 tap
        openQuickComposer(parsed.type, {
          amt: parsed.amt,
          desc: parsed.merchant,
          cat: parsed.cat,
          wallet: parsed.wallet
        });
        toast(`📋 Detected ${parsed.type === 'income' ? '+' : '-'}₹${parsed.amt} for ${parsed.merchant}!`, 'success');
      } else {
        const sanitizedDesc = text.slice(0, 60).replace(/[<>&"'`]/g, '').trim();
        openQuickComposer('expense', { desc: sanitizedDesc });
        toast("Couldn't detect amount from text. Please enter amount below.", 'info');
      }
    } else {
      openQuickComposer('expense');
      toast('Please paste details into the composer note', 'info');
    }
  } catch (e) {
    openQuickComposer('expense');
    toast('Opened composer — enter transaction details', 'info');
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
  const isIncome = /\b(?:salary|income|credited|received|earned|bonus|interest|freelance|kamaya|mile|mila|aaye|aaya|pension)\b/i.test(lower);
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
  } else if (/\b(?:freelance|client|upwork|fiverr|consulting)\b/i.test(lower)) {
    cat = isIncome ? 'freelance' : 'other';
  } else if (/\b(?:gift|envelope|shagun)\b/i.test(lower)) {
    cat = isIncome ? 'gift' : 'other';
  } else if (/\b(?:interest|dividend|investment|stocks|returns|crypto)\b/i.test(lower)) {
    cat = isIncome ? 'investment' : 'other';
  } else if (/salary|allowance|pocket money|bonus/i.test(lower)) {
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

  // 5. Clean Note (Hinglish supported: pe, par, me, ko, se, etc.)
  let cleanDesc = text
    .replace(/(?:rs\.?|inr|₹)\s*[\d,]+/gi, '')
    .replace(/\b\d+\s*k\b/gi, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\b(?:rupees|rupaye|spent|on|via|paid|for|ko|se|pe|par|me|via cash|via card|via upi|via bank|kharch kiya|mile)\b/gi, '')
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
  if (transcriptEl) transcriptEl.innerHTML = '<span>🎙️ Listening... speak naturally</span>';

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

          toast(`🎙️ Logged ${parsed.amt} rupees for ${parsed.desc || parsed.cat}`, 'success');
        } else {
          openQuickComposer('expense', { desc: transcript });
        }
      }
    };

    rec.onerror = function(err) {
      console.warn('Speech recognition error:', err);
      stopVoiceRecording();
      toast('Voice unavailable or mic permission denied. Opened composer.', 'info');
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
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('voice-listening-modal');
  } else {
    const voiceModal = document.getElementById('voice-listening-modal');
    if (voiceModal) voiceModal.style.display = 'none';
  }
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
    { id: 'p_metro', name: 'Metro', amt: 40, icon: '🚇', cat: 'transport', wallet: 'bank' },
    { id: 'p_snacks', name: 'Snacks', amt: 50, icon: '🥪', cat: 'food', wallet: 'cash' }
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
  const html = presets.map(p => `
    <button type="button" class="quick-preset-chip" onclick="logQuickPreset('${p.id}')" title="2-Tap Log: ${p.name} ₹${p.amt}">
      <span>${p.icon || '⚡'}</span>
      <span>${escapeHtml(p.name)}</span>
      <span style="color:var(--green);font-weight:800;">₹${p.amt}</span>
    </button>
  `).join('');
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
    if (typeof smoothOpenModal === 'function') {
      smoothOpenModal(m);
    } else {
      m.style.display = 'flex';
      if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = 'hidden';
    }
  }
}
window.openAddPresetModal = openAddPresetModal;

function closeAddPresetModal() {
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('preset-modal');
  } else {
    const m = document.getElementById('preset-modal');
    if (m) {
      m.style.display = 'none';
      if (typeof document !== 'undefined' && document.body && document.body.style) document.body.style.overflow = '';
    }
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
window.exportCSV = exportTransactionsCSV;

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
  doc.text('PocketTrack · Clean Personal Finance · https://ekaanttaparia2-code-pockettrack.vercel.app', 297, 810, { align: 'center' });

  doc.save(`PocketTrack_Statement_${targetMonth}.pdf`);
  toast('Statement PDF downloaded! 📄', 'success');
}
window.downloadMonthlyPDFStatement = downloadMonthlyPDFStatement;

// ── DATA BACKUP & RESTORE (JSON) ──
function backupAppDataJSON() {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    entries: window.entries || [],
    wallets: window.wallets || [],
    savingsTarget: localStorage.getItem('pocketTrackSavingsTarget') || '',
    savingsTargets: localStorage.getItem('pocketTrackSavingsTargets') || '{}',
    budgets: localStorage.getItem('pocketTrackBudgets') || '{}',
    friendsLedger: localStorage.getItem('pocketTrackFriendsLedger') || '[]',
    quickPresets: localStorage.getItem('pocketTrackQuickPresets') || '[]',
    recurringRules: localStorage.getItem('pocketTrackRecurringRules') || '[]',
    userName: localStorage.getItem('pocketTrackUserName') || ''
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `PocketTrack_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Data Backup (JSON) downloaded! 💾', 'success');
}
window.backupAppDataJSON = backupAppDataJSON;

function restoreAppDataJSON(inputEl) {
  if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
  const file = inputEl.files[0];

  // 1. File size limit guard (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    toast('File too large (max 5MB)', 'error');
    inputEl.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);

      // 2. Strict Object & Schema Validation
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast('Invalid backup file: Expected a JSON object', 'error');
        inputEl.value = '';
        return;
      }

      const hasEntries = Array.isArray(parsed.entries);
      const hasWallets = Array.isArray(parsed.wallets);
      const isPocketTrackBackup = parsed.version === '1.0' || hasEntries || hasWallets;

      if (!isPocketTrackBackup) {
        toast('Unrecognized backup format. Please select a valid PocketTrack JSON file.', 'error');
        inputEl.value = '';
        return;
      }

      // 3. Sanitize and Validate Entries
      if (hasEntries) {
        const validEntries = parsed.entries.filter(item => {
          return item && typeof item === 'object' &&
            item.id &&
            !isNaN(parseFloat(item.amt)) &&
            (item.type === 'income' || item.type === 'expense');
        }).map(item => ({
          id: String(item.id),
          amt: parseFloat(item.amt),
          type: item.type,
          cat: String(item.cat || 'other'),
          desc: String(item.desc || item.note || ''),
          wallet: String(item.wallet || 'cash'),
          date: String(item.date || new Date().toISOString().split('T')[0]),
          transferGroupId: item.transferGroupId ? String(item.transferGroupId) : undefined,
          isTransfer: Boolean(item.isTransfer)
        }));

        window.entries = validEntries;
        localStorage.setItem('pocketTrackEntries', JSON.stringify(validEntries));
      }

      // 4. Sanitize and Validate Wallets
      if (hasWallets) {
        const validWallets = parsed.wallets.filter(w => w && w.id && w.name).map(w => ({
          id: String(w.id),
          name: String(w.name),
          icon: String(w.icon || '👛'),
          balance: parseFloat(w.balance) || 0
        }));
        if (validWallets.length > 0) {
          window.wallets = validWallets;
          localStorage.setItem('pocketTrackWallets', JSON.stringify(validWallets));
        }
      }

      // 5. Restore Settings & Configuration Keys Safely
      if (parsed.savingsTarget !== undefined) {
        localStorage.setItem('pocketTrackSavingsTarget', String(parseFloat(parsed.savingsTarget) || ''));
      }
      if (parsed.savingsTargets && typeof parsed.savingsTargets === 'object') {
        localStorage.setItem('pocketTrackSavingsTargets', JSON.stringify(parsed.savingsTargets));
      }
      if (parsed.budgets && typeof parsed.budgets === 'object') {
        localStorage.setItem('pocketTrackBudgets', JSON.stringify(parsed.budgets));
      }
      if (Array.isArray(parsed.friendsLedger)) {
        localStorage.setItem('pocketTrackFriendsLedger', JSON.stringify(parsed.friendsLedger));
      }
      if (Array.isArray(parsed.quickPresets)) {
        localStorage.setItem('pocketTrackQuickPresets', JSON.stringify(parsed.quickPresets));
      }
      if (Array.isArray(parsed.recurringRules)) {
        localStorage.setItem('pocketTrackRecurringRules', JSON.stringify(parsed.recurringRules));
      }
      if (parsed.userName && typeof parsed.userName === 'string') {
        localStorage.setItem('pocketTrackUserName', parsed.userName.trim());
      }

      // 6. Immediate State Re-render & Clean Reload
      updateHeaderStats();
      if (typeof renderHomeRecent === 'function') renderHomeRecent();
      if (typeof renderQuickPresets === 'function') renderQuickPresets();
      if (typeof renderActivityList === 'function') renderActivityList();
      if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
      if (typeof renderFriendsLedger === 'function') renderFriendsLedger();
      if (typeof renderInsightsTab === 'function') renderInsightsTab();

      toast('Backup restored! Reloading app... 🔄', 'success');
      inputEl.value = '';

      if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
        setTimeout(() => {
          window.location.reload();
        }, 600);
      }
    } catch (err) {
      console.error('Backup restore error:', err);
      toast('Failed to parse backup file: Invalid JSON syntax', 'error');
      inputEl.value = '';
    }
  };

  reader.readAsText(file);
}
window.restoreAppDataJSON = restoreAppDataJSON;

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

// ── 👥 FRIENDS & SPLIT LEDGER ──
function getFriendsLedger() {
  try {
    const raw = localStorage.getItem('pocketTrackFriendsLedger');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}
window.getFriendsLedger = getFriendsLedger;

function saveFriendsLedger(list) {
  localStorage.setItem('pocketTrackFriendsLedger', JSON.stringify(list));
  renderFriendsLedger();
}
window.saveFriendsLedger = saveFriendsLedger;

function renderFriendsLedger() {
  const container = document.getElementById('friends-ledger-list');
  if (!container) return;
  const list = getFriendsLedger();

  if (!list.length) {
    container.innerHTML = `
      <div class="card" style="padding:28px 18px;text-align:center;border-radius:22px;border:1.5px dashed var(--border);">
        <div style="width:52px;height:52px;border-radius:16px;background:var(--green-soft);color:var(--green);display:grid;place-items:center;font-size:24px;margin:0 auto 12px;">
          👥
        </div>
        <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0 0 6px;">Friends & Split Ledger</h3>
        <p style="font-size:12.5px;color:var(--text-dim);margin:0 auto 16px;max-width:320px;line-height:1.5;">
          Keep track of money you've lent to friends or borrowed. Send 1-tap WhatsApp reminders with pre-filled amounts, and settle balances instantly.
        </p>
        <button class="btn btn-primary" onclick="openAddFriendModal()" style="padding:10px 22px;border-radius:12px;font-weight:800;font-size:13px;">
          + Add First Split / Lent
        </button>
      </div>
    `;
    return;
  }

  let html = '';
  list.forEach(f => {
    const isLent = f.type === 'lent';
    const statusText = isLent ? `You get ₹${f.amt.toLocaleString('en-IN')}` : `You owe ₹${f.amt.toLocaleString('en-IN')}`;
    const statusColor = isLent ? 'var(--green)' : 'var(--red)';
    const waMsg = encodeURIComponent(`Hey ${f.name}, gentle reminder about ₹${f.amt} for ${f.note || 'our shared expense'} via PocketTrack.`);

    html += `
      <div class="ledger-friend-card">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:12px;background:${isLent ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};display:grid;place-items:center;font-size:18px;">
            ${isLent ? '🟢' : '🔴'}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="font-size:14px;color:var(--text);">${escapeHtml(f.name)}</strong>
              <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:${isLent ? 'var(--green-soft)' : 'rgba(239,68,68,0.1)'};color:${statusColor};">
                ${isLent ? 'Lent' : 'Borrowed'}
              </span>
            </div>
            <div style="font-size:11.5px;color:var(--text-dim);margin-top:2px;">
              ${escapeHtml(f.note || 'Split')} · <strong style="color:${statusColor};">${statusText}</strong>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${isLent ? `<a href="https://wa.me/?text=${waMsg}" target="_blank" rel="noopener" class="ledger-whatsapp-btn" title="Remind on WhatsApp">💬 Remind</a>` : ''}
          <button class="btn btn-sm" onclick="settleFriendDebt('${f.id}')" style="font-size:11.5px;padding:5px 10px;border-radius:10px;font-weight:700;">
            Settle
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}
window.renderFriendsLedger = renderFriendsLedger;

function settleFriendDebt(id) {
  const list = getFriendsLedger();
  const f = list.find(x => x.id === id);
  if (!f) return;

  const isLent = f.type === 'lent';
  const newEntry = {
    id: 'settle_' + Date.now(),
    amt: f.amt,
    type: isLent ? 'income' : 'expense',
    cat: 'other',
    desc: `🤝 Settled with ${f.name} (${f.note || 'debt'})`,
    date: new Date().toISOString().split('T')[0],
    wallet: 'bank',
    createdAt: Date.now()
  };
  window.entries.unshift(newEntry);
  localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));
  updateHeaderStats();

  saveFriendsLedger(list.filter(x => x.id !== id));
  toast(`🤝 Settled ₹${f.amt} with ${f.name} & logged transaction!`, 'success');
}
window.settleFriendDebt = settleFriendDebt;

function addFriendDebt(name, amt, type, note) {
  if (!name || !amt) return;
  const list = getFriendsLedger();
  list.unshift({
    id: 'f_' + Date.now(),
    name: name.trim(),
    amt: parseFloat(amt),
    type: type || 'lent',
    note: note ? note.trim() : '',
    date: new Date().toISOString().split('T')[0]
  });
  saveFriendsLedger(list);
  toast(`Added split with ${name}! 👥`, 'success');
}
window.addFriendDebt = addFriendDebt;

function openAddFriendModal() {
  const m = document.getElementById('friend-split-modal');
  if (m) {
    if (typeof smoothOpenModal === 'function') {
      smoothOpenModal(m);
    } else {
      m.style.display = 'flex';
    }
  }
}
window.openAddFriendModal = openAddFriendModal;

function closeAddFriendModal() {
  if (typeof smoothCloseModal === 'function') {
    smoothCloseModal('friend-split-modal');
  } else {
    const m = document.getElementById('friend-split-modal');
    if (m) m.style.display = 'none';
  }
}
window.closeAddFriendModal = closeAddFriendModal;

function submitAddFriend() {
  const nameInput = document.getElementById('friend-name-input');
  const amtInput = document.getElementById('friend-amt-input');
  const typeSelect = document.getElementById('friend-type-select');
  const noteInput = document.getElementById('friend-note-input');

  const name = nameInput ? nameInput.value : '';
  const amt = amtInput ? amtInput.value : '';
  const type = typeSelect ? typeSelect.value : 'lent';
  const note = noteInput ? noteInput.value : '';

  if (!name || !amt || parseFloat(amt) <= 0) {
    toast('Please enter a friend name and valid amount', 'error');
    return;
  }

  addFriendDebt(name, amt, type, note);
  if (nameInput) nameInput.value = '';
  if (amtInput) amtInput.value = '';
  if (noteInput) noteInput.value = '';
  closeAddFriendModal();
}
window.submitAddFriend = submitAddFriend;

// ── SENIOR / ACCESSIBILITY MODE ──
function toggleSeniorMode(enabled) {
  localStorage.setItem('pocketTrackSeniorMode', enabled ? 'true' : 'false');
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.toggle('senior-mode', enabled);
  }
  toast(enabled ? '👴 Senior / Large font mode enabled!' : 'Standard mode enabled', 'info');
}
window.toggleSeniorMode = toggleSeniorMode;

function applySeniorMode() {
  const isSenior = localStorage.getItem('pocketTrackSeniorMode') === 'true';
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.toggle('senior-mode', isSenior);
  }
  const toggle = document.getElementById('setting-senior-toggle');
  if (toggle) toggle.checked = isSenior;
}
window.applySeniorMode = applySeniorMode;

// ── USER PROFILE NAME ──
function saveUserProfileName(name) {
  const n = name ? name.trim() : 'User';
  localStorage.setItem('pocketTrackUserName', n);
  const el = document.getElementById('settings-user-name');
  if (el) el.value = n;
  toast('Profile name saved! 👋', 'success');
}
window.saveUserProfileName = saveUserProfileName;

// ── CLEAR ALL DATA / RESET DEMO ──
function clearAllAppData() {
  if (confirm('Are you sure you want to reset all data and start fresh? This cannot be undone.')) {
    // 1. Wipe all PocketTrack localStorage keys (including per-wallet budgets, targets, presets)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('pocketTrack') || k.startsWith('pockettrack_'))) {
        localStorage.removeItem(k);
      }
    }
    localStorage.removeItem('pocketTrackEntries');
    localStorage.removeItem('pockettrack_entries');
    localStorage.removeItem('pocketTrackWallets');
    localStorage.removeItem('pockettrack_wallets');
    localStorage.removeItem('pocketTrackSavingsTarget');
    localStorage.removeItem('pocketTrackSavingsTargets');
    localStorage.removeItem('pocketTrackBudget');
    localStorage.removeItem('pocketTrackBudgets');
    localStorage.removeItem('pocketTrackQuickPresets');
    localStorage.removeItem('pocketTrackRecurringRules');
    localStorage.removeItem('pocketTrackFriendsLedger');
    localStorage.removeItem('pocketTrackUserName');
    localStorage.removeItem('pocketTrackPrivacyMode');
    localStorage.removeItem('pocketTrackPrivacyPin');

    // 2. Wipe Firestore cloud data if user is signed in to cloud sync
    if (typeof currentUser !== 'undefined' && currentUser && !currentUser.isGuest && typeof db !== 'undefined') {
      try {
        db.collection('users').doc(currentUser.uid).set({
          entries: [],
          wallets: [],
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.warn('Cloud reset parent error:', err));

        db.collection('users').doc(currentUser.uid).collection('entries').get().then(snap => {
          snap.forEach(doc => doc.ref.delete().catch(() => {}));
        }).catch(err => console.warn('Cloud reset subcollection error:', err));
      } catch (err) {
        console.warn('Cloud wipe error during reset:', err);
      }
    }

    // 3. Reset in-memory state
    window.entries = [];
    window.wallets = [
      { id: 'cash', name: 'Cash', icon: '💵', balance: 0 },
      { id: 'bank', name: 'Bank / UPI', icon: '🏦', balance: 0 },
      { id: 'card', name: 'Credit Card', icon: '💳', balance: 0 }
    ];
    updateHeaderStats();
    if (typeof renderActivityList === 'function') renderActivityList();
    if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
    if (typeof renderFriendsLedger === 'function') renderFriendsLedger();
    if (typeof renderRecurringRules === 'function') renderRecurringRules();
    if (typeof renderQuickPresetsBar === 'function') renderQuickPresetsBar();
    toast('All device & cloud data wiped. Starting fresh! 🧹', 'info');
  }
}
window.clearAllAppData = clearAllAppData;

