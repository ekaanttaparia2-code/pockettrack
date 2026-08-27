'use strict';

/**
 * PocketTrack Shared Portfolios & Multi-Member Expense Engine
 * Allows multiple members (roommates, couples, trip groups, family)
 * to track shared expenses together with live balance pools and WhatsApp settlement.
 */

// Inject styles for Portfolio switcher, Member Badges, and Shared Pool Cards
(function() {
  const s = document.createElement('style');
  s.textContent = `
    .portfolio-switcher-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding: 4px 2px 14px 2px;
      margin-bottom: 12px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .portfolio-switcher-bar::-webkit-scrollbar { display: none; }
    
    .portfolio-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 99px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--text-dim, #94a3b8);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      -webkit-tap-highlight-color: transparent;
    }
    .portfolio-pill:active { transform: scale(0.95); }
    .portfolio-pill.active {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(236, 72, 153, 0.2));
      border-color: rgba(139, 92, 246, 0.6);
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
    }
    .portfolio-pill.add-pill {
      border-style: dashed;
      background: rgba(139, 92, 246, 0.08);
      color: var(--accent-bright, #c4b5fd);
      border-color: rgba(139, 92, 246, 0.4);
    }
    
    .shared-pool-card {
      background: linear-gradient(165deg, rgba(30, 27, 58, 0.85), rgba(15, 12, 34, 0.9));
      border: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 24px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      position: relative;
      overflow: hidden;
    }
    .shared-pool-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .shared-pool-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      background: rgba(52, 211, 153, 0.15);
      color: var(--green, #34d399);
      border: 1px solid rgba(52, 211, 153, 0.3);
    }
    
    .shared-settle-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin: 14px 0;
    }
    .shared-settle-item {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 12px;
      text-align: center;
    }
    .shared-settle-name { font-size: 12px; color: var(--text-dim, #94a3b8); margin-bottom: 4px; font-weight: 600; }
    .shared-settle-amt { font-size: 15px; font-weight: 800; font-family: 'Space Grotesk', sans-serif; }
    
    .whatsapp-btn {
      background: #25D366;
      color: #ffffff;
      border: none;
      border-radius: 14px;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);
      transition: transform 0.2s, background 0.2s;
    }
    .whatsapp-btn:active { transform: scale(0.95); background: #1ebc59; }

    /* Dedicated Mobile Bottom Sheet */
    .pt-sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 10005;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.28s;
    }
    .pt-sheet-backdrop.active {
      opacity: 1;
      visibility: visible;
    }
    .pt-sheet-panel {
      width: 100%;
      max-width: 500px;
      background: linear-gradient(175deg, #1f1a3a 0%, #120e24 100%);
      border: 1px solid rgba(139, 92, 246, 0.4);
      border-radius: 28px 28px 0 0;
      padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.6);
      transform: translateY(100%);
      transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }
    .pt-sheet-backdrop.active .pt-sheet-panel {
      transform: translateY(0);
    }
    .pt-sheet-handle {
      width: 44px;
      height: 5px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.25);
      margin: -10px auto 18px;
    }
  `;
  document.head.appendChild(s);
})();

// Local memory and active state
let activePortfolioId = 'personal';
let sharedPortfolios = [];

const DEFAULT_PORTFOLIO_ICONS = ['🏠', '🏔️', '🍕', '🚗', '👨‍👩‍👧‍👦', '💼', '🎉', '🏖️'];

function getSharedPortfoliosStorageKey() {
  const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : 'guest';
  return 'pockettrack_shared_portfolios_' + uid;
}

function loadSharedPortfolios() {
  try {
    const raw = localStorage.getItem(getSharedPortfoliosStorageKey());
    sharedPortfolios = raw ? JSON.parse(raw) : [];
  } catch (e) {
    sharedPortfolios = [];
  }
}

function saveSharedPortfolios() {
  try {
    localStorage.setItem(getSharedPortfoliosStorageKey(), JSON.stringify(sharedPortfolios));
  } catch (e) {}
}

/**
 * Renders the top switcher pill bar
 */
