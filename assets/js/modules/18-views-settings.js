/* MODULE: VIEW - SETTINGS */
VC.views = VC.views || {};

VC.views.settings = function() {
  const s = VC.state.seller;
  document.getElementById('app-breadcrumb').innerHTML = '/ Settings';
  const batches = VC.state.batches || [];
  const tags = batches.reduce((a, b) => a + (b.units || 0), 0);

  document.getElementById('app-view').innerHTML = `
    <div class="page-shell settings-page">
      ${VC.ui.pageHeader('Account Settings', 'Profile, plan, and data controls')}
      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-card-title">Seller Profile</div>
          <div class="detail-kv"><span>Business</span><span>${s.business_name || s.name}</span></div>
          <div class="detail-kv"><span>Contact</span><span>${s.email || '—'}</span></div>
          <div class="detail-kv"><span>Location</span><span>${s.location || '—'}</span></div>
          <div class="detail-kv"><span>Plan</span><span class="policy-pill policy-limited">${(s.plan || 'starter').toUpperCase()}</span></div>
          <div class="detail-kv"><span>Verified</span><span>${s.verified ? '✓ Yes' : 'Pending'}</span></div>
        </div>

        <div class="analytics-card">
          <div class="analytics-card-title">Usage Summary</div>
          <div class="detail-kv"><span>Batches</span><span>${batches.length}</span></div>
          <div class="detail-kv"><span>QR Tags Issued</span><span>${tags}</span></div>
          <div class="detail-kv"><span>Total Scans</span><span>${VC.state.scans.length}</span></div>
          <div class="detail-kv"><span>Mode</span><span>${VC.config.demoMode || !VC.db.isBackendReady() ? 'Demo / Local' : 'Production'}</span></div>
        </div>

        <div class="analytics-card analytics-card--wide">
          <div class="analytics-card-title">Quick Links</div>
          <div class="settings-links">
            <button class="batch-btn" onclick="VC.router.go('analytics')">📊 Analytics</button>
            <button class="batch-btn" onclick="VC.router.go('trust')">🛡 Trust Center</button>
            <button class="batch-btn" onclick="VC.router.go('fraud')">⚠ Fraud Monitor</button>
            <button class="batch-btn" onclick="VC.router.go('batch-new')">+ New Batch</button>
          </div>
        </div>

        <div class="analytics-card analytics-card--wide">
          <div class="analytics-card-title">Data & Privacy</div>
          <p class="trust-body">Scan events store location and hashed device metadata for fraud detection. HMAC secrets never leave the server during verification.</p>
          <div class="settings-links">
            <button class="batch-btn" onclick="VC.views.exportAllDpp()">📥 Export All DPP (JSON)</button>
            <button class="batch-btn batch-btn--danger" onclick="if(confirm('Clear all local demo data?')){localStorage.clear();location.reload();}">Clear Local Data</button>
          </div>
        </div>
      </div>
    </div>`;
};

VC.views.exportAllDpp = async function() {
  const batches = VC.state.batches || [];
  if (!batches.length) {
    VC.ui.toast('No batches to export', 'error');
    return;
  }
  const exports = [];
  for (const b of batches) {
    let batch = { ...b };
    if (!batch.tokens?.length) {
      const rows = await VC.db.getBatchTokens(batch.id);
      batch.tokens = rows.map((r) => ({
        unit: r.unit_number,
        token: r.token,
        jti: r.token_jti,
        fingerprint: r.token_jti ? VC.crypto.shortFingerprint(r.token_jti) : null
      }));
    }
    exports.push(VC.db.buildDppExport(batch));
  }
  VC.db.downloadJson(`VerifyChain-DPP-Export-${Date.now()}.json`, {
    exportedAt: new Date().toISOString(),
    seller: VC.state.seller?.business_name,
    batches: exports
  });
  VC.ui.toast(`Exported ${exports.length} batch passports`, 'success');
};
