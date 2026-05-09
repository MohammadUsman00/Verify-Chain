/* MODULE: AI */
VC.ai = {
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
    try {
      const response = await fetch('/api/ai/fraud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scanLog
        })
      });

      if (!response.ok) return localResult;
      const data = await response.json();
      if (!data || !data.riskLevel) return localResult;
      return data;
    } catch (err) {
      console.warn('AI service unavailable, using free rule engine', err);
      return localResult;
    }
  }
};
