// =====================================================================
// POCKETTRACK PURE — CORE APP CONTROLLER
// =====================================================================

window.currentTab = 'home';
window.entries = JSON.parse(localStorage.getItem('pocketTrackEntries') || '[]');
window.wallets = JSON.parse(localStorage.getItem('pocketTrackWallets') || 'null') || [
  { id: 'cash', name: 'Cash', icon: '💵', balance: 0 },
  { id: 'bank', name: 'Bank / UPI', icon: '🏦', balance: 0 },
  { id: 'card', name: 'Credit Card', icon: '💳', balance: 0 }
];
window.monthlyBudget = parseFloat(localStorage.getItem('pocketTrackBudget')) || 0;

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
function animateNumber(elementId, targetValue, prefix='₹', suffix='') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const startValue = parseFloat(el.textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const diff = targetValue - startValue;
  const duration = 300;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.round(startValue + diff * progress);
    el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
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
