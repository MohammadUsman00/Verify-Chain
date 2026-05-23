-- Scan policies, per-token identity, and safer batch reads
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS scan_policy TEXT NOT NULL DEFAULT 'limited'
    CHECK (scan_policy IN ('unlimited', 'limited', 'single')),
  ADD COLUMN IF NOT EXISTS max_scans_per_unit INTEGER NOT NULL DEFAULT 3;

ALTER TABLE qr_tokens
  ADD COLUMN IF NOT EXISTS token_jti TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_qr_tokens_jti ON qr_tokens(token_jti);

-- Verification uses edge function (service role); sellers read own batches via RLS.
DROP POLICY IF EXISTS batches_public_read ON batches;

COMMENT ON COLUMN batches.scan_policy IS 'unlimited | limited | single (one-time redeem)';
COMMENT ON COLUMN batches.max_scans_per_unit IS 'Max verifications per QR when scan_policy = limited';
