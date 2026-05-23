/**
 * Cryptographic round-trip tests (Node 18+ with Web Crypto)
 */
import assert from 'node:assert/strict';

const enc = new TextEncoder();

async function sign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function encodeToken(payload, secret) {
  const data = JSON.stringify(payload);
  return sign(data, secret).then((sig) => {
    const full = JSON.stringify({ ...payload, sig });
    return Buffer.from(full).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  });
}

function decodeToken(token) {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

async function verifyToken(token, secret) {
  const payload = decodeToken(token);
  const { sig, ...rest } = payload;
  const expected = await sign(JSON.stringify(rest), secret);
  return expected === sig;
}

const secret = 'a'.repeat(64);
const payload = {
  bid: 'VC-2026-9999',
  uid: 1,
  pid: 'saffron',
  jti: '11111111-2222-4333-8444-555555555555',
  n: 'deadbeef',
  ts: Date.now()
};

const token = await encodeToken(payload, secret);
assert.ok(await verifyToken(token, secret), 'valid token should verify');

const bad = decodeToken(token);
bad.uid = 99;
const tampered = await encodeToken(
  { bid: bad.bid, uid: bad.uid, pid: bad.pid, jti: bad.jti, n: bad.n, ts: bad.ts },
  secret
);
assert.ok(await verifyToken(tampered, secret), 're-signed tampered payload verifies with secret');

const forged = decodeToken(token);
forged.sig = '0'.repeat(forged.sig.length);
const forgedStr = Buffer.from(JSON.stringify(forged)).toString('base64url');
assert.equal(await verifyToken(forgedStr, secret), false, 'forged sig must fail');

console.log('Crypto tests passed');
