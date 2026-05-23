// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacVerify(data: string, secret: string, sig: string): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

function scanPolicyMeta(batch: any, qrRow: any) {
  const policy = batch.scan_policy || "limited";
  const max = batch.max_scans_per_unit ?? 3;
  const used = qrRow?.scan_count ?? 0;
  if (policy === "single") {
    return { policy, max_scans: 1, scans_used: used, scans_remaining: Math.max(0, 1 - used) };
  }
  if (policy === "limited") {
    return { policy, max_scans: max, scans_used: used, scans_remaining: Math.max(0, max - used) };
  }
  return { policy, max_scans: null, scans_used: used, scans_remaining: null };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, lat, lng, city, country, device_type, user_agent } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ verified: false, error: "No token provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    let payload: any;
    try {
      const padded = token.replace(/-/g, "+").replace(/_/g, "/");
      payload = JSON.parse(atob(padded));
    } catch {
      return new Response(
        JSON.stringify({ verified: false, reason: "INVALID_TOKEN", message: "QR code is malformed or corrupted." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl =
      Deno.env.get("VC_SB_URL") ??
      Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("VC_SB_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Server misconfiguration",
          details: "Missing Supabase function secrets: VC_SB_URL and/or VC_SB_SERVICE_ROLE_KEY"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("*, sellers(name, location, verified)")
      .eq("id", payload.bid)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ verified: false, reason: "NOT_FOUND", message: "This product is not registered in VerifyChain." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (batch.status !== "active") {
      return new Response(
        JSON.stringify({ verified: false, reason: "RECALLED", message: "This product batch has been recalled by the seller." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sig, ...payloadWithoutSig } = payload;
    const dataToVerify = JSON.stringify(payloadWithoutSig);
    const signatureValid = await hmacVerify(dataToVerify, batch.hmac_secret, sig || "");

    if (!signatureValid) {
      await supabase.from("scans").insert({
        batch_id: batch.id,
        seller_id: batch.seller_id,
        latitude: lat, longitude: lng,
        city, country,
        location_display: [city, country].filter(Boolean).join(", ") || "Unknown",
        device_type,
        user_agent_hash: user_agent ? await hmacSign(user_agent, "ua-hash-salt") : null,
        flagged: true,
        flag_reason: "Invalid signature - likely counterfeit QR",
        flag_severity: "critical",
        qr_token: token,
        signature_valid: false
      });

      return new Response(
        JSON.stringify({
          verified: false,
          reason: "INVALID_SIGNATURE",
          message: "This QR code has an invalid signature. This product may be counterfeit.",
          batch_id: batch.id,
          product: batch.product
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: qrRow, error: qrError } = await supabase
      .from("qr_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (qrError || !qrRow) {
      return new Response(
        JSON.stringify({
          verified: false,
          reason: "UNKNOWN_TOKEN",
          message: "This QR is not registered. It may be forged or from an old batch export.",
          batch_id: batch.id,
          product: batch.product
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!qrRow.active) {
      return new Response(
        JSON.stringify({
          verified: false,
          reason: "DEACTIVATED",
          message: "This QR tag has been deactivated by the seller.",
          batch_id: batch.id,
          product: batch.product
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.uid != null && qrRow.unit_number !== payload.uid) {
      return new Response(
        JSON.stringify({
          verified: false,
          reason: "UNIT_MISMATCH",
          message: "Token unit identity does not match registry.",
          batch_id: batch.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.jti && qrRow.token_jti && payload.jti !== qrRow.token_jti) {
      return new Response(
        JSON.stringify({
          verified: false,
          reason: "INVALID_SIGNATURE",
          message: "Token identity mismatch — possible clone or tampered QR.",
          batch_id: batch.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const policy = batch.scan_policy || "limited";
    const maxScans = batch.max_scans_per_unit ?? 3;
    const priorScans = qrRow.scan_count ?? 0;

    if (policy === "single" && priorScans >= 1) {
      await supabase.from("scans").insert({
        batch_id: batch.id,
        seller_id: batch.seller_id,
        latitude: lat, longitude: lng,
        city, country,
        location_display: [city, country].filter(Boolean).join(", ") || "Unknown",
        device_type,
        user_agent_hash: user_agent ? await hmacSign(user_agent, "ua-hash-salt") : null,
        flagged: true,
        flag_reason: "Duplicate scan on one-time seal QR",
        flag_severity: "high",
        qr_token: token,
        signature_valid: true
      });

      return new Response(
        JSON.stringify({
          verified: false,
          reason: "ALREADY_REDEEMED",
          message: "This one-time seal was already redeemed. Further scans may indicate a duplicated label.",
          batch_id: batch.id,
          product: batch.product,
          unit_number: qrRow.unit_number,
          first_scanned_at: qrRow.first_scanned_at,
          scan_policy: policy
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (policy === "limited" && priorScans >= maxScans) {
      await supabase.from("scans").insert({
        batch_id: batch.id,
        seller_id: batch.seller_id,
        latitude: lat, longitude: lng,
        city, country,
        location_display: [city, country].filter(Boolean).join(", ") || "Unknown",
        device_type,
        user_agent_hash: user_agent ? await hmacSign(user_agent, "ua-hash-salt") : null,
        flagged: true,
        flag_reason: `Scan limit exceeded (${maxScans} per unit)`,
        flag_severity: "medium",
        qr_token: token,
        signature_valid: true
      });

      return new Response(
        JSON.stringify({
          verified: false,
          reason: "SCAN_LIMIT_REACHED",
          message: `This QR has reached its ${maxScans}-scan verification limit.`,
          batch_id: batch.id,
          product: batch.product,
          unit_number: qrRow.unit_number,
          scan_policy: policy,
          max_scans: maxScans,
          scans_used: priorScans
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const locationDisplay = [city, country].filter(Boolean).join(", ") || "Unknown";
    const isRescan = priorScans > 0;
    const { data: scanData } = await supabase.from("scans").insert({
      batch_id: batch.id,
      seller_id: batch.seller_id,
      latitude: lat, longitude: lng,
      city, country,
      location_display: locationDisplay,
      device_type,
      user_agent_hash: user_agent ? await hmacSign(user_agent, "ua-hash-salt") : null,
      qr_token: token,
      signature_valid: true,
      flagged: isRescan && policy === "single",
      flag_reason: isRescan ? "Repeat verification on sealed unit" : null,
      flag_severity: isRescan ? "low" : null
    }).select().single();

    if (scanData) {
      await supabase.rpc("check_fraud_patterns", {
        p_batch_id: batch.id,
        p_scan_id: scanData.id
      });
    }

    if (policy === "single") {
      await supabase.from("qr_tokens").update({ active: false }).eq("id", qrRow.id);
    }

    const { data: recentScans } = await supabase
      .from("scans")
      .select("location_display, scanned_at, device_type, flagged")
      .eq("batch_id", batch.id)
      .order("scanned_at", { ascending: false })
      .limit(10);

    const { data: refreshedQr } = await supabase
      .from("qr_tokens")
      .select("scan_count, first_scanned_at, unit_number, token_jti, active")
      .eq("id", qrRow.id)
      .single();

    const policyMeta = scanPolicyMeta(batch, refreshedQr || qrRow);
    const fingerprint = payload.jti
      ? String(payload.jti).replace(/-/g, "").slice(0, 8).toUpperCase()
      : null;

    const totalScans = (batch.scan_count || 0) + 1;
    return new Response(
      JSON.stringify({
        verified: true,
        batch: {
          id: batch.id,
          product: batch.product,
          category: batch.category,
          origin: batch.origin,
          farm: batch.farm,
          harvest_date: batch.harvest_date,
          cert_number: batch.cert_number,
          supply_chain: batch.supply_chain,
          seller_name: batch.sellers?.name || "Verified Seller",
          seller_location: batch.sellers?.location,
          seller_verified: batch.sellers?.verified || false,
          created_at: batch.created_at,
          total_scans: totalScans,
          scan_policy: policy,
          max_scans_per_unit: maxScans
        },
        unit: {
          number: refreshedQr?.unit_number ?? qrRow.unit_number,
          fingerprint,
          jti: payload.jti || refreshedQr?.token_jti,
          first_scan: priorScans === 0,
          scans_used: policyMeta.scans_used + 1,
          scans_remaining: policyMeta.scans_remaining != null
            ? Math.max(0, (policyMeta.scans_remaining ?? 0) - 1)
            : null
        },
        scan_policy: policyMeta,
        scan_history: recentScans || [],
        current_scan: {
          location: locationDisplay,
          scanned_at: new Date().toISOString()
        },
        trust_score: priorScans === 0 ? 98 : Math.max(72, 98 - priorScans * 8)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("verify-qr error:", err);
    return new Response(
      JSON.stringify({ verified: false, error: "Server error", details: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
