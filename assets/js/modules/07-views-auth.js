/* MODULE: VIEW - AUTH */
VC.views = VC.views || {};
VC.views.auth = function(mode = 'login') {
  document.getElementById('app-view').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">Verify<span>Chain</span></div>
        <div class="auth-title">${mode === 'login' ? 'Seller Sign In' : 'Register Your Business'}</div>
        <div id="auth-error" class="auth-error" style="display:none"></div>
        ${mode === 'register' ? `
        <div class="form-group"><label>Your Name</label><input type="text" id="a-name" class="vc-input" placeholder="Aadil Wani"/></div>
        <div class="form-group"><label>Business Name</label><input type="text" id="a-biz" class="vc-input" placeholder="Wani Premium Exports"/></div>
        <div class="form-group"><label>Location</label><input type="text" id="a-loc" class="vc-input" value="Kashmir, India"/></div>
        ` : ''}
        <div class="form-group"><label>Email</label><input type="email" id="a-email" class="vc-input" placeholder="you@example.com"/></div>
        <div class="form-group"><label>Password</label><input type="password" id="a-pass" class="vc-input" placeholder="••••••••"/></div>
        <button class="btn-primary btn-full" id="auth-submit-btn" onclick="VC.views.submitAuth('${mode}')">
          ${mode === 'login' ? 'Sign In →' : 'Create Account →'}
        </button>
        <div class="auth-switch">
          ${mode === 'login'
            ? `No account? <a href="#" onclick="VC.views.auth('register');return false">Register →</a>`
            : `Have an account? <a href="#" onclick="VC.views.auth('login');return false">Sign In →</a>`
          }
        </div>
        <div class="auth-demo-note"><span>Demo: </span><a href="#" onclick="VC.views.demoLogin();return false">Skip login (use demo data)</a></div>
      </div>
    </div>
  `;
};

VC.views.submitAuth = async function(mode) {
  const btn = document.getElementById('auth-submit-btn');
  const errDiv = document.getElementById('auth-error');
  const email = document.getElementById('a-email').value.trim();
  const pass = document.getElementById('a-pass').value;

  btn.textContent = 'Please wait...';
  btn.disabled = true;
  errDiv.style.display = 'none';

  try {
    if (mode === 'register') {
      await VC.db.signUp(email, pass, {
        name: document.getElementById('a-name').value.trim(),
        businessName: document.getElementById('a-biz').value.trim(),
        location: document.getElementById('a-loc').value.trim()
      });
      if (!VC.config.demoMode) await VC.db.seedDemo();
    } else {
      await VC.db.signIn(email, pass);
    }
    VC.ui.toast('✓ Welcome to VerifyChain', 'success');
    VC.router.go('seller');
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.style.display = 'block';
    btn.textContent = mode === 'login' ? 'Sign In →' : 'Create Account →';
    btn.disabled = false;
  }
};

VC.views.demoLogin = function() {
  VC.state.seller = {
    id: 'demo-seller-001',
    name: 'Aadil Wani',
    business_name: 'Wani Premium Exports',
    email: 'demo@verifychain.in',
    location: 'Pampore, Pulwama, Kashmir',
    plan: 'pro',
    verified: true,
    total_tags_issued: 62
  };
  VC.state.batches = [
    {
      id: 'VC-2025-0047',
      product: 'Kashmiri Saffron Grade A',
      category: 'saffron',
      origin: 'Pampore, Pulwama District, J&K',
      farm: 'Wani Family Farm (Est. 1962)',
      harvest_date: 'October 2025',
      units: 50,
      cert_number: 'KVIB-K-2025-7821',
      supply_chain: ['Wani Family Farm - Pampore', 'KVIB Certification Lab', 'Wani Premium Exports Processing', 'Verified Seller']
    }
  ];
  VC.state.scans = [
    { id: '1', batchId: 'VC-2025-0047', ts: Date.now() - 3600000, location: 'Mumbai, MH', device: 'mobile', flagged: false },
    { id: '2', batchId: 'VC-2025-0047', ts: Date.now() - 7200000, location: 'London, UK', device: 'desktop', flagged: true }
  ];
  VC.state.save();
  VC.ui.toast('Demo mode active', 'info');
  VC.router.go('seller');
};
