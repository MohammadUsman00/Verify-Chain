/* MODULE: CONFIG */
const VC = {};
VC.config = {
  supabaseUrl: 'YOUR_SUPABASE_PROJECT_URL',
  supabaseKey: 'YOUR_SUPABASE_ANON_KEY',
  edgeFunctionUrl: 'YOUR_SUPABASE_PROJECT_URL/functions/v1/verify-qr',
  claudeApiKey: 'YOUR_CLAUDE_API_KEY',
  appVersion: '1.0.0',
  demoMode: false
};
VC.supabase = supabase.createClient(VC.config.supabaseUrl, VC.config.supabaseKey);
