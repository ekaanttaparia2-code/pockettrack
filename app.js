// =====================================================================
// POCKETTRACK PURE — CORE APP CONTROLLER
// =====================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
window.escapeHtml = escapeHtml;

/**
 * Canonical Schema Validator & Ingestion Adapter.
 * Guarantees that any record loaded from localStorage, cloud cache, or legacy backups
 * is strictly cast to the canonical immutable schema:
 * { id, amt, type, cat, desc, note, date, wallet, transferGroupId, createdAt }
 */
function normalizeEntry(e) {
  if (!e) return null;
  return {
    id: String(e.id || e._id || ('pt_' + Math.random().toString(36).substr(2, 9))),
    amt: Math.abs(parseFloat(e.amt || e.amount || 0)),
    type: (e.type === 'income' ? 'income' : 'expense'),
    cat: String(e.cat || e.category || 'other'),
    desc: escapeHtml(String(e.desc || e.label || e.note || e.title || 'Transaction')).slice(0, 100),
    note: escapeHtml(String(e.note || e.desc || e.label || '')).slice(0, 200),
    date: String(e.date || new Date().toISOString().split('T')[0]),
    wallet: String(e.wallet || e.walletId || 'cash'),
    transferGroupId: e.transferGroupId ? String(e.transferGroupId) : null,
    createdAt: Number(e.createdAt || Date.now())
  };
}
window.normalizeEntry = normalizeEntry;

function loadLocalEntries() {
  try {
    // 1. Primary canonical store
    const raw = localStorage.getItem('pocketTrackEntries');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeEntry).filter(Boolean);
      }
    }
    // 2. One-time migration from legacy key names
    const legacyKeys = ['pockettrack_entries', 'pockettrack_entries_cache'];
    for (const k of legacyKeys) {
      const legacyRaw = localStorage.getItem(k);
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = parsed.map(normalizeEntry).filter(Boolean);
            localStorage.setItem('pocketTrackEntries', JSON.stringify(normalized));
            localStorage.removeItem(k);
            return normalized;
          }
        } catch (e) {}
        localStorage.removeItem(k);
      }
    }
    // 3. One-time purge of legacy per-user cache keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pockettrack_entries_cache_')) {
        const legacyRaw = localStorage.getItem(key);
        if (legacyRaw) {
          try {
            const parsed = JSON.parse(legacyRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const normalized = parsed.map(normalizeEntry).filter(Boolean);
              localStorage.setItem('pocketTrackEntries', JSON.stringify(normalized));
            }
          } catch (e) {}
        }
        localStorage.removeItem(key);
      }
    }
  } catch (err) {}
  return [];
}

function loadLocalWallets() {
  try {
    const raw = localStorage.getItem('pocketTrackWallets');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const legacy = localStorage.getItem('pockettrack_wallets');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem('pocketTrackWallets', JSON.stringify(parsed));
          localStorage.removeItem('pockettrack_wallets');
          return parsed;
        }
      } catch (e) {}
      localStorage.removeItem('pockettrack_wallets');
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

// ── TAB SWITCHING (4 Clean Tabs: Home, Insights, Activity, Settings) ──
function setTab(tabName) {
  window.currentTab = tabName;
  ['home', 'insights', 'activity', 'settings'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    const btn = document.getElementById('btn-tab-' + t);
    if (el) {
      el.style.display = (t === tabName) ? 'block' : 'none';
      el.classList.toggle('active', t === tabName);
    }
    if (btn) btn.classList.toggle('active', t === tabName);
  });
  if (tabName === 'insights' && typeof renderInsightsTab === 'function') {
    renderInsightsTab();
  }
  if (tabName === 'activity') {
    if (typeof renderActivityList === 'function') renderActivityList();
    if (typeof renderFriendsLedger === 'function') renderFriendsLedger();
  }
  if (tabName === 'settings') {
    if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
    const sInput = document.getElementById('settings-savings-input');
    const currSav = localStorage.getItem('pocketTrackSavingsTarget') || '';
    if (sInput && currSav) sInput.value = currSav;
    
    const nameInput = document.getElementById('settings-user-name');
    const currName = localStorage.getItem('pocketTrackUserName') || '';
    if (nameInput && currName) nameInput.value = currName;

    const seniorToggle = document.getElementById('setting-senior-toggle');
    if (seniorToggle) {
      seniorToggle.checked = (localStorage.getItem('pocketTrackSeniorMode') === 'true');
    }
    if (typeof updateSettingsAuthUI === 'function') updateSettingsAuthUI();
  }
  if (tabName === 'home' && typeof updateHeaderStats === 'function') {
    updateHeaderStats();
  }
}
window.setTab = setTab;

