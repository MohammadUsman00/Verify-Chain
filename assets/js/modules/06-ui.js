/* MODULE: UI COMPONENTS */
VC.ui = {
  appNav() {
    const s = VC.state.seller;
    return `
    <nav class="app-nav">
      <div class="app-nav-left">
        <button class="app-logo-btn" onclick="VC.router.go('')">
          <div class="logo-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V6l-8-4z" stroke="#00e5ff" stroke-width="1.5" stroke-linejoin="round"></path>
              <path d="M9 12l2 2 4-4" stroke="#00e5ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
          <span class="logo-text">Verify<span>Chain</span></span>
        </button>
        <div class="app-breadcrumb" id="app-breadcrumb"></div>
      </div>
      <div class="app-nav-right">
        ${s ? `
          <span class="app-seller-name">${s.business_name || s.name}</span>
          <span class="app-plan-badge">${s.plan}</span>
          <button class="app-nav-btn" onclick="VC.router.go('seller')">Dashboard</button>
          <button class="app-nav-btn" onclick="VC.router.go('fraud')">Fraud Monitor</button>
          <button class="app-nav-btn" onclick="VC.db.signOut()">Sign Out</button>
        ` : ''}
        <button class="app-nav-btn" onclick="VC.router.go('scan')">Scan</button>
        ${s
          ? '<button class="btn-primary btn-sm" onclick="VC.router.go(\'batch-new\')">+ New Batch</button>'
          : '<button class="btn-primary btn-sm" onclick="VC.router.go(\'login\')">Seller Login</button>'}
      </div>
    </nav>`;
  },
  verifiedBadge() {
    return `
    <div class="verified-badge">
      <div class="verified-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </div>
      <div class="verified-label">VERIFIED AUTHENTIC</div>
      <div class="verified-sub">Cryptographically signed - Tamper-proof</div>
    </div>`;
  },
  fraudBadge(reason) {
    return `
    <div class="fraud-badge">
      <div class="fraud-icon">⚠</div>
      <div class="fraud-label">FRAUD ALERT</div>
      <div class="fraud-sub">${reason}</div>
    </div>`;
  },
  statCard(label, value, sub, color) {
    return `
    <div class="stat-card">
      <div class="stat-val" style="color:${color || 'var(--cyan)'}">
        <span class="stat-num">${value}</span>
      </div>
      <div class="stat-label">${label}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;
  },
  batchCard(batch) {
    const scansForBatch = VC.state.scans.filter((s) => s.batchId === batch.id);
    const flagged = scansForBatch.filter((s) => s.flagged).length;
    return `
    <div class="batch-card" onclick="VC.views.batchDetail('${batch.id}')">
      <div class="batch-card-header">
        <div>
          <div class="batch-id">${batch.id}</div>
          <div class="batch-name">${batch.product}</div>
        </div>
        <div class="batch-status ${flagged > 0 ? 'status-warn' : 'status-ok'}">
          ${flagged > 0 ? '⚠ ALERT' : '✓ ACTIVE'}
        </div>
      </div>
      <div class="batch-meta">
        <span>📍 ${batch.origin}</span>
        <span>📦 ${batch.units} units</span>
        <span>🔍 ${scansForBatch.length} scans</span>
        <span>🌾 ${batch.harvest || batch.harvest_date || '-'}</span>
      </div>
      <div class="batch-actions" onclick="event.stopPropagation()">
        <button class="batch-btn" onclick="VC.views.showQRSheet('${batch.id}')">📱 QR Sheet</button>
        <button class="batch-btn" onclick="VC.views.verifyByBatchId('${batch.id}')">👁 Preview</button>
      </div>
    </div>`;
  },
  supplyChainTrace(steps) {
    return `
    <div class="chain-trace">
      ${steps.map((step, i) => `
        <div class="chain-step">
          <div class="chain-dot"></div>
          <div class="chain-label">${step}</div>
          ${i < steps.length - 1 ? '<div class="chain-line"></div>' : ''}
        </div>
      `).join('')}
    </div>`;
  },
  toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `vc-toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('toast-show'), 10);
    setTimeout(() => {
      t.classList.remove('toast-show');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  },
  generateQR(container, url) {
    container.innerHTML = '';
    new QRCode(container, {
      text: url,
      width: 160,
      height: 160,
      colorDark: '#e8edf8',
      colorLight: '#050810',
      correctLevel: QRCode.CorrectLevel.H
    });
  },
  loader(msg = 'Loading...') {
    return `<div class="vc-loader"><div class="loader-ring"></div><div class="loader-msg">${msg}</div></div>`;
  },
  relTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }
};
