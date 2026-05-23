/* MODULE: VIEW - SELLER */
VC.views = VC.views || {};
VC.views.landing = function() {};

VC.views.seller = async function() {
  document.getElementById('app-breadcrumb').innerHTML = '/ Dashboard';
  const s = VC.state.seller;
  try {
    await VC.db.getBatches();
    await VC.db.getScans();
  } catch (e) {
    console.warn('Dashboard fetch error', e);
  }
  const batches = VC.state.batches;
  const scans = VC.state.scans;
  const alerts = scans.filter((sc) => sc.flagged);
  const today = scans.filter((sc) => Date.now() - sc.ts < 86400000);

  document.getElementById('app-view').innerHTML = `
    <div class="seller-dashboard">
      <div class="dash-header">
        <div>
          <div class="dash-greeting"><span class="status-dot"></span>SELLER OPERATIONS</div>
          <h1 class="dash-title">${s.business_name || s.name}</h1>
          <div class="dash-location">📍 ${s.location} · Plan: ${s.plan}</div>
        </div>
        <div class="dash-header-actions">
          <button class="batch-btn" onclick="VC.router.go('analytics')">📊 Analytics</button>
          <button class="btn-primary" onclick="VC.router.go('batch-new')">+ Register New Batch</button>
        </div>
      </div>
      <div class="stats-row">
        ${VC.ui.statCard('Total Batches', batches.length, 'across all products', 'var(--cyan)')}
        ${VC.ui.statCard('Total QR Tags', batches.reduce((a, b) => a + b.units, 0), 'issued', 'var(--gold)')}
        ${VC.ui.statCard('Scans Today', today.length, 'in last 24h', 'var(--green)')}
        ${VC.ui.statCard('Fraud Alerts', alerts.length, alerts.length ? '⚠ needs attention' : 'all clear', alerts.length ? 'var(--red)' : 'var(--green)')}
      </div>
      <div class="dash-section">
        <div class="dash-section-header">
          <h2>Product Batches</h2>
          <div class="dash-section-actions">
            <button class="batch-btn" onclick="VC.router.go('trust')">Trust Center</button>
            <button class="batch-btn" onclick="VC.router.go('fraud')">Fraud Monitor →</button>
          </div>
        </div>
        <div class="batch-list">
          ${batches.length ? batches.map((b) => VC.ui.batchCard(b)).join('') : `
            <div class="empty-state">
              <div class="empty-icon">📦</div>
              <p>No batches yet. Register your first product.</p>
              <button class="btn-primary" onclick="VC.router.go('batch-new')">+ New Batch</button>
            </div>
          `}
        </div>
      </div>
      <div class="dash-section">
        <div class="dash-section-header"><h2>Recent Scan Activity</h2></div>
        <div class="scan-log">
          ${scans.slice(0, 10).map((sc) => `
            <div class="scan-row ${sc.flagged ? 'scan-row-flagged' : ''}">
              <div class="scan-badge ${sc.flagged ? 'scan-badge-red' : 'scan-badge-green'}">${sc.flagged ? '⚠' : '✓'}</div>
              <div class="scan-info">
                <div class="scan-batch">${sc.batchId}</div>
                <div class="scan-loc">📍 ${sc.location} · ${sc.device}</div>
              </div>
              <div class="scan-time">${VC.ui.relTime(sc.ts)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;

  if (VC.state.scanSub) VC.state.scanSub.unsubscribe();
  VC.state.scanSub = VC.db.subscribeToScans(() => {
    if (location.hash === '#/seller') VC.views.seller();
  });
};

VC.views.showQRSheet = async function(batchId) {
  const batch = await VC.db.getBatch(batchId);
  if (!batch) {
    VC.ui.toast('Batch not found', 'error');
    return;
  }

  document.getElementById('app-breadcrumb').innerHTML = `/ Dashboard / ${batchId} / QR Sheet`;
  document.getElementById('app-view').innerHTML = `
    <div class="batch-creator">
      <div class="batch-creator-header">
        <button class="back-btn" onclick="VC.router.go('seller')">← Dashboard</button>
        <h1>QR Tag Sheet</h1>
        <p>${batch.product} · ${batch.units} unique tags</p>
      </div>
      <div class="qr-sheet-header">
        <div></div>
        <div class="qr-sheet-actions">
          <button class="batch-btn" onclick="window.print()">🖨 Print / PDF</button>
        </div>
      </div>
      <div class="qr-grid" id="qr-reprint-grid"></div>
    </div>`;

  let tokens = batch.tokens;
  if (!tokens || !tokens.length) {
    const rows = await VC.db.getBatchTokens(batchId);
    tokens = rows.map((r) => ({
      unit: r.unit_number,
      token: r.token,
      jti: r.token_jti,
      fingerprint: r.token_jti ? VC.crypto.shortFingerprint(r.token_jti) : null
    }));
  }

  if (!tokens.length) {
    document.getElementById('qr-reprint-grid').innerHTML = '<div class="empty-state">No tokens stored for this batch.</div>';
    return;
  }

  VC.ui.renderQRSheet(document.getElementById('qr-reprint-grid'), batch, tokens, { showAll: true });
};
