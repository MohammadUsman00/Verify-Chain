/* MODULE: ROUTER */
VC.router = {
  routes: {
    '': () => VC.views.landing(),
    login: () => VC.views.auth('login'),
    register: () => VC.views.auth('register'),
    'seller': () => VC.router.requireAuth(() => VC.views.seller()),
    'batch-new': () => VC.router.requireAuth(() => VC.views.batchNew()),
    'analytics': () => VC.router.requireAuth(() => VC.views.analytics()),
    'settings': () => VC.router.requireAuth(() => VC.views.settings()),
    'trust': () => VC.views.trust(),
    'scan': () => VC.views.scan(),
    'fraud': () => VC.router.requireAuth(() => VC.views.fraud())
  },
  requireAuth(fn) {
    if (!VC.state.seller) {
      VC.ui.toast('Please sign in first', 'error');
      VC.router.go('login');
      return;
    }
    fn();
  },
  init() {
    window.addEventListener('hashchange', () => this.handle());
    this.handle();
  },
  handle() {
    const hash = location.hash.replace('#/', '').split('/');
    const route = hash[0];
    const param = hash[1];

    const app = document.getElementById('vc-app');
    const landing = document.getElementById('vc-landing');
    const navWrap = document.getElementById('app-nav-container');

    if (!route || route === '') {
      app.style.display = 'none';
      landing.style.display = 'block';
      VC.views.restoreLandingEffects();
      return;
    }

    app.style.display = 'block';
    landing.style.display = 'none';
    navWrap.innerHTML = VC.ui.appNav();
    const navEl = navWrap.querySelector('.app-nav');
    if (navEl) navEl.style.display = 'flex';

    if (route === 'verify' && param) {
      VC.views.verify(param);
    } else if (route === 'batch' && param) {
      VC.router.requireAuth(() => VC.views.batchDetailPage(param));
    } else if (this.routes[route]) {
      this.routes[route]();
    } else {
      VC.router.go('');
    }
  },
  go(path) {
    location.hash = '/' + path;
  }
};
