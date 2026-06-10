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

  const { data: connection } = await adminClient
    .from("member_strava_connections")
    .select("id")
    .eq("member_id", member.id)
    .maybeSingle();

  const { data: tokenRow } = connection?.id
    ? await adminClient
      .from("member_strava_tokens")
      .select("access_token")
      .eq("connection_id", connection.id)
      .maybeSingle()
    : { data: null };

  const accessToken = tokenRow?.access_token;

  if (accessToken) {
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    }).catch(() => null);
  }

  const { error: deleteError } = await adminClient
    .from("member_strava_connections")
    .delete()
    .eq("member_id", member.id);

  if (deleteError) return jsonResponse({ error: deleteError.message }, 500);

  return jsonResponse({ ok: true });
});
