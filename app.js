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
    .select("id,first_name,last_name,display_name,email")
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (membersError) {
    alert(membersError.message);
    return;
  }

  allSports = sportsData || [];
  allVenues = venuesData || [];
  allMembers = (membersData || []).filter(member => member.id !== currentProfile?.id);

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

  const uniqueInvitedIds = Array.from(new Set(invitedMemberIds || []))
    .filter(id => id && id !== currentProfile?.id);

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

  const idsToRemove = existingIds.filter(id =>
    id !== currentProfile?.id && !uniqueInvitedIds.includes(id)
  );

  const idsToAdd = uniqueInvitedIds.filter(id => !existingIds.includes(id));

  if (idsToRemove.length > 0) {
    const { error: removeError } = await supabaseClient
      .from("match_invitations")
      .update({ status: "removed" })
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

  const { data, error } = await supabaseClient
    .from("matches")
    .select(`
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
    email
  )
),
      match_external_players (
        id,
        display_name
      )
    `)
    .order("start_time", { ascending: true });

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


function externalPlayerCount(match) {
  return (match.match_external_players || []).length;
}

function filledPlayerCount(match) {
  return invitationCounts(match).inCount + externalPlayerCount(match);
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


function invitationMemberDisplayName(invitation) {
  const member = invitation?.member;

  return member?.display_name ||
    `${member?.first_name || ""} ${member?.last_name || ""}`.trim() ||
    member?.email ||
    "Unnamed";
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

function renderMatches() {
  if (!$("matchList")) return;

  if (!allMatches || allMatches.length === 0) {
    $("matchList").innerHTML = `<article class="card">No matches scheduled yet.</article>`;
    return;
  }

  $("matchList").innerHTML = allMatches.map(match => {
    const isCancelled = match.status === "cancelled";
    const isFuture = new Date(match.start_time) > new Date();
    const counts = invitationCounts(match);
    const externalCount = externalPlayerCount(match);
    const filledCount = counts.inCount + externalCount;
    const invitation = myInvitation(match);
    const isCreator = match.created_by === currentProfile?.id;
    const currentVoteStatus = invitation?.status || (isCreator ? "in" : null);

    const maxPlayers = Number(match.max_players || 0);
    const spotsLabel = maxPlayers
      ? `${filledCount}/${maxPlayers} filled`
      : `${filledCount} filled`;

    const isFull = maxPlayers && filledCount >= maxPlayers;
    const userIsIn = currentVoteStatus === "in";
    const canVoteThisMatch = Boolean(invitation || isCreator);

    return `
      <article class="card">
        <div class="row">
          <div>
            <h3>${escapeHtml(match.title || "Untitled match")}</h3>

            <div class="meta">
              ${escapeHtml(match.sports?.name || "-")}
              • ${escapeHtml(match.match_type || "-")}
              • ${fmtDate(match.start_time)}
            </div>

            <div class="meta">
              📍 ${escapeHtml(match.venues?.name || "-")}
              ${match.venues?.address ? "— " + escapeHtml(match.venues.address) : ""}
            </div>

            <div class="meta">
              Players: ${spotsLabel}
              • IN: ${counts.inCount}
              • External: ${externalCount}
              • Maybe: ${counts.maybeCount}
              • Out: ${counts.outCount}
              • Invited: ${counts.invitedCount}
            </div>

            <div class="meta">
              IN players: ${inPlayerNames(match).length ? escapeHtml(inPlayerNames(match).join(", ")) : "-"}
            </div>

            ${
              isFull
                ? `<div class="meta">Match is full.</div>`
                : ""
            }

            ${
              externalCount
                ? `<div class="meta">External players: ${escapeHtml((match.match_external_players || []).map(p => p.display_name).join(", "))}</div>`
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

          <span class="pill ${isCancelled ? "red" : isFull ? "blue" : "green"}">
            ${escapeHtml(isFull && !isCancelled ? "full" : (match.status || "scheduled"))}
          </span>
        </div>

        ${
         canVoteThisMatch && !isCancelled && isFuture
            ? `
              <div class="actions">
                <button
                  class="small-btn ${currentVoteStatus === "in" ? "selected-vote" : ""}"
                  onclick="voteMatch('${match.id}', 'in')"
                  ${isFull && !userIsIn ? "disabled" : ""}
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
          canManageMatch(match)
            ? `
              <div class="actions">
                ${
                  !isCancelled && isFuture && !isFull
                    ? `<button class="small-btn" onclick="addExternalPlayers('${match.id}')">
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
  form.elements["required_players"].value = match.required_players || match.max_players || 4;
  form.elements["max_players"].value = match.max_players || match.required_players || 4;
  form.elements["start_time"].value = toDateTimeLocal(match.start_time);
  form.elements["end_time"].value = toDateTimeLocal(match.end_time);
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

    const { error } = await supabaseClient
      .from("matches")
      .delete()
      .eq("id", matchId);

    if (error) {
      alert(error.message);
      return;
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

  if (new Date(match.start_time) <= new Date()) {
    alert("Voting is closed because the match time has passed.");
    return;
  }

  if (match.status === "cancelled") {
    alert("This match is cancelled.");
    return;
  }

  const counts = invitationCounts(match);
  const externalCount = externalPlayerCount(match);
  const filledCount = counts.inCount + externalCount;
  const maxPlayers = Number(match.max_players || 0);
  const currentVoteStatus = invitation?.status || (isCreator ? "in" : null);
  const userIsCurrentlyIn = currentVoteStatus === "in";

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

  renderMatches();
  await loadMatches();
}

async function addExternalPlayers(matchId) {
  const match = allMatches.find(m => m.id === matchId);

  if (!match) {
    alert("Match not found.");
    return;
  }

  if (!canManageMatch(match)) {
    alert("Only the match creator or admin can add external players.");
    return;
  }

  if (match.status === "cancelled") {
    alert("This match is cancelled.");
    return;
  }

  if (new Date(match.start_time) <= new Date()) {
    alert("You cannot add external players after the match time has passed.");
    return;
  }

  const remaining = remainingSpots(match);

  if (remaining !== null && remaining <= 0) {
    alert("This match is already full.");
    return;
  }

  const answer = prompt(
    remaining === null
      ? "How many external players do you want to add?"
      : `How many external players do you want to add? Remaining spots: ${remaining}`
  );

  if (answer === null) return;

  const count = Number(answer);

  if (!Number.isInteger(count) || count < 1) {
    alert("Please enter a valid whole number.");
    return;
  }

  if (remaining !== null && count > remaining) {
    alert(`You can only add ${remaining} external player(s).`);
    return;
  }

  const existingExternalCount = externalPlayerCount(match);

  const rows = Array.from({ length: count }, (_, index) => ({
    match_id: matchId,
    display_name: `External ${existingExternalCount + index + 1}`
  }));

  const { error } = await supabaseClient
    .from("match_external_players")
    .insert(rows);

  if (error) {
    alert(error.message);
    return;
  }

  alert(`${count} external player(s) added.`);
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
      start_time: new Date(fd.get("start_time")).toISOString(),
      end_time: new Date(fd.get("end_time")).toISOString(),
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

  supabaseClient.auth.onAuthStateChange(() => {
    refreshAuthUI();
  });
}

bindEvents();
render();
testConnection();
refreshAuthUI();
