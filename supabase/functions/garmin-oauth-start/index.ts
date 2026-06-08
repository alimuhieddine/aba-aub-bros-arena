import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomString(byteLength = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256Base64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return base64Url(new Uint8Array(hash));
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const garminClientId = Deno.env.get("GARMIN_CLIENT_ID") || "";
  const defaultRedirectUri = Deno.env.get("GARMIN_REDIRECT_URI") ||
    `${supabaseUrl}/functions/v1/garmin-oauth-callback`;

  if (!garminClientId) {
    return jsonResponse({
      configured: false,
      error: "Garmin client id is not configured yet."
    }, 503);
  }

  const authHeader = request.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Login required." }, 401);
  }

  const { data: member, error: memberError } = await adminClient
    .from("members")
    .select("id,approval_status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (memberError) return jsonResponse({ error: memberError.message }, 500);
  if (!member || member.approval_status !== "approved") {
    return jsonResponse({ error: "Approved members only." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const redirectUri = String(body.redirect_uri || defaultRedirectUri);
  const appReturnUrl = String(body.app_return_url || "");
  const state = randomString(32);
  const codeVerifier = randomString(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  await adminClient
    .from("member_garmin_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const { error: stateError } = await adminClient
    .from("member_garmin_oauth_states")
    .insert({
      state,
      member_id: member.id,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      app_return_url: appReturnUrl || null
    });

  if (stateError) return jsonResponse({ error: stateError.message }, 500);

  const params = new URLSearchParams({
    client_id: garminClientId,
    response_type: "code",
    state,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });

  return jsonResponse({
    configured: true,
    authUrl: `https://connect.garmin.com/oauth2Confirm?${params.toString()}`
  });
});
