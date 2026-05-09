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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
          message: "⚠ This QR code has an invalid signature. This product may be counterfeit.",
          batch_id: batch.id,
          product: batch.product
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const locationDisplay = [city, country].filter(Boolean).join(", ") || "Unknown";
    const { data: scanData } = await supabase.from("scans").insert({
      batch_id: batch.id,
      seller_id: batch.seller_id,
      latitude: lat, longitude: lng,
      city, country,
      location_display: locationDisplay,
      device_type,
      user_agent_hash: user_agent ? await hmacSign(user_agent, "ua-hash-salt") : null,
      qr_token: token,
      signature_valid: true
    }).select().single();

    if (scanData) {
      await supabase.rpc("check_fraud_patterns", {
        p_batch_id: batch.id,
        p_scan_id: scanData.id
      });
    }

    const { data: recentScans } = await supabase
      .from("scans")
      .select("location_display, scanned_at, device_type, flagged")
      .eq("batch_id", batch.id)
      .order("scanned_at", { ascending: false })
      .limit(10);

    const totalScans = batch.scan_count + 1;
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
          total_scans: totalScans
        },
        scan_history: recentScans || [],
        current_scan: {
          location: locationDisplay,
          scanned_at: new Date().toISOString()
        }
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
