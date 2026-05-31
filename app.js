const SUPABASE_URL = "https://welleqrjtlullhbdhive.supabase.co";
const SUPABASE_KEY = "sb_publishable_e_Pu1JLmyXBKJnMvR5guXQ_GzvFcdK-";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "aba_phase1_data";

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
    { id: crypto.randomUUID(), player: "Ali", sport: "Padel", activity: "90 min padel session", proof: "Smartwatch screenshot", points: 15, approvals: ["Committee 1", "Committee 2"], createdAt: Date.now() - 86400000 },
    { id: crypto.randomUUID(), player: "Hammoudi", sport: "Gym", activity: "Leg day + cardio", proof: "Gym photo", points: 10, approvals: ["Committee 1"], createdAt: Date.now() - 3600000 }
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

  const rows = sportIds.map(sportId => ({
    venue_id: venueId,
    sport_id: sportId
  }));

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
    .select(`
      id,
      name,
      address,
      google_maps_url,
      image_url,
      is_active,
      created_at,
      venue_sports (
        sport_id,
        sports (
          id,
          name
        )
      )
    `)
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
    const sportNames = (venue.venue_sports || [])
      .map(vs => vs.sports?.name)
      .filter(Boolean);

    const sportIds = (venue.venue_sports || [])
      .map(vs => vs.sport_id)
      .filter(Boolean);

   

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
          ${
            venue.google_maps_url
              ? `<div class="meta"><a href="${escapeHtml(venue.google_maps_url)}" target="_blank">Open Map</a></div>`
              : ""
          }
        </div>

        <div class="venue-side">
          <span class="pill ${venue.is_active ? "green" : "red"}">
            ${venue.is_active ? "Active" : "Inactive"}
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

  const sportIds = (venue.venue_sports || [])
    .map(vs => vs.sport_id)
    .filter(Boolean);

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

  const venue = {
    name,
    address,
    google_maps_url: googleMapsUrl,
    image_url: imageUrl
  };

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

function cacheProfileAccess(profile) {
  if (!profile) {
    localStorage.removeItem("aba_user_access");
    return;
  }

  localStorage.setItem(
    "aba_user_access",
    JSON.stringify({
      role: profile.role,
      approval_status: profile.approval_status
    })
  );
}
async function loadPendingMembers() {
  if (!isCurrentUserAdmin()) return;

  const { data, error } = await supabaseClient
    .from("members")
    .select("id,first_name,last_name,display_name,email,phone,birth_date,approval_status,created_at")
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
    .update({
      approval_status: decision,
      registration_status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: currentProfile.id
    })
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
let editingMatchId = null;
let allMembers = [];
let allExternalMembers = [];
let currentExternalMatchId = null;
let currentTeamMatchId = null;
let currentScoreMatchId = null;
let allPendingGames = [];



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
 allMembers = (membersData || []).filter(member =>
  member.id !== currentProfile?.id &&
  !member.is_external
);
  const sportSelect = $("match-sport");
  if (sportSelect) {
    sportSelect.innerHTML = `
      <option value="">Select sport</option>
      ${allSports.map(s => `
        <option value="${s.id}">${escapeHtml(s.name)}</option>
      `).join("")}
    `;
  }

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
  if (!matchId) {
    alert("Match id missing. Cannot save invitations.");
    return false;
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
      match_id: matchId,
      member_id: currentProfile.id,
      invited_by: currentProfile.id,
      status: "in"
    };

    const invitedRows = uniqueInvitedIds.map(memberId => ({
      match_id: matchId,
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
      return false;
    }

    return true;
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
      .eq("match_id", matchId)
      .in("member_id", idsToRemove);

    if (removeError) {
      alert(removeError.message);
      return false;
    }
  }

  if (idsToAdd.length > 0) {
    const rows = idsToAdd.map(memberId => ({
      match_id: matchId,
      member_id: memberId,
      invited_by: currentProfile.id,
      status: "invited"
    }));

    const { error: addError } = await supabaseClient
      .from("match_invitations")
      .insert(rows);

    if (addError) {
      alert(addError.message);
      return false;
    }
  }

  return true;
}


const fmtDate = (iso) =>
  new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"]/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[s]));
}

