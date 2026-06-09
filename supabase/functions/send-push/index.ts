import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const appTimeZone = "Asia/Beirut";

type PushRequest = {
  type?: string;
  match_id?: string;
  recipient_member_ids?: string[];
  vote_status?: string;
  previous_vote_status?: string;
  update_summary?: string;
  team_name?: string;
  shirt_color?: string;
  title?: string;
  body?: string;
  url?: string;
  role?: string;
  sports?: string[];
};

type MatchRow = {
  id: string;
  title: string | null;
  start_time: string | null;
  created_by?: string | null;
  sport_id?: string | null;
  sports?: { name?: string | null } | null;
  venues?: { name?: string | null } | null;
};

type MemberRow = {
  id: string;
  role?: string | null;
  approval_status?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email?: string | null;
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

function ordinalDay(day: number) {
  const suffix = day % 10 === 1 && day % 100 !== 11
    ? "st"
    : day % 10 === 2 && day % 100 !== 12
      ? "nd"
      : day % 10 === 3 && day % 100 !== 13
        ? "rd"
        : "th";

  return `${day}${suffix}`;
}

function datePartsInAppTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const part = (type: string) => Number(parts.find(item => item.type === type)?.value || 0);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day")
  };
}

function appDayStamp(date: Date) {
  const parts = datePartsInAppTimeZone(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function matchDatePhrase(value: string | null) {
  if (!value) return "";

  const matchDate = new Date(value);
  if (Number.isNaN(matchDate.getTime())) return "";

  const matchParts = datePartsInAppTimeZone(matchDate);
  const dayDiff = Math.round((appDayStamp(matchDate) - appDayStamp(new Date())) / 86400000);

  if (dayDiff === 0) return "today";
  if (dayDiff === 1) return "tomorrow";

  if (dayDiff > 1 && dayDiff <= 7) {
    return `next ${new Intl.DateTimeFormat("en", {
      timeZone: appTimeZone,
      weekday: "long"
    }).format(matchDate)}`;
  }

  const month = new Intl.DateTimeFormat("en", {
    timeZone: appTimeZone,
    month: "long"
  }).format(matchDate);
  return `on the ${ordinalDay(matchParts.day)} of ${month}`;
}

function memberDisplayName(member: MemberRow) {
  return member.display_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "A member";
}

function isAdminRole(role: string | null | undefined) {
  return ["owner", "admin"].includes(String(role || "").toLowerCase());
}

async function senderCanManageMatch(adminClient: any, sender: MemberRow, match: MatchRow) {
  if (match.created_by === sender.id || isAdminRole(sender.role)) return true;
  if (String(sender.role || "").toLowerCase() !== "committee" || !match.sport_id) return false;

  const { data, error } = await adminClient
    .from("member_sport_permissions")
    .select("id")
    .eq("member_id", sender.id)
    .eq("sport_id", match.sport_id)
    .eq("permission", "manage")
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

function sportBallEmoji(sport: string) {
  const sportText = sport.toLowerCase();

  if (sportText.includes("soccer") || sportText.includes("football")) return "⚽";
  if (sportText.includes("volleyball")) return "🏐";
  if (sportText.includes("basketball")) return "🏀";
  if (sportText.includes("tennis") || sportText.includes("padel")) return "🎾";
  if (sportText.includes("swim")) return "🏊";
  if (sportText.includes("run")) return "🏃";
  if (sportText.includes("gym") || sportText.includes("weight")) return "🏋️";
  if (sportText.includes("walk")) return "🚶";

  return "🏅";
}

function matchInvitePayload(match: MatchRow, senderName: string) {
  const sport = match.sports?.name || "sport";
  const sportText = sport.toLowerCase();
  const emoji = sportBallEmoji(sport);
  const dateText = matchDatePhrase(match.start_time);
  const venueText = match.venues?.name ? ` at ${match.venues.name}` : "";
  const dateClause = dateText ? ` ${dateText}` : "";

  return {
    title: "ABA Match Invite",
    body: `${emoji} ${senderName} invites you to a ${sportText} game${dateClause}${venueText}.`,
    tag: `match-invite-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: `./index.html#matches?match=${match.id}`,
    data: {
      type: "match_invite",
      match_id: match.id,
      sport
    }
  };
}

function matchInviteCancelledPayload(match: MatchRow, senderName: string) {
  const sport = match.sports?.name || "sport";
  const sportText = sport.toLowerCase();
  const emoji = sportBallEmoji(sport);
  const dateText = matchDatePhrase(match.start_time);
  const venueText = match.venues?.name ? ` at ${match.venues.name}` : "";
  const dateClause = dateText ? ` ${dateText}` : "";

  return {
    title: "ABA Match Invite Cancelled",
    body: `${emoji} ${senderName} removed your invitation to a ${sportText} game${dateClause}${venueText}.`,
    tag: `match-invite-cancelled-${match.id}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: "./index.html#matches",
    data: {
      type: "match_invite_cancelled",
      match_id: match.id,
      sport
    }
  };
}

function testPayload() {
  return {
    title: "ABA Test Notification",
    body: "Phone notifications are working on this device.",
    tag: `test-push-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: "./#dashboard",
    data: {
      type: "test_push"
    }
  };
}

function memberApprovalRequestedPayload(member: MemberRow) {
  const name = memberDisplayName(member);
  const emailText = member.email ? ` (${member.email})` : "";

  return {
    title: "ABA Profile Approval",
    body: `${name}${emailText} is waiting for profile approval.`,
    tag: `member-approval-${member.id}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: "./index.html#admin",
    data: {
      type: "member_approval_requested",
      member_id: member.id
    }
  };
}

function adminDirectPayload(title: string | undefined, message: string | undefined, url: string | undefined) {
  return {
    title: title?.trim() || "ABA Notification",
    body: message?.trim() || "",
    tag: `admin-direct-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: url || "./#dashboard",
    data: {
      type: "admin_direct"
    }
  };
}

async function createInboxRows(
  adminClient: any,
  recipientIds: string[],
  sender: MemberRow,
  payloadBody: Record<string, any>,
  subscriptionsByMember: Map<string, number>
) {
  if (!recipientIds.length) return new Map<string, string>();

  const rows = recipientIds.map(memberId => ({
    recipient_member_id: memberId,
    actor_member_id: sender?.id || null,
    type: String(payloadBody?.data?.type || "notification"),
    title: String(payloadBody?.title || "ABA"),
    body: payloadBody?.body ? String(payloadBody.body) : null,
    url: payloadBody?.url ? String(payloadBody.url) : null,
    data: payloadBody?.data || {},
    delivery_status: subscriptionsByMember.get(memberId) ? "queued" : "no_subscription"
  }));

  try {
    const { data, error } = await adminClient
      .from("member_notifications")
      .insert(rows)
      .select("id,recipient_member_id");

    if (error) {
      console.warn("Notification inbox insert failed:", error.message);
      return new Map<string, string>();
    }

    return new Map((data || []).map((row: any) => [row.recipient_member_id, row.id]));
  } catch (error) {
    console.warn("Notification inbox unavailable:", error);
    return new Map<string, string>();
  }
}

async function updateInboxDeliveryStatus(
  adminClient: any,
  notificationIds: string[],
  deliveryStatus: "sent" | "failed",
  deliveryError: string | null = null
) {
  if (!notificationIds.length) return;

  try {
    await adminClient
      .from("member_notifications")
      .update({
        delivery_status: deliveryStatus,
        delivery_error: deliveryError
      })
      .in("id", notificationIds);
  } catch (error) {
    console.warn("Notification inbox delivery update failed:", error);
  }
}

function roleChangedPayload(role: string | undefined, sports: string[] | undefined) {
  const cleanRole = String(role || "member").toLowerCase();
  const roleLabel = cleanRole === "owner"
    ? "owner"
    : cleanRole === "admin"
      ? "admin"
      : cleanRole === "committee"
        ? "sport committee member"
        : "member";
  const sportList = Array.isArray(sports) ? sports.filter(Boolean) : [];
  const sportText = sportList.length
    ? ` for ${sportList.join(", ")}`
    : "";

  return {
    title: "ABA Role Updated",
    body: `You have been assigned as ${roleLabel}${sportText}.`,
    tag: `role-updated-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: "./index.html#account",
    data: {
      type: "role_changed",
      role: cleanRole,
      sports: sportList
    }
  };
}

function voteStatusLabel(status: string | undefined) {
  if (status === "in") return "IN";
  if (status === "maybe") return "Maybe";
  if (status === "out") return "Out";
  return status || "updated";
}

function creatorVoteChangedPayload(match: MatchRow, senderName: string, status: string | undefined) {
  const title = match.title || "ABA match";
  const emoji = sportBallEmoji(match.sports?.name || "");

  return {
    title: "ABA Vote Updated",
    body: `${emoji} ${senderName} changed vote to ${voteStatusLabel(status)} for ${title}.`,
    tag: `vote-${match.id}-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    timestamp: Date.now(),
    url: `./index.html#matches?match=${match.id}`,
    data: {
      type: "creator_vote_changed",
      match_id: match.id
    }
  };
}

function creatorGameFullPayload(match: MatchRow) {
  const title = match.title || "ABA match";
  const emoji = sportBallEmoji(match.sports?.name || "");

  return {
    title: "ABA Match Full",
    body: `${emoji} ${title} is now full.`,
    tag: `full-${match.id}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: `./index.html#matches?match=${match.id}`,
    data: {
      type: "creator_game_full",
      match_id: match.id
    }
  };
}

function matchLifecyclePayload(match: MatchRow, type: "match_cancelled" | "match_deleted", senderName: string) {
  const title = match.title || "ABA match";
  const isDeleted = type === "match_deleted";
  const emoji = sportBallEmoji(match.sports?.name || "");

  return {
    title: isDeleted ? "ABA Match Deleted" : "ABA Match Cancelled",
    body: `${emoji} ${senderName} ${isDeleted ? "deleted" : "cancelled"} ${title}.`,
    tag: `${isDeleted ? "deleted" : "cancelled"}-${match.id}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: isDeleted ? "./index.html#matches" : `./index.html#matches?match=${match.id}`,
    data: {
      type,
      match_id: match.id
    }
  };
}

function matchUpdatedPayload(match: MatchRow, senderName: string, updateSummary: string | undefined) {
  const title = match.title || "ABA match";
  const emoji = sportBallEmoji(match.sports?.name || "");
  const summary = String(updateSummary || "details changed").trim().slice(0, 160);

  return {
    title: "ABA Match Updated",
    body: `${emoji} ${senderName} updated ${title}: ${summary}.`,
    tag: `updated-${match.id}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: `./index.html#matches?match=${match.id}`,
    data: {
      type: "match_updated",
      match_id: match.id
    }
  };
}

function teamAssignedPayload(match: MatchRow, teamName: string | undefined, shirtColor: string | undefined) {
  const title = match.title || "ABA match";
  const emoji = sportBallEmoji(match.sports?.name || "");
  const name = String(teamName || "your team").trim();
  const color = String(shirtColor || "").trim();
  const gameDay = matchDatePhrase(match.start_time);
  const templates = color
    ? [
      `Ready to bring ${name} to the top${gameDay ? ` ${gameDay}` : ""}? don't forget your ${color} T-shirt!`,
      `${name}, time to show up strong${gameDay ? ` ${gameDay}` : ""}. don't forget your ${color} T-shirt!`,
      `Your squad is set: ${name}. Bring the energy and your ${color} T-shirt!`,
      `${name} is calling. Play smart, play loud, and wear ${color}!`,
      `Lineup locked for ${name}. Make it count in ${color}!`
    ]
    : [
      `${name} is locked in. Ready to roast them${gameDay ? ` ${gameDay}` : ""}?`,
      `${name}, time to make them regret showing up.`,
      `Your lineup is ready. Their confidence is optional.`,
      `${name}, make it look close, then end it.`,
      `Go collect points and complaints.`,
      `${name}, bring the heat and leave them guessing.`,
      `Today’s plan: pressure, patience, punishment.`,
      `${name}, save the excuses for them.`
    ];
  const index = Math.abs([...match.id, ...name].reduce((total, char) => total + char.charCodeAt(0), 0)) % templates.length;

  return {
    title: "ABA Team Assigned",
    body: `${emoji} ${templates[index]}`,
    tag: `team-assigned-${match.id}-${name}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: `./index.html#matches?match=${match.id}`,
    data: {
      type: "team_assigned",
      match_id: match.id
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
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE");
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

  let body: PushRequest;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const { data: sender, error: senderError } = await adminClient
    .from("members")
    .select("id,role,approval_status,first_name,last_name,display_name,email")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (senderError || !sender) {
    return jsonResponse({ error: "Member profile required." }, 403);
  }

  const requestType = typeof body.type === "string"
    ? body.type.toLowerCase().trim()
    : "";

  const supportedTypes = new Set([
    "match_invite",
    "match_invite_cancelled",
    "test",
    "test_push",
    "creator_vote_changed",
    "creator_game_full",
    "match_cancelled",
    "match_deleted",
    "match_updated",
    "team_assigned",
    "member_approval_requested",
    "admin_direct",
    "role_changed"
  ]);

  if (!supportedTypes.has(requestType)) {
    return jsonResponse({ error: "Unsupported notification type." }, 400);
  }

  let allowedRecipientIds: string[] = [];
  let payloadBody: Record<string, unknown>;

  if (requestType !== "member_approval_requested" && sender.approval_status !== "approved") {
    return jsonResponse({ error: "Approved member required." }, 403);
  }

  if (requestType === "member_approval_requested") {
    if (sender.approval_status !== "pending") {
      return jsonResponse({ sent: 0, failed: 0, skipped: true });
    }

    const { data: admins, error: adminError } = await adminClient
      .from("members")
      .select("id")
      .in("role", ["owner", "admin"])
      .eq("approval_status", "approved")
      .eq("is_active", true);

    if (adminError) {
      return jsonResponse({ error: adminError.message }, 500);
    }

    allowedRecipientIds = (admins || []).map(admin => admin.id).filter(id => id !== sender.id);
    payloadBody = memberApprovalRequestedPayload(sender);
  } else if (requestType === "role_changed") {
    if (!isAdminRole(sender.role)) {
      return jsonResponse({ error: "Only owners or admins can send role update notifications." }, 403);
    }

    allowedRecipientIds = uniqueIds(body.recipient_member_ids)
      .filter(id => id !== sender.id);
    payloadBody = roleChangedPayload(body.role, body.sports);
  } else if (requestType === "admin_direct" || requestType === "test") {
    if (!isAdminRole(sender.role)) {
      return jsonResponse({ error: "Only admins can send direct admin notifications." }, 403);
    }

    allowedRecipientIds = uniqueIds(body.recipient_member_ids);
    payloadBody = adminDirectPayload(body.title, body.body, body.url);
  } else if (requestType === "test_push") {
    allowedRecipientIds = [sender.id];
    payloadBody = testPayload();
  } else if (requestType === "match_invite" || requestType === "team_assigned" || requestType === "match_invite_cancelled") {
    const matchId = typeof body.match_id === "string" ? body.match_id : "";
    const recipientIds = uniqueIds(body.recipient_member_ids)
      .filter(id => requestType === "team_assigned" || id !== sender.id);

    if (!matchId || !recipientIds.length) {
      return jsonResponse({ sent: 0, failed: 0, skipped: true });
    }

    const { data: match, error: matchError } = await adminClient
      .from("matches")
      .select("id,title,start_time,created_by,sport_id,sports(name),venues(name)")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) {
      return jsonResponse({ error: "Match not found." }, 404);
    }

    if (
      (requestType === "team_assigned" || requestType === "match_invite_cancelled") &&
      !(await senderCanManageMatch(adminClient, sender, match as MatchRow))
    ) {
      return jsonResponse({ error: "Only sport managers can notify this match update." }, 403);
    }

    const invitationQuery = adminClient
      .from("match_invitations")
      .select("member_id")
      .eq("match_id", matchId)
      .in("member_id", recipientIds);

    const { data: invitationRows, error: invitationError } = requestType === "match_invite"
      ? await invitationQuery.eq("status", "invited")
      : requestType === "match_invite_cancelled"
        ? await invitationQuery.eq("status", "removed")
        : await invitationQuery.eq("status", "in");

    if (invitationError) {
      return jsonResponse({ error: invitationError.message }, 500);
    }

    allowedRecipientIds = (invitationRows || []).map(row => row.member_id);
    payloadBody = requestType === "team_assigned"
      ? teamAssignedPayload(match as MatchRow, body.team_name, body.shirt_color)
      : requestType === "match_invite_cancelled"
        ? matchInviteCancelledPayload(match as MatchRow, memberDisplayName(sender))
        : matchInvitePayload(match as MatchRow, memberDisplayName(sender));
  } else {
    const matchId = typeof body.match_id === "string" ? body.match_id : "";

    if (!matchId) {
      return jsonResponse({ sent: 0, failed: 0, skipped: true });
    }

    const { data: match, error: matchError } = await adminClient
      .from("matches")
      .select("id,title,start_time,created_by,sport_id,sports(name),venues(name)")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) {
      return jsonResponse({ error: "Match not found." }, 404);
    }

    if (
      requestType === "match_cancelled" ||
      requestType === "match_deleted" ||
      requestType === "match_updated"
    ) {
      const canManage = await senderCanManageMatch(adminClient, sender, match as MatchRow);

      if (!canManage) {
        return jsonResponse({ error: "Only sport managers can notify match updates." }, 403);
      }

      const { data: invitationRows, error: invitationError } = await adminClient
        .from("match_invitations")
        .select("member_id")
        .eq("match_id", matchId)
        .neq("status", "removed");

      if (invitationError) {
        return jsonResponse({ error: invitationError.message }, 500);
      }

      allowedRecipientIds = uniqueIds([
        match.created_by,
        ...(invitationRows || []).map(row => row.member_id)
      ]).filter(id => id !== sender.id);
      payloadBody = requestType === "match_updated"
        ? matchUpdatedPayload(match as MatchRow, memberDisplayName(sender), body.update_summary)
        : matchLifecyclePayload(match as MatchRow, requestType as "match_cancelled" | "match_deleted", memberDisplayName(sender));
    } else {
      if (match.created_by === sender.id) {
        return jsonResponse({ sent: 0, failed: 0, skipped: true });
      }

      const { data: invitation, error: invitationError } = await adminClient
        .from("match_invitations")
        .select("id,status")
        .eq("match_id", matchId)
        .eq("member_id", sender.id)
        .neq("status", "removed")
        .maybeSingle();

      if (invitationError) {
        return jsonResponse({ error: invitationError.message }, 500);
      }

      if (!invitation) {
        return jsonResponse({ error: "Only invited members can notify the match creator." }, 403);
      }

      allowedRecipientIds = match.created_by ? [match.created_by] : [];

      payloadBody = requestType === "creator_game_full"
        ? creatorGameFullPayload(match as MatchRow)
        : creatorVoteChangedPayload(match as MatchRow, memberDisplayName(sender), body.vote_status);
    }
  }

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

  const subscriptionsByMember = new Map<string, number>();
  (subscriptions || []).forEach(subscription => {
    const memberId = String(subscription.member_id || "");
    if (!memberId) return;
    subscriptionsByMember.set(memberId, (subscriptionsByMember.get(memberId) || 0) + 1);
  });

  const inboxIdsByMember = await createInboxRows(
    adminClient,
    allowedRecipientIds,
    sender as MemberRow,
    payloadBody as Record<string, any>,
    subscriptionsByMember
  );

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify(payloadBody);
  let sent = 0;
  let failed = 0;
  const sentNotificationIds = new Set<string>();
  const failedNotificationIds = new Map<string, string>();

  await Promise.all((subscriptions || []).map(async subscription => {
    try {
      await webpush.sendNotification(subscription.subscription, payload);
      sent += 1;
      const inboxId = inboxIdsByMember.get(subscription.member_id);
      if (inboxId) sentNotificationIds.add(inboxId);
    } catch (error) {
      failed += 1;

      const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
      const inboxId = inboxIdsByMember.get(subscription.member_id);
      if (inboxId && !sentNotificationIds.has(inboxId)) {
        failedNotificationIds.set(inboxId, error instanceof Error ? error.message : "Push send failed.");
      }

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

  for (const inboxId of sentNotificationIds) {
    failedNotificationIds.delete(inboxId);
  }

  await updateInboxDeliveryStatus(adminClient, Array.from(sentNotificationIds), "sent");
  await updateInboxDeliveryStatus(
    adminClient,
    Array.from(failedNotificationIds.keys()),
    "failed",
    Array.from(failedNotificationIds.values())[0] || "Push send failed."
  );

  return jsonResponse({ sent, failed });
});
