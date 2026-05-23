/* MODULE: STATE */
VC.state = {
  view: 'landing',
  seller: null,
  batches: [],
  scans: [],
  currentBatch: null,
  fraudAnalysis: null,
  tokenScans: {},
  save() {
    localStorage.setItem('vc_state', JSON.stringify({
      seller: this.seller,
      batches: this.batches,
      scans: this.scans,
      tokenScans: this.tokenScans
    }));
  },
  load() {
    const saved = localStorage.getItem('vc_state');
    if (saved) {
      const d = JSON.parse(saved);
      this.seller = d.seller || null;
      this.batches = d.batches || [];
      this.scans = d.scans || [];
      this.tokenScans = d.tokenScans || {};
    }
  }
};
