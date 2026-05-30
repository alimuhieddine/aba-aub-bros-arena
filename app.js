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

  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://alimuhieddine.github.io/aba-aub-bros-arena/"
    }
  });

  if (error) {
    alert(error.message);
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

  if (!data) {
    clearProfileFields();
    setProfileStatusText(null);
    setProfileEditing(true);
    return;
  }

  $("profile-first-name").value = data.first_name || "";
  $("profile-last-name").value = data.last_name || "";
  $("profile-display-name").value = data.display_name || "";
  $("profile-birth-date").value = data.birth_date || "";
  $("profile-phone").value = data.phone || "";

  setProfileStatusText(data);
  setProfileEditing(false);
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

    await loadMyProfile();
  } else {
    $("auth-logged-out").style.display = "flex";
    $("auth-logged-in").style.display = "none";

    currentProfile = null;
    clearProfileFields();
  }
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
