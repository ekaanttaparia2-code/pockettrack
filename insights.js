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

function generateDonutChartSVG(categories, activeTotal, isIncome) {
  if (!categories || !categories.length || activeTotal <= 0) {
    return `
      <svg viewBox="0 0 160 160" class="donut-chart-svg" style="width:160px;height:160px;">
        <circle cx="80" cy="80" r="58" fill="none" stroke="var(--border)" stroke-width="18" />
        <text x="80" y="85" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="12" font-weight="700" fill="var(--text-dim)">No ${isIncome ? 'Income' : 'Expenses'}</text>
      </svg>
    `;
  }

  const radius = 58;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;
  let svgPaths = '';

  categories.forEach(cat => {
    const fraction = cat.total / activeTotal;
    const dashLength = fraction * circumference;
    const offset = -(accumulatedPercent * circumference);
    const color = cat.color || (isIncome ? '#10b981' : '#8b5cf6');

    svgPaths += `
      <circle 
        cx="80" 
        cy="80" 
        r="${radius}" 
        fill="none" 
        stroke="${color}" 
        stroke-width="${strokeWidth}" 
        stroke-dasharray="${dashLength} ${circumference - dashLength}" 
        stroke-dashoffset="${offset}"
        style="transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1); cursor: pointer;"
        transform="rotate(-90 80 80)"
      >
        <title>${cat.name}: ₹${cat.total.toLocaleString('en-IN')} (${cat.pct}%)</title>
      </circle>
    `;
    accumulatedPercent += fraction;
  });

  const centerLabel = isIncome ? 'TOTAL INCOME' : 'TOTAL SPENT';
  const centerColor = isIncome ? 'var(--green)' : 'var(--text)';

  return `
    <svg viewBox="0 0 160 160" class="donut-chart-svg" style="width:160px;height:160px;">
      <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="${strokeWidth}" />
      ${svgPaths}
      <g transform="translate(80, 76)">
        <text text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="16" font-weight="800" fill="${centerColor}">₹${activeTotal.toLocaleString('en-IN')}</text>
        <text y="16" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="0.5" fill="var(--text-dim)">${centerLabel}</text>
      </g>
    </svg>
  `;
}

