import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error('index.html is missing');
}
if (!fs.existsSync(path.join(root, 'server.js'))) {
  throw new Error('server.js is missing');
}
if (!fs.existsSync(path.join(root, '.env.example'))) {
  throw new Error('.env.example is missing');
}

const requiredModules = [
  'assets/js/modules/01-config.js',
  'assets/js/modules/02-crypto.js',
  'assets/js/modules/03-state.js',
  'assets/js/modules/04-db.js',
  'assets/js/modules/05-router.js',
  'assets/js/modules/06-ui.js',
  'assets/js/modules/07-views-auth.js',
  'assets/js/modules/08-views-seller.js',
  'assets/js/modules/09-views-batch.js',
  'assets/js/modules/10-views-verify.js',
  'assets/js/modules/11-views-scan.js',
  'assets/js/modules/12-views-fraud.js',
  'assets/js/modules/13-ai.js',
  'assets/js/modules/14-init.js'
];

for (const modulePath of requiredModules) {
  const fullPath = path.join(root, modulePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing module: ${modulePath}`);
  }
}

const html = fs.readFileSync(indexPath, 'utf8');
for (const modulePath of requiredModules) {
  if (!html.includes(modulePath)) {
    throw new Error(`index.html is not loading module: ${modulePath}`);
  }
}

if (!html.includes('id="vc-landing"') || !html.includes('id="vc-app"')) {
  throw new Error('App shell containers are missing from index.html');
}

console.log('Smoke checks passed');
