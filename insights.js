// =====================================================================
// POCKETTRACK PURE — INSIGHTS & ANALYTICS CONTROLLER
// =====================================================================

const INSIGHT_CATEGORY_COLORS = {
  // Expenses
  food: '#ef4444',
  grocery: '#f97316',
  groceries: '#f97316',
  transport: '#f59e0b',
  travel: '#f59e0b',
  fuel: '#eab308',
  shopping: '#8b5cf6',
  bills: '#3b82f6',
  entertainment: '#ec4899',
  health: '#10b981',
  education: '#06b6d4',
  rent: '#6366f1',
  other: '#64748b',
  // Income
  salary: '#10b981',
  freelance: '#059669',
  gift: '#ec4899',
  investment: '#8b5cf6'
};

let currentInsightsType = 'expense'; // 'expense' | 'income'
let currentInsightsMonth = (function() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

function setInsightsType(type) {
  currentInsightsType = type;
  renderInsightsTab();
}
window.setInsightsType = setInsightsType;

function setInsightsMonth(val) {
  if (val) {
    currentInsightsMonth = val;
    renderInsightsTab();
  }
}
window.setInsightsMonth = setInsightsMonth;

function getInsightsData(monthStr, viewType = currentInsightsType) {
  const all = window.entries || [];
  const targetMonth = monthStr || currentInsightsMonth;
  const monthEntries = all.filter(e => e.date && e.date.startsWith(targetMonth));

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseCatMap = {};
  const incomeCatMap = {};

  monthEntries.forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    const cat = e.cat || 'other';

    if (e.type === 'income') {
      totalIncome += amt;
      if (!incomeCatMap[cat]) {
        incomeCatMap[cat] = {
          id: cat,
          name: typeof getCategoryName === 'function' ? getCategoryName(cat, 'income') : (cat.charAt(0).toUpperCase() + cat.slice(1)),
          icon: typeof getCategoryIcon === 'function' ? getCategoryIcon(cat, 'income') : '💵',
          color: INSIGHT_CATEGORY_COLORS[cat] || '#10b981',
          total: 0,
          count: 0
        };
      }
      incomeCatMap[cat].total += amt;
      incomeCatMap[cat].count += 1;
    } else if (e.type === 'expense') {
      totalExpense += amt;
      if (!expenseCatMap[cat]) {
        expenseCatMap[cat] = {
          id: cat,
          name: typeof getCategoryName === 'function' ? getCategoryName(cat, 'expense') : (cat.charAt(0).toUpperCase() + cat.slice(1)),
          icon: typeof getCategoryIcon === 'function' ? getCategoryIcon(cat, 'expense') : '🏷️',
          color: INSIGHT_CATEGORY_COLORS[cat] || '#8b5cf6',
          total: 0,
          count: 0
        };
      }
      expenseCatMap[cat].total += amt;
      expenseCatMap[cat].count += 1;
    }
  });

  const isIncomeView = (viewType === 'income');
  const activeMap = isIncomeView ? incomeCatMap : expenseCatMap;
  const activeTotal = isIncomeView ? totalIncome : totalExpense;

  const categories = Object.values(activeMap).sort((a, b) => b.total - a.total);
  categories.forEach(c => {
    c.pct = activeTotal > 0 ? Math.round((c.total / activeTotal) * 100) : 0;
  });

  const topCategory = categories.length > 0 ? categories[0] : null;
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // Calculate days passed in month for average
  const [year, month] = targetMonth.split('-').map(Number);
  const now = new Date();
  const isCurrentMonth = (now.getFullYear() === year && (now.getMonth() + 1) === month);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysCount = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
  const dailyAverage = Math.round(totalExpense / daysCount);

  return {
    monthStr: targetMonth,
    viewType,
    entriesCount: monthEntries.length,
    activeTotal,
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
    dailyAverage,
    categories,
    topCategory
  };
}
window.getInsightsData = getInsightsData;

function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}
window.formatMonthLabel = formatMonthLabel;

function prevInsightsMonth() {
  const [year, month] = currentInsightsMonth.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  currentInsightsMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderInsightsTab();
}
window.prevInsightsMonth = prevInsightsMonth;

function nextInsightsMonth() {
  const [year, month] = currentInsightsMonth.split('-').map(Number);
  const d = new Date(year, month, 1);
  currentInsightsMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderInsightsTab();
}
window.nextInsightsMonth = nextInsightsMonth;