function renderPortfolioSwitcher() {
  loadSharedPortfolios();
  const bar = document.getElementById('portfolio-switcher-bar');
  if (!bar) return;

  const listEl = document.getElementById('portfolio-pills-list');
  if (!listEl) return;

  const personalBtn = document.getElementById('port-pill-personal');
  if (personalBtn) {
    personalBtn.classList.toggle('active', activePortfolioId === 'personal');
  }

  listEl.innerHTML = sharedPortfolios.map(p => {
    const isActive = activePortfolioId === p.id;
    return `
      <button class="portfolio-pill ${isActive ? 'active' : ''}" onclick="switchActivePortfolio('${p.id}')">
        <span>${p.icon || '👥'} ${escapeHTML(p.name)}</span>
      </button>
    `;
  }).join('');
}

window.switchActivePortfolio = function(portfolioId) {
  activePortfolioId = portfolioId;
  renderPortfolioSwitcher();
  renderSharedPortfolioView();
  if (typeof renderHomeSnapshot === 'function') renderHomeSnapshot();
  if (typeof toast === 'function') {
    const p = sharedPortfolios.find(x => x.id === portfolioId);
    const label = p ? p.name : 'Personal Vault';
    toast('Switched to ' + label, 'info');
  }
};

/**
 * Creates a dedicated Sheet Backdrop container
 */
function getOrCreateSheetContainer() {
  let el = document.getElementById('pt-sheet-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pt-sheet-container';
    el.className = 'pt-sheet-backdrop';
    el.onclick = function(e) {
      if (e.target === el) window.closeCustomSheet();
    };
    document.body.appendChild(el);
  }
  return el;
}

window.closeCustomSheet = function() {
  const el = document.getElementById('pt-sheet-container');
  if (el) el.classList.remove('active');
};

/**
 * Creates a new Shared Portfolio Modal (Mobile Bottom-Sheet)
 */
window.openNewPortfolioModal = function() {
  const container = getOrCreateSheetContainer();

  container.innerHTML = `
    <div class="pt-sheet-panel">
      <div class="pt-sheet-handle"></div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="margin:0;font-size:19px;font-weight:700;color:#fff;font-family:'Space Grotesk',sans-serif;">👥 Create Shared Space</h3>
        <button onclick="closeCustomSheet()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;">✕</button>
      </div>

      <p style="font-size:13px;color:var(--text-dim,#94a3b8);margin:0 0 18px;line-height:1.45;">
        Track pooled expenses with flatmates, friends, partners, or trip groups.
      </p>
      
      <label style="font-size:12px;font-weight:600;color:#cbd5e1;display:block;margin-bottom:6px;">Space / Group Name</label>
      <input type="text" id="new-port-name" placeholder="e.g. Flat 302, Goa Trip, Family" style="width:100%;padding:13px 14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:15px;margin-bottom:14px;box-sizing:border-box;outline:none;">
      
      <label style="font-size:12px;font-weight:600;color:#cbd5e1;display:block;margin-bottom:6px;">Members (comma-separated)</label>
      <input type="text" id="new-port-members" placeholder="e.g. Rahul, Priya, Amit, Me" value="Me" style="width:100%;padding:13px 14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:15px;margin-bottom:20px;box-sizing:border-box;outline:none;">
      
      <div style="display:flex;gap:10px;">
        <button class="btn" onclick="closeCustomSheet()" style="flex:1;border-radius:14px;padding:12px;font-size:14px;">Cancel</button>
        <button class="btn primary" onclick="submitNewPortfolio()" style="flex:1.4;border-radius:14px;padding:12px;font-size:14px;background:linear-gradient(135deg,#8b5cf6,#ec4899);font-weight:700;">Create Space →</button>
      </div>
    </div>
  `;

  // Trigger animation
  requestAnimationFrame(() => {
    container.classList.add('active');
  });
};

window.submitNewPortfolio = function() {
  const nameEl = document.getElementById('new-port-name');
  const membersEl = document.getElementById('new-port-members');
  if (!nameEl || !nameEl.value.trim()) {
    if (typeof toast === 'function') toast('Please enter a space name', 'error');
    return;
  }

  const rawMembers = membersEl ? membersEl.value.split(',').map(m => m.trim()).filter(Boolean) : ['Me'];
  if (!rawMembers.includes('Me')) rawMembers.unshift('Me');

  const randomIcon = DEFAULT_PORTFOLIO_ICONS[Math.floor(Math.random() * DEFAULT_PORTFOLIO_ICONS.length)];
  const newPortfolio = {
    id: 'port_' + Date.now(),
    name: nameEl.value.trim(),
    icon: randomIcon,
    members: rawMembers,
    inviteCode: 'PT' + Math.floor(1000 + Math.random() * 9000),
    expenses: [],
    createdAt: Date.now()
  };

  sharedPortfolios.push(newPortfolio);
  saveSharedPortfolios();
  window.closeCustomSheet();
  switchActivePortfolio(newPortfolio.id);
  if (typeof toast === 'function') toast(`Created "${newPortfolio.name}"!`, 'success');
};

