import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type StravaActivity = {
  id?: number | string;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  start_date_local?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  calories?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  total_elevation_gain?: number;
  elev_high?: number;
  elev_low?: number;
  average_speed?: number;
  max_speed?: number;
  achievement_count?: number;
  kudos_count?: number;
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

function candidateSportNames(activity: StravaActivity) {
  const type = cleanText(activity.sport_type || activity.type).toLowerCase();
  if (type.includes("run")) return ["Running", "Run"];
  if (type.includes("ride") || type.includes("bike") || type.includes("cycl")) return ["Cycling", "Bike"];
  if (type.includes("swim")) return ["Swimming", "Swim"];
  if (type.includes("walk") || type.includes("hike")) return ["Walking", "Walk"];
  if (type.includes("workout") || type.includes("weight") || type.includes("training")) return ["Gym", "Strength Training"];
  if (type.includes("yoga")) return ["Yoga"];
  if (type.includes("soccer") || type.includes("football")) return ["Soccer", "Football"];
  if (type.includes("tennis")) return ["Tennis"];
  if (type.includes("padel")) return ["Padel"];
  return [cleanText(activity.sport_type || activity.type || "Activity")].filter(Boolean);
}

function startDate(activity: StravaActivity) {
  const value = activity.start_date_local || activity.start_date;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
}

function datePart(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timePart(date: Date) {
  return date.toISOString().slice(11, 19);
}

function durationMinutes(activity: StravaActivity) {
  const seconds = Number(activity.moving_time || activity.elapsed_time || 0);
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

function stravaBasePoints(minutes: number, setting: { rate: number; cap: number }) {
  const rate = Number(setting.rate || 0);
  if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(((minutes / 90) * 3 * rate) * 100) / 100;
}

function memberWeightKg(connection: any) {
  const direct = Number(connection?.weight_kg || 0);
  const embedded = Number(connection?.member?.weight_kg || 0);
  if (Number.isFinite(direct) && direct >= 30 && direct <= 250) return direct;
  if (Number.isFinite(embedded) && embedded >= 30 && embedded <= 250) return embedded;
  return 75;
}

function hasRecordedWeight(connection: any) {
  const weight = Number(connection?.weight_kg || connection?.member?.weight_kg || 0);
  return Number.isFinite(weight) && weight >= 30 && weight <= 250;
}

function stravaActivityPoints(activity: StravaActivity, connection: any, setting: { rate: number; cap: number }) {
  const calories = Number(activity.calories || 0);
  const minutes = durationMinutes(activity);
  const basePoints = stravaBasePoints(minutes, setting);

  if (!Number.isFinite(calories) || calories <= 0) return basePoints;

  const hours = minutes / 60;
  const weight = memberWeightKg(connection);
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(weight) || weight <= 0) return basePoints;

  const metEstimate = calories / (weight * hours);
  const normalized = (metEstimate - 4) / 6;
  const bonus = Math.max(0, Math.min(1, normalized));

  return Math.round((basePoints + bonus) * 100) / 100;
}

function verificationForActivity(activity: StravaActivity, minutes: number, connection: any) {
  const calories = Number(activity.calories || 0);
  const distanceMeters = Number(activity.distance || 0);
  const hasWeight = hasRecordedWeight(connection);
  const hasWearableEffort = calories >= 30;
  const hasMovement = distanceMeters >= 200;
  const durationOk = minutes >= 10 && minutes <= 360;
  const approved = hasWeight && durationOk && (hasWearableEffort || hasMovement);
  const metrics = [
    `${minutes} min`,
    calories > 0 ? `${Math.round(calories)} cal` : "",
    hasWeight ? `${memberWeightKg(connection).toFixed(1)} kg` : "missing weight",
    distanceMeters > 0 ? `${(distanceMeters / 1000).toFixed(2)} km` : ""
  ].filter(Boolean).join(" - ");

  return {
    status: approved ? "approved" : "pending",
    reviewNotes: approved
      ? `Auto-approved from Strava duration plus wearable-effort bonus formula: ${metrics}.`
      : `Pending review: Strava metrics did not meet auto-approval rules (${metrics || "missing metrics"}).`
  };
}

async function refreshedAccessToken(adminClient: ReturnType<typeof createClient>, connectionId: string, tokenRow: any) {
  const expiresAt = new Date(tokenRow.access_token_expires_at || 0).getTime();
  if (expiresAt > Date.now() + 60_000) return String(tokenRow.access_token || "");

  const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID") || "";
  const stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET") || "";
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token
    })
  });

  if (!response.ok) return "";

  const token = await response.json();
  const accessToken = String(token.access_token || "");
  const refreshToken = String(token.refresh_token || tokenRow.refresh_token || "");
  const expires = new Date(Number(token.expires_at || Math.floor(Date.now() / 1000) + 21600) * 1000).toISOString();

  if (!accessToken || !refreshToken) return "";

  await adminClient
    .from("member_strava_tokens")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: expires,
      token_type: token.token_type || tokenRow.token_type || "Bearer",
      scope: token.scope || tokenRow.scope || null,
      updated_at: new Date().toISOString()
    })
    .eq("connection_id", connectionId);

  return accessToken;
}