function renderInsightsTab() {
  const container = document.getElementById('tab-insights');
  if (!container) return;

  const isIncome = (currentInsightsType === 'income');
  const data = getInsightsData(currentInsightsMonth, currentInsightsType);
  const monthLabel = formatMonthLabel(data.monthStr);

  // 1. Header with Month Navigator & PDF Button
  const headerHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div>
        <p class="eyebrow" style="letter-spacing:1px;font-size:9.5px;font-weight:800;color:var(--accent);margin:0 0 2px;">INSIGHTS</p>
        <h2 style="font-size:20px;font-weight:800;margin:0;">Monthly Summary</h2>
      </div>
      <button class="btn btn-sm" onclick="downloadMonthlyPDFStatement('${data.monthStr}')" style="font-size:11.5px;padding:6px 12px;border-radius:12px;color:var(--accent);border-color:rgba(16,185,129,0.3);" title="Download 1-Page PDF Statement">
        <i class="ti ti-file-text"></i> PDF Statement
      </button>
    </div>

    <!-- Prominent Month Selector -->
    <div class="insights-month-bar" style="margin-bottom:14px;">
      <button type="button" class="icon-btn" onclick="prevInsightsMonth()" title="Previous Month"><i class="ti ti-chevron-left"></i></button>
      <div style="position:relative;display:flex;align-items:center;gap:6px;cursor:pointer;">
        <label for="insights-month-input" style="cursor:pointer;display:flex;align-items:center;gap:6px;">
          <span style="font-size:15px;font-weight:800;color:var(--text);">${monthLabel}</span>
          <i class="ti ti-calendar" style="color:var(--accent);font-size:14px;"></i>
        </label>
        <input 
          type="month" 
          id="insights-month-input" 
          value="${data.monthStr}" 
          onchange="setInsightsMonth(this.value)" 
          style="position:absolute;opacity:0;inset:0;width:100%;height:100%;cursor:pointer;z-index:2;"
        />
      </div>
      <button type="button" class="icon-btn" onclick="nextInsightsMonth()" title="Next Month"><i class="ti ti-chevron-right"></i></button>
    </div>
  `;

  // Clean empty state if no entries for the selected month
  if (data.entriesCount === 0) {
    container.innerHTML = `
      ${headerHtml}
      <div class="card" style="padding:40px 20px;text-align:center;border-radius:24px;">
        <span style="font-size:36px;display:block;margin-bottom:8px;">🌿</span>
        <h3 style="font-size:16px;font-weight:800;margin:0 0 6px;">No entries for ${monthLabel}</h3>
        <p style="font-size:12.5px;color:var(--text-dim);margin:0 0 16px;">Log an expense or income to view this month's summary.</p>
        <button class="btn btn-primary" onclick="setTab('home')" style="padding:10px 20px;border-radius:12px;font-weight:700;">Go to Home</button>
      </div>
    `;
    return;
  }

  // 2. Card 1: This Month Income vs Spent
  const incWidth = data.totalIncome + data.totalExpense > 0 
    ? Math.round((data.totalIncome / (data.totalIncome + data.totalExpense)) * 100) 
    : 50;
  const expWidth = 100 - incWidth;

  const cashFlowCardHtml = `
    <div class="card" style="padding:18px;border-radius:22px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:800;margin:0;">Income vs Spent</h3>
        <span style="font-size:11px;font-weight:800;color:${data.netSavings >= 0 ? 'var(--green)' : 'var(--red)'};padding:2px 8px;border-radius:8px;background:${data.netSavings >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};">
          ${data.netSavings >= 0 ? `+₹${data.netSavings.toLocaleString('en-IN')} net` : `-₹${Math.abs(data.netSavings).toLocaleString('en-IN')} deficit`}
        </span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div style="padding:10px 12px;border-radius:14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);">
          <span style="font-size:10px;font-weight:800;color:var(--green);text-transform:uppercase;">INCOME</span>
          <strong style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:800;color:var(--green);display:block;margin-top:2px;">₹${data.totalIncome.toLocaleString('en-IN')}</strong>
        </div>
        <div style="padding:10px 12px;border-radius:14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);">
          <span style="font-size:10px;font-weight:800;color:var(--red);text-transform:uppercase;">SPENT</span>
          <strong style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:800;color:var(--red);display:block;margin-top:2px;">₹${data.totalExpense.toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div style="height:8px;border-radius:6px;background:rgba(0,0,0,0.06);display:flex;overflow:hidden;">
        <div style="width:${incWidth}%;background:var(--green);" title="Income: ${incWidth}%"></div>
        <div style="width:${expWidth}%;background:var(--red);" title="Expense: ${expWidth}%"></div>
      </div>
    </div>
  `;

  // 3. Card 2: Top Categories (Simple Clean Bars)
  const categoryCardHtml = `
    <div class="card" style="padding:18px;border-radius:22px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:800;margin:0;">Top Categories</h3>
        <div style="display:flex;gap:4px;background:rgba(0,0,0,0.05);padding:2px;border-radius:10px;">
          <button type="button" onclick="setInsightsType('expense')" style="padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;${!isIncome ? 'background:var(--card);color:var(--red);' : 'background:none;color:var(--text-dim);'}">Expense</button>
          <button type="button" onclick="setInsightsType('income')" style="padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;${isIncome ? 'background:var(--card);color:var(--green);' : 'background:none;color:var(--text-dim);'}">Income</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        ${data.categories.length === 0 ? `
          <div style="padding:16px 0;text-align:center;color:var(--text-dim);font-size:12.5px;">No ${isIncome ? 'income' : 'expense'} entries this month.</div>
        ` : data.categories.slice(0, 5).map(c => `
          <div style="display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:16px;">${c.icon}</span>
                <strong style="font-size:13px;color:var(--text);">${c.name}</strong>
              </div>
              <div style="text-align:right;">
                <strong style="font-family:'Space Grotesk',sans-serif;font-size:13.5px;color:var(--text);">₹${c.total.toLocaleString('en-IN')}</strong>
                <span style="font-size:11px;font-weight:800;color:${c.color};margin-left:4px;">${c.pct}%</span>
              </div>
            </div>
            <div style="height:6px;width:100%;background:rgba(0,0,0,0.05);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${c.pct}%;background:${c.color};border-radius:4px;transition:width 0.4s ease;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 4. Card 3: Calm Safe-to-Spend Coaching Slice
  let coachingLine = '';
  // Compute today's spend
  const todayStr = new Date().toISOString().split('T')[0];
  const all = window.entries || [];
  const todaySpent = all
    .filter(e => e.date === todayStr && e.type === 'expense')
    .reduce((sum, e) => sum + (parseFloat(e.amt) || 0), 0);

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - new Date().getDate() + 1);
  const savingsTarget = parseFloat(localStorage.getItem('pocketTrackSavingsTarget')) || 0;
  const netBal = all.reduce((sum, e) => sum + (e.type === 'income' ? parseFloat(e.amt) : -parseFloat(e.amt)), 0);
  const spendable = Math.max(0, netBal - savingsTarget);
  const safePerDay = Math.floor(spendable / daysLeft);

  if (safePerDay > 0) {
    const pctUsed = Math.round((todaySpent / safePerDay) * 100);
    if (todaySpent === 0) {
      coachingLine = `✨ ₹0 spent today · Full ₹${safePerDay.toLocaleString('en-IN')} safe-to-spend slice available.`;
    } else if (todaySpent <= safePerDay) {
      coachingLine = `🌿 You've used ${pctUsed}% of today's safe slice (₹${todaySpent.toLocaleString('en-IN')} of ₹${safePerDay.toLocaleString('en-IN')}) · On track!`;
    } else {
      coachingLine = `🌱 Today's spend: ₹${todaySpent.toLocaleString('en-IN')} (₹${(todaySpent - safePerDay).toLocaleString('en-IN')} above daily slice) · Tomorrow's slice automatically adjusts.`;
    }
  } else {
    coachingLine = `💡 Set a Monthly Savings Target in Settings to unlock your personalized Daily Safe-to-Spend slice.`;
  }

  const coachingCardHtml = `
    <div class="card" style="padding:14px 16px;border-radius:20px;background:var(--green-soft);border:1px solid rgba(16,185,129,0.25);display:flex;align-items:center;gap:10px;">
      <span style="font-size:22px;flex-shrink:0;">🎯</span>
      <p style="font-size:12.5px;font-weight:600;color:var(--text);margin:0;line-height:1.4;">
        ${coachingLine}
      </p>
    </div>
  `;

  container.innerHTML = `
    ${headerHtml}
    ${cashFlowCardHtml}
    ${categoryCardHtml}
    ${coachingCardHtml}
  `;
}
window.renderInsightsTab = renderInsightsTab;
