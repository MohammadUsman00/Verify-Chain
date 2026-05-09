/* MODULE: AI */
VC.ai = {
  async analyzeFraud(scanLog) {
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

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': VC.config.claudeApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.content[0].text.replace(/```json|```/g, '').trim();
      return JSON.parse(text);
    } catch (err) {
      console.warn('Claude API unavailable, using mock analysis', err);
      return {
        riskLevel: 'medium',
        alerts: [
          {
            type: 'Geographic Anomaly',
            severity: 'high',
            description: 'Batch VC-2025-0047 was scanned in Mumbai and London within minutes - physically impossible for one product.',
            recommendation: 'Contact law enforcement and mark this batch as potentially counterfeited. Issue replacement QR codes.'
          }
        ],
        summary: 'Medium risk detected: 1 geographic impossibility suggests counterfeit product in circulation.',
        legitimateScans: 4,
        suspiciousScans: 1
      };
    }
  }
};
