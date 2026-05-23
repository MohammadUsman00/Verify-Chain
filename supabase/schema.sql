-- VerifyChain Supabase schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  location TEXT DEFAULT 'Kashmir, India',
  phone TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  verified BOOLEAN DEFAULT FALSE,
  gi_registered BOOLEAN DEFAULT FALSE,
  total_tags_issued INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  origin TEXT NOT NULL,
  farm TEXT NOT NULL,
  harvest_date TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  cert_number TEXT,
  supply_chain JSONB DEFAULT '[]'::jsonb,
  hmac_secret TEXT NOT NULL,
  scan_policy TEXT NOT NULL DEFAULT 'limited' CHECK (scan_policy IN ('unlimited', 'limited', 'single')),
  max_scans_per_unit INTEGER NOT NULL DEFAULT 3,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'recalled')),
  scan_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  country TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_display TEXT,
  device_type TEXT,
  user_agent_hash TEXT,
  ip_hash TEXT,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  flag_severity TEXT CHECK (flag_severity IN ('low', 'medium', 'high', 'critical')),
  qr_token TEXT,
  signature_valid BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  seller_id UUID NOT NULL REFERENCES sellers(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  recommendation TEXT,
  scan_ids UUID[],
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  unit_number INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_jti TEXT UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  first_scanned_at TIMESTAMPTZ,
  scan_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_seller ON batches(seller_id);
CREATE INDEX IF NOT EXISTS idx_scans_batch ON scans(batch_id);
CREATE INDEX IF NOT EXISTS idx_scans_seller ON scans(seller_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_flagged ON scans(flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_batch ON qr_tokens(batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_jti ON qr_tokens(token_jti);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_seller ON fraud_alerts(seller_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sellers_updated_at ON sellers;
CREATE TRIGGER sellers_updated_at BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS batches_updated_at ON batches;
CREATE TRIGGER batches_updated_at BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION increment_batch_scan_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE batches SET scan_count = scan_count + 1 WHERE id = NEW.batch_id;
  UPDATE qr_tokens SET
    scan_count = scan_count + 1,
    first_scanned_at = COALESCE(first_scanned_at, NOW())
  WHERE token = NEW.qr_token;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_scan_insert ON scans;
CREATE TRIGGER after_scan_insert AFTER INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION increment_batch_scan_count();

CREATE OR REPLACE FUNCTION check_fraud_patterns(p_batch_id TEXT, p_scan_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_scan RECORD;
  v_current_scan RECORD;
  v_distance_km DOUBLE PRECISION;
  v_time_diff_minutes DOUBLE PRECISION;
  v_scan_count_1h INTEGER;
BEGIN
  SELECT * INTO v_current_scan FROM scans WHERE id = p_scan_id;
  SELECT * INTO v_last_scan
  FROM scans
  WHERE batch_id = p_batch_id
    AND id != p_scan_id
    AND latitude IS NOT NULL
  ORDER BY scanned_at DESC
  LIMIT 1;

  IF v_last_scan IS NOT NULL AND v_current_scan.latitude IS NOT NULL THEN
    v_distance_km := 111.045 * SQRT(
      POWER(v_current_scan.latitude - v_last_scan.latitude, 2) +
      POWER((v_current_scan.longitude - v_last_scan.longitude) * COS(RADIANS(v_last_scan.latitude)), 2)
    );
    v_time_diff_minutes := EXTRACT(EPOCH FROM (v_current_scan.scanned_at - v_last_scan.scanned_at)) / 60.0;

    IF v_distance_km > 500 AND v_time_diff_minutes < 60 AND v_time_diff_minutes > 0 THEN
      UPDATE scans SET
        flagged = TRUE,
        flag_reason = 'Geographic impossibility: ' || ROUND(v_distance_km::numeric, 0) || 'km in ' || ROUND(v_time_diff_minutes::numeric, 0) || ' minutes',
        flag_severity = 'critical'
      WHERE id = p_scan_id;

      INSERT INTO fraud_alerts (batch_id, seller_id, alert_type, severity, description, recommendation, scan_ids)
      VALUES (
        p_batch_id,
        v_current_scan.seller_id,
        'Geographic Impossibility',
        'critical',
        'Batch ' || p_batch_id || ' scanned in impossible travel window.',
        'Issue new QR codes and investigate counterfeit distribution.',
        ARRAY[v_last_scan.id, p_scan_id]
      );
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_scan_count_1h
  FROM scans
  WHERE batch_id = p_batch_id
    AND scanned_at > NOW() - INTERVAL '1 hour';

  IF v_scan_count_1h > 15 THEN
    UPDATE scans SET
      flagged = TRUE,
      flag_reason = 'Abnormal scan volume: ' || v_scan_count_1h || ' scans in 1 hour',
      flag_severity = 'high'
    WHERE id = p_scan_id;

    IF NOT EXISTS (
      SELECT 1 FROM fraud_alerts
      WHERE batch_id = p_batch_id
        AND alert_type = 'High Volume Scanning'
        AND created_at > NOW() - INTERVAL '2 hours'
    ) THEN
      INSERT INTO fraud_alerts (batch_id, seller_id, alert_type, severity, description, recommendation, scan_ids)
      VALUES (
        p_batch_id,
        v_current_scan.seller_id,
        'High Volume Scanning',
        'high',
        v_scan_count_1h || ' scans detected in the last hour.',
        'Review suspicious locations and scanning sources.',
        ARRAY[p_scan_id]
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Atomic one-time QR claim (prevents concurrent double redemption)
CREATE OR REPLACE FUNCTION claim_one_time_qr_scan(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE qr_tokens
  SET active = FALSE
  WHERE token = p_token
    AND active = TRUE
    AND scan_count = 0;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

-- Generic increment helper used by frontend RPC
CREATE OR REPLACE FUNCTION increment(table_name TEXT, column_name TEXT, row_id UUID, amount INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF table_name = 'sellers' AND column_name = 'total_tags_issued' THEN
    UPDATE sellers SET total_tags_issued = total_tags_issued + amount WHERE id = row_id;
  END IF;
END;
$$;

ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sellers_self ON sellers;
CREATE POLICY sellers_self ON sellers FOR ALL USING (auth.uid() = auth_id);

DROP POLICY IF EXISTS batches_owner ON batches;
CREATE POLICY batches_owner ON batches
  FOR ALL USING (seller_id IN (SELECT id FROM sellers WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS scans_owner_read ON scans;
CREATE POLICY scans_owner_read ON scans
  FOR SELECT USING (seller_id IN (SELECT id FROM sellers WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS scans_public_insert ON scans;
CREATE POLICY scans_public_insert ON scans FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS fraud_alerts_owner ON fraud_alerts;
CREATE POLICY fraud_alerts_owner ON fraud_alerts
  FOR ALL USING (seller_id IN (SELECT id FROM sellers WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS qr_tokens_public_read ON qr_tokens;
CREATE POLICY qr_tokens_public_read ON qr_tokens FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS qr_tokens_owner ON qr_tokens;
CREATE POLICY qr_tokens_owner ON qr_tokens
  FOR ALL USING (
    batch_id IN (
      SELECT id FROM batches WHERE seller_id IN (
        SELECT id FROM sellers WHERE auth_id = auth.uid()
      )
    )
  );
