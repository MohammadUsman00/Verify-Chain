/* MODULE: VIEW - TRUST CENTER (public) */
VC.views = VC.views || {};

VC.views.trust = function() {
  document.getElementById('app-breadcrumb').innerHTML = '/ Trust Center';
  document.getElementById('app-view').innerHTML = `
    <div class="page-shell trust-page">
      ${VC.ui.pageHeader('Trust Center', 'How VerifyChain protects buyers and sellers')}
      <div class="trust-hero-card">
        <div class="trust-hero-icon">🛡</div>
        <h2>Cryptographic product identity for the physical world</h2>
        <p>Every unit receives a unique, HMAC-sealed QR. Scan with any phone — no app required — and receive an instant authenticity certificate.</p>
      </div>

      <div class="trust-steps">
        ${[
          { n: '01', title: 'Mint Unique Tags', desc: 'Seller registers a batch. Each unit gets a globally unique token (UUID + nonce) signed with HMAC-SHA256.' },
          { n: '02', title: 'Print & Attach', desc: 'Category-themed QR sheets are printed and applied to physical products at packaging.' },
          { n: '03', title: 'Buyer Scans', desc: 'Consumer scans the QR. Geo and device metadata are captured for fraud intelligence.' },
          { n: '04', title: 'Server Verification', desc: 'Edge function validates signature, registry entry, scan policy, and batch status in under 2 seconds.' }
        ].map((s) => `
          <div class="trust-step-card">
            <div class="trust-step-num mono">${s.n}</div>
            <h3>${s.title}</h3>
            <p>${s.desc}</p>
          </div>
        `).join('')}
      </div>

      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-card-title">Scan Policies</div>
          <ul class="trust-list">
            <li><strong>One-Time Seal</strong> — First scan authenticates; duplicates blocked.</li>
            <li><strong>Limited Scans</strong> — Configurable verifications per tag.</li>
            <li><strong>Unlimited</strong> — Open checks for display and education.</li>
          </ul>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-title">Fraud Intelligence</div>
          <ul class="trust-list">
            <li>Geographic impossibility detection</li>
            <li>Abnormal scan velocity alerts</li>
            <li>Invalid signature → counterfeit flag</li>
            <li>AI-assisted pattern analysis (seller dashboard)</li>
          </ul>
        </div>
        <div class="analytics-card analytics-card--wide">
          <div class="analytics-card-title">EU Digital Product Passport Ready</div>
          <p class="trust-body">Export structured JSON passports per batch — product metadata, supply chain, unit fingerprints, and compliance fields — aligned with upcoming EU traceability requirements.</p>
          <button class="btn-primary" onclick="VC.router.go('scan')">Try Live Scan →</button>
        </div>
      </div>
    </div>`;
};
