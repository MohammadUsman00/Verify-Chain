/* MODULE: AI */
VC.ai = {
  hasGeminiKey() {
    const key = VC.config.geminiApiKey || '';
    return Boolean(key && !key.includes('YOUR_GEMINI_API_KEY'));
  },

  haversineKm(aLat, aLng, bLat, bLng) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },

  ruleBasedAnalysis(scanLog) {
    const alerts = [];
    let suspicious = 0;
    const scans = [...(scanLog || [])].sort((a, b) => (a.ts || 0) - (b.ts || 0));

    // High volume per batch in one hour
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
          recommendation: 'Investigate distribution channel and consider rotating QR tokens for this batch.'
        });
      }
    }

    // Geographic impossibility check (if lat/lng available)
    for (let i = 1; i < scans.length; i += 1) {
      const prev = scans[i - 1];
      const curr = scans[i];
      if (
        prev.batchId === curr.batchId &&
        prev.lat != null && prev.lng != null &&
        curr.lat != null && curr.lng != null
      ) {
        const distance = this.haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
        const mins = Math.abs((curr.ts - prev.ts) / 60000);
        if (mins > 0 && mins < 60 && distance > 500) {
          suspicious += 1;
          alerts.push({
            type: 'Geographic Impossibility',
            severity: 'critical',
            description: `${curr.batchId} appears in two distant locations (${Math.round(distance)}km) within ${Math.round(mins)} minutes.`,
            recommendation: 'Treat as probable counterfeit and issue fresh labels for unsold inventory.'
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
        ? `${suspicious} suspicious pattern(s) detected using free rule-based analysis.`
        : 'No suspicious pattern detected in current scan log.',
      legitimateScans: legitimate,
      suspiciousScans: suspicious
    };
  },

  async analyzeFraud(scanLog) {
    const localResult = this.ruleBasedAnalysis(scanLog);

    // Free, no-key path: return local intelligence directly.
    if (!this.hasGeminiKey()) {
      return localResult;
    }

    try {
      const prompt = `You are VerifyChain's AI fraud detection engine for a product authenticity platform.
Analyze these QR code scan logs and identify counterfeiting patterns.

Scan Log:
${JSON.stringify(scanLog, null, 2)}

Identify:
- Geographic impossibilities (same code scanned in two distant locations within minutes)
- Bulk scanning anomalies (>10 scans in short period = bulk counterfeit testing)
- Suspicious device patterns

Respond ONLY with valid JSON, no markdown:
{
  "riskLevel": "low|medium|high|critical",
  "alerts": [
    {
      "type": "string (short alert name)",
      "severity": "low|medium|high|critical",
      "description": "string (what was detected)",
      "recommendation": "string (what seller should do)"
    }
  ],
  "summary": "one sentence summary",
  "legitimateScans": number,
  "suspiciousScans": number
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(VC.config.geminiApiKey)}`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800
          }
        })
      });

      if (!response.ok) return localResult;
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json|```/g, '').trim();
      if (!text) return localResult;
      return JSON.parse(text);
    } catch (err) {
      console.warn('Gemini unavailable, using free rule engine', err);
      return localResult;
    }
  }
};