function switchActivityView(view) {
  const isPassbook = (view === 'passbook');
  const pbControls = document.getElementById('activity-passbook-controls');
  const ledControls = document.getElementById('activity-ledger-controls');
  const pbList = document.getElementById('entries-list');
  const ledWrap = document.getElementById('friends-ledger-wrap');
  const btnPb = document.getElementById('btn-view-passbook');
  const btnLed = document.getElementById('btn-view-ledger');

  if (pbControls) pbControls.style.display = isPassbook ? 'block' : 'none';
  if (ledControls) ledControls.style.display = isPassbook ? 'none' : 'flex';
  if (pbList) pbList.style.display = isPassbook ? 'block' : 'none';
  if (ledWrap) ledWrap.style.display = isPassbook ? 'none' : 'block';

  if (btnPb) btnPb.classList.toggle('active', isPassbook);
  if (btnLed) btnLed.classList.toggle('active', !isPassbook);

  if (!isPassbook) {
    if (typeof renderFriendsLedger === 'function') renderFriendsLedger();
  } else {
    if (typeof renderActivityList === 'function') renderActivityList();
  }
}
window.switchActivityView = switchActivityView;

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
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('light-theme', isLight);
      document.documentElement.classList.toggle('dark-theme', !isLight);
    }
    if (document.body) {
      document.body.setAttribute('data-theme', theme);
      document.body.classList.toggle('light-theme', isLight);
      document.body.classList.toggle('dark-theme', !isLight);
    }
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isLight ? '🌙' : '☀️';
    if (typeof document.querySelector === 'function') {
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', isLight ? '#f8fafc' : '#09100d');
    }
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

// ── MODAL TRANSITIONS (Hardware Accelerated iOS-Style Sheets) ──
function smoothOpenModal(modalOrId, callback) {
  if (typeof document === 'undefined') return;
  const m = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
  if (!m) return;
  m.classList.remove('closing');
  m.style.display = 'flex';
  if (document.body && document.body.style) {
    document.body.style.overflow = 'hidden';
  }
  if (typeof callback === 'function') callback();
}
window.smoothOpenModal = smoothOpenModal;

function smoothCloseModal(modalOrId, callback) {
  if (typeof document === 'undefined') return;
  const m = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
  if (!m) {
    if (typeof callback === 'function') callback();
    return;
  }

  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Immediate close for unit tests or reduced motion preference
  if (isNode || prefersReduced) {
    m.classList.remove('closing');
    m.style.display = 'none';
    if (document.body && document.body.style) document.body.style.overflow = '';
    if (typeof callback === 'function') callback();
    return;
  }

  if (m.style.display === 'none' && !m.classList.contains('closing')) {
    if (typeof callback === 'function') callback();
    return;
  }
  if (m.classList.contains('closing')) return;

  m.classList.add('closing');
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    m.classList.remove('closing');
    m.style.display = 'none';
    if (document.body && document.body.style) document.body.style.overflow = '';
    if (typeof callback === 'function') callback();
  };

  setTimeout(finish, 190);
}
window.smoothCloseModal = smoothCloseModal;

