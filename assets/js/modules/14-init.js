/* MODULE: INIT */
VC.views.restoreLandingEffects = function() {
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    if (!nav) return;
    nav.style.borderBottomColor = window.scrollY > 40 ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.06)';
  }, { passive: true });
};

document.addEventListener('DOMContentLoaded', async () => {
  await VC.loadRuntimeConfig();

  // Landing interactions (preserved)
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  reveals.forEach((el) => observer.observe(el));

  document.querySelectorAll('.feat-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });

  const fraudFill = document.querySelector('.fraud-fill');
  if (fraudFill) {
    setTimeout(() => {
      fraudFill.style.transition = 'width 1.5s ease';
      fraudFill.style.width = '12%';
    }, 800);
  }

  document.querySelectorAll('.scan-detail-row').forEach((row, i) => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(-8px)';
    row.style.transition = `opacity .4s ${0.5 + i * 0.12}s ease, transform .4s ${0.5 + i * 0.12}s ease`;
    setTimeout(() => {
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    }, 200);
  });

  VC.state.load();
  try {
    const seller = await VC.db.restoreSession();
    if (seller) VC.state.seller = seller;
  } catch (e) {
    console.warn('Session restore failed:', e.message);
  }
  VC.router.init();
  VC.views.restoreLandingEffects();

  if (VC.state.seller) {
    VC.db.subscribeToFraudAlerts(() => {
      if (location.hash === '#/fraud') VC.views.fraud();
    });
  }

  window.verifychain = {
    goSeller: () => VC.router.go('seller'),
    goVerify: () => VC.router.go('scan'),
    goFraud: () => VC.router.go('fraud'),
    goScan: () => VC.router.go('scan'),
    goAnalytics: () => VC.router.go('analytics'),
    goTrust: () => VC.router.go('trust'),
    goSettings: () => VC.router.go('settings'),
    reset: () => { localStorage.clear(); location.reload(); }
  };
  console.log('%cVerifyChain', 'font-size:1.2rem;font-weight:bold;color:#d4af37');
  console.log(
    VC.config.productionReady
      ? 'Production verification: ON (server HMAC)'
      : 'Training mode: configure .env + VC_DEMO_MODE=false for production'
  );
  console.log('Nav: verifychain.goSeller() | verifychain.goVerify() | verifychain.goFraud()');
});
