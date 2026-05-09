/* MODULE: CRYPTO */
VC.crypto = {
  generateBatchId() {
    const year = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    return `VC-${year}-${num}`;
  },
  async generateSecret() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  },
  async sign(data, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  },
  async encodeToken(payload, secret) {
    const data = JSON.stringify(payload);
    const sig = await this.sign(data, secret);
    const full = JSON.stringify({ ...payload, sig });
    return btoa(full).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },
  buildVerifyUrl(token) {
    return `${window.location.origin}${window.location.pathname}#/verify/${token}`;
  },
  async generateBatchTokens(batch) {
    const tokens = [];
    for (let unit = 1; unit <= batch.units; unit += 1) {
      const payload = {
        bid: batch.id,
        uid: unit,
        pid: batch.category,
        ts: Date.now()
      };
      const token = await this.encodeToken(payload, batch.hmac_secret);
      tokens.push({ unit, token });
    }
    return tokens;
  }
};