function renderInsightsTab() {
  const container = document.getElementById('tab-insights');
  if (!container) return;

  const isIncome = (currentInsightsType === 'income');
  const data = getInsightsData(currentInsightsMonth, currentInsightsType);
  const monthLabel = formatMonthLabel(data.monthStr);

  // 1. Header with App Logo Badge & Month Navigator
  const headerHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#10b981,#047857);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(16,185,129,0.25);">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M10 8H18C20.7614 8 23 10.2386 23 13C23 15.7614 20.7614 18 18 18H14.5V24H10V8Z" fill="white"/>
            <path d="M14.5 11.5H17.5C18.8807 11.5 20 12.6193 20 14C20 15.3807 18.8807 16.5 17.5 16.5H14.5V11.5Z" fill="#10b981"/>
            <circle cx="22" cy="23" r="2.5" fill="#34d399"/>
          </svg>
        </div>
        <div>
          <p class="eyebrow" style="letter-spacing:1px;font-size:9px;font-weight:800;color:var(--accent);margin:0;">INSIGHTS & VISUALS</p>
          <h2 style="font-size:19px;font-weight:800;margin:0;line-height:1.2;">Where Money Goes</h2>
        </div>
      </div>
      <button class="btn btn-sm" onclick="downloadMonthlyPDFStatement('${data.monthStr}')" style="font-size:11px;padding:5px 10px;border-radius:10px;color:var(--accent);border-color:rgba(16,185,129,0.3);">
        <i class="ti ti-file-text"></i> PDF
      </button>
    </div>

    <!-- Prominent Month Selector & Native Picker -->
    <div class="insights-month-bar">
      <button type="button" class="icon-btn" onclick="prevInsightsMonth()" title="Previous Month"><i class="ti ti-chevron-left"></i></button>
      
      <div style="position:relative;display:flex;align-items:center;gap:6px;cursor:pointer;">
        <label for="insights-month-input" style="cursor:pointer;display:flex;align-items:center;gap:6px;">
          <span style="font-size:15px;font-weight:800;letter-spacing:-0.2px;color:var(--text);">${monthLabel}</span>
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

    <!-- Segmented Toggle: Expenses vs Income -->
    <div style="display:flex;gap:6px;background:rgba(0,0,0,0.05);padding:4px;border-radius:16px;margin-bottom:14px;">
      <button 
        type="button"
        onclick="setInsightsType('expense')" 
        style="flex:1;padding:8px;border-radius:12px;font-size:12.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s ease;${!isIncome ? 'background:var(--card);color:var(--red);box-shadow:var(--shadow-sm);' : 'background:none;color:var(--text-dim);'}"
      >
        💸 Expense Breakdown
      </button>
      <button 
        type="button"
        onclick="setInsightsType('income')" 
        style="flex:1;padding:8px;border-radius:12px;font-size:12.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s ease;${isIncome ? 'background:var(--card);color:var(--green);box-shadow:var(--shadow-sm);' : 'background:none;color:var(--text-dim);'}"
      >
        💵 Income Breakdown
      </button>
    </div>
  `;

  // 2. Top Category Highlight Callout
  let topHighlightHtml = '';
  if (data.topCategory && data.activeTotal > 0) {
    topHighlightHtml = `
      <div class="insight-callout-card" style="margin-bottom:14px;border-color:${isIncome ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'};background:${isIncome ? 'linear-gradient(135deg,rgba(16,185,129,0.1) 0%,rgba(6,182,212,0.06) 100%)' : 'linear-gradient(135deg,rgba(239,68,68,0.08) 0%,rgba(124,58,237,0.08) 100%)'};">
        <div style="font-size:26px;">${data.topCategory.icon}</div>
        <div>
          <span style="font-size:10px;font-weight:800;color:${isIncome ? 'var(--green)' : 'var(--red)'};letter-spacing:0.8px;text-transform:uppercase;">
            ${isIncome ? 'TOP INCOME SOURCE' : 'TOP SPENDING CATEGORY'}
          </span>
          <p style="font-size:13.5px;font-weight:700;color:var(--text);margin:2px 0 0;">
            <strong>${data.topCategory.name}</strong> represents <strong>${data.topCategory.pct}%</strong> of your monthly ${isIncome ? 'earnings' : 'spending'} (₹${data.topCategory.total.toLocaleString('en-IN')})
          </p>
        </div>
      </div>
    `;
  }

  // 3. Visual Donut Chart Card
  const donutChartSvg = generateDonutChartSVG(data.categories, data.activeTotal, isIncome);
  const chartCardHtml = `
    <div class="card" style="padding:18px;border-radius:24px;margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">${isIncome ? '💰' : '🥧'}</span>
          <h3 style="font-size:15.5px;font-weight:700;margin:0;">${isIncome ? 'Income Distribution' : 'Expense Distribution'}</h3>
        </div>
        <span style="font-size:11.5px;color:var(--text-dim);font-weight:700;">${!isIncome ? `Daily Avg: ₹${data.dailyAverage.toLocaleString('en-IN')}/d` : `${data.categories.length} source(s)`}</span>
      </div>

      <div style="display:flex;align-items:center;justify-content:center;padding:8px 0 14px;">
        ${donutChartSvg}
      </div>

      <!-- Quick Legend Chips -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
        ${data.categories.slice(0, 6).map(c => `
          <div style="display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:10px;background:var(--bg1);border:1px solid var(--border);font-size:11px;font-weight:700;">
            <span style="width:8px;height:8px;border-radius:50%;background:${c.color};"></span>
            <span>${c.name}</span>
            <span style="color:var(--text-dim);">${c.pct}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 4. Cash Flow Comparison Card
  const incWidth = data.totalIncome + data.totalExpense > 0 
    ? Math.round((data.totalIncome / (data.totalIncome + data.totalExpense)) * 100) 
    : 50;
  const expWidth = 100 - incWidth;

  const comparisonCardHtml = `
    <div class="card" style="padding:18px;border-radius:24px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">⚖️</span>
          <h3 style="font-size:15.5px;font-weight:700;margin:0;">Monthly Cash Flow</h3>
        </div>
        <span style="font-size:11px;font-weight:800;color:${data.netSavings >= 0 ? 'var(--green)' : 'var(--red)'};padding:2px 8px;border-radius:8px;background:${data.netSavings >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};">
          ${data.netSavings >= 0 ? `Saved ${data.savingsRate}% (+₹${data.netSavings.toLocaleString('en-IN')})` : `Deficit (-₹${Math.abs(data.netSavings).toLocaleString('en-IN')})`}
        </span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div style="padding:10px 12px;border-radius:14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);">
          <span style="font-size:10.5px;font-weight:800;color:var(--green);text-transform:uppercase;">TOTAL INCOME</span>
          <strong style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:800;color:var(--green);display:block;margin-top:2px;">₹${data.totalIncome.toLocaleString('en-IN')}</strong>
        </div>
        <div style="padding:10px 12px;border-radius:14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);">
          <span style="font-size:10.5px;font-weight:800;color:var(--red);text-transform:uppercase;">TOTAL SPENT</span>
          <strong style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:800;color:var(--red);display:block;margin-top:2px;">₹${data.totalExpense.toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div style="height:8px;border-radius:6px;background:rgba(0,0,0,0.06);display:flex;overflow:hidden;">
        <div style="width:${incWidth}%;background:var(--green);" title="Income: ${incWidth}%"></div>
        <div style="width:${expWidth}%;background:var(--red);" title="Expense: ${expWidth}%"></div>
      </div>
    </div>
  `;

  // 5. Category Breakdown Ranking List
  let categoryListHtml = '';
  if (!data.categories.length) {
    categoryListHtml = `
      <div class="card" style="padding:28px 20px;text-align:center;color:var(--text-dim);font-size:13px;border-radius:24px;">
        <p style="margin:0 0 10px;">No ${isIncome ? 'income' : 'expense'} transactions logged for ${monthLabel}.</p>
        <button class="btn btn-primary" onclick="openQuickComposer('${isIncome ? 'income' : 'expense'}')" style="padding:8px 16px;font-size:12.5px;border-radius:12px;">
          + Add ${isIncome ? 'Income' : 'Expense'}
        </button>
      </div>
    `;
  } else {
    categoryListHtml = `
      <div class="card" style="padding:18px;border-radius:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">🏆</span>
            <h3 style="font-size:15.5px;font-weight:700;margin:0;">${isIncome ? 'Income Sources Ranking' : 'Category Spending Ranking'}</h3>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${data.categories.map((c, idx) => `
            <div style="display:flex;flex-direction:column;gap:6px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:18px;">${c.icon}</span>
                  <div>
                    <strong style="font-size:13.5px;color:var(--text);">${c.name}</strong>
                    <span style="font-size:11px;color:var(--text-dim);margin-left:4px;">(${c.count} ${c.count === 1 ? 'entry' : 'entries'})</span>
                  </div>
                </div>
                <div style="text-align:right;">
                  <strong style="font-family:'Space Grotesk',sans-serif;font-size:14px;color:var(--text);">₹${c.total.toLocaleString('en-IN')}</strong>
                  <span style="font-size:11px;font-weight:800;color:${c.color};margin-left:6px;">${c.pct}%</span>
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
  }

  container.innerHTML = `
    ${headerHtml}
    ${topHighlightHtml}
    ${chartCardHtml}
    ${comparisonCardHtml}
    ${categoryListHtml}
  `;
}
window.renderInsightsTab = renderInsightsTab;
