/* MODULE: VIEW - ANALYTICS */
VC.views = VC.views || {};

VC.views.analytics = async function() {
  document.getElementById('app-breadcrumb').innerHTML = '/ Analytics';
  try {
    await VC.db.getBatches();
    await VC.db.getScans();
  } catch (e) {
    console.warn('Analytics fetch error', e);
  }

  const a = VC.db.getAnalytics();
  const maxLoc = Math.max(1, ...(a.topLocations.map((l) => l.count)));
  const maxBatch = Math.max(1, ...(a.topBatches.map((b) => b.count)));
  const catEntries = Object.entries(a.byCategory).sort((x, y) => y[1] - x[1]);
  const maxCat = Math.max(1, ...catEntries.map(([, c]) => c));

  document.getElementById('app-view').innerHTML = `
    <div class="page-shell analytics-page">
      ${VC.ui.pageHeader('Verification Analytics', 'Insights across batches, geography, and scan velocity')}
      <div class="stats-row">
        ${VC.ui.statCard('Total Verifications', a.totalScans, 'all time', 'var(--gold)')}
        ${VC.ui.statCard('Active Batches', a.totalBatches, `${a.totalTags} tags issued`, 'var(--cyan)')}
        ${VC.ui.statCard('Engagement Rate', a.redemptionRate + '%', 'scans per tag issued', 'var(--green)')}
        ${VC.ui.statCard('Flagged Events', a.flaggedScans, a.flaggedScans ? 'review in Fraud Monitor' : 'all clear', a.flaggedScans ? 'var(--red)' : 'var(--green)')}
      </div>

      <div class="analytics-grid">
        <div class="analytics-card analytics-card--wide">
          <div class="analytics-card-title">Scan Activity · Last 7 Days</div>
          <div class="bar-chart bar-chart--days">
            ${a.scanTrend.map((d) => `
              <div class="bar-col" title="${d.day}: ${d.count} scans">
                <div class="bar-fill" style="height:${Math.max(4, d.pct)}%"></div>
                <span class="bar-label">${d.label}</span>
                <span class="bar-val">${d.count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="analytics-card">
          <div class="analytics-card-title">Device Mix</div>
          <div class="device-mix">
            ${[
              { key: 'mobile', label: 'Mobile', icon: '📱' },
              { key: 'desktop', label: 'Desktop', icon: '💻' },
              { key: 'other', label: 'Other', icon: '◎' }
            ].map(({ key, label, icon }) => {
              const n = a.byDevice[key] || 0;
              const pct = a.totalScans ? Math.round((n / a.totalScans) * 100) : 0;
              return `
              <div class="device-row">
                <span>${icon} ${label}</span>
                <div class="device-bar-track"><div class="device-bar-fill" style="width:${pct}%"></div></div>
                <span class="mono">${pct}%</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="analytics-card">
          <div class="analytics-card-title">Top Verification Locations</div>
          ${a.topLocations.length ? a.topLocations.map((l) => `
            <div class="rank-row">
              <span class="rank-loc">📍 ${l.name}</span>
              <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${Math.round((l.count / maxLoc) * 100)}%"></div></div>
              <span class="rank-count mono">${l.count}</span>
            </div>
          `).join('') : '<div class="empty-state-sm">No scan locations yet</div>'}
        </div>

        <div class="analytics-card">
          <div class="analytics-card-title">Scans by Category</div>
          ${catEntries.length ? catEntries.map(([cat, count]) => {
            const theme = VC.crypto.getCategoryTheme(cat);
            return `
            <div class="rank-row">
              <span class="rank-loc">${theme.icon} ${theme.label}</span>
              <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${Math.round((count / maxCat) * 100)}%;background:${theme.accent}"></div></div>
              <span class="rank-count mono">${count}</span>
            </div>`;
          }).join('') : '<div class="empty-state-sm">No category data yet</div>'}
        </div>

        <div class="analytics-card analytics-card--wide">
          <div class="analytics-card-title">Top Performing Batches</div>
          ${a.topBatches.length ? a.topBatches.map((b) => `
            <div class="rank-row rank-row--click" onclick="VC.router.go('batch/${b.id}')">
              <span class="rank-loc mono">${b.id}</span>
              <span class="rank-product">${b.product}</span>
              <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${Math.round((b.count / maxBatch) * 100)}%"></div></div>
              <span class="rank-count mono">${b.count}</span>
            </div>
          `).join('') : '<div class="empty-state-sm">Register a batch to see performance</div>'}
        </div>
      </div>
    </div>`;
};