async function importRecentForConnection(
  adminClient: ReturnType<typeof createClient>,
  connection: any,
  days: number,
  sportRows: Array<{ id: string; name: string }>,
  settings: Record<string, { rate?: number; cap?: number }>
) {
  const { data: tokenRow, error: tokenError } = await adminClient
    .from("member_strava_tokens")
    .select("access_token,refresh_token,access_token_expires_at,token_type,scope")
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return {
      imported: 0,
      skipped: 1,
      total: 0,
      skippedDetails: [{ reason: tokenError?.message || "missing_token", connectionId: connection.id }]
    };
  }

  const accessToken = await refreshedAccessToken(adminClient, connection.id, tokenRow);
  if (!accessToken) {
    return {
      imported: 0,
      skipped: 1,
      total: 0,
      skippedDetails: [{ reason: "refresh_failed", connectionId: connection.id }]
    };
  }

  const after = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  const activityResponse = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!activityResponse.ok) {
    const message = await activityResponse.text().catch(() => "");
    return {
      imported: 0,
      skipped: 1,
      total: 0,
      skippedDetails: [{ reason: message || "load_failed", status: activityResponse.status, connectionId: connection.id }]
    };
  }

  const activities = await activityResponse.json().catch(() => []) as StravaActivity[];
  const imported: unknown[] = [];
  const skipped: unknown[] = [];

  for (const activity of activities) {
    const externalId = cleanText(activity.id);
    if (!externalId) {
      skipped.push({ reason: "missing_external_id", activity });
      continue;
    }

    const detailResponse = await fetch(`https://www.strava.com/api/v3/activities/${externalId}?include_all_efforts=false`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const detailedActivity = detailResponse.ok
      ? await detailResponse.json().catch(() => activity) as StravaActivity
      : activity;

    const sport = sportRows.find(row =>
      candidateSportNames(detailedActivity).some(name => row.name.toLowerCase() === name.toLowerCase())
    );

    if (!sport) {
      skipped.push({
        externalId,
        reason: "sport_not_mapped",
        activityType: detailedActivity.sport_type || detailedActivity.type || null
      });
      continue;
    }

    const start = startDate(detailedActivity);
    const minutes = durationMinutes(detailedActivity);
    const end = new Date(start.getTime() + minutes * 60000);
    const points = stravaActivityPoints(
      detailedActivity,
      connection,
      settingForSport(sharedSettings, sport.id, sport.name)
    );
    const distanceKm = Number(detailedActivity.distance || 0) > 0
      ? `${(Number(detailedActivity.distance) / 1000).toFixed(2)} km`
      : "";
    const calories = Number(detailedActivity.calories || 0) > 0
      ? `${Math.round(Number(detailedActivity.calories))} cal`
      : "";
    const averageHeartRate = Number(detailedActivity.average_heartrate || 0) > 0
      ? `${Math.round(Number(detailedActivity.average_heartrate))} avg HR`
      : "";
    const details = [distanceKm, calories, averageHeartRate].filter(Boolean).join(" - ");
    const verification = verificationForActivity(detailedActivity, minutes, connection);

    const { data: row, error } = await adminClient
      .from("member_activities")
      .upsert({
        member_id: connection.member_id,
        sport_id: sport.id,
        title: cleanText(detailedActivity.name) || `Strava ${sport.name}`,
        activity_date: datePart(start),
        start_time: timePart(start),
        end_time: timePart(end),
        duration_minutes: minutes,
        activity_points: points,
        proof_path: null,
        proof_file_name: "Strava",
        notes: details ? `Imported from Strava. ${details}.` : "Imported from Strava.",
        status: verification.status,
        review_notes: verification.reviewNotes,
        reviewed_at: verification.status === "approved" ? new Date().toISOString() : null,
        source: "strava",
        external_source_id: externalId,
        external_url: `https://www.strava.com/activities/${externalId}`,
        external_payload: detailedActivity
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
    .from("member_strava_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_activity_at: imported.length ? new Date().toISOString() : connection.last_activity_at,
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);

  return {
    imported: imported.length,
    skipped: skipped.length,
    total: activities.length,
    skippedDetails: skipped
  };
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
  const requestBody = await request.json().catch(() => ({}));
  const days = Math.min(90, Math.max(1, Number(requestBody.days || 14)));
  const syncSecret = Deno.env.get("STRAVA_SYNC_SECRET") || "";
  const providedSyncSecret = (authHeader || "").replace(/^Bearer\s+/i, "") ||
    request.headers.get("x-strava-sync-secret") ||
    "";
  const isScheduledSync = Boolean(syncSecret && providedSyncSecret === syncSecret);

  const { data: allSports } = await adminClient
    .from("sports")
    .select("id,name");
  const { data: activitySettingsRow } = await adminClient
    .from("app_settings")
    .select("value")
    .eq("key", "activity_sport_settings")
    .maybeSingle();
  const sharedSettings = (activitySettingsRow?.value || {}) as Record<string, { rate?: number; cap?: number }>;
  const sharedSportRows = allSports || [];

  if (isScheduledSync) {
    const { data: connections, error: connectionsError } = await adminClient
      .from("member_strava_connections")
      .select("id,member_id,status,last_activity_at,member:members!member_strava_connections_member_id_fkey(weight_kg)")
      .eq("status", "connected");

    if (connectionsError) return jsonResponse({ error: connectionsError.message }, 500);

    const results = [];
    for (const connection of connections || []) {
      results.push(await importRecentForConnection(adminClient, connection, days, sharedSportRows, sharedSettings));
    }

    return jsonResponse({
      connections: results.length,
      imported: results.reduce((sum, row) => sum + Number(row.imported || 0), 0),
      skipped: results.reduce((sum, row) => sum + Number(row.skipped || 0), 0),
      total: results.reduce((sum, row) => sum + Number(row.total || 0), 0),
      results
    });
  }

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

  const { data: connection, error: connectionError } = await adminClient
    .from("member_strava_connections")
    .select("id,member_id,status,last_activity_at,member:members!member_strava_connections_member_id_fkey(weight_kg)")
    .eq("member_id", member.id)
    .maybeSingle();

  if (connectionError) return jsonResponse({ error: connectionError.message }, 500);
  if (!connection || connection.status !== "connected") {
    return jsonResponse({ imported: 0, skipped: 0, error: "Strava is not connected." }, 404);
  }

  const result = await importRecentForConnection(adminClient, connection, days, sharedSportRows, sharedSettings);
  return jsonResponse(result);
});
