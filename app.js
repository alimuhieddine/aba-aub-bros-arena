const SUPABASE_URL = "https://welleqrjtlullhbdhive.supabase.co";
const SUPABASE_KEY = "sb_publishable_e_Pu1JLmyXBKJnMvR5guXQ_GzvFcdK-";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "aba_phase1_data";
const PUSH_NOTIFICATIONS_APP_SETTING_KEY = "push_notifications";

function futureDate(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const demoData = {
  leagues: [
    { id: crypto.randomUUID(), name: "ABA Padel League", sport: "Padel", format: "Doubles race to 10", createdAt: Date.now() },
    { id: crypto.randomUUID(), name: "Friday Football Table", sport: "Soccer", format: "5v5 weekly ranking", createdAt: Date.now() }
  ],
  matches: [
    { id: crypto.randomUUID(), sport: "Padel", title: "Wolf & Fox vs Green Pigs", type: "League", date: futureDate(2, 20), venue: "The Padict Club", address: "Beirut", comments: ["Revenge match loading 😂"] },
    { id: crypto.randomUUID(), sport: "Soccer", title: "ABA Friday 5v5", type: "Friendly", date: futureDate(5, 21), venue: "AUB Green Field", address: "AUB, Beirut", comments: [] }
  ],
  activities: [
    { id: crypto.randomUUID(), player: "Ali", sport: "Padel", activity: "90 min padel session", proof: "Smartwatch screenshot", durationMinutes: 90, points: 3, approvals: ["Committee 1", "Committee 2"], createdAt: Date.now() - 86400000 },
    { id: crypto.randomUUID(), player: "Hammoudi", sport: "Gym", activity: "Leg day + cardio", proof: "Gym photo", durationMinutes: 60, points: 2, approvals: ["Committee 1"], createdAt: Date.now() - 3600000 }
  ]
};

async function loadSportsOptions() {
  if (!isCurrentUserAdmin()) return;

  const { data, error } = await supabaseClient
    .from("sports")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) {
    alert(error.message);
    return;
  }

  allSports = data || [];

  const box = $("venue-sports-options");
  if (!box) return;

  if (allSports.length === 0) {
    box.innerHTML = "No sports found.";
    return;
  }

  box.innerHTML = allSports.map(sport => `
    <label class="sport-chip">
      <input type="checkbox" value="${sport.id}" class="venue-sport-checkbox">
      <span>${escapeHtml(sport.name)}</span>
    </label>
  `).join("");
}
function getSelectedVenueSportIds() {
  return Array.from(document.querySelectorAll(".venue-sport-checkbox"))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function setSelectedVenueSports(sportIds) {
  const selected = new Set(sportIds || []);

  document.querySelectorAll(".venue-sport-checkbox").forEach(cb => {
    cb.checked = selected.has(cb.value);
  });
}

async function saveVenueSports(venueId, sportIds) {
  if (!venueId) {
    alert("Venue id missing. Cannot save sports.");
    return false;
  }

  const { error: deleteError } = await supabaseClient
    .from("venue_sports")
    .delete()
    .eq("venue_id", venueId);

  if (deleteError) {
    alert(deleteError.message);
    return false;
  }

  if (!sportIds || sportIds.length === 0) {
    return true;
  }

  const rows = ABAVenues.venueSportRows(venueId, sportIds);

  const { error: insertError } = await supabaseClient
    .from("venue_sports")
    .insert(rows);

  if (insertError) {
    alert(insertError.message);
    return false;
  }

  return true;
}

async function loadVenues() {
  if (!isCurrentUserAdmin()) return;

  const { data, error } = await supabaseClient
    .from("venues")
    .select(ABAVenues.venueSelect())
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  allVenues = data || [];
  const box = $("venuesList");
  if (!box) return;

  if (!data || data.length === 0) {
    box.innerHTML = `<article class="card">No venues added yet.</article>`;
    return;
  }

  box.innerHTML = data.map(venue => {
    const sportNames = ABAVenues.sportNamesForVenue(venue);

    return `
  <article class="card venue-card">
    <div class="venue-row">

      <div class="venue-thumb">
        ${
          venue.image_url
            ? `<img src="${escapeHtml(venue.image_url)}" alt="${escapeHtml(venue.name || "Venue")}">`
            : `<div class="venue-placeholder">No Image</div>`
        }
      </div>

      <div class="venue-info">
        <div class="venue-main">
          <h3>${escapeHtml(venue.name || "Unnamed venue")}</h3>
          <div class="meta">${escapeHtml(venue.address || "-")}</div>
          <div class="meta">
            Sports: ${sportNames.length ? escapeHtml(sportNames.join(", ")) : "-"}
          </div>
          ${ABAVenues.mapLinkHtml(venue.google_maps_url)}
        </div>

        <div class="venue-side">
          <span class="pill ${ABAVenues.venueStatusClass(venue)}">
            ${ABAVenues.venueStatusText(venue)}
          </span>

          <button
            class="small-btn"
            onclick="editVenue('${venue.id}')"
          >
            Edit
          </button>

          <button
            class="small-btn"
            onclick="toggleVenueActive('${venue.id}', ${venue.is_active})"
          >
            ${venue.is_active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>

    </div>
  </article>
`;
  }).join("");
}

function clearVenueForm() {
  if ($("venue-name")) $("venue-name").value = "";
  if ($("venue-address")) $("venue-address").value = "";
  if ($("venue-google-maps-url")) $("venue-google-maps-url").value = "";
  if ($("venue-map-url")) $("venue-map-url").value = "";
  if ($("venue-image-url")) $("venue-image-url").value = "";

  setSelectedVenueSports([]);

  editingVenueId = null;

  const btn = $("add-venue-btn");
  if (btn) btn.textContent = "Add Venue";
}

function editVenue(id) {
  const venue = allVenues.find(v => v.id === id);

  if (!venue) {
    alert("Venue not found.");
    return;
  }

  editingVenueId = id;

  if ($("venue-name")) $("venue-name").value = venue.name || "";
  if ($("venue-address")) $("venue-address").value = venue.address || "";
  if ($("venue-google-maps-url")) $("venue-google-maps-url").value = venue.google_maps_url || "";
  if ($("venue-map-url")) $("venue-map-url").value = venue.google_maps_url || "";
  if ($("venue-image-url")) $("venue-image-url").value = venue.image_url || "";

  const sportIds = ABAVenues.sportIdsForVenue(venue);

  setSelectedVenueSports(sportIds);

  const btn = $("add-venue-btn");
  if (btn) btn.textContent = "Update Venue";

  $("venue-name")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function toggleVenueActive(id, currentStatus) {
  if (!isCurrentUserAdmin()) {
    alert("Admin access required.");
    return;
  }

  const { error } = await supabaseClient
    .from("venues")
    .update({
      is_active: !currentStatus
    })
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadVenues();
}

async function saveVenue() {
  if (!isCurrentUserAdmin()) {
    alert("Admin access required.");
    return;
  }

  const name = $("venue-name")?.value.trim() || "";
  const address = $("venue-address")?.value.trim() || "";
  const googleMapsUrl =
    $("venue-google-maps-url")?.value.trim() ||
    $("venue-map-url")?.value.trim() ||
    "";
  const imageUrl = $("venue-image-url")?.value.trim() || "";

  if (!name) {
    alert("Venue name is required.");
    return;
  }

  const venue = ABAVenues.venuePayload({ name, address, googleMapsUrl, imageUrl });

  let result;

  if (editingVenueId) {
    result = await supabaseClient
      .from("venues")
      .update(venue)
      .eq("id", editingVenueId)
      .select();
  } else {
    result = await supabaseClient
      .from("venues")
      .insert({
        ...venue,
        is_active: true
      })
      .select();
  }

  const { data, error } = result;

  console.log("SAVE VENUE DATA:", data);
  console.log("SAVE VENUE ERROR:", error);

  if (error) {
    alert(error.message);
    return;
  }

  const venueId = editingVenueId || data?.[0]?.id;
  const selectedSportIds = getSelectedVenueSportIds();

  const sportsSaved = await saveVenueSports(venueId, selectedSportIds);
  if (!sportsSaved) return;

  const wasEditing = Boolean(editingVenueId);

  clearVenueForm();

  alert(wasEditing ? "Venue updated." : "Venue added.");
  await loadVenues();
}


function isCurrentUserAdmin() {
  return currentProfile &&
    currentProfile.role === "admin" &&
    currentProfile.approval_status === "approved";
}

async function loadPendingMembers() {
  if (!isCurrentUserAdmin()) return;

  const { data, error } = await supabaseClient
    .from("members")
    .select(ABAAdmin.pendingMemberSelect())
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  const box = $("pendingMembersList");
  if (!box) return;

  if (!data || data.length === 0) {
    box.innerHTML = `<article class="card">No pending profiles.</article>`;
    return;
  }

  box.innerHTML = data.map(member => `
    <article class="card">
      <div class="row">
        <div>
          <h3>${escapeHtml(member.display_name || "Unnamed")}</h3>
          <div class="meta">
            ${escapeHtml(member.first_name || "")}
            ${escapeHtml(member.last_name || "")}
          </div>
          <div class="meta">${escapeHtml(member.email || "")}</div>
          <div class="meta">Phone: ${escapeHtml(member.phone || "-")}</div>
          <div class="meta">Birth Date: ${escapeHtml(member.birth_date || "-")}</div>
        </div>

        <span class="pill red">Pending</span>
      </div>

      <div class="actions">
        <button class="small-btn" onclick="reviewMember('${member.id}', 'approved')">
          Approve
        </button>

        <button class="small-btn" onclick="reviewMember('${member.id}', 'rejected')">
          Reject
        </button>
      </div>
    </article>
  `).join("");
}


async function reviewMember(memberId, decision) {
  if (!isCurrentUserAdmin()) {
    alert("Admin access required.");
    return;
  }

  const { error } = await supabaseClient
    .from("members")
    .update(ABAAdmin.memberReviewPayload(decision, currentProfile.id))
    .eq("id", memberId);

  if (error) {
    alert(error.message);
    return;
  }

  alert(`Member ${decision}.`);
  await loadPendingMembers();
}














function applyAccessUI() {
  const appTabs = ["dashboard", "leagues", "matches", "activities", "rankings"];
  const status = currentProfile?.approval_status;

  // Hide normal app tabs by default for logged-in users until approved.
  appTabs.forEach(viewId => {
    const tab = document.querySelector(`[data-view="${viewId}"]`);
    if (tab) tab.style.display = "none";
  });

  // Hide Admin tab by default.
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = "none";
  });

  // No profile yet, pending, rejected, or suspended: Account only.
  if (!currentProfile || status === "pending" || status === "rejected" || status === "suspended") {
    const accountTab = document.querySelector('[data-view="account"]');
    const accountView = $("account");

    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active-view"));

    if (accountTab) accountTab.classList.add("active");
    if (accountView) accountView.classList.add("active-view");
    return;
  }

  // Approved users can see the normal app tabs.
  if (status === "approved") {
    appTabs.forEach(viewId => {
      const tab = document.querySelector(`[data-view="${viewId}"]`);
      if (tab) tab.style.display = "";
    });
  }

  // Approved admins can see the Admin tab.
  if (isCurrentUserAdmin()) {
    document.querySelectorAll(".admin-only").forEach(el => {
      el.style.display = "";
    });
  }
}

function resetAppTabsForLoggedOut() {
  ["dashboard", "leagues", "matches", "activities", "rankings"].forEach(viewId => {
    const tab = document.querySelector(`[data-view="${viewId}"]`);
    if (tab) tab.style.display = "";
  });

  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = "none";
  });
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(demoData);

  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(demoData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();
let currentProfile = null;
let profileIsEditing = false;
let editingVenueId = null;
let allSports = [];
let allVenues = [];
let allMatches = [];
let allLeagues = [];
let editingLeagueId = null;
let editingMatchId = null;
let allMembers = [];
let allExternalMembers = [];
let allSportProfiles = [];
let allPositionRatings = [];
let currentExternalMatchId = null;
let currentTeamMatchId = null;
let currentTeamEditScope = "full";
let currentScoreMatchId = null;
let currentRatingHistoryMemberId = null;
let currentRatingHistorySportId = null;
let allPendingGames = [];
let allMemberActivities = [];
let allRankingPointRows = [];
let allRankingActivityRows = [];
let activitySportSettingsCache = {};
let activitySportSettingsLoadPromise = null;
let editingActivityId = null;
let voteDeadlineManuallyEdited = false;

const ACTIVITY_SPORT_SETTINGS_KEY = "aba_activity_sport_settings";
const ACTIVITY_SPORT_APP_SETTING_KEY = "activity_sport_settings";
const ACTIVITY_PROOF_BUCKET = "activity-proofs";
const DEFAULT_ACTIVITY_RATE = 1;
const DEFAULT_ACTIVITY_CAP = 3;
const MEMBER_ACTIVITY_SELECT = `
  id,
  member_id,
  sport_id,
  title,
  activity_date,
  start_time,
  end_time,
  duration_minutes,
  activity_points,
  proof_path,
  proof_file_name,
  notes,
  status,
  review_notes,
  reviewed_by,
  reviewed_at,
  created_at,
  members (
    id,
    first_name,
    last_name,
    display_name,
    email,
    is_external
  ),
  sports (
    id,
    name
  )
`;




function updateLeagueSportOptions() {
  const select = $("league-sport");
  if (!select) return;

  select.innerHTML = `
    <option value="">Select sport</option>
    ${(allSports || []).map(sport => `
      <option value="${sport.id}">${escapeHtml(sport.name)}</option>
    `).join("")}
  `;
}

function isLeagueMatchSelected() {
  return $("match-type")?.value === "league";
}

function updateMatchLeagueOptions() {
  const label = $("match-league-label");
  const select = $("match-league");
  const sportId = $("match-sport")?.value || "";

  if (!label || !select) return;

  const show = isLeagueMatchSelected();
  label.style.display = show ? "" : "none";

  if (!show) {
    select.value = "";
    return;
  }

  const activeLeagues = (allLeagues || []).filter(league =>
    (!sportId || league.sport_id === sportId) &&
    (league.status || "active") === "active"
  );

  select.innerHTML = activeLeagues.length
    ? `
      <option value="">Select league</option>
      ${activeLeagues.map(league => `
        <option value="${league.id}">${escapeHtml(league.name)}</option>
      `).join("")}
    `
    : `<option value="">No active league for this sport</option>`;
}



async function loadPositionRatings() {
  if (!currentProfile || currentProfile.approval_status !== "approved") return [];

  const { data, error } = await supabaseClient
    .from("member_sport_position_ratings")
    .select(`
      id,
      member_id,
      sport_id,
      position_name,
      rating,
      games_played,
      created_at,
      updated_at,
      members (
        id,
        first_name,
        last_name,
        display_name,
        email,
        is_external
      ),
      sports (
        id,
        name
      )
    `);

  if (error) {
    console.warn("Could not load position ratings:", error.message);
    allPositionRatings = [];
    return [];
  }

  allPositionRatings = data || [];
  return allPositionRatings;
}

function positionRatingForMember(memberId, sportId, positionName) {
  const cleanPosition = normalizeSoccerPosition(positionName);

  const ratingRow = (allPositionRatings || []).find(row =>
    row.member_id === memberId &&
    row.sport_id === sportId &&
    normalizeSoccerPosition(row.position_name) === cleanPosition
  );

  const rating = Number(ratingRow?.rating);

  if (Number.isFinite(rating) && rating > 0) return rating;

  return memberSportRating(memberId, sportId);
}

function soccerPositionRankingRows(sportId, positionName) {
  const cleanPosition = normalizeSoccerPosition(positionName);

  const rows = (allPositionRatings || [])
    .filter(row =>
      row.sport_id === sportId &&
      normalizeSoccerPosition(row.position_name) === cleanPosition
    )
    .map(row => ({
      memberId: row.member_id,
      member: row.members,
      name: memberDisplayName(row.members),
      isExternal: Boolean(row.members?.is_external),
      rating: Number(row.rating || 0),
      gamesPlayed: Number(row.games_played || 0)
    }))
    .filter(row => row.memberId && row.rating > 0);

  return rows.sort((a, b) =>
    b.rating - a.rating ||
    b.gamesPlayed - a.gamesPlayed ||
    a.name.localeCompare(b.name)
  );
}

function selectedRankingSport() {
  const sportId = $("rank-sport-filter")?.value || "all";
  if (sportId !== "all") return sportId;

  const soccerSport = (allSports || []).find(sport =>
    String(sport.name || "").toLowerCase().includes("soccer") ||
    String(sport.name || "").toLowerCase().includes("football")
  );

  return soccerSport?.id || "";
}

function selectedRankingSportName() {
  const sportId = selectedRankingSport();
  const sport = (allSports || []).find(s => s.id === sportId);

  return sport?.name || "";
}

function shouldShowSoccerPositionRankings() {
  const sportId = selectedRankingSport();

  if (!sportId) return false;

  const sport = (allSports || []).find(s => s.id === sportId);
  const name = String(sport?.name || "").toLowerCase();

  return name.includes("soccer") || name.includes("football");
}

function renderPositionRankings() {
  if (!shouldShowSoccerPositionRankings()) return "";

  const sportId = selectedRankingSport();
  const sportName = selectedRankingSportName() || "Soccer";

  return `
    <article class="card position-rankings-card">
      <div class="section-head mini-section-head">
        <div>
          <h3>Position Rankings</h3>
          <p class="hint">${escapeHtml(sportName)} position-specific ratings.</p>
        </div>
      </div>

      <div class="position-ranking-grid">
        ${SOCCER_POSITIONS.map(position => {
          const rows = soccerPositionRankingRows(sportId, position);

          return `
            <div class="position-ranking-box">
              <div class="position-ranking-title">${escapeHtml(position)}</div>

              ${
                rows.length
                  ? rows.slice(0, 10).map((row, index) => `
                    <div class="position-ranking-row">
                      <span>${index + 1}</span>
                      <strong>${playerLinkHtml(row.memberId, row.name)}</strong>
                      ${row.isExternal ? `<em>External</em>` : ""}
                      <b>${row.rating.toFixed(1)}</b>
                    </div>
                  `).join("")
                  : `<div class="hint">No ${escapeHtml(position)} ratings yet.</div>`
              }
            </div>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

async function loadSportProfiles() {
  if (!currentProfile || currentProfile.approval_status !== "approved") return [];

  const { data, error } = await supabaseClient
    .from("member_sport_profiles")
    .select(`
      id,
      member_id,
      sport_id,
      rating,
      preferred_position,
      games_played,
      wins,
      losses,
      draws,
      total_points,
      members (
        id,
        first_name,
        last_name,
        display_name,
        email,
        is_external
      ),
      sports (
        id,
        name
      )
    `);

  if (error) {
    console.warn("Could not load sport profiles:", error.message);
    allSportProfiles = [];
    return [];
  }

  allSportProfiles = data || [];
  return allSportProfiles;
}

function sportProfileForMember(memberId, sportId) {
  return (allSportProfiles || []).find(profile =>
    profile.member_id === memberId && profile.sport_id === sportId
  ) || null;
}

function memberSportRating(memberId, sportId) {
  const profile = sportProfileForMember(memberId, sportId);
  const rating = Number(profile?.rating);

  return Number.isFinite(rating) && rating > 0 ? rating : 5;
}

function memberSportPosition(memberId, sportId) {
  const profile = sportProfileForMember(memberId, sportId);
  return profile?.preferred_position || "";
}

function updateRatingSportOptions() {
  const select = $("rating-sport-filter");
  if (!select) return;

  const current = select.value || "";

  select.innerHTML = `
    <option value="">Select sport</option>
    ${(allSports || []).map(sport => `
      <option value="${sport.id}">${escapeHtml(sport.name)}</option>
    `).join("")}
  `;

  if (Array.from(select.options).some(option => option.value === current)) {
    select.value = current;
  }
}

function approvedRatingMembers() {
  const byId = new Map();

  (allMembers || []).forEach(member => {
    if (member?.id) byId.set(member.id, member);
  });

  (allSportProfiles || []).forEach(profile => {
    if (profile.members?.id) byId.set(profile.members.id, profile.members);
  });

  if (currentProfile?.id) byId.set(currentProfile.id, currentProfile);

  return Array.from(byId.values())
    .filter(member => member?.id)
    .sort((a, b) => memberDisplayName(a).localeCompare(memberDisplayName(b)));
}


function matchForRatingAdjustment(adjustment) {
  return (allMatches || []).find(match =>
    (match.match_position_rating_adjustments || []).some(row => row.id === adjustment.id)
  ) || null;
}

function scoreTextForMatch(match) {
  if (!match) return "-";

  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) return "-";

  return `${teamA.name || "Team A"} ${Number(teamA.score || 0)} - ${Number(teamB.score || 0)} ${teamB.name || "Team B"}`;
}

function currentRatingHistoryPlayer() {
  const memberId = cleanUuidValue(currentRatingHistoryMemberId);

  if (!memberId) return null;

  return approvedRatingMembers().find(member => member.id === memberId) ||
    (allPositionRatings || []).find(row => row.member_id === memberId)?.members ||
    null;
}

function ratingHistoryRows(memberId, sportId) {
  const cleanMemberId = cleanUuidValue(memberId);
  const cleanSportId = cleanUuidValue(sportId);

  if (!cleanMemberId || !cleanSportId) return [];

  const rows = [];

  (allMatches || []).forEach(match => {
    (match.match_position_rating_adjustments || []).forEach(adjustment => {
      if (
        cleanUuidValue(adjustment.member_id) === cleanMemberId &&
        cleanUuidValue(adjustment.sport_id) === cleanSportId
      ) {
        rows.push({
          ...adjustment,
          match
        });
      }
    });
  });

  return rows;
}

function renderRatingHistoryModal() {
  const list = $("ratingHistoryList");
  if (!list) return;

  const member = currentRatingHistoryPlayer();
  const sport = (allSports || []).find(s => s.id === currentRatingHistorySportId);
  const positionFilter = $("rating-history-position-filter")?.value || "all";
  const sortMode = $("rating-history-sort")?.value || "newest";

  if ($("rating-history-title")) {
    $("rating-history-title").textContent = member
      ? `${memberDisplayName(member)} — Rating History`
      : "Rating History";
  }

  if ($("rating-history-subtitle")) {
    $("rating-history-subtitle").textContent = sport?.name
      ? `${sport.name} position rating changes by match.`
      : "Position rating changes by match.";
  }

  let rows = ratingHistoryRows(currentRatingHistoryMemberId, currentRatingHistorySportId)
    .filter(row =>
      positionFilter === "all" ||
      normalizeSoccerPosition(row.position_name) === positionFilter
    );

  rows.sort((a, b) => {
    const dateA = new Date(a.match?.start_time || a.created_at || 0).getTime();
    const dateB = new Date(b.match?.start_time || b.created_at || 0).getTime();

    return sortMode === "oldest" ? dateA - dateB : dateB - dateA;
  });

  if (!rows.length) {
    list.innerHTML = `<article class="card">No rating changes found for this filter yet.</article>`;
    return;
  }

  const groupedByPosition = new Map();

  rows.forEach(row => {
    const position = normalizeSoccerPosition(row.position_name) || row.position_name || "-";
    if (!groupedByPosition.has(position)) groupedByPosition.set(position, []);
    groupedByPosition.get(position).push(row);
  });

  list.innerHTML = Array.from(groupedByPosition.entries()).map(([position, positionRows]) => `
    <div class="rating-history-position-group">
      <div class="rating-history-position-title">${escapeHtml(position)}</div>

      ${positionRows.map(row => {
        const before = Number(row.rating_before ?? 0);
        const after = Number(row.rating_after ?? 0);
        const delta = after - before;
        const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`;
        const match = row.match;

        return `
          <div class="rating-history-row">
            <div>
              <strong>${escapeHtml(match?.title || "Match")}</strong>
              <span>${escapeHtml(fmtDate(match?.start_time || row.created_at))}</span>
              <em>${escapeHtml(scoreTextForMatch(match))}</em>
            </div>

            <b class="${delta >= 0 ? "positive" : "negative"}">
              ${before.toFixed(2)} → ${after.toFixed(2)} (${deltaText})
            </b>
          </div>
        `;
      }).join("")}
    </div>
  `).join("");
}

function openRatingHistory(memberId) {
  const sportId = cleanUuidValue($("rating-sport-filter")?.value);

  if (!sportId) {
    alert("Select a sport first.");
    return;
  }

  currentRatingHistoryMemberId = cleanUuidValue(memberId);
  currentRatingHistorySportId = sportId;

  if ($("rating-history-position-filter")) $("rating-history-position-filter").value = "all";
  if ($("rating-history-sort")) $("rating-history-sort").value = "newest";

  renderRatingHistoryModal();
  $("ratingHistoryModal")?.showModal();
}

function renderSportRatingManager() {
  const box = $("sportRatingList");
  if (!box) return;

  const sportId = cleanUuidValue($("rating-sport-filter")?.value) || "";
  const selectedSport = (allSports || []).find(sport => sport.id === sportId);
  const isSoccer = String(selectedSport?.name || "").toLowerCase().includes("soccer") ||
    String(selectedSport?.name || "").toLowerCase().includes("football");

  if (!sportId) {
    box.innerHTML = `<div class="hint">Select a sport to edit ratings.</div>`;
    return;
  }

  const members = approvedRatingMembers();

  if (!members.length) {
    box.innerHTML = `<div class="hint">No approved members found.</div>`;
    return;
  }

  box.innerHTML = members.map(member => {
    const profile = sportProfileForMember(member.id, sportId);
    const rating = profile?.rating ?? "";
    const position = normalizeSoccerPosition(profile?.preferred_position) || profile?.preferred_position || "";

    const positionInputs = isSoccer
      ? `
        <div class="position-rating-inputs">
          ${SOCCER_POSITIONS.map(positionName => {
            const positionRating = positionRatingForMember(member.id, sportId, positionName);

            return `
              <label>
                ${positionName}
                <input
                  class="position-rating-input"
                  data-position="${positionName}"
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  value="${Number(positionRating || 5).toFixed(1)}"
                >
              </label>
            `;
          }).join("")}
        </div>
      `
      : "";

    return `
      <div class="sport-rating-row" data-member-id="${member.id}">
        <div>
          <strong>${escapeHtml(memberDisplayName(member))}</strong>
          ${member.is_external ? `<span class="mini-pill">External</span>` : ""}
        </div>

        <label>
          Overall
          <input
            class="sport-rating-input"
            type="number"
            min="1"
            max="10"
            step="0.1"
            value="${escapeHtml(String(rating))}"
            placeholder="5"
          >
        </label>

        <label>
          Preferred
          <select class="sport-position-input">
            ${preferredPositionOptions(position, isSoccer)}
          </select>
        </label>

        ${positionInputs}

        <div class="sport-rating-actions">
          <button class="small-btn" type="button" onclick="saveMemberSportProfile('${member.id}')">
            Save
          </button>

          <button class="small-btn" type="button" onclick="openRatingHistory('${member.id}')">
            History
          </button>

          <button class="small-btn" type="button" onclick="openPlayerProfile('${member.id}')">
            Profile
          </button>
        </div>
      </div>
    `;
  }).join("");
}

async function saveMemberSportProfile(memberId) {
  if (!isCurrentUserAdmin()) {
    alert("Admin only.");
    return;
  }

  const sportId = $("rating-sport-filter")?.value || "";
  const row = document.querySelector(`.sport-rating-row[data-member-id="${memberId}"]`);

  if (!sportId || !row) {
    alert("Select a sport first.");
    return;
  }

  const rating = Number(row.querySelector(".sport-rating-input")?.value || 5);
  const rawPreferredPosition = row.querySelector(".sport-position-input")?.value || "";
  const preferredPosition = normalizeSoccerPosition(rawPreferredPosition) || rawPreferredPosition || null;

  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    alert("Overall rating must be between 1 and 10.");
    return;
  }

  const { error } = await supabaseClient
    .from("member_sport_profiles")
    .upsert({
      member_id: memberId,
      sport_id: sportId,
      rating,
      preferred_position: preferredPosition
    }, {
      onConflict: "member_id,sport_id"
    });

  if (error) {
    alert(error.message);
    return;
  }

  const positionInputs = Array.from(row.querySelectorAll(".position-rating-input"));

  if (positionInputs.length) {
    const positionRows = [];

    for (const input of positionInputs) {
      const positionName = normalizeSoccerPosition(input.dataset.position);
      const positionRating = Number(input.value || 5);

      if (!positionName) continue;

      if (!Number.isFinite(positionRating) || positionRating < 1 || positionRating > 10) {
        alert(`${positionName} rating must be between 1 and 10.`);
        return;
      }

      positionRows.push({
        member_id: memberId,
        sport_id: sportId,
        position_name: positionName,
        rating: positionRating
      });
    }

    if (positionRows.length) {
      const { error: positionError } = await supabaseClient
        .from("member_sport_position_ratings")
        .upsert(positionRows, {
          onConflict: "member_id,sport_id,position_name"
        });

      if (positionError) {
        alert(positionError.message);
        return;
      }
    }
  }

  await loadSportProfiles();
  await loadPositionRatings();
  await loadPositionRatings();
  renderSportRatingManager();
  renderRankings();
}

async function loadMatchFormOptions() {
  if (!currentProfile || currentProfile.approval_status !== "approved") return;

  const { data: sportsData, error: sportsError } = await supabaseClient
    .from("sports")
    .select("id,name")
    .order("name", { ascending: true });

  if (sportsError) {
    alert(sportsError.message);
    return;
  }

  const { data: venuesData, error: venuesError } = await supabaseClient
    .from("venues")
    .select(`
      id,
      name,
      address,
      is_active,
      venue_sports (
        sport_id
      )
    `)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (venuesError) {
    alert(venuesError.message);
    return;
  }

  const { data: leaguesData, error: leaguesError } = await supabaseClient
    .from("leagues")
    .select(`
      id,
      name,
      sport_id,
      format,
      status,
      start_date,
      end_date,
      created_by,
      created_at,
      sports (
        id,
        name
      )
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (leaguesError) {
    console.warn("Could not load active leagues:", leaguesError.message);
  }

  const { data: membersData, error: membersError } = await supabaseClient
    .from("members")
    .select("id,first_name,last_name,display_name,email,phone,is_external")
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (membersError) {
    alert(membersError.message);
    return;
  }

  allSports = sportsData || [];
  allVenues = venuesData || [];
  allLeagues = leaguesData || allLeagues || [];
 allMembers = (membersData || []).filter(member =>
  member.id !== currentProfile?.id &&
  !member.is_external
);

  await loadSportProfiles();
  const sportSelect = $("match-sport");
  if (sportSelect) {
    sportSelect.innerHTML = `
      <option value="">Select sport</option>
      ${allSports.map(s => `
        <option value="${s.id}">${escapeHtml(s.name)}</option>
      `).join("")}
    `;
  }

  updateLeagueSportOptions();
  updateRatingSportOptions();
  updateRankingFilters();
  updateMatchLeagueOptions();
  updateActivitySportOptions();

  renderMatchInviteOptions();
  updateMatchVenueOptions();
}

function updateMatchVenueOptions() {
  const sportId = $("match-sport")?.value || "";
  const venueSelect = $("match-venue");

  if (!venueSelect) return;

  const filteredVenues = sportId
    ? allVenues.filter(v =>
        (v.venue_sports || []).some(vs => vs.sport_id === sportId)
      )
    : allVenues;

  venueSelect.innerHTML = `
    <option value="">Select venue</option>
    ${filteredVenues.map(v => `
      <option value="${v.id}">
        ${escapeHtml(v.name)}${v.address ? " — " + escapeHtml(v.address) : ""}
      </option>
    `).join("")}
  `;

  updateMatchLeagueOptions();
}

function memberDisplayName(member) {
  return member?.display_name ||
    `${member?.first_name || ""} ${member?.last_name || ""}`.trim() ||
    member?.email ||
    "Unnamed";
}

function renderMatchInviteOptions(selectedIds = []) {
  const box = $("match-invite-options");
  if (!box) return;

  const selected = new Set(selectedIds || []);

  if (!allMembers || allMembers.length === 0) {
    box.innerHTML = "No approved members found.";
    return;
  }

  box.innerHTML = allMembers.map(member => `
    <label class="sport-chip">
      <input
        type="checkbox"
        value="${member.id}"
        class="match-invite-checkbox"
        ${selected.has(member.id) ? "checked" : ""}
      >
      <span>${escapeHtml(memberDisplayName(member))}</span>
    </label>
  `).join("");
}

function getSelectedInviteMemberIds() {
  return Array.from(document.querySelectorAll(".match-invite-checkbox"))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

async function saveMatchInvitations(matchId, invitedMemberIds, preserveExistingVotes = false) {
  const safeMatchId = cleanUuidValue(matchId);

  if (!safeMatchId) {
    alert("Cannot save invitations: match id is missing.");
    return { ok: false, notifiedMemberIds: [] };
  }

  if (!matchId) {
    alert("Match id missing. Cannot save invitations.");
    return { ok: false, notifiedMemberIds: [] };
  }

  /*
    Only real registered members should receive voting invitations.
    External players are handled separately through Add External,
    and they are automatically inserted as status = "in".
  */
  const realMemberIds = (allMembers || [])
    .filter(member => !member.is_external)
    .map(member => member.id);

  const uniqueInvitedIds = Array.from(new Set(invitedMemberIds || []))
    .filter(id =>
      id &&
      id !== currentProfile?.id &&
      realMemberIds.includes(id)
    );

  if (!preserveExistingVotes) {
    const creatorRow = {
      match_id: safeMatchId,
      member_id: currentProfile.id,
      invited_by: currentProfile.id,
      status: "in"
    };

    const invitedRows = uniqueInvitedIds.map(memberId => ({
      match_id: safeMatchId,
      member_id: memberId,
      invited_by: currentProfile.id,
      status: "invited"
    }));

    const { error } = await supabaseClient
      .from("match_invitations")
      .upsert([creatorRow, ...invitedRows], {
        onConflict: "match_id,member_id"
      });

    if (error) {
      alert(error.message);
      return { ok: false, notifiedMemberIds: [] };
    }

    return { ok: true, notifiedMemberIds: uniqueInvitedIds };
  }

  const match = allMatches.find(m => m.id === matchId);
  const existingInvitations = match?.match_invitations || [];
  const existingIds = existingInvitations.map(inv => inv.member_id);

  /*
    Remove only real member invitations that were unchecked.
    Do NOT remove external players here because they are managed
    from the Add External modal.
  */
  const idsToRemove = existingInvitations
    .filter(inv => {
      const member = invitationMember(inv);
      return (
        inv.member_id !== currentProfile?.id &&
        !member?.is_external &&
        !uniqueInvitedIds.includes(inv.member_id)
      );
    })
    .map(inv => inv.member_id);

  const idsToAdd = uniqueInvitedIds.filter(id => !existingIds.includes(id));

  if (idsToRemove.length > 0) {
    const { error: removeError } = await supabaseClient
      .from("match_invitations")
      .update({
        status: "removed",
        updated_at: new Date().toISOString()
      })
      .eq("match_id", safeMatchId)
      .in("member_id", idsToRemove);

    if (removeError) {
      alert(removeError.message);
      return { ok: false, notifiedMemberIds: [] };
    }
  }

  if (idsToAdd.length > 0) {
    const rows = idsToAdd.map(memberId => ({
      match_id: safeMatchId,
      member_id: memberId,
      invited_by: currentProfile.id,
      status: "invited"
    }));

    const { error: addError } = await supabaseClient
      .from("match_invitations")
      .insert(rows);

    if (addError) {
      alert(addError.message);
      return { ok: false, notifiedMemberIds: [] };
    }
  }

  return { ok: true, notifiedMemberIds: idsToAdd };
}

function render() {
  if ($("todayLabel")) {
    $("todayLabel").textContent =
      new Date().toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric"
      });
  }

  renderStats();
  renderFeed();
  renderLeagues();
  renderMatches();
  renderActivities();
  renderRankings();
}

function renderStats() {
  renderHomeSnapshot();
  renderHomeToday();
  renderHomeActions();
  renderHomeChallenge();
  renderHomeLeagueHq();
  renderHomePerformance();
}

function homeApprovedActivities() {
  return (allMemberActivities || [])
    .filter(activity => activity.status === "approved");
}

function homeOwnActivities() {
  const memberId = cleanUuidValue(currentProfile?.id);
  if (!memberId) return [];

  return (allMemberActivities || [])
    .filter(activity => cleanUuidValue(activity.member_id) === memberId);
}

function homeRankingRows() {
  const table = new Map();

  if ((allRankingPointRows || []).length) {
    allRankingPointRows.forEach(point => {
      const memberId = cleanUuidValue(point.member_id);
      if (!memberId) return;

      const row = table.get(memberId) || {
        memberId,
        member: rankingMemberForId(memberId, point.member),
        name: rankingMemberName(memberId, point.member),
        totalPoints: 0,
        matches: 0,
        wins: 0
      };

      row.totalPoints += pointTotalPoints(point);
      row.matches += 1;
      table.set(memberId, row);
    });
  } else {
    (allMatches || [])
      .filter(match => !isCancelledMatch(match) && hasSubmittedScore(match))
      .forEach(match => {
        (match.match_member_points || []).forEach(point => {
          const memberId = cleanUuidValue(point.member_id);
          const member = rankingMemberForId(memberId, point.member);

          if (!memberId || !member) return;

          const row = table.get(memberId) || {
            memberId,
            member,
            name: memberDisplayName(member),
            totalPoints: 0,
            matches: 0,
            wins: 0
          };
          const result = teamResultForMember(match, memberId).result || "participated";

          row.totalPoints += pointTotalPoints(point);
          row.matches += 1;
          if (result === "win") row.wins += 1;
          table.set(memberId, row);
        });
      });
  }

  homeApprovedActivities().forEach(activity => {
    const memberId = cleanUuidValue(activity.member_id);
    if (!memberId) return;

    const row = table.get(memberId) || {
      memberId,
      member: rankingMemberForId(memberId, activity.members),
      name: rankingMemberName(memberId, activity.members),
      totalPoints: 0,
      matches: 0,
      wins: 0
    };

    row.totalPoints += Number(activity.activity_points || 0);
    table.set(memberId, row);
  });

  return Array.from(table.values()).sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    b.wins - a.wins ||
    b.matches - a.matches ||
    a.name.localeCompare(b.name)
  );
}

function homeNextMatch() {
  const now = Date.now();
  const memberId = cleanUuidValue(currentProfile?.id);
  const upcoming = (allMatches || [])
    .filter(match => !isCancelledMatch(match))
    .filter(match => new Date(match.start_time).getTime() >= now)
    .filter(match => !memberId || userIsInMatch(match, memberId) || matchMyStatus(match) === "maybe")
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return upcoming[0] || null;
}

function homeWeekActivityMinutes() {
  const startMs = Date.now() - (7 * 24 * 60 * 60 * 1000);

  return homeOwnActivities()
    .filter(activity => activity.status !== "rejected")
    .filter(activity => new Date(activity.activity_date || activity.created_at || 0).getTime() >= startMs)
    .reduce((sum, activity) => sum + Number(activity.duration_minutes || 0), 0);
}

function homeTodayBounds() {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    startMs: start.getTime(),
    endMs: end.getTime()
  };
}

function homeThisWeekBounds() {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  end.setTime(start.getTime() + (7 * 24 * 60 * 60 * 1000) - 1);

  return {
    startMs: start.getTime(),
    endMs: end.getTime()
  };
}

function homeMatchesBetween(startMs, endMs) {
  return (allMatches || [])
    .filter(match => !isCancelledMatch(match))
    .filter(match => {
      const time = new Date(match.start_time || 0).getTime();
      return Number.isFinite(time) && time >= startMs && time <= endMs;
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function homeActivitiesBetween(startMs, endMs, activities = homeApprovedActivities()) {
  return (activities || [])
    .filter(activity => {
      const time = new Date(activity.activity_date || activity.created_at || 0).getTime();
      return Number.isFinite(time) && time >= startMs && time <= endMs;
    });
}

function homeThisMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    startMs: start.getTime(),
    endMs: end.getTime()
  };
}

function homeMonthPoints(memberId) {
  const cleanId = cleanUuidValue(memberId);
  const { startMs, endMs } = homeThisMonthBounds();
  let points = 0;

  if (!cleanId) return points;

  (allMatches || [])
    .filter(match => !isCancelledMatch(match) && hasSubmittedScore(match))
    .filter(match => {
      const time = new Date(match.start_time || 0).getTime();
      return Number.isFinite(time) && time >= startMs && time <= endMs;
    })
    .forEach(match => {
      (match.match_member_points || []).forEach(point => {
        if (cleanUuidValue(point.member_id) === cleanId) points += pointTotalPoints(point);
      });
    });

  homeActivitiesBetween(startMs, endMs)
    .filter(activity => cleanUuidValue(activity.member_id) === cleanId)
    .forEach(activity => {
      points += Number(activity.activity_points || 0);
    });

  return points;
}

function homePointsToPassText(rows, memberId) {
  const cleanId = cleanUuidValue(memberId);
  const rankIndex = rows.findIndex(row => cleanUuidValue(row.memberId) === cleanId);

  if (rankIndex <= 0) return rankIndex === 0 ? "You are currently first." : "No ranking target yet.";

  const current = rows[rankIndex];
  const target = rows[rankIndex - 1];
  const needed = Math.max(0, Number(target.totalPoints || 0) - Number(current.totalPoints || 0));

  return `${formatPointValue(needed + 0.01)} pts to pass ${target.name}`;
}

function homeFinalizedMatches() {
  return (allMatches || [])
    .filter(match => !isCancelledMatch(match) && hasSubmittedScore(match))
    .sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0));
}

function homeMatchWinnerText(match) {
  const { teamA, teamB } = getTwoMatchTeams(match);
  const scoreA = Number(teamA?.score ?? 0);
  const scoreB = Number(teamB?.score ?? 0);

  if (!teamA || !teamB) return "Result submitted";
  if (scoreA === scoreB) return `${teamA.name || "Team A"} drew ${teamB.name || "Team B"}`;

  return scoreA > scoreB
    ? `${teamA.name || "Team A"} won ${scoreA}-${scoreB}`
    : `${teamB.name || "Team B"} won ${scoreB}-${scoreA}`;
}

function homeAllRecentRatingChanges() {
  const changes = [];

  (allMatches || []).forEach(match => {
    if (isCancelledMatch(match)) return;

    (match.match_position_rating_adjustments || []).forEach(row => {
      const before = Number(row.rating_before ?? 0);
      const after = Number(row.rating_after ?? 0);
      const delta = after - before;
      const member = row.member || memberById(row.member_id);

      if (!member || !Number.isFinite(delta)) return;

      changes.push({
        memberId: cleanUuidValue(row.member_id),
        name: memberDisplayName(member),
        delta,
        position: normalizeSoccerPosition(row.position_name) || row.position_name || "OVR",
        sport: match.sports?.name || sportNameById(match.sport_id) || "Sport",
        date: match.start_time || row.created_at
      });
    });
  });

  return changes.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function homeBiggestRatingJump() {
  return homeAllRecentRatingChanges()
    .filter(change => change.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0] || null;
}

function homeMostActivePlayersThisWeek(limit = 3) {
  const { startMs, endMs } = homeThisWeekBounds();
  const table = new Map();

  homeActivitiesBetween(startMs, endMs, (allMemberActivities || []).filter(activity => activity.status !== "rejected"))
    .forEach(activity => {
      const memberId = cleanUuidValue(activity.member_id);
      const member = activity.members || memberById(memberId);

      if (!memberId || !member) return;

      const current = table.get(memberId) || {
        memberId,
        name: memberDisplayName(member),
        minutes: 0,
        points: 0
      };

      current.minutes += Number(activity.duration_minutes || 0);
      current.points += Number(activity.activity_points || 0);
      table.set(memberId, current);
    });

  return Array.from(table.values())
    .sort((a, b) => b.minutes - a.minutes || b.points - a.points || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function homeNewestMembers(limit = 3) {
  return (allMembers || [])
    .filter(member => member?.id && !member.is_external)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, limit);
}

function homeMatchStreaks(limit = 3) {
  const table = new Map();

  homeFinalizedMatches().forEach(match => {
    (match.match_member_points || []).forEach(point => {
      const memberId = cleanUuidValue(point.member_id);
      const member = point.member || memberById(memberId);
      const row = table.get(memberId) || {
        memberId,
        name: member ? memberDisplayName(member) : "",
        streak: 0,
        stopped: false
      };
      const result = teamResultForMember(match, memberId).result;

      if (!memberId || !member || row.stopped) return;

      if (result === "win") row.streak += 1;
      else row.stopped = true;

      table.set(memberId, row);
    });
  });

  return Array.from(table.values())
    .filter(row => row.streak > 1)
    .sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name))
    .slice(0, limit);
}

async function openLogActivityFromHome() {
  if (!currentProfile || currentProfile.approval_status !== "approved") {
    alert("Approved members only.");
    return;
  }

  await loadActivityFormOptions();
  populateMatchTimeSelects();
  resetActivityFormForCreate();
  $("activityModal")?.showModal();
}

function homeSnapshotCard(label, value, detail = "") {
  return `
    <article class="card home-stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      ${detail ? `<em>${escapeHtml(detail)}</em>` : ""}
    </article>
  `;
}

function renderHomeSnapshot() {
  const box = $("homeSnapshot");
  if (!box) return;

  if (!currentProfile || currentProfile.approval_status !== "approved") {
    box.innerHTML = `
      ${homeSnapshotCard("Status", "Welcome", "Login with an approved member account to see your arena snapshot.")}
      ${homeSnapshotCard("Today", new Date().toLocaleDateString([], { month: "short", day: "numeric" }), "Matches, activity, and rankings live here.")}
    `;
    return;
  }

  const stats = playerProfileStats(currentProfile.id);
  const rows = homeRankingRows();
  const rankIndex = rows.findIndex(row => cleanUuidValue(row.memberId) === cleanUuidValue(currentProfile.id));
  const nextMatch = homeNextMatch();
  const activeMinutes = homeWeekActivityMinutes();
  const monthPoints = homeMonthPoints(currentProfile.id);
  const passText = homePointsToPassText(rows, currentProfile.id);
  const recentChanges = homeRecentRatingChanges(currentProfile.id);
  const latestChange = recentChanges[0];

  box.innerHTML = `
    ${homeSnapshotCard("My points", formatPointValue(stats.totalPoints), `${formatPointValue(stats.basePoints)} activity / ${formatPointValue(stats.bonusPoints)} score`)}
    ${homeSnapshotCard("Rank", rankIndex >= 0 ? `#${rankIndex + 1}` : "-", `${rows.length} ranked player${rows.length === 1 ? "" : "s"}`)}
    ${homeSnapshotCard("Active time", formatProfileDurationMinutes(activeMinutes), "last 7 days")}
    ${homeSnapshotCard("Next match", nextMatch ? fmtDate(nextMatch.start_time) : "None", nextMatch ? (nextMatch.title || nextMatch.sports?.name || "Upcoming match") : "No joined/maybe match scheduled")}
    ${homeSnapshotCard("This month", formatPointValue(monthPoints), "points from finalized matches and approved activities")}
    ${homeSnapshotCard("Next target", passText, latestChange ? `Latest rating: ${latestChange.position} ${latestChange.delta >= 0 ? "+" : ""}${latestChange.delta.toFixed(2)}` : "Play rated matches to build movement")}
  `;
}

function homeActionCard(title, detail, buttonText, viewId) {
  const action = viewId === "activityModal"
    ? "openLogActivityFromHome()"
    : `setActiveTab('${viewId}')`;

  return `
    <article class="card home-action-card">
      <div>
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(detail)}</p>
      </div>
      <button class="small-btn" type="button" onclick="${action}">${escapeHtml(buttonText)}</button>
    </article>
  `;
}

function homeInfoCard(title, detail, meta = "", pill = "") {
  return `
    <article class="card home-action-card">
      <div>
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(detail)}</p>
        ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}
      </div>
      ${pill ? `<span class="pill blue">${escapeHtml(pill)}</span>` : ""}
    </article>
  `;
}

function renderHomeToday() {
  const box = $("homeTodayList");
  if (!box) return;

  const { startMs, endMs } = homeTodayBounds();
  const week = homeThisWeekBounds();
  const matches = homeMatchesBetween(startMs, endMs);
  const weekMatches = homeMatchesBetween(Date.now(), week.endMs);
  const activities = homeActivitiesBetween(startMs, endMs);
  const recentResults = homeFinalizedMatches().slice(0, 3);
  const pendingVoteMatches = (allMatches || [])
    .filter(match => !isCancelledMatch(match) && isVotingOpenForMatch(match))
    .filter(match => new Date(match.start_time || 0).getTime() >= Date.now())
    .filter(match => {
      const mine = matchMyStatus(match);
      const isCreator = cleanUuidValue(match.created_by) === cleanUuidValue(currentProfile?.id);
      return !isCreator && (!mine || mine === "invited");
    });
  const pendingActivities = (allMemberActivities || [])
    .filter(activity => (activity.status || "pending") === "pending");
  const cards = [
    homeInfoCard("Matches today", `${matches.length} scheduled match${matches.length === 1 ? "" : "es"}.`, matches[0] ? matches[0].title || fmtDate(matches[0].start_time) : "No match on today's board.", "Today"),
    homeInfoCard("This week", `${weekMatches.length} upcoming match${weekMatches.length === 1 ? "" : "es"} before Sunday.`, weekMatches[0] ? `Next: ${weekMatches[0].title || fmtDate(weekMatches[0].start_time)}` : "No upcoming match this week.", "Week"),
    homeInfoCard("Pending votes", `${pendingVoteMatches.length} match${pendingVoteMatches.length === 1 ? "" : "es"} waiting for your answer.`, pendingVoteMatches[0] ? pendingVoteMatches[0].title || "Open match vote" : "No vote needed right now.", "Vote"),
    homeInfoCard("Activity logged", `${activities.length} approved activit${activities.length === 1 ? "y" : "ies"} today.`, `${formatPointValue(activities.reduce((sum, activity) => sum + Number(activity.activity_points || 0), 0))} activity pts`, "Live"),
    homeInfoCard("Recent results", `${recentResults.length} recent finalized result${recentResults.length === 1 ? "" : "s"}.`, recentResults[0] ? `${recentResults[0].title || "Match"} - ${homeMatchWinnerText(recentResults[0])}` : "No result submitted yet.", "Result"),
    homeInfoCard("Proof queue", `${pendingActivities.length} pending proof${pendingActivities.length === 1 ? "" : "s"}.`, isCurrentUserAdmin() ? "Admin review queue" : "Your pending logs stay editable until approval.", "Proofs"),
    homeActionCard("Quick log", "Log a training session or proof-backed activity.", "Log Activity", "activityModal"),
    homeActionCard("Quick join", "Find open matches and vote In or Maybe.", "Join Match", "matches")
  ];

  box.innerHTML = cards.join("");
}

function renderHomeActions() {
  const box = $("homeActionList");
  if (!box) return;

  const actions = [];
  const now = Date.now();
  const pendingVoteMatches = (allMatches || [])
    .filter(match => !isCancelledMatch(match) && isVotingOpenForMatch(match))
    .filter(match => new Date(match.start_time).getTime() >= now)
    .filter(match => {
      const mine = matchMyStatus(match);
      const isCreator = cleanUuidValue(match.created_by) === cleanUuidValue(currentProfile?.id);
      return !isCreator && (!mine || mine === "invited");
    });
  const scoreMatches = (allMatches || [])
    .filter(match => canSubmitScore(match) && !hasSubmittedScore(match));
  const ownPendingActivities = homeOwnActivities()
    .filter(activity => (activity.status || "pending") === "pending");
  const adminPendingActivities = isCurrentUserAdmin()
    ? (allMemberActivities || []).filter(activity => (activity.status || "pending") === "pending")
    : [];
  const recalcWarnings = isCurrentUserAdmin()
    ? (allMatches || []).filter(match =>
        hasSubmittedScore(match) &&
        !isCancelledMatch(match) &&
        !(match.match_member_points || []).length
      )
    : [];

  if (pendingVoteMatches.length) {
    actions.push(homeActionCard("Vote on matches", `${pendingVoteMatches.length} match${pendingVoteMatches.length === 1 ? "" : "es"} waiting for your answer.`, "Open Matches", "matches"));
  }

  if (scoreMatches.length) {
    actions.push(homeActionCard("Add results", `${scoreMatches.length} match${scoreMatches.length === 1 ? "" : "es"} can receive a result.`, "Open Matches", "matches"));
  }

  if (ownPendingActivities.length) {
    actions.push(homeActionCard("Pending activities", `${ownPendingActivities.length} activity log${ownPendingActivities.length === 1 ? "" : "s"} can still be edited before approval.`, "Open Activity", "activities"));
    actions.push(homeActionCard("Replace proof", "Open a pending activity, edit it, and upload a replacement proof before admin approval.", "Open Activity", "activities"));
  }

  if (adminPendingActivities.length) {
    actions.push(homeActionCard("Review activity proofs", `${adminPendingActivities.length} pending proof${adminPendingActivities.length === 1 ? "" : "s"} need admin review.`, "Open Admin", "admin"));
  }

  if (recalcWarnings.length) {
    actions.push(homeActionCard("Recalculate warnings", `${recalcWarnings.length} finalized match${recalcWarnings.length === 1 ? "" : "es"} have no saved points rows.`, "Open Matches", "matches"));
  }

  if (!actions.length) {
    actions.push(homeActionCard("All clear", "No pending votes, results, or activity reviews right now.", "View Matches", "matches"));
  }

  box.innerHTML = actions.join("");
}

function renderHomeChallenge() {
  const box = $("homeChallenge");
  if (!box) return;

  const ownActivities = homeOwnActivities().filter(activity => activity.status !== "rejected");
  const { startMs, endMs } = homeThisWeekBounds();
  const weekActivities = homeActivitiesBetween(startMs, endMs, ownActivities);
  const weekMinutes = weekActivities.reduce((sum, activity) => sum + Number(activity.duration_minutes || 0), 0);
  const goalMinutes = 180;
  const pct = Math.min(100, Math.round((weekMinutes / goalMinutes) * 100));
  const remaining = Math.max(0, goalMinutes - weekMinutes);
  const padelMatches = homeMatchesBetween(startMs, endMs)
    .filter(match => String(match.sports?.name || sportNameById(match.sport_id) || "").toLowerCase().includes("padel"));
  const runWalkActivities = weekActivities.filter(activity => {
    const text = `${activity.title || ""} ${activity.sports?.name || sportNameById(activity.sport_id) || ""}`.toLowerCase();
    return text.includes("run") || text.includes("walk");
  });
  const runWalkMinutes = runWalkActivities.reduce((sum, activity) => sum + Number(activity.duration_minutes || 0), 0);
  const activePlayers = homeMostActivePlayersThisWeek(5);
  const badge = pct >= 100 ? "Consistency badge unlocked" : `${Math.max(0, 100 - pct)}% to weekly badge`;

  box.innerHTML = `
    <article class="card home-feature-card">
      <div class="home-feature-head">
        <div>
          <h4>180 active minutes</h4>
          <p>Weekly consistency target from approved and pending non-rejected activity logs.</p>
        </div>
        <strong>${pct}%</strong>
      </div>
      <div class="home-progress"><span style="width:${pct}%"></span></div>
      <div class="meta">${formatProfileDurationMinutes(weekMinutes)} logged this week - ${formatProfileDurationMinutes(remaining)} remaining</div>
    </article>
    <article class="card home-feature-card">
      <div class="home-feature-head">
        <div>
          <h4>Padel ladder week</h4>
          <p>${padelMatches.length} padel match${padelMatches.length === 1 ? "" : "es"} scheduled or played this week.</p>
        </div>
        <span class="pill blue">Ladder</span>
      </div>
      <div class="meta">${padelMatches[0] ? `Next: ${padelMatches[0].title || fmtDate(padelMatches[0].start_time)}` : "No padel ladder match this week yet."}</div>
    </article>
    <article class="card home-feature-card">
      <div class="home-feature-head">
        <div>
          <h4>Run / walk 10 km</h4>
          <p>Distance is not tracked yet, so this uses logged run/walk time as a proxy.</p>
        </div>
        <strong>${formatProfileDurationMinutes(runWalkMinutes)}</strong>
      </div>
      <div class="meta">${runWalkActivities.length} run/walk activit${runWalkActivities.length === 1 ? "y" : "ies"} this week</div>
    </article>
    <article class="card home-feature-card">
      <h4>Most active this week</h4>
      <div class="home-mini-list">
        ${
          activePlayers.length
            ? activePlayers.map((row, index) => {
                const playerPct = Math.min(100, Math.round((Number(row.minutes || 0) / goalMinutes) * 100));
                return `
                  <div><span>${index + 1}. ${escapeHtml(row.name)}</span><b>${formatProfileDurationMinutes(row.minutes)}</b></div>
                  <div class="home-mini-progress"><span style="width:${playerPct}%"></span></div>
                `;
              }).join("")
            : `<div><span>No activity logged yet</span><b>-</b></div>`
        }
      </div>
      <div class="meta">${escapeHtml(badge)}</div>
    </article>
  `;
}

function homeActiveLeagues() {
  return (allLeagues || [])
    .filter(league => String(league.status || "active").toLowerCase() !== "completed")
    .map(league => {
      const matches = leagueMatches(league.id);
      const completed = matches.filter(match => hasSubmittedScore(match)).length;
      const next = matches
        .filter(match => !isCancelledMatch(match))
        .filter(match => new Date(match.start_time || 0).getTime() >= Date.now())
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0] || null;

      return {
        league,
        matches,
        completed,
        next
      };
    })
    .sort((a, b) => {
      const aTime = a.next ? new Date(a.next.start_time).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.next ? new Date(b.next.start_time).getTime() : Number.MAX_SAFE_INTEGER;

      return aTime - bTime || String(a.league.name || "").localeCompare(String(b.league.name || ""));
    });
}

function homeLeagueStandingsLeader(leagueId) {
  return homeLeagueStandingsRows(leagueId, 1)[0] || null;
}

function homeLeagueStandingsRows(leagueId, limit = 3) {
  const table = new Map();

  leagueMatches(leagueId)
    .filter(match => !isCancelledMatch(match) && hasSubmittedScore(match))
    .forEach(match => {
      (match.match_member_points || []).forEach(point => {
        const memberId = cleanUuidValue(point.member_id);
        const member = point.member || memberById(memberId);

        if (!memberId || !member) return;

        const row = table.get(memberId) || {
          name: memberDisplayName(member),
          points: 0,
          wins: 0
        };
        const result = teamResultForMember(match, memberId).result;

        row.points += pointTotalPoints(point);
        if (result === "win") row.wins += 1;
        table.set(memberId, row);
      });
    });

  return Array.from(table.values())
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function homeCurrentPlayerForm(leagueId = null) {
  const cleanId = cleanUuidValue(currentProfile?.id);
  if (!cleanId) return "-";

  const form = (allMatches || [])
    .filter(match => !isCancelledMatch(match) && hasSubmittedScore(match))
    .filter(match => !leagueId || match.league_id === leagueId)
    .filter(match => (match.match_member_points || []).some(point => cleanUuidValue(point.member_id) === cleanId))
    .sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0))
    .slice(0, 5)
    .map(match => {
      const result = teamResultForMember(match, cleanId).result;
      if (result === "win") return "W";
      if (result === "draw") return "D";
      if (result === "loss") return "L";
      return "P";
    });

  return form.length ? form.join("-") : "-";
}

function homeHotMatch() {
  const now = Date.now();

  return (allMatches || [])
    .filter(match => !isCancelledMatch(match))
    .filter(match => new Date(match.start_time || 0).getTime() >= now)
    .map(match => {
      const counts = invitationCounts(match);
      return {
        match,
        heat: counts.inCount + counts.maybeCount + counts.invitedCount
      };
    })
    .sort((a, b) => b.heat - a.heat || new Date(a.match.start_time || 0) - new Date(b.match.start_time || 0))[0] || null;
}

function renderHomeLeagueHq() {
  const box = $("homeLeagueHq");
  if (!box) return;

  const leagues = homeActiveLeagues().slice(0, 3);
  const hotMatch = homeHotMatch();

  if (!leagues.length) {
    box.innerHTML = `
      <article class="card home-feature-card"><h4>No active leagues</h4><p class="hint">Active league progress and next league matches will appear here.</p></article>
      <article class="card home-feature-card"><h4>Hot match</h4><p class="hint">${hotMatch ? `${hotMatch.match.title || "Match"} - ${fmtDate(hotMatch.match.start_time)}` : "No upcoming hot match yet."}</p></article>
    `;
    return;
  }

  const leagueCards = leagues.map(row => {
    const total = row.matches.length;
    const pct = total ? Math.round((row.completed / total) * 100) : 0;
    const leader = homeLeagueStandingsLeader(row.league.id);
    const standings = homeLeagueStandingsRows(row.league.id, 3);

    return `
      <article class="card home-feature-card">
        <div class="home-feature-head">
          <div>
            <h4>${escapeHtml(row.league.name || "League")}</h4>
            <p>${row.completed}/${total} finalized match${total === 1 ? "" : "es"}</p>
          </div>
          <strong>${pct}%</strong>
        </div>
        <div class="home-progress"><span style="width:${pct}%"></span></div>
        <div class="meta">${row.next ? `Next: ${row.next.title || "Match"} - ${fmtDate(row.next.start_time)}` : "No upcoming league match scheduled."}</div>
        <div class="meta">Leader: ${leader ? `${leader.name} (${formatPointValue(leader.points)} pts)` : "No standings yet"} - My form: ${homeCurrentPlayerForm(row.league.id)}</div>
        <div class="home-mini-list">
          ${
            standings.length
              ? standings.map((standing, index) => `<div><span>${index + 1}. ${escapeHtml(standing.name)}</span><b>${formatPointValue(standing.points)} pts</b></div>`).join("")
              : `<div><span>No standings rows yet</span><b>-</b></div>`
          }
        </div>
      </article>
    `;
  });

  leagueCards.push(`
    <article class="card home-feature-card">
      <h4>Hot match highlight</h4>
      <p>${hotMatch ? `${hotMatch.match.title || "Match"} has ${hotMatch.heat} active responses/invites.` : "No upcoming hot match yet."}</p>
      <div class="meta">${hotMatch ? `${hotMatch.match.sports?.name || "Sport"} - ${fmtDate(hotMatch.match.start_time)}` : "Create or join a match to heat up the board."}</div>
    </article>
  `);

  box.innerHTML = leagueCards.join("");
}

function homeRecentRatingChanges(memberId) {
  const cleanId = cleanUuidValue(memberId);
  const changes = [];

  if (!cleanId) return changes;

  (allMatches || []).forEach(match => {
    if (isCancelledMatch(match)) return;

    (match.match_position_rating_adjustments || []).forEach(row => {
      if (cleanUuidValue(row.member_id) !== cleanId) return;

      const before = Number(row.rating_before ?? 0);
      const after = Number(row.rating_after ?? 0);
      const delta = after - before;

      if (!Number.isFinite(delta)) return;

      changes.push({
        delta,
        position: normalizeSoccerPosition(row.position_name) || row.position_name || "OVR",
        sport: match.sports?.name || sportNameById(match.sport_id) || "Sport",
        date: match.start_time || row.created_at
      });
    });
  });

  return changes.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function homeLastThirtyDaysBounds() {
  return {
    startMs: Date.now() - (30 * 24 * 60 * 60 * 1000),
    endMs: Date.now()
  };
}

function homeLastThirtyDayPoints(memberId) {
  const cleanId = cleanUuidValue(memberId);
  const { startMs, endMs } = homeLastThirtyDaysBounds();
  const totals = {
    activity: 0,
    score: 0,
    total: 0
  };

  if (!cleanId) return totals;

  (allMatches || [])
    .filter(match => !isCancelledMatch(match) && hasSubmittedScore(match))
    .filter(match => {
      const time = new Date(match.start_time || 0).getTime();
      return Number.isFinite(time) && time >= startMs && time <= endMs;
    })
    .forEach(match => {
      (match.match_member_points || []).forEach(point => {
        if (cleanUuidValue(point.member_id) !== cleanId) return;

        const activity = Number(point.activity_points ?? point.base_points ?? 0);
        const score = Number(point.score_points ?? point.consistency_bonus ?? 0);

        totals.activity += activity;
        totals.score += score;
        totals.total += pointTotalPoints(point);
      });
    });

  homeActivitiesBetween(startMs, endMs)
    .filter(activity => cleanUuidValue(activity.member_id) === cleanId)
    .forEach(activity => {
      const points = Number(activity.activity_points || 0);
      totals.activity += points;
      totals.total += points;
    });

  return totals;
}

function homeSportBreakdown(stats) {
  return Array.from((stats.sportDetails || new Map()).values())
    .sort((a, b) => Number(b.totalPoints || 0) - Number(a.totalPoints || 0))
    .slice(0, 4);
}

function homeMostImprovedSport(changes) {
  const bySport = new Map();

  (changes || []).forEach(change => {
    const key = change.sport || "Sport";
    bySport.set(key, (bySport.get(key) || 0) + Number(change.delta || 0));
  });

  return Array.from(bySport.entries())
    .map(([sport, delta]) => ({ sport, delta }))
    .sort((a, b) => b.delta - a.delta)[0] || null;
}

function homeRatingTrendHtml(changes) {
  const recent = [...(changes || [])].reverse().slice(-6);

  if (!recent.length) {
    return `<div class="home-trend empty"><span></span><span></span><span></span><span></span></div>`;
  }

  return `
    <div class="home-trend">
      ${recent.map(change => {
        const magnitude = Math.min(100, Math.max(18, Math.round(Math.abs(Number(change.delta || 0)) * 20)));
        return `<span class="${change.delta >= 0 ? "positive" : "negative"}" style="height:${magnitude}%"></span>`;
      }).join("")}
    </div>
  `;
}

function renderHomePerformance() {
  const box = $("homePerformance");
  if (!box) return;

  if (!currentProfile || currentProfile.approval_status !== "approved") {
    box.innerHTML = `<article class="card home-feature-card"><h4>Performance Story</h4><p class="hint">Your sport breakdown and rating movement will appear after you play.</p></article>`;
    return;
  }

  const stats = playerProfileStats(currentProfile.id);
  const sportSummaries = Array.from((stats.sportDetails || new Map()).values())
    .sort((a, b) => Number(b.totalPoints || 0) - Number(a.totalPoints || 0));
  const topSport = sportSummaries[0];
  const recentChanges = homeRecentRatingChanges(currentProfile.id);
  const ratingDelta = recentChanges.slice(0, 5).reduce((sum, change) => sum + Number(change.delta || 0), 0);
  const approvedActivities = stats.activities.filter(activity => activity.status === "approved").length;
  const lastThirty = homeLastThirtyDayPoints(currentProfile.id);
  const breakdown = homeSportBreakdown(stats);
  const improvedSport = homeMostImprovedSport(recentChanges);

  box.innerHTML = `
    <article class="card home-feature-card">
      <h4>Last 30 days</h4>
      <p>${formatPointValue(lastThirty.total)} total pts</p>
      <div class="meta">${formatPointValue(lastThirty.activity)} activity / ${formatPointValue(lastThirty.score)} score</div>
    </article>
    <article class="card home-feature-card">
      <h4>Best sport right now</h4>
      <p>${escapeHtml(topSport?.sport || "No sport yet")}</p>
      <div class="meta">${topSport ? `${formatPointValue(topSport.totalPoints)} pts - ${topSport.games || 0} game${topSport.games === 1 ? "" : "s"} - ${approvedActivities} approved activit${approvedActivities === 1 ? "y" : "ies"}` : "Play matches or log approved activities to build your story."}</div>
    </article>
    <article class="card home-feature-card">
      <h4>Sport breakdown</h4>
      <div class="home-mini-list">
        ${
          breakdown.length
            ? breakdown.map(row => `<div><span>${escapeHtml(row.sport)}</span><b>${formatPointValue(row.totalPoints)} pts</b></div>`).join("")
            : `<div><span>No sport data yet</span><b>-</b></div>`
        }
      </div>
    </article>
    <article class="card home-feature-card">
      <h4>Recent rating movement</h4>
      <p>${recentChanges.length ? `${ratingDelta >= 0 ? "+" : ""}${ratingDelta.toFixed(2)} over last ${Math.min(5, recentChanges.length)} adjustment${recentChanges.length === 1 ? "" : "s"}` : "No rating movement yet"}</p>
      <div class="meta">${recentChanges[0] ? `${recentChanges[0].sport} ${recentChanges[0].position} ${recentChanges[0].delta >= 0 ? "+" : ""}${recentChanges[0].delta.toFixed(2)}` : "Ratings update after finalized rated matches."}</div>
      ${homeRatingTrendHtml(recentChanges)}
    </article>
    <article class="card home-feature-card">
      <h4>Most improved sport</h4>
      <p>${improvedSport ? escapeHtml(improvedSport.sport) : "No improvement yet"}</p>
      <div class="meta">${improvedSport ? `${improvedSport.delta >= 0 ? "+" : ""}${improvedSport.delta.toFixed(2)} rating movement` : "Play rated matches to unlock this."}</div>
    </article>
  `;
}

function homePulseItemHtml(item) {
  if (item.kind === "match") {
    const match = item.data;
    const status = hasSubmittedScore(match) ? scoreTextForMatch(match) : getMatchDisplayStatus(match);

    return `
      <article class="card home-pulse-card">
        <div>
          <h3>${escapeHtml(match.title || "Match")}</h3>
          <div class="meta">${escapeHtml(match.sports?.name || "Sport")} - ${escapeHtml(fmtDate(match.start_time))}</div>
          <div class="meta">${escapeHtml(status || "-")}</div>
        </div>
        <span class="pill blue">Match</span>
      </article>
    `;
  }

  const activity = item.data;
  const memberName = activity.members ? memberDisplayName(activity.members) : "Player";

  return `
    <article class="card home-pulse-card">
      <div>
        <h3>${escapeHtml(memberName)} - ${escapeHtml(activity.title || "Activity")}</h3>
        <div class="meta">${escapeHtml(activity.sports?.name || sportNameById(activity.sport_id) || "Sport")} - ${formatProfileDurationMinutes(activity.duration_minutes)}</div>
        <div class="meta">${formatPointValue(activity.activity_points)} activity pts</div>
      </div>
      <span class="pill green">Activity</span>
    </article>
  `;
}

function homePulseHighlightsHtml() {
  const latestResult = homeFinalizedMatches()[0] || null;
  const biggestJump = homeBiggestRatingJump();
  const streaks = homeMatchStreaks(3);
  const activePlayers = homeMostActivePlayersThisWeek(3);
  const newestMembers = homeNewestMembers(3);

  return `
    <article class="card home-feature-card">
      <h4>Latest winner</h4>
      <p>${latestResult ? `${latestResult.title || "Match"} - ${homeMatchWinnerText(latestResult)}` : "No match winner yet."}</p>
      <div class="meta">${latestResult ? fmtDate(latestResult.start_time) : "Finalized results will appear here."}</div>
    </article>
    <article class="card home-feature-card">
      <h4>Biggest rating jump</h4>
      <p>${biggestJump ? `${biggestJump.name} ${biggestJump.delta >= 0 ? "+" : ""}${biggestJump.delta.toFixed(2)}` : "No rating jumps yet."}</p>
      <div class="meta">${biggestJump ? `${biggestJump.sport} ${biggestJump.position}` : "Rated matches will build this pulse."}</div>
    </article>
    <article class="card home-feature-card">
      <h4>Current streaks</h4>
      <div class="home-mini-list">
        ${
          streaks.length
            ? streaks.map(row => `<div><span>${escapeHtml(row.name)}</span><b>${row.streak}W</b></div>`).join("")
            : `<div><span>No active win streaks</span><b>-</b></div>`
        }
      </div>
    </article>
    <article class="card home-feature-card">
      <h4>Most active this week</h4>
      <div class="home-mini-list">
        ${
          activePlayers.length
            ? activePlayers.map(row => `<div><span>${escapeHtml(row.name)}</span><b>${formatProfileDurationMinutes(row.minutes)}</b></div>`).join("")
            : `<div><span>No logged activity this week</span><b>-</b></div>`
        }
      </div>
    </article>
    <article class="card home-feature-card">
      <h4>New members</h4>
      <div class="home-mini-list">
        ${
          newestMembers.length
            ? newestMembers.map(member => `<div><span>${escapeHtml(memberDisplayName(member))}</span><b>${member.created_at ? escapeHtml(fmtDate(member.created_at)) : "-"}</b></div>`).join("")
            : `<div><span>No recent members loaded</span><b>-</b></div>`
        }
      </div>
    </article>
  `;
}

function renderFeed() {
  if (!$("feedList")) return;

  const items = [
    ...(allMatches || [])
      .filter(match => !isCancelledMatch(match))
      .map(match => ({ kind: "match", time: new Date(match.start_time || 0).getTime(), data: match })),
    ...homeApprovedActivities()
      .map(activity => ({ kind: "activity", time: new Date(activity.created_at || activity.activity_date || 0).getTime(), data: activity }))
  ]
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time)
    .slice(0, 8);

  $("feedList").innerHTML = `
    <div class="home-feature-grid">${homePulseHighlightsHtml()}</div>
    ${
      items.length
        ? items.map(homePulseItemHtml).join("")
        : `<article class="card"><div class="hint">No arena activity yet.</div></article>`
    }
  `;
}


function leagueById(leagueId) {
  if (!leagueId) return null;
  return (allLeagues || []).find(league => league.id === leagueId) || null;
}

function leagueNameForId(leagueId) {
  const league = leagueById(leagueId);
  return league?.name || "";
}

function leagueSportMatchesSelection(leagueId, sportId) {
  const league = leagueById(leagueId);
  if (!league || !sportId) return false;
  return league.sport_id === sportId;
}


function isCancelledMatch(match) {
  const status = String(match?.status || "").toLowerCase();
  const scoreStatus = String(match?.score_status || "").toLowerCase();

  return status === "cancelled" ||
    scoreStatus === "cancelled" ||
    getMatchDisplayStatus(match) === "cancelled";
}

function isLeagueCountableMatch(match) {
  return Boolean(match?.league_id) && !isCancelledMatch(match);
}

function leagueMatches(leagueId) {
  return (allMatches || []).filter(match =>
    match.league_id === leagueId &&
    isLeagueCountableMatch(match)
  );
}

function leagueCompletedGames(leagueId) {
  const gamesById = new Map();

  leagueMatches(leagueId)
    .filter(match => !isCancelledMatch(match))
    .forEach(match => {
      (match.match_game_sessions || []).forEach(session => {
        const game = session.match_games;

        if (
          game?.id &&
          game.league_id === leagueId &&
          String(game.status || "").toLowerCase() === "completed"
        ) {
          gamesById.set(game.id, game);
        }
      });
    });

  return Array.from(gamesById.values());
}


function leagueRatingDeltaByMember(leagueId) {
  const table = new Map();

  leagueMatches(leagueId).forEach(match => {
    (match.match_position_rating_adjustments || []).forEach(row => {
      const memberId = cleanUuidValue(row.member_id);
      if (!memberId) return;

      const before = Number(row.rating_before ?? 0);
      const after = Number(row.rating_after ?? 0);
      const delta = Number.isFinite(before) && Number.isFinite(after)
        ? after - before
        : Number(row.adjustment || 0);

      table.set(memberId, Number((Number(table.get(memberId) || 0) + delta).toFixed(3)));
    });
  });

  return table;
}

function leaguePositionLeaders(leagueId) {
  const league = leagueById(leagueId);
  const sportId = league?.sport_id;
  const rowsByPosition = new Map();

  SOCCER_POSITIONS.forEach(position => rowsByPosition.set(position, []));

  if (!sportId) return rowsByPosition;

  (allPositionRatings || [])
    .filter(row => row.sport_id === sportId)
    .forEach(row => {
      const position = normalizeSoccerPosition(row.position_name);
      if (!rowsByPosition.has(position)) return;

      rowsByPosition.get(position).push({
        memberId: row.member_id,
        name: memberDisplayName(row.members),
        rating: Number(row.rating || 0),
        gamesPlayed: Number(row.games_played || 0),
        isExternal: Boolean(row.members?.is_external)
      });
    });

  rowsByPosition.forEach((rows, position) => {
    rows.sort((a, b) =>
      b.rating - a.rating ||
      b.gamesPlayed - a.gamesPlayed ||
      a.name.localeCompare(b.name)
    );

    rowsByPosition.set(position, rows.slice(0, 5));
  });

  return rowsByPosition;
}

function leagueScoreText(match) {
  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB || !hasSubmittedScore(match)) return "-";

  return `${teamA.name || "Team A"} ${Number(teamA.score || 0)} - ${Number(teamB.score || 0)} ${teamB.name || "Team B"}`;
}

function leagueWinnerText(match) {
  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB || !hasSubmittedScore(match)) return "-";

  if (teamA.result === "win") return teamA.name || "Team A";
  if (teamB.result === "win") return teamB.name || "Team B";

  return "Draw";
}

function leagueMatchHistoryRows(leagueId) {
  return leagueMatches(leagueId)
    .filter(match =>
      !isCancelledMatch(match) &&
      (
        hasSubmittedScore(match) ||
        getMatchDisplayStatus(match) === "finished" ||
        getMatchDisplayStatus(match) === "completed"
      )
    )
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
}

function leaguePlayerStandings(leagueId) {
  const table = new Map();
  const ratingDeltas = leagueRatingDeltaByMember(leagueId);

  leagueMatches(leagueId).forEach(match => {
    (match.match_member_points || []).forEach(point => {
      const memberId = point.member_id;
      if (!memberId) return;

      const current = table.get(memberId) || {
        memberId,
        member: point.member,
        name: memberDisplayName(point.member),
        points: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        ratingDelta: 0
      };

      const teamInfo = teamResultForMember(match, memberId);
      const result = teamInfo.result || "participated";

      current.points += pointTotalPoints(point);
      current.matches += 1;

      if (result === "win") current.wins += 1;
      else if (result === "draw") current.draws += 1;
      else if (result === "loss") current.losses += 1;

      current.ratingDelta = Number(ratingDeltas.get(memberId) || 0);

      table.set(memberId, current);
    });
  });

  return Array.from(table.values()).sort((a, b) =>
    b.points - a.points ||
    b.wins - a.wins ||
    a.losses - b.losses ||
    b.ratingDelta - a.ratingDelta ||
    a.name.localeCompare(b.name)
  );
}

function leagueTeamGameStandings(leagueId) {
  const table = new Map();

  function ensureTeam(name) {
    const cleanName = name || "Team";

    if (!table.has(cleanName)) {
      table.set(cleanName, {
        name: cleanName,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0
      });
    }

    return table.get(cleanName);
  }

  leagueMatches(leagueId)
    .filter(match => !isCancelledMatch(match))
    .forEach(match => {
      const { teamA, teamB } = getTwoMatchTeams(match);

      // Padel can contain several completed games inside one booking.
      if (isPadelMatch(match)) {
        matchSessionGames(match)
          .filter(game =>
            game?.id &&
            String(game.status || "").toLowerCase() === "completed" &&
            String(game.status || "").toLowerCase() !== "cancelled"
          )
          .forEach(game => {
            const teamAName = game.team_a_name || teamA?.name || "Team A";
            const teamBName = game.team_b_name || teamB?.name || "Team B";

            const rowA = ensureTeam(teamAName);
            const rowB = ensureTeam(teamBName);

            rowA.played += 1;
            rowB.played += 1;

            if (game.winner_team === "A") {
              rowA.wins += 1;
              rowB.losses += 1;
            } else if (game.winner_team === "B") {
              rowB.wins += 1;
              rowA.losses += 1;
            } else {
              rowA.draws += 1;
              rowB.draws += 1;
            }
          });

        return;
      }

      // Soccer/simple sports: count the finalized booking result once.
      if (!hasSubmittedScore(match) || !teamA || !teamB) return;

      const rowA = ensureTeam(teamA.name || "Team A");
      const rowB = ensureTeam(teamB.name || "Team B");

      rowA.played += 1;
      rowB.played += 1;

      if (teamA.result === "win") {
        rowA.wins += 1;
        rowB.losses += 1;
      } else if (teamB.result === "win") {
        rowB.wins += 1;
        rowA.losses += 1;
      } else {
        rowA.draws += 1;
        rowB.draws += 1;
      }
    });

  return Array.from(table.values()).sort((a, b) =>
    b.wins - a.wins ||
    b.draws - a.draws ||
    a.losses - b.losses ||
    a.name.localeCompare(b.name)
  );
}

function renderLeaguePlayerStandings(leagueId) {
  const rows = leaguePlayerStandings(leagueId);

  if (!rows.length) {
    return `<div class="league-standings-empty">No finalized player points yet.</div>`;
  }

  return `
    <div class="league-standings league-player-standings">
      <div class="league-standings-title">Player standings</div>

      <div class="league-standings-head league-player-head">
        <span>#</span>
        <span>Player</span>
        <span>P</span>
        <span>W-D-L</span>
        <span>Pts</span>
        <span>Rating +/-</span>
      </div>

      ${rows.map((row, index) => {
        const delta = Number(row.ratingDelta || 0);
        const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`;

        return `
          <div class="league-standings-row league-player-row">
            <span>${index + 1}</span>
            <span>${playerLinkHtml(row.memberId, row.name)}</span>
            <span>${row.matches}</span>
            <span>${row.wins}-${row.draws}-${row.losses}</span>
            <span><strong>${Number(row.points || 0)}</strong></span>
            <span class="${delta >= 0 ? "positive" : "negative"}">${deltaText}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderLeagueGameStandings(leagueId) {
  const rows = leagueTeamGameStandings(leagueId);

  if (!rows.length) {
    return `<div class="league-standings-empty">No completed league games yet.</div>`;
  }

  return `
    <div class="league-standings compact-standings">
      <div class="league-standings-title">Team/game standings</div>

      <div class="league-standings-head league-team-head">
        <span>Team</span>
        <span>P</span>
        <span>W</span>
        <span>D</span>
        <span>L</span>
      </div>

      ${rows.map(row => `
        <div class="league-standings-row league-team-row">
          <span>${escapeHtml(row.name)}</span>
          <span>${row.played}</span>
          <span>${row.wins}</span>
          <span>${row.draws}</span>
          <span>${row.losses}</span>
        </div>
      `).join("")}
    </div>
  `;
}



function renderLeaguePositionLeaders(leagueId) {
  const league = leagueById(leagueId);
  const sportName = String(league?.sports?.name || "").toLowerCase();

  if (!sportName.includes("soccer") && !sportName.includes("football")) return "";

  const leaders = leaguePositionLeaders(leagueId);

  return `
    <div class="league-standings league-position-leaders">
      <div class="league-standings-title">Soccer position leaders</div>

      <div class="league-position-grid">
        ${SOCCER_POSITIONS.map(position => {
          const rows = leaders.get(position) || [];

          return `
            <div class="league-position-box">
              <div class="league-position-title">${position}</div>

              ${
                rows.length
                  ? rows.map((row, index) => `
                    <div class="league-position-row">
                      <span>${index + 1}</span>
                      <strong>${playerLinkHtml(row.memberId, row.name)}</strong>
                      <b>${row.rating.toFixed(1)}</b>
                    </div>
                  `).join("")
                  : `<div class="hint">No ${position} ratings yet.</div>`
              }
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderLeagueMatchHistory(leagueId) {
  const rows = leagueMatchHistoryRows(leagueId);

  if (!rows.length) {
    return `<div class="league-standings-empty">No league match history yet.</div>`;
  }

  return `
    <div class="league-standings league-history">
      <div class="league-standings-title">League match history</div>

      ${rows.map(match => `
        <div class="league-history-row">
          <div>
            <strong>${escapeHtml(match.title || "Match")}</strong>
            <span>${escapeHtml(fmtDate(match.start_time))}</span>
            <em>${escapeHtml(match.sports?.name || "-")} • ${escapeHtml(match.venues?.name || "-")}</em>
          </div>

          <div class="league-history-score">
            <b>${escapeHtml(leagueScoreText(match))}</b>
            <span>${escapeHtml(leagueWinnerText(match))}</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function canManageLeague(league) {
  return isCurrentUserAdmin() || league.created_by === currentProfile?.id;
}

function leagueHasLinkedData(leagueId) {
  return leagueMatches(leagueId).length > 0 || leagueCompletedGames(leagueId).length > 0;
}

async function openEditLeague(leagueId) {
  const league = leagueById(leagueId);

  if (!league) {
    alert("League not found.");
    return;
  }

  if (!canManageLeague(league)) {
    alert("Only the league creator or admin can edit this league.");
    return;
  }

  editingLeagueId = leagueId;

  await loadSportsOptions();
  updateLeagueSportOptions();

  const form = $("leagueForm");
  if (!form) return;

  form.elements["name"].value = league.name || "";
  form.elements["sport_id"].value = league.sport_id || "";
  form.elements["format"].value = league.format || "";
  form.elements["status"].value = league.status || "active";
  form.elements["start_date"].value = league.start_date || "";
  form.elements["end_date"].value = league.end_date || "";

  const title = form.querySelector("h3");
  if (title) title.textContent = "Edit League";

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "Save League";

  $("leagueModal")?.showModal();
}

async function deleteLeague(leagueId) {
  const league = leagueById(leagueId);

  if (!league) {
    alert("League not found.");
    return;
  }

  if (!canManageLeague(league)) {
    alert("Only the league creator or admin can delete this league.");
    return;
  }

  if (leagueHasLinkedData(leagueId)) {
    alert("This league already has linked matches or games. Mark it as completed instead of deleting it.");
    return;
  }

  const ok = confirm(`Delete league "${league.name}"?`);
  if (!ok) return;

  const { error } = await supabaseClient
    .from("leagues")
    .delete()
    .eq("id", leagueId);

  if (error) {
    alert(error.message);
    return;
  }

  alert("League deleted.");

  await loadLeagues();
  await loadMatchFormOptions();
}

async function markLeagueCompleted(leagueId) {
  const league = leagueById(leagueId);

  if (!league) {
    alert("League not found.");
    return;
  }

  if (!canManageLeague(league)) {
    alert("Only the league creator or admin can complete this league.");
    return;
  }

  const ok = confirm(`Mark "${league.name}" as completed? It will no longer appear when creating league matches.`);
  if (!ok) return;

  const { error } = await supabaseClient
    .from("leagues")
    .update({
      status: "completed"
    })
    .eq("id", leagueId);

  if (error) {
    alert(error.message);
    return;
  }

  alert("League completed.");

  await loadLeagues();
  await loadMatchFormOptions();
}


function leagueSectionStorageKey(leagueId, sectionKey) {
  return ABALeagues.sectionStorageKey(leagueId, sectionKey);
}

function isLeagueSectionOpen(leagueId, sectionKey) {
  return ABALeagues.isSectionOpen(leagueId, sectionKey);
}

function toggleLeagueSection(leagueId, sectionKey) {
  const nextOpen = !isLeagueSectionOpen(leagueId, sectionKey);

  ABALeagues.setSectionOpen(leagueId, sectionKey, nextOpen);

  renderLeagues();
}

function renderLeagueSection(leagueId, sectionKey, title, contentHtml) {
  return ABALeagues.sectionHtml(leagueId, sectionKey, title, contentHtml);
}

function renderLeagues() {
  if (!$("leagueList")) return;

  if (!allLeagues || allLeagues.length === 0) {
    $("leagueList").innerHTML = `<article class="card">No leagues created yet.</article>`;
    return;
  }

  $("leagueList").innerHTML = allLeagues.map(league => {
    const matchesCount = leagueMatches(league.id).length;
    const gamesCount = leagueCompletedGames(league.id).length;

    return `
      <article class="card league-card">
        <div class="row">
          <div>
            <h3>${escapeHtml(league.name)}</h3>
            <div class="meta">
              ${escapeHtml(league.sports?.name || "-")}
              • ${escapeHtml(league.format || "Open format")}
            </div>
            <div class="meta">
              ${league.start_date ? `From ${escapeHtml(league.start_date)}` : ""}
              ${league.end_date ? ` • Until ${escapeHtml(league.end_date)}` : ""}
            </div>
            <div class="meta">
              Linked bookings: ${matchesCount} • Completed games: ${gamesCount}
            </div>
          </div>

          <span class="pill ${league.status === "completed" ? "blue" : "green"}">
            ${escapeHtml(league.status || "active")}
          </span>
        </div>

        ${
          canManageLeague(league)
            ? `
              <div class="actions">
                <button class="small-btn" onclick="openEditLeague('${league.id}')">Edit League</button>

                ${
                  league.status !== "completed"
                    ? `<button class="small-btn" onclick="markLeagueCompleted('${league.id}')">Complete</button>`
                    : ""
                }

                <button class="small-btn danger-text-btn" onclick="deleteLeague('${league.id}')">Delete</button>
              </div>
            `
            : ""
        }

        <div class="league-sections">
          <div class="league-dashboard-grid">
            ${renderLeagueSection(league.id, "players", "Player standings", renderLeaguePlayerStandings(league.id))}

            ${renderLeagueSection(league.id, "teams", "Team/game standings", renderLeagueGameStandings(league.id))}
          </div>

          ${renderLeagueSection(league.id, "positions", "Position leaders", renderLeaguePositionLeaders(league.id) || `<div class="league-standings-empty">No position leaders for this sport.</div>`)}

          ${renderLeagueSection(league.id, "history", "Match history", renderLeagueMatchHistory(league.id))}
        </div>
      </article>
    `;
  }).join("");
}

async function loadLeagues() {
  if (!currentProfile || currentProfile.approval_status !== "approved") return;

  const { data, error } = await supabaseClient
    .from("leagues")
    .select(`
      id,
      name,
      sport_id,
      format,
      status,
      start_date,
      end_date,
      created_by,
      created_at,
      sports (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not load leagues:", error.message);
    allLeagues = [];
    renderLeagues();
    return;
  }

  allLeagues = data || [];
  renderLeagues();
  updateMatchLeagueOptions();
  updateMatchFilterOptions();
  updateRankingFilters();
  renderRankings();
}

function matchCard(m, compact = false) {
  return `
    <article class="card">
      <div class="row">
        <div>
          <h3>${escapeHtml(m.title)}</h3>
          <div class="meta">${escapeHtml(m.sport)} • ${escapeHtml(m.type)} • ${fmtDate(m.date)}</div>
          <div class="meta">📍 ${escapeHtml(m.venue)} ${m.address ? "— " + escapeHtml(m.address) : ""}</div>
        </div>
        <span class="pill green">Scheduled</span>
      </div>
      ${compact ? "" : commentSection(m)}
    </article>
  `;
}


async function loadMatches() {
  if (!currentProfile || currentProfile.approval_status !== "approved") return;

  const fullSelect = `
      id,
      sport_id,
      venue_id,
      league_id,
      created_by,
      max_players,
      required_players,
      external_players_count,
      visibility,
      team_status,
      score_status,
      title,
      match_type,
      start_time,
      end_time,
      voting_deadline_at,
      status,
      notes,
      created_at,
      sports (
        id,
        name
      ),
      venues (
        id,
        name,
        address,
        google_maps_url,
        image_url
      ),
      match_invitations (
        id,
        member_id,
        invited_by,
        status,
        member:members!match_invitations_member_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          email,
          is_external
        )
      ),
      match_teams (
        id,
        name,
        color,
        score,
        result,
        match_team_players (
          id,
          member_id,
          is_external,
          formation_position,
          is_captain,
          member:members!match_team_players_member_id_fkey (
            id,
            first_name,
            last_name,
            display_name,
            email,
            is_external
          )
        )
      ),
      match_score_entries (
        id,
        game_id,
        entry_type,
        game_number,
        set_number,
        team_a_score,
        team_b_score,
        is_completed,
        notes
      ),
      match_game_sessions (
        id,
        game_id,
        match_games (
          id,
          sport_id,
          league_id,
          title,
          status,
          team_a_name,
          team_b_name,
          team_a_score,
          team_b_score,
          winner_team,
          created_by,
          created_at
        )
      ),
      match_member_points (
        id,
        member_id,
        activity_points,
        score_points,
        base_points,
        difficulty_factor,
        consistency_bonus,
        total_points,
        member:members!match_member_points_member_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          email,
          is_external
        )
      ),
      match_position_rating_adjustments (
        id,
        game_id,
        member_id,
        sport_id,
        position_name,
        adjustment,
        rating_before,
        rating_after,
        created_at,
        member:members!match_position_rating_adjustments_member_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          email,
          is_external
        )
      )
    `;

  const fallbackSelect = `
      id,
      sport_id,
      venue_id,
      league_id,
      created_by,
      max_players,
      required_players,
      external_players_count,
      visibility,
      team_status,
      score_status,
      title,
      match_type,
      start_time,
      end_time,
      voting_deadline_at,
      status,
      notes,
      created_at,
      sports (
        id,
        name
      ),
      venues (
        id,
        name,
        address,
        google_maps_url,
        image_url
      ),
      match_invitations (
        id,
        member_id,
        invited_by,
        status,
        member:members!match_invitations_member_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          email,
          is_external
        )
      ),
      match_teams (
        id,
        name,
        color,
        score,
        result,
        match_team_players (
          id,
          member_id,
          is_external,
          formation_position,
          is_captain,
          member:members!match_team_players_member_id_fkey (
            id,
            first_name,
            last_name,
            display_name,
            email,
            is_external
          )
        )
      ),
      match_member_points (
        id,
        member_id,
        activity_points,
        score_points,
        base_points,
        difficulty_factor,
        consistency_bonus,
        total_points,
        member:members!match_member_points_member_id_fkey (
          id,
          first_name,
          last_name,
          display_name,
          email,
          is_external
        )
      )
    `;

  let result = await supabaseClient
    .from("matches")
    .select(fullSelect)
    .order("created_at", { ascending: false });

  if (result.error) {
    console.warn("Full match load failed. Retrying without game/session scoring tables:", result.error.message);

    result = await supabaseClient
      .from("matches")
      .select(fallbackSelect)
      .order("created_at", { ascending: false });
  }

  const { data, error } = result;

  if (error) {
    alert(error.message);
    return;
  }

  const myId = currentProfile?.id;

  allMatches = (data || []).filter(match =>
    isCurrentUserAdmin() ||
    match.created_by === myId ||
    (match.match_invitations || []).some(inv =>
      inv.member_id === myId && inv.status !== "removed"
    )
  );

  await loadRankingData();
  renderMatches();
  renderLeagues();
  renderRankings();
}

function invitationCounts(match) {
  return ABAMatches.invitationCounts(match);
}

function invitationMember(invitation) {
  return ABAMatches.invitationMember(invitation);
}

function invitationMemberDisplayName(invitation) {
  const member = invitationMember(invitation);

  return member?.display_name ||
    `${member?.first_name || ""} ${member?.last_name || ""}`.trim() ||
    member?.email ||
    "Unnamed";
}

function isExternalInvitation(invitation) {
  return ABAMatches.isExternalInvitation(invitation);
}

function externalPlayerInvitations(match) {
  return ABAMatches.externalPlayerInvitations(match);
}

function externalPlayerCount(match) {
  return ABAMatches.externalPlayerCount(match);
}

function filledPlayerCount(match) {
  return ABAMatches.filledPlayerCount(match);
}

function remainingSpots(match) {
  return ABAMatches.remainingSpots(match);
}

function myInvitation(match) {
  return (match.match_invitations || []).find(inv =>
    inv.member_id === currentProfile?.id
  );
}


function matchTimeIntervalsOverlap(matchA, matchB) {
  return ABAMatches.timeIntervalsOverlap(matchA, matchB);
}

function userIsInMatch(match, memberId = currentProfile?.id) {
  const cleanMemberId = cleanUuidValue(memberId);

  if (!match || !cleanMemberId) return false;

  const invitation = (match.match_invitations || []).find(inv =>
    cleanUuidValue(inv.member_id) === cleanMemberId
  );

  if (invitation?.status === "in") return true;

  const hasCreatorInvitation = (match.match_invitations || []).some(inv =>
    cleanUuidValue(inv.member_id) === cleanUuidValue(match.created_by) &&
    inv.status !== "removed"
  );

  return cleanUuidValue(match.created_by) === cleanMemberId && !hasCreatorInvitation;
}

function matchVotingDeadline(match) {
  const raw = match?.voting_deadline_at || "";
  const deadline = raw ? new Date(raw) : null;

  if (deadline && !Number.isNaN(deadline.getTime())) return deadline;

  const start = match?.start_time ? new Date(match.start_time) : null;
  if (!start || Number.isNaN(start.getTime())) return null;

  return new Date(start.getTime() - 24 * 60 * 60000);
}

function hasVotingDeadlinePassed(match) {
  const deadline = matchVotingDeadline(match);
  return Boolean(deadline && deadline <= new Date());
}

function votingDeadlineText(match) {
  const deadline = matchVotingDeadline(match);
  return deadline ? fmtDate(deadline.toISOString()) : "-";
}

function voteInTimeConflict(match) {
  const cleanMatchId = cleanUuidValue(match?.id);

  if (!match || !cleanMatchId) return null;

  return (allMatches || []).find(otherMatch => {
    const otherId = cleanUuidValue(otherMatch.id);

    if (!otherId || otherId === cleanMatchId) return false;
    if (!userIsInMatch(otherMatch)) return false;
    if (getMatchDisplayStatus(otherMatch) === "cancelled") return false;

    return matchTimeIntervalsOverlap(match, otherMatch);
  }) || null;
}

function timeConflictMessage(match, conflictingMatch) {
  return `You are already IN for "${conflictingMatch.title || "another match"}" (${fmtDate(conflictingMatch.start_time)} → ${fmtDate(conflictingMatch.end_time)}). You cannot vote IN for "${match.title || "this match"}" because the times overlap.`;
}

function canManageMatch(match) {
  return isCurrentUserAdmin() || match.created_by === currentProfile?.id;
}


function teamSideForTeam(match, team) {
  return ABATeams.sideForTeam(match, team);
}

function captainSidesForCurrentUser(match) {
  const myId = cleanUuidValue(currentProfile?.id);
  return ABATeams.captainSidesForMember(match, myId);
}

function canEditFormation(match) {
  if (!match || !isSoccerMatch(match)) return false;
  if (getMatchDisplayStatus(match) === "cancelled") return false;

  return canManageMatch(match) || captainSidesForCurrentUser(match).length > 0;
}

function allowedFormationSides(match) {
  if (canManageMatch(match) || currentTeamEditScope === "full") return ["A", "B"];
  return captainSidesForCurrentUser(match);
}

function isFormationOnlyMode() {
  return currentTeamEditScope === "formation";
}

function playerSideFromTeamId(match, teamId) {
  return ABATeams.playerSideFromTeamId(match, teamId);
}

function inPlayerNames(match) {
  return ABAMatches.inPlayerNames(match, invitationMemberDisplayName);
}


function getMatchDisplayStatus(match) {
  return ABAMatches.displayStatus(match);
}

function getMatchStatusClass(displayStatus, isFull) {
  return ABAMatches.statusClass(displayStatus, isFull);
}

function isVotingOpenForMatch(match) {
  return ABAMatches.isVotingOpen(match) && !hasVotingDeadlinePassed(match);
}

function isMatchEditable(match) {
  return ABAMatches.isEditable(match);
}


function inPlayerInvitations(match) {
  return ABAMatches.inPlayerInvitations(match);
}


function soccerPositionSortValue(position) {
  const clean = normalizeSoccerPosition(position);

  if (clean === "GK") return 1;
  if (clean === "DEF") return 2;
  if (clean === "MID") return 3;
  if (clean === "ATT") return 4;

  return 9;
}

function teamSideSortValue(side) {
  return ABATeams.sideSortValue(side);
}


function sideLabelForAssignmentSide(side) {
  return ABATeams.sideLabel(side);
}

function preferredSideOrderForCurrentUser(match) {
  const captainSides = captainSidesForCurrentUser(match);

  return ABATeams.preferredSideOrder({
    captainSides,
    formationOnly: isFormationOnlyMode()
  });
}

function sideOrderValue(side, orderedSides) {
  return ABATeams.sideOrderValue(side, orderedSides);
}

function teamNameForSide(match, side) {
  return ABATeams.teamNameForSide(match, side);
}

function assignmentGroupHeader(match, side, playersCount) {
  const teamName = side ? teamNameForSide(match, side) : "Unassigned";
  const captainSides = captainSidesForCurrentUser(match);
  const isMyCaptainTeam = isFormationOnlyMode() && captainSides.includes(side);

  return `
    <div class="team-assignment-group-title team-assignment-group-title-${side || "unassigned"}">
      <span>${escapeHtml(teamName)}</span>
      <em>${playersCount} player${playersCount === 1 ? "" : "s"}${isMyCaptainTeam ? " • your team" : ""}</em>
    </div>
  `;
}

function sortTeamPlayers(players) {
  return [...(players || [])].sort((a, b) =>
    soccerPositionSortValue(a.formationPosition) - soccerPositionSortValue(b.formationPosition) ||
    a.name.localeCompare(b.name)
  );
}

function teamAssignments(match) {
  const teams = match.match_teams || [];

  return teams.map(team => ({
    ...team,
    players: sortTeamPlayers((team.match_team_players || []).map(tp => ({
      teamPlayerId: tp.id,
      memberId: tp.member_id,
      name: memberDisplayName(tp.member),
      isExternal: Boolean(tp.member?.is_external),
      formationPosition: normalizeSoccerPosition(tp.formation_position),
      isCaptain: Boolean(tp.is_captain)
    })))
  }));
}


function teamPointText(match, team) {
  return ABATeams.pointText(match, team);
}


function teamScoreResultLine(match, team) {
  if (!hasSubmittedScore(match)) return "";

  const score = Number(team.score || 0);
  const result = team.result || "-";

  return `
    <span class="team-result-pill ${escapeHtml(result)}">
      ${score} • ${escapeHtml(result)}
    </span>
  `;
}

function teamResultLine(match, team) {
  if (!hasSubmittedScore(match)) return "";

  const score = Number(team.score || 0);
  const result = team.result || "-";
  const pointsText = teamPointText(match, team);

  return `
    <span class="team-result-pill ${escapeHtml(result)}">
      ${score} • ${escapeHtml(result)}
      ${pointsText ? ` • ${escapeHtml(pointsText)}` : ""}
    </span>
  `;
}

function teamPlayerChips(team, match = null) {
  const players = team.players || [];

  if (!players.length) return "No players assigned";

  return players.map(player => {
    const ratingChange = match ? ratingChangeForPlayer(match, player.memberId, player.formationPosition) : null;

    return `
      <span class="team-player-chip stacked-player-chip">
        <span class="team-player-main-line">
          ${player.formationPosition ? `<small class="position-chip">${escapeHtml(player.formationPosition)}</small>` : ""}
          ${player.memberId ? playerLinkHtml(player.memberId, player.name, "inline-player-link") : escapeHtml(player.name)}
          ${player.isCaptain ? `<b>C</b>` : ""}
          ${player.isExternal ? `<em>External</em>` : ""}
        </span>

        ${ratingChangeInlineHtml(ratingChange)}
      </span>
    `;
  }).join("");
}

function renderTeamsSummary(match) {
  const teams = teamAssignments(match);

  if (!teams.length) return "";

  return `
    <div class="teams-summary">
      ${teams.map(team => {
        const pointsText = teamPointText(match, team);

        return `
          <div class="team-summary-row enhanced-team-summary-row">
            <div class="team-summary-left">
              <div class="team-summary-main">
                <strong>${escapeHtml(team.name || "Team")}</strong>
                ${teamScoreResultLine(match, team)}
              </div>

              <span class="team-members-line">
                ${teamPlayerChips(team, match)}
              </span>
            </div>

            ${
              pointsText
                ? `<div class="team-points-earned">${escapeHtml(pointsText)}</div>`
                : ""
            }
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function currentTeamByMemberId(match) {
  return ABATeams.currentTeamByMemberId(match);
}




function currentTeamPlayerByMemberId(match) {
  return ABATeams.currentTeamPlayerByMemberId(match);
}

function isSoccerMatch(match) {
  return sportName(match).includes("soccer") ||
    sportName(match).includes("football");
}

const SOCCER_POSITIONS = ["GK", "DEF", "MID", "ATT"];

function soccerPositionOptions(selected = "") {
  return `
    <option value="">Position</option>
    ${SOCCER_POSITIONS.map(position => `
      <option value="${position}" ${selected === position ? "selected" : ""}>
        ${position}
      </option>
    `).join("")}
  `;
}

function preferredPositionOptions(selected = "", isSoccer = false) {
  const cleanSelected = normalizeSoccerPosition(selected) || String(selected || "").trim();

  if (isSoccer) {
    return `
      <option value="">No preference</option>
      ${SOCCER_POSITIONS.map(position => `
        <option value="${position}" ${cleanSelected === position ? "selected" : ""}>
          ${position}
        </option>
      `).join("")}
    `;
  }

  return `
    <option value="">No preference</option>
    <option value="General" ${cleanSelected === "General" ? "selected" : ""}>General</option>
  `;
}


function normalizeSoccerPosition(position) {
  const clean = String(position || "").trim().toUpperCase();

  if (clean === "GOALKEEPER" || clean === "KEEPER") return "GK";
  if (clean === "DEFENDER" || clean === "DEFENCE" || clean === "DEFENSE") return "DEF";
  if (clean === "MIDFIELDER" || clean === "CENTER" || clean === "CM") return "MID";
  if (clean === "ATTACKER" || clean === "STRIKER" || clean === "FORWARD" || clean === "FW") return "ATT";

  return SOCCER_POSITIONS.includes(clean) ? clean : "";
}

function soccerFormationTemplate(playerCount) {
  if (playerCount <= 4) return ["GK", "DEF", "MID", "ATT"].slice(0, playerCount);
  if (playerCount === 5) return ["GK", "DEF", "MID", "ATT", "ATT"];
  if (playerCount === 6) return ["GK", "DEF", "DEF", "MID", "ATT", "ATT"];
  if (playerCount === 7) return ["GK", "DEF", "DEF", "MID", "MID", "ATT", "ATT"];
  if (playerCount === 8) return ["GK", "DEF", "DEF", "DEF", "MID", "MID", "ATT", "ATT"];
  if (playerCount === 9) return ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "ATT", "ATT"];
  if (playerCount === 10) return ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "ATT", "ATT", "ATT"];

  const positions = ["GK"];
  let remaining = playerCount - 1;
  const cycle = ["DEF", "MID", "ATT"];

  while (remaining > 0) {
    positions.push(cycle[(positions.length - 1) % cycle.length]);
    remaining -= 1;
  }

  return positions;
}

function positionWeight(position, memberId, sportId) {
  const preferred = normalizeSoccerPosition(memberSportPosition(memberId, sportId));
  const rating = positionRatingForMember(memberId, sportId, position);
  let score = rating;

  if (preferred && preferred === position) score += 2;
  if (position === "GK" && preferred !== "GK") score -= 1;

  return score;
}

function assignSoccerPositionsToTeam(memberIds, sportId, forcedGkMemberId = null) {
  const template = soccerFormationTemplate(memberIds.length);
  const available = [...memberIds];
  const assignment = new Map();
  const cleanForcedGk = cleanUuidValue(forcedGkMemberId);

  const gkIndex = template.indexOf("GK");

  if (cleanForcedGk && available.includes(cleanForcedGk) && gkIndex !== -1) {
    assignment.set(cleanForcedGk, "GK");
    available.splice(available.indexOf(cleanForcedGk), 1);
    template.splice(gkIndex, 1);
  }

  template.forEach(position => {
    if (!available.length) return;

    let bestIndex = 0;
    let bestScore = -Infinity;

    available.forEach((memberId, index) => {
      const score = positionWeight(position, memberId, sportId);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const [memberId] = available.splice(bestIndex, 1);
    assignment.set(memberId, position);
  });

  return assignment;
}



function selectedTeamForMember(memberId) {
  return document.querySelector(`#team-assignment-list input[name="team-choice-${memberId}"]:checked`)?.value || "";
}

function captainSelectOptionsForTeam(teamMembers, selectedCaptainId = "") {
  return `
    <option value="">Select captain</option>
    ${teamMembers.map(player => `
      <option value="${player.memberId}" ${selectedCaptainId === player.memberId ? "selected" : ""}>
        ${escapeHtml(player.name)}
      </option>
    `).join("")}
  `;
}

function existingCaptainBySide(match, side) {
  const teams = match?.match_teams || [];
  const team = teams.find(t => t.color === side) || (side === "A" ? teams[0] : teams[1]);

  const captain = (team?.match_team_players || []).find(player => player.is_captain);
  return captain?.member_id || "";
}

function assignedPlayersForCaptainSelect(match, side) {
  const assignments = collectTeamAssignments();

  return assignments.all
    .filter(player => player.team === side)
    .map(player => {
      const inv = inPlayerInvitations(match).find(item => item.member_id === player.memberId);
      return {
        memberId: player.memberId,
        name: inv ? invitationMemberDisplayName(inv) : player.memberId
      };
    });
}

function updateCaptainSelectors() {
  const wrapper = $("captain-selectors");
  const captainASelect = $("team-a-captain");
  const captainBSelect = $("team-b-captain");
  const match = allMatches.find(m => m.id === currentTeamMatchId);

  if (!wrapper || !captainASelect || !captainBSelect || !match) return;

  if (!isSoccerMatch(match)) {
    wrapper.style.display = "none";
    captainASelect.value = "";
    captainBSelect.value = "";
    return;
  }

  wrapper.style.display = "";

  const previousA = captainASelect.value || existingCaptainBySide(match, "A");
  const previousB = captainBSelect.value || existingCaptainBySide(match, "B");

  const teamAPlayers = assignedPlayersForCaptainSelect(match, "A");
  const teamBPlayers = assignedPlayersForCaptainSelect(match, "B");

  captainASelect.innerHTML = captainSelectOptionsForTeam(teamAPlayers, previousA);
  captainBSelect.innerHTML = captainSelectOptionsForTeam(teamBPlayers, previousB);

  if (!teamAPlayers.some(player => player.memberId === previousA)) {
    captainASelect.value = "";
  }

  if (!teamBPlayers.some(player => player.memberId === previousB)) {
    captainBSelect.value = "";
  }

  captainASelect.disabled = isFormationOnlyMode();
  captainBSelect.disabled = isFormationOnlyMode();
}

function teamFormationCounts(assignments, side) {
  const players = assignments.all.filter(player => player.team === side);
  const counts = {
    total: players.length,
    GK: 0,
    DEF: 0,
    MID: 0,
    ATT: 0
  };

  players.forEach(player => {
    const position = normalizeSoccerPosition(player.position);
    if (counts[position] !== undefined) counts[position] += 1;
  });

  return counts;
}

function validateSoccerFormationSide(counts, sideLabel) {
  if (counts.total < 5) {
    return `${sideLabel} needs at least 5 players for the required soccer formation rules.`;
  }

  if (counts.GK !== 1) {
    return `${sideLabel} must have exactly 1 GK.`;
  }

  if (counts.DEF < 2) {
    return `${sideLabel} must have at least 2 DEF players.`;
  }

  if (counts.MID < 1) {
    return `${sideLabel} must have at least 1 MID player.`;
  }

  if (counts.ATT < 1) {
    return `${sideLabel} must have at least 1 ATT player.`;
  }

  return "";
}

function soccerMidHybridAdjustment({ attackAdjustment = 0, defenseAdjustment = 0, resultModifier = 0 } = {}) {
  const settings = soccerRatingSettings();

  return (settings.midAttackWeight * attackAdjustment) +
    (settings.midDefenseWeight * defenseAdjustment) +
    resultModifier;
}

function updateFormationStatus() {
  const status = $("formation-status");
  if (!status) return;

  const match = allMatches.find(m => m.id === currentTeamMatchId);

  if (!match || !isSoccerMatch(match)) {
    status.textContent = "Formation: available for soccer matches.";
    status.classList.remove("balanced", "unbalanced");
    return;
  }

  updateCaptainSelectors();

  const assignments = collectTeamAssignments();
  const countsA = teamFormationCounts(assignments, "A");
  const countsB = teamFormationCounts(assignments, "B");
  const missingPositions = assignments.all.filter(player =>
    player.team && !player.position
  ).length;

  const captainA = $("team-a-captain")?.value || "";
  const captainB = $("team-b-captain")?.value || "";

  const errorA = validateSoccerFormationSide(countsA, "Team A");
  const errorB = validateSoccerFormationSide(countsB, "Team B");

  const parts = [
    `Team A: GK ${countsA.GK}, DEF ${countsA.DEF}, MID ${countsA.MID}, ATT ${countsA.ATT}`,
    `Team B: GK ${countsB.GK}, DEF ${countsB.DEF}, MID ${countsB.MID}, ATT ${countsB.ATT}`
  ];

  if (missingPositions) parts.push(`Missing positions: ${missingPositions}`);
  if (!captainA) parts.push("Team A captain missing");
  if (!captainB) parts.push("Team B captain missing");
  if (errorA) parts.push(errorA);
  if (errorB) parts.push(errorB);

  status.textContent = `Formation: ${parts.join(" • ")}`;

  const ok = !missingPositions && !errorA && !errorB && captainA && captainB;
  status.classList.toggle("balanced", Boolean(ok));
  status.classList.toggle("unbalanced", !ok);
}

function sportName(match) {
  return ABAMatches.sportName(match);
}

function isPadelMatch(match) {
  return ABAMatches.isPadel(match);
}

function isSimpleScoreMatch(match) {
  return ABAMatches.isSimpleScore(match);
}

function scoreEntries(match, entryType = null) {
  return ABAScoring.scoreEntries(match, entryType);
}

function padelSetInputs() {
  return [1, 2, 3].map(setNumber => {
    const aRaw = $(`padel-set-${setNumber}-a`)?.value;
    const bRaw = $(`padel-set-${setNumber}-b`)?.value;
    const completed = Boolean($(`padel-set-${setNumber}-completed`)?.checked);

    const hasAnyValue = aRaw !== "" || bRaw !== "";
    const a = aRaw === "" ? null : Number(aRaw);
    const b = bRaw === "" ? null : Number(bRaw);

    return {
      setNumber,
      teamAScore: a,
      teamBScore: b,
      isCompleted: completed,
      hasAnyValue
    };
  });
}

function calculatePadelSetResult(sets) {
  return ABAScoring.calculatePadelSetResult(sets);
}

function updatePadelScorePreview() {
  const preview = $("padel-score-preview");
  if (!preview) return;

  const result = calculatePadelSetResult(padelSetInputs());

  if (result.error) {
    preview.textContent = result.error;
    preview.classList.add("unbalanced");
    preview.classList.remove("balanced");
    return;
  }

  preview.textContent = `Sets: ${result.teamASetWins} - ${result.teamBSetWins}`;
  preview.classList.add("balanced");
  preview.classList.remove("unbalanced");
}

function setScoreMode(match) {
  const simpleSection = $("simple-score-section");
  const padelSection = $("padel-score-section");

  if (!simpleSection || !padelSection) return;

  if (isPadelMatch(match)) {
    simpleSection.style.display = "none";
    padelSection.style.display = "";
  } else {
    simpleSection.style.display = "";
    padelSection.style.display = "none";
  }
}


function matchSessionGames(match) {
  return ABAScoring.matchSessionGames(match);
}

function scoreEntriesForGame(match, gameId) {
  return ABAScoring.scoreEntriesForGame(match, gameId);
}

async function loadPendingPadelGames(match) {
  const linkedGames = matchSessionGames(match);

  const { data, error } = await supabaseClient
    .from("match_games")
    .select("id,sport_id,league_id,title,status,team_a_name,team_b_name,team_a_score,team_b_score,winner_team,created_by,created_at")
    .eq("sport_id", match.sport_id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    allPendingGames = linkedGames;
    return allPendingGames;
  }

  const byId = new Map();

  linkedGames.forEach(game => {
    if (game?.id) byId.set(game.id, game);
  });

  (data || []).forEach(game => {
    if (game?.id && !byId.has(game.id)) byId.set(game.id, game);
  });

  allPendingGames = Array.from(byId.values());

  return allPendingGames;
}

function renderPendingGameOptions() {
  const select = $("padel-pending-game");
  if (!select) return;

  if (!allPendingGames.length) {
    select.innerHTML = `<option value="">No games found</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Select game</option>
    ${allPendingGames.map(game => `
      <option value="${game.id}">
        ${escapeHtml(game.title || "Game")} — ${escapeHtml(game.status || "-")}
      </option>
    `).join("")}
  `;
}

function setPadelGameModeUI() {
  const mode = $("padel-game-mode")?.value || "new";
  const label = $("padel-pending-game-label");
  const deleteBtn = $("delete-game-btn");

  if (label) label.style.display = mode === "continue" ? "" : "none";
  if (deleteBtn) deleteBtn.style.display = mode === "continue" ? "" : "none";
}

function clearPadelSetInputs() {
  for (const setNumber of [1, 2, 3]) {
    if ($(`padel-set-${setNumber}-a`)) $(`padel-set-${setNumber}-a`).value = "";
    if ($(`padel-set-${setNumber}-b`)) $(`padel-set-${setNumber}-b`).value = "";
    if ($(`padel-set-${setNumber}-completed`)) $(`padel-set-${setNumber}-completed`).checked = false;
  }

  updatePadelScorePreview();
}

async function loadPendingGameScoreIntoForm(gameId) {
  if (!gameId) {
    clearPadelSetInputs();
    return;
  }

  const game = allPendingGames.find(g => g.id === gameId);

  if ($("padel-game-title")) {
    $("padel-game-title").value = game?.title || "Continued Game";
  }

  const { data, error } = await supabaseClient
    .from("match_score_entries")
    .select("id,game_id,entry_type,game_number,set_number,team_a_score,team_b_score,is_completed,notes")
    .eq("game_id", gameId)
    .eq("entry_type", "padel_set")
    .order("set_number", { ascending: true });

  if (error) {
    alert(error.message);
    clearPadelSetInputs();
    return;
  }

  clearPadelSetInputs();

  (data || []).forEach(entry => {
    const setNumber = Number(entry.set_number || 0);
    if (![1, 2, 3].includes(setNumber)) return;

    if ($(`padel-set-${setNumber}-a`)) $(`padel-set-${setNumber}-a`).value = Number(entry.team_a_score || 0);
    if ($(`padel-set-${setNumber}-b`)) $(`padel-set-${setNumber}-b`).value = Number(entry.team_b_score || 0);
    if ($(`padel-set-${setNumber}-completed`)) $(`padel-set-${setNumber}-completed`).checked = Boolean(entry.is_completed);
  });

  updatePadelScorePreview();
}

function padelGameWinnerFromSets(padelResult) {
  if (padelResult.teamASetWins >= 2) return "A";
  if (padelResult.teamBSetWins >= 2) return "B";
  return null;
}


function isResultLocked(match) {
  return hasSubmittedScore(match);
}

function confirmResultEditLock(match) {
  if (!isResultLocked(match)) return true;

  return confirm("This result is finalized and locked. Editing it will recalculate points, soccer ratings, rating history, and league standings. Continue?");
}

function confirmTeamEditAfterFinalized(match) {
  if (!isResultLocked(match)) return true;

  return confirm("This match already has a finalized result. Editing teams may recalculate points, soccer position ratings, and league standings. Continue?");
}

function canSubmitScore(match) {
  const displayStatus = getMatchDisplayStatus(match);

  return canManageMatch(match) &&
    displayStatus !== "cancelled" &&
    (
      displayStatus === "finished" ||
      displayStatus === "completed" ||
      match.score_status === "submitted"
    );
}

function hasSubmittedScore(match) {
  return match.score_status === "submitted" || match.status === "completed";
}

function renderScoreSummary(match) {
  return ABAScoring.renderScoreSummary(match, {
    hasSubmittedScore,
    isPadelMatch,
    escapeHtml
  });
}


function isTeamEditable(match) {
  const displayStatus = getMatchDisplayStatus(match);

  return ABATeams.canEditTeams({
    canManage: canManageMatch(match),
    displayStatus
  });
}


function minutesUntilMatchStart(match) {
  return ABAMatches.minutesUntilStart(match);
}

function matchHasTeamsAssigned(match) {
  return ABATeams.hasAssignedPlayers(match);
}

function soccerFormationIssues(match) {
  if (!isSoccerMatch(match) || !matchHasTeamsAssigned(match)) return [];

  const teams = match.match_teams || [];
  const issues = [];

  teams.forEach((team, index) => {
    const side = teamSideForTeam(match, team) || (index === 0 ? "A" : "B");
    const counts = {
      total: 0,
      GK: 0,
      DEF: 0,
      MID: 0,
      ATT: 0
    };

    (team.match_team_players || []).forEach(player => {
      counts.total += 1;
      const position = normalizeSoccerPosition(player.formation_position);
      if (counts[position] !== undefined) counts[position] += 1;
    });

    const error = validateSoccerFormationSide(counts, team.name || `Team ${side}`);

    if (error) issues.push(error);
  });

  return issues;
}

function matchSmartBadges(match) {
  const badges = [];
  const displayStatus = getMatchDisplayStatus(match);
  const minutesToStart = minutesUntilMatchStart(match);
  const hasTeams = matchHasTeamsAssigned(match);
  const formationIssues = soccerFormationIssues(match);
  const isCaptain = captainSidesForCurrentUser(match).length > 0;

  if (displayStatus === "cancelled") {
    badges.push({ text: "Cancelled", type: "danger" });
    return badges;
  }

  if (hasVotingDeadlinePassed(match) && !hasSubmittedScore(match)) {
    badges.push({ text: "Voting closed", type: "danger" });
  }

  if (hasSubmittedScore(match)) {
    badges.push({ text: "Result submitted", type: "success" });
    badges.push({ text: "Result locked", type: "blue" });
  } else if (displayStatus === "finished" || displayStatus === "completed") {
    badges.push({ text: "Result pending", type: "danger" });
  }

  if (minutesToStart !== null && minutesToStart > 0 && minutesToStart <= 120) {
    badges.push({
      text: minutesToStart <= 60
        ? `Starts in ${minutesToStart} min`
        : `Starts in ${Math.round(minutesToStart / 60)} hr`,
      type: minutesToStart <= 30 ? "danger" : "gold"
    });
  }

  if (!hasTeams && displayStatus !== "cancelled" && displayStatus !== "completed") {
    if (minutesToStart !== null && minutesToStart <= 180) {
      badges.push({ text: "Teams not assigned", type: "danger" });
    } else if (filledPlayerCount(match) >= 2) {
      badges.push({ text: "Teams needed", type: "gold" });
    }
  }

  if (formationIssues.length) {
    badges.push({ text: "Formation incomplete", type: "danger" });
  }

  if (isCaptain && isSoccerMatch(match) && hasTeams && displayStatus !== "cancelled") {
    badges.push({ text: "Captain action available", type: "blue" });
  }

  if (voteInTimeConflict(match) && !userIsInMatch(match) && isVotingOpenForMatch(match)) {
    badges.push({ text: "Time conflict", type: "danger" });
  }

  return badges;
}

function renderSmartBadges(match) {
  const badges = matchSmartBadges(match);

  if (!badges.length) return "";

  return `
    <div class="smart-badges">
      ${badges.map(badge => `
        <span class="smart-badge ${escapeHtml(badge.type || "neutral")}">${escapeHtml(badge.text)}</span>
      `).join("")}
    </div>
  `;
}


function updateMatchFilterOptions() {
  const sportSelect = $("match-filter-sport");
  const leagueSelect = $("match-filter-league");

  if (sportSelect) {
    const current = sportSelect.value || "all";

    sportSelect.innerHTML = `
      <option value="all">All sports</option>
      ${(allSports || []).map(sport => `
        <option value="${sport.id}">${escapeHtml(sport.name)}</option>
      `).join("")}
    `;

    sportSelect.value = Array.from(sportSelect.options).some(option => option.value === current)
      ? current
      : "all";
  }

  if (leagueSelect) {
    const current = leagueSelect.value || "all";
    const selectedSport = sportSelect?.value || "all";

    const leagues = (allLeagues || []).filter(league =>
      selectedSport === "all" || league.sport_id === selectedSport
    );

    leagueSelect.innerHTML = `
      <option value="all">All leagues</option>
      <option value="none">Friendly / no league</option>
      ${leagues.map(league => `
        <option value="${league.id}">${escapeHtml(league.name)}</option>
      `).join("")}
    `;

    leagueSelect.value = Array.from(leagueSelect.options).some(option => option.value === current)
      ? current
      : "all";
  }
}

function matchMyStatus(match) {
  const invitation = myInvitation(match);

  return ABAMatches.myStatus(match, invitation, currentProfile?.id);
}

function matchStatusFilterValue(match) {
  return ABAMatches.statusFilterValue(match, hasSubmittedScore(match));
}

function matchFilterPriority(match) {
  return ABAMatches.filterPriority(matchStatusFilterValue(match));
}

function filteredMatches() {
  const search = String($("match-filter-search")?.value || "").trim().toLowerCase();
  const sportId = $("match-filter-sport")?.value || "all";
  const leagueId = $("match-filter-league")?.value || "all";
  const status = $("match-filter-status")?.value || "active";
  const myStatus = $("match-filter-my-status")?.value || "all";

  return [...(allMatches || [])]
    .filter(match => {
      const displayStatus = getMatchDisplayStatus(match);
      const filterStatus = matchStatusFilterValue(match);
      const mine = matchMyStatus(match);

      if (sportId !== "all" && match.sport_id !== sportId) return false;

      if (leagueId === "none" && match.league_id) return false;
      if (leagueId !== "all" && leagueId !== "none" && match.league_id !== leagueId) return false;

      if (status === "active" && displayStatus === "cancelled") return false;
      if (status !== "all" && status !== "active" && filterStatus !== status) return false;

      if (myStatus === "not_in" && mine === "in") return false;
      if (myStatus !== "all" && myStatus !== "not_in" && mine !== myStatus) return false;

      if (search) {
        const haystack = [
          match.title,
          match.sports?.name,
          match.match_type,
          leagueNameForId(match.league_id),
          match.venues?.name,
          match.venues?.address,
          match.notes
        ].filter(Boolean).join(" ").toLowerCase();

        if (!haystack.includes(search)) return false;
      }

      return true;
    })
    .sort((a, b) =>
      matchFilterPriority(a) - matchFilterPriority(b) ||
      new Date(a.start_time) - new Date(b.start_time)
    );
}

function resetMatchFilters() {
  if ($("match-filter-search")) $("match-filter-search").value = "";
  if ($("match-filter-sport")) $("match-filter-sport").value = "all";
  updateMatchFilterOptions();
  if ($("match-filter-league")) $("match-filter-league").value = "all";
  if ($("match-filter-status")) $("match-filter-status").value = "active";
  if ($("match-filter-my-status")) $("match-filter-my-status").value = "all";
  renderMatches();
}

function deepLinkedMatchId() {
  const hash = window.location.hash || "";

  if (!hash.startsWith("#matches")) return "";

  const queryStart = hash.indexOf("?");
  if (queryStart < 0) return "";

  const params = new URLSearchParams(hash.slice(queryStart + 1));
  return cleanUuidValue(params.get("match"));
}

function resetMatchFiltersForDeepLink() {
  if ($("match-filter-search")) $("match-filter-search").value = "";
  if ($("match-filter-sport")) $("match-filter-sport").value = "all";
  updateMatchFilterOptions();
  if ($("match-filter-league")) $("match-filter-league").value = "all";
  if ($("match-filter-status")) $("match-filter-status").value = "all";
  if ($("match-filter-my-status")) $("match-filter-my-status").value = "all";
}

function focusMatchCard(matchId) {
  const safeMatchId = cleanUuidValue(matchId);
  if (!safeMatchId) return false;

  const card = $(`match-${safeMatchId}`);
  if (!card) return false;

  document.querySelectorAll(".match-card.deep-link-target").forEach(el => {
    el.classList.remove("deep-link-target");
  });

  card.classList.add("deep-link-target");
  card.scrollIntoView({ behavior: "smooth", block: "center" });

  return true;
}

function openDeepLinkedMatch() {
  const matchId = deepLinkedMatchId();
  if (!matchId) return false;

  setActiveTab("matches", false);
  resetMatchFiltersForDeepLink();
  renderMatches();

  setTimeout(() => {
    const found = focusMatchCard(matchId);

    if (!found) {
      showPushToast("Match not visible yet", "Refresh matches or check that you are invited to this match.");
    }
  }, 120);

  return true;
}




function matchFormationStorageKey(matchId) {
  return ABAMatches.formationStorageKey(matchId);
}

function isMatchFormationOpen(matchId) {
  return ABAMatches.isFormationOpen(matchId);
}

function toggleMatchFormation(matchId) {
  const nextOpen = !isMatchFormationOpen(matchId);

  ABAMatches.setFormationOpen(matchId, nextOpen);

  renderMatches();
}

function ratingChangeForPlayer(match, memberId, fallbackPosition = "") {
  const cleanMemberId = cleanUuidValue(memberId);

  if (!cleanMemberId) return null;

  if (isPadelMatch(match)) {
    return padelOverallRatingChangeForPlayer(match, cleanMemberId);
  }

  const cleanFallbackPosition = normalizeSoccerPosition(fallbackPosition);

  const rows = (match.match_position_rating_adjustments || []).filter(row =>
    cleanUuidValue(row.member_id) === cleanMemberId
  );

  if (!rows.length) return null;

  const preferred = cleanFallbackPosition
    ? rows.find(row => normalizeSoccerPosition(row.position_name) === cleanFallbackPosition)
    : null;

  const row = preferred || rows[0];

  const before = Number(row.rating_before ?? 0);
  const after = Number(row.rating_after ?? 0);
  const delta = after - before;

  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;

  return {
    position: normalizeSoccerPosition(row.position_name) || row.position_name || "",
    before,
    after,
    delta
  };
}

function padelOverallRatingChangeForPlayer(match, memberId) {
  const rows = (match.match_position_rating_adjustments || [])
    .filter(row =>
      cleanUuidValue(row.member_id) === memberId &&
      String(row.position_name || "").toUpperCase() === PADEL_RATING_POSITION
    )
    .sort((a, b) =>
      new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

  if (!rows.length) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const before = Number(first.rating_before ?? 0);
  const after = Number(last.rating_after ?? before);
  const delta = rows.reduce((sum, row) => {
    const rowBefore = Number(row.rating_before ?? 0);
    const rowAfter = Number(row.rating_after ?? rowBefore);

    return sum + (Number.isFinite(rowBefore) && Number.isFinite(rowAfter)
      ? rowAfter - rowBefore
      : Number(row.adjustment || 0));
  }, 0);

  if (!Number.isFinite(before) || !Number.isFinite(after) || !Number.isFinite(delta)) return null;

  return {
    position: "OVR",
    before,
    after,
    delta
  };
}

function ratingChangeInlineHtml(change) {
  if (!change) return "";

  const deltaText = `${change.delta >= 0 ? "+" : ""}${change.delta.toFixed(2)}`;

  return `
    <small class="inline-rating-change ${change.delta >= 0 ? "positive" : "negative"}">
      ${escapeHtml(change.position)} ${change.before.toFixed(1)}→${change.after.toFixed(1)} (${deltaText})
    </small>
  `;
}

function formationSectionTitleParts(match) {
  const { teamA, teamB } = getTwoMatchTeams(match);

  return ABATeams.formationTitleParts({
    teamA,
    teamB,
    hasScore: hasSubmittedScore(match)
  });
}

function formationSectionTitleHtml(match) {
  const parts = formationSectionTitleParts(match);

  if (!parts.teamAName || !parts.teamBName) {
    return `<span class="game-stats-title-simple"><span class="game-stats-heading-simple">Game Stats</span></span>`;
  }

  return `
    <span class="game-stats-title-simple">
      <span class="game-stats-heading-simple">Game Stats</span>
      <span class="game-stats-team-simple">${escapeHtml(parts.teamAName)}</span>
      ${
        parts.hasScore
          ? `<span class="game-stats-score-simple">${parts.scoreA} - ${parts.scoreB}</span>`
          : `<span class="game-stats-score-simple">vs</span>`
      }
      <span class="game-stats-team-simple">${escapeHtml(parts.teamBName)}</span>
    </span>
  `;
}

function renderFormationSection(match) {
  const content = renderTeamsSummary(match);

  if (!content) return "";

  const open = isMatchFormationOpen(match.id);
  const titleHtml = formationSectionTitleHtml(match);

  return `
    <div class="match-formation-section ${open ? "open" : "closed"}">
      <button class="match-formation-toggle" type="button" onclick="toggleMatchFormation('${match.id}')">
        ${titleHtml}
        <b>${open ? "▼" : "▶"}</b>
      </button>

      ${open ? `<div class="match-formation-body">${content}</div>` : ""}
    </div>
  `;
}

function renderMatches() {
  if (!$("matchList")) return;

  if (!allMatches || allMatches.length === 0) {
    $("matchList").innerHTML = `<article class="card">No matches scheduled yet.</article>`;
    return;
  }

  updateMatchFilterOptions();

  const visibleMatches = typeof filteredMatches === "function" ? filteredMatches() : allMatches;

  if (!visibleMatches.length) {
    $("matchList").innerHTML = `<article class="card">No matches match the selected filters.</article>`;
    return;
  }

  $("matchList").innerHTML = visibleMatches.map(match => {
    const displayStatus = getMatchDisplayStatus(match);
    const isCancelled = displayStatus === "cancelled";
    const isFuture = new Date(match.start_time) > new Date();
    const votingOpen = isVotingOpenForMatch(match);
    const matchEditable = isMatchEditable(match);
    const counts = invitationCounts(match);
    const externalInvitations = externalPlayerInvitations(match);
    const externalCount = externalInvitations.length;
    const filledCount = counts.inCount;
    const invitation = myInvitation(match);
    const isCreator = String(match.created_by || "") === String(currentProfile?.id || "");
    const isAdmin = isCurrentUserAdmin();
    const currentVoteStatus = invitation?.status || (isCreator ? "in" : null);

    const maxPlayers = Number(match.max_players || 0);
    const spotsLabel = maxPlayers
      ? `${filledCount}/${maxPlayers} filled`
      : `${filledCount} filled`;

    const isFull = maxPlayers && filledCount >= maxPlayers;
    const userIsIn = currentVoteStatus === "in";
    const canVoteThisMatch = Boolean(invitation || isCreator || isAdmin);
    const conflictingVoteMatch = !userIsIn && votingOpen ? voteInTimeConflict(match) : null;
    const teamsAssigned = matchHasTeamsAssigned(match);

    return `
      <article id="match-${escapeHtml(match.id)}" class="card match-card" data-match-id="${escapeHtml(match.id)}">
        <div class="row">
          <div>
            <h3>${escapeHtml(match.title || "Untitled match")}</h3>

            <div class="meta">
              ${escapeHtml(match.sports?.name || "-")}
              • ${escapeHtml(match.match_type || "-")}
              • ${fmtDate(match.start_time)}
            </div>

            ${
              match.league_id
                ? `<div class="meta">🏆 League: ${escapeHtml(leagueNameForId(match.league_id) || "Linked league")}</div>`
                : ""
            }

            <div class="meta">
              Time: ${fmtDate(match.start_time)} → ${fmtDate(match.end_time)}
            </div>

            <div class="meta">
              Voting deadline: ${escapeHtml(votingDeadlineText(match))}
            </div>

            <div class="meta">
              📍 ${escapeHtml(match.venues?.name || "-")}
              ${match.venues?.address ? "— " + escapeHtml(match.venues.address) : ""}
            </div>

            ${renderSmartBadges(match)}

            ${
              !teamsAssigned
                ? `<div class="meta">
                    Players: ${spotsLabel}
                    • IN: ${counts.inCount}
                    • External: ${externalCount}
                    • Maybe: ${counts.maybeCount}
                    • Out: ${counts.outCount}
                    • Invited: ${counts.invitedCount}
                  </div>`
                : ""
            }

            ${
              !teamsAssigned
                ? `<div class="meta">IN players: ${inPlayerNames(match).length ? escapeHtml(inPlayerNames(match).join(", ")) : "-"}</div>`
                : ""
            }

            ${
              conflictingVoteMatch
                ? `<div class="meta conflict-warning">Time conflict with: ${escapeHtml(conflictingVoteMatch.title || "another match")}</div>`
                : ""
            }

            ${renderScoreSummary(match)}

            ${renderPointsSummary(match)}

            ${
              externalCount && canManageMatch(match) && matchEditable
                ? `<div class="meta"><button class="tiny-btn" onclick="openExternalPlayersModal('${match.id}')">Manage external players</button></div>`
                : ""
            }

            ${
              isFull
                ? `<div class="meta">Match is full.</div>`
                : ""
            }

            ${
              match.venues?.google_maps_url
                ? `<div class="meta"><a href="${escapeHtml(match.venues.google_maps_url)}" target="_blank">Open Map</a></div>`
                : ""
            }

            ${
              match.notes
                ? `<div class="meta">${escapeHtml(match.notes)}</div>`
                : ""
            }
          </div>

          <span class="pill ${getMatchStatusClass(displayStatus, isFull)}">
            ${escapeHtml(isFull && displayStatus === "open_for_votes" ? "full" : displayStatus)}
          </span>
        </div>

        ${renderFormationSection(match)}

        ${
         canVoteThisMatch && votingOpen
            ? `
              <div class="actions">
                <button
                  class="small-btn ${currentVoteStatus === "in" ? "selected-vote" : ""}"
                  onclick="voteMatch('${match.id}', 'in')"
                  ${(isFull && !userIsIn) || conflictingVoteMatch ? "disabled" : ""}
                >
                  I'm In
                </button>

                <button
                  class="small-btn ${currentVoteStatus === "maybe" ? "selected-vote" : ""}"
                  onclick="voteMatch('${match.id}', 'maybe')"
                >
                  Maybe
                </button>

                <button
                  class="small-btn ${currentVoteStatus === "out" ? "selected-vote-red" : ""}"
                  onclick="voteMatch('${match.id}', 'out')"
                >
                  Out
                </button>
              </div>
            `
            : ""
        }

        ${
          !canManageMatch(match) && canEditFormation(match) && (match.match_teams || []).length
            ? `
              <div class="actions">
                <button class="small-btn" onclick="openTeamAssignment('${match.id}', 'formation')">
                  Edit Formation
                </button>
              </div>
            `
            : ""
        }

        ${
          canManageMatch(match)
            ? `
              <div class="actions">
                ${
                  canSubmitScore(match)
                    ? `<button class="small-btn" onclick="openScoreSubmission('${match.id}')">
                        ${hasSubmittedScore(match) ? "Edit Locked Result" : "Add Result"}
                      </button>`
                    : ""
                }

                ${
                  hasSubmittedScore(match)
                    ? `<button class="small-btn" onclick="recalculateMatchAll('${match.id}')">
                        Recalculate
                      </button>`
                    : ""
                }

                ${
                  isTeamEditable(match) && counts.inCount >= 2
                    ? `<button class="small-btn" onclick="openTeamAssignment('${match.id}', 'full')">
                        Assign Teams
                      </button>`
                    : ""
                }

                ${
                  canEditFormation(match) && (match.match_teams || []).length
                    ? `<button class="small-btn" onclick="openTeamAssignment('${match.id}', 'formation')">
                        Edit Formation
                      </button>`
                    : ""
                }

                ${
                  matchEditable && !isFull
                    ? `<button class="small-btn" onclick="openExternalPlayerPicker('${match.id}')">
                        Add External
                      </button>`
                    : ""
                }

                <button class="small-btn" onclick="editMatch('${match.id}')">
                  Edit
                </button>

                <button class="small-btn" onclick="deleteOrCancelMatch('${match.id}')">
                  ${isFuture ? "Delete" : "Cancel"}
                </button>
              </div>
            `
            : ""
        }
      </article>
    `;
  }).join("");
}


function toDateTimeLocal(iso) {
  if (!iso) return "";

  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
}

function pad2(num) {
  return String(num).padStart(2, "0");
}

function toLocalDateValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toAmPmLabel(hour, minute = 0) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${pad2(minute)} ${suffix}`;
}

function populateMatchTimeSelects() {
  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 1;
    return `<option value="${hour}">${hour}</option>`;
  }).join("");

  const minuteOptions = Array.from({ length: 60 }, (_, minute) => {
    return `<option value="${pad2(minute)}">${pad2(minute)}</option>`;
  }).join("");

  ["match-start", "match-end", "match-vote-deadline", "activity-start", "activity-end"].forEach(prefix => {
    const hourSelect = $(`${prefix}-hour`);
    const minuteSelect = $(`${prefix}-minute`);

    if (!hourSelect || !minuteSelect) return;
    if (hourSelect.options.length && minuteSelect.options.length) return;

    hourSelect.innerHTML = hourOptions;
    minuteSelect.innerHTML = minuteOptions;
  });
}

function setTimeParts(prefix, hour24, minute = 0) {
  const hourSelect = $(`${prefix}-hour`);
  const minuteSelect = $(`${prefix}-minute`);
  const ampmSelect = $(`${prefix}-ampm`);

  if (!hourSelect || !minuteSelect || !ampmSelect) return;

  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  hourSelect.value = String(hour12);

  const cleanMinute = Math.max(0, Math.min(59, Number(minute) || 0));

  minuteSelect.value = pad2(cleanMinute);
  ampmSelect.value = ampm;
}

function readTimeParts(prefix) {
  const hour = Number($(`${prefix}-hour`)?.value || 0);
  const minute = Number($(`${prefix}-minute`)?.value || 0);
  const ampm = $(`${prefix}-ampm`)?.value || "AM";

  if (!hour || hour < 1 || hour > 12) return null;

  let hour24 = hour % 12;
  if (ampm === "PM") hour24 += 12;

  return {
    hour24,
    minute
  };
}

function setDefaultMatchDateTimes() {
  populateMatchTimeSelects();
  voteDeadlineManuallyEdited = false;

  const today = new Date();

  if ($("match-start-date")) $("match-start-date").value = toLocalDateValue(today);
  setTimeParts("match-start", 18, 0);

  if ($("match-end-date")) $("match-end-date").value = toLocalDateValue(today);
  setTimeParts("match-end", 19, 30);

  updateDefaultVoteDeadlineFromStart(true);
}

function setMatchDateTimeFields(startIso, endIso, voteDeadlineIso = "") {
  populateMatchTimeSelects();

  const start = startIso ? new Date(startIso) : new Date();
  const end = endIso ? new Date(endIso) : new Date(start.getTime() + 90 * 60000);
  const defaultDeadline = new Date(start.getTime() - 24 * 60 * 60000);
  const deadline = voteDeadlineIso
    ? new Date(voteDeadlineIso)
    : defaultDeadline;

  voteDeadlineManuallyEdited = voteDeadlineIso
    ? Math.abs(deadline.getTime() - defaultDeadline.getTime()) > 60000
    : false;

  if ($("match-start-date")) $("match-start-date").value = toLocalDateValue(start);
  setTimeParts("match-start", start.getHours(), start.getMinutes());

  if ($("match-end-date")) $("match-end-date").value = toLocalDateValue(end);
  setTimeParts("match-end", end.getHours(), end.getMinutes());

  if ($("match-vote-deadline-date")) $("match-vote-deadline-date").value = toLocalDateValue(deadline);
  setTimeParts("match-vote-deadline", deadline.getHours(), deadline.getMinutes());
}

function getMatchDateTimeValues() {
  const startDate = $("match-start-date")?.value || "";
  const endDate = $("match-end-date")?.value || "";
  const deadlineDate = $("match-vote-deadline-date")?.value || "";
  const startParts = readTimeParts("match-start");
  const endParts = readTimeParts("match-end");
  const deadlineParts = readTimeParts("match-vote-deadline");

  if (!startDate || !endDate || !deadlineDate || !startParts || !endParts || !deadlineParts) {
    alert("Please choose match start, end, and voting deadline date/time.");
    return null;
  }

  const startTimeValue = new Date(`${startDate}T${pad2(startParts.hour24)}:${pad2(startParts.minute)}:00`);
  const endTimeValue = new Date(`${endDate}T${pad2(endParts.hour24)}:${pad2(endParts.minute)}:00`);
  const deadlineValue = new Date(`${deadlineDate}T${pad2(deadlineParts.hour24)}:${pad2(deadlineParts.minute)}:00`);

  if (Number.isNaN(startTimeValue.getTime()) || Number.isNaN(endTimeValue.getTime()) || Number.isNaN(deadlineValue.getTime())) {
    alert("Invalid match date or time.");
    return null;
  }

  if (startTimeValue <= new Date()) {
    alert("Match start time must be in the future.");
    return null;
  }

  if (endTimeValue <= startTimeValue) {
    alert("End time must be after start time.");
    return null;
  }

  if (deadlineValue >= startTimeValue) {
    alert("Voting deadline must be before match start time.");
    return null;
  }

  return {
    startTime: startTimeValue,
    endTime: endTimeValue,
    votingDeadline: deadlineValue
  };
}

function currentMatchStartDateTimeValue() {
  const startDate = $("match-start-date")?.value || "";
  const startParts = readTimeParts("match-start");

  if (!startDate || !startParts) return null;

  const value = new Date(`${startDate}T${pad2(startParts.hour24)}:${pad2(startParts.minute)}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function syncMatchEndDateToStartDate() {
  const startDate = $("match-start-date")?.value || "";
  const endDateInput = $("match-end-date");

  if (startDate && endDateInput) {
    endDateInput.value = startDate;
  }
}

function updateDefaultVoteDeadlineFromStart(force = false) {
  if (voteDeadlineManuallyEdited && !force) return;

  const start = currentMatchStartDateTimeValue();
  if (!start) return;

  const deadline = new Date(start.getTime() - 24 * 60 * 60000);

  if ($("match-vote-deadline-date")) $("match-vote-deadline-date").value = toLocalDateValue(deadline);
  setTimeParts("match-vote-deadline", deadline.getHours(), deadline.getMinutes());
}


async function editMatch(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can edit this match.");
    return;
  }

  if (isResultLocked(match)) {
    alert("Match details are locked after result finalization. You can edit the result or formation using their dedicated buttons.");
    return;
  }

  if (!isMatchEditable(match)) {
    alert("You can only edit match details before the match starts.");
    return;
  }

  editingMatchId = matchId;

  await loadMatchFormOptions();

  if ($("match-sport")) {
    $("match-sport").value = match.sport_id || match.sports?.id || "";
  }

  updateMatchVenueOptions();

  if ($("match-venue")) {
    $("match-venue").value = match.venue_id || match.venues?.id || "";
  }

  const form = $("matchForm");
  if (!form) return;

  form.elements["title"].value = match.title || "";
  form.elements["match_type"].value = match.match_type || "friendly";
  updateMatchLeagueOptions();

  if (form.elements["league_id"]) {
    form.elements["league_id"].value = match.league_id || "";
  }
  form.elements["required_players"].value = match.required_players || match.max_players || 4;
  if (form.elements["max_players"]) form.elements["max_players"].value = match.max_players || match.required_players || 4;
  setMatchDateTimeFields(match.start_time, match.end_time, match.voting_deadline_at);
  form.elements["notes"].value = match.notes || "";

  const invitedIds = (match.match_invitations || [])
    .filter(inv => inv.member_id !== currentProfile?.id && inv.status !== "removed")
    .map(inv => inv.member_id);

  renderMatchInviteOptions(invitedIds);

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "Update Match";

  $("matchModal")?.showModal();
}

async function deleteOrCancelMatch(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can delete/cancel this match.");
    return;
  }

  if (match.status === "cancelled") {
    alert("This match is already cancelled.");
    return;
  }

  const isFuture = new Date(match.start_time) > new Date();

  if (isFuture) {
    const ok = confirm("This match is still upcoming. Delete it completely?");
    if (!ok) return;

    const notificationResult = await sendMatchLifecycleNotification(matchId, "match_deleted");

    const { error } = await supabaseClient
      .from("matches")
      .delete()
      .eq("id", matchId);

    if (error) {
      alert(error.message);
      return;
    }

    if (notificationResult?.error) {
      alert(`Match deleted, but phone notifications failed: ${notificationResult.error}`);
    }

    alert("Match deleted.");
  } else {
    const ok = confirm("This match time has passed. Mark it as cancelled instead?");
    if (!ok) return;

    const { error } = await supabaseClient
      .from("matches")
      .update({
        status: "cancelled"
      })
      .eq("id", matchId);

    if (error) {
      alert(error.message);
      return;
    }

    const notificationResult = await sendMatchLifecycleNotification(matchId, "match_cancelled");

    if (notificationResult?.error) {
      alert(`Match marked as cancelled, but phone notifications failed: ${notificationResult.error}`);
    }

    alert("Match marked as cancelled.");
  }

  await loadMatches();
}

async function voteMatch(matchId, newStatus) {
  if (!currentProfile || currentProfile.approval_status !== "approved") {
    alert("Approved members only.");
    return;
  }

  const match = allMatches.find(m => m.id === matchId);
  if (!match) {
    alert("Match not found.");
    return;
  }

  let invitation = myInvitation(match);
  const isCreator = match.created_by === currentProfile?.id;

  if (!invitation && !isCreator) {
    alert("You are not invited to this match.");
    return;
  }

  const displayStatus = getMatchDisplayStatus(match);

  if (displayStatus === "cancelled") {
    alert("This match is cancelled.");
    return;
  }

  if (displayStatus === "playing") {
    alert("Voting is closed because the match is currently playing.");
    return;
  }

  if (displayStatus === "finished" || displayStatus === "completed") {
    alert("Voting is closed because the match has finished.");
    return;
  }

  if (new Date(match.start_time) <= new Date()) {
    alert("Voting is closed because the match time has passed.");
    return;
  }

  if (hasVotingDeadlinePassed(match)) {
    alert("Voting is closed for this match. Please contact the game creator directly if you need to be removed or changed.");
    return;
  }

  const counts = invitationCounts(match);
  const filledCount = counts.inCount;
  const maxPlayers = Number(match.max_players || 0);
  const currentVoteStatus = invitation?.status || (isCreator ? "in" : null);
  const userIsCurrentlyIn = currentVoteStatus === "in";
  const wasFullBeforeVote = Boolean(maxPlayers && filledCount >= maxPlayers);

  if (newStatus === "in" && !userIsCurrentlyIn) {
    const conflictingMatch = voteInTimeConflict(match);

    if (conflictingMatch) {
      alert(timeConflictMessage(match, conflictingMatch));
      return;
    }
  }

  if (newStatus === "in" && maxPlayers && filledCount >= maxPlayers && !userIsCurrentlyIn) {
    alert("This match is already full. You can vote Maybe or Out.");
    return;
  }

  if (!invitation && isCreator) {
    const { data, error } = await supabaseClient
      .from("match_invitations")
      .upsert({
        match_id: matchId,
        member_id: currentProfile.id,
        invited_by: currentProfile.id,
        status: newStatus
      }, {
        onConflict: "match_id,member_id"
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    match.match_invitations = match.match_invitations || [];
    match.match_invitations.push(data);
    invitation = data;
  } else {
    const updatePayload = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
      .from("match_invitations")
      .update(updatePayload)
      .eq("id", invitation.id);

    if (error) {
      alert(error.message);
      return;
    }

    invitation.status = newStatus;
  }

  const nextCounts = invitationCounts(match);
  const isFullAfterVote = Boolean(maxPlayers && nextCounts.inCount >= maxPlayers);

  if (!isCreator && currentVoteStatus !== newStatus) {
    await sendCreatorMatchNotification(match.id, "creator_vote_changed", {
      vote_status: newStatus,
      previous_vote_status: currentVoteStatus || "none"
    });
  }

  if (!isCreator && newStatus === "in" && !wasFullBeforeVote && isFullAfterVote) {
    await sendCreatorMatchNotification(match.id, "creator_game_full");
  }

  renderMatches();
  await loadMatches();
}

async function loadExternalMembersForPicker(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("members")
    .select("id,first_name,last_name,display_name,email,phone,is_external")
    .eq("is_external", true)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("display_name", { ascending: true });

  if (error) {
    alert(error.message);
    return;
  }

  const alreadyLinkedIds = new Set(
    (match.match_invitations || [])
      .filter(inv => inv.status !== "removed")
      .map(inv => inv.member_id)
  );

  allExternalMembers = data || [];

  const box = $("external-player-options");
  if (!box) return;

  if (allExternalMembers.length === 0) {
    box.innerHTML = `<div class="hint">No external players saved yet. Create one below.</div>`;
    return;
  }

  box.innerHTML = allExternalMembers.map(member => {
    const alreadyInMatch = alreadyLinkedIds.has(member.id);

    return `
      <label class="sport-chip ${alreadyInMatch ? "disabled-chip" : ""}">
        <input
          type="checkbox"
          value="${member.id}"
          class="external-player-checkbox"
          ${alreadyInMatch ? "disabled" : ""}
        >
        <span>
          ${escapeHtml(memberDisplayName(member))}
          ${alreadyInMatch ? " — already added" : ""}
        </span>
      </label>
    `;
  }).join("");
}

async function openExternalPlayerPicker(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can add external players.");
    return;
  }

  if (!isMatchEditable(match)) {
    alert("You can only add external players before the match starts.");
    return;
  }

  const remaining = remainingSpots(match);
  if (remaining !== null && remaining <= 0) {
    alert("This match is already full.");
    return;
  }

  currentExternalMatchId = matchId;

  if ($("external-player-match-label")) {
    $("external-player-match-label").textContent =
      remaining === null
        ? "Select existing external players, or create a new external profile."
        : `Remaining spots: ${remaining}. Select existing external players, or create a new external profile.`;
  }

  if ($("new-external-name")) $("new-external-name").value = "";
  if ($("new-external-phone")) $("new-external-phone").value = "";
  if ($("new-external-email")) $("new-external-email").value = "";

  await loadExternalMembersForPicker(matchId);

  $("externalPlayerModal")?.showModal();
}

function getSelectedExternalMemberIds() {
  return Array.from(document.querySelectorAll(".external-player-checkbox"))
    .filter(cb => cb.checked && !cb.disabled)
    .map(cb => cb.value);
}

async function addExternalMemberIdsToMatch(matchId, memberIds) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return false;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can add external players.");
    return false;
  }

  const uniqueIds = Array.from(new Set(memberIds || [])).filter(Boolean);

  if (uniqueIds.length === 0) {
    alert("Select at least one external player.");
    return false;
  }

  const remaining = remainingSpots(match);

  if (remaining !== null && uniqueIds.length > remaining) {
    alert(`You can only add ${remaining} external player(s).`);
    return false;
  }

  const rows = uniqueIds.map(memberId => ({
    match_id: matchId,
    member_id: memberId,
    invited_by: currentProfile.id,
    status: "in"
  }));

  const { error } = await supabaseClient
    .from("match_invitations")
    .upsert(rows, {
      onConflict: "match_id,member_id"
    });

  if (error) {
    alert(error.message);
    return false;
  }

  await loadMatches();
  await loadExternalMembersForPicker(matchId);

  return true;
}

async function addSelectedExternalPlayers() {
  if (!currentExternalMatchId) {
    alert("No match selected.");
    return;
  }

  const selectedIds = getSelectedExternalMemberIds();
  const ok = await addExternalMemberIdsToMatch(currentExternalMatchId, selectedIds);

  if (!ok) return;

  alert(`${selectedIds.length} external player(s) added.`);
}

function nextExternalDisplayNumber() {
  return allExternalMembers.length + 1;
}

async function createExternalPlayerProfile() {
  if (!currentExternalMatchId) {
    alert("No match selected.");
    return;
  }

  const name = $("new-external-name")?.value.trim() || "";
  const phone = $("new-external-phone")?.value.trim() || "";
  const email = $("new-external-email")?.value.trim() || "";

  if (!name) {
    alert("External player name is required.");
    return;
  }

  const existing = allExternalMembers.find(member => {
    const display = String(member.display_name || "").toLowerCase();
    const first = String(member.first_name || "").toLowerCase();
    const cleaned = name.toLowerCase();

    return display === cleaned ||
      first === cleaned ||
      display.includes(`(${cleaned})`);
  });

  if (existing) {
    const useExisting = confirm(`${memberDisplayName(existing)} already exists. Add this existing external player to the match?`);
    if (!useExisting) return;

    const ok = await addExternalMemberIdsToMatch(currentExternalMatchId, [existing.id]);
    if (ok) {
      if ($("new-external-name")) $("new-external-name").value = "";
      if ($("new-external-phone")) $("new-external-phone").value = "";
      if ($("new-external-email")) $("new-external-email").value = "";
    }
    return;
  }

  const displayName = `External ${nextExternalDisplayNumber()} (${name})`;

  const { data, error } = await supabaseClient
    .from("members")
    .insert({
      first_name: name,
      last_name: "",
      display_name: displayName,
      email: email || null,
      phone: phone || null,
      birth_date: null,
      auth_user_id: null,
      is_external: true,
      is_active: true,
      role: "member",
      approval_status: "approved",
      registration_status: "approved"
    })
    .select("id,first_name,last_name,display_name,email,phone,is_external")
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  allExternalMembers.push(data);

  const ok = await addExternalMemberIdsToMatch(currentExternalMatchId, [data.id]);
  if (!ok) return;

  if ($("new-external-name")) $("new-external-name").value = "";
  if ($("new-external-phone")) $("new-external-phone").value = "";
  if ($("new-external-email")) $("new-external-email").value = "";

  alert(`${memberDisplayName(data)} created and added.`);
}

async function renameExternalMember(memberId, matchId, currentName) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can rename external players.");
    return;
  }

  if (!isMatchEditable(match)) {
    alert("You can only rename external players before the match starts.");
    return;
  }

  if (!memberId) {
    alert("External member id missing.");
    return;
  }

  const newName = prompt("Edit external player display name:", currentName || "");

  if (newName === null) return;

  const cleanName = newName.trim();

  if (!cleanName) {
    alert("Name cannot be empty.");
    return;
  }

  const { error } = await supabaseClient
    .from("members")
    .update({
      display_name: cleanName
    })
    .eq("id", memberId)
    .eq("is_external", true);

  if (error) {
    alert(error.message);
    return;
  }

  await loadMatches();
}

async function removeExternalMemberFromMatch(invitationId, matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can remove external players.");
    return;
  }

  if (!isMatchEditable(match)) {
    alert("You can only remove external players before the match starts.");
    return;
  }

  const ok = confirm("Remove this external player from this match?");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("match_invitations")
    .update({
      status: "removed",
      updated_at: new Date().toISOString()
    })
    .eq("id", invitationId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadMatches();
}


function renderTeamAssignmentList(match) {
  const box = $("team-assignment-list");
  if (!box) return;

  const players = inPlayerInvitations(match);
  const teams = match.match_teams || [];
  const teamA = teams[0] || null;
  const teamB = teams[1] || null;
  const assignedMap = currentTeamByMemberId(match);
  const playerMap = currentTeamPlayerByMemberId(match);
  const showFormation = isSoccerMatch(match);
  const formationOnly = isFormationOnlyMode();
  const editableSides = allowedFormationSides(match);

  if (!players.length) {
    box.innerHTML = `<div class="hint">No IN players yet.</div>`;
    return;
  }

  const mappedPlayers = players.map(inv => {
    const member = invitationMember(inv);
    const memberId = member?.id || inv.member_id;
    const selectedTeamId = assignedMap.get(memberId) || "";
    const teamPlayer = playerMap.get(memberId);
    const selectedSide =
      teamA && selectedTeamId === teamA.id ? "A" :
      teamB && selectedTeamId === teamB.id ? "B" :
      "";

    const preferredPosition = normalizeSoccerPosition(memberSportPosition(memberId, match.sport_id));
    const selectedPosition = teamPlayer?.formation_position || preferredPosition || "";
    const rating = selectedPosition
      ? positionRatingForMember(memberId, match.sport_id, selectedPosition)
      : memberSportRating(memberId, match.sport_id);

    return {
      inv,
      member,
      memberId,
      selectedSide,
      teamPlayer,
      preferredPosition,
      selectedPosition,
      rating,
      displayName: invitationMemberDisplayName(inv)
    };
  });

  const orderedSides = preferredSideOrderForCurrentUser(match);

  mappedPlayers.sort((a, b) =>
    sideOrderValue(a.selectedSide, orderedSides) - sideOrderValue(b.selectedSide, orderedSides) ||
    soccerPositionSortValue(a.selectedPosition) - soccerPositionSortValue(b.selectedPosition) ||
    a.displayName.localeCompare(b.displayName)
  );

  const groups = orderedSides
    .map(side => ({
      side,
      players: mappedPlayers.filter(player => player.selectedSide === side)
    }))
    .filter(group => group.players.length || group.side !== "");

  box.innerHTML = groups.map(group => `
    <div class="team-assignment-group team-assignment-group-${group.side || "unassigned"}">
      ${assignmentGroupHeader(match, group.side, group.players.length)}

      ${group.players.map(player => {
        const {
          inv,
          member,
          memberId,
          selectedSide,
          teamPlayer,
          preferredPosition,
          selectedPosition,
          rating
        } = player;

        return `
          <div class="team-player-row team-player-row-${selectedSide || "unassigned"}">
            <div class="team-player-name">
              ${escapeHtml(invitationMemberDisplayName(inv))}
              ${member?.is_external ? `<span class="mini-pill">External</span>` : ""}
              <span class="rating-pill">R ${Number(rating).toFixed(1)}${preferredPosition ? ` • ${escapeHtml(preferredPosition)}` : ""}</span>
            </div>

            <div class="team-choice">
              <label class="team-choice-chip">
                <input
                  type="radio"
                  name="team-choice-${memberId}"
                  value="A"
                  data-member-id="${memberId}"
                  data-team-player-id="${teamPlayer?.id || ""}"
                  ${formationOnly ? "disabled" : ""}
                  ${selectedSide === "A" ? "checked" : ""}
                >
                <span>A</span>
              </label>

              <label class="team-choice-chip">
                <input
                  type="radio"
                  name="team-choice-${memberId}"
                  value="B"
                  data-member-id="${memberId}"
                  data-team-player-id="${teamPlayer?.id || ""}"
                  ${formationOnly ? "disabled" : ""}
                  ${selectedSide === "B" ? "checked" : ""}
                >
                <span>B</span>
              </label>

              <label class="team-choice-chip">
                <input
                  type="radio"
                  name="team-choice-${memberId}"
                  value=""
                  data-member-id="${memberId}"
                  data-team-player-id="${teamPlayer?.id || ""}"
                  ${formationOnly ? "disabled" : ""}
                  ${selectedSide === "" ? "checked" : ""}
                >
                <span>Unassigned</span>
              </label>
            </div>

            ${
              showFormation
                ? `
                  <div class="formation-choice">
                    <select
                      class="formation-position-select"
                      data-member-id="${memberId}"
                      data-team-player-id="${teamPlayer?.id || ""}"
                      data-team-side="${selectedSide}"
                      ${formationOnly && !editableSides.includes(selectedSide) ? "disabled" : ""}
                    >
                      ${soccerPositionOptions(selectedPosition)}
                    </select>
                  </div>
                `
                : ""
            }
          </div>
        `;
      }).join("")}
    </div>
  `).join("");

  document.querySelectorAll("#team-assignment-list input[type='radio']").forEach(input => {
    input.addEventListener("change", () => {
      updateCaptainSelectors();
      updateTeamBalanceStatus();
    });
  });

  document.querySelectorAll(".formation-position-select").forEach(input => {
    input.addEventListener("change", updateTeamBalanceStatus);
  });

  if (!isSoccerMatch(match)) {
    clearSuggestedFormationSummary();
  }

  updateCaptainSelectors();
  updateTeamBalanceStatus();
}


function combinations(items, choose) {
  if (choose < 0 || choose > items.length) return [];
  if (choose === 0) return [[]];

  const result = [];

  function walk(start, combo) {
    if (combo.length === choose) {
      result.push([...combo]);
      return;
    }

    for (let i = start; i <= items.length - (choose - combo.length); i += 1) {
      combo.push(items[i]);
      walk(i + 1, combo);
      combo.pop();
    }
  }

  walk(0, []);
  return result;
}
function soccerPlayerRatingBundle(memberId, sportId) {
  return {
    memberId,
    general: memberSportRating(memberId, sportId),
    GK: positionRatingForMember(memberId, sportId, "GK"),
    DEF: positionRatingForMember(memberId, sportId, "DEF"),
    MID: positionRatingForMember(memberId, sportId, "MID"),
    ATT: positionRatingForMember(memberId, sportId, "ATT")
  };
}

function soccerTeamUnitProfile(memberIds, assignment, sportId) {
  const players = memberIds.map(memberId => {
    const position = normalizeSoccerPosition(assignment.get(memberId));
    const ratings = soccerPlayerRatingBundle(memberId, sportId);

    return {
      memberId,
      position,
      ratings
    };
  });

  const gkRatings = players
    .filter(player => player.position === "GK")
    .map(player => player.ratings.GK);

  const defRatings = players
    .filter(player => player.position === "DEF")
    .map(player => player.ratings.DEF);

  const midRatings = players
    .filter(player => player.position === "MID")
    .map(player => player.ratings.MID);

  const attRatings = players
    .filter(player => player.position === "ATT")
    .map(player => player.ratings.ATT);

  const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);

  const gkTotal = sum(gkRatings);
  const defTotal = sum(defRatings);
  const midTotal = sum(midRatings);
  const attTotal = sum(attRatings);

  const settings = soccerRatingSettings();
  const midDefTotal = settings.midDefenseWeight * midTotal;
  const midAttTotal = settings.midAttackWeight * midTotal;

  const gkStrength = averageValues(gkRatings, 5);
  const defAverage = averageValues(defRatings, 5);
  const midAverage = averageValues(midRatings, 5);
  const attAverage = averageValues(attRatings, 5);
  const totalAverage = averageValues(players.map(player => player.ratings.general), 5);

  return {
    gkStrength,
    defStrength: gkStrength + defAverage + (settings.midDefenseWeight * midAverage),
    attStrength: attAverage + (settings.midAttackWeight * midAverage),
    totalAverage,
    totals: {
      GK: gkTotal,
      DEF: defTotal,
      MID: midTotal,
      ATT: attTotal,
      MID_DEF: midDefTotal,
      MID_ATT: midAttTotal,
      TEAM_DEF: gkTotal + defTotal + midDefTotal,
      TEAM_ATT: attTotal + midAttTotal
    },
    counts: {
      GK: gkRatings.length,
      DEF: defRatings.length,
      MID: midRatings.length,
      ATT: attRatings.length
    }
  };
}

function soccerTeamBalanceGap(teamA, teamB, positionsA, positionsB, sportId) {
  const profileA = soccerTeamUnitProfile(teamA, positionsA, sportId);
  const profileB = soccerTeamUnitProfile(teamB, positionsB, sportId);

  const missingFormationPenalty = [profileA, profileB].reduce((penalty, profile) => {
    let next = penalty;

    if (profile.counts.GK !== 1) next += 10;
    if (profile.counts.DEF < 2) next += 5;
    if (profile.counts.MID < 1) next += 4;
    if (profile.counts.ATT < 1) next += 4;

    return next;
  }, 0);

  const gap =
    (1.2 * Math.abs(profileA.gkStrength - profileB.gkStrength)) +
    Math.abs(profileA.defStrength - profileB.defStrength) +
    Math.abs(profileA.attStrength - profileB.attStrength) +
    (0.5 * Math.abs(profileA.totalAverage - profileB.totalAverage)) +
    missingFormationPenalty;

  return {
    gap,
    profileA,
    profileB
  };
}

function bestSoccerTeamSuggestion(memberIds, sportId) {
  const cleanIds = Array.from(new Set((memberIds || []).filter(Boolean)));

  if (cleanIds.length < 2) return null;

  const teamASize = Math.ceil(cleanIds.length / 2);
  const teamBSize = cleanIds.length - teamASize;

  if (teamBSize < 1) return null;

  const gkCandidates = [...cleanIds]
    .sort((a, b) =>
      positionRatingForMember(b, sportId, "GK") - positionRatingForMember(a, sportId, "GK") ||
      memberSportRating(b, sportId) - memberSportRating(a, sportId)
    )
    .slice(0, Math.min(cleanIds.length, 8));

  let best = null;

  for (const gkA of gkCandidates) {
    for (const gkB of gkCandidates) {
      if (gkA === gkB) continue;

      const remaining = cleanIds.filter(memberId => memberId !== gkA && memberId !== gkB);
      const neededA = teamASize - 1;

      if (neededA < 0 || neededA > remaining.length) continue;

      combinations(remaining, neededA).forEach(teamARest => {
        const teamA = [gkA, ...teamARest];
        const teamASet = new Set(teamA);
        const teamB = [gkB, ...remaining.filter(memberId => !teamASet.has(memberId))];

        if (teamB.length !== teamBSize) return;

        const positionsA = assignSoccerPositionsToTeam(teamA, sportId, gkA);
        const positionsB = assignSoccerPositionsToTeam(teamB, sportId, gkB);
        const balance = soccerTeamBalanceGap(teamA, teamB, positionsA, positionsB, sportId);

        if (!best || balance.gap < best.balance.gap) {
          best = {
            teamA,
            teamB,
            positionsA,
            positionsB,
            balance
          };
        }
      });
    }
  }

  if (best) return best;

  // Fallback for very small or unusual player counts.
  const sorted = [...cleanIds].sort((a, b) =>
    memberSportRating(b, sportId) - memberSportRating(a, sportId)
  );

  const teamA = [];
  const teamB = [];

  sorted.forEach(memberId => {
    if (teamA.length < teamASize && teamA.length <= teamB.length) {
      teamA.push(memberId);
    } else {
      teamB.push(memberId);
    }
  });

  return {
    teamA,
    teamB,
    positionsA: assignSoccerPositionsToTeam(teamA, sportId),
    positionsB: assignSoccerPositionsToTeam(teamB, sportId),
    balance: soccerTeamBalanceGap(
      teamA,
      teamB,
      assignSoccerPositionsToTeam(teamA, sportId),
      assignSoccerPositionsToTeam(teamB, sportId),
      sportId
    )
  };
}

function soccerBalanceSummaryText(suggestion) {
  if (!suggestion?.balance) return "";

  const { profileA, profileB, gap } = suggestion.balance;

  return `Soccer balance: GK ${profileA.totals.GK.toFixed(1)}-${profileB.totals.GK.toFixed(1)} • DEF ${profileA.totals.DEF.toFixed(1)}-${profileB.totals.DEF.toFixed(1)} • MID ${profileA.totals.MID.toFixed(1)}-${profileB.totals.MID.toFixed(1)} • ATT ${profileA.totals.ATT.toFixed(1)}-${profileB.totals.ATT.toFixed(1)} • Team DEF ${profileA.totals.TEAM_DEF.toFixed(1)}-${profileB.totals.TEAM_DEF.toFixed(1)} • Team ATT ${profileA.totals.TEAM_ATT.toFixed(1)}-${profileB.totals.TEAM_ATT.toFixed(1)} • Gap ${gap.toFixed(2)}`;
}


function memberNameByIdForMatch(match, memberId) {
  const inv = inPlayerInvitations(match).find(item =>
    cleanUuidValue(item.member_id) === cleanUuidValue(memberId)
  );

  return inv ? invitationMemberDisplayName(inv) : memberId;
}

function formationSummaryRows(match, memberIds, positions, sportId) {
  const order = ["GK", "DEF", "MID", "ATT"];

  return order.map(position => {
    const players = memberIds
      .filter(memberId => normalizeSoccerPosition(positions.get(memberId)) === position)
      .map(memberId => {
        const rating = positionRatingForMember(memberId, sportId, position);
        return `${memberNameByIdForMatch(match, memberId)} (${rating.toFixed(1)})`;
      });

    return {
      position,
      text: players.length ? players.join(", ") : "-"
    };
  });
}


function suggestedTeamTotalsHtml(label, profile) {
  if (!profile?.totals) return "";

  return `
    <div class="suggested-team-totals">
      <div class="suggested-team-totals-title">${escapeHtml(label)} totals</div>

      <div class="suggested-total-row">
        <span>GK</span>
        <b>${profile.totals.GK.toFixed(1)}</b>
      </div>

      <div class="suggested-total-row">
        <span>DEF</span>
        <b>${profile.totals.DEF.toFixed(1)}</b>
      </div>

      <div class="suggested-total-row">
        <span>MID</span>
        <b>${profile.totals.MID.toFixed(1)}</b>
      </div>

      <div class="suggested-total-row">
        <span>ATT</span>
        <b>${profile.totals.ATT.toFixed(1)}</b>
      </div>

      <div class="suggested-total-row hybrid">
        <span>Team DEF</span>
        <b>${profile.totals.TEAM_DEF.toFixed(1)}</b>
      </div>

      <div class="suggested-total-row hybrid">
        <span>Team ATT</span>
        <b>${profile.totals.TEAM_ATT.toFixed(1)}</b>
      </div>
    </div>
  `;
}

function renderSuggestedFormationSummary(match, suggestion) {
  const box = $("suggested-formation-summary");

  if (!box) return;

  if (!suggestion || !isSoccerMatch(match)) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const rowsA = formationSummaryRows(match, suggestion.teamA, suggestion.positionsA, match.sport_id);
  const rowsB = formationSummaryRows(match, suggestion.teamB, suggestion.positionsB, match.sport_id);
  const profileA = suggestion.balance?.profileA;
  const profileB = suggestion.balance?.profileB;

  box.style.display = "";

  box.innerHTML = `
    <div class="suggested-formation-title">Suggested soccer formation</div>

    <div class="suggested-formation-grid">
      <div class="suggested-formation-team">
        <strong>${escapeHtml($("team-a-name")?.value || "Team A")}</strong>
        ${rowsA.map(row => `
          <div class="suggested-formation-row">
            <span>${escapeHtml(row.position)}</span>
            <b>${escapeHtml(row.text)}</b>
          </div>
        `).join("")}

        ${suggestedTeamTotalsHtml($("team-a-name")?.value || "Team A", profileA)}
      </div>

      <div class="suggested-formation-team">
        <strong>${escapeHtml($("team-b-name")?.value || "Team B")}</strong>
        ${rowsB.map(row => `
          <div class="suggested-formation-row">
            <span>${escapeHtml(row.position)}</span>
            <b>${escapeHtml(row.text)}</b>
          </div>
        `).join("")}

        ${suggestedTeamTotalsHtml($("team-b-name")?.value || "Team B", profileB)}
      </div>
    </div>
  `;
}

function clearSuggestedFormationSummary() {
  const box = $("suggested-formation-summary");

  if (!box) return;

  box.style.display = "none";
  box.innerHTML = "";
}

function applySuggestedTeams() {
  if (!currentTeamMatchId) {
    alert("No match selected.");
    return;
  }

  const match = allMatches.find(m => m.id === currentTeamMatchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  const players = inPlayerInvitations(match).map(inv => {
    const member = invitationMember(inv);
    const memberId = member?.id || inv.member_id;

    return {
      memberId,
      rating: memberSportRating(memberId, match.sport_id)
    };
  }).filter(player => player.memberId);

  if (players.length < 2) {
    alert("At least 2 IN players are needed.");
    return;
  }

  if (players.length % 2 !== 0) {
    alert("An even number of IN players is required to suggest equal teams.");
    return;
  }

  let teamA = [];
  let teamB = [];
  let positionsA = new Map();
  let positionsB = new Map();
  let soccerSuggestion = null;

  if (isSoccerMatch(match)) {
    soccerSuggestion = bestSoccerTeamSuggestion(
      players.map(player => player.memberId),
      match.sport_id
    );

    if (!soccerSuggestion) {
      alert("Could not suggest soccer teams.");
      return;
    }

    teamA = soccerSuggestion.teamA;
    teamB = soccerSuggestion.teamB;
    positionsA = soccerSuggestion.positionsA;
    positionsB = soccerSuggestion.positionsB;
  } else {
    players.sort((a, b) => b.rating - a.rating);

    let ratingA = 0;
    let ratingB = 0;

    players.forEach(player => {
      if (
        teamA.length < Math.ceil(players.length / 2) &&
        (ratingA <= ratingB || teamB.length >= Math.floor(players.length / 2))
      ) {
        teamA.push(player.memberId);
        ratingA += player.rating;
      } else {
        teamB.push(player.memberId);
        ratingB += player.rating;
      }
    });
  }

  document.querySelectorAll("#team-assignment-list input[type='radio']").forEach(input => {
    const memberId = input.dataset.memberId;

    if (!memberId) return;

    input.checked =
      (teamA.includes(memberId) && input.value === "A") ||
      (teamB.includes(memberId) && input.value === "B");
  });

  if (isSoccerMatch(match)) {
    document.querySelectorAll(".formation-position-select").forEach(select => {
      const memberId = select.dataset.memberId;
      const position = positionsA.get(memberId) || positionsB.get(memberId) || "";

      select.value = position;
      select.dataset.teamSide = teamA.includes(memberId) ? "A" : teamB.includes(memberId) ? "B" : "";
    });

    const captainA = [...teamA].sort((a, b) =>
      memberSportRating(b, match.sport_id) - memberSportRating(a, match.sport_id)
    )[0];

    const captainB = [...teamB].sort((a, b) =>
      memberSportRating(b, match.sport_id) - memberSportRating(a, match.sport_id)
    )[0];

    updateCaptainSelectors();

    if ($("team-a-captain")) $("team-a-captain").value = captainA || "";
    if ($("team-b-captain")) $("team-b-captain").value = captainB || "";

    renderSuggestedFormationSummary(match, soccerSuggestion);

    const ratingStatus = $("team-rating-status");

    if (ratingStatus) {
      ratingStatus.textContent = soccerBalanceSummaryText(soccerSuggestion);
      ratingStatus.classList.add("balanced");
      ratingStatus.classList.remove("unbalanced");
    }
  }

  updateCaptainSelectors();
  updateTeamBalanceStatus();

  if (isSoccerMatch(match) && soccerSuggestion && $("team-rating-status")) {
    $("team-rating-status").textContent = soccerBalanceSummaryText(soccerSuggestion);
  }
}

function openTeamAssignment(matchId, scope = "full") {
  const safeMatchId = cleanUuidValue(matchId);
  const match = allMatches.find(m => m.id === safeMatchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  currentTeamEditScope = scope === "formation" ? "formation" : "full";

  if (isFormationOnlyMode()) {
    if (!canEditFormation(match)) {
      alert("Only captains, the match creator, or admin can edit formation.");
      return;
    }

    if (hasSubmittedScore(match)) {
      const ok = confirm("Changing formation after result finalization will recalculate soccer position ratings. Continue?");
      if (!ok) return;
    }
  } else {
    if (!canManageMatch(match)) {
      alert("Only the match creator or admin can assign teams.");
      return;
    }

    if (!isTeamEditable(match)) {
      alert("Teams cannot be edited for cancelled matches.");
      return;
    }

    if (isResultLocked(match) && !confirmTeamEditAfterFinalized(match)) {
      return;
    }
  }

  const players = inPlayerInvitations(match);

  if (players.length < 2) {
    alert("At least 2 IN players are needed to assign teams.");
    return;
  }

  currentTeamMatchId = safeMatchId;

  const teams = match.match_teams || [];

  if ($("team-a-name")) {
    $("team-a-name").value = teams[0]?.name || "Team A";
    $("team-a-name").disabled = isFormationOnlyMode();
  }

  if ($("team-b-name")) {
    $("team-b-name").value = teams[1]?.name || "Team B";
    $("team-b-name").disabled = isFormationOnlyMode();
  }

  if ($("suggest-teams-btn")) {
    $("suggest-teams-btn").style.display = isFormationOnlyMode() ? "none" : "";
  }

  if ($("team-match-label")) {
    $("team-match-label").textContent = isFormationOnlyMode()
      ? `${match.title || "Match"} — edit formation only.`
      : `${match.title || "Match"} — assign ${players.length} IN player(s).`;
  }

  const submitBtn = $("save-teams-btn");
  if (submitBtn) {
    submitBtn.textContent = isFormationOnlyMode() ? "Save Formation" : "Save Teams";
  }

  clearSuggestedFormationSummary();
  renderTeamAssignmentList(match);
  updateTeamBalanceStatus();

  $("teamModal")?.showModal();
}

function collectTeamAssignments() {
  const choices = Array.from(document.querySelectorAll("#team-assignment-list input[type='radio']:checked"));

  const teamA = [];
  const teamB = [];
  const all = [];
  const captainA = $("team-a-captain")?.value || "";
  const captainB = $("team-b-captain")?.value || "";

  choices.forEach(input => {
    const memberId = input.dataset.memberId;
    const value = input.value;

    if (!memberId) return;

    const positionSelect = document.querySelector(`.formation-position-select[data-member-id="${memberId}"]`);
    const position = positionSelect?.value || "";
    const teamPlayerId = positionSelect?.dataset.teamPlayerId || input.dataset.teamPlayerId || "";
    const captain = (value === "A" && memberId === captainA) || (value === "B" && memberId === captainB);

    if (value === "A") teamA.push(memberId);
    if (value === "B") teamB.push(memberId);

    all.push({
      memberId,
      team: value,
      position,
      teamPlayerId,
      isCaptain: captain
    });
  });

  return {
    teamA,
    teamB,
    all
  };
}


function updateTeamBalanceStatus() {
  const status = $("team-balance-status");
  const ratingStatus = $("team-rating-status");
  const assignments = collectTeamAssignments();

  const difference = Math.abs(assignments.teamA.length - assignments.teamB.length);
  const isBalanced =
    assignments.teamA.length > 0 &&
    assignments.teamB.length > 0 &&
    difference === 0;

  if (status) {
    status.textContent = `Team A: ${assignments.teamA.length} • Team B: ${assignments.teamB.length}`;

    status.classList.toggle("balanced", isBalanced);
    status.classList.toggle("unbalanced", !isBalanced);
  }

  if (ratingStatus) {
    const match = allMatches.find(m => m.id === currentTeamMatchId);
    const sportId = match?.sport_id;

    const ratingA = assignments.teamA.reduce((sum, memberId) =>
      sum + memberSportRating(memberId, sportId), 0
    );

    const ratingB = assignments.teamB.reduce((sum, memberId) =>
      sum + memberSportRating(memberId, sportId), 0
    );

    const diff = Math.abs(ratingA - ratingB);

    ratingStatus.textContent =
      `Ratings: Team A ${ratingA.toFixed(1)} • Team B ${ratingB.toFixed(1)} • Diff ${diff.toFixed(1)}`;

    ratingStatus.classList.toggle("balanced", diff <= 1.5 && isBalanced);
    ratingStatus.classList.toggle("unbalanced", !(diff <= 1.5 && isBalanced));
  }

  updateFormationStatus();
}


async function recalculatePointsAfterTeamEdit(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match || match.score_status !== "submitted") return true;

  // Reload the match after team save so team/result assignments are current.
  await loadMatches();

  const refreshedMatch = allMatches.find(m => m.id === matchId);

  if (!refreshedMatch || refreshedMatch.score_status !== "submitted") return true;

  const pointsSaved = await saveMatchMemberPoints(refreshedMatch);

  if (!pointsSaved) return false;

  if (isSoccerMatch(refreshedMatch)) {
    const { teamA, teamB } = getTwoMatchTeams(refreshedMatch);

    if (teamA && teamB) {
      const scoreA = Number(teamA.score || 0);
      const scoreB = Number(teamB.score || 0);
      const resultA = teamA.result || (scoreA > scoreB ? "win" : scoreA < scoreB ? "loss" : "draw");
      const resultB = teamB.result || (scoreB > scoreA ? "win" : scoreB < scoreA ? "loss" : "draw");

      const ratingsSaved = await saveSoccerPositionRatingAdjustments(
        refreshedMatch,
        scoreA,
        scoreB,
        resultA,
        resultB
      );

      if (!ratingsSaved) return false;
    }
  }

  return true;
}


async function recalculateSoccerRatingsAfterFormationEdit(matchId) {
  await loadMatches();

  const refreshedMatch = allMatches.find(m => m.id === matchId);

  if (!refreshedMatch || !isSoccerMatch(refreshedMatch) || !hasSubmittedScore(refreshedMatch)) {
    return true;
  }

  const { teamA, teamB } = getTwoMatchTeams(refreshedMatch);

  if (!teamA || !teamB) return true;

  const scoreA = Number(teamA.score || 0);
  const scoreB = Number(teamB.score || 0);
  const resultA = teamA.result || (scoreA > scoreB ? "win" : scoreA < scoreB ? "loss" : "draw");
  const resultB = teamB.result || (scoreB > scoreA ? "win" : scoreB < scoreA ? "loss" : "draw");

  return await saveSoccerPositionRatingAdjustments(refreshedMatch, scoreA, scoreB, resultA, resultB);
}

async function saveFormationOnly(match, assignments) {
  const allowedSides = allowedFormationSides(match);
  const assignedPlayers = assignments.all.filter(player =>
    player.team && allowedSides.includes(player.team)
  );

  if (!assignedPlayers.length) {
    alert("No editable players for your captain side.");
    return false;
  }

  const missingPosition = assignedPlayers.find(player => !player.position);

  if (missingPosition) {
    alert("Every player in your editable team must have a formation position.");
    return false;
  }

  for (const side of allowedSides) {
    const counts = teamFormationCounts(assignments, side);
    const error = validateSoccerFormationSide(counts, `Team ${side}`);

    if (error) {
      alert(error);
      return false;
    }
  }

  for (const player of assignedPlayers) {
    if (!player.teamPlayerId) continue;

    const { error } = await supabaseClient
      .from("match_team_players")
      .update({
        formation_position: player.position
      })
      .eq("id", player.teamPlayerId);

    if (error) {
      alert(error.message);
      return false;
    }
  }

  if (hasSubmittedScore(match)) {
    const recalculated = await recalculateSoccerRatingsAfterFormationEdit(match.id);
    if (!recalculated) return false;

    alert("Formation saved and soccer ratings recalculated.");
  } else {
    alert("Formation saved.");
  }

  $("teamModal")?.close();
  currentTeamMatchId = null;
  currentTeamEditScope = "full";

  await loadMatches();

  return true;
}

async function saveTeams() {
  const teamMatchId = cleanUuidValue(currentTeamMatchId);

  if (!teamMatchId) {
    alert("No match selected.");
    return;
  }

  const match = allMatches.find(m => m.id === teamMatchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  const assignments = collectTeamAssignments();

  if (isFormationOnlyMode()) {
    if (!canEditFormation(match)) {
      alert("Only captains, the match creator, or admin can save formation.");
      return;
    }

    await saveFormationOnly(match, assignments);
    return;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can save teams.");
    return;
  }

  if (!isTeamEditable(match)) {
    alert("Teams cannot be saved for cancelled matches.");
    return;
  }

  const teamAName = $("team-a-name")?.value.trim() || "Team A";
  const teamBName = $("team-b-name")?.value.trim() || "Team B";

  const teamCountDifference = Math.abs(assignments.teamA.length - assignments.teamB.length);

  if (assignments.teamA.length === 0 || assignments.teamB.length === 0) {
    alert("Both teams must have at least one player.");
    return;
  }

  if (teamCountDifference !== 0) {
    alert("Teams must have the same number of players.");
    return;
  }

  if (isSoccerMatch(match)) {
    const assignedPlayers = assignments.all.filter(player => player.team);

    const missingPosition = assignedPlayers.find(player => !player.position);

    if (missingPosition) {
      alert("For soccer, every assigned player must have a formation position.");
      return;
    }

    const countsA = teamFormationCounts(assignments, "A");
    const countsB = teamFormationCounts(assignments, "B");
    const formationErrorA = validateSoccerFormationSide(countsA, "Team A");
    const formationErrorB = validateSoccerFormationSide(countsB, "Team B");

    if (formationErrorA || formationErrorB) {
      alert(formationErrorA || formationErrorB);
      return;
    }

    const captainA = $("team-a-captain")?.value || "";
    const captainB = $("team-b-captain")?.value || "";

    if (!captainA || !captainB) {
      alert("For soccer, select one captain for Team A and one captain for Team B.");
      return;
    }

    if (!assignments.teamA.includes(captainA) || !assignments.teamB.includes(captainB)) {
      alert("Each captain must belong to the correct team.");
      return;
    }
  }

  const existingTeamIds = (match.match_teams || []).map(team => team.id);

  if (existingTeamIds.length > 0) {
    const { error: deletePlayersError } = await supabaseClient
      .from("match_team_players")
      .delete()
      .in("match_team_id", existingTeamIds);

    if (deletePlayersError) {
      alert(deletePlayersError.message);
      return;
    }

    const { error: deleteTeamsError } = await supabaseClient
      .from("match_teams")
      .delete()
      .eq("match_id", teamMatchId);

    if (deleteTeamsError) {
      alert(deleteTeamsError.message);
      return;
    }
  }

  const { data: teamsData, error: teamsError } = await supabaseClient
    .from("match_teams")
    .insert([
      {
        match_id: teamMatchId,
        name: teamAName,
        color: "A",
        score: 0,
        result: null
      },
      {
        match_id: teamMatchId,
        name: teamBName,
        color: "B",
        score: 0,
        result: null
      }
    ])
    .select("id,name,color");

  if (teamsError) {
    alert(teamsError.message);
    return;
  }

  const teamAId = teamsData?.find(team => team.color === "A")?.id || teamsData?.[0]?.id;
  const teamBId = teamsData?.find(team => team.color === "B")?.id || teamsData?.[1]?.id;

  const invitationByMemberId = new Map(
    inPlayerInvitations(match).map(inv => [inv.member_id, inv])
  );

  const detailsByMemberId = new Map(
    assignments.all.map(player => [player.memberId, player])
  );

  const playerRows = [
    ...assignments.teamA.map(memberId => {
      const details = detailsByMemberId.get(memberId) || {};

      return {
        match_team_id: teamAId,
        member_id: memberId,
        is_external: Boolean(invitationByMemberId.get(memberId)?.member?.is_external),
        formation_position: isSoccerMatch(match) ? details.position || null : null,
        is_captain: isSoccerMatch(match) ? Boolean(details.isCaptain) : false
      };
    }),
    ...assignments.teamB.map(memberId => {
      const details = detailsByMemberId.get(memberId) || {};

      return {
        match_team_id: teamBId,
        member_id: memberId,
        is_external: Boolean(invitationByMemberId.get(memberId)?.member?.is_external),
        formation_position: isSoccerMatch(match) ? details.position || null : null,
        is_captain: isSoccerMatch(match) ? Boolean(details.isCaptain) : false
      };
    })
  ];

  if (playerRows.length > 0) {
    const { error: playersError } = await supabaseClient
      .from("match_team_players")
      .insert(playerRows);

    if (playersError) {
      alert(playersError.message);
      return;
    }
  }

  const { error: matchUpdateError } = await supabaseClient
    .from("matches")
    .update({
      team_status: "assigned"
    })
    .eq("id", teamMatchId);

  if (matchUpdateError) {
    alert(matchUpdateError.message);
    return;
  }

  if (match.score_status === "submitted") {
    const pointsUpdated = await recalculatePointsAfterTeamEdit(teamMatchId);

    if (!pointsUpdated) return;

    alert("Teams saved and points recalculated.");
  } else {
    alert("Teams saved.");
  }

  $("teamModal")?.close();
  currentTeamMatchId = null;
  currentTeamEditScope = "full";

  await loadMatches();
}


function getTwoMatchTeams(match) {
  const teams = match.match_teams || [];

  return {
    teamA: teams[0] || null,
    teamB: teams[1] || null
  };
}

function finalizedRecalculableMatches() {
  return (allMatches || []).filter(match =>
    !isCancelledMatch(match) &&
    hasSubmittedScore(match)
  );
}

function scoreContextForMatch(match) {
  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) return null;

  const scoreA = Number(teamA.score || 0);
  const scoreB = Number(teamB.score || 0);

  return {
    teamA,
    teamB,
    scoreA,
    scoreB,
    resultA: teamA.result || (scoreA > scoreB ? "win" : scoreA < scoreB ? "loss" : "draw"),
    resultB: teamB.result || (scoreB > scoreA ? "win" : scoreB < scoreA ? "loss" : "draw")
  };
}

async function recalculateMatchPoints(match, showAlert = true) {
  if (!canManageMatch(match) && !isCurrentUserAdmin()) {
    alert("Only the match creator or admin can recalculate this match.");
    return false;
  }

  if (isCancelledMatch(match) || !hasSubmittedScore(match)) {
    if (showAlert) alert("Only finalized, non-cancelled matches can be recalculated.");
    return false;
  }

  const saved = await saveMatchMemberPoints(match);

  if (!saved) return false;

  if (showAlert) {
    alert("Match points recalculated.");
    await loadMatches();
  }

  return true;
}

async function recalculateMatchSoccerRatings(match, showAlert = true) {
  if (!canManageMatch(match) && !isCurrentUserAdmin()) {
    alert("Only the match creator or admin can recalculate this match.");
    return false;
  }

  if (isCancelledMatch(match) || !hasSubmittedScore(match)) {
    if (showAlert) alert("Only finalized, non-cancelled matches can be recalculated.");
    return false;
  }

  if (!isSoccerMatch(match)) {
    if (showAlert) alert("Soccer rating recalculation applies only to soccer/football matches.");
    return true;
  }

  const context = scoreContextForMatch(match);

  if (!context) {
    if (showAlert) alert("Assign teams and submit a result before recalculating soccer ratings.");
    return false;
  }

  const saved = await saveSoccerPositionRatingAdjustments(
    match,
    context.scoreA,
    context.scoreB,
    context.resultA,
    context.resultB
  );

  if (!saved) return false;

  if (showAlert) {
    alert("Soccer ratings recalculated.");
    await loadMatches();
  }

  return true;
}

function padelSetEntriesForGame(match, gameId) {
  return scoreEntriesForGame(match, gameId)
    .filter(entry => entry.entry_type === "padel_set")
    .map(entry => ({
      setNumber: Number(entry.set_number || 0),
      teamAScore: Number(entry.team_a_score || 0),
      teamBScore: Number(entry.team_b_score || 0),
      isCompleted: Boolean(entry.is_completed)
    }))
    .filter(entry => entry.setNumber > 0)
    .sort((a, b) => a.setNumber - b.setNumber);
}

function completedPadelGamesForMatch(match) {
  return matchSessionGames(match).filter(game =>
    game?.id &&
    game.status === "completed" &&
    game.winner_team
  );
}

async function recalculateMatchPadelRatings(match, showAlert = true) {
  if (!canManageMatch(match) && !isCurrentUserAdmin()) {
    alert("Only the match creator or admin can recalculate this match.");
    return false;
  }

  if (isCancelledMatch(match) || !hasSubmittedScore(match)) {
    if (showAlert) alert("Only finalized, non-cancelled matches can be recalculated.");
    return false;
  }

  if (!isPadelMatch(match)) {
    if (showAlert) alert("Padel rating recalculation applies only to padel matches.");
    return true;
  }

  const games = completedPadelGamesForMatch(match);

  if (!games.length) {
    if (showAlert) alert("No completed padel games found for this match.");
    return true;
  }

  for (const game of games) {
    const saved = await savePadelGameRatingAdjustments(
      match,
      game.id,
      padelSetEntriesForGame(match, game.id),
      game.winner_team
    );

    if (!saved) return false;
  }

  if (showAlert) {
    alert("Padel ratings recalculated.");
    await loadSportProfiles();
    await loadMatches();
  }

  return true;
}

async function recalculateMatchAll(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  const ok = confirm("Recalculate points and sport ratings for this finalized match?");
  if (!ok) return;

  const pointsOk = await recalculateMatchPoints(match, false);
  if (!pointsOk) return;

  const ratingsOk = await recalculateMatchSoccerRatings(match, false);
  if (!ratingsOk) return;

  const padelRatingsOk = await recalculateMatchPadelRatings(match, false);
  if (!padelRatingsOk) return;

  alert("Match recalculated.");
  await loadMatches();
}

async function recalculateAllFinalizedPoints() {
  if (!isCurrentUserAdmin()) {
    alert("Admin only.");
    return;
  }

  const matches = finalizedRecalculableMatches();

  if (!matches.length) {
    alert("No finalized matches found.");
    return;
  }

  const ok = confirm(`Recalculate points for ${matches.length} finalized match(es)?`);
  if (!ok) return;

  for (const match of matches) {
    const saved = await saveMatchMemberPoints(match);
    if (!saved) return;
  }

  alert("All finalized match points recalculated.");
  await loadMatches();
  renderRankings();
  renderLeagues();
}

async function recalculateAllSoccerRatings() {
  if (!isCurrentUserAdmin()) {
    alert("Admin only.");
    return;
  }

  const matches = finalizedRecalculableMatches().filter(match => isSoccerMatch(match));

  if (!matches.length) {
    alert("No finalized soccer matches found.");
    return;
  }

  const ok = confirm(`Recalculate soccer ratings for ${matches.length} finalized soccer match(es)?`);
  if (!ok) return;

  for (const match of matches) {
    const saved = await recalculateMatchSoccerRatings(match, false);
    if (!saved) return;
  }

  alert("All finalized soccer ratings recalculated.");
  await loadPositionRatings();
  await loadMatches();
  renderRankings();
  renderLeagues();
}

async function recalculateAllFinalizedMatches() {
  if (!isCurrentUserAdmin()) {
    alert("Admin only.");
    return;
  }

  const matches = finalizedRecalculableMatches();

  if (!matches.length) {
    alert("No finalized matches found.");
    return;
  }

  const ok = confirm(`Recalculate points and sport ratings for ${matches.length} finalized match(es)?`);
  if (!ok) return;

  for (const match of matches) {
    const pointsOk = await saveMatchMemberPoints(match);
    if (!pointsOk) return;

    if (isSoccerMatch(match)) {
      const ratingsOk = await recalculateMatchSoccerRatings(match, false);
      if (!ratingsOk) return;
    }

    if (isPadelMatch(match)) {
      const ratingsOk = await recalculateMatchPadelRatings(match, false);
      if (!ratingsOk) return;
    }
  }

  alert("All finalized matches recalculated.");
  await loadPositionRatings();
  await loadSportProfiles();
  await loadMatches();
  renderRankings();
  renderLeagues();
}

async function openScoreSubmission(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canSubmitScore(match)) {
    alert("Result can only be added or edited after the match is finished. Make sure teams are assigned first.");
    return;
  }

  if (isResultLocked(match) && !confirmResultEditLock(match)) {
    return;
  }

  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) {
    alert("Assign teams before adding or editing the result.");
    return;
  }

  currentScoreMatchId = matchId;

  if ($("score-match-label")) {
    const leagueName = leagueNameForId(match.league_id);
    $("score-match-label").textContent =
      `${match.title || "Match result"} — ${match.sports?.name || ""}${leagueName ? " — League: " + leagueName : ""}`;
  }

  if ($("score-team-a-label")) $("score-team-a-label").textContent = `${teamA.name || "Team A"} score`;
  if ($("score-team-b-label")) $("score-team-b-label").textContent = `${teamB.name || "Team B"} score`;

  if ($("padel-team-a-head")) $("padel-team-a-head").textContent = teamA.name || "Team A";
  if ($("padel-team-b-head")) $("padel-team-b-head").textContent = teamB.name || "Team B";

  if ($("score-team-a")) $("score-team-a").value = Number(teamA.score || 0);
  if ($("score-team-b")) $("score-team-b").value = Number(teamB.score || 0);
  if ($("score-summary")) $("score-summary").value = match.notes || "";

  setScoreMode(match);

  if (isPadelMatch(match)) {
    await loadPendingPadelGames(match);
    renderPendingGameOptions();

    if ($("padel-game-mode")) $("padel-game-mode").value = "new";
    setPadelGameModeUI();

    const nextGameNumber = matchSessionGames(match).length + 1;
    if ($("padel-game-title")) $("padel-game-title").value = `Game ${nextGameNumber}`;

    clearPadelSetInputs();
  } else {
    if ($("score-team-a")) $("score-team-a").value = Number(teamA.score || 0);
    if ($("score-team-b")) $("score-team-b").value = Number(teamB.score || 0);
  }

  $("scoreModal")?.showModal();
}


function finalizableMatchGames(match) {
  return ABAScoring.finalizableMatchGames(match);
}

function completedGameScoreForMatch(match, extraGame = null) {
  return ABAScoring.completedGameScoreForMatch(match, extraGame);
}


function isValidCompletedPadelSet(scoreA, scoreB) {
  return ABAScoring.isValidCompletedPadelSet(scoreA, scoreB);
}

function shouldAutoCompletePadelSet(scoreA, scoreB) {
  return ABAScoring.shouldAutoCompletePadelSet(scoreA, scoreB);
}

function autoCompletePadelSet(setNumber) {
  const aRaw = $(`padel-set-${setNumber}-a`)?.value;
  const bRaw = $(`padel-set-${setNumber}-b`)?.value;
  const completedBox = $(`padel-set-${setNumber}-completed`);

  if (!completedBox || aRaw === "" || bRaw === "") return;

  const scoreA = Number(aRaw);
  const scoreB = Number(bRaw);

  if (shouldAutoCompletePadelSet(scoreA, scoreB)) {
    completedBox.checked = true;
  }
}

function autoCompleteAllPadelSets() {
  [1, 2, 3].forEach(autoCompletePadelSet);
  updatePadelScorePreview();
}

function padelGameStatusLabel(game, gameSets = []) {
  return ABAScoring.padelGameStatusLabel(game, gameSets);
}

const PADEL_RATING_POSITION = "OVERALL";
const PADEL_RATING_K = 0.25;
const PADEL_RATING_SCALE = 2;
const PADEL_COMEBACK_BONUS = 0.05;

function teamPlayerMemberIds(team) {
  return (team?.match_team_players || [])
    .map(player => cleanUuidValue(player.member_id))
    .filter(Boolean);
}

function averageTeamSportRating(memberIds, sportId) {
  return averageValues(
    (memberIds || []).map(memberId => memberSportRating(memberId, sportId)),
    5
  );
}

function expectedPadelWinProbability(teamRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (Number(opponentRating || 0) - Number(teamRating || 0)) / PADEL_RATING_SCALE));
}

function padelSetSummary(sets = [], winnerTeam = null) {
  const completedSets = (sets || [])
    .filter(set => Boolean(set.isCompleted ?? set.is_completed))
    .sort((a, b) => Number(a.setNumber ?? a.set_number ?? 0) - Number(b.setNumber ?? b.set_number ?? 0));

  let teamAGames = 0;
  let teamBGames = 0;
  let teamASetWins = 0;
  let teamBSetWins = 0;
  let firstSetWinner = null;

  completedSets.forEach((set, index) => {
    const scoreA = Number(set.teamAScore ?? set.team_a_score ?? 0);
    const scoreB = Number(set.teamBScore ?? set.team_b_score ?? 0);

    teamAGames += scoreA;
    teamBGames += scoreB;

    const setWinner = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null;

    if (setWinner === "A") teamASetWins += 1;
    if (setWinner === "B") teamBSetWins += 1;
    if (index === 0) firstSetWinner = setWinner;
  });

  const resolvedWinner = winnerTeam || (teamASetWins > teamBSetWins ? "A" : teamBSetWins > teamASetWins ? "B" : null);

  return {
    completedSets,
    teamAGames,
    teamBGames,
    teamASetWins,
    teamBSetWins,
    winnerTeam: resolvedWinner,
    gameMargin: Math.abs(teamAGames - teamBGames),
    comebackTeam: completedSets.length >= 3 && firstSetWinner && resolvedWinner && firstSetWinner !== resolvedWinner
      ? resolvedWinner
      : null
  };
}

function padelMarginMultiplier(gameMargin) {
  return clampNumber(1 + (Number(gameMargin || 0) / 12) * 0.2, 1, 1.2);
}

function padelRatingDeltas(match, sets, winnerTeam) {
  const { teamA, teamB } = getTwoMatchTeams(match);
  const summary = padelSetSummary(sets, winnerTeam);

  if (!teamA || !teamB || !summary.winnerTeam) return [];

  const teamAIds = teamPlayerMemberIds(teamA);
  const teamBIds = teamPlayerMemberIds(teamB);

  if (!teamAIds.length || !teamBIds.length) return [];

  const teamARating = averageTeamSportRating(teamAIds, match.sport_id);
  const teamBRating = averageTeamSportRating(teamBIds, match.sport_id);
  const expectedA = expectedPadelWinProbability(teamARating, teamBRating);
  const expectedB = 1 - expectedA;
  const actualA = summary.winnerTeam === "A" ? 1 : 0;
  const actualB = summary.winnerTeam === "B" ? 1 : 0;
  const multiplier = padelMarginMultiplier(summary.gameMargin);

  let deltaA = PADEL_RATING_K * (actualA - expectedA) * multiplier;
  let deltaB = PADEL_RATING_K * (actualB - expectedB) * multiplier;

  if (summary.comebackTeam === "A") deltaA += PADEL_COMEBACK_BONUS;
  if (summary.comebackTeam === "B") deltaB += PADEL_COMEBACK_BONUS;

  return [
    ...teamAIds.map(memberId => ({
      member_id: memberId,
      sport_id: match.sport_id,
      adjustment: Number(deltaA.toFixed(3))
    })),
    ...teamBIds.map(memberId => ({
      member_id: memberId,
      sport_id: match.sport_id,
      adjustment: Number(deltaB.toFixed(3))
    }))
  ];
}

async function setOverallSportRatingValue(memberId, sportId, ratingValue, gamesDelta) {
  const cleanMemberId = cleanUuidValue(memberId);
  const cleanSportId = cleanUuidValue(sportId);

  if (!cleanMemberId || !cleanSportId) return true;

  const existing = sportProfileForMember(cleanMemberId, cleanSportId);
  const currentGames = Number(existing?.games_played || 0);
  const nextGamesPlayed = Math.max(0, currentGames + Number(gamesDelta || 0));
  const nextRating = clampNumber(Number(ratingValue || 5), 1, 10);

  const { error } = await supabaseClient
    .from("member_sport_profiles")
    .upsert({
      member_id: cleanMemberId,
      sport_id: cleanSportId,
      rating: Number(nextRating.toFixed(2)),
      games_played: nextGamesPlayed,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "member_id,sport_id"
    });

  if (error) {
    alert(error.message);
    return false;
  }

  await loadSportProfiles();
  return true;
}

async function applyOverallSportRatingDelta(memberId, sportId, delta, gamesDelta) {
  const cleanMemberId = cleanUuidValue(memberId);
  const cleanSportId = cleanUuidValue(sportId);

  if (!cleanMemberId || !cleanSportId) {
    return {
      ok: true,
      skipped: true
    };
  }

  const ratingBefore = memberSportRating(cleanMemberId, cleanSportId);
  const ratingAfter = clampNumber(ratingBefore + Number(delta || 0), 1, 10);
  const ok = await setOverallSportRatingValue(cleanMemberId, cleanSportId, ratingAfter, gamesDelta);

  return {
    ok,
    ratingBefore,
    ratingAfter
  };
}

async function rollbackPreviousPadelGameRatingAdjustments(gameId) {
  const cleanGameId = cleanUuidValue(gameId);

  if (!cleanGameId) return true;

  const { data, error } = await supabaseClient
    .from("match_position_rating_adjustments")
    .select("id,member_id,sport_id,adjustment,rating_before,rating_after")
    .eq("game_id", cleanGameId)
    .eq("position_name", PADEL_RATING_POSITION);

  if (error) {
    alert(error.message);
    return false;
  }

  for (const row of data || []) {
    const ok = await setOverallSportRatingValue(
      row.member_id,
      row.sport_id,
      Number(row.rating_before ?? 5),
      -1
    );

    if (!ok) return false;
  }

  if ((data || []).length) {
    const { error: deleteError } = await supabaseClient
      .from("match_position_rating_adjustments")
      .delete()
      .eq("game_id", cleanGameId)
      .eq("position_name", PADEL_RATING_POSITION);

    if (deleteError) {
      alert(deleteError.message);
      return false;
    }
  }

  return true;
}

async function savePadelGameRatingAdjustmentRow(row) {
  const cleanRow = {
    match_id: cleanUuidValue(row.match_id),
    game_id: cleanUuidValue(row.game_id),
    member_id: cleanUuidValue(row.member_id),
    sport_id: cleanUuidValue(row.sport_id),
    position_name: PADEL_RATING_POSITION,
    adjustment: Number(row.adjustment || 0),
    rating_before: Number(row.rating_before || 0),
    rating_after: Number(row.rating_after || 0),
    formula_version: 1,
    settings_snapshot: {
      engine: "padel_overall_v1",
      k: PADEL_RATING_K,
      scale: PADEL_RATING_SCALE,
      comebackBonus: PADEL_COMEBACK_BONUS
    }
  };

  if (!cleanRow.match_id || !cleanRow.game_id || !cleanRow.member_id || !cleanRow.sport_id) {
    console.warn("Skipping invalid padel rating adjustment row:", row);
    return true;
  }

  const { error } = await supabaseClient
    .from("match_position_rating_adjustments")
    .insert(cleanRow);

  if (error) {
    alert(error.message);
    return false;
  }

  return true;
}

async function savePadelGameRatingAdjustments(match, gameId, sets, winnerTeam) {
  if (!isPadelMatch(match)) return true;

  const cleanGameId = cleanUuidValue(gameId);

  if (!cleanGameId) return true;

  await loadSportProfiles();

  const rolledBack = await rollbackPreviousPadelGameRatingAdjustments(cleanGameId);
  if (!rolledBack) return false;

  if (!winnerTeam) return true;

  const rows = padelRatingDeltas(match, sets, winnerTeam);

  for (const row of rows) {
    const result = await applyOverallSportRatingDelta(
      row.member_id,
      row.sport_id,
      Number(row.adjustment || 0),
      1
    );

    if (!result?.ok) return false;

    const saved = await savePadelGameRatingAdjustmentRow({
      match_id: match.id,
      game_id: cleanGameId,
      member_id: row.member_id,
      sport_id: row.sport_id,
      adjustment: Number(Number(row.adjustment || 0).toFixed(3)),
      rating_before: Number(Number(result.ratingBefore).toFixed(2)),
      rating_after: Number(Number(result.ratingAfter).toFixed(2))
    });

    if (!saved) return false;
  }

  return true;
}

async function deleteSelectedGameFromResults() {
  if (!currentScoreMatchId) {
    alert("No match selected.");
    return;
  }

  const match = allMatches.find(m => m.id === currentScoreMatchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canSubmitScore(match)) {
    alert("Games can only be deleted while editing results.");
    return;
  }

  if (!isPadelMatch(match)) {
    alert("Delete Game is currently for padel games only.");
    return;
  }

  const mode = $("padel-game-mode")?.value || "new";
  const gameId = $("padel-pending-game")?.value || "";

  if (mode !== "continue" || !gameId) {
    alert("Choose Edit / Continue Game and select a game to delete.");
    return;
  }

  const game = allPendingGames.find(g => g.id === gameId);
  const ok = confirm(`Delete ${game?.title || "this game"} from results? This removes its saved sets too.`);

  if (!ok) return;

  const ratingsRolledBack = await rollbackPreviousPadelGameRatingAdjustments(gameId);
  if (!ratingsRolledBack) return;

  const { error: deleteGameError } = await supabaseClient
    .from("match_games")
    .delete()
    .eq("id", gameId);

  if (deleteGameError) {
    alert(deleteGameError.message);
    return;
  }

  alert("Game deleted.");

  await loadMatches();

  const refreshedMatch = allMatches.find(m => m.id === currentScoreMatchId);
  if (!refreshedMatch) {
    $("scoreModal")?.close();
    currentScoreMatchId = null;
    return;
  }

  await loadPendingPadelGames(refreshedMatch);
  renderPendingGameOptions();

  if ($("padel-game-mode")) $("padel-game-mode").value = "new";
  setPadelGameModeUI();

  const nextGameNumber = matchSessionGames(refreshedMatch).length + 1;
  if ($("padel-game-title")) $("padel-game-title").value = `Game ${nextGameNumber}`;

  clearPadelSetInputs();
}

async function savePadelGameOnly() {
  const scoreMatchId = cleanUuidValue(currentScoreMatchId);

  if (!scoreMatchId) {
    alert("No match selected.");
    return null;
  }

  const match = allMatches.find(m => m.id === scoreMatchId);

  if (!match) {
    alert("Match not found.");
    return null;
  }

  if (!canSubmitScore(match)) {
    alert("Game can only be saved/edited after the match is finished and teams are assigned.");
    return null;
  }

  if (!isPadelMatch(match)) {
    alert("Save Game is currently for padel games only.");
    return null;
  }

  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) {
    alert("Assign teams before saving a game.");
    return null;
  }

  const mode = $("padel-game-mode")?.value || "new";
  const gameTitle = $("padel-game-title")?.value.trim() || "Padel Game";
  const padelResult = calculatePadelSetResult(padelSetInputs());

  if (padelResult.error) {
    alert(padelResult.error);
    return null;
  }

  let gameId = null;
  const winnerTeam = padelGameWinnerFromSets(padelResult);
  const gameStatus = winnerTeam ? "completed" : "in_progress";

  if (mode === "continue") {
    gameId = $("padel-pending-game")?.value || "";

    if (!gameId) {
      alert("Select a pending game to continue.");
      return null;
    }

    const { error: gameUpdateError } = await supabaseClient
      .from("match_games")
      .update({
        title: gameTitle,
        team_a_name: teamA.name || "Team A",
        team_b_name: teamB.name || "Team B",
        team_a_score: padelResult.teamASetWins,
        team_b_score: padelResult.teamBSetWins,
        winner_team: winnerTeam,
        status: gameStatus
      })
      .eq("id", gameId);

    if (gameUpdateError) {
      alert(gameUpdateError.message);
      return null;
    }
  } else {
    const { data: gameData, error: gameError } = await supabaseClient
      .from("match_games")
      .insert({
        sport_id: match.sport_id,
        league_id: match.league_id || null,
        title: gameTitle,
        status: gameStatus,
        team_a_name: teamA.name || "Team A",
        team_b_name: teamB.name || "Team B",
        team_a_score: padelResult.teamASetWins,
        team_b_score: padelResult.teamBSetWins,
        winner_team: winnerTeam,
        created_by: currentProfile.id
      })
      .select("id")
      .single();

    if (gameError) {
      alert(gameError.message);
      return null;
    }

    gameId = gameData.id;
  }

  const { error: sessionError } = await supabaseClient
    .from("match_game_sessions")
    .upsert({
      match_id: scoreMatchId,
      game_id: gameId
    }, {
      onConflict: "match_id,game_id"
    });

  if (sessionError) {
    alert(sessionError.message);
    return null;
  }

  const { error: deleteEntriesError } = await supabaseClient
    .from("match_score_entries")
    .delete()
    .eq("game_id", gameId);

  if (deleteEntriesError) {
    alert(deleteEntriesError.message);
    return null;
  }

  const scoreRows = padelResult.validSets.map(set => ({
    match_id: scoreMatchId,
    game_id: gameId,
    sport_id: match.sport_id,
    entry_type: "padel_set",
    game_number: null,
    set_number: set.setNumber,
    team_a_score: set.teamAScore,
    team_b_score: set.teamBScore,
    is_completed: set.isCompleted,
    notes: null
  }));

  const { error: entriesError } = await supabaseClient
    .from("match_score_entries")
    .insert(scoreRows);

  if (entriesError) {
    alert(entriesError.message);
    return null;
  }

  const score = completedGameScoreForMatch(match, {
    id: gameId,
    status: gameStatus,
    winner_team: winnerTeam
  });

  const resultA = score.teamA > score.teamB ? "win" : score.teamA < score.teamB ? "loss" : "draw";
  const resultB = score.teamB > score.teamA ? "win" : score.teamB < score.teamA ? "loss" : "draw";

  const { error: teamAError } = await supabaseClient
    .from("match_teams")
    .update({
      score: score.teamA,
      result: resultA
    })
    .eq("id", teamA.id);

  if (teamAError) {
    alert(teamAError.message);
    return null;
  }

  const { error: teamBError } = await supabaseClient
    .from("match_teams")
    .update({
      score: score.teamB,
      result: resultB
    })
    .eq("id", teamB.id);

  if (teamBError) {
    alert(teamBError.message);
    return null;
  }

  const summary = $("score-summary")?.value.trim() || null;

  const { error: matchError } = await supabaseClient
    .from("matches")
    .update({
      score_status: "in_progress",
      notes: summary
    })
    .eq("id", scoreMatchId);

  if (matchError) {
    alert(matchError.message);
    return null;
  }

  const ratingsSaved = await savePadelGameRatingAdjustments(
    match,
    gameId,
    padelResult.validSets,
    winnerTeam
  );

  if (!ratingsSaved) return null;

  return {
    gameId,
    gameStatus,
    winnerTeam,
    score
  };
}

async function saveCurrentGameAndStayOpen() {
  const saved = await savePadelGameOnly();

  if (!saved) return;

  alert(saved.gameStatus === "completed" ? "Game saved as completed and padel ratings updated." : "Game saved as pending.");

  await loadMatches();

  const match = allMatches.find(m => m.id === currentScoreMatchId);
  if (!match) return;

  await loadPendingPadelGames(match);
  renderPendingGameOptions();

  if ($("padel-game-mode")) $("padel-game-mode").value = "new";
  setPadelGameModeUI();

  const nextGameNumber = matchSessionGames(match).length + 1;
  if ($("padel-game-title")) $("padel-game-title").value = `Game ${nextGameNumber}`;

  clearPadelSetInputs();
}


function teamResultForMember(match, memberId) {
  const teams = match.match_teams || [];

  for (const team of teams) {
    const players = team.match_team_players || [];
    const found = players.some(player => player.member_id === memberId);

    if (found) {
      return {
        team,
        result: team.result || "draw"
      };
    }
  }

  return {
    team: null,
    result: "participated"
  };
}

function matchDurationHours(match) {
  const start = new Date(match?.start_time || 0).getTime();
  const end = new Date(match?.end_time || 0).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return (end - start) / (1000 * 60 * 60);
}

function activityPointsForDurationHours(durationHours) {
  const hours = Number(durationHours || 0);

  if (!Number.isFinite(hours) || hours <= 0) return 0;

  return Math.min(3, Math.max(0, Math.floor(hours / 0.5)));
}

function activityPointsForDurationMinutes(durationMinutes) {
  return activityPointsForDurationHours(Number(durationMinutes || 0) / 60);
}

function defaultActivityRateForSportName(name) {
  const sportName = String(name || "").toLowerCase();

  if (
    sportName.includes("walk") ||
    sportName.includes("stretch") ||
    sportName.includes("yoga")
  ) {
    return 0.3;
  }

  if (
    sportName.includes("gym") ||
    sportName.includes("weight") ||
    sportName.includes("lifting") ||
    sportName.includes("volleyball")
  ) {
    return 0.7;
  }

  return 1;
}

function normalizeActivitySportSettings(settings = {}) {
  const normalized = {};

  (allSports || []).forEach(sport => {
    const saved = settings[sport.id] || {};
    const rate = Number(saved.rate ?? defaultActivityRateForSportName(sport.name));
    const cap = Number(saved.cap ?? DEFAULT_ACTIVITY_CAP);

    normalized[sport.id] = {
      rate: Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_ACTIVITY_RATE,
      cap: Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_ACTIVITY_CAP
    };
  });

  Object.entries(settings || {}).forEach(([sportId, saved]) => {
    if (normalized[sportId]) return;

    const rate = Number(saved?.rate ?? DEFAULT_ACTIVITY_RATE);
    const cap = Number(saved?.cap ?? DEFAULT_ACTIVITY_CAP);

    normalized[sportId] = {
      rate: Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_ACTIVITY_RATE,
      cap: Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_ACTIVITY_CAP
    };
  });

  return normalized;
}

function readLocalActivitySportSettings() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_SPORT_SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function cacheActivitySportSettings(settings = {}) {
  activitySportSettingsCache = normalizeActivitySportSettings(settings);
  localStorage.setItem(ACTIVITY_SPORT_SETTINGS_KEY, JSON.stringify(activitySportSettingsCache));
  return activitySportSettingsCache;
}

function activitySportSettings() {
  return normalizeActivitySportSettings(activitySportSettingsCache || readLocalActivitySportSettings());
}

async function loadActivitySportSettings(force = false) {
  if (activitySportSettingsLoadPromise && !force) return activitySportSettingsLoadPromise;

  activitySportSettingsLoadPromise = (async () => {
    try {
      const { data, error } = await supabaseClient
        .from("app_settings")
        .select("value")
        .eq("key", ACTIVITY_SPORT_APP_SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      return cacheActivitySportSettings(data?.value || {});
    } catch (error) {
      console.warn("Using local activity sport settings fallback:", error.message);
      return cacheActivitySportSettings(readLocalActivitySportSettings());
    }
  })();

  return activitySportSettingsLoadPromise;
}

function activitySettingForSport(sportId) {
  const settings = activitySportSettings();
  const sport = (allSports || []).find(item => item.id === sportId);

  return settings[sportId] || {
    rate: defaultActivityRateForSportName(sport?.name),
    cap: DEFAULT_ACTIVITY_CAP
  };
}

function loggedActivityPointsForDurationMinutes(durationMinutes, sportId) {
  const minutes = Number(durationMinutes || 0);
  const setting = activitySettingForSport(sportId);
  const rate = Number(setting.rate ?? DEFAULT_ACTIVITY_RATE);
  const cap = Number(setting.cap ?? DEFAULT_ACTIVITY_CAP);

  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  const raw = (minutes / 30) * rate;
  const capped = Number.isFinite(cap) && cap >= 0 ? Math.min(cap, raw) : raw;

  return Math.round(Math.max(0, capped) * 100) / 100;
}

function renderActivitySettingsForm() {
  const box = $("activity-settings-list");
  if (!box) return;

  const settings = activitySportSettings();

  if (!allSports.length) {
    box.innerHTML = `<div class="hint">No sports found.</div>`;
    return;
  }

  box.innerHTML = allSports.map(sport => {
    const setting = settings[sport.id] || activitySettingForSport(sport.id);

    return `
      <div class="activity-setting-row" data-sport-id="${sport.id}">
        <strong>${escapeHtml(sport.name)}</strong>

        <label>
          Points / 30 min
          <input class="activity-rate-input" type="number" min="0" step="0.05" value="${Number(setting.rate || 0)}">
        </label>

        <label>
          Max / activity
          <input class="activity-cap-input" type="number" min="0" step="0.25" value="${Number(setting.cap || 0)}">
        </label>
      </div>
    `;
  }).join("");

  if ($("activity-settings-status")) {
    $("activity-settings-status").textContent =
      "Logged activities use continuous duration: points = min(cap, duration_minutes / 30 * rate).";
  }
}

function activitySettingsFromForm() {
  const settings = {};

  document.querySelectorAll(".activity-setting-row").forEach(row => {
    const sportId = cleanUuidValue(row.dataset.sportId);
    const rate = Number(row.querySelector(".activity-rate-input")?.value);
    const cap = Number(row.querySelector(".activity-cap-input")?.value);

    if (!sportId) return;

    settings[sportId] = {
      rate: Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_ACTIVITY_RATE,
      cap: Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_ACTIVITY_CAP
    };
  });

  return settings;
}

async function saveActivitySportSettings() {
  if (!isCurrentUserAdmin()) {
    alert("Admin only.");
    return;
  }

  const settings = activitySettingsFromForm();

  const { error } = await supabaseClient
    .from("app_settings")
    .upsert({
      key: ACTIVITY_SPORT_APP_SETTING_KEY,
      value: settings,
      version: 1,
      updated_by: currentProfile?.id || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "key"
    });

  if (error) {
    alert(error.message);
    return;
  }

  cacheActivitySportSettings(settings);
  updateActivityPointsPreview();

  if ($("activity-settings-status")) {
    $("activity-settings-status").textContent = "Activity settings saved.";
  }
}

function activityPointsForMatch(match) {
  return activityPointsForDurationHours(matchDurationHours(match));
}

function scorePointsForResult(result) {
  if (result === "win") return 7;
  if (result === "draw") return 2;
  return 0;
}

function pointBreakdownForResult(result, match = null) {
  const activityPoints = activityPointsForMatch(match);
  const scorePoints = scorePointsForResult(result);
  const totalPoints = activityPoints + scorePoints;

  return {
    activityPoints,
    scorePoints,
    basePoints: totalPoints,
    difficultyFactor: 1,
    consistencyBonus: 0,
    totalPoints
  };
}

function pointTotalPoints(point) {
  const hasSplitPoints =
    (
      point?.activity_points !== null &&
      point?.activity_points !== undefined
    ) ||
    (
      point?.score_points !== null &&
      point?.score_points !== undefined
    );

  if (hasSplitPoints) {
    const activity = Number(point?.activity_points || 0);
    const score = Number(point?.score_points || 0);
    return activity + score;
  }

  if (point?.base_points !== null && point?.base_points !== undefined) {
    const base = Number(point.base_points);
    if (Number.isFinite(base)) return base;
  }

  if (point?.total_points !== null && point?.total_points !== undefined) {
    const total = Number(point.total_points);
    if (Number.isFinite(total)) return total;
  }

  return 0;
}

function formatPointValue(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";

  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

async function saveMatchMemberPoints(match) {
  if (!match?.id) return false;

  const matchId = cleanUuidValue(match.id);
  const sportId = cleanUuidValue(match.sport_id);

  if (!matchId || !sportId) {
    alert("Cannot save points: match or sport id is missing.");
    return false;
  }

  const inInvitations = inPlayerInvitations(match);
  const uniqueInvitationsByMember = new Map();

  inInvitations.forEach(inv => {
    const memberId = cleanUuidValue(inv?.member_id);

    if (memberId && !uniqueInvitationsByMember.has(memberId)) {
      uniqueInvitationsByMember.set(memberId, {
        ...inv,
        member_id: memberId
      });
    }
  });

  const uniqueInvitations = Array.from(uniqueInvitationsByMember.values());

  if (!uniqueInvitations.length) {
    console.warn("No IN players found for points calculation.");
    return true;
  }

  const rows = uniqueInvitations.map(inv => {
    const memberId = cleanUuidValue(inv.member_id);
    const playerTeam = teamResultForMember(match, memberId);
    const points = pointBreakdownForResult(playerTeam.result, match);

    return {
      match_id: matchId,
      member_id: memberId,
      sport_id: sportId,
      activity_points: points.activityPoints,
      score_points: points.scorePoints,
      base_points: points.basePoints,
      difficulty_factor: points.difficultyFactor,
      consistency_bonus: points.consistencyBonus
    };
  }).filter(row =>
    isValidUuidValue(row.match_id) &&
    isValidUuidValue(row.member_id) &&
    isValidUuidValue(row.sport_id)
  );

  if (!rows.length) {
    console.warn("No valid point rows to save.");
    return true;
  }

  const { error: upsertError } = await supabaseClient
    .from("match_member_points")
    .upsert(rows, {
      onConflict: "match_id,member_id"
    });

  if (upsertError) {
    alert(upsertError.message);
    return false;
  }

  return true;
}

function renderPointsSummary(match) {
  return "";
}



function renderRatingChanges(match) {
  const adjustments = (match.match_position_rating_adjustments || [])
    .filter(row =>
      row &&
      row.member_id &&
      row.position_name &&
      row.rating_before !== null &&
      row.rating_before !== undefined &&
      row.rating_after !== null &&
      row.rating_after !== undefined
    )
    .sort((a, b) =>
      normalizeSoccerPosition(a.position_name).localeCompare(normalizeSoccerPosition(b.position_name)) ||
      memberDisplayName(a.member).localeCompare(memberDisplayName(b.member))
    );

  if (!adjustments.length) return "";

  return `
    <div class="rating-changes-summary">
      <strong>Rating changes</strong>

      ${adjustments.map(row => {
        const before = Number(row.rating_before || 0);
        const after = Number(row.rating_after || 0);
        const delta = after - before;
        const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`;

        return `
          <div class="rating-change-row">
            <span>
              ${escapeHtml(memberDisplayName(row.member))}
              ${row.member?.is_external ? `<em>External</em>` : ""}
              <small>${escapeHtml(normalizeSoccerPosition(row.position_name))}</small>
            </span>

            <b class="${delta >= 0 ? "positive" : "negative"}">
              ${before.toFixed(2)} → ${after.toFixed(2)} (${deltaText})
            </b>
          </div>
        `;
      }).join("")}
    </div>
  `;
}


const SOCCER_RATING_SETTINGS_KEY = "aba_soccer_rating_settings";
const SOCCER_RATING_APP_SETTING_KEY = "soccer_rating_settings";

const DEFAULT_SOCCER_RATING_SETTINGS = {
  rollingAverageWindow: 20,
  minimumMatchesRequired: 10,
  defaultAverageTotalGoals: 15,
  attackConstant: 1.0,
  defenseConstant: 1.0,
  attAttackShare: 0.70,
  midAttackShare: 0.30,
  midDefenseShare: 0.15,
  defDefenseShare: 0.50,
  gkDefenseShare: 0.35,
  winModifier: 0.10,
  lossModifier: -0.10,
  maxGain: 0.35,
  maxLoss: 0.35
};

let soccerRatingSettingsCache = null;
let soccerRatingSettingsVersion = 1;
let soccerRatingSettingsLoadPromise = null;

function readLocalSoccerRatingSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SOCCER_RATING_SETTINGS_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function normalizeSoccerRatingSettings(raw = {}, version = null) {
  const settings = {
    ...DEFAULT_SOCCER_RATING_SETTINGS,
    ...(raw && typeof raw === "object" ? raw : {})
  };

  // Backward compatibility with older saved settings.
  if (settings.midAttackWeight !== undefined && settings.midAttackShare === undefined) {
    settings.midAttackShare = Number(settings.midAttackWeight);
  }

  if (settings.midDefenseWeight !== undefined && settings.midDefenseShare === undefined) {
    settings.midDefenseShare = Number(settings.midDefenseWeight);
  }

  settings.formulaVersion = Number(version || settings.formulaVersion || 1);
  return settings;
}

function cacheSoccerRatingSettings(settings, version = null) {
  soccerRatingSettingsCache = normalizeSoccerRatingSettings(settings, version);
  soccerRatingSettingsVersion = Number(soccerRatingSettingsCache.formulaVersion || version || 1);
  localStorage.setItem(SOCCER_RATING_SETTINGS_KEY, JSON.stringify(soccerRatingSettingsCache));
  return soccerRatingSettingsCache;
}

function soccerRatingSettings() {
  return normalizeSoccerRatingSettings(
    soccerRatingSettingsCache || readLocalSoccerRatingSettings(),
    soccerRatingSettingsVersion
  );
}

async function loadSoccerRatingSettings(force = false) {
  if (soccerRatingSettingsLoadPromise && !force) return soccerRatingSettingsLoadPromise;

  soccerRatingSettingsLoadPromise = (async () => {
    try {
      const { data, error } = await supabaseClient
        .from("app_settings")
        .select("value,version")
        .eq("key", SOCCER_RATING_APP_SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      return cacheSoccerRatingSettings(data?.value || {}, data?.version || 1);
    } catch (error) {
      console.warn("Using local soccer formula settings fallback:", error.message);
      return cacheSoccerRatingSettings(readLocalSoccerRatingSettings());
    }
  })();

  return soccerRatingSettingsLoadPromise;
}

function soccerRatingSettingsFromForm() {
  const defaults = DEFAULT_SOCCER_RATING_SETTINGS;

  const settings = {
    rollingAverageWindow: Math.max(1, Math.round(readSoccerSettingInput("soccer-setting-rolling-window", defaults.rollingAverageWindow))),
    minimumMatchesRequired: Math.max(0, Math.round(readSoccerSettingInput("soccer-setting-min-matches", defaults.minimumMatchesRequired))),
    defaultAverageTotalGoals: Math.max(0, readSoccerSettingInput("soccer-setting-default-total-goals", defaults.defaultAverageTotalGoals)),
    attackConstant: readSoccerSettingInput("soccer-setting-attack-constant", defaults.attackConstant),
    defenseConstant: readSoccerSettingInput("soccer-setting-defense-constant", defaults.defenseConstant),
    attAttackShare: readSoccerSettingInput("soccer-setting-att-attack-share", defaults.attAttackShare),
    midAttackShare: readSoccerSettingInput("soccer-setting-mid-attack-share", defaults.midAttackShare),
    midDefenseShare: readSoccerSettingInput("soccer-setting-mid-defense-share", defaults.midDefenseShare),
    defDefenseShare: readSoccerSettingInput("soccer-setting-def-defense-share", defaults.defDefenseShare),
    gkDefenseShare: readSoccerSettingInput("soccer-setting-gk-defense-share", defaults.gkDefenseShare),
    winModifier: readSoccerSettingInput("soccer-setting-win", defaults.winModifier),
    lossModifier: readSoccerSettingInput("soccer-setting-loss", defaults.lossModifier),
    maxGain: Math.abs(readSoccerSettingInput("soccer-setting-max-gain", defaults.maxGain)),
    maxLoss: Math.abs(readSoccerSettingInput("soccer-setting-max-loss", defaults.maxLoss))
  };

  const attackShareTotal = settings.attAttackShare + settings.midAttackShare;
  const defenseShareTotal = settings.midDefenseShare + settings.defDefenseShare + settings.gkDefenseShare;

  if (Object.values(settings).some(value => !Number.isFinite(Number(value)))) {
    throw new Error("All soccer formula values must be valid numbers.");
  }

  if (settings.attAttackShare < 0 || settings.midAttackShare < 0) {
    throw new Error("Attack shares cannot be negative.");
  }

  if (settings.midDefenseShare < 0 || settings.defDefenseShare < 0 || settings.gkDefenseShare < 0) {
    throw new Error("Defense shares cannot be negative.");
  }

  if (Math.abs(attackShareTotal - 1) > 0.01) {
    throw new Error("ATT attack share + MID attack share should equal 1.00.");
  }

  if (Math.abs(defenseShareTotal - 1) > 0.01) {
    throw new Error("MID defense share + DEF defense share + GK defense share should equal 1.00.");
  }

  return settings;
}

function setSoccerSettingInput(id, value) {
  const input = $(id);
  if (!input) return;

  const n = Number(value);
  input.value = Number.isFinite(n) ? String(Number(n.toFixed(3))) : "";
}

function readSoccerSettingInput(id, fallback) {
  const input = $(id);
  const value = Number(input?.value);

  return Number.isFinite(value) ? value : fallback;
}

function renderSoccerRatingSettingsForm() {
  const card = $("soccer-rating-settings-card");
  if (!card) return;

  const settings = soccerRatingSettings();

  setSoccerSettingInput("soccer-setting-rolling-window", settings.rollingAverageWindow);
  setSoccerSettingInput("soccer-setting-min-matches", settings.minimumMatchesRequired);
  setSoccerSettingInput("soccer-setting-default-total-goals", settings.defaultAverageTotalGoals);
  setSoccerSettingInput("soccer-setting-attack-constant", settings.attackConstant);
  setSoccerSettingInput("soccer-setting-defense-constant", settings.defenseConstant);
  setSoccerSettingInput("soccer-setting-att-attack-share", settings.attAttackShare);
  setSoccerSettingInput("soccer-setting-mid-attack-share", settings.midAttackShare);
  setSoccerSettingInput("soccer-setting-mid-defense-share", settings.midDefenseShare);
  setSoccerSettingInput("soccer-setting-def-defense-share", settings.defDefenseShare);
  setSoccerSettingInput("soccer-setting-gk-defense-share", settings.gkDefenseShare);
  setSoccerSettingInput("soccer-setting-win", settings.winModifier);
  setSoccerSettingInput("soccer-setting-loss", settings.lossModifier);
  setSoccerSettingInput("soccer-setting-max-gain", settings.maxGain);
  setSoccerSettingInput("soccer-setting-max-loss", settings.maxLoss);

  if ($("soccer-settings-status")) {
    $("soccer-settings-status").textContent =
      `Shared soccer formula v${Number(settings.formulaVersion || 1)}. Saved in Supabase with local cache fallback.`;
  }
}

async function saveSoccerRatingSettings() {
  if (!isCurrentUserAdmin()) {
    alert("Admin only.");
    return;
  }

  let settings;

  try {
    settings = soccerRatingSettingsFromForm();
  } catch (error) {
    alert(error.message);
    return;
  }

  const current = await loadSoccerRatingSettings(true);
  const nextVersion = Number(current.formulaVersion || soccerRatingSettingsVersion || 1) + 1;
  const versionedSettings = { ...settings, formulaVersion: nextVersion };

  const { error } = await supabaseClient
    .from("app_settings")
    .upsert({
      key: SOCCER_RATING_APP_SETTING_KEY,
      value: versionedSettings,
      version: nextVersion,
      updated_by: currentProfile?.id || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "key"
    });

  if (error) {
    alert(error.message);
    return;
  }

  cacheSoccerRatingSettings(versionedSettings, nextVersion);
  renderSoccerRatingSettingsForm();

  if ($("soccer-settings-status")) {
    $("soccer-settings-status").textContent =
      `Shared soccer formula saved as v${nextVersion}. Use Maintenance Tools to recalculate old finalized matches.`;
  }

  renderMatches();
}

async function resetSoccerRatingSettings() {
  if (!isCurrentUserAdmin()) {
    alert("Admin only.");
    return;
  }

  const ok = confirm("Reset soccer expected-goals formula to default values?");
  if (!ok) return;

  const current = await loadSoccerRatingSettings(true);
  const nextVersion = Number(current.formulaVersion || soccerRatingSettingsVersion || 1) + 1;
  const settings = { ...DEFAULT_SOCCER_RATING_SETTINGS, formulaVersion: nextVersion };

  const { error } = await supabaseClient
    .from("app_settings")
    .upsert({
      key: SOCCER_RATING_APP_SETTING_KEY,
      value: settings,
      version: nextVersion,
      updated_by: currentProfile?.id || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "key"
    });

  if (error) {
    alert(error.message);
    return;
  }

  cacheSoccerRatingSettings(settings, nextVersion);
  renderSoccerRatingSettingsForm();

  if ($("soccer-settings-status")) {
    $("soccer-settings-status").textContent = `Shared soccer formula reset as v${nextVersion}.`;
  }

  renderMatches();
}
function soccerResultModifier(result) {
  const settings = soccerRatingSettings();

  if (result === "win") return settings.winModifier;
  if (result === "loss") return settings.lossModifier;
  return 0;
}

function soccerTeamUnitStrength(team, sportId, positions) {
  const playersByMemberPosition = new Map();

  (team?.match_team_players || []).forEach(player => {
    const position = normalizeSoccerPosition(player.formation_position);
    const memberId = cleanUuidValue(player.member_id);

    if (memberId && positions.includes(position)) {
      playersByMemberPosition.set(`${memberId}|${position}`, {
        ...player,
        member_id: memberId,
        formation_position: position
      });
    }
  });

  const matching = Array.from(playersByMemberPosition.values());

  if (!matching.length) return 5;

  const total = matching.reduce((sum, player) => {
    const position = normalizeSoccerPosition(player.formation_position);
    return sum + positionRatingForMember(player.member_id, sportId, position);
  }, 0);

  return Math.max(0.1, total / matching.length);
}

function soccerTeamAttackStrength(team, opponentTeam, sportId) {
  const teamAttack = soccerTeamUnitStrength(team, sportId, ["MID", "ATT"]);
  const opponentDefense = soccerTeamUnitStrength(opponentTeam, sportId, ["GK", "DEF"]);

  return Math.max(0.0001, teamAttack / Math.max(0.1, opponentDefense));
}

function soccerMatchDateValue(match) {
  return new Date(match?.start_time || match?.date || match?.match_date || match?.created_at || 0).getTime();
}

function soccerCompletedMatchesBefore(match) {
  const currentDate = soccerMatchDateValue(match);

  return (allMatches || [])
    .filter(row => {
      if (!row || row.id === match?.id) return false;
      if (!isSoccerMatch(row)) return false;
      if (!hasSubmittedScore(row)) return false;

      const { teamA, teamB } = getTwoMatchTeams(row);
      if (!teamA || !teamB) return false;

      const scoreA = Number(teamA.score || 0);
      const scoreB = Number(teamB.score || 0);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return false;

      const rowDate = soccerMatchDateValue(row);
      if (currentDate && rowDate && rowDate >= currentDate) return false;

      return true;
    })
    .sort((a, b) => soccerMatchDateValue(b) - soccerMatchDateValue(a));
}

function soccerRollingAverageTotalGoals(match) {
  const settings = soccerRatingSettings();
  const completed = soccerCompletedMatchesBefore(match);
  const minimum = Math.max(0, Number(settings.minimumMatchesRequired || 0));
  const windowSize = Math.max(1, Number(settings.rollingAverageWindow || 20));

  if (completed.length < minimum) {
    return Number(settings.defaultAverageTotalGoals || 15);
  }

  const totals = completed.slice(0, windowSize).map(row => {
    const { teamA, teamB } = getTwoMatchTeams(row);
    return Number(teamA?.score || 0) + Number(teamB?.score || 0);
  });

  if (!totals.length) return Number(settings.defaultAverageTotalGoals || 15);

  return totals.reduce((sum, total) => sum + total, 0) / totals.length;
}

function soccerExpectedGoalsForTeam(match, team, opponentTeam, sportId) {
  const avgTotalGoals = soccerRollingAverageTotalGoals(match);

  const teamAttackStrength = soccerTeamAttackStrength(team, opponentTeam, sportId);
  const opponentAttackStrength = soccerTeamAttackStrength(opponentTeam, team, sportId);
  const totalStrength = Math.max(0.0001, teamAttackStrength + opponentAttackStrength);

  return {
    expectedGoals: avgTotalGoals * teamAttackStrength / totalStrength,
    expectedGoalsAgainst: avgTotalGoals * opponentAttackStrength / totalStrength,
    avgTotalGoals,
    teamAttackStrength,
    opponentAttackStrength
  };
}

function uniqueSoccerTeamPlayers(team) {
  const uniquePlayers = new Map();

  (team?.match_team_players || []).forEach(player => {
    const memberId = cleanUuidValue(player.member_id);
    const position = normalizeSoccerPosition(player.formation_position);

    if (memberId && position) {
      uniquePlayers.set(`${memberId}|${position}`, {
        ...player,
        member_id: memberId,
        formation_position: position
      });
    }
  });

  return Array.from(uniquePlayers.values());
}

function soccerPositionGroupCount(players, position) {
  return players.filter(player =>
    normalizeSoccerPosition(player.formation_position) === position
  ).length;
}

function soccerRatingRowsForTeam(team, opponentTeam, sportId, goalsFor, goalsAgainst, result, match = null) {
  const settings = soccerRatingSettings();
  const expected = soccerExpectedGoalsForTeam(match, team, opponentTeam, sportId);

  const attackPerformance = Number(goalsFor || 0) - expected.expectedGoals;
  const defensePerformance = expected.expectedGoalsAgainst - Number(goalsAgainst || 0);
  const resultModifier = soccerResultModifier(result);

  const players = uniqueSoccerTeamPlayers(team);

  const attackCount = soccerPositionGroupCount(players, "ATT");
  const midfieldCount = soccerPositionGroupCount(players, "MID");
  const defenseCount = soccerPositionGroupCount(players, "DEF");
  const goalkeeperCount = soccerPositionGroupCount(players, "GK");

  return players
    .map(player => {
      const position = normalizeSoccerPosition(player.formation_position);
      let adjustment = resultModifier;

      if (position === "ATT") {
        adjustment += attackCount
          ? (attackPerformance * settings.attackConstant * settings.attAttackShare) / attackCount
          : 0;
      }

      if (position === "MID") {
        adjustment += midfieldCount
          ? (
              attackPerformance * settings.attackConstant * settings.midAttackShare +
              defensePerformance * settings.defenseConstant * settings.midDefenseShare
            ) / midfieldCount
          : 0;
      }

      if (position === "DEF") {
        adjustment += defenseCount
          ? (defensePerformance * settings.defenseConstant * settings.defDefenseShare) / defenseCount
          : 0;
      }

      if (position === "GK") {
        adjustment += goalkeeperCount
          ? (defensePerformance * settings.defenseConstant * settings.gkDefenseShare) / goalkeeperCount
          : 0;
      }

      adjustment = clampNumber(
        adjustment,
        -Math.abs(settings.maxLoss),
        Math.abs(settings.maxGain)
      );

      return {
        member_id: player.member_id,
        sport_id: sportId,
        position_name: position,
        adjustment,
        formula_meta: {
          expected_goals: Number(expected.expectedGoals.toFixed(3)),
          expected_goals_against: Number(expected.expectedGoalsAgainst.toFixed(3)),
          attack_performance: Number(attackPerformance.toFixed(3)),
          defense_performance: Number(defensePerformance.toFixed(3)),
          avg_total_goals: Number(expected.avgTotalGoals.toFixed(3))
        }
      };
    })
    .filter(Boolean);
}

function currentPositionRatingRow(memberId, sportId, positionName) {
  const cleanPosition = normalizeSoccerPosition(positionName);

  return (allPositionRatings || []).find(row =>
    row.member_id === memberId &&
    row.sport_id === sportId &&
    normalizeSoccerPosition(row.position_name) === cleanPosition
  ) || null;
}

async function applyPositionRatingDelta(memberId, sportId, positionName, delta, gamesDelta) {
  const cleanMemberId = cleanUuidValue(memberId);
  const cleanSportId = cleanUuidValue(sportId);
  const cleanPosition = normalizeSoccerPosition(positionName);

  if (!cleanMemberId || !cleanSportId || !cleanPosition) {
    console.warn("Skipping invalid position rating row:", { memberId, sportId, positionName });
    return {
      ok: true,
      skipped: true
    };
  }

  const existing = currentPositionRatingRow(cleanMemberId, cleanSportId, cleanPosition);
  const ratingBefore = Number(existing?.rating || positionRatingForMember(cleanMemberId, cleanSportId, cleanPosition) || 5);
  const currentGames = Number(existing?.games_played || 0);

  const ratingAfter = clampNumber(ratingBefore + Number(delta || 0), 1, 10);
  const nextGamesPlayed = Math.max(0, currentGames + Number(gamesDelta || 0));

  const { error } = await supabaseClient
    .from("member_sport_position_ratings")
    .upsert({
      member_id: cleanMemberId,
      sport_id: cleanSportId,
      position_name: cleanPosition,
      rating: Number(ratingAfter.toFixed(2)),
      games_played: nextGamesPlayed,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "member_id,sport_id,position_name"
    });

  if (error) {
    alert(error.message);
    return {
      ok: false
    };
  }

  await loadPositionRatings();

  return {
    ok: true,
    ratingBefore,
    ratingAfter
  };
}


async function setPositionRatingValue(memberId, sportId, positionName, ratingValue, gamesDelta) {
  const cleanMemberId = cleanUuidValue(memberId);
  const cleanSportId = cleanUuidValue(sportId);
  const cleanPosition = normalizeSoccerPosition(positionName);

  if (!cleanMemberId || !cleanSportId || !cleanPosition) {
    console.warn("Skipping invalid position rating rollback row:", { memberId, sportId, positionName });
    return true;
  }

  const existing = currentPositionRatingRow(cleanMemberId, cleanSportId, cleanPosition);
  const currentGames = Number(existing?.games_played || 0);
  const nextGamesPlayed = Math.max(0, currentGames + Number(gamesDelta || 0));
  const nextRating = clampNumber(Number(ratingValue || 5), 1, 10);

  const { error } = await supabaseClient
    .from("member_sport_position_ratings")
    .upsert({
      member_id: cleanMemberId,
      sport_id: cleanSportId,
      position_name: cleanPosition,
      rating: Number(nextRating.toFixed(2)),
      games_played: nextGamesPlayed,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "member_id,sport_id,position_name"
    });

  if (error) {
    alert(error.message);
    return false;
  }

  await loadPositionRatings();
  return true;
}

async function rollbackPreviousSoccerRatingAdjustments(matchId) {
  const { data, error } = await supabaseClient
    .from("match_position_rating_adjustments")
    .select("id,member_id,sport_id,position_name,adjustment,rating_before,rating_after")
    .eq("match_id", matchId);

  if (error) {
    alert(error.message);
    return false;
  }

  for (const row of data || []) {
    let ok = false;

    if (row.rating_before !== null && row.rating_before !== undefined) {
      ok = await setPositionRatingValue(
        row.member_id,
        row.sport_id,
        row.position_name,
        Number(row.rating_before),
        -1
      );
    } else {
      const result = await applyPositionRatingDelta(
        row.member_id,
        row.sport_id,
        row.position_name,
        -Number(row.adjustment || 0),
        -1
      );

      ok = Boolean(result?.ok);
    }

    if (!ok) return false;
  }

  if ((data || []).length) {
    const { error: deleteError } = await supabaseClient
      .from("match_position_rating_adjustments")
      .delete()
      .eq("match_id", matchId);

    if (deleteError) {
      alert(deleteError.message);
      return false;
    }
  }

  return true;
}


function dedupeSoccerRatingRows(rows) {
  const byKey = new Map();

  (rows || []).forEach(row => {
    const memberId = cleanUuidValue(row.member_id);
    const sportId = cleanUuidValue(row.sport_id);
    const position = normalizeSoccerPosition(row.position_name);

    if (!memberId || !sportId || !position) return;

    const key = `${memberId}|${sportId}`;

    // DB adjustment rows are unique per match + member + sport.
    // Keep only one position update per player per match to avoid duplicate-key errors.
    const nextAdjustment = Number(row.adjustment || 0);
    const current = byKey.get(key);

    if (!current || Math.abs(nextAdjustment) > Math.abs(Number(current.adjustment || 0))) {
      byKey.set(key, {
        member_id: memberId,
        sport_id: sportId,
        position_name: position,
        adjustment: clampNumber(nextAdjustment, -0.35, 0.35)
      });
    }
  });

  return Array.from(byKey.values());
}


async function saveMatchPositionRatingAdjustmentRow(row) {
  const cleanRow = {
    match_id: cleanUuidValue(row.match_id),
    member_id: cleanUuidValue(row.member_id),
    sport_id: cleanUuidValue(row.sport_id),
    position_name: normalizeSoccerPosition(row.position_name),
    adjustment: Number(row.adjustment || 0),
    rating_before: Number(row.rating_before || 0),
    rating_after: Number(row.rating_after || 0)
  };

  if (!cleanRow.match_id || !cleanRow.member_id || !cleanRow.sport_id || !cleanRow.position_name) {
    console.warn("Skipping invalid rating adjustment row:", row);
    return true;
  }

  const { error: insertError } = await supabaseClient
    .from("match_position_rating_adjustments")
    .insert(cleanRow);

  if (!insertError) return true;

  const duplicate =
    String(insertError.code || "") === "23505" ||
    String(insertError.message || "").toLowerCase().includes("duplicate key");

  if (!duplicate) {
    alert(insertError.message);
    return false;
  }

  const { error: updateError } = await supabaseClient
    .from("match_position_rating_adjustments")
    .update({
      position_name: cleanRow.position_name,
      adjustment: cleanRow.adjustment,
      rating_before: cleanRow.rating_before,
      rating_after: cleanRow.rating_after
    })
    .eq("match_id", cleanRow.match_id)
    .eq("member_id", cleanRow.member_id)
    .eq("sport_id", cleanRow.sport_id);

  if (updateError) {
    alert(updateError.message);
    return false;
  }

  return true;
}

async function saveSoccerPositionRatingAdjustments(match, scoreA, scoreB, resultA, resultB) {
  if (!isSoccerMatch(match)) return true;

  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) return true;

  await loadPositionRatings();

  const rolledBack = await rollbackPreviousSoccerRatingAdjustments(match.id);
  if (!rolledBack) return false;

  const rows = dedupeSoccerRatingRows([
    ...soccerRatingRowsForTeam(teamA, teamB, match.sport_id, scoreA, scoreB, resultA, match),
    ...soccerRatingRowsForTeam(teamB, teamA, match.sport_id, scoreB, scoreA, resultB, match)
  ]);

  if (!rows.length) return true;

  const adjustmentRows = [];

  for (const row of rows) {
    const result = await applyPositionRatingDelta(
      row.member_id,
      row.sport_id,
      row.position_name,
      Number(row.adjustment || 0),
      1
    );

    if (!result?.ok) return false;

    const cleanMatchId = cleanUuidValue(match.id);
    const cleanMemberId = cleanUuidValue(row.member_id);
    const cleanSportId = cleanUuidValue(row.sport_id);
    const cleanPosition = normalizeSoccerPosition(row.position_name);

    if (cleanMatchId && cleanMemberId && cleanSportId && cleanPosition && !result?.skipped) {
      adjustmentRows.push({
        match_id: cleanMatchId,
        member_id: cleanMemberId,
        sport_id: cleanSportId,
        position_name: cleanPosition,
        adjustment: Number(Number(row.adjustment || 0).toFixed(3)),
        rating_before: Number(Number(result.ratingBefore).toFixed(2)),
        rating_after: Number(Number(result.ratingAfter).toFixed(2))
      });
    }
  }

  const finalAdjustmentRows = Array.from(
    new Map(
      adjustmentRows.map(row => [
        `${row.match_id}|${row.member_id}|${row.sport_id}`,
        row
      ])
    ).values()
  );

  if (finalAdjustmentRows.length) {
    const cleanMatchId = cleanUuidValue(match.id);

    if (cleanMatchId) {
      const { error: deleteError } = await supabaseClient
        .from("match_position_rating_adjustments")
        .delete()
        .eq("match_id", cleanMatchId);

      if (deleteError) {
        console.warn("Could not clear previous rating adjustments before saving:", deleteError.message);
      }
    }

    for (const adjustmentRow of finalAdjustmentRows) {
      const saved = await saveMatchPositionRatingAdjustmentRow(adjustmentRow);

      if (!saved) return false;
    }
  }

  await loadPositionRatings();
  renderSportRatingManager();
  renderRankings();

  return true;
}


async function cleanupSimpleMatchGames(match) {
  if (isPadelMatch(match)) return true;

  const existingGames = matchSessionGames(match);
  const existingGameIds = existingGames.map(game => game.id).filter(Boolean);

  if (!existingGameIds.length) return true;

  const { error: entriesError } = await supabaseClient
    .from("match_score_entries")
    .delete()
    .in("game_id", existingGameIds);

  if (entriesError) {
    alert(entriesError.message);
    return false;
  }

  const { error: sessionsError } = await supabaseClient
    .from("match_game_sessions")
    .delete()
    .eq("match_id", match.id);

  if (sessionsError) {
    alert(sessionsError.message);
    return false;
  }

  const { error: gamesError } = await supabaseClient
    .from("match_games")
    .delete()
    .in("id", existingGameIds);

  if (gamesError) {
    alert(gamesError.message);
    return false;
  }

  return true;
}

async function finalizeCurrentMatchResult() {
  const scoreMatchId = cleanUuidValue(currentScoreMatchId);

  if (!scoreMatchId) {
    alert("No match selected.");
    return;
  }

  const match = allMatches.find(m => m.id === scoreMatchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canSubmitScore(match)) {
    alert("Result can only be finalized after the match is finished.");
    return;
  }

  const wasAlreadyLocked = isResultLocked(match);

  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) {
    alert("Assign teams before finalizing the result.");
    return;
  }

  const summary = $("score-summary")?.value.trim() || null;
  let scoreA = Number(teamA.score || 0);
  let scoreB = Number(teamB.score || 0);

  if (isPadelMatch(match)) {
    const savedGame = await savePadelGameOnly();

    if (!savedGame) return;

    scoreA = savedGame.score.teamA;
    scoreB = savedGame.score.teamB;
  } else {
    scoreA = Number($("score-team-a")?.value || 0);
    scoreB = Number($("score-team-b")?.value || 0);

    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
      alert("Scores must be whole numbers equal to or greater than 0.");
      return;
    }

    const winnerTeam = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "draw";

    const cleanedOldGames = await cleanupSimpleMatchGames(match);

    if (!cleanedOldGames) return;

    const { data: gameData, error: gameError } = await supabaseClient
      .from("match_games")
      .insert({
        sport_id: match.sport_id,
        league_id: match.league_id || null, // automatically inherited from the booking/match league
        title: match.title || "Game",
        status: "completed",
        team_a_name: teamA.name || "Team A",
        team_b_name: teamB.name || "Team B",
        team_a_score: scoreA,
        team_b_score: scoreB,
        winner_team: winnerTeam,
        created_by: currentProfile.id
      })
      .select("id")
      .single();

    if (gameError) {
      alert(gameError.message);
      return;
    }

    const gameId = gameData.id;

    const { error: sessionError } = await supabaseClient
      .from("match_game_sessions")
      .upsert({
        match_id: scoreMatchId,
        game_id: gameId
      }, {
        onConflict: "match_id,game_id"
      });

    if (sessionError) {
      alert(sessionError.message);
      return;
    }

    const { error: entryError } = await supabaseClient
      .from("match_score_entries")
      .insert({
        match_id: scoreMatchId,
        game_id: gameId,
        sport_id: match.sport_id,
        entry_type: "simple",
        game_number: 1,
        set_number: null,
        team_a_score: scoreA,
        team_b_score: scoreB,
        is_completed: true,
        notes: null
      });

    if (entryError) {
      alert(entryError.message);
      return;
    }
  }

  const resultA = scoreA > scoreB ? "win" : scoreA < scoreB ? "loss" : "draw";
  const resultB = scoreB > scoreA ? "win" : scoreB < scoreA ? "loss" : "draw";

  const { error: teamAError } = await supabaseClient
    .from("match_teams")
    .update({
      score: scoreA,
      result: resultA
    })
    .eq("id", teamA.id);

  if (teamAError) {
    alert(teamAError.message);
    return;
  }

  const { error: teamBError } = await supabaseClient
    .from("match_teams")
    .update({
      score: scoreB,
      result: resultB
    })
    .eq("id", teamB.id);

  if (teamBError) {
    alert(teamBError.message);
    return;
  }

  const { error: matchError } = await supabaseClient
    .from("matches")
    .update({
      status: "completed",
      score_status: "submitted",
      notes: summary
    })
    .eq("id", scoreMatchId);

  if (matchError) {
    alert(matchError.message);
    return;
  }

  const refreshedMatchForPoints = {
    ...match,
    status: "completed",
    score_status: "submitted",
    match_teams: (match.match_teams || []).map(team => {
      if (team.id === teamA.id) {
        return {
          ...team,
          score: scoreA,
          result: resultA
        };
      }

      if (team.id === teamB.id) {
        return {
          ...team,
          score: scoreB,
          result: resultB
        };
      }

      return team;
    })
  };

  const pointsSaved = await saveMatchMemberPoints(refreshedMatchForPoints);

  if (!pointsSaved) return;

  const ratingsSaved = await saveSoccerPositionRatingAdjustments(
    refreshedMatchForPoints,
    scoreA,
    scoreB,
    resultA,
    resultB
  );

  if (!ratingsSaved) return;

  alert(isSoccerMatch(refreshedMatchForPoints)
    ? "Match result finalized, points saved, and soccer position ratings updated."
    : isPadelMatch(refreshedMatchForPoints)
      ? "Match result finalized, points saved, and padel ratings updated."
      : "Match result finalized and points saved.");

  $("scoreModal")?.close();
  currentScoreMatchId = null;

  await loadMatches();
}

async function saveScore() {
  await finalizeCurrentMatchResult();
}

function commentSection(m) {
  return `
    <div class="comments">
      ${(m.comments || []).map(c => `<div class="comment">💬 ${escapeHtml(c)}</div>`).join("")}
    </div>
    <div class="comment-box">
      <input id="comment-${m.id}" placeholder="Add banter/comment...">
      <button class="small-btn" onclick="addComment('${m.id}')">Send</button>
    </div>
  `;
}

function activityCard(a, compact = false) {
  const status = a.status || (a.approvals?.length >= 2 ? "approved" : "pending");
  const verified = status === "approved";
  const rejected = status === "rejected";
  const durationMinutes = Number(a.duration_minutes ?? a.durationMinutes ?? 0);
  const memberName = a.members ? memberDisplayName(a.members) : (a.player || "Player");
  const sportName = a.sports?.name || a.sport || sportNameById(a.sport_id) || "Sport";
  const title = a.title || a.activity || "Activity";
  const points = Number(a.activity_points ?? a.points ?? 0);
  const proofLabel = a.proof_file_name || a.proof || "proof";
  const activityActions = compact ? [] : [
    canEditActivity(a)
      ? `<button class="small-btn" type="button" onclick="openEditActivity('${a.id}')">Edit</button>`
      : "",
    canDeleteActivity(a)
      ? `<button class="small-btn danger-text-btn" type="button" onclick="deleteActivity('${a.id}')">Delete</button>`
      : "",
    isCurrentUserAdmin() && !verified && !rejected
      ? `<button class="small-btn" type="button" onclick="reviewActivity('${a.id}', 'approved')">Approve</button>`
      : "",
    isCurrentUserAdmin() && !verified && !rejected
      ? `<button class="small-btn" type="button" onclick="reviewActivity('${a.id}', 'rejected')">Reject</button>`
      : ""
  ].filter(Boolean);
  const durationText = durationMinutes > 0
    ? ` - ${durationMinutes} min`
    : "";

  return `
    <article class="card">
      <div class="row">
        <div>
          <h3>${escapeHtml(memberName)} - ${escapeHtml(title)}</h3>
          <div class="meta">${escapeHtml(sportName)}${durationText} - Activity ${formatPointValue(points)} pts</div>
          <div class="meta">
            ${escapeHtml(fmtDate(a.activity_date || a.created_at))}
            ${a.start_time && a.end_time ? ` - ${escapeHtml(a.start_time)}-${escapeHtml(a.end_time)}` : ""}
          </div>
          ${a.notes ? `<div class="meta">${escapeHtml(a.notes)}</div>` : ""}
          ${a.proof_path ? `<button class="link-btn" type="button" onclick="openActivityProof('${a.id}')">Open ${escapeHtml(proofLabel)}</button>` : `<div class="meta">Proof: not attached</div>`}
          ${rejected && a.review_notes ? `<div class="meta danger-text">Rejected: ${escapeHtml(a.review_notes)}</div>` : ""}
        </div>
        <span class="pill ${verified ? "green" : rejected ? "red" : "gold"}">${escapeHtml(status)}</span>
      </div>
      ${activityActions.length ? `
        <div class="actions">
          ${activityActions.join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderActivities() {
  if (!$("activityList")) return;
  const loadedRows = (allMemberActivities || []).length ? allMemberActivities : state.activities;
  const rows = isCurrentUserAdmin()
    ? loadedRows
    : loadedRows.filter(activity =>
        !allMemberActivities.length ||
        cleanUuidValue(activity.member_id) === cleanUuidValue(currentProfile?.id)
      );

  $("activityList").innerHTML = rows.length
    ? rows.map(a => activityCard(a)).join("")
    : `<article class="card"><div class="hint">No activities logged yet.</div></article>`;
}

function approvedLoggedActivities() {
  return ((allRankingActivityRows || []).length ? allRankingActivityRows : allMemberActivities || [])
    .filter(activity => activity.status === "approved");
}

function rankingMemberForId(memberId, embeddedMember = null) {
  const cleanId = cleanUuidValue(memberId);

  return embeddedMember ||
    memberById(cleanId) ||
    (allMembers || []).find(member => cleanUuidValue(member.id) === cleanId) ||
    null;
}

function rankingMemberName(memberId, embeddedMember = null) {
  const member = rankingMemberForId(memberId, embeddedMember);

  return member ? memberDisplayName(member) : "Player";
}

function rankingMemberIsExternal(memberId, embeddedMember = null) {
  const member = rankingMemberForId(memberId, embeddedMember);

  return Boolean(member?.is_external);
}

async function loadRankingData() {
  if (!currentProfile || currentProfile.approval_status !== "approved") {
    allRankingPointRows = [];
    allRankingActivityRows = [];
    return;
  }

  const pointsResult = await supabaseClient
    .from("match_member_points")
    .select(`
      id,
      member_id,
      activity_points,
      score_points,
      base_points,
      consistency_bonus,
      total_points,
      member:members!match_member_points_member_id_fkey (
        id,
        first_name,
        last_name,
        display_name,
        email,
        is_external
      ),
      matches (
        id,
        sport_id,
        league_id,
        status,
        score_status,
        start_time,
        sports (
          id,
          name
        )
      )
    `);

  if (pointsResult.error) {
    console.warn("Could not load global ranking points. Falling back to visible matches:", pointsResult.error.message);
    allRankingPointRows = [];
  } else {
    allRankingPointRows = (pointsResult.data || [])
      .filter(row => row.matches && !isCancelledMatch(row.matches) && hasSubmittedScore(row.matches));
  }

  const activitiesResult = await supabaseClient
    .from("member_activities")
    .select(`
      id,
      member_id,
      sport_id,
      duration_minutes,
      activity_points,
      status,
      activity_date,
      created_at,
      members (
        id,
        first_name,
        last_name,
        display_name,
        email,
        is_external
      ),
      sports (
        id,
        name
      )
    `)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (activitiesResult.error) {
    console.warn("Could not load global ranking activities. Falling back to visible activities:", activitiesResult.error.message);
    allRankingActivityRows = [];
  } else {
    allRankingActivityRows = activitiesResult.data || [];
  }
}

function renderPendingActivities() {
  const box = $("pendingActivitiesList");
  if (!box) return;

  const pending = (allMemberActivities || [])
    .filter(activity => (activity.status || "pending") === "pending")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  box.innerHTML = pending.length
    ? pending.map(activity => activityCard(activity)).join("")
    : `<article class="card">No pending activities.</article>`;
}

function updateActivitySportOptions() {
  const select = $("activity-sport");
  if (!select) return;

  const current = select.value || "";
  select.innerHTML = `
    <option value="">Select sport</option>
    ${(allSports || []).map(sport => `
      <option value="${sport.id}">${escapeHtml(sport.name)}</option>
    `).join("")}
  `;

  if (current) select.value = current;
  updateActivityPointsPreview();
}

async function loadActivityFormOptions() {
  if (!currentProfile || currentProfile.approval_status !== "approved") return;

  if (!allSports.length) {
    const { data, error } = await supabaseClient
      .from("sports")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Could not load activity sports:", error.message);
      return;
    }

    allSports = data || [];
  }

  await loadActivitySportSettings();
  updateActivitySportOptions();
  renderActivitySettingsForm();
}

function activityDurationMinutesFromForm() {
  const date = $("activity-date")?.value || "";
  const start = readTimeParts("activity-start");
  const end = readTimeParts("activity-end");

  if (!date || !start || !end) return 0;

  const startMs = new Date(`${date}T${pad2(start.hour24)}:${pad2(start.minute)}`).getTime();
  const endMs = new Date(`${date}T${pad2(end.hour24)}:${pad2(end.minute)}`).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  return Math.round((endMs - startMs) / 60000);
}

function activityTimeValue(prefix) {
  const parts = readTimeParts(prefix);
  if (!parts) return "";

  return `${pad2(parts.hour24)}:${pad2(parts.minute)}`;
}

function setActivityTimeFromValue(prefix, value, fallbackHour = 18, fallbackMinute = 0) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    setTimeParts(prefix, fallbackHour, fallbackMinute);
    return;
  }

  setTimeParts(prefix, Number(match[1]), Number(match[2]));
}

function updateActivityPointsPreview() {
  const preview = $("activity-points-preview");
  if (!preview) return;

  const sportId = $("activity-sport")?.value || "";
  const minutes = activityDurationMinutesFromForm();
  const points = loggedActivityPointsForDurationMinutes(minutes, sportId);
  const setting = activitySettingForSport(sportId);

  preview.textContent = minutes > 0 && sportId
    ? `${minutes} min - rate ${Number(setting.rate || 0)} / 30 min - ${points.toFixed(2)} activity pts`
    : "Select sport and time to preview points.";
}

function activityProofPath(file) {
  const memberId = cleanUuidValue(currentProfile?.id) || "member";
  const ext = String(file?.name || "proof").split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";

  return `${memberId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

async function uploadActivityProof(file) {
  if (!file) throw new Error("Proof upload is required.");

  const path = activityProofPath(file);
  const { error } = await supabaseClient.storage
    .from(ACTIVITY_PROOF_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  return path;
}

async function openActivityProof(activityId) {
  const activity = (allMemberActivities || []).find(row => row.id === activityId);

  if (!activity?.proof_path) {
    alert("Proof not found.");
    return;
  }

  const { data, error } = await supabaseClient.storage
    .from(ACTIVITY_PROOF_BUCKET)
    .createSignedUrl(activity.proof_path, 600);

  if (error) {
    alert(error.message);
    return;
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function canEditActivity(activity) {
  if (!activity || !currentProfile) return false;
  if (isCurrentUserAdmin()) return true;

  return activity.status === "pending" &&
    cleanUuidValue(activity.member_id) === cleanUuidValue(currentProfile.id);
}

function canDeleteActivity(activity) {
  return canEditActivity(activity);
}

function setActivityFormMode(activity = null) {
  const form = $("activityForm");
  if (!form) return;

  const isEditing = Boolean(activity);
  editingActivityId = isEditing ? activity.id : null;

  const title = form.querySelector("h3");
  if (title) title.textContent = isEditing ? "Edit Activity" : "Log Activity";

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = isEditing ? "Save Activity" : "Submit for Approval";

  const proofInput = $("activity-proof-file");
  if (proofInput) proofInput.required = !isEditing;
}

function resetActivityFormForCreate() {
  const form = $("activityForm");
  if (form) form.reset();

  setActivityFormMode(null);

  if ($("activity-date")) {
    $("activity-date").value = new Date().toISOString().slice(0, 10);
  }

  setTimeParts("activity-start", 18, 0);
  setTimeParts("activity-end", 19, 0);
  updateActivityPointsPreview();
}

async function openEditActivity(activityId) {
  const activity = (allMemberActivities || []).find(row => row.id === activityId);

  if (!canEditActivity(activity)) {
    alert("You can only edit pending activities unless you are an admin.");
    return;
  }

  await loadActivityFormOptions();
  populateMatchTimeSelects();
  setActivityFormMode(activity);

  if ($("activity-sport")) $("activity-sport").value = cleanUuidValue(activity.sport_id);
  if ($("activity-title")) $("activity-title").value = activity.title || "";
  if ($("activity-date")) $("activity-date").value = activity.activity_date || "";
  if ($("activity-notes")) $("activity-notes").value = activity.notes || "";
  if ($("activity-proof-file")) $("activity-proof-file").value = "";

  setActivityTimeFromValue("activity-start", activity.start_time, 18, 0);
  setActivityTimeFromValue("activity-end", activity.end_time, 19, 0);
  updateActivityPointsPreview();

  $("activityModal")?.showModal();
}

async function loadMemberActivities() {
  if (!currentProfile || currentProfile.approval_status !== "approved") {
    allMemberActivities = [];
    renderActivities();
    renderPendingActivities();
    return [];
  }

  let query = supabaseClient
    .from("member_activities")
    .select(MEMBER_ACTIVITY_SELECT)
    .order("created_at", { ascending: false });

  if (!isCurrentUserAdmin()) {
    query = query.or(`member_id.eq.${currentProfile.id},status.eq.approved`);
  }

  let { data, error } = await query;

  if (error) {
    console.warn("Full activity load failed. Retrying without embedded member/sport rows:", error.message);

    let fallbackQuery = supabaseClient
      .from("member_activities")
      .select(`
        id,
        member_id,
        sport_id,
        title,
        activity_date,
        start_time,
        end_time,
        duration_minutes,
        activity_points,
        proof_path,
        proof_file_name,
        notes,
        status,
        review_notes,
        reviewed_by,
        reviewed_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (!isCurrentUserAdmin()) {
      fallbackQuery = fallbackQuery.or(`member_id.eq.${currentProfile.id},status.eq.approved`);
    }

    const fallback = await fallbackQuery;
    data = fallback.data;
    error = fallback.error;

    if (!error) {
      data = (data || []).map(activity => ({
        ...activity,
        members: memberById(activity.member_id),
        sports: (allSports || []).find(sport => sport.id === activity.sport_id) || null
      }));
    }
  }

  if (error) {
    console.warn("Could not load activities:", error.message);
    renderActivities();
    renderPendingActivities();
    if ($("activityList") && !(allMemberActivities || []).length) {
      $("activityList").innerHTML = `<article class="card"><div class="hint">Could not load activities: ${escapeHtml(error.message)}</div></article>`;
    }
    if ($("pendingActivitiesList") && !(allMemberActivities || []).length) {
      $("pendingActivitiesList").innerHTML = `<article class="card"><div class="hint">Could not load pending activities: ${escapeHtml(error.message)}</div></article>`;
    }
    return allMemberActivities || [];
  }

  allMemberActivities = data || [];
  await loadRankingData();
  renderStats();
  renderFeed();
  renderActivities();
  renderPendingActivities();
  renderRankings();
  return allMemberActivities;
}

async function submitActivityLog(form) {
  if (!currentProfile || currentProfile.approval_status !== "approved") {
    alert("Approved members only.");
    return;
  }

  const existingActivity = editingActivityId
    ? (allMemberActivities || []).find(row => row.id === editingActivityId)
    : null;
  const isEditing = Boolean(existingActivity);

  if (editingActivityId && !canEditActivity(existingActivity)) {
    alert("You can only edit pending activities unless you are an admin.");
    return;
  }

  const fd = new FormData(form);
  const sportId = cleanUuidValue(fd.get("sport_id"));
  const title = String(fd.get("title") || "").trim();
  const activityDate = String(fd.get("activity_date") || "");
  const startTime = activityTimeValue("activity-start");
  const endTime = activityTimeValue("activity-end");
  const notes = String(fd.get("notes") || "").trim();
  const proofFile = fd.get("proof_file");
  const durationMinutes = activityDurationMinutesFromForm();

  if (!sportId) {
    alert("Select a sport.");
    return;
  }

  if (!title) {
    alert("Activity title is required.");
    return;
  }

  if (!activityDate || !startTime || !endTime || durationMinutes <= 0) {
    alert("Enter a valid activity date, start time, and end time.");
    return;
  }

  if (new Date(`${activityDate}T00:00`).getTime() > Date.now()) {
    alert("Activity date cannot be in the future.");
    return;
  }

  const hasNewProof = proofFile instanceof File && Boolean(proofFile.name);

  if (!isEditing && !hasNewProof) {
    alert("Proof upload is required.");
    return;
  }

  let proofPath = existingActivity?.proof_path || "";
  let proofFileName = existingActivity?.proof_file_name || "";
  let uploadedReplacementPath = "";

  if (hasNewProof) {
    try {
      uploadedReplacementPath = await uploadActivityProof(proofFile);
      proofPath = uploadedReplacementPath;
      proofFileName = proofFile.name;
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  const points = loggedActivityPointsForDurationMinutes(durationMinutes, sportId);

  const payload = {
    sport_id: sportId,
    title,
    activity_date: activityDate,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
    activity_points: points,
    proof_path: proofPath,
    proof_file_name: proofFileName,
    notes: notes || null
  };

  let result;

  if (isEditing) {
    result = await supabaseClient
      .from("member_activities")
      .update(payload)
      .eq("id", existingActivity.id);
  } else {
    result = await supabaseClient
      .from("member_activities")
      .insert({
        ...payload,
        member_id: currentProfile.id,
        status: "pending"
      });
  }

  if (result.error) {
    if (uploadedReplacementPath) {
      await supabaseClient.storage
        .from(ACTIVITY_PROOF_BUCKET)
        .remove([uploadedReplacementPath]);
    }

    alert(result.error.message);
    return;
  }

  if (isEditing && uploadedReplacementPath && existingActivity.proof_path) {
    await supabaseClient.storage
      .from(ACTIVITY_PROOF_BUCKET)
      .remove([existingActivity.proof_path]);
  }

  form.reset();
  setActivityFormMode(null);
  $("activityModal")?.close();

  if (isEditing) {
    alert("Activity updated.");
    await loadMemberActivities();
    return;
  }

  const localActivity = {
    ...payload,
    member_id: currentProfile.id,
    status: "pending",
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    members: currentProfile,
    sports: (allSports || []).find(sport => sport.id === sportId) || null
  };

  if (localActivity?.id) {
    allMemberActivities = [
      localActivity,
      ...(allMemberActivities || []).filter(activity => activity.id !== localActivity.id)
    ];
    renderStats();
    renderFeed();
    renderActivities();
    renderPendingActivities();
    renderRankings();
  }
  alert("Activity submitted for admin approval.");
  await loadMemberActivities();
}

async function reviewActivity(activityId, decision) {
  if (!isCurrentUserAdmin()) {
    alert("Admin access required.");
    return;
  }

  const status = decision === "approved" ? "approved" : "rejected";
  const reviewNotes = status === "rejected"
    ? prompt("Reason for rejection:", "Proof does not verify the activity.")
    : "";

  if (reviewNotes === null) return;

  const { error } = await supabaseClient
    .from("member_activities")
    .update({
      status,
      review_notes: reviewNotes || null,
      reviewed_by: currentProfile.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", activityId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadMemberActivities();
  alert(`Activity ${status}.`);
}

async function deleteActivity(activityId) {
  const activity = (allMemberActivities || []).find(row => row.id === activityId);

  if (!canDeleteActivity(activity)) {
    alert("You can only delete pending activities unless you are an admin.");
    return;
  }

  const ok = confirm("Delete this activity log? This cannot be undone.");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("member_activities")
    .delete()
    .eq("id", activityId);

  if (error) {
    alert(error.message);
    return;
  }

  if (activity.proof_path) {
    const { error: storageError } = await supabaseClient.storage
      .from(ACTIVITY_PROOF_BUCKET)
      .remove([activity.proof_path]);

    if (storageError) {
      console.warn("Could not delete activity proof:", storageError.message);
    }
  }

  allMemberActivities = (allMemberActivities || []).filter(row => row.id !== activityId);
  renderStats();
  renderFeed();
  renderActivities();
  renderPendingActivities();
  renderRankings();
  alert("Activity deleted.");
  await loadMemberActivities();
}


function updateRankingFilters() {
  const sportSelect = $("rank-sport-filter");
  const leagueSelect = $("rank-league-filter");

  if (sportSelect) {
    const current = sportSelect.value || "all";

    sportSelect.innerHTML = `
      <option value="all">All sports</option>
      ${(allSports || []).map(sport => `
        <option value="${sport.id}">${escapeHtml(sport.name)}</option>
      `).join("")}
    `;

    sportSelect.value = Array.from(sportSelect.options).some(option => option.value === current)
      ? current
      : "all";
  }

  if (leagueSelect) {
    const current = leagueSelect.value || "all";
    const selectedSport = sportSelect?.value || "all";

    const leagues = (allLeagues || []).filter(league =>
      selectedSport === "all" || league.sport_id === selectedSport
    );

    leagueSelect.innerHTML = `
      <option value="all">All leagues</option>
      <option value="none">Friendly / no league</option>
      ${leagues.map(league => `
        <option value="${league.id}">${escapeHtml(league.name)}</option>
      `).join("")}
    `;

    leagueSelect.value = Array.from(leagueSelect.options).some(option => option.value === current)
      ? current
      : "all";
  }
}

function rankingFilteredMatches() {
  const sportId = $("rank-sport-filter")?.value || "all";
  const leagueId = $("rank-league-filter")?.value || "all";

  return (allMatches || []).filter(match => {
    if (match.score_status !== "submitted" && match.status !== "completed") return false;
    if (sportId !== "all" && match.sport_id !== sportId) return false;

    if (leagueId === "none" && match.league_id) return false;
    if (leagueId !== "all" && leagueId !== "none" && match.league_id !== leagueId) return false;

    return true;
  });
}

function filteredRankingPointRows() {
  const sportId = $("rank-sport-filter")?.value || "all";
  const leagueId = $("rank-league-filter")?.value || "all";

  return (allRankingPointRows || []).filter(point => {
    const match = point.matches || {};

    if (sportId !== "all" && match.sport_id !== sportId) return false;
    if (leagueId === "none" && match.league_id) return false;
    if (leagueId !== "all" && leagueId !== "none" && match.league_id !== leagueId) return false;

    return true;
  });
}


function memberById(memberId) {
  const cleanId = cleanUuidValue(memberId);

  if (!cleanId) return null;

  const fromMembers = (allMembers || []).find(member => cleanUuidValue(member.id) === cleanId);
  if (fromMembers) return fromMembers;

  const fromRatings = (allPositionRatings || []).find(row => cleanUuidValue(row.member_id) === cleanId)?.members;
  if (fromRatings) return fromRatings;

  const fromActivities = (allMemberActivities || []).find(row => cleanUuidValue(row.member_id) === cleanId)?.members;
  if (fromActivities) return fromActivities;

  const fromRankingActivities = (allRankingActivityRows || []).find(row => cleanUuidValue(row.member_id) === cleanId)?.members;
  if (fromRankingActivities) return fromRankingActivities;

  const fromRankingPoints = (allRankingPointRows || []).find(row => cleanUuidValue(row.member_id) === cleanId)?.member;
  if (fromRankingPoints) return fromRankingPoints;

  for (const match of (allMatches || [])) {
    const pointMember = (match.match_member_points || []).find(point => cleanUuidValue(point.member_id) === cleanId)?.member;
    if (pointMember) return pointMember;

    for (const team of (match.match_teams || [])) {
      const playerMember = (team.match_team_players || []).find(player => cleanUuidValue(player.member_id) === cleanId)?.member;
      if (playerMember) return playerMember;
    }

    const invitationMemberRow = (match.match_invitations || []).find(inv => cleanUuidValue(inv.member_id) === cleanId);
    if (invitationMemberRow) return invitationMember(invitationMemberRow);
  }

  return null;
}

function playerProfileStats(memberId) {
  const cleanId = cleanUuidValue(memberId);
  const stats = {
    totalPoints: 0,
    basePoints: 0,
    bonusPoints: 0,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    sports: new Map(),
    leagues: new Map(),
    sportDetails: new Map(),
    activities: [],
    activityMinutes: 0,
    loggedActivityPoints: 0,
    recentMatches: []
  };

  if (!cleanId) return stats;

  (allMatches || [])
    .filter(match => !isCancelledMatch(match) && hasSubmittedScore(match))
    .forEach(match => {
      const point = (match.match_member_points || []).find(row => cleanUuidValue(row.member_id) === cleanId);

      if (!point) return;

      const teamInfo = teamResultForMember(match, cleanId);
      const result = teamInfo.result || "participated";
      const total = pointTotalPoints(point);
      const activity = Number(point.activity_points ?? point.base_points ?? 0);
      const score = Number(point.score_points ?? point.consistency_bonus ?? 0);

      stats.totalPoints += total;
      stats.basePoints += activity;
      stats.bonusPoints += score;
      stats.matches += 1;

      if (result === "win") stats.wins += 1;
      else if (result === "draw") stats.draws += 1;
      else if (result === "loss") stats.losses += 1;

      if (match.sports?.name) {
        const current = stats.sports.get(match.sports.name) || 0;
        stats.sports.set(match.sports.name, current + 1);
      }

      const sportId = cleanUuidValue(match.sport_id);
      const sportName = match.sports?.name || sportNameById(match.sport_id) || "Sport";
      const sportKey = sportId || sportName.toLowerCase();
      const sportDetail = stats.sportDetails.get(sportKey) || {
        sportId,
        sport: sportName,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        totalPoints: 0,
        activityPoints: 0,
        scorePoints: 0,
        activityMinutes: 0,
        approvedActivities: 0,
        pendingActivities: 0,
        leagues: new Map()
      };

      sportDetail.games += 1;
      sportDetail.totalPoints += total;
      sportDetail.activityPoints += activity;
      sportDetail.scorePoints += score;

      if (result === "win") sportDetail.wins += 1;
      else if (result === "draw") sportDetail.draws += 1;
      else if (result === "loss") sportDetail.losses += 1;

      if (match.league_id) {
        const leagueName = leagueNameForId(match.league_id) || "League";
        const current = stats.leagues.get(leagueName) || 0;
        stats.leagues.set(leagueName, current + 1);

        const sportLeagueCurrent = sportDetail.leagues.get(leagueName) || 0;
        sportDetail.leagues.set(leagueName, sportLeagueCurrent + 1);
      }

      stats.sportDetails.set(sportKey, sportDetail);

      stats.recentMatches.push({
        match,
        result,
        points: total,
        activityPoints: activity,
        scorePoints: score,
        score: scoreTextForMatch(match)
      });
    });

  stats.recentMatches.sort((a, b) =>
    new Date(b.match.start_time) - new Date(a.match.start_time)
  );

  (allMemberActivities || [])
    .filter(activity => cleanUuidValue(activity.member_id) === cleanId)
    .forEach(activity => {
      const approved = activity.status === "approved";
      const points = Number(activity.activity_points || 0);
      const minutes = Number(activity.duration_minutes || 0);
      const sportId = cleanUuidValue(activity.sport_id);
      const sportName = activity.sports?.name || sportNameById(activity.sport_id) || "Sport";
      const sportKey = sportId || sportName.toLowerCase();
      const sportDetail = stats.sportDetails.get(sportKey) || {
        sportId,
        sport: sportName,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        totalPoints: 0,
        activityPoints: 0,
        scorePoints: 0,
        activityMinutes: 0,
        approvedActivities: 0,
        pendingActivities: 0,
        leagues: new Map()
      };

      stats.activities.push(activity);

      if (approved) {
        stats.totalPoints += points;
        stats.basePoints += points;
        stats.activityMinutes += minutes;
        stats.loggedActivityPoints += points;

        sportDetail.totalPoints += points;
        sportDetail.activityPoints += points;
        sportDetail.activityMinutes += minutes;
        sportDetail.approvedActivities += 1;
      } else if (activity.status === "pending") {
        sportDetail.pendingActivities += 1;
      }

      stats.sportDetails.set(sportKey, sportDetail);
    });

  return stats;
}

function playerProfilePositionRatings(memberId) {
  const cleanId = cleanUuidValue(memberId);

  if (!cleanId) return [];

  return (allPositionRatings || [])
    .filter(row => cleanUuidValue(row.member_id) === cleanId)
    .map(row => ({
      sportId: cleanUuidValue(row.sport_id),
      sport: row.sports?.name || sportNameById(row.sport_id) || "Sport",
      position: normalizeSoccerPosition(row.position_name) || row.position_name || "-",
      rating: Number(row.rating || 0),
      gamesPlayed: Number(row.games_played || 0)
    }))
    .filter(row => row.rating > 0)
    .sort((a, b) =>
      a.sport.localeCompare(b.sport) ||
      soccerPositionSortValue(a.position) - soccerPositionSortValue(b.position)
    );
}

function playerProfilePadelRatings(memberId) {
  const cleanId = cleanUuidValue(memberId);

  if (!cleanId) return [];

  return (allSportProfiles || [])
    .filter(profile => cleanUuidValue(profile.member_id) === cleanId)
    .map(profile => {
      const sport = String(profile.sports?.name || sportNameById(profile.sport_id) || "Sport");

      return {
        sportId: cleanUuidValue(profile.sport_id),
        sport,
        position: "OVR",
        rating: memberSportRating(cleanId, profile.sport_id),
        gamesPlayed: Number(profile.games_played || 0)
      };
    })
    .filter(row => row.rating > 0 && row.sport.toLowerCase().includes("padel"))
    .sort((a, b) => a.sport.localeCompare(b.sport));
}

function playerProfileRatings(memberId) {
  return [
    ...playerProfilePadelRatings(memberId),
    ...playerProfilePositionRatings(memberId)
  ];
}

function playerProfileSportKey(sportId, sportName) {
  return cleanUuidValue(sportId) || String(sportName || "Sport").toLowerCase();
}

function playerProfileSportSummaries(stats, ratings) {
  const summaries = new Map();

  (stats.sportDetails || new Map()).forEach(detail => {
    const key = playerProfileSportKey(detail.sportId, detail.sport);
    summaries.set(key, {
      ...detail,
      ratings: []
    });
  });

  (ratings || []).forEach(rating => {
    const key = playerProfileSportKey(rating.sportId, rating.sport);
    const summary = summaries.get(key) || {
      sportId: cleanUuidValue(rating.sportId),
      sport: rating.sport || "Sport",
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      totalPoints: 0,
      activityPoints: 0,
      scorePoints: 0,
      activityMinutes: 0,
      approvedActivities: 0,
      pendingActivities: 0,
      leagues: new Map(),
      ratings: []
    };

    summary.ratings.push(rating);
    summary.games = Math.max(summary.games, Number(rating.gamesPlayed || 0));
    summaries.set(key, summary);
  });

  return Array.from(summaries.values())
    .sort((a, b) => {
      const aActivities = Number(a.approvedActivities || 0) + Number(a.pendingActivities || 0);
      const bActivities = Number(b.approvedActivities || 0) + Number(b.pendingActivities || 0);

      return (b.games - a.games) || (bActivities - aActivities) || a.sport.localeCompare(b.sport);
    });
}

function formatProfileDurationMinutes(minutes) {
  const totalMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

function playerProfileSportCountLabel(summary) {
  const games = Number(summary.games || 0);
  const activities = Number(summary.approvedActivities || 0) + Number(summary.pendingActivities || 0);
  const labels = [];

  if (games) labels.push(`${games} game${games === 1 ? "" : "s"}`);
  if (activities) labels.push(`${activities} activit${activities === 1 ? "y" : "ies"}`);

  return labels.join(" / ") || "No games";
}

function playerProfileSportStatsHtml(summary) {
  const approvedActivities = Number(summary.approvedActivities || 0);
  const pendingActivities = Number(summary.pendingActivities || 0);
  const hasActivities = approvedActivities + pendingActivities > 0;

  if (hasActivities) {
    return `
      <div class="profile-line"><span>Active time</span><b>${formatProfileDurationMinutes(summary.activityMinutes)}</b></div>
      <div class="profile-line"><span>Points</span><b>${formatPointValue(summary.activityPoints)} pts</b></div>
      <div class="profile-line"><span>Approved</span><b>${approvedActivities}</b></div>
      <div class="profile-line"><span>Pending</span><b>${pendingActivities}</b></div>
    `;
  }

  return `
    <div class="profile-line"><span>Record</span><b>${summary.wins}W ${summary.draws}D ${summary.losses}L</b></div>
    <div class="profile-line"><span>Points</span><b>${formatPointValue(summary.totalPoints)} total</b></div>
    <div class="profile-line"><span>Activity</span><b>${formatPointValue(summary.activityPoints)} pts</b></div>
    <div class="profile-line"><span>Score</span><b>${formatPointValue(summary.scorePoints)} pts</b></div>
  `;
}

function sportNameById(sportId) {
  return (allSports || []).find(sport => sport.id === sportId)?.name || "";
}

function playerProfileRatingChanges(memberId) {
  const cleanId = cleanUuidValue(memberId);
  const rows = [];

  if (!cleanId) return rows;

  (allMatches || []).forEach(match => {
    if (isCancelledMatch(match)) return;

    (match.match_position_rating_adjustments || []).forEach(row => {
      if (cleanUuidValue(row.member_id) !== cleanId) return;

      const before = Number(row.rating_before ?? 0);
      const after = Number(row.rating_after ?? 0);

      rows.push({
        match,
        position: normalizeSoccerPosition(row.position_name) || row.position_name || "-",
        before,
        after,
        delta: after - before,
        createdAt: row.created_at || match.start_time
      });
    });
  });

  return rows.sort((a, b) =>
    new Date(b.match.start_time || b.createdAt) - new Date(a.match.start_time || a.createdAt)
  );
}

function renderPlayerProfile(memberId) {
  const cleanId = cleanUuidValue(memberId);
  const member = memberById(cleanId);
  const box = $("playerProfileContent");

  if (!box) return;

  if (!cleanId || !member) {
    box.innerHTML = `<article class="card">Player not found.</article>`;
    return;
  }

  const stats = playerProfileStats(cleanId);
  const ratings = playerProfileRatings(cleanId);
  const sportSummaries = playerProfileSportSummaries(stats, ratings);
  const changes = playerProfileRatingChanges(cleanId).slice(0, 10);

  if ($("player-profile-title")) {
    $("player-profile-title").textContent = memberDisplayName(member);
  }

  if ($("player-profile-subtitle")) {
    $("player-profile-subtitle").textContent = member.is_external
      ? "External player profile."
      : "Member profile.";
  }

  box.innerHTML = `
    <div class="player-profile-stats">
      <div class="profile-stat-box">
        <span>Total points</span>
        <strong>${formatPointValue(stats.totalPoints)}</strong>
      </div>

      <div class="profile-stat-box">
        <span>Activity points</span>
        <strong>${formatPointValue(stats.basePoints)}</strong>
      </div>

      <div class="profile-stat-box">
        <span>Score points</span>
        <strong>${formatPointValue(stats.bonusPoints)}</strong>
      </div>

      <div class="profile-stat-box">
        <span>Played</span>
        <strong>${stats.matches}</strong>
      </div>
    </div>

    <div class="player-profile-grid profile-sport-grid">
      ${
        sportSummaries.length
          ? sportSummaries.map(summary => {
              const leagueText = Array.from((summary.leagues || new Map()).entries())
                .map(([name, count]) => `${name} (${count})`)
                .join(", ") || "-";

              return `
                <article class="card profile-section-card profile-sport-card">
                  <div class="profile-sport-head">
                    <h4>${escapeHtml(summary.sport)}</h4>
                    <span>${playerProfileSportCountLabel(summary)}</span>
                  </div>

                  <div class="profile-sport-stat-grid">
                    ${playerProfileSportStatsHtml(summary)}
                  </div>

                  <div class="profile-line"><span>Leagues</span><b>${escapeHtml(leagueText)}</b></div>

                  ${
                    summary.ratings.length
                      ? `<div class="profile-rating-grid">
                          ${summary.ratings.map(row => `
                            <div class="profile-rating-pill">
                              <span>${escapeHtml(row.position)}</span>
                              <strong>${row.rating.toFixed(1)}</strong>
                              <em>${row.gamesPlayed} game${row.gamesPlayed === 1 ? "" : "s"}</em>
                            </div>
                          `).join("")}
                        </div>`
                      : `<div class="hint">No ratings yet.</div>`
                  }
                </article>
              `;
            }).join("")
          : `<article class="card profile-section-card"><div class="hint">No sport stats yet.</div></article>`
      }
    </div>

    <article class="card profile-section-card">
      <h4>Recent matches</h4>
      ${
        stats.recentMatches.length
          ? stats.recentMatches.slice(0, 8).map(row => `
            <div class="profile-match-row">
              <div>
                <strong>${escapeHtml(row.match.title || "Match")}</strong>
                <span>${escapeHtml(fmtDate(row.match.start_time))} • ${escapeHtml(row.match.sports?.name || "-")}</span>
                <em>${escapeHtml(row.score || "-")}</em>
                <em>Activity ${Number(row.activityPoints || 0)} • Score ${Number(row.scorePoints || 0)}</em>
              </div>
              <b class="${row.result}">${escapeHtml(row.result)} • +${Number(row.points || 0)} pts</b>
            </div>
          `).join("")
          : `<div class="hint">No finalized matches yet.</div>`
      }
    </article>

    <article class="card profile-section-card">
      <h4>Activities</h4>

      <div class="profile-sport-stat-grid">
        <div class="profile-line"><span>Approved</span><b>${stats.activities.filter(activity => activity.status === "approved").length}</b></div>
        <div class="profile-line"><span>Pending</span><b>${stats.activities.filter(activity => (activity.status || "pending") === "pending").length}</b></div>
        <div class="profile-line"><span>Hours</span><b>${(Number(stats.activityMinutes || 0) / 60).toFixed(1)}</b></div>
        <div class="profile-line"><span>Activity points</span><b>${formatPointValue(stats.loggedActivityPoints)}</b></div>
      </div>

      ${
        stats.activities.length
          ? stats.activities
              .sort((a, b) => new Date(b.activity_date || b.created_at) - new Date(a.activity_date || a.created_at))
              .slice(0, 8)
              .map(activity => `
                <div class="profile-match-row">
                  <div>
                    <strong>${escapeHtml(activity.title || "Activity")}</strong>
                    <span>${escapeHtml(fmtDate(activity.activity_date || activity.created_at))} - ${escapeHtml(activity.sports?.name || sportNameById(activity.sport_id) || "-")}</span>
                    <em>${Number(activity.duration_minutes || 0)} min - ${formatPointValue(activity.activity_points)} pts</em>
                  </div>
                  <b class="${activity.status === "approved" ? "win" : activity.status === "rejected" ? "loss" : "draw"}">${escapeHtml(activity.status || "pending")}</b>
                </div>
              `).join("")
          : `<div class="hint">No logged activities yet.</div>`
      }
    </article>

    <article class="card profile-section-card">
      <h4>Recent rating changes</h4>
      ${
        changes.length
          ? changes.map(row => {
              const deltaText = `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(2)}`;

              return `
                <div class="profile-match-row">
                  <div>
                    <strong>${escapeHtml(row.match.title || "Match")}</strong>
                    <span>${escapeHtml(fmtDate(row.match.start_time))} • ${escapeHtml(row.position)}</span>
                  </div>
                  <b class="${row.delta >= 0 ? "win" : "loss"}">
                    ${row.before.toFixed(2)} → ${row.after.toFixed(2)} (${deltaText})
                  </b>
                </div>
              `;
            }).join("")
          : `<div class="hint">No rating changes yet.</div>`
      }
    </article>
  `;
}

function openPlayerProfile(memberId) {
  renderPlayerProfile(memberId);
  $("playerProfileModal")?.showModal();
}

function playerLinkHtml(memberId, name, extraClass = "") {
  return `
    <button class="player-link ${escapeHtml(extraClass)}" type="button" onclick="openPlayerProfile('${memberId}')">
      ${escapeHtml(name)}
    </button>
  `;
}

function rankingRows() {
  const playerType = $("rank-player-type-filter")?.value || "all";
  const sportFilter = $("rank-sport-filter")?.value || "all";
  const leagueFilter = $("rank-league-filter")?.value || "all";
  const table = new Map();

  if ((allRankingPointRows || []).length) {
    filteredRankingPointRows().forEach(point => {
      const match = point.matches || {};
      const memberId = cleanUuidValue(point.member_id);
      const isExternal = rankingMemberIsExternal(memberId, point.member);

      if (!memberId) return;
      if (playerType === "members" && isExternal) return;
      if (playerType === "external" && !isExternal) return;

      const current = table.get(memberId) || {
        memberId,
        member: rankingMemberForId(memberId, point.member),
        name: rankingMemberName(memberId, point.member),
        isExternal,
        totalPoints: 0,
        basePoints: 0,
        bonusPoints: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        sports: new Set(),
        leagues: new Set()
      };

      current.totalPoints += pointTotalPoints(point);
      current.basePoints += Number(point.activity_points ?? point.base_points ?? 0);
      current.bonusPoints += Number(point.score_points ?? point.consistency_bonus ?? 0);
      current.matches += 1;

      if (match.sports?.name) current.sports.add(match.sports.name);
      if (match.league_id) current.leagues.add(match.league_id);

      table.set(memberId, current);
    });
  } else {
    rankingFilteredMatches().forEach(match => {
      (match.match_member_points || []).forEach(point => {
        const memberId = cleanUuidValue(point.member_id);
        const member = rankingMemberForId(memberId, point.member);
        const isExternal = rankingMemberIsExternal(memberId, point.member);

        if (!memberId) return;

        if (playerType === "members" && isExternal) return;
        if (playerType === "external" && !isExternal) return;

        const current = table.get(memberId) || {
          memberId,
          member,
          name: rankingMemberName(memberId, point.member),
          isExternal,
          totalPoints: 0,
          basePoints: 0,
          bonusPoints: 0,
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          sports: new Set(),
          leagues: new Set()
        };

        const teamInfo = teamResultForMember(match, memberId);
        const result = teamInfo.result || "participated";

        current.totalPoints += pointTotalPoints(point);
        current.basePoints += Number(point.activity_points ?? point.base_points ?? 0);
        current.bonusPoints += Number(point.score_points ?? point.consistency_bonus ?? 0);
        current.matches += 1;

        if (result === "win") current.wins += 1;
        else if (result === "draw") current.draws += 1;
        else if (result === "loss") current.losses += 1;

        if (match.sports?.name) current.sports.add(match.sports.name);
        if (match.league_id) current.leagues.add(match.league_id);

        table.set(memberId, current);
      });
    });
  }

  if (leagueFilter === "all") {
    approvedLoggedActivities().forEach(activity => {
      const memberId = cleanUuidValue(activity.member_id);
      const member = rankingMemberForId(memberId, activity.members);
      const isExternal = rankingMemberIsExternal(memberId, activity.members);

      if (!memberId) return;
      if (sportFilter !== "all" && activity.sport_id !== sportFilter) return;
      if (playerType === "members" && isExternal) return;
      if (playerType === "external" && !isExternal) return;

      const current = table.get(memberId) || {
        memberId,
        member,
        name: rankingMemberName(memberId, activity.members),
        isExternal,
        totalPoints: 0,
        basePoints: 0,
        bonusPoints: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        sports: new Set(),
        leagues: new Set()
      };

      current.totalPoints += Number(activity.activity_points || 0);
      current.basePoints += Number(activity.activity_points || 0);
      if (activity.sports?.name) current.sports.add(activity.sports.name);

      table.set(memberId, current);
    });
  }

  return Array.from(table.values()).sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    b.wins - a.wins ||
    b.matches - a.matches ||
    a.name.localeCompare(b.name)
  );
}

function rankingSummary(rows) {
  const totalPlayers = rows.length;
  const totalPoints = rows.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0);
  const totalMatches = (allRankingPointRows || []).length
    ? new Set(filteredRankingPointRows().map(row => row.matches?.id).filter(Boolean)).size
    : rankingFilteredMatches().length;

  return `
    <article class="card ranking-summary-card">
      <div>
        <div class="meta">Ranked players</div>
        <strong>${totalPlayers}</strong>
      </div>

      <div>
        <div class="meta">Finalized matches</div>
        <strong>${totalMatches}</strong>
      </div>

      <div>
        <div class="meta">Total points</div>
        <strong>${formatPointValue(totalPoints)}</strong>
      </div>
    </article>
  `;
}

function renderRankings() {
  if (!$("rankingList")) return;

  updateRankingFilters();

  const rows = rankingRows();

  if (!rows.length) {
    $("rankingList").innerHTML = `
      ${rankingSummary(rows)}
      ${renderPositionRankings()}
      <article class="card">No finalized points for this filter yet.</article>
    `;
    return;
  }

  $("rankingList").innerHTML = `
    ${rankingSummary(rows)}

    <article class="card rankings-table-card">
      <div class="rankings-table-head">
        <span>#</span>
        <span>Player</span>
        <span>Total</span>
        <span>Act</span>
        <span>Score</span>
        <span>Played</span>
        <span>W-D-L</span>
      </div>

      ${rows.map((row, index) => `
        <div class="rankings-table-row">
          <span class="rank-number-mini">${index + 1}</span>

          <span>
            ${playerLinkHtml(row.memberId, row.name)}
            ${row.isExternal ? `<em>External</em>` : ""}
          </span>

          <strong>${formatPointValue(row.totalPoints)}</strong>

          <span>${formatPointValue(row.basePoints)}</span>

          <span>${formatPointValue(row.bonusPoints)}</span>

          <span>${Number(row.matches || 0)}</span>

          <span>${row.wins}-${row.draws}-${row.losses}</span>
        </div>
      `).join("")}
    </article>
  `;
}

function addComment(matchId) {
  const input = $(`comment-${matchId}`);
  const text = input?.value.trim();

  if (!text) return;

  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;

  m.comments = m.comments || [];
  m.comments.push(text);

  saveData();
  render();
}

async function testConnection() {
  const { data, error } = await supabaseClient
    .from("sports")
    .select("*");

  console.log("URL:", SUPABASE_URL);
  console.log("SPORTS DATA:", data);
  console.log("SPORTS ERROR:", error);
}

async function signUp(email, password) {
  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://alimuhieddine.github.io/aba-aub-bros-arena/"
    }
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("already registered") ||
      message.includes("already exists") ||
      message.includes("user already registered") ||
      message.includes("email")
    ) {
      alert("This email is already registered. Please log in or use a different email.");
      return;
    }

    alert(error.message);
    return;
  }

  /*
    Supabase sometimes returns a user object without a session
    when the email already exists or confirmation is required.
  */
  if (data?.user && data.user.identities && data.user.identities.length === 0) {
    alert("This email is already registered. Please log in or use a different email.");
    return;
  }

  alert("Check your email and confirm your account.");
  await refreshAuthUI();
}

async function login(email, password) {
  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  const { error } =
    await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alert(error.message);
    return;
  }

  await refreshAuthUI();
}

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem("aba_user_access");
  currentProfile = null;
  clearProfileFields();
  await refreshAuthUI();
}

function profileFieldIds() {
  return [
    "profile-first-name",
    "profile-last-name",
    "profile-display-name",
    "profile-birth-date",
    "profile-phone"
  ];
}

function phoneNotificationsSupported() {
  return Boolean(
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function setNotificationStatus(text) {
  const status = $("notification-status");
  if (status) status.textContent = text;
}

function setNotificationButtons(enabled, subscribed = false) {
  const enableBtn = $("enable-notifications-btn");
  const disableBtn = $("disable-notifications-btn");
  const testBtn = $("test-notifications-btn");

  if (enableBtn) {
    enableBtn.disabled = !enabled || subscribed;
    enableBtn.textContent = subscribed ? "Notifications Enabled" : "Enable Notifications";
  }

  if (disableBtn) {
    disableBtn.disabled = !enabled || !subscribed;
  }

  if (testBtn) {
    testBtn.disabled = !enabled || !subscribed;
  }
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

async function loadPushNotificationSettings() {
  const { data, error } = await supabaseClient
    .from("app_settings")
    .select("value")
    .eq("key", PUSH_NOTIFICATIONS_APP_SETTING_KEY)
    .maybeSingle();

  if (error) throw error;
  return data?.value || {};
}

async function pushServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("sw.js");
  await navigator.serviceWorker.ready;
  registration.update?.();
  return registration;
}

function bindPushDebugMessages() {
  if (!("serviceWorker" in navigator) || bindPushDebugMessages.bound) return;

  bindPushDebugMessages.bound = true;

  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type !== "aba_push_received") return;

    console.info("ABA push received by service worker:", event.data);
    showPushToast(event.data.title || "ABA notification", event.data.body || "");

    if (event.data.notificationType === "match_invite") {
      setNotificationStatus(`Match invite push received: ${event.data.title}`);
    }
  });
}

function showPushToast(title, body = "") {
  const toast = $("push-toast");
  if (!toast) return;

  clearTimeout(showPushToast.hideTimer);

  toast.innerHTML = `
    ${escapeHtml(title)}
    ${body ? `<span>${escapeHtml(body)}</span>` : ""}
  `;
  toast.hidden = false;

  showPushToast.hideTimer = setTimeout(() => {
    toast.hidden = true;
  }, 7000);
}

async function currentPushSubscription() {
  if (!phoneNotificationsSupported()) return null;

  const registration = await pushServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

async function savePushSubscription(subscription) {
  if (!currentProfile?.id || !subscription) return;

  const json = subscription.toJSON();
  const { error } = await supabaseClient
    .from("member_push_subscriptions")
    .upsert({
      member_id: currentProfile.id,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh || null,
      auth: json.keys?.auth || null,
      subscription: json,
      user_agent: navigator.userAgent || null,
      enabled: true,
      last_seen_at: new Date().toISOString()
    }, { onConflict: "endpoint" });

  if (error) throw error;
}

async function refreshNotificationUI() {
  if (!currentProfile) {
    setNotificationStatus("Login to manage phone notifications.");
    setNotificationButtons(false, false);
    return;
  }

  if (currentProfile.approval_status !== "approved") {
    setNotificationStatus("Notifications are available after profile approval.");
    setNotificationButtons(false, false);
    return;
  }

  if (!phoneNotificationsSupported()) {
    setNotificationStatus("Phone notifications need HTTPS and a browser that supports web push.");
    setNotificationButtons(false, false);
    return;
  }

  if (Notification.permission === "denied") {
    setNotificationStatus("Notifications are blocked in this browser. Enable them in browser settings.");
    setNotificationButtons(false, false);
    return;
  }

  try {
    const settings = await loadPushNotificationSettings();
    const publicKey = settings.public_key || settings.vapid_public_key || "";

    if (!settings.enabled || !publicKey) {
      setNotificationStatus("Phone notifications are not configured yet.");
      setNotificationButtons(false, false);
      return;
    }

    const subscription = await currentPushSubscription();

    if (subscription) {
      await savePushSubscription(subscription);
      setNotificationStatus("This device is subscribed to phone notifications.");
      setNotificationButtons(true, true);
    } else {
      setNotificationStatus("Enable notifications on this device to receive match and activity alerts.");
      setNotificationButtons(true, false);
    }
  } catch (error) {
    console.warn("Could not refresh notification status:", error.message);
    setNotificationStatus("Notification setup needs the Supabase notification SQL migration.");
    setNotificationButtons(true, false);
  }
}

async function enablePhoneNotifications() {
  if (!currentProfile || currentProfile.approval_status !== "approved") {
    alert("Approved members only.");
    return;
  }

  if (!phoneNotificationsSupported()) {
    alert("Phone notifications need HTTPS and a browser that supports web push.");
    await refreshNotificationUI();
    return;
  }

  try {
    const settings = await loadPushNotificationSettings();
    const publicKey = settings.public_key || settings.vapid_public_key || "";

    if (!publicKey) {
      alert("Notification public key is not configured yet. Run the Supabase notification SQL and add your VAPID public key.");
      return;
    }

    if (!settings.enabled) {
      alert("Phone notifications are currently disabled in app settings.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      await refreshNotificationUI();
      return;
    }

    const registration = await pushServiceWorkerRegistration();
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await savePushSubscription(subscription);
    setNotificationStatus("This device is subscribed to phone notifications.");
    setNotificationButtons(true, true);
  } catch (error) {
    console.warn("Could not enable notifications:", error);
    alert(error.message || "Could not enable notifications.");
    await refreshNotificationUI();
  }
}

async function disablePhoneNotifications() {
  try {
    const subscription = await currentPushSubscription();

    if (subscription) {
      await supabaseClient
        .from("member_push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint);

      await subscription.unsubscribe();
    }

    setNotificationStatus("Notifications are disabled on this device.");
    setNotificationButtons(true, false);
  } catch (error) {
    console.warn("Could not disable notifications:", error);
    alert(error.message || "Could not disable notifications.");
    await refreshNotificationUI();
  }
}

async function sendMatchInviteNotifications(matchId, recipientMemberIds = []) {
  const safeMatchId = cleanUuidValue(matchId);
  const recipients = Array.from(new Set((recipientMemberIds || [])
    .map(id => cleanUuidValue(id))
    .filter(Boolean)))
    .filter(id => id !== currentProfile?.id);

  if (!safeMatchId || !recipients.length) {
    return { sent: 0, failed: 0, skipped: true };
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke("send-push", {
      body: {
        type: "match_invite",
        match_id: safeMatchId,
        recipient_member_ids: recipients
      }
    });

    if (error) throw error;
    console.info("Match invite notification result:", data);
    return data || { sent: 0, failed: 0 };
  } catch (error) {
    console.warn("Match invite notifications were not sent:", error.message || error);
    return {
      sent: 0,
      failed: recipients.length,
      error: error.message || "Could not send match invite notifications."
    };
  }
}

async function sendCreatorMatchNotification(matchId, type, extra = {}) {
  const safeMatchId = cleanUuidValue(matchId);

  if (!safeMatchId || !type) return { sent: 0, failed: 0, skipped: true };

  try {
    const { data, error } = await supabaseClient.functions.invoke("send-push", {
      body: {
        type,
        match_id: safeMatchId,
        ...extra
      }
    });

    if (error) throw error;
    console.info("Creator notification result:", data);
    return data || { sent: 0, failed: 0 };
  } catch (error) {
    console.warn("Creator notification was not sent:", error.message || error);
    return {
      sent: 0,
      failed: 1,
      error: error.message || "Could not send creator notification."
    };
  }
}

async function sendMatchLifecycleNotification(matchId, type) {
  const safeMatchId = cleanUuidValue(matchId);

  if (!safeMatchId || !type) return { sent: 0, failed: 0, skipped: true };

  try {
    const { data, error } = await supabaseClient.functions.invoke("send-push", {
      body: {
        type,
        match_id: safeMatchId
      }
    });

    if (error) throw error;
    console.info("Match lifecycle notification result:", data);
    return data || { sent: 0, failed: 0 };
  } catch (error) {
    console.warn("Match lifecycle notification was not sent:", error.message || error);
    return {
      sent: 0,
      failed: 1,
      error: error.message || "Could not send match lifecycle notification."
    };
  }
}

async function sendTestNotification() {
  if (!currentProfile || currentProfile.approval_status !== "approved") {
    alert("Approved members only.");
    return;
  }

  try {
    const subscription = await currentPushSubscription();

    if (!subscription) {
      alert("This device is not subscribed yet. Enable notifications first.");
      await refreshNotificationUI();
      return;
    }

    await savePushSubscription(subscription);

    const { data, error } = await supabaseClient.functions.invoke("send-push", {
      body: { type: "test_push" }
    });

    if (error) throw error;

    console.info("Test notification result:", data);

    if (Number(data?.sent || 0) > 0) {
      alert(`Test notification sent to ${data.sent} device${data.sent === 1 ? "" : "s"}.`);
    } else {
      alert("Test notification reached the sender, but no enabled subscription was found.");
    }
  } catch (error) {
    console.warn("Test notification failed:", error);
    alert(error.message || "Test notification failed.");
  }
}

function clearProfileFields() {
  profileFieldIds().forEach(id => {
    const el = $(id);
    if (el) {
      el.value = "";
      el.disabled = true;
    }
  });

  if ($("profile-status")) {
    $("profile-status").textContent = "Login to load your profile.";
  }

  setNotificationStatus("Login to manage phone notifications.");
  setNotificationButtons(false, false);

  const btn = $("profile-action-btn");
  if (btn) {
    btn.textContent = "Edit Profile";
    btn.style.display = "inline-flex";
  }

  profileIsEditing = false;
}

function setProfileEditing(isEditing) {
  profileIsEditing = isEditing;

  profileFieldIds().forEach(id => {
    const el = $(id);
    if (el) el.disabled = !isEditing;
  });

  const btn = $("profile-action-btn");
  if (btn) {
    btn.textContent = isEditing ? "Save Profile" : "Edit Profile";
    btn.style.display = "inline-flex";
  }
}


async function loadMyProfile() {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError || !user) {
    currentProfile = null;
    clearProfileFields();
    return;
  }

  const { data, error } = await supabaseClient
    .from("members")
    .select("id,first_name,last_name,display_name,birth_date,phone,email,is_external,is_active,role,approval_status,registration_status,auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  console.log("MY PROFILE FROM SUPABASE:", data);
  console.log("PROFILE LOAD ERROR:", error);

  if (error) {
    alert(error.message);
    return;
  }

  currentProfile = data;
  cacheProfileAccess(data);

  if (!data) {
    clearProfileFields();
    setProfileStatusText(null);
    setProfileEditing(true);
    applyAccessUI();
    refreshNotificationUI();
    return;
  }

  $("profile-first-name").value = data.first_name || "";
  $("profile-last-name").value = data.last_name || "";
  $("profile-display-name").value = data.display_name || "";
  $("profile-birth-date").value = data.birth_date || "";
  $("profile-phone").value = data.phone || "";

  setProfileStatusText(data);
  setProfileEditing(false);

  if (data.approval_status === "rejected" || data.approval_status === "suspended") {
    profileFieldIds().forEach(id => {
      const el = $(id);
      if (el) el.disabled = true;
    });

    const btn = $("profile-action-btn");
    if (btn) btn.style.display = "none";
  }

  applyAccessUI();
  refreshNotificationUI();
}

async function saveProfile() {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError || !user) {
    alert("Please login first.");
    return;
  }

  const firstName = $("profile-first-name").value.trim();
  const displayName = $("profile-display-name").value.trim();

  if (!firstName || !displayName) {
    alert("First Name and Display Name are required.");
    return;
  }

  const profileFields = {
    first_name: firstName,
    last_name: $("profile-last-name").value.trim(),
    display_name: displayName,
    birth_date: $("profile-birth-date").value || null,
    phone: $("profile-phone").value.trim()
  };

  const result = currentProfile?.id
    ? await supabaseClient
      .from("members")
      .update(profileFields)
      .eq("id", currentProfile.id)
      .eq("auth_user_id", user.id)
      .select("id")
      .single()
    : await supabaseClient
      .from("members")
      .insert({
        auth_user_id: user.id,
        email: user.email,
        ...profileFields,
        is_external: false,
        is_active: true,
        role: "member",
        approval_status: "pending",
        registration_status: "pending"
      })
      .select("id")
      .single();

  const { error } = result;

  if (error) {
    alert(error.message);
    return;
  }

  alert("Profile saved.");
  await loadMyProfile();
}

async function refreshAuthUI() {
  const { data: { session } } =
    await supabaseClient.auth.getSession();

  if (session) {
    $("auth-logged-out").style.display = "none";
    $("auth-logged-in").style.display = "flex";
    $("current-user").textContent = session.user.email;

    // Show Account tab after login
    document.querySelectorAll(".auth-only").forEach(el => {
      el.style.display = "";
    });

    // Show cached Admin tab immediately, then verify with Supabase profile.
    // This is only a UI hint. Supabase RLS still protects the data.
    try {
      const cachedAccess = JSON.parse(
        localStorage.getItem("aba_user_access") || "null"
      );

      if (
        cachedAccess &&
        cachedAccess.role === "admin" &&
        cachedAccess.approval_status === "approved"
      ) {
        document.querySelectorAll(".admin-only").forEach(el => {
          el.style.display = "";
        });
      }
    } catch {
      localStorage.removeItem("aba_user_access");
    }

    await loadMyProfile();
    applyAccessUI();
if (currentProfile?.approval_status === "approved") {
  await loadLeagues();
  await loadSportProfiles();
  await loadPositionRatings();
  await loadSoccerRatingSettings();
  await loadActivitySportSettings();
  await loadMatches();
  await loadMemberActivities();
  restoreActiveTab();
}
    if (isCurrentUserAdmin()) {
      await loadSportsOptions();
await loadMatchFormOptions();
await loadPendingMembers();
await loadMemberActivities();
await loadActivitySportSettings(true);
renderActivitySettingsForm();
await loadVenues();
await loadMatches();
    }

    return;
  }

  // Logged out state
  $("auth-logged-out").style.display = "flex";
  $("auth-logged-in").style.display = "none";

  // Hide Account tab when logged out
  document.querySelectorAll(".auth-only").forEach(el => {
    el.style.display = "none";
  });

  // Hide Admin tab when logged out
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = "none";
  });

  localStorage.removeItem("aba_user_access");
  localStorage.removeItem(ACTIVE_TAB_KEY);
  currentProfile = null;
  clearProfileFields();

  setActiveTab("dashboard", false);
}


const ACTIVE_TAB_KEY = "aba_active_tab";

function setActiveTab(viewId, persist = true) {
  const targetView = $(viewId);
  const targetTab = document.querySelector(`[data-view="${viewId}"]`);

  if (!targetView || !targetTab) return;

  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));

  targetTab.classList.add("active");
  targetView.classList.add("active-view");

  if (persist) {
    localStorage.setItem(ACTIVE_TAB_KEY, viewId);
  }

  if (viewId === "account") {
    loadMyProfile();
  }

  if (viewId === "leagues") {
    loadLeagues();
  }

  if (viewId === "rankings") {
    updateRankingFilters();
    renderRankings();
  }

  if (viewId === "activities") {
    loadMemberActivities();
  }

  if (viewId === "admin") {
    loadSportsOptions();
    loadMatchFormOptions().then(() => {
      renderActivitySettingsForm();
    });
    loadPendingMembers();
    loadMemberActivities();
    loadVenues();
    loadMatches();
    loadActivitySportSettings(true).then(() => {
      renderActivitySettingsForm();
    });
    loadSoccerRatingSettings(true).then(renderSoccerRatingSettingsForm);
  }
}

function restoreActiveTab() {
  if (openDeepLinkedMatch()) return;

  const saved = localStorage.getItem(ACTIVE_TAB_KEY) || "dashboard";
  const view = $(saved) ? saved : "dashboard";

  setActiveTab(view, false);
}

function bindEvents() {
  populateMatchTimeSelects();
  setDefaultMatchDateTimes();

  $("match-sport")?.addEventListener("change", updateMatchVenueOptions);
  $("match-type")?.addEventListener("change", updateMatchLeagueOptions);

  [
    "match-start-date",
    "match-start-hour",
    "match-start-minute",
    "match-start-ampm"
  ].forEach(id => {
    $(id)?.addEventListener("change", () => {
      if (id === "match-start-date") syncMatchEndDateToStartDate();
      updateDefaultVoteDeadlineFromStart(false);
    });
  });

  [
    "match-vote-deadline-date",
    "match-vote-deadline-hour",
    "match-vote-deadline-minute",
    "match-vote-deadline-ampm"
  ].forEach(id => {
    $(id)?.addEventListener("change", () => {
      voteDeadlineManuallyEdited = true;
    });
  });

  $("rank-sport-filter")?.addEventListener("change", () => {
    updateRankingFilters();
    renderRankings();
  });

  $("rank-league-filter")?.addEventListener("change", renderRankings);
  $("rank-player-type-filter")?.addEventListener("change", renderRankings);

  $("match-filter-search")?.addEventListener("input", renderMatches);
  $("match-filter-sport")?.addEventListener("change", () => {
    updateMatchFilterOptions();
    renderMatches();
  });
  $("match-filter-league")?.addEventListener("change", renderMatches);
  $("match-filter-status")?.addEventListener("change", renderMatches);
  $("match-filter-my-status")?.addEventListener("change", renderMatches);
  $("match-filter-reset")?.addEventListener("click", resetMatchFilters);

  $("rating-sport-filter")?.addEventListener("change", renderSportRatingManager);
  $("rating-history-position-filter")?.addEventListener("change", renderRatingHistoryModal);
  $("rating-history-sort")?.addEventListener("change", renderRatingHistoryModal);
  document.querySelectorAll(".tab").forEach(btn =>
    btn.addEventListener("click", () => {
      setActiveTab(btn.dataset.view);
    })
  );

  window.addEventListener("hashchange", openDeepLinkedMatch);

 document.querySelectorAll("[data-open]").forEach(btn =>
  btn.addEventListener("click", async () => {
    if (btn.dataset.open === "leagueModal") {
      editingLeagueId = null;

      const form = $("leagueForm");
      if (form) {
        form.reset();

        const title = form.querySelector("h3");
        if (title) title.textContent = "Create League";

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = "Create League";
      }

      await loadSportsOptions();
      await loadLeagues();
      updateLeagueSportOptions();
    }

    if (btn.dataset.open === "matchModal") {
      editingMatchId = null;

      const form = $("matchForm");
      if (form) {
        form.reset();

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = "Create Match";
      }

      setDefaultMatchDateTimes();

      await loadMatchFormOptions();
    }

    if (btn.dataset.open === "activityModal") {
      await loadActivityFormOptions();
      populateMatchTimeSelects();
      resetActivityFormForCreate();
    }

    const modal = $(btn.dataset.open);
    if (modal) modal.showModal();
  })
);
  if ($("leagueForm")) {
    $("leagueForm").addEventListener("submit", async e => {
      const fd = new FormData(e.target);

      if (!currentProfile || currentProfile.approval_status !== "approved") {
        alert("Approved members only.");
        return;
      }

      const payload = {
        name: fd.get("name"),
        sport_id: fd.get("sport_id"),
        format: fd.get("format") || null,
        status: fd.get("status") || "active",
        start_date: fd.get("start_date") || null,
        end_date: fd.get("end_date") || null
      };

      let result;

      if (editingLeagueId) {
        result = await supabaseClient
          .from("leagues")
          .update(payload)
          .eq("id", editingLeagueId);
      } else {
        result = await supabaseClient
          .from("leagues")
          .insert({
            ...payload,
            created_by: currentProfile.id
          });
      }

      if (result.error) {
        alert(result.error.message);
        return;
      }

      alert(editingLeagueId ? "League updated." : "League created.");

      editingLeagueId = null;
      e.target.reset();

      const title = e.target.querySelector("h3");
      if (title) title.textContent = "Create League";

      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = "Create League";

      $("leagueModal")?.close();

      await loadLeagues();
      await loadMatchFormOptions();
    });
  }


 if ($("matchForm")) {
  $("matchForm").addEventListener("submit", async e => {
    const fd = new FormData(e.target);

    if (!currentProfile || currentProfile.approval_status !== "approved") {
      alert("Approved members only.");
      return;
    }

    const requiredPlayers = Number(fd.get("required_players") || 0);
    const maxPlayers = requiredPlayers;
    const matchDateTimes = getMatchDateTimeValues();

    if (!matchDateTimes) return;

    if (!requiredPlayers || requiredPlayers < 2) {
      alert("Required players must be at least 2.");
      return;
    }

    if (requiredPlayers % 2 !== 0) {
      alert("Required players must be an even number so both teams have the same number of players.");
      return;
    }

    if (fd.get("match_type") === "league" && !fd.get("league_id")) {
      alert("Please select a league for league matches.");
      return;
    }

    if (fd.get("match_type") === "league" && !leagueSportMatchesSelection(fd.get("league_id"), fd.get("sport_id"))) {
      alert("The selected league does not match the selected sport.");
      return;
    }

    const selectedInviteIds = getSelectedInviteMemberIds();

    if (!editingMatchId && selectedInviteIds.length + 1 > maxPlayers) {
      const ok = confirm("You invited more players than the required spots. Players can still vote, but only the first players to vote IN will take the spots. Continue?");
      if (!ok) return;
    }

    const match = {
      sport_id: fd.get("sport_id"),
      venue_id: fd.get("venue_id"),
      league_id: fd.get("match_type") === "league" ? (fd.get("league_id") || null) : null,
      created_by: currentProfile.id,
      title: fd.get("title"),
      match_type: fd.get("match_type"),
      start_time: matchDateTimes.startTime.toISOString(),
      end_time: matchDateTimes.endTime.toISOString(),
      voting_deadline_at: matchDateTimes.votingDeadline.toISOString(),
      status: "open_for_votes",
      max_players: maxPlayers,
      required_players: requiredPlayers || maxPlayers,
      visibility: "invited",
      team_status: "not_assigned",
      score_status: "pending",
      notes: fd.get("notes") || null
    };

    let result;
    const activeEditingMatchId = cleanUuidValue(editingMatchId);

    if (activeEditingMatchId) {
      result = await supabaseClient
        .from("matches")
        .update(match)
        .eq("id", activeEditingMatchId)
        .select();
    } else {
      result = await supabaseClient
        .from("matches")
        .insert(match)
        .select();
    }

    if (result.error) {
      alert(result.error.message);
      return;
    }

    const matchId = activeEditingMatchId || result.data?.[0]?.id;

    const invitationResult = await saveMatchInvitations(
      matchId,
      selectedInviteIds,
      Boolean(activeEditingMatchId)
    );

    if (!invitationResult.ok) return;

    const notificationResult = await sendMatchInviteNotifications(matchId, invitationResult.notifiedMemberIds);

    if (notificationResult?.error) {
      alert(`Match saved, but phone notifications failed: ${notificationResult.error}`);
    }

    alert(activeEditingMatchId ? "Match updated." : "Match created.");

    editingMatchId = null;
    e.target.reset();
    setDefaultMatchDateTimes();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "Create Match";

    await loadMatches();

    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));

    const matchesTab = document.querySelector('[data-view="matches"]');
    const matchesView = $("matches");

    if (matchesTab) matchesTab.classList.add("active");
    if (matchesView) matchesView.classList.add("active-view");
  });
}

  if ($("activityForm")) {
    $("activityForm").addEventListener("submit", async e => {
      e.preventDefault();
      await submitActivityLog(e.target);
    });
  }

  [
    "activity-sport",
    "activity-date",
    "activity-start-hour",
    "activity-start-minute",
    "activity-start-ampm",
    "activity-end-hour",
    "activity-end-minute",
    "activity-end-ampm"
  ].forEach(id => {
    $(id)?.addEventListener("change", updateActivityPointsPreview);
    $(id)?.addEventListener("input", updateActivityPointsPreview);
  });

  $("profile-action-btn")?.addEventListener("click", async () => {
    if (profileIsEditing) {
      await saveProfile();
    } else {
      setProfileEditing(true);
    }
  });

  $("enable-notifications-btn")?.addEventListener("click", enablePhoneNotifications);
  $("disable-notifications-btn")?.addEventListener("click", disablePhoneNotifications);
  $("test-notifications-btn")?.addEventListener("click", sendTestNotification);

  $("signup-btn")?.addEventListener("click", () => {
    signUp($("auth-email").value.trim(), $("auth-password").value);
  });

  $("login-btn")?.addEventListener("click", () => {
    login($("auth-email").value.trim(), $("auth-password").value);
  });

  $("logout-btn")?.addEventListener("click", logout);

  $("save-soccer-settings-btn")?.addEventListener("click", saveSoccerRatingSettings);
  $("reset-soccer-settings-btn")?.addEventListener("click", resetSoccerRatingSettings);
  $("save-activity-settings-btn")?.addEventListener("click", saveActivitySportSettings);

  $("recalc-all-points-btn")?.addEventListener("click", recalculateAllFinalizedPoints);
  $("recalc-all-soccer-ratings-btn")?.addEventListener("click", recalculateAllSoccerRatings);
  $("recalc-all-finalized-btn")?.addEventListener("click", recalculateAllFinalizedMatches);

  $("add-venue-btn")?.addEventListener("click", saveVenue);

  $("cancel-venue-edit-btn")?.addEventListener("click", clearVenueForm);

  $("add-selected-external-btn")?.addEventListener("click", addSelectedExternalPlayers);

  $("create-external-player-btn")?.addEventListener("click", createExternalPlayerProfile);

  $("suggest-teams-btn")?.addEventListener("click", applySuggestedTeams);

  $("team-a-captain")?.addEventListener("change", updateTeamBalanceStatus);
  $("team-b-captain")?.addEventListener("change", updateTeamBalanceStatus);

  $("save-teams-btn")?.addEventListener("click", saveTeams);

  $("save-game-btn")?.addEventListener("click", saveCurrentGameAndStayOpen);

  $("delete-game-btn")?.addEventListener("click", deleteSelectedGameFromResults);

  $("save-score-btn")?.addEventListener("click", saveScore);

  document.querySelectorAll("#padel-score-section input").forEach(input => {
    input.addEventListener("input", () => {
      const match = input.id.match(/^padel-set-(\d+)-[ab]$/);
      if (match) autoCompletePadelSet(Number(match[1]));
      updatePadelScorePreview();
    });

    input.addEventListener("change", () => {
      const match = input.id.match(/^padel-set-(\d+)-[ab]$/);
      if (match) autoCompletePadelSet(Number(match[1]));
      updatePadelScorePreview();
    });
  });

  $("padel-game-mode")?.addEventListener("change", () => {
    setPadelGameModeUI();

    if ($("padel-game-mode")?.value === "new") {
      clearPadelSetInputs();

      if ($("padel-game-title")) {
        const match = allMatches.find(m => m.id === currentScoreMatchId);
        const nextGameNumber = match ? matchSessionGames(match).length + 1 : 1;
        $("padel-game-title").value = `Game ${nextGameNumber}`;
      }
    }
  });

  $("padel-pending-game")?.addEventListener("change", e => {
    loadPendingGameScoreIntoForm(e.target.value);
  });

  supabaseClient.auth.onAuthStateChange(() => {
    refreshAuthUI();
  });
}

bindEvents();
bindPushDebugMessages();
render();
testConnection();
refreshAuthUI();

setInterval(() => {
  if (currentProfile?.approval_status === "approved" && allMatches?.length) {
    renderMatches();
  }
}, 60000);
