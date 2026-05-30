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

async function loadVenues() {
  if (!isCurrentUserAdmin()) return;

  const { data, error } = await supabaseClient
    .from("venues")
    .select("id,name,address,google_maps_url,image_url,is_active,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  const box = $("venuesList");
  if (!box) return;

  if (!data || data.length === 0) {
    box.innerHTML = `<article class="card">No venues added yet.</article>`;
    return;
  }

 box.innerHTML = data.map(venue => `
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
        <div class="row">
          <div>
            <h3>${escapeHtml(venue.name || "Unnamed venue")}</h3>
            <div class="meta">${escapeHtml(venue.address || "-")}</div>
            ${
              venue.google_maps_url
                ? `<div class="meta"><a href="${escapeHtml(venue.google_maps_url)}" target="_blank">Open Map</a></div>`
                : ""
            }
          </div>

          <span class="pill ${venue.is_active ? "green" : "red"}">
            ${venue.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

    </div>
  </article>
`).join("");
}

async function addVenue() {
  if (!isCurrentUserAdmin()) {
    alert("Admin access required.");
    return;
  }

  const name = $("venue-name").value.trim();

  if (!name) {
    alert("Venue name is required.");
    return;
  }

  const venue = {
    name,
    address: $("venue-address").value.trim(),
    google_maps_url: $("venue-map-url").value.trim(),
    image_url: $("venue-image-url").value.trim(),
    is_active: true
  };

  const { error } = await supabaseClient
    .from("venues")
    .insert(venue);

  if (error) {
    alert(error.message);
    return;
  }

  $("venue-name").value = "";
  $("venue-address").value = "";
  $("venue-map-url").value = "";
  $("venue-image-url").value = "";

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

function renderMatches() {
  if (!$("matchList")) return;

  $("matchList").innerHTML =
    state.matches
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(m => matchCard(m))
      .join("");
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

    if (isCurrentUserAdmin()) {
      await loadPendingMembers();
      await loadVenues();
    }

    return;
  }

$("add-venue-btn")?.addEventListener("click", addVenue);
  
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
    })
  );

  document.querySelectorAll("[data-open]").forEach(btn =>
    btn.addEventListener("click", () => {
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
    $("matchForm").addEventListener("submit", e => {
      const fd = new FormData(e.target);
      state.matches.unshift({
        id: crypto.randomUUID(),
        sport: fd.get("sport"),
        title: fd.get("title"),
        date: new Date(fd.get("date")).toISOString(),
        venue: fd.get("venue"),
        address: fd.get("address"),
        type: fd.get("type"),
        comments: []
      });
      saveData();
      e.target.reset();
      render();
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

  supabaseClient.auth.onAuthStateChange(() => {
    refreshAuthUI();
  });
}

bindEvents();
render();
testConnection();
refreshAuthUI();
