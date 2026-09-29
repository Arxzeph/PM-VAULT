import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecoveryRequest {
  email: string;
  recovery_auth_token: string; // 32-byte token in hex
}

// In-memory rate limiting map: IP/email -> attempts timestamp[]
const attemptsMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const body: RecoveryRequest = await req.json();
    const { email, recovery_auth_token } = body;

    if (!email || !recovery_auth_token) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: email or recovery_auth_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate Limiting Check
    const rateLimitKey = `${clientIp}:${email.trim().toLowerCase()}`;
    const now = Date.now();
    const history = (attemptsMap.get(rateLimitKey) || []).filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (history.length >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Maximum 5 recovery attempts per hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    history.push(now);
    attemptsMap.set(rateLimitKey, history);

    // Compute SHA-256 of the recovery_auth_token in hex
    const cleanToken = recovery_auth_token.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
    if (cleanToken.length !== 64) {
      return new Response(
        JSON.stringify({ error: "Invalid recovery_auth_token format. Must be 64-character hex string (32 bytes)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenBytes = new Uint8Array(
      cleanToken.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call stored procedure to verify hash securely
    const { data, error } = await supabase.rpc("verify_recovery_auth", {
      p_email: email.trim().toLowerCase(),
      p_auth_hash: hashHex,
    });

    if (error || !data || data.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid recovery token or email." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const record = data[0];

    return new Response(
      JSON.stringify({
        success: true,
        user_id: record.user_id,
        recovery_wrapped_dek: record.recovery_wrapped_dek,
        recovery_nonce: record.recovery_nonce,
        recovery_generation: record.recovery_generation,
        recovery_aad_version: record.recovery_aad_version,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
