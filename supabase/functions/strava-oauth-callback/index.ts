import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function redirectTo(url: string) {
  return Response.redirect(url, 302);
}

function appendReturnParam(baseUrl: string | null | undefined, key: string, value: string) {
  const fallback = Deno.env.get("APP_BASE_URL") || "https://welleqrjtlullhbdhive.supabase.co";
  const url = new URL(baseUrl || fallback);
  url.searchParams.set(key, value);
  return url.toString();
}

Deno.serve(async request => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const oauthError = url.searchParams.get("error") || "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID") || "";
  const stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET") || "";
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: storedState } = state
    ? await adminClient
      .from("member_strava_oauth_states")
      .select("state,member_id,redirect_uri,app_return_url,expires_at")
      .eq("state", state)
      .maybeSingle()
    : { data: null };

  const returnUrl = storedState?.app_return_url || Deno.env.get("APP_BASE_URL");

  if (oauthError) {
    return redirectTo(appendReturnParam(returnUrl, "strava", "declined"));
  }

  if (!code || !storedState) {
    return redirectTo(appendReturnParam(returnUrl, "strava", "invalid_state"));
  }

  if (new Date(storedState.expires_at).getTime() < Date.now()) {
    await adminClient.from("member_strava_oauth_states").delete().eq("state", state);
    return redirectTo(appendReturnParam(returnUrl, "strava", "expired"));
  }

  if (!stravaClientId || !stravaClientSecret) {
    return redirectTo(appendReturnParam(returnUrl, "strava", "not_configured"));
  }

  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      code,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return redirectTo(appendReturnParam(returnUrl, "strava", "token_failed"));
  }

  const token = await tokenResponse.json();
  const athlete = token.athlete || {};
  const athleteId = String(athlete.id || "");
  const accessToken = String(token.access_token || "");
  const refreshToken = String(token.refresh_token || "");

  if (!athleteId || !accessToken || !refreshToken) {
    return redirectTo(appendReturnParam(returnUrl, "strava", "token_failed"));
  }

  const { data: connection, error: connectionError } = await adminClient
    .from("member_strava_connections")
    .upsert({
      member_id: storedState.member_id,
      strava_athlete_id: athleteId,
      athlete_username: athlete.username || null,
      athlete_first_name: athlete.firstname || null,
      athlete_last_name: athlete.lastname || null,
      status: "connected",
      scope: token.scope || null,
      error_message: null,
      disconnected_at: null,
      updated_at: new Date().toISOString()
    }, { onConflict: "member_id" })
    .select("id")
    .single();

  if (connectionError || !connection) {
    return redirectTo(appendReturnParam(returnUrl, "strava", "save_failed"));
  }

  const expiresAt = new Date(Number(token.expires_at || Math.floor(Date.now() / 1000) + 21600) * 1000).toISOString();

  const { error: tokenError } = await adminClient
    .from("member_strava_tokens")
    .upsert({
      connection_id: connection.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: expiresAt,
      token_type: token.token_type || "Bearer",
      scope: token.scope || null,
      updated_at: new Date().toISOString()
    }, { onConflict: "connection_id" });

  await adminClient.from("member_strava_oauth_states").delete().eq("state", state);

  if (tokenError) {
    return redirectTo(appendReturnParam(returnUrl, "strava", "save_failed"));
  }

  return redirectTo(appendReturnParam(returnUrl, "strava", "connected"));
});
