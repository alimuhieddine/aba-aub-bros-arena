import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-garmin-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type GarminActivity = {
  id?: string;
  activityId?: string;
  summaryId?: string;
  activityName?: string;
  activityType?: string;
  sport?: string;
  startTimeInSeconds?: number;
  startTimeOffsetInSeconds?: number;
  startTime?: string;
  durationInSeconds?: number;
  duration?: number;
  distanceInMeters?: number;
  calories?: number;
  url?: string;
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

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function activityExternalId(activity: GarminActivity) {
  return cleanText(activity.activityId || activity.summaryId || activity.id);
}

function garminUserIdFromBody(body: Record<string, unknown>) {
  return cleanText(body.userId || body.user_id || body.garminUserId || body.garmin_user_id);
}

function activitiesFromBody(body: Record<string, unknown>): GarminActivity[] {
  const direct = body.activities || body.activityDetails || body.summaries;
  if (Array.isArray(direct)) return direct as GarminActivity[];
  if (body.activity && typeof body.activity === "object") return [body.activity as GarminActivity];
  return [];
}

function normalizedActivityType(activity: GarminActivity) {
  return cleanText(activity.activityType || activity.sport).toLowerCase();
}

function candidateSportNames(activity: GarminActivity) {
  const type = normalizedActivityType(activity);
  if (type.includes("run")) return ["Running", "Run"];
  if (type.includes("cycl") || type.includes("bike")) return ["Cycling", "Bike"];
  if (type.includes("swim")) return ["Swimming", "Swim"];
  if (type.includes("strength") || type.includes("training") || type.includes("gym")) return ["Gym", "Strength Training"];
  if (type.includes("walk")) return ["Walking", "Walk"];
  if (type.includes("yoga")) return ["Yoga"];
  if (type.includes("padel")) return ["Padel"];
  if (type.includes("soccer") || type.includes("football")) return ["Soccer", "Football"];
  return [cleanText(activity.activityType || activity.sport || "Activity")].filter(Boolean);
}

function startDate(activity: GarminActivity) {
  if (activity.startTime) {
    const parsed = new Date(activity.startTime);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const seconds = Number(activity.startTimeInSeconds || 0);
  const offset = Number(activity.startTimeOffsetInSeconds || 0);
  if (seconds > 0) return new Date((seconds + offset) * 1000);
  return new Date();
}

function datePart(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timePart(date: Date) {
  return date.toISOString().slice(11, 19);
}

function activityDurationMinutes(activity: GarminActivity) {
  const seconds = Number(activity.durationInSeconds || activity.duration || 0);
  return Math.max(1, Math.round(seconds / 60));
}

function defaultSettingForSportName(name: string) {
  const lower = name.toLowerCase();
  if (/(gym|weight|volley|strength)/.test(lower)) return { rate: 0.7, cap: 3 };
  if (/(walk|stretch|yoga)/.test(lower)) return { rate: 0.3, cap: 3 };
  return { rate: 1, cap: 3 };
}

function settingForSport(settings: Record<string, { rate?: number; cap?: number }>, sportId: string, sportName: string) {
  const configured = settings?.[sportId] || {};
  const fallback = defaultSettingForSportName(sportName);
  return {
    rate: Number(configured.rate ?? fallback.rate),
    cap: Number(configured.cap ?? fallback.cap)
  };
}

function pointsFor(minutes: number, setting: { rate: number; cap: number }) {
  const raw = (minutes / 30) * Number(setting.rate || 0);
  return Math.round(Math.min(Number(setting.cap || 3), Math.max(0, raw)) * 100) / 100;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("GARMIN_WEBHOOK_SECRET") || "";
  if (!webhookSecret) {
    return jsonResponse({ error: "Garmin webhook secret is not configured." }, 503);
  }

  const provided = request.headers.get("x-garmin-webhook-secret") || "";
  if (provided !== webhookSecret) {
    return jsonResponse({ error: "Invalid Garmin webhook secret." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const garminUserId = garminUserIdFromBody(body);
  const activities = activitiesFromBody(body);

  if (!garminUserId || !activities.length) {
    return jsonResponse({
      imported: 0,
      skipped: activities.length,
      error: "Expected garmin user id and at least one activity."
    }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: connection, error: connectionError } = await adminClient
    .from("member_garmin_connections")
    .select("id,member_id,status,last_activity_at")
    .eq("garmin_user_id", garminUserId)
    .maybeSingle();

  if (connectionError) return jsonResponse({ error: connectionError.message }, 500);
  if (!connection || connection.status !== "connected") {
    return jsonResponse({ imported: 0, skipped: activities.length, error: "Garmin user is not linked." }, 404);
  }

  const { data: sports } = await adminClient
    .from("sports")
    .select("id,name");

  const { data: settingsRow } = await adminClient
    .from("app_settings")
    .select("value")
    .eq("key", "activity_sport_settings")
    .maybeSingle();

  const settings = (settingsRow?.value || {}) as Record<string, { rate?: number; cap?: number }>;
  const sportRows = sports || [];
  const imported: unknown[] = [];
  const skipped: unknown[] = [];

  for (const activity of activities) {
    const externalId = activityExternalId(activity);
    if (!externalId) {
      skipped.push({ reason: "missing_external_id", activity });
      continue;
    }

    const sport = sportRows.find(row =>
      candidateSportNames(activity).some(name => row.name.toLowerCase() === name.toLowerCase())
    );

    if (!sport) {
      skipped.push({
        externalId,
        reason: "sport_not_mapped",
        activityType: activity.activityType || activity.sport || null
      });
      continue;
    }

    const start = startDate(activity);
    const minutes = activityDurationMinutes(activity);
    const end = new Date(start.getTime() + minutes * 60000);
    const setting = settingForSport(settings, sport.id, sport.name);
    const points = pointsFor(minutes, setting);
    const title = cleanText(activity.activityName) || `Garmin ${sport.name}`;
    const distanceKm = Number(activity.distanceInMeters || 0) > 0
      ? `${(Number(activity.distanceInMeters) / 1000).toFixed(2)} km`
      : "";
    const calories = Number(activity.calories || 0) > 0
      ? `${Math.round(Number(activity.calories))} cal`
      : "";
    const details = [distanceKm, calories].filter(Boolean).join(" - ");

    const { data: row, error } = await adminClient
      .from("member_activities")
      .upsert({
        member_id: connection.member_id,
        sport_id: sport.id,
        title,
        activity_date: datePart(start),
        start_time: timePart(start),
        end_time: timePart(end),
        duration_minutes: minutes,
        activity_points: points,
        proof_path: null,
        proof_file_name: "Garmin Connect",
        notes: details ? `Imported from Garmin Connect. ${details}.` : "Imported from Garmin Connect.",
        status: "pending",
        source: "garmin",
        external_source_id: externalId,
        external_url: activity.url || null,
        external_payload: activity
      }, {
        onConflict: "source,external_source_id"
      })
      .select("id")
      .single();

    if (error) {
      skipped.push({ externalId, reason: error.message });
    } else {
      imported.push(row);
    }
  }

  await adminClient
    .from("member_garmin_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_activity_at: imported.length ? new Date().toISOString() : connection.last_activity_at,
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);

  return jsonResponse({
    imported: imported.length,
    skipped: skipped.length,
    skippedDetails: skipped
  });
});
