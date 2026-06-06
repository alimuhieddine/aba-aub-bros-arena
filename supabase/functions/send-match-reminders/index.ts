import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const appTimeZone = "Asia/Beirut";
const sameDayReminderHour = 7;
const maybeReminderWindowHours = 3;

type MatchInvitation = {
  member_id: string;
  status: string | null;
};

type MatchTeamPlayer = {
  member_id: string | null;
};

type MatchTeam = {
  id: string;
  name: string | null;
  color: string | null;
  match_team_players?: MatchTeamPlayer[] | null;
};

type MatchRow = {
  id: string;
  title: string | null;
  start_time: string | null;
  voting_deadline_at: string | null;
  status: string | null;
  score_status: string | null;
  max_players: number | null;
  sports?: { name?: string | null } | null;
  venues?: { name?: string | null } | null;
  match_invitations?: MatchInvitation[] | null;
  match_teams?: MatchTeam[] | null;
};

type PushSubscriptionRow = {
  id: string;
  member_id: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
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

function uniqueIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter(id => typeof id === "string" && id.length > 0)));
}

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const part = (type: string) => Number(parts.find(item => item.type === type)?.value || 0);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute")
  };
}

function zonedDateKey(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatReminderTime(value: string | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    timeZone: appTimeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
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

function isActiveMatch(match: MatchRow) {
  const status = String(match.status || "").toLowerCase();
  const scoreStatus = String(match.score_status || "").toLowerCase();

  return status !== "cancelled" &&
    status !== "completed" &&
    scoreStatus !== "cancelled" &&
    scoreStatus !== "finalized";
}

function inMemberIds(match: MatchRow) {
  return uniqueIds((match.match_invitations || [])
    .filter(invitation => invitation.status === "in")
    .map(invitation => invitation.member_id));
}

function maybeMemberIds(match: MatchRow) {
  return uniqueIds((match.match_invitations || [])
    .filter(invitation => invitation.status === "maybe")
    .map(invitation => invitation.member_id));
}

function isMatchFull(match: MatchRow) {
  const maxPlayers = Number(match.max_players || 0);
  if (!maxPlayers) return false;
  return inMemberIds(match).length >= maxPlayers;
}

function teamNameByMemberId(match: MatchRow) {
  const map = new Map<string, string>();

  (match.match_teams || []).forEach(team => {
    (team.match_team_players || []).forEach(player => {
      if (player.member_id) map.set(player.member_id, team.name || "your team");
    });
  });

  return map;
}

function competitiveTeamLine(match: MatchRow, teamName: string) {
  const name = teamName || "your team";
  const templates = [
    `${name}, matchday. Go collect points and complaints.`,
    `${name}, time to make them regret the matchup.`,
    `${name}, your lineup is ready. Their confidence is optional.`,
    `${name}, make it look close, then end it.`,
    `${name}, bring the heat and leave them guessing.`,
    `Today’s plan for ${name}: pressure, patience, punishment.`,
    `${name}, save the excuses for them.`
  ];
  const index = Math.abs([...match.id, ...name].reduce((total, char) => total + char.charCodeAt(0), 0)) % templates.length;
  return templates[index];
}

function sameDayPayload(match: MatchRow, memberId: string) {
  const sport = match.sports?.name || "sport";
  const emoji = sportBallEmoji(sport);
  const venue = match.venues?.name ? ` at ${match.venues.name}` : "";
  const teamName = teamNameByMemberId(match).get(memberId);
  const body = teamName
    ? competitiveTeamLine(match, teamName)
    : `Matchday today${venue}. Bring your game face.`;

  return {
    title: "ABA Matchday",
    body: `${emoji} ${body}`,
    tag: `same-day-${match.id}-${memberId}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: `./index.html#matches?match=${match.id}`,
    data: {
      type: "same_day_match_reminder",
      match_id: match.id
    }
  };
}

function maybeDeadlinePayload(match: MatchRow) {
  const sport = match.sports?.name || "sport";
  const sportText = sport.toLowerCase();
  const emoji = sportBallEmoji(sport);
  const deadline = formatReminderTime(match.voting_deadline_at);
  const deadlineText = deadline ? ` before voting closes at ${deadline}` : " before voting closes";
  const templates = [
    `Still Maybe for ${sportText}. Spots are open; lock IN or OUT${deadlineText}.`,
    `${sportText} spots are still open. Decide${deadlineText}.`,
    `You’re still Maybe and the game needs clarity. Confirm${deadlineText}.`,
    `Last call: Maybe is not a lineup. Choose IN or OUT${deadlineText}.`,
    `The game is waiting on decisions. Are you IN or OUT${deadlineText}?`
  ];
  const index = Math.abs([...match.id].reduce((total, char) => total + char.charCodeAt(0), 0)) % templates.length;

  return {
    title: "ABA Vote Reminder",
    body: `${emoji} ${templates[index]}`,
    tag: `maybe-deadline-${match.id}`,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    url: `./index.html#matches?match=${match.id}`,
    data: {
      type: "maybe_vote_deadline_reminder",
      match_id: match.id
    }
  };
}

async function alreadyLogged(adminClient: ReturnType<typeof createClient>, eventType: string, matchId: string, memberId: string) {
  const { data, error } = await adminClient
    .from("notification_log")
    .select("id")
    .eq("event_type", eventType)
    .eq("match_id", matchId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function logSent(adminClient: ReturnType<typeof createClient>, eventType: string, matchId: string, memberId: string, metadata = {}) {
  const { error } = await adminClient
    .from("notification_log")
    .insert({
      event_type: eventType,
      match_id: matchId,
      member_id: memberId,
      metadata
    });

  if (error && String(error.code || "") !== "23505") throw error;
}

async function sendToMember(
  adminClient: ReturnType<typeof createClient>,
  subscriptionsByMember: Map<string, PushSubscriptionRow[]>,
  eventType: string,
  match: MatchRow,
  memberId: string,
  payload: Record<string, unknown>
) {
  if (await alreadyLogged(adminClient, eventType, match.id, memberId)) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const subscriptions = subscriptionsByMember.get(memberId) || [];
  if (!subscriptions.length) return { sent: 0, failed: 0, skipped: true };

  let sent = 0;
  let failed = 0;
  const payloadText = JSON.stringify(payload);

  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(subscription.subscription, payloadText);
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
        console.warn("Reminder push send failed:", error);
      }
    }
  }));

  if (sent > 0) {
    await logSent(adminClient, eventType, match.id, memberId, { sent });
  }

  return { sent, failed, skipped: false };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");
  const providedSecret = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") ||
    req.headers.get("x-cron-secret") ||
    "";

  if (!cronSecret) {
    return jsonResponse({ error: "REMINDER_CRON_SECRET is not configured." }, 500);
  }

  if (providedSecret !== cronSecret) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: "Reminder notification secrets are not configured." }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();
  const nowParts = zonedParts(now);
  const todayKey = zonedDateKey(now);
  const lookahead = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const { data: matches, error: matchesError } = await adminClient
    .from("matches")
    .select(`
      id,
      title,
      start_time,
      voting_deadline_at,
      status,
      score_status,
      max_players,
      sports(name),
      venues(name),
      match_invitations(member_id,status),
      match_teams(
        id,
        name,
        color,
        match_team_players(member_id)
      )
    `)
    .gte("start_time", now.toISOString())
    .lte("start_time", lookahead.toISOString());

  if (matchesError) {
    return jsonResponse({ error: matchesError.message }, 500);
  }

  const activeMatches = ((matches || []) as MatchRow[]).filter(isActiveMatch);
  const sameDayItems = nowParts.hour >= sameDayReminderHour
    ? activeMatches
      .filter(match => match.start_time && zonedDateKey(new Date(match.start_time)) === todayKey)
      .flatMap(match => inMemberIds(match).map(memberId => ({
        eventType: "same_day_match_reminder",
        match,
        memberId,
        payload: sameDayPayload(match, memberId)
      })))
    : [];
  const maybeDeadlineLimit = new Date(now.getTime() + maybeReminderWindowHours * 60 * 60 * 1000);
  const maybeItems = activeMatches
    .filter(match => {
      if (!match.voting_deadline_at || isMatchFull(match)) return false;
      const deadline = new Date(match.voting_deadline_at);
      return deadline > now && deadline <= maybeDeadlineLimit;
    })
    .flatMap(match => maybeMemberIds(match).map(memberId => ({
      eventType: "maybe_vote_deadline_reminder",
      match,
      memberId,
      payload: maybeDeadlinePayload(match)
    })));
  const items = [...sameDayItems, ...maybeItems];
  const memberIds = uniqueIds(items.map(item => item.memberId));

  if (!items.length || !memberIds.length) {
    return jsonResponse({
      sent: 0,
      failed: 0,
      skipped: true,
      same_day_candidates: sameDayItems.length,
      maybe_candidates: maybeItems.length
    });
  }

  const { data: subscriptions, error: subscriptionsError } = await adminClient
    .from("member_push_subscriptions")
    .select("id,member_id,subscription")
    .in("member_id", memberIds)
    .eq("enabled", true);

  if (subscriptionsError) {
    return jsonResponse({ error: subscriptionsError.message }, 500);
  }

  const subscriptionsByMember = new Map<string, PushSubscriptionRow[]>();
  ((subscriptions || []) as PushSubscriptionRow[]).forEach(subscription => {
    const rows = subscriptionsByMember.get(subscription.member_id) || [];
    rows.push(subscription);
    subscriptionsByMember.set(subscription.member_id, rows);
  });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items) {
    const result = await sendToMember(
      adminClient,
      subscriptionsByMember,
      item.eventType,
      item.match,
      item.memberId,
      item.payload
    );

    sent += result.sent;
    failed += result.failed;
    if (result.skipped) skipped += 1;
  }

  return jsonResponse({
    sent,
    failed,
    skipped,
    same_day_candidates: sameDayItems.length,
    maybe_candidates: maybeItems.length
  });
});
