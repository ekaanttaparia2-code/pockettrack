Object.assign(TRANSLATIONS, {
  nav_aicoach: { en: 'AI Coach & Health', hi: 'एआई कोच और हेल्थ' },
  aicoach_title: { en: 'Financial Health & AI Coach', hi: 'फाइनेंशियल हेल्थ और एआई कोच' },
  aicoach_score_title: { en: 'Financial Health Score', hi: 'फाइनेंशियल हेल्थ स्कोर' },
  aicoach_leak_title: { en: 'Subscription Leak Detector', hi: 'सब्सक्रिप्शन लीक डिटैक्टर' },
  aicoach_chat_title: { en: 'Chat with Financial Twin', hi: 'फाइनेंशियल ट्विन से बात करें' },
  btn_ask_ai: { en: 'Ask AI Coach', hi: 'एआई कोच से पूछें' }
});

let userMarkedLeaks = JSON.parse(localStorage.getItem('pockettrack_marked_leaks') || '{}');

function calculateHealthScore() {
  if (!entries || entries.length === 0) {
    return {
      score: 70,
      status: 'Needs Data',
      color: '#ffb84d',
      savingsRatio: 0,
      savingsPts: 20,
      budgetPts: 25,
      streakPts: 25,
      insights: ['Log your daily income and expenses to unlock full financial health insights.']
    };
  }

  let totalInc = 0;
  let totalExp = 0;
  const catTotals = {};

  entries.forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') totalInc += amt;
    else if (e.type === 'expense') {
      totalExp += amt;
      const cat = e.cat || 'other';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    }
  });

  let savingsRatio = totalInc > 0 ? (totalInc - totalExp) / totalInc : 0;
  let savingsPts = Math.min(40, Math.max(0, Math.round(savingsRatio * 80)));

  let budgetPts = 30;
  if (typeof weeklyBudget !== 'undefined' && weeklyBudget > 0) {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0,0,0,0);
    
    let thisWeekExp = 0;
    entries.forEach(e => {
      if (e.type === 'expense' && new Date(e.date) >= startOfWeek) {
        thisWeekExp += (parseFloat(e.amt) || 0);
      }
    });
    if (thisWeekExp > weeklyBudget) {
      const overPct = (thisWeekExp - weeklyBudget) / weeklyBudget;
      budgetPts = Math.max(5, Math.round(30 - (overPct * 30)));
    }
  }

  const streak = (typeof currentStreak !== 'undefined' ? currentStreak : 1);
  let streakPts = Math.min(30, Math.round(streak * 5 + 10));

  const finalScore = Math.min(100, Math.max(0, savingsPts + budgetPts + streakPts));

  let status = 'Good';
  let color = '#4ade80';
  if (finalScore >= 85) { status = 'Excellent 🚀'; color = '#4ade80'; }
  else if (finalScore >= 70) { status = 'Good 👍'; color = '#60a5fa'; }
  else if (finalScore >= 50) { status = 'Fair ⚠️'; color = '#ffb84d'; }
  else { status = 'Needs Attention 🔴'; color = '#f87171'; }

  const insights = [];
  let topCat = 'other';
  let topAmt = 0;
  Object.keys(catTotals).forEach(c => {
    if (catTotals[c] > topAmt) {
      topAmt = catTotals[c];
      topCat = c;
    }
  });

  if (totalExp > 0 && topAmt > 0) {
    const topPct = Math.round((topAmt / totalExp) * 100);
    insights.push(`📊 Highest spending category: <b>${escapeHTML(topCat)}</b> (₹${topAmt.toLocaleString('en-IN')}, ${topPct}% of total expenses).`);
  }

  if (savingsRatio >= 0.2) {
    insights.push(`💡 You save <b>${Math.round(savingsRatio * 100)}%</b> of your income (above the 20% benchmark).`);
  } else if (savingsRatio > 0) {
    insights.push(`💡 You save <b>${Math.round(savingsRatio * 100)}%</b> of income. Target 20% for optimal score.`);
  } else {
    insights.push(`⚠️ Total expenses currently exceed or equal income. Consider reviewing non-essential purchases.`);
  }

  if (streak >= 3) {
    insights.push(`🔥 ${streak}-day active logging streak!`);
  }

  return {
    score: finalScore,
    status,
    color,
    savingsRatio: Math.round(savingsRatio * 100),
    savingsPts,
    budgetPts,
    streakPts,
    insights
  };
}