function jsString(str) {
  return String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
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
  if (!$("verifiedCount") || !$("pendingCount")) return;

  const verified = state.activities.filter(a => a.approvals.length >= 2).length;
  $("verifiedCount").textContent = verified;
  $("pendingCount").textContent = state.activities.length - verified;
}

function renderFeed() {
  if (!$("feedList")) return;

  const items = [
    ...state.matches.map(m => ({ kind: "match", time: new Date(m.date).getTime(), data: m })),
    ...state.activities.map(a => ({ kind: "activity", time: a.createdAt, data: a }))
  ].sort((a, b) => b.time - a.time).slice(0, 8);

  $("feedList").innerHTML =
    items.map(item =>
      item.kind === "match"
        ? matchCard(item.data, true)
        : activityCard(item.data, true)
    ).join("");
}

function renderLeagues() {
  if (!$("leagueList")) return;

  $("leagueList").innerHTML = state.leagues.map(l => `
    <article class="card">
      <div class="row">
        <div>
          <h3>${escapeHtml(l.name)}</h3>
          <div class="meta">${escapeHtml(l.sport)} • ${escapeHtml(l.format || "Open format")}</div>
        </div>
        <span class="pill blue">League</span>
      </div>
      <div class="meta">Phase 1: standings table will connect to match results in the next step.</div>
    </article>
  `).join("");
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
          member:members!match_team_players_member_id_fkey (
            id,
            first_name,
            last_name,
            display_name,
            email,
            is_external
          )
        )
      )
    `;

  let result = await supabaseClient
    .from("matches")
    .select(fullSelect)
    .order("start_time", { ascending: true });

  if (result.error) {
    console.warn("Full match load failed, retrying without game scoring tables:", result.error.message);

    result = await supabaseClient
      .from("matches")
      .select(fallbackSelect)
      .order("start_time", { ascending: true });
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

  renderMatches();
}

function invitationCounts(match) {
  const invitations = match.match_invitations || [];
  const hasCreatorInvitation = invitations.some(inv =>
    inv.member_id === match.created_by && inv.status !== "removed"
  );

  let inCount = invitations.filter(inv => inv.status === "in").length;

  if (match.created_by && !hasCreatorInvitation) {
    inCount += 1;
  }

  return {
    inCount,
    maybeCount: invitations.filter(inv => inv.status === "maybe").length,
    outCount: invitations.filter(inv => inv.status === "out").length,
    invitedCount: invitations.filter(inv => inv.status === "invited").length
  };
}

function invitationMember(invitation) {
  return invitation?.member || null;
}

function invitationMemberDisplayName(invitation) {
  const member = invitationMember(invitation);

  return member?.display_name ||
    `${member?.first_name || ""} ${member?.last_name || ""}`.trim() ||
    member?.email ||
    "Unnamed";
}

function isExternalInvitation(invitation) {
  return Boolean(invitationMember(invitation)?.is_external);
}

function externalPlayerInvitations(match) {
  return (match.match_invitations || []).filter(inv =>
    inv.status === "in" && isExternalInvitation(inv)
  );
}

function externalPlayerCount(match) {
  return externalPlayerInvitations(match).length;
}

function filledPlayerCount(match) {
  return invitationCounts(match).inCount;
}

function remainingSpots(match) {
  const maxPlayers = Number(match.max_players || 0);
  if (!maxPlayers) return null;

  return Math.max(0, maxPlayers - filledPlayerCount(match));
}

function myInvitation(match) {
  return (match.match_invitations || []).find(inv =>
    inv.member_id === currentProfile?.id
  );
}

function canManageMatch(match) {
  return isCurrentUserAdmin() || match.created_by === currentProfile?.id;
}

function inPlayerNames(match) {
  const invitations = match.match_invitations || [];

  const names = invitations
    .filter(inv => inv.status === "in")
    .map(inv => invitationMemberDisplayName(inv))
    .filter(Boolean);

  const hasCreatorInvitation = invitations.some(inv =>
    inv.member_id === match.created_by && inv.status !== "removed"
  );

  if (match.created_by && !hasCreatorInvitation) {
    names.unshift("Creator");
  }

  return names;
}



function pad2(num) {
  return String(num).padStart(2, "0");
}

function toLocalDateValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function populateMatchTimeSelects() {
  const startHour = $("match-start-hour");
  const startMinute = $("match-start-minute");
  const endHour = $("match-end-hour");
  const endMinute = $("match-end-minute");

  if (!startHour || !startMinute || !endHour || !endMinute) return;

  if (startHour.options.length && startMinute.options.length) return;

  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 1;
    return `<option value="${hour}">${hour}</option>`;
  }).join("");

  const minuteOptions = Array.from({ length: 60 }, (_, minute) => {
    return `<option value="${pad2(minute)}">${pad2(minute)}</option>`;
  }).join("");

  startHour.innerHTML = hourOptions;
  endHour.innerHTML = hourOptions;

  startMinute.innerHTML = minuteOptions;
  endMinute.innerHTML = minuteOptions;
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

  const today = new Date();

  if ($("match-start-date")) $("match-start-date").value = toLocalDateValue(today);
  setTimeParts("match-start", 18, 0);

  if ($("match-end-date")) $("match-end-date").value = toLocalDateValue(today);
  setTimeParts("match-end", 19, 30);
}

function setMatchDateTimeFields(startIso, endIso) {
  populateMatchTimeSelects();

  const start = startIso ? new Date(startIso) : new Date();
  const end = endIso ? new Date(endIso) : new Date(start.getTime() + 90 * 60000);

  if ($("match-start-date")) $("match-start-date").value = toLocalDateValue(start);
  setTimeParts("match-start", start.getHours(), start.getMinutes());

  if ($("match-end-date")) $("match-end-date").value = toLocalDateValue(end);
  setTimeParts("match-end", end.getHours(), end.getMinutes());
}

function getMatchDateTimeValues() {
  const startDate = $("match-start-date")?.value || "";
  const endDate = $("match-end-date")?.value || "";
  const startParts = readTimeParts("match-start");
  const endParts = readTimeParts("match-end");

  if (!startDate || !endDate || !startParts || !endParts) {
    alert("Please choose match start and end date/time.");
    return null;
  }

  const startTimeValue = new Date(`${startDate}T${pad2(startParts.hour24)}:${pad2(startParts.minute)}:00`);
  const endTimeValue = new Date(`${endDate}T${pad2(endParts.hour24)}:${pad2(endParts.minute)}:00`);

  if (Number.isNaN(startTimeValue.getTime()) || Number.isNaN(endTimeValue.getTime())) {
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

  return {
    startTime: startTimeValue,
    endTime: endTimeValue
  };
}

function getMatchDisplayStatus(match) {
  if (match.status === "cancelled") return "cancelled";
  if (match.status === "completed") return "completed";

  const now = new Date();
  const start = new Date(match.start_time);
  const end = new Date(match.end_time);

  if (now >= start && now <= end) return "playing";
  if (now > end) return "finished";

  return match.status || "open_for_votes";
}

function getMatchStatusClass(displayStatus, isFull) {
  if (displayStatus === "cancelled") return "red";
  if (displayStatus === "playing") return "gold";
  if (displayStatus === "finished" || displayStatus === "completed") return "blue";
  if (isFull) return "blue";
  return "green";
}

function isVotingOpenForMatch(match) {
  const displayStatus = getMatchDisplayStatus(match);
  return displayStatus !== "cancelled" &&
    displayStatus !== "playing" &&
    displayStatus !== "finished" &&
    displayStatus !== "completed" &&
    new Date(match.start_time) > new Date();
}

function isMatchEditable(match) {
  return getMatchDisplayStatus(match) !== "cancelled" &&
    new Date(match.start_time) > new Date();
}


function inPlayerInvitations(match) {
  return (match.match_invitations || []).filter(inv =>
    inv.status === "in" && invitationMember(inv)
  );
}

function teamAssignments(match) {
  const teams = match.match_teams || [];

  return teams.map(team => ({
    ...team,
    players: (team.match_team_players || []).map(tp => ({
      teamPlayerId: tp.id,
      memberId: tp.member_id,
      name: memberDisplayName(tp.member),
      isExternal: Boolean(tp.member?.is_external)
    }))
  }));
}

function renderTeamsSummary(match) {
  const teams = teamAssignments(match);

  if (!teams.length) return "";

  return `
    <div class="teams-summary">
      ${teams.map(team => `
        <div class="team-summary-row">
          <strong>${escapeHtml(team.name || "Team")}</strong>
          <span>
            ${
              team.players.length
                ? escapeHtml(team.players.map(player => player.name).join(", "))
                : "No players assigned"
            }
          </span>
        </div>
      `).join("")}
    </div>
  `;
}

function currentTeamByMemberId(match) {
  const map = new Map();

  (match.match_teams || []).forEach(team => {
    (team.match_team_players || []).forEach(tp => {
      if (tp.member_id) map.set(tp.member_id, team.id);
    });
  });

  return map;
}



function sportName(match) {
  return String(match.sports?.name || "").toLowerCase();
}

function isPadelMatch(match) {
  return sportName(match).includes("padel");
}

function isSimpleScoreMatch(match) {
  return !isPadelMatch(match);
}

function scoreEntries(match, entryType = null) {
  const entries = match.match_score_entries || [];

  return entryType
    ? entries.filter(entry => entry.entry_type === entryType)
    : entries;
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
  let teamASetWins = 0;
  let teamBSetWins = 0;

  const validSets = [];

  for (const set of sets) {
    if (!set.hasAnyValue) continue;

    if (
      set.teamAScore === null ||
      set.teamBScore === null ||
      !Number.isInteger(set.teamAScore) ||
      !Number.isInteger(set.teamBScore) ||
      set.teamAScore < 0 ||
      set.teamBScore < 0
    ) {
      return {
        error: "Padel set scores must be whole numbers equal to or greater than 0."
      };
    }

    validSets.push(set);

    if (set.isCompleted) {
      if (set.teamAScore > set.teamBScore) teamASetWins += 1;
      if (set.teamBScore > set.teamAScore) teamBSetWins += 1;
    }
  }

  if (validSets.length === 0) {
    return {
      error: "Enter at least one padel set."
    };
  }

  return {
    teamASetWins,
    teamBSetWins,
    validSets
  };
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
  return (match.match_game_sessions || [])
    .map(session => session.match_games)
    .filter(Boolean);
}

function scoreEntriesForGame(match, gameId) {
  return (match.match_score_entries || []).filter(entry =>
    entry.game_id === gameId
  );
}

function padelCompletedGameCountForTeam(match, teamLetter) {
  const sessionGames = matchSessionGames(match).filter(game =>
    game.status === "completed"
  );

  return sessionGames.filter(game =>
    game.winner_team === teamLetter
  ).length;
}

async function loadPendingPadelGames(match) {
  const { data, error } = await supabaseClient
    .from("match_games")
    .select("id,sport_id,title,status,team_a_name,team_b_name,team_a_score,team_b_score,winner_team,created_by,created_at")
    .eq("sport_id", match.sport_id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    allPendingGames = [];
    return [];
  }

  const alreadyLinkedIds = new Set(
    (match.match_game_sessions || []).map(session => session.game_id)
  );

  allPendingGames = (data || []).filter(game => !alreadyLinkedIds.has(game.id));
  return allPendingGames;
}

function renderPendingGameOptions() {
  const select = $("padel-pending-game");
  if (!select) return;

  if (!allPendingGames.length) {
    select.innerHTML = `<option value="">No pending games found</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Select pending game</option>
    ${allPendingGames.map(game => `
      <option value="${game.id}">
        ${escapeHtml(game.title || "Pending Game")}
      </option>
    `).join("")}
  `;
}

function setPadelGameModeUI() {
  const mode = $("padel-game-mode")?.value || "new";
  const label = $("padel-pending-game-label");

  if (label) {
    label.style.display = mode === "continue" ? "" : "none";
  }
}

function clearPadelSetInputs() {
  for (const setNumber of [1, 2, 3]) {
    if ($(`padel-set-${setNumber}-a`)) $(`padel-set-${setNumber}-a`).value = "";
    if ($(`padel-set-${setNumber}-b`)) $(`padel-set-${setNumber}-b`).value = "";
    if ($(`padel-set-${setNumber}-completed`)) $(`padel-set-${setNumber}-completed`).checked = true;
  }

  updatePadelScorePreview();
}

async function loadPendingGameScoreIntoForm(gameId) {
  if (!currentScoreMatchId || !gameId) {
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

    if ($(`padel-set-${setNumber}-a`)) {
      $(`padel-set-${setNumber}-a`).value = Number(entry.team_a_score || 0);
    }

    if ($(`padel-set-${setNumber}-b`)) {
      $(`padel-set-${setNumber}-b`).value = Number(entry.team_b_score || 0);
    }

    if ($(`padel-set-${setNumber}-completed`)) {
      $(`padel-set-${setNumber}-completed`).checked = Boolean(entry.is_completed);
    }
  });

  updatePadelScorePreview();
}

function padelGameWinnerFromSets(padelResult) {
  if (padelResult.teamASetWins >= 2) return "A";
  if (padelResult.teamBSetWins >= 2) return "B";
  return null;
}

function canSubmitScore(match) {
  const displayStatus = getMatchDisplayStatus(match);

  return canManageMatch(match) &&
    displayStatus === "finished" &&
    match.score_status !== "submitted" &&
    (match.match_teams || []).length >= 2;
}

function hasSubmittedScore(match) {
  return match.score_status === "submitted" || match.status === "completed";
}

function renderScoreSummary(match) {
  const teams = match.match_teams || [];

  if (!teams.length || !hasSubmittedScore(match)) return "";

  const sessionGames = matchSessionGames(match);

  return `
    <div class="score-summary">
      ${teams.map(team => `
        <div class="score-summary-row">
          <strong>${escapeHtml(team.name || "Team")}</strong>
          <span>${Number(team.score || 0)}</span>
          <em>${escapeHtml(team.result || "-")}</em>
        </div>
      `).join("")}

      ${
        sessionGames.length
          ? `
            <div class="padel-score-summary">
              ${sessionGames.map((game, index) => {
                const gameSets = scoreEntriesForGame(match, game.id)
                  .filter(entry => entry.entry_type === "padel_set")
                  .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0));

                return `
                  <div><strong>${escapeHtml(game.title || `Game ${index + 1}`)}</strong> — ${escapeHtml(game.status || "-")}${game.winner_team ? ` • Winner: Team ${escapeHtml(game.winner_team)}` : ""}</div>
                  ${gameSets.map(set => `
                    <div>
                      Set ${Number(set.set_number || 0)}:
                      ${Number(set.team_a_score || 0)}-${Number(set.team_b_score || 0)}
                      ${set.is_completed ? "" : " unfinished"}
                    </div>
                  `).join("")}
                `;
              }).join("")}
            </div>
          `
          : ""
      }

      ${
        match.notes
          ? `<div class="score-notes">${escapeHtml(match.notes)}</div>`
          : ""
      }
    </div>
  `;
}

function getTwoMatchTeams(match) {
  const teams = match.match_teams || [];

  return {
    teamA: teams[0] || null,
    teamB: teams[1] || null
  };
}

async function openScoreSubmission(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canSubmitScore(match)) {
    alert("Score can only be submitted after the match is finished and teams are assigned.");
    return;
  }

  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) {
    alert("Assign teams before submitting score.");
    return;
  }

  currentScoreMatchId = matchId;

  if ($("score-match-label")) {
    $("score-match-label").textContent = `${match.title || "Match result"} — ${match.sports?.name || ""}`;
  }

  if ($("score-team-a-label")) {
    $("score-team-a-label").textContent = `${teamA.name || "Team A"} score`;
  }

  if ($("score-team-b-label")) {
    $("score-team-b-label").textContent = `${teamB.name || "Team B"} score`;
  }

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

async function saveScore() {
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
    alert("Score can only be submitted after the match is finished and teams are assigned.");
    return;
  }

  const { teamA, teamB } = getTwoMatchTeams(match);

  if (!teamA || !teamB) {
    alert("Assign teams before submitting score.");
    return;
  }

  const summary = $("score-summary")?.value.trim() || null;

  if (isPadelMatch(match)) {
    const mode = $("padel-game-mode")?.value || "new";
    const gameTitle = $("padel-game-title")?.value.trim() || "Padel Game";
    const padelResult = calculatePadelSetResult(padelSetInputs());

    if (padelResult.error) {
      alert(padelResult.error);
      return;
    }

    let gameId = null;
    const winnerTeam = padelGameWinnerFromSets(padelResult);
    const gameStatus = winnerTeam ? "completed" : "in_progress";

    if (mode === "continue") {
      gameId = $("padel-pending-game")?.value || "";

      if (!gameId) {
        alert("Select a pending game to continue.");
        return;
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
        return;
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
        return;
      }

      gameId = gameData.id;
    }

    const { error: sessionError } = await supabaseClient
      .from("match_game_sessions")
      .upsert({
        match_id: currentScoreMatchId,
        game_id: gameId
      }, {
        onConflict: "match_id,game_id"
      });

    if (sessionError) {
      alert(sessionError.message);
      return;
    }

    const { error: deleteEntriesError } = await supabaseClient
      .from("match_score_entries")
      .delete()
      .eq("game_id", gameId);

    if (deleteEntriesError) {
      alert(deleteEntriesError.message);
      return;
    }

    const scoreRows = padelResult.validSets.map(set => ({
      match_id: currentScoreMatchId,
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
      return;
    }

    const currentSessionGames = matchSessionGames(match);
    const completedGames = [
      ...currentSessionGames.filter(game => game.id !== gameId && game.status === "completed"),
      {
        id: gameId,
        status: gameStatus,
        winner_team: winnerTeam
      }
    ].filter(game => game.status === "completed");

    const sessionScoreA = completedGames.filter(game => game.winner_team === "A").length;
    const sessionScoreB = completedGames.filter(game => game.winner_team === "B").length;

    const resultA = sessionScoreA > sessionScoreB ? "win" : sessionScoreA < sessionScoreB ? "loss" : "draw";
    const resultB = sessionScoreB > sessionScoreA ? "win" : sessionScoreB < sessionScoreA ? "loss" : "draw";

    const { error: teamAError } = await supabaseClient
      .from("match_teams")
      .update({
        score: sessionScoreA,
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
        score: sessionScoreB,
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
      .eq("id", currentScoreMatchId);

    if (matchError) {
      alert(matchError.message);
      return;
    }

    alert("Padel game saved.");
  } else {
    const scoreA = Number($("score-team-a")?.value || 0);
    const scoreB = Number($("score-team-b")?.value || 0);

    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
      alert("Scores must be whole numbers equal to or greater than 0.");
      return;
    }

    const resultA = scoreA > scoreB ? "win" : scoreA < scoreB ? "loss" : "draw";
    const resultB = scoreB > scoreA ? "win" : scoreB < scoreA ? "loss" : "draw";
    const winnerTeam = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "draw";

    const { data: gameData, error: gameError } = await supabaseClient
      .from("match_games")
      .insert({
        sport_id: match.sport_id,
        league_id: match.league_id || null,
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
        match_id: currentScoreMatchId,
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
        match_id: currentScoreMatchId,
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
      .eq("id", currentScoreMatchId);

    if (matchError) {
      alert(matchError.message);
      return;
    }

    alert("Score saved.");
  }

  $("scoreModal")?.close();
  currentScoreMatchId = null;

  await loadMatches();
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
  const verified = a.approvals.length >= 2;

  return `
    <article class="card">
      <div class="row">
        <div>
          <h3>${escapeHtml(a.player)} — ${escapeHtml(a.activity)}</h3>
          <div class="meta">${escapeHtml(a.sport)} • ${a.points} pts • Proof: ${escapeHtml(a.proof || "not attached yet")}</div>
          <div class="meta">Approvals: ${a.approvals.length}/2</div>
        </div>
        <span class="pill ${verified ? "green" : "red"}">${verified ? "Verified" : "Pending"}</span>
      </div>
      ${compact || verified ? "" : `<div class="actions"><button class="small-btn" onclick="approveActivity('${a.id}')">Committee approve</button></div>`}
    </article>
  `;
}

function renderActivities() {
  if (!$("activityList")) return;
  $("activityList").innerHTML = state.activities.map(a => activityCard(a)).join("");
}

function renderRankings() {
  if (!$("rankingList")) return;

  const scores = {};
  for (const a of state.activities) {
    if (a.approvals.length >= 2) {
      scores[a.player] = (scores[a.player] || 0) + Number(a.points || 0);
    }
  }

  const ranks = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  $("rankingList").innerHTML = ranks.length
    ? ranks.map(([name, pts], i) => `
      <article class="card rank">
        <div class="rank-number">${i + 1}</div>
        <div>
          <h3>${escapeHtml(name)}</h3>
          <div class="meta">Verified ABA points</div>
        </div>
        <strong>${pts}</strong>
      </article>
    `).join("")
    : `<article class="card">No verified points yet.</article>`;
}

function approveActivity(id) {
  const a = state.activities.find(x => x.id === id);
  if (!a || a.approvals.length >= 2) return;

  a.approvals.push(`Committee ${a.approvals.length + 1}`);
  saveData();
  render();
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

function setProfileStatusText(profile) {
  const status = $("profile-status");
  if (!status) return;

  if (!profile) {
    status.textContent = "Complete your profile, then wait for admin approval.";
    return;
  }

  const approval = profile.approval_status || "pending";
  const role = profile.role || "member";

  if (approval === "pending") {
    status.textContent = "Your profile is waiting for admin approval.";
    return;
  }

  if (approval === "rejected") {
    status.textContent = "Your registration was rejected. Please contact an admin if you think this is a mistake.";
    return;
  }

  if (approval === "suspended") {
    status.textContent = "Your account is suspended. Please contact an admin.";
    return;
  }

  status.textContent = `Status: ${approval} • Role: ${role}`;
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

  const profile = {
    auth_user_id: user.id,
    email: user.email,
    first_name: firstName,
    last_name: $("profile-last-name").value.trim(),
    display_name: displayName,
    birth_date: $("profile-birth-date").value || null,
    phone: $("profile-phone").value.trim(),
    is_external: currentProfile?.is_external ?? false,
    is_active: currentProfile?.is_active ?? true,
    role: currentProfile?.role ?? "member",
    approval_status: currentProfile?.approval_status ?? "pending",
    registration_status: currentProfile?.registration_status ?? "pending"
  };

  const { error } = await supabaseClient
    .from("members")
    .upsert(profile, { onConflict: "auth_user_id" });

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
  await loadMatches();
}
    if (isCurrentUserAdmin()) {
      await loadSportsOptions();
await loadMatchFormOptions();
await loadPendingMembers();
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
  currentProfile = null;
  clearProfileFields();

  // Send user back to Home after logout
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.remove("active");
  });

  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active-view");
  });

  const homeTab = document.querySelector('[data-view="dashboard"]');
  if (homeTab) homeTab.classList.add("active");

  const homeView = $("dashboard");
  if (homeView) homeView.classList.add("active-view");
}

function bindEvents() {
  populateMatchTimeSelects();
  setDefaultMatchDateTimes();

  $("match-sport")?.addEventListener("change", updateMatchVenueOptions);
  document.querySelectorAll(".tab").forEach(btn =>
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));

      btn.classList.add("active");
      const target = $(btn.dataset.view);
      if (target) target.classList.add("active-view");

      if (btn.dataset.view === "account") {
        loadMyProfile();
      }

      if (btn.dataset.view === "admin") {
        loadSportsOptions();
        loadMatchFormOptions();
        loadPendingMembers();
        loadVenues();
        loadMatches();
      }
    })
  );

 document.querySelectorAll("[data-open]").forEach(btn =>
  btn.addEventListener("click", async () => {
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

    const modal = $(btn.dataset.open);
    if (modal) modal.showModal();
  })
);
  if ($("leagueForm")) {
    $("leagueForm").addEventListener("submit", e => {
      const fd = new FormData(e.target);
      state.leagues.unshift({
        id: crypto.randomUUID(),
        name: fd.get("name"),
        sport: fd.get("sport"),
        format: fd.get("format"),
        createdAt: Date.now()
      });
      saveData();
      e.target.reset();
      render();
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
    const maxPlayers = Number(fd.get("max_players") || 0);
    const matchDateTimes = getMatchDateTimeValues();

    if (!matchDateTimes) return;

    if (!maxPlayers || maxPlayers < 1) {
      alert("Max players must be at least 1.");
      return;
    }

    if (requiredPlayers > maxPlayers) {
      alert("Required players cannot be greater than max players.");
      return;
    }

    const selectedInviteIds = getSelectedInviteMemberIds();

    if (!editingMatchId && selectedInviteIds.length + 1 > maxPlayers) {
      const ok = confirm("You invited more players than the maximum spots. Players can still vote, but only the first players to vote IN will take the spots. Continue?");
      if (!ok) return;
    }

    const match = {
      sport_id: fd.get("sport_id"),
      venue_id: fd.get("venue_id"),
      league_id: null,
      created_by: currentProfile.id,
      title: fd.get("title"),
      match_type: fd.get("match_type"),
      start_time: matchDateTimes.startTime.toISOString(),
      end_time: matchDateTimes.endTime.toISOString(),
      status: "open_for_votes",
      max_players: maxPlayers,
      required_players: requiredPlayers || maxPlayers,
      visibility: "invited",
      team_status: "not_assigned",
      score_status: "not_submitted",
      notes: fd.get("notes") || null
    };

    let result;

    if (editingMatchId) {
      result = await supabaseClient
        .from("matches")
        .update(match)
        .eq("id", editingMatchId)
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

    const matchId = editingMatchId || result.data?.[0]?.id;

    const invitationsSaved = await saveMatchInvitations(
      matchId,
      selectedInviteIds,
      Boolean(editingMatchId)
    );

    if (!invitationsSaved) return;

    alert(editingMatchId ? "Match updated." : "Match created.");

    editingMatchId = null;
    e.target.reset();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "Create Match";

    await loadMatches();
  });
}

  if ($("activityForm")) {
    $("activityForm").addEventListener("submit", e => {
      const fd = new FormData(e.target);
      state.activities.unshift({
        id: crypto.randomUUID(),
        player: fd.get("player"),
        sport: fd.get("sport"),
        activity: fd.get("activity"),
        proof: fd.get("proof"),
        points: Number(fd.get("points")),
        approvals: [],
        createdAt: Date.now()
      });
      saveData();
      e.target.reset();
      render();
    });
  }

  $("profile-action-btn")?.addEventListener("click", async () => {
    if (profileIsEditing) {
      await saveProfile();
    } else {
      setProfileEditing(true);
    }
  });

  $("signup-btn")?.addEventListener("click", () => {
    signUp($("auth-email").value.trim(), $("auth-password").value);
  });

  $("login-btn")?.addEventListener("click", () => {
    login($("auth-email").value.trim(), $("auth-password").value);
  });

  $("logout-btn")?.addEventListener("click", logout);

  $("add-venue-btn")?.addEventListener("click", saveVenue);

  $("cancel-venue-edit-btn")?.addEventListener("click", clearVenueForm);

  $("add-selected-external-btn")?.addEventListener("click", addSelectedExternalPlayers);

  $("create-external-player-btn")?.addEventListener("click", createExternalPlayerProfile);

  $("save-teams-btn")?.addEventListener("click", saveTeams);

  $("save-score-btn")?.addEventListener("click", saveScore);

  if ($("padel-score-section")) {
    document.querySelectorAll("#padel-score-section input").forEach(input => {
      input.addEventListener("input", updatePadelScorePreview);
      input.addEventListener("change", updatePadelScorePreview);
    });
  }

  $("padel-game-mode")?.addEventListener("change", () => {
    setPadelGameModeUI();
    if ($("padel-game-mode")?.value === "new") {
      clearPadelSetInputs();
      if ($("padel-game-title")) $("padel-game-title").value = "Game 1";
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
render();
testConnection();
refreshAuthUI();

setInterval(() => {
  if (currentProfile?.approval_status === "approved" && allMatches?.length) {
    renderMatches();
  }
}, 60000);
