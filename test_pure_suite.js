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
  document.getElementById('new-wallet-name').value = 'Petty Cash';
  document.getElementById('new-wallet-icon').value = '🪙';

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

console.log('\n═══════════════════════════════════════════════');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('═══════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL POCKETTRACK PURE TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}
