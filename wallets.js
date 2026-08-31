// =====================================================================
// POCKETTRACK PURE — WALLETS & TRANSFERS CONTROLLER
// =====================================================================

function getWallets() {
  return window.wallets || [
    { id: 'cash', name: 'Cash', icon: '💵', balance: 0 },
    { id: 'bank', name: 'Bank / UPI', icon: '🏦', balance: 0 },
    { id: 'card', name: 'Credit Card', icon: '💳', balance: 0 }
  ];
}
window.getWallets = getWallets;

function saveWallets(wList) {
  window.wallets = wList;
  localStorage.setItem('pocketTrackWallets', JSON.stringify(wList));
  if (typeof syncWalletsToCloud === 'function') syncWalletsToCloud();
  renderSettingsWallets();
}
window.saveWallets = saveWallets;

function renderSettingsWallets() {
  const container = document.getElementById('settings-wallets-list');
  if (!container) return;
  const list = getWallets();
  const allEntries = window.entries || [];

  let html = '';
  list.forEach(w => {
    // calculate balance for this specific wallet
    const inc = allEntries.filter(e => (e.wallet === w.id || (!e.wallet && w.id === 'cash')) && e.type === 'income').reduce((s,e) => s + (parseFloat(e.amt)||0), 0);
    const exp = allEntries.filter(e => (e.wallet === w.id || (!e.wallet && w.id === 'cash')) && e.type === 'expense').reduce((s,e) => s + (parseFloat(e.amt)||0), 0);
    const bal = inc - exp;

    const isSystem = ['cash', 'bank', 'card'].includes(w.id);
    html += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--card);border:1px solid var(--border);border-radius:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">${w.icon || '👛'}</span>
          <div>
            <strong style="font-size:13.5px;color:var(--text);">${w.name}</strong>
            <span style="font-size:11px;color:var(--text-dim);display:block;">₹${bal.toLocaleString('en-IN')}</span>
          </div>
        </div>
        ${!isSystem ? `<button class="icon-btn" onclick="deleteCustomWallet('${w.id}')" style="color:var(--red);font-size:14px;"><i class="ti ti-trash"></i></button>` : ''}
      </div>
    `;
  });
  container.innerHTML = html;
}
window.renderSettingsWallets = renderSettingsWallets;

// ── CUSTOM WALLET MODAL ──
function openNewWalletModal() {
  const m = document.getElementById('wallet-modal');
  if (m) m.style.display = 'flex';
}
window.openNewWalletModal = openNewWalletModal;

function closeNewWalletModal() {
  const m = document.getElementById('wallet-modal');
  if (m) m.style.display = 'none';
}
window.closeNewWalletModal = closeNewWalletModal;

function saveNewWallet() {
  const nameInput = document.getElementById('new-wallet-name');
  const iconInput = document.getElementById('new-wallet-icon');
  if (!nameInput || !nameInput.value.trim()) {
    toast('Please enter a wallet name', 'error');
    return;
  }
  const name = nameInput.value.trim();
  const icon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : '💰';
  const id = 'custom_' + Date.now();

  const list = getWallets();
  list.push({ id, name, icon, balance: 0 });
  saveWallets(list);
  toast(`Wallet "${name}" created!`, 'success');
  nameInput.value = '';
  closeNewWalletModal();
}
window.saveNewWallet = saveNewWallet;

function deleteCustomWallet(id) {
  if (['cash', 'bank', 'card'].includes(id)) {
    toast('Default system wallets cannot be deleted', 'error');
    return;
  }
  const list = getWallets().filter(w => w.id !== id);
  saveWallets(list);
  toast('Wallet removed', 'info');
}
window.deleteCustomWallet = deleteCustomWallet;

// ── INTER-WALLET TRANSFERS ──
function openTransferModal() {
  const m = document.getElementById('wallet-transfer-modal');
  if (!m) return;
  const fromSel = document.getElementById('transfer-from-wallet');
  const toSel = document.getElementById('transfer-to-wallet');
  const list = getWallets();

  if (fromSel && toSel) {
    let opts = list.map(w => `<option value="${w.id}">${w.icon} ${w.name}</option>`).join('');
    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
    if (list.length > 1) toSel.selectedIndex = 1;
  }
  const amtInput = document.getElementById('transfer-amt');
  if (amtInput) amtInput.value = '';
  m.style.display = 'flex';
}
window.openTransferModal = openTransferModal;
window.openWalletTransferModal = openTransferModal;
window.showTransferModal = openTransferModal;

function closeTransferModal() {
  const m = document.getElementById('wallet-transfer-modal');
  if (m) m.style.display = 'none';
}
window.closeTransferModal = closeTransferModal;

function submitWalletTransfer() {
  const fromId = document.getElementById('transfer-from-wallet').value;
  const toId = document.getElementById('transfer-to-wallet').value;
  const amt = parseFloat(document.getElementById('transfer-amt').value);
  const note = document.getElementById('transfer-note').value.trim();

  if (!amt || amt <= 0) {
    toast('Please enter a valid amount', 'error');
    return;
  }
  if (fromId === toId) {
    toast('Source and destination wallets must be different', 'error');
    return;
  }

  const walletsList = getWallets();
  const fromW = walletsList.find(w => w.id === fromId) || { name: fromId, icon: '👛' };
  const toW = walletsList.find(w => w.id === toId) || { name: toId, icon: '👛' };

  const transferGroupId = 'tr_' + Date.now();
  const today = new Date().toISOString().split('T')[0];

  // Atomic paired entries
  const outEntry = {
    id: transferGroupId + '_out',
    transferGroupId,
    amt,
    type: 'expense',
    cat: 'transfer',
    desc: note || `Transfer to ${toW.name}`,
    wallet: fromId,
    date: today,
    isTransfer: true
  };
  const inEntry = {
    id: transferGroupId + '_in',
    transferGroupId,
    amt,
    type: 'income',
    cat: 'transfer',
    desc: note || `Transfer from ${fromW.name}`,
    wallet: toId,
    date: today,
    isTransfer: true
  };

  window.entries.unshift(outEntry, inEntry);
  localStorage.setItem('pocketTrackEntries', JSON.stringify(window.entries));

  if (typeof updateHeaderStats === 'function') updateHeaderStats();
  if (typeof syncEntriesToCloud === 'function') syncEntriesToCloud();

  toast(`Transferred ₹${amt.toLocaleString('en-IN')} from ${fromW.name} to ${toW.name}!`, 'success');
  closeTransferModal();
}
window.submitWalletTransfer = submitWalletTransfer;

function getWalletBadgeHtml(walletId) {
  if (typeof walletId === 'object' && walletId !== null) walletId = walletId.wallet || 'cash';
  const list = getWallets();
  const w = list.find(x => x.id === walletId) || { name: walletId || 'Cash', icon: '💵' };
  return `<span class="entry-wallet-badge">${w.icon} ${w.name}</span>`;
}
window.getWalletBadgeHtml = getWalletBadgeHtml;
