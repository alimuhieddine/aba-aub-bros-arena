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
  const garminClientId = Deno.env.get("GARMIN_CLIENT_ID") || "";
  const garminClientSecret = Deno.env.get("GARMIN_CLIENT_SECRET") || "";
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: storedState } = state
    ? await adminClient
      .from("member_garmin_oauth_states")
      .select("state,member_id,code_verifier,redirect_uri,app_return_url,expires_at")
      .eq("state", state)
      .maybeSingle()
    : { data: null };

  const returnUrl = storedState?.app_return_url || Deno.env.get("APP_BASE_URL");

  if (oauthError) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "declined"));
  }

  if (!code || !storedState) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "invalid_state"));
  }

  if (new Date(storedState.expires_at).getTime() < Date.now()) {
    await adminClient.from("member_garmin_oauth_states").delete().eq("state", state);
    return redirectTo(appendReturnParam(returnUrl, "garmin", "expired"));
  }

  if (!garminClientId || !garminClientSecret) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "not_configured"));
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: garminClientId,
    client_secret: garminClientSecret,
    code,
    code_verifier: storedState.code_verifier,
    redirect_uri: storedState.redirect_uri
  });

  const tokenResponse = await fetch("https://connectapi.garmin.com/di-oauth2-service/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody
  });

  if (!tokenResponse.ok) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "token_failed"));
  }

  const token = await tokenResponse.json();
  const accessToken = String(token.access_token || "");
  const refreshToken = String(token.refresh_token || "");

  const userIdResponse = await fetch("https://apis.garmin.com/wellness-api/rest/user/id", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!userIdResponse.ok) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "user_failed"));
  }

  const garminUser = await userIdResponse.json();
  const garminUserId = String(garminUser.userId || "");
  if (!garminUserId) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "user_failed"));
  }

  const permissionsResponse = await fetch("https://apis.garmin.com/wellness-api/rest/user/permissions", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const permissions = permissionsResponse.ok ? await permissionsResponse.json().catch(() => []) : [];

  const { data: connection, error: connectionError } = await adminClient
    .from("member_garmin_connections")
    .upsert({
      member_id: storedState.member_id,
      garmin_user_id: garminUserId,
      status: "connected",
      permissions,
      error_message: null,
      disconnected_at: null,
      updated_at: new Date().toISOString()
    }, { onConflict: "member_id" })
    .select("id")
    .single();

  if (connectionError || !connection) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "save_failed"));
  }

  const expiresAt = new Date(Date.now() + Number(token.expires_in || 86400) * 1000).toISOString();
  const refreshExpiresIn = Number(token.refresh_token_expires_in || 0);
  const refreshExpiresAt = refreshExpiresIn > 0
    ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
    : null;

  const { error: tokenError } = await adminClient
    .from("member_garmin_tokens")
    .upsert({
      connection_id: connection.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: expiresAt,
      refresh_token_expires_at: refreshExpiresAt,
      token_type: token.token_type || null,
      scope: token.scope || null,
      updated_at: new Date().toISOString()
    }, { onConflict: "connection_id" });

  await adminClient.from("member_garmin_oauth_states").delete().eq("state", state);

  if (tokenError) {
    return redirectTo(appendReturnParam(returnUrl, "garmin", "save_failed"));
  }

  return redirectTo(appendReturnParam(returnUrl, "garmin", "connected"));
});
