const SUPABASE_URL = "https://welleqrjtlullhbdhive.supabase.co";
const SUPABASE_KEY = "sb_publishable_e_Pu1JLmyXBKJnMvR5guXQ_GzvFcdK-";
const supabaseClient= window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  const { data, error } = await supabaseClient
    .from('sports')
    .select('*');

  console.log("URL:", SUPABASE_URL);
  console.log("DATA:", data);
  console.log("ERROR:", error);
}
testConnection();



const STORAGE_KEY = "aba_phase1_data";

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

function futureDate(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(demoData);
  return JSON.parse(saved);
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
let state = loadData();

const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function render() {
  $("todayLabel").textContent = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  renderStats(); renderFeed(); renderLeagues(); renderMatches(); renderActivities(); renderRankings();
}
function renderStats() {
  const verified = state.activities.filter(a => a.approvals.length >= 2).length;
  $("verifiedCount").textContent = verified;
  $("pendingCount").textContent = state.activities.length - verified;
}
function renderFeed() {
  const items = [
    ...state.matches.map(m => ({ kind: "match", time: new Date(m.date).getTime(), data: m })),
    ...state.activities.map(a => ({ kind: "activity", time: a.createdAt, data: a }))
  ].sort((a,b) => b.time - a.time).slice(0,8);
  $("feedList").innerHTML = items.map(item => item.kind === "match" ? matchCard(item.data, true) : activityCard(item.data, true)).join("");
}
function renderLeagues() {
  $("leagueList").innerHTML = state.leagues.map(l => `
    <article class="card">
      <div class="row"><div><h3>${escapeHtml(l.name)}</h3><div class="meta">${l.sport} • ${escapeHtml(l.format || "Open format")}</div></div><span class="pill blue">League</span></div>
      <div class="meta">Phase 1: standings table will connect to match results in the next step.</div>
    </article>`).join("");
}
function matchCard(m, compact=false) {
  return `<article class="card">
    <div class="row"><div><h3>${escapeHtml(m.title)}</h3><div class="meta">${m.sport} • ${m.type} • ${fmtDate(m.date)}</div><div class="meta">📍 ${escapeHtml(m.venue)} ${m.address ? "— " + escapeHtml(m.address) : ""}</div></div><span class="pill green">Scheduled</span></div>
    ${compact ? "" : commentSection(m)}
  </article>`;
}
function renderMatches() { $("matchList").innerHTML = state.matches.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(m => matchCard(m)).join(""); }
function commentSection(m) {
  return `<div class="comments">${(m.comments || []).map(c => `<div class="comment">💬 ${escapeHtml(c)}</div>`).join("")}</div>
    <div class="comment-box"><input id="comment-${m.id}" placeholder="Add banter/comment..." /><button class="small-btn" onclick="addComment('${m.id}')">Send</button></div>`;
}
function activityCard(a, compact=false) {
  const verified = a.approvals.length >= 2;
  return `<article class="card">
    <div class="row"><div><h3>${escapeHtml(a.player)} — ${escapeHtml(a.activity)}</h3><div class="meta">${a.sport} • ${a.points} pts • Proof: ${escapeHtml(a.proof || "not attached yet")}</div><div class="meta">Approvals: ${a.approvals.length}/2</div></div><span class="pill ${verified ? "green" : "red"}">${verified ? "Verified" : "Pending"}</span></div>
    ${compact || verified ? "" : `<div class="actions"><button class="small-btn" onclick="approveActivity('${a.id}')">Committee approve</button></div>`}
  </article>`;
}
function renderActivities() { $("activityList").innerHTML = state.activities.map(a => activityCard(a)).join(""); }
function renderRankings() {
  const scores = {};
  for (const a of state.activities) if (a.approvals.length >= 2) scores[a.player] = (scores[a.player] || 0) + Number(a.points || 0);
  const ranks = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  $("rankingList").innerHTML = ranks.length ? ranks.map(([name, pts], i) => `<article class="card rank"><div class="rank-number">${i+1}</div><div><h3>${escapeHtml(name)}</h3><div class="meta">Verified ABA points</div></div><strong>${pts}</strong></article>`).join("") : `<article class="card">No verified points yet.</article>`;
}
function approveActivity(id) {
  const a = state.activities.find(x => x.id === id);
  if (!a || a.approvals.length >= 2) return;
  a.approvals.push(`Committee ${a.approvals.length + 1}`);
  saveData(); render();
}
function addComment(matchId) {
  const input = $(`comment-${matchId}`);
  const text = input.value.trim();
  if (!text) return;
  const m = state.matches.find(x => x.id === matchId);
  m.comments = m.comments || []; m.comments.push(text);
  saveData(); render();
}
function escapeHtml(str) { return String(str).replace(/[&<>"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s])); }

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  btn.classList.add("active"); $(btn.dataset.view).classList.add("active-view");
}));
document.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => $(btn.dataset.open).showModal()));
$("seedBtn").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); state = structuredClone(demoData); saveData(); render(); });
$("leagueForm").addEventListener("submit", e => {
  const fd = new FormData(e.target);
  state.leagues.unshift({ id: crypto.randomUUID(), name: fd.get("name"), sport: fd.get("sport"), format: fd.get("format"), createdAt: Date.now() });
  saveData(); e.target.reset(); render();
});
$("matchForm").addEventListener("submit", e => {
  const fd = new FormData(e.target);
  state.matches.unshift({ id: crypto.randomUUID(), sport: fd.get("sport"), title: fd.get("title"), date: new Date(fd.get("date")).toISOString(), venue: fd.get("venue"), address: fd.get("address"), type: fd.get("type"), comments: [] });
  saveData(); e.target.reset(); render();
});
$("activityForm").addEventListener("submit", e => {
  const fd = new FormData(e.target);
  state.activities.unshift({ id: crypto.randomUUID(), player: fd.get("player"), sport: fd.get("sport"), activity: fd.get("activity"), proof: fd.get("proof"), points: Number(fd.get("points")), approvals: [], createdAt: Date.now() });
  saveData(); e.target.reset(); render();
});

async function login(email, password) {
  const { data, error } =
    await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alert(error.message);
    return;
  }

  await refreshAuthUI();
}

async function logout() {
  await supabaseClient.auth.signOut();
  await refreshAuthUI();
}

async function signUp(email, password) {
  const { data, error } =
    await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          "https://alimuhieddine.github.io/aba-aub-bros-arena/"
      }
    });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Check your email and confirm your account.");
  await refreshAuthUI();
}

supabaseClient.auth.onAuthStateChange(() => {
  refreshAuthUI();
});




document
.getElementById("signup-btn")
.addEventListener("click", () => {

  signUp(
    document.getElementById("signup-email").value,
    document.getElementById("signup-password").value
  );

});





document
.getElementById("login-btn")
.addEventListener("click", () => {

  login(
    document.getElementById("login-email").value,
    document.getElementById("login-password").value
  );

});



document
.getElementById("logout-btn")
.addEventListener("click", logout);
render();


async function refreshAuthUI() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session) {

    document.getElementById(
      "auth-logged-out"
    ).style.display = "none";

    document.getElementById(
      "auth-logged-in"
    ).style.display = "block";

    document.getElementById(
      "current-user"
    ).textContent =
      session.user.email;

  } else {

    document.getElementById(
      "auth-logged-out"
    ).style.display = "block";

    document.getElementById(
      "auth-logged-in"
    ).style.display = "none";
  }
}



refreshAuthUI();