// ── NUMBER ANIMATION (Fluid Quartic Easing Odometer) ──
function animateNumber(elementId, targetValue, prefix='₹', suffix='', duration=320) {
  if (typeof document === 'undefined') return;
  const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
  if (!el) return;
  const target = parseFloat(targetValue) || 0;
  const formatted = (target < 0 ? '-' + prefix + Math.abs(target).toLocaleString('en-IN') : prefix + target.toLocaleString('en-IN')) + suffix;

  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isNode || prefersReduced || duration <= 0) {
    el.textContent = formatted;
    el._prevNumVal = target;
    return;
  }

  if (el.classList && el.classList.contains('privacy-masked')) {
    el.textContent = formatted;
    el._prevNumVal = target;
    return;
  }

  if (el._animFrame) {
    cancelAnimationFrame(el._animFrame);
    el._animFrame = null;
  }

  let startValue = typeof el._prevNumVal === 'number' ? el._prevNumVal : parseFloat((el.textContent || '').replace(/[^0-9.-]+/g, ''));
  if (isNaN(startValue)) startValue = target;

  if (startValue === target) {
    el.textContent = formatted;
    el._prevNumVal = target;
    return;
  }

  const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const diff = target - startValue;

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Quartic ease-out: ultra-smooth decay like precision digital hardware
    const ease = 1 - Math.pow(1 - progress, 4);
    const current = Math.round(startValue + diff * ease);
    el.textContent = (current < 0 ? '-' + prefix + Math.abs(current).toLocaleString('en-IN') : prefix + current.toLocaleString('en-IN')) + suffix;

    if (progress < 1) {
      if (typeof requestAnimationFrame === 'function') {
        el._animFrame = requestAnimationFrame(update);
      }
    } else {
      el.textContent = formatted;
      el._prevNumVal = target;
      el._animFrame = null;
    }
  }

  if (typeof requestAnimationFrame === 'function') {
    el._animFrame = requestAnimationFrame(update);
  } else {
    el.textContent = formatted;
    el._prevNumVal = target;
  }
}
window.animateNumber = animateNumber;

// ── BUDGET SETTING ──
function saveMonthlyBudget() {
  const input = document.getElementById('budget-input');
  const wSel = document.getElementById('settings-budget-wallet');
  const walletId = wSel ? wSel.value : 'all';
  if (!input) return;
  const val = parseFloat(input.value) || 0;

  if (typeof saveWalletBudget === 'function') {
    saveWalletBudget(walletId, val);
  } else {
    window.monthlyBudget = val;
    localStorage.setItem('pocketTrackBudget', val);
  }
  if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
  const wName = walletId === 'all' ? 'Overall' : ((typeof getWallets === 'function' ? getWallets().find(w => w.id === walletId) : null) || {}).name || walletId;
  toast(val > 0 ? `Monthly budget for ${wName}: ₹${val.toLocaleString('en-IN')}` : `Budget cleared for ${wName}`, 'success');
}
window.saveMonthlyBudget = saveMonthlyBudget;

// ── INITIALIZATION ──
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initAuth === 'function') initAuth();
  if (typeof checkAndProcessRecurring === 'function') checkAndProcessRecurring();
  if (typeof updateHeaderStats === 'function') updateHeaderStats();
  if (typeof renderQuickPresets === 'function') renderQuickPresets();
  if (typeof renderSettingsWallets === 'function') renderSettingsWallets();
  if (typeof renderRecurringList === 'function') renderRecurringList();

  const bInput = document.getElementById('budget-input');
  if (bInput && window.monthlyBudget > 0) bInput.value = window.monthlyBudget;
  const sInput = document.getElementById('settings-savings-input');
  const currSav = localStorage.getItem('pocketTrackSavingsTarget') || '';
  if (sInput && currSav) sInput.value = currSav;

  const privacySettingToggle = document.getElementById('setting-privacy-toggle');
  if (privacySettingToggle) {
    privacySettingToggle.checked = (localStorage.getItem('pocketTrackPrivacyMode') === 'true');
  }

  if (typeof applySeniorMode === 'function') {
    applySeniorMode();
  }
});

// ── GLOBAL ACCESSIBILITY: ESCAPE KEY CLOSES ACTIVE MODALS ──
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (typeof closeQuickComposer === 'function') closeQuickComposer();
      if (typeof closeAuthScreen === 'function') closeAuthScreen();
      if (typeof closeUnlockPinModal === 'function') closeUnlockPinModal();
      if (typeof closeSetPinModal === 'function') closeSetPinModal();
      if (typeof closeGuestMigrationModal === 'function') closeGuestMigrationModal();
      if (typeof closeSafeResetModal === 'function') closeSafeResetModal();
      if (typeof closeTransferModal === 'function') closeTransferModal();
      if (typeof closeNewWalletModal === 'function') closeNewWalletModal();
      if (typeof closeSavingsTargetModal === 'function') closeSavingsTargetModal();
      if (typeof closeAddPresetModal === 'function') closeAddPresetModal();
      if (typeof closeAddFriendModal === 'function') closeAddFriendModal();
      if (typeof closeSafeToSpendBreakdown === 'function') closeSafeToSpendBreakdown();
    }
  });
}
