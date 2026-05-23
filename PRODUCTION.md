# VerifyChain — Production Deployment

## What “production ready” means

- Each QR is **HMAC-SHA256 signed** with a per-batch secret (never sent to buyers).
- Verification runs on the **`verify-qr` edge function** (not the browser) when `VC_DEMO_MODE=false`.
- Tokens must exist in **`qr_tokens`** (registry enforcement).
- Scan policies (**one-time**, **limited**, **unlimited**) are enforced server-side.
- `hmac_secret` is **not** returned to the seller dashboard API (stripped client-side).

QR payloads are **signed, not encrypted** — anyone can Base64-decode them, but cannot forge a valid signature.

---

## 1. Environment (`.env`)

```env
PORT=4173
VC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VC_SUPABASE_ANON_KEY=your_anon_key
VC_EDGE_FUNCTION_URL=https://YOUR_PROJECT.supabase.co/functions/v1/verify-qr
VC_DEMO_MODE=false
VC_APP_VERSION=1.0.0
```

Optional: `VC_GEMINI_API_KEY` for AI fraud enrichment.

---

## 2. Supabase SQL (run in order)

1. [`supabase/schema.sql`](supabase/schema.sql) — fresh project
2. [`supabase/migrations/002_scan_policy_and_tokens.sql`](supabase/migrations/002_scan_policy_and_tokens.sql) — existing DB
3. [`supabase/migrations/003_atomic_qr_claim.sql`](supabase/migrations/003_atomic_qr_claim.sql) — one-time scan race protection

---

## 3. Edge function secrets

In Supabase Dashboard → Edge Functions → `verify-qr` → Secrets:

| Secret | Value |
|--------|--------|
| `VC_SB_URL` | Same as `VC_SUPABASE_URL` |
| `VC_SB_SERVICE_ROLE_KEY` | Service role key (never expose to browser) |

Deploy:

```bash
supabase functions deploy verify-qr
```

---

## 4. Run the app

```bash
npm install
npm start
```

Open `http://localhost:4173/api/config` — expect:

```json
{
  "demoMode": false,
  "productionReady": true,
  "supabaseUrl": "https://...",
  "edgeFunctionUrl": "https://.../functions/v1/verify-qr"
}
```

Green banner in the app: **Production verification active**.

---

## 5. Smoke tests

```bash
node tests/smoke.mjs
node tests/crypto.test.mjs
```

---

## 6. End-to-end test

1. Register / sign in as seller (real Supabase auth).
2. Create a batch with **One-Time Seal** and 1 unit.
3. Print QR → scan → certificate should show **Server-verified HMAC**.
4. Scan the same QR again → **ALREADY REDEEMED**.
5. Edit token in DevTools (change `uid`) → **INVALID_SIGNATURE** or **UNKNOWN_TOKEN**.

---

## Offline training mode

- No Supabase: `VC_DEMO_MODE` defaults to `true`.
- Use **Offline mode** on login — mints a local batch with real HMAC + registry.
- Verification uses **local crypto** (same rules, stored in localStorage).

This is for UI demos only — not for real anti-counterfeit deployment.
