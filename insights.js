// =====================================================================
// POCKETTRACK PURE — INSIGHTS & ANALYTICS CONTROLLER
// =====================================================================

const INSIGHT_CATEGORY_COLORS = {
  food: '#ef4444',
  groceries: '#f97316',
  travel: '#f59e0b',
  fuel: '#eab308',
  shopping: '#8b5cf6',
  bills: '#3b82f6',
  entertainment: '#ec4899',
  health: '#10b981',
  education: '#06b6d4',
  rent: '#6366f1',
  salary: '#10b981',
  freelance: '#34d399',
  investment: '#a855f7',
  other: '#64748b'
};

let currentInsightsMonth = (function() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

function getInsightsData(monthStr) {
  const all = window.entries || [];
  const targetMonth = monthStr || currentInsightsMonth;
  const monthEntries = all.filter(e => e.date && e.date.startsWith(targetMonth));

  let totalIncome = 0;
  let totalExpense = 0;
  const catMap = {};

  monthEntries.forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') {
      totalIncome += amt;
    } else if (e.type === 'expense') {
      totalExpense += amt;
      const cat = e.cat || 'other';
      if (!catMap[cat]) {
        catMap[cat] = {
          id: cat,
          name: cat.charAt(0).toUpperCase() + cat.slice(1),
          icon: typeof getCategoryIcon === 'function' ? getCategoryIcon(cat, 'expense') : '🏷️',
          color: INSIGHT_CATEGORY_COLORS[cat] || '#8b5cf6',
          total: 0,
          count: 0
        };
      }
      catMap[cat].total += amt;
      catMap[cat].count += 1;
    }
  });

  const categories = Object.values(catMap).sort((a, b) => b.total - a.total);
  categories.forEach(c => {
    c.pct = totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0;
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
    entriesCount: monthEntries.length,
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

function jumpToCurrentInsightsMonth() {
  const now = new Date();
  currentInsightsMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  renderInsightsTab();
}
window.jumpToCurrentInsightsMonth = jumpToCurrentInsightsMonth;

function generateDonutChartSVG(categories, totalExpense) {
  if (!categories || !categories.length || totalExpense <= 0) {
    return `
      <svg viewBox="0 0 160 160" class="donut-chart-svg" style="width:160px;height:160px;">
        <circle cx="80" cy="80" r="58" fill="none" stroke="var(--border)" stroke-width="18" />
        <text x="80" y="85" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="12" font-weight="700" fill="var(--text-dim)">No Expenses</text>
      </svg>
    `;
  }

  const radius = 58;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;
  let svgPaths = '';

  categories.forEach(cat => {
    const fraction = cat.total / totalExpense;
    const dashLength = fraction * circumference;
    const offset = -(accumulatedPercent * circumference);
    const color = cat.color || '#8b5cf6';

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

  return `
    <svg viewBox="0 0 160 160" class="donut-chart-svg" style="width:160px;height:160px;">
      <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="${strokeWidth}" />
      ${svgPaths}
      <g transform="translate(80, 76)">
        <text text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="16" font-weight="800" fill="var(--text)">₹${totalExpense.toLocaleString('en-IN')}</text>
        <text y="16" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="0.5" fill="var(--text-dim)">TOTAL SPENT</text>
      </g>
    </svg>
  `;
}

function renderInsightsTab() {
  const container = document.getElementById('tab-insights');
  if (!container) return;

  const data = getInsightsData(currentInsightsMonth);
  const monthLabel = formatMonthLabel(data.monthStr);

  const monthSelectorHtml = `
    <div class="insights-month-bar">
      <button class="icon-btn" onclick="prevInsightsMonth()" title="Previous Month"><i class="ti ti-chevron-left"></i></button>
      <div style="text-align:center;cursor:pointer;" onclick="jumpToCurrentInsightsMonth()" title="Click to jump to current month">
        <h3 style="font-size:16.5px;font-weight:800;margin:0;letter-spacing:-0.3px;">${monthLabel}</h3>
        <span style="font-size:10.5px;color:var(--accent);font-weight:700;">${data.entriesCount} transactions</span>
      </div>
      <button class="icon-btn" onclick="nextInsightsMonth()" title="Next Month"><i class="ti ti-chevron-right"></i></button>
    </div>
  `;

  // Top Category Highlight Callout
  let topHighlightHtml = '';
  if (data.topCategory && data.totalExpense > 0) {
    topHighlightHtml = `
      <div class="insight-callout-card" style="margin-bottom:14px;">
        <div style="font-size:24px;">${data.topCategory.icon}</div>
        <div>
          <span style="font-size:10.5px;font-weight:800;color:var(--accent);letter-spacing:0.8px;text-transform:uppercase;">TOP SPENDING CATEGORY</span>
          <p style="font-size:13.5px;font-weight:700;color:var(--text);margin:2px 0 0;">
            <strong>${data.topCategory.name}</strong> accounts for <strong>${data.topCategory.pct}%</strong> of your spending (₹${data.topCategory.total.toLocaleString('en-IN')})
          </p>
        </div>
      </div>
    `;
  }

  // Visual Donut Chart Card
  const donutChartSvg = generateDonutChartSVG(data.categories, data.totalExpense);
  const chartCardHtml = `
    <div class="card" style="padding:18px;border-radius:24px;margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">🥧</span>
          <h3 style="font-size:16px;font-weight:700;margin:0;">Expense Breakdown</h3>
        </div>
        <span style="font-size:11.5px;color:var(--text-dim);font-weight:700;">Daily Avg: ₹${data.dailyAverage.toLocaleString('en-IN')}/d</span>
      </div>

      <div style="display:flex;align-items:center;justify-content:center;padding:10px 0 16px;">
        ${donutChartSvg}
      </div>

      <!-- Quick Legend Chips -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
        ${data.categories.slice(0, 5).map(c => `
          <div style="display:flex;align-items:center;gap:5px;padding:3px 8px;border-radius:10px;background:var(--bg1);border:1px solid var(--border);font-size:11px;font-weight:700;">
            <span style="width:8px;height:8px;border-radius:50%;background:${c.color};"></span>
            <span>${c.name}</span>
            <span style="color:var(--text-dim);">${c.pct}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Income vs Expense Comparison Card
  const incWidth = data.totalIncome + data.totalExpense > 0 
    ? Math.round((data.totalIncome / (data.totalIncome + data.totalExpense)) * 100) 
    : 50;
  const expWidth = 100 - incWidth;

  const comparisonCardHtml = `
    <div class="card" style="padding:18px;border-radius:24px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">⚖️</span>
          <h3 style="font-size:16px;font-weight:700;margin:0;">Cash Flow</h3>
        </div>
        <span style="font-size:11px;font-weight:800;color:${data.netSavings >= 0 ? 'var(--green)' : 'var(--red)'};padding:2px 8px;border-radius:8px;background:${data.netSavings >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};">
          ${data.netSavings >= 0 ? `Saved ${data.savingsRate}% (+₹${data.netSavings.toLocaleString('en-IN')})` : `Deficit (-₹${Math.abs(data.netSavings).toLocaleString('en-IN')})`}
        </span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div style="padding:10px 12px;border-radius:14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);">
          <span style="font-size:10.5px;font-weight:800;color:var(--green);text-transform:uppercase;">INCOME</span>
          <strong style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:800;color:var(--green);display:block;margin-top:2px;">₹${data.totalIncome.toLocaleString('en-IN')}</strong>
        </div>
        <div style="padding:10px 12px;border-radius:14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);">
          <span style="font-size:10.5px;font-weight:800;color:var(--red);text-transform:uppercase;">SPENT</span>
          <strong style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:800;color:var(--red);display:block;margin-top:2px;">₹${data.totalExpense.toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div style="height:8px;border-radius:6px;background:rgba(0,0,0,0.06);display:flex;overflow:hidden;">
        <div style="width:${incWidth}%;background:var(--green);" title="Income: ${incWidth}%"></div>
        <div style="width:${expWidth}%;background:var(--red);" title="Expense: ${expWidth}%"></div>
      </div>
    </div>
  `;

  // Category Ranking Breakdown List
  let categoryListHtml = '';
  if (!data.categories.length) {
    categoryListHtml = `<div class="card" style="padding:28px 0;text-align:center;color:var(--text-dim);font-size:13px;border-radius:24px;">No expense records found for this month.</div>`;
  } else {
    categoryListHtml = `
      <div class="card" style="padding:18px;border-radius:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span style="font-size:20px;">🏆</span>
          <h3 style="font-size:16px;font-weight:700;margin:0;">Category Ranking</h3>
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
    <div style="margin-bottom:16px;">
      <p class="eyebrow" style="letter-spacing:1.5px;font-size:9.5px;font-weight:800;color:var(--accent);margin:0 0 4px;">WHERE MONEY GOES</p>
      <h2 style="font-size:22px;font-weight:800;margin:0;">Insights & Visuals</h2>
    </div>
    ${monthSelectorHtml}
    ${topHighlightHtml}
    ${chartCardHtml}
    ${comparisonCardHtml}
    ${categoryListHtml}
  `;
}
window.renderInsightsTab = renderInsightsTab;
