/* MODULE: VIEW - BUYER VERIFY */
VC.views.verify = async function(token) {
  const appNav = document.querySelector('.app-nav');
  if (appNav) appNav.style.display = 'none';

  document.getElementById('app-view').innerHTML = `
    <div class="verify-page">
      <div class="verify-header">
        <div class="verify-logo">Verify<span>Chain</span></div>
        <div class="verify-tagline">// Product Authentication Certificate</div>
      </div>
      ${VC.ui.loader('Verifying authenticity...')}
    </div>
  `;

  try {
    const result = await VC.db.verifyQR(token);
    if (!result.verified) {
      document.getElementById('app-view').innerHTML = `
        <div class="verify-page">
          <div class="verify-header"><div class="verify-logo">Verify<span>Chain</span></div></div>
          <div class="fraud-badge-large">
            <div style="font-size:3rem;margin-bottom:1rem;">⚠</div>
            <div class="fraud-label">${
              result.reason === 'INVALID_SIGNATURE' ? 'COUNTERFEIT DETECTED' :
              result.reason === 'NOT_FOUND' ? 'NOT REGISTERED' :
              result.reason === 'RECALLED' ? 'PRODUCT RECALLED' : 'VERIFICATION FAILED'
            }</div>
            <div class="fraud-sub">${result.message}</div>
          </div>
          <div class="verify-warn-box">
            <strong>Do not purchase this product.</strong>
            ${result.reason === 'INVALID_SIGNATURE' ? ' This QR code has an invalid cryptographic signature - it was likely copied from a genuine product.' : ''}
          </div>
          <div class="verify-actions" style="width:100%;margin-top:2rem">
            <a href="mailto:fraud@verifychain.in?subject=Report Counterfeit ${result.batch_id || ''}" class="btn-primary btn-full">📧 Report Counterfeit</a>
          </div>
        </div>
      `;
      return;
    }

    const { batch, scan_history, current_scan } = result;
    VC.state.currentVerifiedBatch = batch;
    document.getElementById('app-view').innerHTML = `
      <div class="verify-page">
        <div class="verify-header">
          <div class="verify-logo">Verify<span>Chain</span></div>
          <div class="verify-tagline">// Product Authentication Certificate</div>
        </div>
        ${VC.ui.verifiedBadge()}
        <div class="verify-card">
          <div class="verify-product-name">${batch.product}</div>
          <div class="verify-batch-id">Batch ${batch.id}</div>
          <div class="verify-details">
            <div class="verify-row"><span class="verify-key">ORIGIN</span><span class="verify-val">📍 ${batch.origin}</span></div>
            <div class="verify-row"><span class="verify-key">PRODUCER</span><span class="verify-val">🌾 ${batch.farm}</span></div>
            <div class="verify-row"><span class="verify-key">HARVEST</span><span class="verify-val">📅 ${batch.harvest_date}</span></div>
            <div class="verify-row"><span class="verify-key">SELLER</span><span class="verify-val">${batch.seller_verified ? '✓ ' : ''}${batch.seller_name}</span></div>
            ${batch.cert_number ? `<div class="verify-row"><span class="verify-key">CERTIFIED</span><span class="verify-val mono">${batch.cert_number}</span></div>` : ''}
            <div class="verify-row"><span class="verify-key">YOUR LOCATION</span><span class="verify-val">${current_scan.location}</span></div>
            <div class="verify-row"><span class="verify-key">TOTAL SCANS</span><span class="verify-val">${batch.total_scans} verifications</span></div>
          </div>
        </div>
        <div class="verify-card">
          <div class="verify-card-title">Supply Chain Trace</div>
          ${VC.ui.supplyChainTrace(batch.supply_chain || [])}
        </div>
        ${scan_history.length > 1 ? `
          <div class="verify-card">
            <div class="verify-card-title">Recent Verifications</div>
            <div class="verify-scan-history">
              ${scan_history.slice(0, 5).map((s) => `
                <div class="verify-scan-row">
                  <span class="verify-scan-loc">📍 ${s.location_display || 'Unknown'}</span>
                  <span class="verify-scan-time">${VC.ui.relTime(new Date(s.scanned_at).getTime())}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="verify-actions">
          <button class="btn-primary btn-full" onclick="VC.views.downloadCert('${batch.id}')">📄 Download Certificate</button>
          <button class="btn-ghost btn-full" onclick="
            navigator.share
              ? navigator.share({title:'VerifyChain - ${batch.product}', url: location.href})
              : navigator.clipboard.writeText(location.href).then(() => VC.ui.toast('Link copied', 'success'))
          ">↗ Share</button>
        </div>
        <div class="verify-footer">
          <div class="verify-footer-brand">🔐 Verified by VerifyChain</div>
          <div class="verify-footer-sub">Cryptographically signed · Server-verified · EU DPP Compliant</div>
        </div>
      </div>
    `;

    setTimeout(() => document.querySelector('.verified-badge')?.classList.add('badge-reveal'), 100);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  } catch (err) {
    document.getElementById('app-view').innerHTML = `
      <div class="verify-page">
        <div class="verify-header"><div class="verify-logo">Verify<span>Chain</span></div></div>
        <div style="text-align:center;padding:3rem;color:var(--text2)">
          <div style="font-size:2rem;margin-bottom:1rem">⚡</div>
          <div>Verification service temporarily unavailable</div>
          <div style="font-size:.8rem;margin-top:.5rem;color:var(--text3)">${err.message}</div>
          <button class="btn-ghost" style="margin-top:2rem" onclick="location.reload()">Try Again</button>
        </div>
      </div>
    `;
  }
};

VC.views.downloadCert = function(batchId, batchData) {
  const batch = batchData || VC.state.currentVerifiedBatch || VC.state.batches.find((b) => b.id === batchId);
  if (!batch) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>VerifyChain Certificate - ${batch.id}</title>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono&family=Instrument+Sans:wght@400;600&display=swap" rel="stylesheet"/>
    <style>
      body { font-family: 'Instrument Sans', sans-serif; background: #fff; color: #0a0a0a; padding: 4rem; max-width: 700px; margin: 0 auto; }
      .cert-header { text-align: center; border-bottom: 3px double #0a0a0a; padding-bottom: 2rem; margin-bottom: 2rem; }
      .cert-brand { font-family: 'Syne', sans-serif; font-size: 1.8rem; font-weight: 800; letter-spacing: -.02em; }
      .cert-title { font-size: 0.8rem; letter-spacing: .15em; color: #666; text-transform: uppercase; margin-top: .5rem; }
      .cert-badge { background: #00c96e; color: white; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.2rem; text-align: center; padding: 1rem; border-radius: 8px; margin: 2rem 0; letter-spacing: .05em; }
      .cert-product { font-family: 'Syne', sans-serif; font-size: 1.6rem; font-weight: 800; margin-bottom: .5rem; }
      .cert-id { font-family: 'JetBrains Mono', monospace; font-size: .85rem; color: #666; margin-bottom: 2rem; }
      .cert-row { display: flex; justify-content: space-between; padding: .75rem 0; border-bottom: 1px solid #eee; font-size: .9rem; }
      .cert-key { color: #666; font-weight: 600; text-transform: uppercase; font-size: .75rem; letter-spacing: .08em; padding-top: .1rem; }
      .cert-val { font-weight: 500; text-align: right; }
      .cert-footer { margin-top: 3rem; text-align: center; font-size: .8rem; color: #999; }
    </style>
    </head><body>
    <div class="cert-header"><div class="cert-brand">VerifyChain</div><div class="cert-title">Certificate of Authenticity</div></div>
    <div class="cert-badge">✓ VERIFIED AUTHENTIC - GENUINE PRODUCT</div>
    <div class="cert-product">${batch.product}</div>
    <div class="cert-id">Batch ID: ${batch.id}</div>
    <div class="cert-row"><div class="cert-key">Origin</div><div class="cert-val">${batch.origin}</div></div>
    <div class="cert-row"><div class="cert-key">Producer</div><div class="cert-val">${batch.farm}</div></div>
    <div class="cert-row"><div class="cert-key">Harvest Date</div><div class="cert-val">${batch.harvest_date || batch.harvest || '-'}</div></div>
    <div class="cert-row"><div class="cert-key">Verified Seller</div><div class="cert-val">${batch.seller_name || batch.sellerName || 'Verified Seller'}</div></div>
    ${(batch.cert_number || batch.cert) ? `<div class="cert-row"><div class="cert-key">Cert. Number</div><div class="cert-val">${batch.cert_number || batch.cert}</div></div>` : ''}
    <div class="cert-row"><div class="cert-key">Issued</div><div class="cert-val">${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
    <div class="cert-footer">🔐 Cryptographically signed by VerifyChain · EU DPP Compliant · Tamper-proof</div>
    </body></html>
  `);
  win.print();
};
