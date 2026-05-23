/* MODULE: VIEW - BATCH CREATOR */
VC.views.batchNew = function() {
  document.getElementById('app-breadcrumb').innerHTML = '/ Dashboard / New Batch';
  document.getElementById('app-view').innerHTML = `
    <div class="batch-creator">
      <div class="batch-creator-header">
        <button class="back-btn" onclick="VC.router.go('seller')">← Back</button>
        <h1>Register New Batch</h1>
        <p>Every unit gets a globally unique, HMAC-sealed QR — no two tags are ever identical</p>
      </div>
      <div class="batch-form-grid">
        <div class="batch-form-panel">
          <div class="form-group">
            <label>Product Category</label>
            <select id="f-category" class="vc-select" onchange="VC.views.updatePreset()">
              <option value="saffron">Kashmiri Saffron</option>
              <option value="pashmina">Pashmina Shawl</option>
              <option value="carpet">Kashmir Carpet</option>
              <option value="walnut">Kashmiri Walnut Wood</option>
              <option value="honey">Kashmir Honey</option>
              <option value="custom">Custom Product</option>
            </select>
          </div>
          <div class="form-group"><label>Product Name</label><input type="text" id="f-product" class="vc-input" placeholder="e.g. Kashmiri Saffron Grade A"></div>
          <div class="form-group"><label>Origin / Region</label><input type="text" id="f-origin" class="vc-input" placeholder="e.g. Pampore, Pulwama, J&K"></div>
          <div class="form-group"><label>Farm / Producer Name</label><input type="text" id="f-farm" class="vc-input" placeholder="e.g. Wani Family Farm"></div>
          <div class="form-group"><label>Harvest / Production Date</label><input type="month" id="f-harvest" class="vc-input"></div>
          <div class="form-group"><label>Number of Units</label><input type="number" id="f-units" class="vc-input" value="50" min="1" max="1000"></div>
          <div class="form-group">
            <label>Verification Policy</label>
            <div class="scan-policy-picker" id="scan-policy-picker">
              <button type="button" class="policy-card policy-card--active" data-policy="single" onclick="VC.views.selectScanPolicy('single')">
                <span class="policy-card-icon">🔒</span>
                <span class="policy-card-title">One-Time Seal</span>
                <span class="policy-card-desc">First scan authenticates forever. Re-scans blocked — ideal for luxury goods.</span>
              </button>
              <button type="button" class="policy-card" data-policy="limited" onclick="VC.views.selectScanPolicy('limited')">
                <span class="policy-card-icon">◎</span>
                <span class="policy-card-title">Limited Scans</span>
                <span class="policy-card-desc">Allow N verifications per tag — balance fraud detection & buyer checks.</span>
              </button>
              <button type="button" class="policy-card" data-policy="unlimited" onclick="VC.views.selectScanPolicy('unlimited')">
                <span class="policy-card-icon">∞</span>
                <span class="policy-card-title">Unlimited</span>
                <span class="policy-card-desc">Open verification — best for display samples & education.</span>
              </button>
            </div>
            <div class="form-group" id="max-scans-wrap" style="display:none;margin-top:.75rem">
              <label>Max scans per QR</label>
              <input type="number" id="f-max-scans" class="vc-input" value="3" min="1" max="50">
            </div>
          </div>
          <div class="form-group"><label>Certification Number <span class="label-opt">(optional)</span></label><input type="text" id="f-cert" class="vc-input" placeholder="e.g. KVIB-K-2025-7821"></div>
          <div class="form-group"><label>Supply Chain Steps <span class="label-opt">(one per line)</span></label><textarea id="f-supply" class="vc-textarea" rows="4" placeholder="Farm harvest&#10;Processing & grading&#10;Quality certification&#10;Packaging"></textarea></div>
          <button class="btn-primary btn-full" onclick="VC.views.generateBatch()">🔐 Generate Unique Signed QR Batch</button>
        </div>
        <div class="batch-preview-panel">
          <div class="preview-label">// LIVE QR PREVIEW</div>
          <div class="qr-preview-box" id="qr-preview-box"><div class="qr-placeholder"><div style="font-size:3rem;margin-bottom:1rem;opacity:.3">⬡</div><div style="color:var(--text3)">Fill form to preview QR</div></div></div>
          <div class="preview-meta" id="preview-meta"></div>
          <div class="preview-tip"><div class="tip-icon">ℹ</div>Each unit receives a unique cryptographic ID (JTI + nonce). Impossible to clone without the batch secret.</div>
        </div>
      </div>
      <div id="qr-sheet-section" style="display:none">
        <div class="qr-sheet-header">
          <h2>Your Unique QR Tag Sheet</h2>
          <div class="qr-sheet-actions">
            <button class="batch-btn" onclick="window.print()">🖨 Print / Save PDF</button>
            <button class="batch-btn" onclick="VC.router.go('seller')">✓ Done</button>
          </div>
        </div>
        <div class="qr-grid" id="qr-grid"></div>
      </div>
    </div>`;

  VC.state._scanPolicy = 'single';
  VC.views.updatePreset();
  ['f-product', 'f-origin', 'f-units', 'f-category'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', VC.views.refreshBatchPreview);
    document.getElementById(id)?.addEventListener('change', VC.views.refreshBatchPreview);
  });
  VC.views.refreshBatchPreview();
};

