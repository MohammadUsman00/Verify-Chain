/* MODULE: VIEW - BATCH DETAIL */
VC.views = VC.views || {};

VC.views.batchDetail = function(batchId) {
  VC.router.go(`batch/${batchId}`);
};

VC.views.batchDetailPage = async function(batchId) {
  document.getElementById('app-breadcrumb').innerHTML = `/ Dashboard / ${batchId}`;
  const batch = await VC.db.getBatch(batchId);
  if (!batch) {
    document.getElementById('app-view').innerHTML = `
      <div class="page-shell">
        ${VC.ui.pageHeader('Batch Not Found', '')}
        <button class="btn-ghost" onclick="VC.router.go('seller')">← Back to Dashboard</button>
      </div>`;
    return;
  }

  try {
    await VC.db.getScans();
  } catch (e) {}

  const theme = VC.crypto.getCategoryTheme(batch.category);
  const status = batch.status || 'active';
  const statusCls = status === 'active' ? 'status-ok' : status === 'recalled' ? 'status-warn' : 'status-pause';
  const statusLabel = status === 'active' ? '✓ ACTIVE' : status === 'recalled' ? '⊘ RECALLED' : '⏸ SUSPENDED';
  const batchScans = VC.state.scans.filter((s) => s.batchId === batchId);
  const flagged = batchScans.filter((s) => s.flagged).length;
  const supply = batch.supply_chain || batch.supplyChain || [];

  let tokens = batch.tokens || [];
  if (!tokens.length) {
    const rows = await VC.db.getBatchTokens(batchId);
    tokens = rows.map((r) => ({
      unit: r.unit_number,
      token: r.token,
      jti: r.token_jti,
      fingerprint: r.token_jti ? VC.crypto.shortFingerprint(r.token_jti) : null,
      scan_count: r.scan_count,
      active: r.active
    }));
  }

  const scannedUnits = tokens.filter((t) => (t.scan_count || 0) > 0).length;

  document.getElementById('app-view').innerHTML = `
    <div class="page-shell batch-detail-page">
      <button class="back-btn" onclick="VC.router.go('seller')">← Dashboard</button>
      <div class="batch-detail-hero" style="--batch-accent:${theme.accent}">
        <div class="batch-detail-hero-top">
          <span class="qr-sheet-cat" style="background:${theme.gradient}">${theme.icon} ${theme.label}</span>
          <span class="batch-status ${statusCls}">${statusLabel}</span>
        </div>
        <h1 class="batch-detail-title">${batch.product}</h1>
        <p class="mono batch-detail-id">${batch.id}</p>
        <div class="batch-detail-chips">
          ${VC.ui.policyBadge(batch)}
          <span class="detail-chip">📦 ${batch.units} units</span>
          <span class="detail-chip">🔍 ${batchScans.length} scans</span>
          ${flagged ? `<span class="detail-chip detail-chip--warn">⚠ ${flagged} flagged</span>` : ''}
        </div>
      </div>

      <div class="batch-detail-actions">
        <button class="batch-btn" onclick="VC.views.showQRSheet('${batchId}')">📱 QR Sheet</button>
        <button class="batch-btn" onclick="VC.views.verifyByBatchId('${batchId}')">👁 Preview Verify</button>
        <button class="batch-btn" onclick="VC.views.exportDpp('${batchId}')">📥 EU DPP Export</button>
        ${status !== 'active' ? `<button class="batch-btn batch-btn--gold" onclick="VC.views.setBatchStatus('${batchId}','active')">✓ Reactivate</button>` : ''}
        ${status === 'active' ? `<button class="batch-btn" onclick="VC.views.setBatchStatus('${batchId}','suspended')">⏸ Suspend</button>` : ''}
        ${status !== 'recalled' ? `<button class="batch-btn batch-btn--danger" onclick="VC.views.setBatchStatus('${batchId}','recalled')">⊘ Recall Batch</button>` : ''}
      </div>

      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-card-title">Batch Overview</div>
          <div class="detail-kv"><span>Origin</span><span>${batch.origin}</span></div>
          <div class="detail-kv"><span>Producer</span><span>${batch.farm}</span></div>
          <div class="detail-kv"><span>Harvest</span><span>${batch.harvest_date || batch.harvest || '—'}</span></div>
          ${(batch.cert_number || batch.cert) ? `<div class="detail-kv"><span>Certificate</span><span class="mono">${batch.cert_number || batch.cert}</span></div>` : ''}
          <div class="detail-kv"><span>Tags Scanned</span><span>${scannedUnits} / ${batch.units} units</span></div>
        </div>

        <div class="analytics-card">
          <div class="analytics-card-title">Supply Chain</div>
          ${supply.length ? VC.ui.supplyChainTrace(supply) : '<div class="empty-state-sm">No supply chain steps recorded</div>'}
        </div>

        <div class="analytics-card analytics-card--wide">
          <div class="analytics-card-title">Recent Verifications</div>
          ${batchScans.length ? batchScans.slice(0, 12).map((s) => `
            <div class="scan-row ${s.flagged ? 'scan-row-flagged' : ''}">
              <div class="scan-badge ${s.flagged ? 'scan-badge-red' : 'scan-badge-green'}">${s.flagged ? '⚠' : '✓'}</div>
              <div class="scan-info">
                <div class="scan-loc">📍 ${s.location} · ${s.device}</div>
              </div>
              <div class="scan-time">${VC.ui.relTime(s.ts)}</div>
            </div>
          `).join('') : '<div class="empty-state-sm">No scans recorded for this batch yet</div>'}
        </div>

        ${tokens.length ? `
        <div class="analytics-card analytics-card--wide">
          <div class="analytics-card-title">Unit Registry · ${tokens.length} tags</div>
          <div class="token-table-wrap">
            <table class="token-table">
              <thead><tr><th>Unit</th><th>Fingerprint</th><th>Scans</th><th>Status</th></tr></thead>
              <tbody>
                ${tokens.slice(0, 20).map((t) => `
                  <tr>
                    <td class="mono">#${t.unit ?? t.unit_number}</td>
                    <td class="mono">${t.fingerprint || '—'}</td>
                    <td>${t.scan_count ?? '—'}</td>
                    <td>${t.active === false ? '<span class="token-status token-status--off">Sealed</span>' : '<span class="token-status">Active</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${tokens.length > 20 ? `<p class="token-table-more">+ ${tokens.length - 20} more units · open QR Sheet for full list</p>` : ''}
          </div>
        </div>` : ''}
      </div>
    </div>`;
};

VC.views.setBatchStatus = async function(batchId, status) {
  const labels = { active: 'reactivated', suspended: 'suspended', recalled: 'recalled' };
  if (status === 'recalled' && !confirm('Recall this batch? All QR verifications will be blocked.')) return;
  try {
    await VC.db.updateBatchStatus(batchId, status);
    VC.ui.toast(`Batch ${labels[status]}`, status === 'active' ? 'success' : 'info');
    VC.views.batchDetailPage(batchId);
  } catch (err) {
    VC.ui.toast(err.message || 'Failed to update status', 'error');
  }
};

VC.views.exportDpp = async function(batchId) {
  const batch = await VC.db.getBatch(batchId);
  if (!batch) return;
  if (!batch.tokens?.length) {
    const rows = await VC.db.getBatchTokens(batchId);
    batch.tokens = rows.map((r) => ({
      unit: r.unit_number,
      token: r.token,
      jti: r.token_jti,
      fingerprint: r.token_jti ? VC.crypto.shortFingerprint(r.token_jti) : null
    }));
  }
  const payload = VC.db.buildDppExport(batch);
  VC.db.downloadJson(`DPP-${batchId}.json`, payload);
  VC.ui.toast('EU DPP JSON downloaded', 'success');
};
