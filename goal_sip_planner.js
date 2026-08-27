'use strict';

/**
 * PocketTrack Goal & SIP Wealth Compounding Simulator
 * Helps youth and students visualize how disciplined monthly micro-investments
 * achieve real life goals (Laptop, Vacation, Emergency Fund, First ₹1 Lakh).
 */

(function() {
  const s = document.createElement('style');
  s.textContent = `
    .goal-planner-card {
      background: linear-gradient(145deg, rgba(20, 25, 45, 0.9), rgba(15, 12, 34, 0.95));
      border: 1px solid rgba(52, 211, 153, 0.35);
      border-radius: 22px;
      padding: 18px 16px;
      margin: 0;
      color: #fff;
      box-shadow: 0 10px 30px rgba(52, 211, 153, 0.1);
      position: relative;
    }
    .goal-stat-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 14px 0;
    }
    .goal-stat-box {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 12px;
      text-align: center;
    }
    .goal-slider-group {
      margin-bottom: 14px;
      text-align: left;
    }
    .goal-slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-dim, #94a3b8);
      margin-bottom: 6px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(s);
})();

function getSavedGoal() {
  try {
    const raw = localStorage.getItem('pockettrack_active_goal');
    return raw ? JSON.parse(raw) : { name: 'Emergency Fund', target: 50000, monthly: 2000, rate: 12 };
  } catch (e) {
    return { name: 'Emergency Fund', target: 50000, monthly: 2000, rate: 12 };
  }
}

function saveActiveGoal(goal) {
  try {
    localStorage.setItem('pockettrack_active_goal', JSON.stringify(goal));
  } catch (e) {}
}

window.openGoalPlannerModal = function() {
  const goal = getSavedGoal();

  const html = `
    <div style="text-align:left;">
      <div style="font-size:11px;font-weight:800;color:var(--green,#34d399);text-transform:uppercase;">Wealth Compounding</div>
      <h3 style="margin:2px 0 12px;font-size:18px;color:#fff;font-family:'Space Grotesk',sans-serif;">🎯 Financial Goal & SIP Planner</h3>
      
      <div class="goal-slider-group">
        <div class="goal-slider-label">
          <span>Goal Name</span>
        </div>
        <input type="text" id="goal-input-name" value="${escapeHTML(goal.name)}" placeholder="e.g. New MacBook, Goa Trip, Emergency Fund" style="width:100%;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:14px;box-sizing:border-box;">
      </div>

      <div class="goal-slider-group">
        <div class="goal-slider-label">
          <span>Target Goal Amount</span>
          <strong id="goal-target-display" style="color:var(--green,#34d399);">₹${goal.target.toLocaleString('en-IN')}</strong>
        </div>
        <input type="range" id="goal-target-slider" min="10000" max="500000" step="5000" value="${goal.target}" style="width:100%;" oninput="updateGoalCalculation()"/>
      </div>

      <div class="goal-slider-group">
        <div class="goal-slider-label">
          <span>Monthly Contribution</span>
          <strong id="goal-monthly-display" style="color:#60a5fa;">₹${goal.monthly.toLocaleString('en-IN')}/mo</strong>
        </div>
        <input type="range" id="goal-monthly-slider" min="500" max="25000" step="500" value="${goal.monthly}" style="width:100%;" oninput="updateGoalCalculation()"/>
      </div>

      <div class="goal-stat-row">
        <div class="goal-stat-box">
          <div style="font-size:11px;color:var(--text-dim);">Time to Goal</div>
          <div id="goal-months-val" style="font-size:18px;font-weight:800;color:#fff;margin-top:2px;">--</div>
        </div>
        <div class="goal-stat-box">
          <div style="font-size:11px;color:var(--text-dim);">Wealth Growth (12% CAGR)</div>
          <div id="goal-growth-val" style="font-size:18px;font-weight:800;color:var(--green,#34d399);margin-top:2px;">+₹0</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
        <button class="btn" onclick="closeAppModal()" style="border-radius:12px;">Close</button>
        <button class="btn primary" onclick="submitSaveGoal()" style="border-radius:12px;background:linear-gradient(135deg,#10b981,#06b6d4);">Save to Dashboard →</button>
      </div>
    </div>
  `;

  const msgEl = document.getElementById('app-modal-message');
  if (msgEl) {
    document.getElementById('app-modal-title').textContent = 'Goal & SIP Planner';
    msgEl.innerHTML = html;
    document.getElementById('app-modal-buttons').innerHTML = '';
    document.getElementById('app-modal-backdrop').style.display = 'flex';
    updateGoalCalculation();
  }
};

window.updateGoalCalculation = function() {
  const target = parseFloat(document.getElementById('goal-target-slider')?.value) || 50000;
  const monthly = parseFloat(document.getElementById('goal-monthly-slider')?.value) || 2000;
  const r = (12 / 12) / 100; // 12% annual rate = 1% monthly

  document.getElementById('goal-target-display').textContent = `₹${target.toLocaleString('en-IN')}`;
  document.getElementById('goal-monthly-display').textContent = `₹${monthly.toLocaleString('en-IN')}/mo`;

  // Compounded SIP months calculation: FV = P * [((1 + r)^n - 1) / r] * (1 + r)
  // n = ln(1 + (FV * r) / (P * (1 + r))) / ln(1 + r)
  const numerator = Math.log(1 + (target * r) / (monthly * (1 + r)));
  const denominator = Math.log(1 + r);
  const months = Math.ceil(numerator / denominator);

  const totalInvested = months * monthly;
  const wealthGained = Math.max(0, target - totalInvested);

  const monthsEl = document.getElementById('goal-months-val');
  const growthEl = document.getElementById('goal-growth-val');

  if (monthsEl) {
    const yrs = Math.floor(months / 12);
    const remM = months % 12;
    monthsEl.textContent = yrs > 0 ? `${yrs}y ${remM}m (${months} mo)` : `${months} months`;
  }
  if (growthEl) {
    growthEl.textContent = `+₹${Math.round(wealthGained).toLocaleString('en-IN')}`;
  }
};

window.submitSaveGoal = function() {
  const name = document.getElementById('goal-input-name')?.value.trim() || 'Savings Goal';
  const target = parseFloat(document.getElementById('goal-target-slider')?.value) || 50000;
  const monthly = parseFloat(document.getElementById('goal-monthly-slider')?.value) || 2000;

  saveActiveGoal({ name, target, monthly, rate: 12 });
  if (typeof closeAppModal === 'function') closeAppModal();
  renderActiveGoalCard();
  if (typeof toast === 'function') toast(`Saved "${name}" goal to Home!`, 'success');
};

window.renderActiveGoalCard = function() {
  const slot = document.getElementById('home-goal-slot');
  if (!slot) return;

  const goal = getSavedGoal();
  const entries = (typeof mainEntries === 'function') ? mainEntries() : [];
  
  // Calculate total saved towards goal based on income minus expenses
  let totalInc = 0, totalExp = 0;
  entries.forEach(e => {
    if (e.type === 'income') totalInc += (parseFloat(e.amt) || 0);
    else if (e.type === 'expense') totalExp += (parseFloat(e.amt) || 0);
  });
  const currentSaved = Math.max(0, totalInc - totalExp);
  const progressPct = Math.min(100, Math.round((currentSaved / goal.target) * 100));

  slot.innerHTML = `
    <div class="goal-planner-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--green,#34d399);text-transform:uppercase;">
          <span>🎯 ${escapeHTML(goal.name)}</span>
        </div>
        <button onclick="openGoalPlannerModal()" style="background:transparent;border:none;color:#94a3b8;font-size:12px;cursor:pointer;font-weight:600;">Edit ⚙️</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
        <div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif;color:#fff;">₹${currentSaved.toLocaleString('en-IN')}<span style="font-size:13px;color:var(--text-dim);font-weight:500;"> / ₹${goal.target.toLocaleString('en-IN')}</span></div>
        <div style="font-size:13px;font-weight:700;color:var(--green,#34d399);">${progressPct}%</div>
      </div>

      <div style="width:100%;height:8px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden;margin-bottom:8px;">
        <div style="width:${progressPct}%;height:100%;background:linear-gradient(90deg,#10b981,#06b6d4);border-radius:4px;transition:width 0.8s;"></div>
      </div>

      <div style="font-size:11.5px;color:var(--text-dim);display:flex;justify-content:space-between;">
        <span>Saving ₹${goal.monthly.toLocaleString('en-IN')}/mo</span>
        <span>Goal Progress</span>
      </div>
    </div>
  `;
};

// Initial Auto-render
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(window.renderActiveGoalCard, 750));
} else {
  setTimeout(window.renderActiveGoalCard, 750);
}
