'use strict';

/**
 * PocketTrack 1-Tap UPI QR Code & Instant Settlement Generator
 * Renders universal scannable UPI QR codes compatible with GPay, PhonePe, Paytm, CRED, BHIM.
 */

(function() {
  const s = document.createElement('style');
  s.textContent = `
    .upi-qr-card {
      background: #ffffff;
      color: #0f172a;
      border-radius: 24px;
      padding: 24px 20px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
      max-width: 320px;
      margin: 0 auto;
    }
    .upi-qr-img-wrap {
      width: 200px;
      height: 200px;
      margin: 14px auto;
      border-radius: 16px;
      padding: 10px;
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .upi-qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 10px;
    }
    .upi-apps-row {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 14px;
      font-size: 11.5px;
      color: #64748b;
      font-weight: 600;
    }
  `;
  document.head.appendChild(s);
})();

window.getUserUpiId = function() {
  return localStorage.getItem('pockettrack_user_upi_id') || '';
};

window.setUserUpiId = function(upiId) {
  if (upiId) {
    localStorage.setItem('pockettrack_user_upi_id', upiId.trim());
  }
};

window.openUpiQrModal = function(amount = 0, note = 'PocketTrack') {
  let currentUpi = window.getUserUpiId();

  if (!currentUpi) {
    const promptUpi = prompt('Enter your UPI ID to generate payment QR (e.g. yourname@okaxis, 9876543210@paytm):');
    if (promptUpi && promptUpi.trim()) {
      currentUpi = promptUpi.trim();
      window.setUserUpiId(currentUpi);
    } else {
      return;
    }
  }

  const amtStr = amount > 0 ? `&am=${amount}` : '';
  const upiPayload = `upi://pay?pa=${encodeURIComponent(currentUpi)}&pn=PocketTrack${amtStr}&tn=${encodeURIComponent(note)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiPayload)}&margin=10`;

  const html = `
    <div class="upi-qr-card">
      <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#8b5cf6;text-transform:uppercase;">PocketTrack UPI QR</div>
      <h3 style="margin:4px 0 2px;font-size:18px;color:#0f172a;font-family:'Space Grotesk',sans-serif;">Scan to Pay via UPI</h3>
      <p style="margin:0;font-size:12px;color:#64748b;">${escapeHTML(currentUpi)}</p>
      
      ${amount > 0 ? `<div style="font-size:26px;font-weight:800;color:#0f172a;margin:8px 0 -4px;font-family:'Space Grotesk',sans-serif;">₹${amount.toLocaleString('en-IN')}</div>` : ''}

      <div class="upi-qr-img-wrap">
        <img class="upi-qr-img" src="${qrUrl}" alt="UPI QR Code" onerror="this.src='icon-192.png'"/>
      </div>

      <div class="upi-apps-row">
        <span>GPay</span> · <span>PhonePe</span> · <span>Paytm</span> · <span>CRED</span> · <span>BHIM</span>
      </div>

      <div style="display:flex;gap:8px;margin-top:18px;">
        <button class="btn" style="flex:1;background:#f1f5f9;color:#334155;border:none;border-radius:12px;font-size:12px;" onclick="changeUpiIdPrompt()">Edit UPI ID</button>
        <button class="btn primary" style="flex:1;border-radius:12px;font-size:12px;" onclick="closeAppModal()">Done</button>
      </div>
    </div>
  `;

  const msgEl = document.getElementById('app-modal-message');
  if (msgEl) {
    document.getElementById('app-modal-title').textContent = 'Instant UPI Settlement';
    msgEl.innerHTML = html;
    document.getElementById('app-modal-buttons').innerHTML = '';
    document.getElementById('app-modal-backdrop').style.display = 'flex';
  }
};

window.changeUpiIdPrompt = function() {
  const current = window.getUserUpiId();
  const next = prompt('Enter your UPI ID:', current);
  if (next && next.trim()) {
    window.setUserUpiId(next.trim());
    window.openUpiQrModal();
    if (typeof toast === 'function') toast('Updated UPI ID to ' + next.trim(), 'success');
  }
};
