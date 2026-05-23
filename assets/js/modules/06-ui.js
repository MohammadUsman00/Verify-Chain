/* MODULE: UI COMPONENTS */
VC.ui = {
  productionBanner() {
    if (VC.config.productionReady) {
      return '<div class="prod-banner prod-banner--ok">Production verification active · HMAC enforced server-side</div>';
    }
    const msg = !VC.db.isBackendReady()
      ? 'Offline training mode — configure Supabase in .env for server-side verification'
      : 'Demo mode — set VC_DEMO_MODE=false for production verification';
    return `<div class="prod-banner">${msg}</div>`;
  },

  appNav() {
    const s = VC.state.seller;
    return `
    ${VC.ui.productionBanner()}
    <nav class="app-nav">
      <div class="app-nav-left">
        <button class="app-logo-btn" onclick="VC.router.go('')">
          <div class="logo-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V6l-8-4z" stroke="#d4af37" stroke-width="1.5" stroke-linejoin="round"></path>
              <path d="M9 12l2 2 4-4" stroke="#f0d78c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
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
          <button class="app-nav-btn" onclick="VC.router.go('analytics')">Analytics</button>
          <button class="app-nav-btn" onclick="VC.router.go('fraud')">Fraud</button>
          <button class="app-nav-btn" onclick="VC.router.go('trust')">Trust</button>
          <button class="app-nav-btn" onclick="VC.router.go('settings')">Settings</button>
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
  pageHeader(title, subtitle) {
    return `
    <div class="page-header">
      <h1 class="page-header-title">${title}</h1>
      ${subtitle ? `<p class="page-header-sub">${subtitle}</p>` : ''}
    </div>`;
  },

  policyBadge(batch) {
    const policy = batch.scan_policy || 'limited';
    const max = batch.max_scans_per_unit ?? 3;
    const cls = policy === 'single' ? 'policy-single' : policy === 'limited' ? 'policy-limited' : 'policy-unlimited';
    const label = VC.crypto.scanPolicyLabel(policy, max);
    return `<span class="policy-pill ${cls}">${label}</span>`;
  },

  trustMeter(score) {
    const s = Math.min(100, Math.max(0, score || 95));
    const color = s >= 90 ? 'var(--green)' : s >= 75 ? 'var(--gold)' : 'var(--red)';
    return `
    <div class="trust-meter">
      <div class="trust-meter-head">
        <span>Trust Score</span>
        <strong style="color:${color}">${s}%</strong>
      </div>
      <div class="trust-meter-track"><div class="trust-meter-fill" style="width:${s}%;background:${color}"></div></div>
    </div>`;
  },

  batchCard(batch) {
    const scansForBatch = VC.state.scans.filter((s) => s.batchId === batch.id);
    const flagged = scansForBatch.filter((s) => s.flagged).length;
    const theme = VC.crypto.getCategoryTheme(batch.category);
    const st = batch.status || 'active';
    const statusCls = st === 'active' ? (flagged > 0 ? 'status-warn' : 'status-ok') : st === 'recalled' ? 'status-warn' : 'status-pause';
    const statusTxt = st === 'recalled' ? '⊘ RECALLED' : st === 'suspended' ? '⏸ PAUSED' : flagged > 0 ? '⚠ ALERT' : '✓ ACTIVE';
    return `
    <div class="batch-card batch-card--${batch.category || 'custom'}" onclick="VC.router.go('batch/${batch.id}')">
      <div class="batch-card-accent" style="background:${theme.gradient}"></div>
      <div class="batch-card-header">
        <div>
          <div class="batch-id">${batch.id}</div>
          <div class="batch-name">${theme.icon} ${batch.product}</div>
        </div>
        <div class="batch-status ${statusCls}">
          ${statusTxt}
        </div>
      </div>
      <div class="batch-meta">
        <span>📍 ${batch.origin}</span>
        <span>📦 ${batch.units} units</span>
        <span>🔍 ${scansForBatch.length} scans</span>
        ${VC.ui.policyBadge(batch)}
      </div>
      <div class="batch-actions" onclick="event.stopPropagation()">
        <button class="batch-btn" onclick="VC.views.showQRSheet('${batch.id}')">📱 QR Sheet</button>
        <button class="batch-btn" onclick="VC.router.go('batch/${batch.id}')">⚙ Manage</button>
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
  generateQR(container, url, options = {}) {
    container.innerHTML = '';
    const size = Number(container?.dataset?.qrSize || options.size || 180);
    const theme = options.theme || VC.crypto.getCategoryTheme(options.category || 'custom');
    container.style.background = '#ffffff';
    container.style.padding = '8px';
    container.style.borderRadius = '10px';
    container.style.display = 'inline-block';
    if (options.accentBorder) {
      container.style.boxShadow = `0 0 0 2px ${theme.accent}40, 0 8px 24px rgba(0,0,0,.25)`;
    }
    const baseOptions = {
      text: url,
      width: size,
      height: size,
      colorDark: options.colorDark || theme.colorDark,
      colorLight: '#ffffff',
      quietZone: 8,
      typeNumber: 0
    };
    try {
      new QRCode(container, {
        ...baseOptions,
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (errMedium) {
      try {
        // Fallback for very long payloads that cannot fit at level M.
        new QRCode(container, {
          ...baseOptions,
          correctLevel: QRCode.CorrectLevel.L
        });
      } catch (errLow) {
        throw new Error('QR payload too large to encode. Reduce URL/token size.');
      }
    }
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
  },

  renderQRSheet(gridEl, batch, tokens, options = {}) {
    if (!gridEl) return;
    const category = batch.category || 'custom';
    const theme = VC.crypto.getCategoryTheme(category);
    const units = batch.units || tokens.length;
    const policy = batch.scan_policy || 'limited';
    const maxScans = batch.max_scans_per_unit ?? 3;
    gridEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'qr-sheet-meta';
    header.innerHTML = `
      <div class="qr-sheet-meta-left">
        <span class="qr-sheet-cat" style="background:${theme.gradient}">${theme.icon} ${theme.label}</span>
        <h3>${batch.product}</h3>
        <p class="mono">${batch.id}</p>
      </div>
      <div class="qr-sheet-meta-right">
        ${VC.ui.policyBadge(batch)}
        <span class="qr-sheet-count">${units} unique tags · each cryptographically distinct</span>
      </div>`;
    gridEl.appendChild(header);

    const list = document.createElement('div');
    list.className = 'qr-grid-inner';
    const showAll = options.showAll !== false;

    tokens.forEach((t, idx) => {
      const i = t.unit ?? t.unit_number ?? idx + 1;
      const tokenStr = t.token || '';
      const fp = t.fingerprint || (t.jti ? VC.crypto.shortFingerprint(t.jti) : `U${String(i).padStart(4, '0')}`);
      const url = VC.crypto.buildVerifyUrl(tokenStr);

      const cell = document.createElement('div');
      cell.className = `qr-cell qr-cell--${category}`;
      cell.dataset.unit = String(i);

      const frame = document.createElement('div');
      frame.className = 'qr-cell-frame';
      frame.style.borderColor = `${theme.accent}55`;

      const top = document.createElement('div');
      top.className = 'qr-cell-top';
      top.innerHTML = `<span class="qr-cell-icon">${theme.icon}</span><span class="qr-fingerprint mono">${fp}</span>`;

      const qrDiv = document.createElement('div');
      qrDiv.dataset.qrSize = options.qrSize || '140';
      VC.ui.generateQR(qrDiv, url, { category, accentBorder: true });

      const brand = document.createElement('div');
      brand.className = 'qr-cell-brand';
      brand.textContent = 'VERIFYCHAIN · AUTHENTIC';

      frame.appendChild(top);
      frame.appendChild(qrDiv);
      frame.appendChild(brand);

      const unitEl = document.createElement('div');
      unitEl.className = 'qr-cell-unit';
      unitEl.textContent = `Unit ${i} of ${units}`;

      const policyEl = document.createElement('div');
      policyEl.className = 'qr-cell-policy';
      policyEl.textContent = VC.crypto.scanPolicyLabel(policy, maxScans);

      const productEl = document.createElement('div');
      productEl.className = 'qr-cell-product';
      productEl.textContent = batch.product;

      cell.appendChild(frame);
      cell.appendChild(unitEl);
      cell.appendChild(policyEl);
      cell.appendChild(productEl);
      list.appendChild(cell);
    });

    gridEl.appendChild(list);

    if (!showAll && units > tokens.length) {
      const note = document.createElement('div');
      note.className = 'qr-overflow-note';
      note.textContent = `Showing ${tokens.length} of ${units} tags.`;
      gridEl.appendChild(note);
    }
  }
};