VC.views.selectScanPolicy = function(policy) {
  VC.state._scanPolicy = policy;
  document.querySelectorAll('.policy-card').forEach((el) => {
    el.classList.toggle('policy-card--active', el.dataset.policy === policy);
  });
  const wrap = document.getElementById('max-scans-wrap');
  if (wrap) wrap.style.display = policy === 'limited' ? 'block' : 'none';
};

VC.views.updatePreset = function() {
  const PRESETS = {
    saffron: { product: 'Kashmiri Saffron Grade A', origin: 'Pampore, Pulwama District, J&K' },
    pashmina: { product: 'Pashmina Shawl - Hand-woven', origin: 'Srinagar, Kashmir Valley' },
    carpet: { product: 'Kashmir Hand-knotted Carpet', origin: 'Srinagar, Kashmir' },
    walnut: { product: 'Kashmiri Walnut Wood Craft', origin: 'Sopore, Baramulla' },
    honey: { product: 'Pure Kashmir Himalayan Honey', origin: 'Pahalgam, Anantnag' },
    custom: { product: '', origin: '' }
  };
  const cat = document.getElementById('f-category')?.value;
  if (!cat) return;
  const p = PRESETS[cat];
  document.getElementById('f-product').value = p.product;
  document.getElementById('f-origin').value = p.origin;
  VC.views.refreshBatchPreview();
};

VC.views.refreshBatchPreview = async function() {
  const product = document.getElementById('f-product')?.value?.trim();
  const origin = document.getElementById('f-origin')?.value?.trim();
  const units = parseInt(document.getElementById('f-units')?.value || '0', 10);
  const category = document.getElementById('f-category')?.value || 'custom';
  const box = document.getElementById('qr-preview-box');
  const meta = document.getElementById('preview-meta');
  if (!box || !meta || !product || !origin || !units) return;

  const theme = VC.crypto.getCategoryTheme(category);
  const demoId = VC.crypto.generateBatchId();
  const secret = await VC.crypto.generateSecret();
  const jti = VC.crypto.generateTokenId();
  const payload = { bid: demoId, uid: 1, pid: category, jti, n: VC.crypto.generateNonce(), ts: Date.now() };
  const token = await VC.crypto.encodeToken(payload, secret);
  const url = VC.crypto.buildVerifyUrl(token);
  const fp = VC.crypto.shortFingerprint(jti);

  box.innerHTML = `<div class="qr-preview-wrap qr-cell--${category}"><div id="preview-qr"></div></div>`;
  VC.ui.generateQR(document.getElementById('preview-qr'), url, { category, accentBorder: true, size: 160 });
  meta.innerHTML = `
    <div class="mono preview-fp">${fp}</div>
    <div>${theme.icon} ${product}</div>
    <div>Origin: ${origin} · ${units} unique tags</div>
    <div class="preview-policy">${VC.crypto.scanPolicyLabel(VC.state._scanPolicy || 'single', document.getElementById('f-max-scans')?.value || 3)}</div>`;
};

VC.views.generateBatch = async function() {
  const product = document.getElementById('f-product').value.trim();
  const origin = document.getElementById('f-origin').value.trim();
  const farm = document.getElementById('f-farm').value.trim();
  const harvest = document.getElementById('f-harvest').value;
  const units = parseInt(document.getElementById('f-units').value, 10);
  const cert = document.getElementById('f-cert').value.trim();
  const supplyRaw = document.getElementById('f-supply').value.trim();
  const scanPolicy = VC.state._scanPolicy || 'single';
  const maxScansPerUnit = parseInt(document.getElementById('f-max-scans')?.value || '3', 10);

  if (!product || !origin || !farm || !units) {
    VC.ui.toast('Please fill all required fields', 'error');
    return;
  }

  const btn = document.querySelector('.btn-full');
  const originalLabel = btn.textContent;
  btn.textContent = '⚙ Minting unique tags...';
  btn.disabled = true;

  const supplyChain = supplyRaw ? supplyRaw.split('\n').filter(Boolean) : [farm, 'Processing & Grading', 'Quality Certification', VC.state.seller.name || VC.state.seller.business_name];
  const formData = {
    product,
    category: document.getElementById('f-category').value,
    origin,
    farm,
    harvest,
    units,
    cert,
    supplyChain,
    scanPolicy,
    maxScansPerUnit
  };

  try {
    const created = await VC.db.createBatch(formData);
    const batch = created.batch;
    const tokens = created.tokens || [];

    const grid = document.getElementById('qr-grid');
    const section = document.getElementById('qr-sheet-section');
    VC.ui.renderQRSheet(grid, batch, tokens, { showAll: true });
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
    VC.ui.toast(`✓ ${units} unique cryptographic tags minted for ${batch.id}`, 'success');
    btn.textContent = '✓ Batch Minted Successfully';
  } catch (err) {
    const message = err?.message || 'Failed to generate QR batch. Check your Supabase/auth setup and try again.';
    VC.ui.toast(message, 'error');
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
};
