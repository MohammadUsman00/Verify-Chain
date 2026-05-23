/* MODULE: CRYPTO */
VC.crypto = {
  CATEGORY_THEMES: {
    saffron: { icon: '🌸', label: 'Saffron', colorDark: '#8B4513', accent: '#f0b429', gradient: 'linear-gradient(135deg,#8B4513,#f0b429)' },
    pashmina: { icon: '🧣', label: 'Pashmina', colorDark: '#4a1942', accent: '#e879f9', gradient: 'linear-gradient(135deg,#4a1942,#e879f9)' },
    carpet: { icon: '🕌', label: 'Carpet', colorDark: '#1e3a5f', accent: '#c9a227', gradient: 'linear-gradient(135deg,#1e3a5f,#d4af37)' },
    walnut: { icon: '🪵', label: 'Walnut', colorDark: '#3d2914', accent: '#d4a574', gradient: 'linear-gradient(135deg,#3d2914,#d4a574)' },
    honey: { icon: '🍯', label: 'Honey', colorDark: '#5c3d00', accent: '#ffc107', gradient: 'linear-gradient(135deg,#5c3d00,#ffc107)' },
    custom: { icon: '✦', label: 'Verified', colorDark: '#1a0f2e', accent: '#d4af37', gradient: 'linear-gradient(135deg,#1a0f2e,#d4af37)' }
  },

  getCategoryTheme(category) {
    return this.CATEGORY_THEMES[category] || this.CATEGORY_THEMES.custom;
  },

  generateBatchId() {
    const year = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    return `VC-${year}-${num}`;
  },

  generateTokenId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  generateNonce() {
    const arr = new Uint8Array(4);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async generateSecret() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  shortFingerprint(jti) {
    return String(jti || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  },

  scanPolicyLabel(policy, maxScans) {
    if (policy === 'single') return 'One-time seal';
    if (policy === 'limited') return `Limited · ${maxScans} scans/unit`;
    return 'Unlimited verifications';
  },

  canonicalPayload(payload) {
    const { sig, ...rest } = payload;
    return JSON.stringify(rest);
  },

  async verifyToken(token, secret) {
    const payload = this.decodeTokenPayload(token);
    if (!payload || !payload.sig || !secret) {
      return { valid: false, reason: 'INVALID_TOKEN', payload };
    }
    const expected = await this.sign(this.canonicalPayload(payload), secret);
    if (expected.length !== payload.sig.length) {
      return { valid: false, reason: 'INVALID_SIGNATURE', payload };
    }
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) {
      diff |= expected.charCodeAt(i) ^ payload.sig.charCodeAt(i);
    }
    return {
      valid: diff === 0,
      reason: diff === 0 ? null : 'INVALID_SIGNATURE',
      payload
    };
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

  decodeTokenPayload(token) {
    try {
      const padded = token.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  },

  buildVerifyUrl(token) {
    return `${window.location.origin}${window.location.pathname}#/verify/${token}`;
  },

  async generateBatchTokens(batch) {
    const tokens = [];
    for (let unit = 1; unit <= batch.units; unit += 1) {
      const jti = this.generateTokenId();
      const payload = {
        bid: batch.id,
        uid: unit,
        pid: batch.category,
        jti,
        n: this.generateNonce(),
        ts: Date.now()
      };
      const token = await this.encodeToken(payload, batch.hmac_secret);
      tokens.push({
        unit,
        token,
        jti,
        fingerprint: this.shortFingerprint(jti)
      });
    }
    return tokens;
  }
};
