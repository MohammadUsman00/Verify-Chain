/* MODULE: VIEW - BATCH CREATOR */
VC.views.batchNew = function() {
  document.getElementById('app-breadcrumb').innerHTML = '/ Dashboard / New Batch';
  document.getElementById('app-view').innerHTML = `
    <div class="batch-creator">
      <div class="batch-creator-header">
        <button class="back-btn" onclick="VC.router.go('seller')">← Back</button>
        <h1>Register New Batch</h1>
        <p>Each batch generates cryptographically signed QR codes for every unit</p>
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
          <div class="form-group"><label>Certification Number <span class="label-opt">(optional)</span></label><input type="text" id="f-cert" class="vc-input" placeholder="e.g. KVIB-K-2025-7821"></div>
          <div class="form-group"><label>Supply Chain Steps <span class="label-opt">(one per line)</span></label><textarea id="f-supply" class="vc-textarea" rows="4" placeholder="Farm harvest&#10;Processing & grading&#10;Quality certification&#10;Packaging"></textarea></div>
          <button class="btn-primary btn-full" onclick="VC.views.generateBatch()">🔐 Generate Encrypted QR Batch</button>
        </div>
        <div class="batch-preview-panel">
          <div class="preview-label">// QR PREVIEW</div>
          <div class="qr-preview-box" id="qr-preview-box"><div class="qr-placeholder"><div style="font-size:3rem;margin-bottom:1rem;opacity:.3">⬡</div><div style="color:var(--text3)">Fill form to preview QR</div></div></div>
          <div class="preview-meta" id="preview-meta"></div>
          <div class="preview-tip"><div class="tip-icon">ℹ</div>Each unit gets a unique URL. Scan any QR to see the authenticity report buyers will see.</div>
        </div>
      </div>
      <div id="qr-sheet-section" style="display:none">
        <div class="qr-sheet-header">
          <h2>Generated QR Sheet</h2>
          <div class="qr-sheet-actions">
            <button class="batch-btn" onclick="window.print()">🖨 Print / Save PDF</button>
            <button class="batch-btn" onclick="VC.router.go('seller')">✓ Done</button>
          </div>
        </div>
        <div class="qr-grid" id="qr-grid"></div>
      </div>
    </div>`;

  VC.views.updatePreset();
  ['f-product', 'f-origin', 'f-units'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', VC.views.refreshBatchPreview);
  });
  VC.views.refreshBatchPreview();
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

VC.views.refreshBatchPreview = function() {
  const product = document.getElementById('f-product')?.value?.trim();
  const origin = document.getElementById('f-origin')?.value?.trim();
  const units = parseInt(document.getElementById('f-units')?.value || '0', 10);
  const box = document.getElementById('qr-preview-box');
  const meta = document.getElementById('preview-meta');
  if (!box || !meta) return;
  if (!product || !origin || !units) return;
  const demoId = VC.crypto.generateBatchId();
  box.innerHTML = '<div id="preview-qr"></div>';
  VC.ui.generateQR(document.getElementById('preview-qr'), VC.crypto.buildVerifyUrl(demoId));
  meta.innerHTML = `<div class="mono">${demoId}</div><div>${product}</div><div>Origin: ${origin} · Units: ${units}</div>`;
};

VC.views.generateBatch = async function() {
  const product = document.getElementById('f-product').value.trim();
  const origin = document.getElementById('f-origin').value.trim();
  const farm = document.getElementById('f-farm').value.trim();
  const harvest = document.getElementById('f-harvest').value;
  const units = parseInt(document.getElementById('f-units').value, 10);
  const cert = document.getElementById('f-cert').value.trim();
  const supplyRaw = document.getElementById('f-supply').value.trim();

  if (!product || !origin || !farm || !units) {
    VC.ui.toast('Please fill all required fields', 'error');
    return;
  }

  const btn = document.querySelector('.btn-full');
  btn.textContent = '⚙ Generating...';
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
    supplyChain
  };

  const created = await VC.db.createBatch(formData);
  const batch = created.batch;
  const tokens = created.tokens || [];

  const grid = document.getElementById('qr-grid');
  const section = document.getElementById('qr-sheet-section');
  grid.innerHTML = '';
  const showCount = Math.min(tokens.length || units, 12);
  for (let i = 1; i <= showCount; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'qr-cell';
    const token = tokens[i - 1]?.token || '';
    const url = VC.crypto.buildVerifyUrl(token);
    const qrDiv = document.createElement('div');
    VC.ui.generateQR(qrDiv, url);
    cell.innerHTML = `<div class="qr-cell-frame"><div class="qr-cell-brand">VERIFYCHAIN</div></div>`;
    cell.querySelector('.qr-cell-frame').prepend(qrDiv);
    cell.innerHTML += `<div class="qr-cell-id">${batch.id}</div><div class="qr-cell-unit">Unit ${i} of ${units}</div><div class="qr-cell-product">${product}</div>`;
    grid.appendChild(cell);
  }
  if (units > 12) {
    const note = document.createElement('div');
    note.className = 'qr-overflow-note';
    note.textContent = `+ ${units - 12} more QR codes generated. Print to see all.`;
    grid.appendChild(note);
  }
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth' });
  VC.ui.toast(`✓ Generated ${units} QR codes for ${batch.id}`, 'success');
  btn.textContent = '✓ Generated Successfully';
};