/**
 * Renders the shared portfolio detail card on the Home Tab
 */
function renderSharedPortfolioView() {
  const container = document.getElementById('home-shared-portfolio-slot');
  if (!container) return;

  if (activePortfolioId === 'personal') {
    container.innerHTML = '';
    return;
  }

  const portfolio = sharedPortfolios.find(p => p.id === activePortfolioId);
  if (!portfolio) {
    activePortfolioId = 'personal';
    renderPortfolioSwitcher();
    container.innerHTML = '';
    return;
  }

  let totalPoolSpend = 0;
  const memberSpent = {};
  portfolio.members.forEach(m => { memberSpent[m] = 0; });

  (portfolio.expenses || []).forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    totalPoolSpend += amt;
    const paidBy = e.paidBy || 'Me';
    memberSpent[paidBy] = (memberSpent[paidBy] || 0) + amt;
  });

  const memberCount = Math.max(1, portfolio.members.length);
  const perPersonShare = totalPoolSpend / memberCount;

  const balances = {};
  portfolio.members.forEach(m => {
    balances[m] = (memberSpent[m] || 0) - perPersonShare;
  });

  const settleCardsHtml = portfolio.members.map(m => {
    const net = balances[m] || 0;
    const isOwed = net > 0;
    const isZero = Math.abs(net) < 1;
    const color = isZero ? 'var(--text-dim,#94a3b8)' : (isOwed ? 'var(--green,#34d399)' : 'var(--red,#f87171)');
    const label = isZero ? 'Settled Up' : (isOwed ? `Gets back ₹${Math.round(net).toLocaleString('en-IN')}` : `Owes ₹${Math.abs(Math.round(net)).toLocaleString('en-IN')}`);
    
    return `
      <div class="shared-settle-item">
        <div class="shared-settle-name">${escapeHTML(m)}</div>
        <div class="shared-settle-amt" style="color:${color};">${label}</div>
        <div style="font-size:10.5px;color:var(--text-dim);margin-top:2px;">Paid: ₹${(memberSpent[m] || 0).toLocaleString('en-IN')}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="shared-pool-card">
      <div class="shared-pool-head">
        <div>
          <div class="shared-pool-badge">👥 SHARED POOL LIVE</div>
          <h2 style="margin:6px 0 2px 0;font-size:22px;color:#fff;font-family:'Space Grotesk',sans-serif;">${portfolio.icon || '👥'} ${escapeHTML(portfolio.name)}</h2>
          <p style="margin:0;font-size:12px;color:var(--text-dim);">Code: <b>${portfolio.inviteCode}</b> · ${portfolio.members.length} Members</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;">Group Total</div>
          <div style="font-size:24px;font-weight:800;color:#fff;font-family:'Space Grotesk',sans-serif;">₹${totalPoolSpend.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div class="shared-settle-grid">
        ${settleCardsHtml}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
        <button class="btn primary" style="flex:1;border-radius:14px;padding:12px 14px;font-size:13px;" onclick="openAddSharedExpenseModal('${portfolio.id}')">
          <i class="ti ti-plus"></i> Add Group Expense
        </button>
        <button class="whatsapp-btn" style="flex:1;" onclick="sharePortfolioOnWhatsApp('${portfolio.id}')">
          <span>💬 Settle on WhatsApp</span>
        </button>
      </div>
    </div>
  `;
}

window.openAddSharedExpenseModal = function(portfolioId) {
  const p = sharedPortfolios.find(x => x.id === portfolioId);
  if (!p) return;

  const memberOptions = p.members.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');
  const container = getOrCreateSheetContainer();

  container.innerHTML = `
    <div class="pt-sheet-panel">
      <div class="pt-sheet-handle"></div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="margin:0;font-size:19px;font-weight:700;color:#fff;font-family:'Space Grotesk',sans-serif;">➕ Add Expense to ${escapeHTML(p.name)}</h3>
        <button onclick="closeCustomSheet()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;">✕</button>
      </div>
      
      <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:6px;font-weight:600;">What was it for?</label>
      <input type="text" id="shared-exp-desc" placeholder="e.g. Groceries, Dinner, Fuel" style="width:100%;padding:13px 14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:15px;margin-bottom:14px;box-sizing:border-box;outline:none;">
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
        <div>
          <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:6px;font-weight:600;">Amount (₹)</label>
          <input type="number" id="shared-exp-amt" placeholder="₹0" style="width:100%;padding:13px 14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:15px;box-sizing:border-box;outline:none;">
        </div>
        <div>
          <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:6px;font-weight:600;">Who Paid?</label>
          <select id="shared-exp-payer" style="width:100%;padding:13px 14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:15px;box-sizing:border-box;outline:none;">
            ${memberOptions}
          </select>
        </div>
      </div>
      
      <div style="display:flex;gap:10px;">
        <button class="btn" onclick="closeCustomSheet()" style="flex:1;border-radius:14px;padding:12px;">Cancel</button>
        <button class="btn primary" onclick="submitSharedExpense('${p.id}')" style="flex:1.4;border-radius:14px;padding:12px;font-weight:700;">Save & Split →</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    container.classList.add('active');
  });
};

window.submitSharedExpense = function(portfolioId) {
  const desc = document.getElementById('shared-exp-desc')?.value.trim();
  const amt = parseFloat(document.getElementById('shared-exp-amt')?.value);
  const paidBy = document.getElementById('shared-exp-payer')?.value || 'Me';

  if (!desc || isNaN(amt) || amt <= 0) {
    if (typeof toast === 'function') toast('Please enter valid description and amount', 'error');
    return;
  }

  const p = sharedPortfolios.find(x => x.id === portfolioId);
  if (!p) return;

  if (!p.expenses) p.expenses = [];
  p.expenses.unshift({
    id: 'exp_' + Date.now(),
    desc,
    amt,
    paidBy,
    date: (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().split('T')[0],
    createdAt: Date.now()
  });

  saveSharedPortfolios();
  window.closeCustomSheet();
  renderSharedPortfolioView();
  if (typeof toast === 'function') toast(`Added ₹${amt} by ${paidBy}!`, 'success');
};

/**
 * 1-Tap WhatsApp Settlement Reminder Generator
 */
window.sharePortfolioOnWhatsApp = function(portfolioId) {
  const p = sharedPortfolios.find(x => x.id === portfolioId);
  if (!p) return;

  let totalPoolSpend = 0;
  const memberSpent = {};
  p.members.forEach(m => { memberSpent[m] = 0; });

  (p.expenses || []).forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    totalPoolSpend += amt;
    const paidBy = e.paidBy || 'Me';
    memberSpent[paidBy] = (memberSpent[paidBy] || 0) + amt;
  });

  const memberCount = Math.max(1, p.members.length);
  const perPersonShare = totalPoolSpend / memberCount;

  let message = `👋 *PocketTrack Expense Split — ${p.name}*\n`;
  message += `💰 *Total Pool:* ₹${totalPoolSpend.toLocaleString('en-IN')} (₹${Math.round(perPersonShare).toLocaleString('en-IN')}/person)\n\n`;
  message += `📊 *Current Balances:*\n`;

  p.members.forEach(m => {
    const net = (memberSpent[m] || 0) - perPersonShare;
    if (net > 0) {
      message += `🟢 *${m}:* gets back ₹${Math.round(net).toLocaleString('en-IN')}\n`;
    } else if (net < 0) {
      message += `🔴 *${m}:* owes ₹${Math.abs(Math.round(net)).toLocaleString('en-IN')}\n`;
    } else {
      message += `⚪ *${m}:* settled\n`;
    }
  });

  message += `\n⚡ Tracked in real-time with PocketTrack`;

  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

// Initial Auto-Load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    renderPortfolioSwitcher();
    renderSharedPortfolioView();
  });
} else {
  renderPortfolioSwitcher();
  renderSharedPortfolioView();
}
