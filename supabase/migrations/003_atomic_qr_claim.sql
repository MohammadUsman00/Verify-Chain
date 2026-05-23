-- Atomic first-scan claim for one-time QR seals (prevents concurrent double-redemption)
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

GRANT EXECUTE ON FUNCTION claim_one_time_qr_scan(TEXT) TO service_role;
