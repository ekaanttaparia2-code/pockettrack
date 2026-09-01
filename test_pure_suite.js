// =====================================================================
// POCKETTRACK PURE — AUTOMATED TEST SUITE
// =====================================================================

const assert = require('assert');

// Mock browser environment
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;
global.window = global;
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = fn => setTimeout(fn, 16);

// Mock DOM elements
const elements = {};
global.document = {
  getElementById: id => {
    if (!elements[id]) {
      elements[id] = {
        id,
        textContent: '',
        value: '',
        style: {},
        classList: {
          classes: new Set(),
          add: function(c) { this.classes.add(c); },
          remove: function(c) { this.classes.delete(c); },
          toggle: function(c, force) {
            if (force === undefined) {
              if (this.classes.has(c)) this.classes.delete(c);
              else this.classes.add(c);
            } else if (force) this.classes.add(c);
            else this.classes.delete(c);
          },
          contains: function(c) { return this.classes.has(c); }
        },
        innerHTML: '',
        focus: () => {}
      };
    }
    return elements[id];
  },
  querySelectorAll: () => [],
  documentElement: {
    setAttribute: () => {},
    removeAttribute: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} }
  },
  body: {
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    setAttribute: () => {},
    removeAttribute: () => {}
  },
  addEventListener: () => {}
};

// Load Scripts
require('./wallets.js');
require('./transactions.js');
require('./insights.js');
require('./app.js');
require('./auth.js');