function detectSubscriptionLeaks() {
  if (!entries || entries.length === 0) return [];

  const subKeywords = /netflix|spotify|prime|hotstar|youtube|apple|icloud|gym|recharge|wifi|broadband|rent|newspaper|tuition|sip|insurance/i;
  const leaksMap = {};

  entries.forEach(e => {
    if (e.type === 'expense') {
      const text = (e.label || '') + ' ' + (e.cat || '') + ' ' + (e.note || '');
      if (subKeywords.test(text)) {
        const key = (e.label || e.cat || 'Recurring').toLowerCase();
        if (!leaksMap[key]) {
          leaksMap[key] = {
            key: key,
            name: e.label || e.cat,
            amount: parseFloat(e.amt) || 0,
            count: 1,
            isUnused: userMarkedLeaks[key] === true
          };
        } else {
          leaksMap[key].count++;
          leaksMap[key].amount = Math.max(leaksMap[key].amount, parseFloat(e.amt) || 0);
        }
      }
    }
  });

  return Object.values(leaksMap);
}

function toggleLeakUnused(key) {
  userMarkedLeaks[key] = !userMarkedLeaks[key];
  localStorage.setItem('pockettrack_marked_leaks', JSON.stringify(userMarkedLeaks));
  renderAICoachTab();
  const sheetContent = document.getElementById('aicoach-sheet-content');
  if (sheetContent) sheetContent.innerHTML = getAICoachFullHTML();
  toast(userMarkedLeaks[key] ? 'Marked as Unused Leak ⚠️' : 'Marked as Active Subscription', 'info');
}

