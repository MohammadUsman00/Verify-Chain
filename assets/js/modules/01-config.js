/* MODULE: CONFIG */
const VC = {};
VC.config = {
  supabaseUrl: '',
  supabaseKey: '',
  edgeFunctionUrl: '',
  appVersion: '1.0.0',
  demoMode: true
};

VC.supabase = null;

VC.initSupabase = function() {
  if (!VC.config.supabaseUrl || !VC.config.supabaseKey) {
    VC.supabase = null;
    return;
  }
  VC.supabase = supabase.createClient(VC.config.supabaseUrl, VC.config.supabaseKey);
};

VC.loadRuntimeConfig = async function() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return;
    const runtime = await response.json();
    VC.config = {
      ...VC.config,
      ...runtime
    };
    VC.initSupabase();
  } catch (err) {
    console.warn('Runtime config unavailable, using local defaults', err);
  }
};