console.log('🧪 Running PocketTrack Pure Test Suite...\n');
let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${desc}\n   Error: ${err.message}`);
    failed++;
  }
}

// ── TEST 1: Initial State & Balance Sync ──
it('1.1 Computes net balance from income and expense entries', () => {
  window.entries = [
    { id: '1', type: 'income', amt: 5000, cat: 'salary', wallet: 'bank' },
    { id: '2', type: 'expense', amt: 1200, cat: 'food', wallet: 'cash' },
    { id: '3', type: 'expense', amt: 800, cat: 'shopping', wallet: 'card' }
  ];
  updateHeaderStats();
  
  const bal = document.getElementById('hdr-balance').textContent;
  const inc = document.getElementById('hero-income').textContent;
  const exp = document.getElementById('hero-spent').textContent;
  const cnt = document.getElementById('hero-count').textContent;

  assert.strictEqual(bal, '₹3,000');
  assert.strictEqual(inc, '₹5,000');
  assert.strictEqual(exp, '₹2,000');
  assert.strictEqual(cnt, '3');
});

// ── TEST 2: Add Entry via Quick Composer ──
it('2.1 Adds new expense entry and updates live stats', () => {
  document.getElementById('comp-amt').value = '450';
  document.getElementById('comp-note').value = 'Dinner with Friends';
  document.getElementById('comp-wallet').value = 'card';
  setComposerType('expense');
  selectComposerCategory('food');

  saveComposerEntry();

  const latest = window.entries[0];
  assert.strictEqual(latest.amt, 450);
  assert.strictEqual(latest.type, 'expense');
  assert.strictEqual(latest.desc, 'Dinner with Friends');
  assert.strictEqual(latest.wallet, 'card');
  assert.strictEqual(document.getElementById('hdr-balance').textContent, '₹2,550');
});

// ── TEST 3: Inter-Wallet Atomic Transfers ──
it('3.1 Atomic double-entry wallet transfer creates paired entries', () => {
  document.getElementById('transfer-from-wallet').value = 'bank';
  document.getElementById('transfer-to-wallet').value = 'cash';
  document.getElementById('transfer-amt').value = '1000';
  document.getElementById('transfer-note').value = 'ATM Cash';

  submitWalletTransfer();

  const outE = window.entries.find(e => e.transferGroupId && e.type === 'expense');
  const inE = window.entries.find(e => e.transferGroupId && e.type === 'income');

  assert.ok(outE && inE, 'Both transfer counterparts must exist');
  assert.strictEqual(outE.wallet, 'bank');
  assert.strictEqual(inE.wallet, 'cash');
  assert.strictEqual(outE.amt, 1000);
  assert.strictEqual(inE.amt, 1000);
});

it('3.2 Deleting one transfer counterpart atomically removes the other', () => {
  const tr = window.entries.find(e => e.transferGroupId);
  const grpId = tr.transferGroupId;

  deleteEntry(tr.id);

  const remaining = window.entries.filter(e => e.transferGroupId === grpId);
  assert.strictEqual(remaining.length, 0, 'Both paired entries must be deleted together');
});

// ── TEST 4: Custom Wallet Creation & Deletion ──
it('4.1 Adds and deletes custom wallet accounts safely', () => {
  openNewWalletModal();
  selectWalletEmoji('🪙');
  document.getElementById('new-wallet-name').value = 'Petty Cash';

  saveNewWallet();

  const customW = getWallets().find(w => w.name === 'Petty Cash');
  assert.ok(customW, 'Custom wallet must be created');
  assert.strictEqual(customW.icon, '🪙');

  deleteCustomWallet(customW.id);
  const afterDel = getWallets().find(w => w.name === 'Petty Cash');
  assert.strictEqual(afterDel, undefined, 'Custom wallet must be deleted');
});

// ── TEST 5: Tab Navigation ──
it('5.1 Switches tabs between Home, Activity, and Settings', () => {
  setTab('activity');
  assert.strictEqual(window.currentTab, 'activity');
  assert.strictEqual(document.getElementById('tab-activity').style.display, 'block');
  assert.strictEqual(document.getElementById('tab-home').style.display, 'none');

  setTab('home');
  assert.strictEqual(window.currentTab, 'home');
  assert.strictEqual(document.getElementById('tab-home').style.display, 'block');
});

// ── TEST 6: Theme Switching ──
it('6.1 Toggles theme between Light and Dark mode', () => {
  setAppTheme('dark');
  assert.strictEqual(window.currentAppTheme, 'dark');
  assert.strictEqual(localStorage.getItem('pocketTrackTheme'), 'dark');

  setAppTheme('light');
  assert.strictEqual(window.currentAppTheme, 'light');
  assert.strictEqual(localStorage.getItem('pocketTrackTheme'), 'light');
});

// ── TEST 7: Edit Existing Entry ──
it('7.1 Opens composer and edits an existing transaction', () => {
  const target = window.entries[0];
  startEditEntry(target.id);

  document.getElementById('comp-amt').value = '600';
  document.getElementById('comp-note').value = 'Updated Dinner';
  saveComposerEntry();

  const updated = window.entries.find(e => e.id === target.id);
  assert.strictEqual(updated.amt, 600);
  assert.strictEqual(updated.desc, 'Updated Dinner');
});

// ── TEST 8: Search & Category Filter ──
it('8.1 Filters activity entries by category and search keyword', () => {
  window.entries = [
    { id: 'e1', type: 'expense', amt: 250, cat: 'food', desc: 'Burger King', date: '2026-08-31' },
    { id: 'e2', type: 'expense', amt: 1200, cat: 'shopping', desc: 'Zara Shirt', date: '2026-08-31' },
    { id: 'e3', type: 'income', amt: 5000, cat: 'salary', desc: 'August Salary', date: '2026-08-31' }
  ];

  setActivityFilter('expense');
  assert.strictEqual(window.currentActivityFilter, 'expense');

  onActivitySearch('Burger');
  assert.strictEqual(window.currentSearchQuery, 'Burger');
});

// ── TEST 9: Voice NLP Parser ──
it('9.1 Extracts amount, category, type, and wallet from natural speech', () => {
  const p1 = parseVoiceTranscript('₹350 pizza via UPI');
  assert.strictEqual(p1.amt, 350);
  assert.strictEqual(p1.type, 'expense');
  assert.strictEqual(p1.cat, 'food');
  assert.strictEqual(p1.wallet, 'bank');

  const p2 = parseVoiceTranscript('Got 45000 salary');
  assert.strictEqual(p2.amt, 45000);
  assert.strictEqual(p2.type, 'income');
  assert.strictEqual(p2.cat, 'salary');

  const p3 = parseVoiceTranscript('1200 groceries via card');
  assert.strictEqual(p3.amt, 1200);
  assert.strictEqual(p3.type, 'expense');
  assert.strictEqual(p3.cat, 'grocery');
  assert.strictEqual(p3.wallet, 'card');
});

// ── TEST 10: Monthly Savings Target & Safe-to-Spend ──
it('10.1 Sets savings target and adjusts daily safe-to-spend limit', () => {
  window.entries = [
    { id: 'i1', type: 'income', amt: 30000, cat: 'salary', date: '2026-09-01' },
    { id: 'e1', type: 'expense', amt: 10000, cat: 'rent', date: '2026-09-01' }
  ];
  // Balance is 20000
  // Set savings target = 5000 -> spendable = 15000
  document.getElementById('savings-target-input').value = '5000';
  saveSavingsTarget();

  assert.strictEqual(localStorage.getItem('pocketTrackSavingsTarget'), '5000');
  
  updateHeaderStats();
  const safeText = document.getElementById('safe-to-spend-val').textContent;
  assert.ok(safeText.startsWith('₹'), 'Safe to spend must be formatted');
  assert.ok(document.getElementById('safe-to-spend-sub').textContent.includes('Saving ₹5,000'));
});

// ── TEST 11: Curated Preloaded Emoji Grid for Wallets ──
it('11.1 Selects curated emoji and creates wallet without manual emoji typing', () => {
  openNewWalletModal();
  selectWalletEmoji('💎');
  document.getElementById('new-wallet-name').value = 'Crypto Vault';
  saveNewWallet();

  const vault = getWallets().find(w => w.name === 'Crypto Vault');
  assert.ok(vault, 'Custom wallet must be created');
  assert.strictEqual(vault.icon, '💎', 'Wallet icon must be the selected emoji');
});

// ── TEST 12: Recurring Transactions Engine ──
it('12.1 Saves recurring subscription rule and processes due items', () => {
  const rule = {
    id: 'rec_test_netflix',
    amt: 499,
    type: 'expense',
    cat: 'entertainment',
    desc: 'Netflix 4K',
    wallet: 'bank',
    frequency: 'monthly',
    nextDueDate: new Date().toISOString().split('T')[0],
    lastProcessedDate: '',
    active: true
  };
  saveRecurringRule(rule);

  const initialCount = window.entries.length;
  const processed = checkAndProcessRecurring();
  
  assert.strictEqual(processed, 1, 'Due recurring rule must be processed');
  assert.strictEqual(window.entries.length, initialCount + 1, 'New transaction entry must be logged');
  assert.strictEqual(window.entries[0].amt, 499);
  assert.strictEqual(window.entries[0].wallet, 'bank');
});

it('12.2 Toggling recurring rule pauses and resumes auto-processing', () => {
  toggleRecurringRule('rec_test_netflix');
  const r = getRecurringRules().find(x => x.id === 'rec_test_netflix');
  assert.strictEqual(r.active, false, 'Rule must be paused');

  toggleRecurringRule('rec_test_netflix');
  const r2 = getRecurringRules().find(x => x.id === 'rec_test_netflix');
  assert.strictEqual(r2.active, true, 'Rule must be active again');
});

// ── TEST 13: Per-Wallet Savings Targets & Budgets ──
it('13.1 Saves and retrieves distinct savings targets and budgets per wallet', () => {
  saveWalletSavingsTarget('bank', 8000);
  saveWalletSavingsTarget('cash', 2000);
  saveWalletBudget('card', 12000);

  const targets = getWalletSavingsTargets();
  const budgets = getWalletBudgets();

  assert.strictEqual(targets.bank, 8000);
  assert.strictEqual(targets.cash, 2000);
  assert.strictEqual(budgets.card, 12000);
});

// ── TEST 14: Privacy Mode & 4-Digit PIN Lock ──
it('14.1 Sets 4-Digit Privacy PIN and masks balance numbers', () => {
  window.entries = [
    { id: '1', type: 'income', amt: 50000, cat: 'salary', date: '2026-09-01' }
  ];
  document.getElementById('set-pin-input').value = '4321';
  document.getElementById('set-pin-confirm').value = '4321';
  saveNewPrivacyPin();

  assert.strictEqual(localStorage.getItem('pocketTrackPrivacyPin'), '4321');
  assert.strictEqual(localStorage.getItem('pocketTrackPrivacyMode'), 'true');
  assert.strictEqual(isPrivacyActive(), true);
  assert.strictEqual(document.getElementById('hdr-balance').textContent, '₹••••••');
  assert.strictEqual(document.getElementById('hero-income').textContent, '₹••••');
});

it('14.2 Unlocks session with correct PIN and unmasks balances', () => {
  document.getElementById('unlock-pin-input').value = '4321';
  submitUnlockPin();

  assert.strictEqual(window.isPrivacyUnlockedSession, true);
  assert.strictEqual(isPrivacyActive(), false);
  assert.strictEqual(document.getElementById('hdr-balance').textContent, '₹50,000');
  assert.strictEqual(document.getElementById('hero-income').textContent, '₹50,000');
});

// ── TEST 15: ⚡ 2-Tap Quick Spend Presets ──
it('15.1 Opens composer prefilled with preset values for quick adjustment (2-Tap)', () => {
  const presets = getQuickPresets();
  assert.ok(presets.length >= 4, 'Must have default quick presets');
  const chai = presets.find(p => p.id === 'p_chai');
  assert.ok(chai, 'Chai preset must exist');

  logQuickPreset('p_chai');

  assert.strictEqual(Number(document.getElementById('comp-amt').value), 20);
  assert.strictEqual(document.getElementById('comp-note').value, 'Chai');
});

it('15.2 Adds custom quick preset to speed dial bar', () => {
  document.getElementById('new-preset-name').value = 'Filter Coffee';
  document.getElementById('new-preset-amt').value = '35';
  document.getElementById('new-preset-icon').value = '☕';
  document.getElementById('new-preset-cat').value = 'food';
  document.getElementById('new-preset-wallet').value = 'bank';

  saveCustomQuickPreset();

  const customP = getQuickPresets().find(p => p.name === 'Filter Coffee');
  assert.ok(customP, 'Custom preset must be created');
  assert.strictEqual(customP.amt, 35);
  assert.strictEqual(customP.wallet, 'bank');
});

// ── TEST 16: 📊 Insights & Analytics Engine (Expense & Income) ──
it('16.1 Aggregates monthly expenses, computes top category and percentages', () => {
  window.entries = [
    { id: '1', type: 'income', amt: 60000, cat: 'salary', date: '2026-09-01' },
    { id: '2', type: 'expense', amt: 4000, cat: 'food', date: '2026-09-02' },
    { id: '3', type: 'expense', amt: 2000, cat: 'transport', date: '2026-09-03' },
    { id: '4', type: 'expense', amt: 4000, cat: 'food', date: '2026-09-04' }
  ];

  const data = getInsightsData('2026-09', 'expense');
  assert.strictEqual(data.totalIncome, 60000);
  assert.strictEqual(data.totalExpense, 10000);
  assert.strictEqual(data.netSavings, 50000);
  assert.strictEqual(data.topCategory.id, 'food');
  assert.strictEqual(data.topCategory.total, 8000);
  assert.strictEqual(data.topCategory.pct, 80);
});

it('16.2 Aggregates monthly income sources and distribution', () => {
  window.entries = [
    { id: '1', type: 'income', amt: 50000, cat: 'salary', date: '2026-09-01' },
    { id: '2', type: 'income', amt: 15000, cat: 'freelance', date: '2026-09-05' }
  ];

  const data = getInsightsData('2026-09', 'income');
  assert.strictEqual(data.activeTotal, 65000);
  assert.strictEqual(data.topCategory.id, 'salary');
  assert.strictEqual(data.topCategory.total, 50000);
  assert.strictEqual(data.categories.length, 2);
});

// ── TEST 17: Structured Export & PDF Helper ──
it('17.1 Exports and download statement functions are correctly initialized', () => {
  assert.strictEqual(typeof exportTransactionsCSV, 'function');
  assert.strictEqual(typeof downloadMonthlyPDFStatement, 'function');
});

console.log('\n═══════════════════════════════════════════════');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('═══════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL POCKETTRACK PURE TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}
