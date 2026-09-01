// =====================================================================
// POCKETTRACK PURE — CORE APP CONTROLLER
// =====================================================================

function normalizeEntry(e) {
  if (!e) return null;
  return {
    id: e.id || e._id || ('pt_' + Math.random().toString(36).substr(2, 9)),
    amt: parseFloat(e.amt || e.amount || 0),
    type: e.type || 'expense',
    cat: e.cat || e.category || 'other',
    desc: e.desc || e.label || e.note || e.title || 'Transaction',
    note: e.note || e.desc || e.label || '',
    date: e.date || new Date().toISOString().split('T')[0],
    wallet: e.wallet || e.walletId || 'cash',
    transferGroupId: e.transferGroupId || null,
    createdAt: e.createdAt || Date.now()
  };
}
window.normalizeEntry = normalizeEntry;

function loadLocalEntries() {
  try {
    const keys = ['pockettrack_entries', 'pockettrack_entries_cache', 'pocketTrackEntries'];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeEntry).filter(Boolean);
        }
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pockettrack_entries_cache_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(normalizeEntry).filter(Boolean);
          }
        }
      }
    }
  } catch (err) {}
  return [];
}

function loadLocalWallets() {
  try {
    const raw = localStorage.getItem('pockettrack_wallets') || localStorage.getItem('pocketTrackWallets');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {}
  return [
    { id: 'cash', name: 'Cash', icon: '💵', balance: 0 },
    { id: 'bank', name: 'Bank / UPI', icon: '🏦', balance: 0 },
    { id: 'card', name: 'Credit Card', icon: '💳', balance: 0 }
  ];
}

window.currentTab = 'home';
window.entries = loadLocalEntries();
window.wallets = loadLocalWallets();
window.monthlyBudget = parseFloat(localStorage.getItem('pocketTrackBudget') || localStorage.getItem('pockettrack_budgets')) || 0;

// ── TAB SWITCHING ──
function setTab(tabName) {
  window.currentTab = tabName;
  ['home', 'activity', 'settings'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    const btn = document.getElementById('btn-tab-' + t);
    if (el) el.style.display = (t === tabName) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tabName);
  });
  if (tabName === 'activity' && typeof renderActivityList === 'function') {
    renderActivityList();
  }
  if (tabName === 'settings' && typeof renderSettingsWallets === 'function') {
    renderSettingsWallets();
  }
  if (tabName === 'home' && typeof updateHeaderStats === 'function') {
    updateHeaderStats();
  }
}
window.setTab = setTab;

// ── TOAST NOTIFICATIONS ──
function toast(msg, type='info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
  }, 2600);
}
window.toast = toast;
window.showToast = toast;

// ── THEME CONTROLLER ──
function setAppTheme(theme, save=true) {
  window.currentAppTheme = theme;
  const isLight = (theme === 'light');
  if (typeof document !== 'undefined') {
    if (document.documentElement) {
      if (isLight) {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.add('light-theme');
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.remove('light-theme');
      }
    }
    if (document.body) {
      document.body.classList.toggle('light-theme', isLight);
      if (isLight) document.body.setAttribute('data-theme', 'light');
      else document.body.removeAttribute('data-theme');
    }
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isLight ? '🌙' : '☀️';
  }
  if (save && typeof localStorage !== 'undefined') {
    localStorage.setItem('pocketTrackTheme', theme);
    if (typeof toast === 'function') toast(isLight ? 'Light Theme activated ☀️' : 'Dark Theme activated 🌙', 'info');
  }
}
window.setAppTheme = setAppTheme;

function toggleTheme() {
  const isLight = (window.currentAppTheme === 'light');
  setAppTheme(isLight ? 'dark' : 'light', true);
}
window.toggleTheme = toggleTheme;

// ── NUMBER ANIMATION ──
function animateNumber(elementId, targetValue, prefix='₹', suffix='', duration=400) {
  if (typeof document === 'undefined') return;
  const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
  if (!el) return;
  const target = parseFloat(targetValue) || 0;
  const startValue = parseFloat((el.textContent || '').replace(/[^0-9.-]+/g, '')) || 0;
  if (startValue === target) {
    el.textContent = (target < 0 ? '-' + prefix + Math.abs(target).toLocaleString('en-IN') : prefix + target.toLocaleString('en-IN')) + suffix;
    return;
  }
  
  const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const diff = target - startValue;

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startValue + diff * ease);
    el.textContent = (current < 0 ? '-' + prefix + Math.abs(current).toLocaleString('en-IN') : prefix + current.toLocaleString('en-IN')) + suffix;
    if (progress < 1) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(update);
    } else {
      el.textContent = (target < 0 ? '-' + prefix + Math.abs(target).toLocaleString('en-IN') : prefix + target.toLocaleString('en-IN')) + suffix;
    }
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(update);
  } else {
    el.textContent = (target < 0 ? '-' + prefix + Math.abs(target).toLocaleString('en-IN') : prefix + target.toLocaleString('en-IN')) + suffix;
  }
}
window.animateNumber = animateNumber;

// ── BUDGET SETTING ──
function saveMonthlyBudget() {
  const input = document.getElementById('budget-input');
  if (!input) return;
  const val = parseFloat(input.value) || 0;
  window.monthlyBudget = val;
  localStorage.setItem('pocketTrackBudget', val);
  toast('Monthly budget set to ₹' + val.toLocaleString('en-IN'), 'success');
}
window.saveMonthlyBudget = saveMonthlyBudget;

// ── INITIALIZATION ──
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initAuth === 'function') initAuth();
  if (typeof updateHeaderStats === 'function') updateHeaderStats();
  if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
  const bInput = document.getElementById('budget-input');
  if (bInput && window.monthlyBudget > 0) bInput.value = window.monthlyBudget;
});
