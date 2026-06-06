import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type PushRequest = {
  type?: string;
  match_id?: string;
  recipient_member_ids?: string[];
};

type MatchRow = {
  id: string;
  title: string | null;
  start_time: string | null;
  sports?: { name?: string | null } | null;
  venues?: { name?: string | null } | null;
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

function uniqueIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter(id => typeof id === "string" && id.length > 0)));
}

function formatMatchTime(value: string | null) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function matchInvitePayload(match: MatchRow) {
  const title = match.title || "ABA match";
  const sport = match.sports?.name || "Sport";
  const venue = match.venues?.name || "venue TBD";
  const time = formatMatchTime(match.start_time);

  return {
    title: "ABA Match Invite",
    body: `You were invited to ${title}${time ? ` on ${time}` : ""} at ${venue}.`,
    url: "./index.html#matches",
    data: {
      type: "match_invite",
      match_id: match.id,
      sport
    }
  };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: "Push notification secrets are not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: sender, error: senderError } = await adminClient
    .from("members")
    .select("id,role,approval_status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (senderError || !sender || sender.approval_status !== "approved") {
    return jsonResponse({ error: "Approved member required." }, 403);
  }

  let body: PushRequest;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (body.type !== "match_invite") {
    return jsonResponse({ error: "Unsupported notification type." }, 400);
  }

  const matchId = typeof body.match_id === "string" ? body.match_id : "";
  const recipientIds = uniqueIds(body.recipient_member_ids).filter(id => id !== sender.id);

  if (!matchId || !recipientIds.length) {
    return jsonResponse({ sent: 0, failed: 0, skipped: true });
  }

  const { data: match, error: matchError } = await adminClient
    .from("matches")
    .select("id,title,start_time,sports(name),venues(name)")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError || !match) {
    return jsonResponse({ error: "Match not found." }, 404);
  }

  const { data: invitationRows, error: invitationError } = await adminClient
    .from("match_invitations")
    .select("member_id")
    .eq("match_id", matchId)
    .in("member_id", recipientIds)
    .eq("status", "invited");

  if (invitationError) {
    return jsonResponse({ error: invitationError.message }, 500);
  }

  const allowedRecipientIds = (invitationRows || []).map(row => row.member_id);

  if (!allowedRecipientIds.length) {
    return jsonResponse({ sent: 0, failed: 0, skipped: true });
  }

  const { data: subscriptions, error: subscriptionError } = await adminClient
    .from("member_push_subscriptions")
    .select("id,member_id,endpoint,subscription")
    .in("member_id", allowedRecipientIds)
    .eq("enabled", true);

  if (subscriptionError) {
    return jsonResponse({ error: subscriptionError.message }, 500);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify(matchInvitePayload(match as MatchRow));
  let sent = 0;
  let failed = 0;

  await Promise.all((subscriptions || []).map(async subscription => {
    try {
      await webpush.sendNotification(subscription.subscription, payload);
      sent += 1;
    } catch (error) {
      failed += 1;

      const statusCode = Number((error as { statusCode?: number }).statusCode || 0);

      if (statusCode === 404 || statusCode === 410) {
        await adminClient
          .from("member_push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
      } else {
        console.warn("Push send failed:", error);
      }
    }
  }));

  return jsonResponse({ sent, failed });
});
