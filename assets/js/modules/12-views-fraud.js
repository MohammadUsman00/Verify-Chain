/* MODULE: VIEW - FRAUD */
VC.views.fraud = async function() {
  document.getElementById('app-breadcrumb').innerHTML = '/ Fraud Monitor';
  try {
    await VC.db.getScans();
  } catch (e) {
    console.warn('Fraud fetch error', e);
  }
  const scans = VC.state.scans;
  const flagged = scans.filter((s) => s.flagged);
  const riskLevel = flagged.length === 0 ? 'LOW' : flagged.length <= 2 ? 'MEDIUM' : 'HIGH';
  const riskColor = { LOW: 'var(--green)', MEDIUM: 'var(--gold)', HIGH: 'var(--red)' }[riskLevel];
  document.getElementById('app-view').innerHTML = `
    <div class="fraud-dashboard">
      <div class="fraud-header">
        <div><div class="fraud-eyebrow">// AI FRAUD MONITOR</div><h1>Fraud Detection</h1></div>
        <button class="btn-primary" onclick="VC.views.runAIAnalysis()" id="ai-btn">⚡ Run AI Analysis</button>
      </div>
      <div class="risk-meter-card">
        <div class="risk-label">OVERALL RISK LEVEL</div>
        <div class="risk-level" style="color:${riskColor}">${riskLevel}</div>
        <div class="risk-bar-track"><div class="risk-bar-fill" style="width:${riskLevel === 'LOW' ? '12%' : riskLevel === 'MEDIUM' ? '45%' : '85%'};background:${riskColor}"></div></div>
        <div class="risk-meta">${flagged.length} flagged scans out of ${scans.length} total</div>
      </div>
      <div class="fraud-section">
        <div class="fraud-section-title">⚠ Flagged Scans</div>
        ${flagged.length === 0
          ? '<div class="empty-state-sm">No suspicious activity detected</div>'
          : flagged.map((sc) => `
            <div class="fraud-scan-row">
              <div class="fraud-scan-icon">⚠</div>
              <div><div class="fraud-scan-batch">${sc.batchId}</div><div class="fraud-scan-detail">📍 ${sc.location} · ${sc.device} · ${VC.ui.relTime(sc.ts)}</div></div>
              <div class="fraud-scan-badge">FLAGGED</div>
            </div>
          `).join('')
        }
      </div>
      <div class="fraud-section">
        <div class="fraud-section-title">📋 Full Scan Log</div>
        ${scans.map((sc) => `
          <div class="scan-log-row ${sc.flagged ? 'scan-log-flagged' : ''}">
            <div class="scan-log-status">${sc.flagged ? '⚠' : '✓'}</div>
            <div class="scan-log-batch mono">${sc.batchId}</div>
            <div class="scan-log-loc">${sc.location}</div>
            <div class="scan-log-device">${sc.device}</div>
            <div class="scan-log-time">${VC.ui.relTime(sc.ts)}</div>
          </div>
        `).join('')}
      </div>
      <div id="ai-result-section" style="display:none">
        <div class="fraud-section-title">🤖 Claude AI Analysis</div>
        <div id="ai-result-content"></div>
      </div>
    </div>`;
};

VC.views.runAIAnalysis = async function() {
  const btn = document.getElementById('ai-btn');
  btn.textContent = '⚙ Analyzing...';
  btn.disabled = true;

  const result = await VC.ai.analyzeFraud(VC.state.scans);
  const section = document.getElementById('ai-result-section');
  const content = document.getElementById('ai-result-content');
  const riskColor = { low: 'var(--green)', medium: 'var(--gold)', high: 'var(--red)', critical: 'var(--red)' };

  content.innerHTML = `
    <div class="ai-result-card">
      <div class="ai-result-header">
        <div class="ai-risk" style="color:${riskColor[result.riskLevel] || 'var(--cyan)'}">RISK: ${result.riskLevel?.toUpperCase()}</div>
        <div class="ai-summary">${result.summary}</div>
      </div>
      <div class="ai-stats-row">
        <div class="ai-stat"><span>${result.legitimateScans}</span> Legitimate</div>
        <div class="ai-stat ai-stat-warn"><span>${result.suspiciousScans}</span> Suspicious</div>
      </div>
      <div class="ai-alerts">
        ${(result.alerts || []).map((alert) => `
          <div class="ai-alert ai-alert-${alert.severity}">
            <div class="ai-alert-type">${alert.type}</div>
            <div class="ai-alert-desc">${alert.description}</div>
            <div class="ai-alert-rec">→ ${alert.recommendation}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth' });
  btn.textContent = '✓ Analysis Complete';
};