function getAICoachFullHTML() {
  const health = calculateHealthScore();
  const leaks = detectSubscriptionLeaks();

  let leaksTotalMo = 0;
  let unusedTotalMo = 0;

  leaks.forEach(l => {
    leaksTotalMo += l.amount;
    if (l.isUnused) unusedTotalMo += l.amount;
  });

  let leaksHtml = '';
  if (leaks.length === 0) {
    leaksHtml = `<p style="color:var(--text-dim); font-size:13px; margin:0; text-align:center; padding:10px 0;">No recurring subscription leaks detected yet. Log payments like Netflix, Gym, or Cloud storage to track leaks!</p>`;
  } else {
    leaks.forEach(l => {
      const badgeStyle = l.isUnused 
        ? 'background:rgba(248,113,113,0.18); color:var(--red,#f87171); border:1px solid rgba(248,113,113,0.35);' 
        : 'background:rgba(52,211,153,0.18); color:var(--green,#34d399); border:1px solid rgba(52,211,153,0.35);';
      const badgeText = l.isUnused ? '⚠️ Unused Leak' : '● Active';

      leaksHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:14px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.08)">
          <div>
            <div style="font-weight:700; font-size:14.5px; color:#fff;">${escapeHTML(l.name)}</div>
            <div style="display:flex; gap:6px; align-items:center; margin-top:4px;">
              <span style="font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700; ${badgeStyle}">${badgeText}</span>
              <button class="btn" style="padding:2px 10px; font-size:11px; border-radius:8px; background:rgba(255,255,255,0.08);" onclick="toggleLeakUnused('${l.key}')">Toggle Status</button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800; font-size:15px; color:var(--red,#f87171)">₹${l.amount.toLocaleString('en-IN')}<span style="font-size:11px; font-weight:400; color:var(--text-dim);">/mo</span></div>
            <div style="font-size:11px; color:var(--text-dim)">₹${(l.amount * 12).toLocaleString('en-IN')}/yr</div>
          </div>
        </div>
      `;
    });
  }

  let insightsListHtml = health.insights.map(item => `
    <div style="background:rgba(255,255,255,0.04); padding:11px 14px; border-radius:12px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.08); font-size:13.5px; line-height:1.45; color:#f1f5f9;">
      ${item}
    </div>
  `).join('');

  return `
    <div class="card" style="background:linear-gradient(145deg, rgba(139, 92, 246, 0.22), rgba(236, 72, 153, 0.15)); text-align:center; padding:24px 20px; margin-bottom:18px; border:1px solid rgba(139,92,246,0.35); border-radius:24px;">
      <h3 style="margin:0 0 16px; font-family:'Space Grotesk',sans-serif; font-size:19px; font-weight:700; color:#fff;">Financial Health Score</h3>
      <div style="position:relative; width:130px; height:130px; margin:0 auto 14px; border-radius:50%; border:6px solid ${health.color}; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 0 35px ${health.color}55; background:rgba(0,0,0,0.3);">
        <div style="font-size:40px; font-weight:800; color:#fff; line-height:1; font-family:'Space Grotesk',sans-serif;">${health.score}</div>
        <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">out of 100</div>
      </div>
      <div style="font-size:15px; font-weight:700; color:${health.color};">${health.status}</div>
    </div>

    <div class="card" style="margin-bottom:18px; border-radius:20px;">
      <h4 style="margin:0 0 14px; font-size:15.5px; font-weight:700;" class="sec-title"><i class="ti ti-calculator"></i> Score Breakdown</h4>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:5px;">
            <span>💰 Savings Rate Benchmark</span>
            <span style="color:var(--accent,#8b5cf6); font-weight:700;">${health.savingsPts} / 40 pts</span>
          </div>
          <div style="background:rgba(255,255,255,0.08); height:7px; border-radius:4px; overflow:hidden;">
            <div style="width:${(health.savingsPts/40)*100}%; height:100%; background:linear-gradient(90deg, #8b5cf6, #a78bfa); border-radius:4px;"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:5px;">
            <span>🎯 Budget Discipline</span>
            <span style="color:var(--green,#34d399); font-weight:700;">${health.budgetPts} / 30 pts</span>
          </div>
          <div style="background:rgba(255,255,255,0.08); height:7px; border-radius:4px; overflow:hidden;">
            <div style="width:${(health.budgetPts/30)*100}%; height:100%; background:linear-gradient(90deg, #10b981, #34d399); border-radius:4px;"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:5px;">
            <span>🔥 Daily Logging Consistency</span>
            <span style="color:#fbbf24; font-weight:700;">${health.streakPts} / 30 pts</span>
          </div>
          <div style="background:rgba(255,255,255,0.08); height:7px; border-radius:4px; overflow:hidden;">
            <div style="width:${(health.streakPts/30)*100}%; height:100%; background:linear-gradient(90deg, #f59e0b, #fbbf24); border-radius:4px;"></div>
          </div>
        </div>
      </div>
    </div>

    ${(function(){
      if(typeof computeFinancialDNA !== 'function') return '';
      const dna = computeFinancialDNA();
      return `
      <div class="card" style="margin-bottom:18px; border-radius:20px; background:linear-gradient(135deg, rgba(20,20,32,0.7), rgba(35,25,55,0.6)); border: 1px solid ${dna.color}44;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="margin:0; font-size:15.5px; font-weight:700;" class="sec-title">🧬 Your Financial DNA</h4>
          <span style="font-size:11px; padding:3px 10px; border-radius:12px; background:${dna.color}22; color:${dna.color}; font-weight:700; border:1px solid ${dna.color}44;">${dna.emoji} ${dna.title}</span>
        </div>
        <p style="font-size:13.5px; font-style:italic; color:rgba(255,255,255,0.88); margin:0 0 14px 0; line-height:1.45;">"${dna.tagline}"</p>
        <button class="btn" style="width:100%; border-radius:12px; font-size:13px; font-weight:600; background:linear-gradient(135deg, #8b5cf6, #f43f5e); color:#fff; border:none; padding:10px; cursor:pointer;" onclick="closeAICoachModal(); if(typeof openMoneyWrapped==='function') openMoneyWrapped(0);">✨ Open Monthly Money Wrapped →</button>
      </div>`;
    })()}

    <div class="card" style="margin-bottom:18px; border-radius:20px;">
      <h4 style="margin:0 0 12px; font-size:15.5px; font-weight:700;" class="sec-title"><i class="ti ti-bulb"></i> Personal Financial Insights</h4>
      ${insightsListHtml}
    </div>

    <div class="card" style="margin-bottom:18px; border-radius:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h4 style="margin:0; font-size:15.5px; font-weight:700;" class="sec-title"><i class="ti ti-alarm"></i> Subscription Leak Radar</h4>
        <div style="text-align:right">
          <div style="font-size:13.5px; font-weight:800; color:var(--red,#f87171);">Total: ₹${leaksTotalMo.toLocaleString('en-IN')}/mo</div>
          ${unusedTotalMo > 0 ? `<div style="font-size:11.5px; color:#f87171; font-weight:700;">Save ₹${(unusedTotalMo * 12).toLocaleString('en-IN')}/yr if cancelled</div>` : ''}
        </div>
      </div>
      ${leaksHtml}
    </div>

    <div class="card" style="margin-bottom:18px; border-radius:20px;">
      <h4 style="margin:0 0 12px; font-size:15.5px; font-weight:700;" class="sec-title"><i class="ti ti-messages"></i> Chat with Financial Twin</h4>

      <div id="ai-chat-box" style="max-height:280px; overflow-y:auto; background:rgba(0,0,0,0.3); border-radius:16px; padding:14px; margin-bottom:14px; border:1px solid rgba(255,255,255,0.08); -webkit-overflow-scrolling:touch;">
        <div class="aicoach-chat-msg-bot">
          🤖 <b>PocketCoach AI:</b> Hi! I analyze your live transactions, balance, and debt ledger. Ask me any question about your spending, budget, or future savings!
        </div>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="tag-btn" onclick="sendQuickPrompt('What is my total spending this month and top category?')">📊 Monthly breakdown</button>
        <button class="tag-btn" onclick="sendQuickPrompt('How do I set my weekly budget limit?')">⚙️ Budget guide</button>
        <button class="tag-btn" onclick="sendQuickPrompt('How does the Ledger debt manager work?')">📑 Ledger debt guide</button>
        <button class="tag-btn" onclick="sendQuickPrompt('How to save ₹10,000 in 3 months?')">💰 Save ₹10,000</button>
      </div>

      <div style="display:flex; gap:8px;">
        <input type="text" id="ai-user-input" placeholder="Ask AI coach in your own words..." style="flex:1; border-radius:14px; padding:12px 14px;" onkeypress="if(event.key==='Enter')askAICoach()"/>
        <button class="btn primary" style="border-radius:14px; padding:12px 18px;" onclick="askAICoach()"><i class="ti ti-send"></i></button>
      </div>
    </div>
  `;
}

function openAICoachModal() {
  const modal = document.getElementById('aicoach-modal-backdrop');
  const content = document.getElementById('aicoach-sheet-content');
  if (content) {
    content.innerHTML = getAICoachFullHTML();
  }
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}
window.openAICoachModal = openAICoachModal;

function closeAICoachModal() {
  const modal = document.getElementById('aicoach-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}
window.closeAICoachModal = closeAICoachModal;

function renderAICoachTab() {
  const container = document.getElementById('tab-aicoach-content');
  if (container) {
    container.innerHTML = getAICoachFullHTML();
  }
}
window.renderAICoachTab = renderAICoachTab;

function initFloatingAIWidget() {
  if (document.getElementById('ai-widget-icon')) return;

  const widget = document.createElement('div');
  widget.id = 'ai-widget-icon';
  widget.title = 'AI Financial Twin & App Assistant';
  widget.style.cssText = 'position:fixed;bottom:90px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 8px 25px rgba(139,92,246,0.6);z-index:9999;cursor:grab;touch-action:none;user-select:none;transition:transform 0.2s;';
  widget.innerHTML = '🤖';

  const panel = document.createElement('div');
  panel.id = 'ai-widget-panel';
  panel.style.cssText = 'position:fixed;bottom:155px;right:24px;width:340px;max-width:90vw;background:var(--card-solid,#1f1840);border:1px solid rgba(255,255,255,0.18);box-shadow:0 20px 50px rgba(0,0,0,0.7);border-radius:20px;padding:16px;z-index:9999;display:none;flex-direction:column;max-height:75vh;';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px;">
      <div style="font-weight:700;font-size:15px;display:flex;align-items:center;gap:6px;">🤖 <span>AI Twin & App Guide</span></div>
      <button class="icon-btn" onclick="toggleAIPanel()" style="font-size:18px;color:var(--text-dim);"><i class="ti ti-x"></i></button>
    </div>
    
    <div id="ai-panel-chat-box" style="flex:1;max-height:220px;overflow-y:auto;background:rgba(0,0,0,0.25);border-radius:12px;padding:10px;margin-bottom:10px;border:1px solid var(--border);font-size:12.5px;">
      <div style="background:rgba(139,92,246,0.15);padding:8px 10px;border-radius:10px;line-height:1.4;">
        👋 Ask me anything about your money or how to use any feature in PocketTrack!
      </div>
    </div>

    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">
      <button class="tag-btn" style="font-size:10.5px;padding:3px 8px;" onclick="sendPanelPrompt('How to save for iPhone in 2 months?')">📱 iPhone in 2 months</button>
      <button class="tag-btn" style="font-size:10.5px;padding:3px 8px;" onclick="sendPanelPrompt('How to set weekly budget?')">⚙️ Budget Guide</button>
      <button class="tag-btn" style="font-size:10.5px;padding:3px 8px;" onclick="sendPanelPrompt('How to track debts in Ledger?')">📑 Ledger Guide</button>
    </div>

    <div style="display:flex;gap:6px;">
      <input type="text" id="ai-panel-input" placeholder="Ask AI or App Guide..." style="flex:1;padding:8px 10px;font-size:12.5px;" onkeypress="if(event.key==='Enter')askAIPanel()"/>
      <button class="btn primary" style="padding:8px 12px;font-size:12px;" onclick="askAIPanel()"><i class="ti ti-send"></i></button>
    </div>
  `;

  document.body.appendChild(widget);
  document.body.appendChild(panel);

  let isDragging = false;
  let hasMoved = false;
  let startX, startY, initialLeft, initialTop;

  widget.addEventListener('pointerdown', e => {
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = widget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    widget.style.cursor = 'grabbing';
    widget.setPointerCapture(e.pointerId);
  });

  widget.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
    
    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;
    
    newLeft = Math.max(10, Math.min(window.innerWidth - 70, newLeft));
    newTop = Math.max(10, Math.min(window.innerHeight - 70, newTop));

    widget.style.left = newLeft + 'px';
    widget.style.top = newTop + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';

    panel.style.left = Math.min(window.innerWidth - 350, Math.max(10, newLeft - 140)) + 'px';
    panel.style.top = Math.max(10, newTop - 360) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  widget.addEventListener('pointerup', e => {
    isDragging = false;
    widget.style.cursor = 'grab';
    if (!hasMoved) {
      toggleAIPanel();
    }
  });

  updateAIWidgetVisibility();
}

function updateAIWidgetVisibility() {
  const widget = document.getElementById('ai-widget-icon');
  const panel = document.getElementById('ai-widget-panel');
  const auth = document.getElementById('auth-screen');
  const onAuthScreen = auth && auth.style.display !== 'none';
  const shouldHide = onAuthScreen || (typeof currentUser !== 'undefined' && !currentUser);

  if (widget) {
    widget.style.display = shouldHide ? 'none' : 'flex';
  }
  if (panel && shouldHide) {
    panel.style.display = 'none';
  }
}

function toggleAIPanel() {
  const panel = document.getElementById('ai-widget-panel');
  if (panel) {
    panel.style.display = (panel.style.display === 'flex') ? 'none' : 'flex';
  }
}

function sendQuickPrompt(text) {
  const input = document.getElementById('ai-user-input');
  if (input) {
    input.value = text;
    askAICoach();
  }
}

function sendPanelPrompt(text) {
  const input = document.getElementById('ai-panel-input');
  if (input) {
    input.value = text;
    askAIPanel();
  }
}

async function askAICoach() {
  const inputEl = document.getElementById('ai-user-input');
  const chatBox = document.getElementById('ai-chat-box');
  if (!inputEl || !chatBox) return;

  const query = inputEl.value.trim();
  if (!query) return;

  chatBox.innerHTML += `
    <div style="background:rgba(255,255,255,0.08); text-align:right; padding:8px 12px; border-radius:12px; font-size:13px; margin-bottom:10px; margin-left:20px;">
      <b>You:</b> ${escapeHTML(query)}
    </div>
  `;
  inputEl.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  const loadingId = 'ai-loading-' + Date.now();
  chatBox.innerHTML += `
    <div id="${loadingId}" style="background:rgba(139,92,246,0.15); padding:10px 14px; border-radius:12px; border:1px solid rgba(139,92,246,0.3); font-size:13px; margin-bottom:10px;">
      🤖 <i>AI Financial Twin is analyzing...</i>
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  const responseText = await processSmartAIQuery(query);
  const loadEl = document.getElementById(loadingId);
  if (loadEl) {
    loadEl.innerHTML = `🤖 <b>AI Financial Twin:</b> ${escapeHTML(responseText)}`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function askAIPanel() {
  const inputEl = document.getElementById('ai-panel-input');
  const chatBox = document.getElementById('ai-panel-chat-box');
  if (!inputEl || !chatBox) return;

  const query = inputEl.value.trim();
  if (!query) return;

  chatBox.innerHTML += `
    <div style="background:rgba(255,255,255,0.08); text-align:right; padding:6px 10px; border-radius:10px; font-size:12px; margin-bottom:8px; margin-left:15px;">
      <b>You:</b> ${escapeHTML(query)}
    </div>
  `;
  inputEl.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  const loadingId = 'ai-panel-loading-' + Date.now();
  chatBox.innerHTML += `
    <div id="${loadingId}" style="background:rgba(139,92,246,0.15); padding:8px 10px; border-radius:10px; font-size:12px; margin-bottom:8px;">
      🤖 <i>AI Assistant is analyzing...</i>
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  const responseText = await processSmartAIQuery(query);
  const loadEl = document.getElementById(loadingId);
  if (loadEl) {
    loadEl.innerHTML = `🤖 <b>AI Assistant:</b> ${escapeHTML(responseText)}`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function processSmartAIQuery(query) {
  const q = query.toLowerCase();

  // Try Semantic Pattern Matching with dynamic timeframe and amount parsing
  const semanticAnswer = matchSemanticConcepts(q);
  if (semanticAnswer) return semanticAnswer;

  // Fallback to Live Public LLM Gateway
  try {
    const health = calculateHealthScore();
    const promptText = `You are an expert AI financial twin for PocketTrack app.
User asked: "${query}".
User Financial Status: Health score ${health.score}/100, Savings Ratio: ${health.savingsRatio}%, Total Entries: ${(entries||[]).length}.
Answer concisely (2-3 sentences max) with practical numbers, clear calculations, and actionable advice.`;

    const res = await fetch('https://api.pollinations.ai/p/' + encodeURIComponent(promptText));
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 5) {
        return text.trim();
      }
    }
  } catch (e) {}

  const health = calculateHealthScore();
  return `🤖 Based on your financial score of ${health.score}/100 (${health.status}): Maintain your daily logging streak and keep weekly spend under budget to boost your savings rate!`;
}

function matchSemanticConcepts(q) {
  // Extract custom target months (e.g. "2 months", "3 months", "5 months", "1 year", "6 mo")
  let targetMonths = 6;
  const monthMatch = q.match(/(\d+)\s*(?:month|mo|mth)/i);
  if (monthMatch) {
    targetMonths = Math.max(1, parseInt(monthMatch[1]) || 6);
  } else if (q.includes('1 year') || q.includes('one year') || q.includes('12 months')) {
    targetMonths = 12;
  }

  // 1. Dynamic Goals: iPhone / Smartphone
  if (/iphone|apple|mobile|phone|smartphone|buy a phone/i.test(q)) {
    const estCost = 69900;
    const perMonth = Math.round(estCost / targetMonths);
    const perDay = Math.round(perMonth / 30);
    return `📱 To buy an iPhone (~₹${estCost.toLocaleString('en-IN')}) in ${targetMonths} month${targetMonths > 1 ? 's' : ''}: You need to set aside ₹${perMonth.toLocaleString('en-IN')}/month (approx ₹${perDay.toLocaleString('en-IN')}/day)!`;
  }

  // 2. Dynamic Goals: Laptop / MacBook / PC
  if (/laptop|macbook|computer|pc|notebook/i.test(q)) {
    const estCost = 85000;
    const perMonth = Math.round(estCost / targetMonths);
    return `💻 To save for a Laptop (~₹${estCost.toLocaleString('en-IN')}) in ${targetMonths} month${targetMonths > 1 ? 's' : ''}: Save ₹${perMonth.toLocaleString('en-IN')}/month!`;
  }

  // 3. Dynamic Goals: Trip / Vacation
  if (/trip|vacation|goa|holiday|travel/i.test(q)) {
    const estCost = 15000;
    const perMonth = Math.round(estCost / targetMonths);
    return `✈️ For a Trip/Vacation (~₹15,000) in ${targetMonths} month${targetMonths > 1 ? 's' : ''}: Save ₹${perMonth.toLocaleString('en-IN')}/month!`;
  }

  // 4. Custom Amount Savings Goal (e.g. "How to save 50000 in 4 months")
  const amtMatch = q.match(/(?:save|target|goal|collect)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*)/i);
  if (amtMatch) {
    const customAmt = parseFloat(amtMatch[1].replace(/,/g, ''));
    if (customAmt > 0) {
      const perMonth = Math.round(customAmt / targetMonths);
      return `🎯 To save ₹${customAmt.toLocaleString('en-IN')} in ${targetMonths} month${targetMonths > 1 ? 's' : ''}: Set aside ₹${perMonth.toLocaleString('en-IN')}/month (approx ₹${Math.round(perMonth/30).toLocaleString('en-IN')}/day)!`;
    }
  }

  // 5. App Usage Guidance
  if (q.includes('what is') || q.includes('about app') || q.includes('features') || q.includes('what can')) {
    return `📱 PocketTrack is your cloud-synced & offline-ready personal finance app! Key features: 1) Log Income/Expenses 2) P2P Ledger Accounts 3) Splitwise Bill Splitting 4) Smart UPI Logger 5) Voice Log FAB 6) AI Health Score (0-100) 7) Subscription Leak Detector 8) Rewards & Streaks 9) Custom Themes!`;
  }
  if (q.includes('budget') && (q.includes('set') || q.includes('how') || q.includes('limit') || q.includes('change'))) {
    return `⚙️ To set a budget: Open the Report tab or main Log screen, tap 'Set weekly budget', enter your amount (e.g. ₹5,000) and tap Save. PocketTrack will alert you if you get close to the cap!`;
  }
  if (q.includes('ledger') || q.includes('debt') || q.includes('borrow') || q.includes('lent') || q.includes('friend') || q.includes('khata')) {
    return `📑 Ledger Accounts: Tap ☰ Menu → Ledger. Add contacts (e.g. Rahul, Priya), then tap their name to record 'Gave ₹' or 'Received ₹' with in-app modals & history cards!`;
  }
  if (q.includes('voice') || q.includes('mic') || q.includes('speak') || q.includes('audio') || q.includes('bolke')) {
    return `🎤 Voice Entry: Tap the floating purple Mic icon on the bottom-right of your screen and speak naturally, e.g. "Spent 250 on lunch" or "Got 5000 salary"!`;
  }
  if (q.includes('event') || q.includes('split') || q.includes('group') || q.includes('flatmate')) {
    return `👥 Events & Bill Splitting: Open ☰ Menu → Events. Create a group (e.g. Goa Trip, Flatmates), add participants, and log shared expenses — PocketTrack calculates 1-tap settlements!`;
  }
  if (q.includes('upi') || q.includes('smart log') || q.includes('notification') || q.includes('paste')) {
    return `⚡ Smart Logger: Copy any GPay, PhonePe, or Paytm payment notification and paste it into ☰ Menu → Smart Logger. Amount, merchant, and type are auto-detected!`;
  }
  if (q.includes('theme') || q.includes('dark') || q.includes('color') || q.includes('pro')) {
    return `🎨 Themes & Settings: Tap ☰ Menu → Pro & Themes to switch between Cyberpunk Neon, Emerald Luxury, Sunset Glow, or Midnight OLED themes!`;
  }
  if (q.includes('offline') || q.includes('sync') || q.includes('cloud') || q.includes('internet')) {
    return `☁️ Cloud Sync & Offline Mode: PocketTrack works 100% offline! Entries saved without internet are stored locally in IndexedDB and auto-sync with Firebase Cloud as soon as you reconnect.`;
  }
  if (q.includes('export') || q.includes('pdf') || q.includes('report') || q.includes('print')) {
    return `📊 Reports & Export: Tap ☰ Menu → Report. You can view breakdown charts, tap 'Export as PDF' to save your statement, or 'Copy Report' to paste your breakdown anywhere!`;
  }
  if (q.includes('streak') || q.includes('reward') || q.includes('badge') || q.includes('point')) {
    return `🔥 Rewards & Streaks: Log at least one entry every day to build your fire streak! Earn points to unlock 7-day, 30-day, 100-day, and 365-day badges in ☰ Menu → Rewards!`;
  }

  return null;
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initFloatingAIWidget, 500);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(initFloatingAIWidget, 500));
}
