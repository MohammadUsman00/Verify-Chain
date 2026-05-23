const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const dotenv = require('dotenv');
dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.PORT || 4173);

function loadEnvFile() {
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) return {};
    return dotenv.parse(fs.readFileSync(envPath));
  } catch {
    return {};
  }
}

function readEnv(key, fallback = '') {
  const envFile = loadEnvFile();
  if (envFile[key] != null) return envFile[key];
  if (process.env[key] != null) return process.env[key];
  return fallback;
}

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

function parseBool(value, fallback) {
  if (value == null) return fallback;
  return String(value).toLowerCase() === 'true';
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function ruleBasedAnalysis(scanLog) {
  const alerts = [];
  let suspicious = 0;
  const scans = [...(scanLog || [])].sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const byBatch = new Map();
  scans.forEach((s) => {
    const list = byBatch.get(s.batchId) || [];
    list.push(s);
    byBatch.set(s.batchId, list);
  });

  for (const [batchId, list] of byBatch.entries()) {
    const recent = list.filter((s) => Date.now() - (s.ts || Date.now()) < 3600000);
    if (recent.length > 15) {
      suspicious += 1;
      alerts.push({
        type: 'High Volume Scanning',
        severity: 'high',
        description: `${recent.length} scans for ${batchId} detected in the last hour.`,
        recommendation: 'Investigate distribution channel and rotate QR labels for unsold stock.'
      });
    }
  }

  for (let i = 1; i < scans.length; i += 1) {
    const prev = scans[i - 1];
    const curr = scans[i];
    if (
      prev.batchId === curr.batchId &&
      prev.lat != null && prev.lng != null &&
      curr.lat != null && curr.lng != null
    ) {
      const distance = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
      const mins = Math.abs((curr.ts - prev.ts) / 60000);
      if (mins > 0 && mins < 60 && distance > 500) {
        suspicious += 1;
        alerts.push({
          type: 'Geographic Impossibility',
          severity: 'critical',
          description: `${curr.batchId} appears in distant locations (${Math.round(distance)}km) in ${Math.round(mins)} minutes.`,
          recommendation: 'Treat this as potential counterfeit and block affected batch units.'
        });
      }
    }
  }

  const legitimate = Math.max((scanLog || []).length - suspicious, 0);
  const riskLevel = suspicious >= 3 ? 'high' : suspicious >= 1 ? 'medium' : 'low';
  return {
    riskLevel,
    alerts,
    summary: suspicious
      ? `${suspicious} suspicious pattern(s) detected using fraud analysis engine.`
      : 'No suspicious pattern detected in current scan log.',
    legitimateScans: legitimate,
    suspiciousScans: suspicious,
    mode: 'rule-engine'
  };
}

function getPublicConfig() {
  const supabaseUrl = readEnv('VC_SUPABASE_URL', '');
  const supabaseKey = readEnv('VC_SUPABASE_ANON_KEY', '');
  const edgeFunctionUrl = readEnv('VC_EDGE_FUNCTION_URL', '') ||
    (supabaseUrl ? `${supabaseUrl}/functions/v1/verify-qr` : '');
  const hasBackend = Boolean(
    supabaseUrl &&
    supabaseKey &&
    edgeFunctionUrl &&
    /^https?:\/\//i.test(supabaseUrl) &&
    /^https?:\/\//i.test(edgeFunctionUrl)
  );
  const demoMode = hasBackend
    ? parseBool(readEnv('VC_DEMO_MODE', 'false'), false)
    : parseBool(readEnv('VC_DEMO_MODE', 'true'), true);

  return {
    supabaseUrl,
    supabaseKey,
    edgeFunctionUrl,
    appVersion: readEnv('VC_APP_VERSION', '1.0.0'),
    demoMode,
    productionReady: hasBackend && !demoMode
  };
}

app.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'verifychain-api' });
});

app.get('/api/config', (req, res) => {
  res.json(getPublicConfig());
});

app.post('/api/ai/fraud', async (req, res) => {
  const scanLog = req.body?.scanLog || [];
  const baseline = ruleBasedAnalysis(scanLog);
  const geminiKey = readEnv('VC_GEMINI_API_KEY', '');

  if (!geminiKey) {
    return res.json(baseline);
  }

  const prompt = `You are VerifyChain's AI fraud detection engine.
Analyze these QR scan logs and return strict JSON:
{
  "riskLevel":"low|medium|high|critical",
  "alerts":[{"type":"string","severity":"low|medium|high|critical","description":"string","recommendation":"string"}],
  "summary":"string",
  "legitimateScans":number,
  "suspiciousScans":number
}

Scan Log:
${JSON.stringify(scanLog, null, 2)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800
          }
        })
      }
    );

    if (!response.ok) {
      return res.json(baseline);
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json|```/g, '').trim();
    if (!text) return res.json(baseline);
    const parsed = JSON.parse(text);
    return res.json({
      ...baseline,
      ...parsed,
      mode: 'gemini'
    });
  } catch (err) {
    return res.json(baseline);
  }
});

app.use(express.static(path.resolve(__dirname)));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VerifyChain server running on http://localhost:${PORT}`);
});
