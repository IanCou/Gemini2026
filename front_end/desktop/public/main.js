// Sift desktop UI — chat + canvas + SSE pipeline + activity feed + projects.
const API = "http://127.0.0.1:8765";

let sessionId = localStorage.getItem("session_id") || "";
let activeProject = localStorage.getItem("active_project") || "";  // "" = All files
let projects = [];

let mode = "constellation";
let projection = { points: [], query: null };
let pipelineState = { stages: { loaded: 0, embed: 0, insert: 0, done: 0, error: 0 }, total: 0, recent: [] };
let waterfallHits = [];
let lastQueryReticle = null;

// ── DOM ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const log = $("log");
const feed = $("feed");
const canvas = $("viz");
const ctx = canvas.getContext("2d");

// ── Activity feed ────────────────────────────────────────────────────────
function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}
function addFeed(html) {
  const line = document.createElement("div");
  line.className = "line";
  line.innerHTML = `<span class="ts">[${ts()}]</span> ${html}`;
  feed.appendChild(line);
  while (feed.children.length > 100) feed.removeChild(feed.firstChild);
  feed.scrollTop = feed.scrollHeight;
}
function addMsg(role, text, opts = {}) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (opts.html) div.innerHTML = text; else div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
function withProject(path) {
  const sep = path.includes("?") ? "&" : "?";
  return activeProject ? `${path}${sep}project=${encodeURIComponent(activeProject)}` : path;
}

// ── Projects ─────────────────────────────────────────────────────────────
function activeProjectObj() { return projects.find((p) => p.id === activeProject) || null; }

async function refreshProjects() {
  try {
    const d = await api("/api/projects");
    projects = d.projects || [];
    renderSidebar(d);
  } catch (e) { addFeed(`<span class="err">projects fetch failed: ${e.message}</span>`); }
}

function renderSidebar(payload) {
  const list = $("proj-list");
  list.innerHTML = "";
  // "All files" pseudo-project
  const total = projects.reduce((s, p) => s + (p.count || 0), 0) + (payload?.untagged || 0);
  list.appendChild(projItem({ id: "", name: "All files", count: total, root: "" }));
  for (const p of projects) list.appendChild(projItem(p));

  const proj = activeProjectObj();
  $("stat-project").textContent = proj ? `· ${proj.name}` : "";
  $("btn-index-active").disabled = !proj;
  $("btn-index-active").title = proj
    ? `Index ${proj.root}`
    : "Select a project to index its folder";
}

function projItem(p) {
  const li = document.createElement("li");
  li.className = "proj" + (p.id === activeProject ? " active" : "");
  li.dataset.id = p.id || "";
  const meta = p.id
    ? `<span title="${escapeAttr(p.root)}">${escapeHtml(shortRoot(p.root))}</span><span>${p.count || 0}</span>`
    : `<span>aggregate view</span><span>${p.count || 0}</span>`;
  li.innerHTML = `
    <div class="proj-name">${escapeHtml(p.name)}</div>
    <div class="proj-meta">${meta}</div>
    ${p.id ? `<button class="proj-del" title="Delete project">✕</button>` : ``}
  `;
  li.addEventListener("click", (ev) => {
    if (ev.target.closest(".proj-del")) return;
    selectProject(p.id);
  });
  const del = li.querySelector(".proj-del");
  if (del) del.addEventListener("click", (ev) => { ev.stopPropagation(); deleteProject(p); });
  return li;
}

function shortRoot(p) {
  if (!p) return "";
  const home = "/Users/" + (p.split("/Users/")[1] || "").split("/")[0];
  return p.startsWith(home) ? "~" + p.slice(home.length) : p;
}

async function selectProject(id) {
  activeProject = id || "";
  localStorage.setItem("active_project", activeProject);
  document.querySelectorAll(".proj").forEach((el) => el.classList.toggle("active", el.dataset.id === activeProject));
  const proj = activeProjectObj();
  $("stat-project").textContent = proj ? `· ${proj.name}` : "";
  $("btn-index-active").disabled = !proj;
  addFeed(`<span class="hl">●</span> active project: ${proj ? escapeHtml(proj.name) : "All files"}`);
  await refreshStats();
  await refreshProjection();
}

async function pickFolderViaDialog() {
  addFeed(`<span class="hl">→</span> opening folder picker…`);
  try {
    const r = await api("/api/dialog/pick_folder");
    return r.path || null;
  } catch (e) {
    addMsg("error", `Folder picker failed: ${e.message}`);
    return null;
  }
}

// Inline modal — Tauri/wry doesn't implement window.prompt(), so we DIY.
function showInputModal({ title, sub, defaultValue, okLabel }) {
  return new Promise((resolve) => {
    const bd = $("modal-backdrop");
    $("modal-title").textContent = title || "Input";
    $("modal-sub").textContent = sub || "";
    const inp = $("modal-input");
    inp.value = defaultValue || "";
    $("modal-ok").textContent = okLabel || "OK";
    bd.classList.remove("hidden");
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
    const cleanup = (val) => {
      bd.classList.add("hidden");
      $("modal-ok").onclick = null;
      $("modal-cancel").onclick = null;
      inp.onkeydown = null;
      bd.onclick = null;
      resolve(val);
    };
    $("modal-ok").onclick = () => cleanup(inp.value.trim() || null);
    $("modal-cancel").onclick = () => cleanup(null);
    inp.onkeydown = (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); cleanup(inp.value.trim() || null); }
      else if (ev.key === "Escape") { ev.preventDefault(); cleanup(null); }
    };
    bd.onclick = (ev) => { if (ev.target === bd) cleanup(null); };
  });
}

async function newProject() {
  const folder = await pickFolderViaDialog();
  if (!folder) { addFeed(`<span class="ts">picker cancelled</span>`); return; }
  const defaultName = folder.split("/").filter(Boolean).pop() || folder;
  const name = await showInputModal({
    title: "New project",
    sub: folder,
    defaultValue: defaultName,
    okLabel: "Add project",
  });
  if (!name) { addFeed(`<span class="ts">project create cancelled</span>`); return; }
  try {
    const r = await fetch(`${API}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, root: folder }),
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const p = await r.json();
    addFeed(`<span class="ok">✓</span> created project <span class="hl">${escapeHtml(p.name)}</span> @ ${escapeHtml(p.root)}`);
    await refreshProjects();
    await selectProject(p.id);
    addMsg("agent", `Project "${p.name}" added. Click ⟳ Index project to embed every supported file under ${p.root}.`);
  } catch (e) {
    addMsg("error", `Create project failed: ${e.message}`);
  }
}

async function deleteProject(p) {
  const typed = await showInputModal({
    title: `Delete project "${p.name}"?`,
    sub: `Type DELETE to confirm. ${p.count || 0} indexed file(s) will be removed from MongoDB.`,
    defaultValue: "",
    okLabel: "Delete",
  });
  if (typed !== "DELETE") { addFeed(`<span class="ts">delete cancelled</span>`); return; }
  try {
    const r = await fetch(`${API}/api/projects/${encodeURIComponent(p.id)}?drop_data=true`, { method: "DELETE" });
    if (!r.ok) throw new Error(`${r.status}`);
    const d = await r.json();
    addFeed(`<span class="ok">✓</span> deleted project ${escapeHtml(p.name)} (${d.deleted_docs} docs)`);
    if (activeProject === p.id) await selectProject("");
    await refreshProjects();
    await refreshStats();
    await refreshProjection();
  } catch (e) { addMsg("error", `Delete failed: ${e.message}`); }
}

// ── Health & stats ───────────────────────────────────────────────────────
async function refreshHealth() {
  try {
    const h = await api("/health");
    $("dot-mongo").classList.toggle("ok", !!h.mongo);
    $("dot-mongo").classList.toggle("bad", !h.mongo);
    $("dot-gemini").classList.toggle("ok", !!h.gemini_key_set);
    $("dot-gemini").classList.toggle("bad", !h.gemini_key_set);
  } catch (e) {}
}
async function refreshStats() {
  try {
    const s = await api(withProject("/api/stats"));
    $("stat-count").textContent = `${s.count} files indexed`;
  } catch (e) {}
}
async function refreshProjection(query) {
  try {
    let path = "/api/projection";
    if (query) path += `?query=${encodeURIComponent(query)}`;
    const p = await api(withProject(path));
    projection = p;
    if (p.query) lastQueryReticle = { x: p.query.x, y: p.query.y, query: p.query.query, hits: [] };
    draw();
  } catch (e) { addFeed(`<span class="err">projection failed: ${e.message}</span>`); }
}

// ── Canvas drawing ───────────────────────────────────────────────────────
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.floor(r.width * dpr);
  canvas.height = Math.floor(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function colorForType(t) {
  if (!t) return "#9ca3af";
  if (t.startsWith("image/")) return "#fbbf24";
  if (t === "application/pdf") return "#ef4444";
  if (t.startsWith("text/")) return "#3b82f6";
  if (t.startsWith("application/")) return "#8b5cf6";
  return "#10b981";
}
function draw() {
  if (!canvas.width || !canvas.height) fitCanvas();
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  if (mode === "constellation") drawConstellation(w, h);
  else if (mode === "pipeline") drawPipeline(w, h);
  else if (mode === "waterfall") drawWaterfall(w, h);
}
function drawConstellation(w, h) {
  const pad = 24;
  const proj = (p) => ({ x: pad + ((p.x + 1) * 0.5) * (w - 2*pad), y: pad + ((p.y + 1) * 0.5) * (h - 2*pad) });
  if (lastQueryReticle && lastQueryReticle.hits.length) {
    const q = proj(lastQueryReticle);
    for (const hp of lastQueryReticle.hits) {
      const tp = proj(hp);
      ctx.strokeStyle = `rgba(245,158,11,${0.15 + 0.7*hp.score})`;
      ctx.lineWidth = 1 + 2*hp.score;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
    }
  }
  for (const pt of projection.points) {
    const p = proj(pt);
    ctx.fillStyle = colorForType(pt.file_type);
    ctx.shadowColor = colorForType(pt.file_type); ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  if (lastQueryReticle) {
    const q = proj(lastQueryReticle);
    const t = (Date.now() % 2000) / 2000;
    const r = 8 + 6*Math.sin(t*Math.PI*2);
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4*Math.sin(t*Math.PI*2)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI*2); ctx.fill();
    ctx.font = "11px ui-monospace, monospace"; ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`"${lastQueryReticle.query}"`, q.x + 12, q.y - 8);
  }
  ctx.font = "10.5px ui-monospace, monospace"; ctx.fillStyle = "rgba(156,163,175,0.85)";
  const proj2 = activeProjectObj();
  const label = `${projection.points.length} files · ${proj2 ? proj2.name : "All files"} · PCA(2D)`;
  ctx.fillText(label, 10, h - 10);
}
function drawPipeline(w, h) {
  const stages = ["loaded", "embed", "insert", "done"];
  const labels = { loaded: "loaded", embed: "gemini-embed", insert: "atlas-insert", done: "done" };
  const colors = { loaded: "#3b82f6", embed: "#f59e0b", insert: "#8b5cf6", done: "#10b981" };
  const pad = 24, total = Math.max(pipelineState.total, 1);
  const slotW = (w - 2*pad) / stages.length, baseY = h/2;
  ctx.font = "11px ui-monospace, monospace"; ctx.textAlign = "center";
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i], x = pad + slotW * (i + 0.5), n = pipelineState.stages[s] || 0;
    const ratio = n / total;
    ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(x - slotW*0.4, baseY - 24, slotW*0.8, 48);
    ctx.fillStyle = colors[s]; ctx.fillRect(x - slotW*0.4, baseY - 24, slotW*0.8 * Math.min(1, ratio), 48);
    ctx.fillStyle = "#e5e7eb"; ctx.fillText(labels[s], x, baseY - 32);
    ctx.fillStyle = "#9ca3af"; ctx.fillText(`${n}/${total}`, x, baseY + 42);
    if (i < stages.length - 1) {
      const ax = x + slotW*0.42;
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, baseY); ctx.lineTo(ax + slotW*0.16, baseY); ctx.stroke();
    }
  }
  ctx.textAlign = "left"; ctx.font = "10.5px ui-monospace, monospace"; ctx.fillStyle = "rgba(156,163,175,0.9)";
  pipelineState.recent.slice(-3).forEach((r, i, arr) => ctx.fillText(`▸ ${r}`, 12, h - 10 - (arr.length - 1 - i)*14));
  if (pipelineState.stages.error > 0) {
    ctx.fillStyle = "#ef4444"; ctx.fillText(`✗ errors: ${pipelineState.stages.error}`, w - 100, h - 10);
  }
}
function drawWaterfall(w, h) {
  const pad = 24, hits = waterfallHits;
  if (!hits.length) {
    ctx.font = "12px ui-monospace, monospace"; ctx.fillStyle = "rgba(156,163,175,0.6)";
    ctx.fillText("No search yet — ask Sift to find something.", pad, h/2);
    return;
  }
  const barH = Math.min(28, (h - 2*pad) / hits.length - 4);
  let gapIdx = -1, maxGap = 0;
  for (let i = 0; i < hits.length - 1; i++) {
    const g = hits[i].score - hits[i+1].score;
    if (g > maxGap) { maxGap = g; gapIdx = i; }
  }
  const sigGap = (maxGap > 0.04);
  hits.forEach((hit, i) => {
    const y = pad + i * (barH + 4);
    const above = !sigGap || i <= gapIdx;
    const len = (w - 2*pad - 200) * Math.max(0, Math.min(1, hit.score));
    ctx.fillStyle = above ? "rgba(245,158,11,0.85)" : "rgba(156,163,175,0.4)";
    ctx.fillRect(pad + 200, y, len, barH);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(pad + 200 + len, y, (w - 2*pad - 200) - len, barH);
    ctx.font = "11px ui-monospace, monospace"; ctx.fillStyle = above ? "#e5e7eb" : "#6b7280";
    ctx.textAlign = "left"; ctx.fillText(hit.filename || "?", pad, y + barH/2 + 4);
    ctx.textAlign = "right"; ctx.fillStyle = above ? "#fbbf24" : "#6b7280";
    ctx.fillText(hit.score.toFixed(3), pad + 195, y + barH/2 + 4);
    ctx.textAlign = "left";
  });
  if (sigGap && gapIdx >= 0 && gapIdx < hits.length - 1) {
    const y = pad + (gapIdx+1) * (barH + 4) - 2;
    ctx.strokeStyle = "rgba(239,68,68,0.7)"; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    ctx.setLineDash([]); ctx.font = "10px ui-monospace, monospace"; ctx.fillStyle = "#ef4444";
    ctx.fillText("score-gap threshold", pad, y - 3);
  }
}
function tick() {
  if (mode === "constellation" && lastQueryReticle) draw();
  requestAnimationFrame(tick);
}
function setMode(m) {
  mode = m;
  document.querySelectorAll(".mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
  draw();
}

// ── Chat ─────────────────────────────────────────────────────────────────
async function ensureSession() {
  const key = activeProject ? `session_id_${activeProject}` : "session_id";
  let sId = localStorage.getItem(key) || "";
  if (sId) { sessionId = sId; return sessionId; }
  const r = await api("/api/session/new", { method: "POST" });
  sessionId = r.session_id; localStorage.setItem(key, sessionId);
  return sessionId;
}
async function sendChat(text) {
  await ensureSession();
  addMsg("user", text);
  addFeed(`<span class="hl">→</span> POST /api/chat <span>"${escapeHtml(text)}"</span>`);
  const t0 = performance.now();
  try {
    const r = await fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message: text, project_id: activeProject || null }),
    });
    if (!r.ok) {
      addMsg("error", `Error ${r.status}: ${await r.text()}`);
      addFeed(`<span class="err">✗ chat ${r.status}</span>`); return;
    }
    const data = await r.json();
    const ms = Math.round(performance.now() - t0);
    addFeed(`<span class="ok">✓</span> /api/chat <span>${ms}ms</span>${data.tools_used.length ? ` <span class="tool">tools: ${data.tools_used.join(", ")}</span>` : ""}`);
    for (const tool of data.tools_used || []) addMsg("tool", `🛠 ${tool}`);
    const hitsHtml = renderHits(data.found_files || []);
    if (hitsHtml) addMsg("agent", `${escapeHtml(data.reply || "")}${hitsHtml}`, { html: true });
    else addMsg("agent", data.reply || "(no reply)");
    refreshStats();
    if (/find|search|where|locate/i.test(text)) {
      refreshProjection(text);
      try {
        const sr = await api(withProject(`/api/semantic/search?q=${encodeURIComponent(text)}&k=15&min_score=0.0`));
        waterfallHits = sr.hits.map((h) => ({ ...h, score: typeof h.score === "number" ? h.score : 0 }));
        if (lastQueryReticle) {
          const byName = Object.fromEntries(projection.points.map((p) => [p.filename, p]));
          lastQueryReticle.hits = waterfallHits.slice(0, 5)
            .map((h) => byName[h.filename]).filter(Boolean)
            .map((p, i) => ({ x: p.x, y: p.y, score: waterfallHits[i].score || 0 }));
        }
        if (mode === "waterfall") draw();
      } catch (e) {}
    }
  } catch (e) {
    addMsg("error", `Network error: ${e.message}`);
    addFeed(`<span class="err">✗ network ${e.message}</span>`);
  }
}
function renderHits(found) {
  if (!found || !found.length) return "";
  const items = found.slice(0, 5).map((p) => {
    const name = p.split("/").pop();
    return `<div class="hit-card"><span class="name" title="${escapeAttr(p)}">${escapeHtml(name)}</span></div>`;
  });
  return `<div class="hits">${items.join("")}</div>`;
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function escapeAttr(s) { return escapeHtml(s); }

// ── Slash commands ───────────────────────────────────────────────────────
async function handleSlash(text) {
  if (text === "/clear") { log.innerHTML = ""; addFeed("cleared chat"); return true; }
  if (text === "/index" || text === "/index ") { indexActiveProject(); return true; }
  if (text.startsWith("/index ")) { streamIndex(text.slice(7).trim()); return true; }
  if (text === "/undo") { sendChat("undo the last action"); return true; }
  if (text === "/rules") { installRules(); return true; }
  if (text === "/new" || text === "/project") { newProject(); return true; }
  return false;
}

// ── Streaming index ──────────────────────────────────────────────────────
function indexActiveProject() {
  const proj = activeProjectObj();
  if (!proj) {
    addMsg("error", "No active project. Add a project from the sidebar (＋), or use `/index <relative path>` against the repo root.");
    return;
  }
  streamIndex("", proj);
}

function streamIndex(relPath, proj = null) {
  setMode("pipeline");
  pipelineState = { stages: { loaded: 0, embed: 0, insert: 0, done: 0, error: 0 }, total: 0, recent: [] };
  draw();
  const projUsed = proj || activeProjectObj();
  const label = projUsed ? `${projUsed.name}${relPath ? ` /${relPath}` : ""}` : relPath || "(root)";
  addMsg("tool", `🛠 indexing ${label} …`);
  let url = `${API}/api/index/stream`;
  const params = new URLSearchParams();
  if (relPath) params.set("rel_path", relPath);
  if (projUsed) params.set("project", projUsed.id);
  if (params.toString()) url += "?" + params.toString();
  addFeed(`<span class="hl">→</span> SSE /api/index/stream <span>${escapeHtml(label)}</span>`);
  const es = new EventSource(url);
  es.addEventListener("start", (ev) => {
    const d = JSON.parse(ev.data);
    pipelineState.total = d.total;
    addFeed(`<span class="ok">●</span> indexing ${d.total} files at ${escapeHtml(d.root)}`);
    draw();
  });
  es.addEventListener("stage", (ev) => {
    const d = JSON.parse(ev.data);
    if (d.stage in pipelineState.stages) pipelineState.stages[d.stage]++;
    if (d.stage === "loaded") pipelineState.recent.push(d.file);
    if (pipelineState.recent.length > 10) pipelineState.recent.shift();
    draw();
  });
  es.addEventListener("end", (ev) => {
    const d = JSON.parse(ev.data);
    addFeed(`<span class="ok">✓</span> indexing complete (${d.total} files)`);
    addMsg("agent", `Indexed ${d.total} file(s).`);
    es.close();
    refreshProjects(); refreshStats(); refreshProjection();
    setTimeout(() => setMode("constellation"), 400);
  });
  es.onerror = () => { addFeed(`<span class="err">✗ SSE error</span>`); es.close(); };
}

// ── Install rules ────────────────────────────────────────────────────────
async function installRules() {
  try {
    const r = await fetch(`${API}/api/install_rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rel_path: "", project: activeProject || "" }),
    });
    const d = await r.json();
    addMsg("tool", `🛠 wrote agent rules to:\n${(d.written || []).join("\n")}`);
    addFeed(`<span class="ok">✓</span> rules installed in ${escapeHtml(d.target)}`);
  } catch (e) { addMsg("error", `install_rules failed: ${e.message}`); }
}

// ── Wiring ───────────────────────────────────────────────────────────────
window.addEventListener("resize", () => { fitCanvas(); draw(); });
document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
$("btn-undo").addEventListener("click", () => sendChat("undo the last action"));
$("btn-rules").addEventListener("click", installRules);
$("btn-settings").addEventListener("click", () => addMsg("tool", "Settings: edit .env at repo root, restart the app."));
$("btn-new-project").addEventListener("click", newProject);
$("btn-index-active").addEventListener("click", indexActiveProject);
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
  $("msg").value = c.dataset.cmd; $("msg").focus();
}));
$("chat-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const txt = $("msg").value.trim(); if (!txt) return;
  $("msg").value = "";
  if (await handleSlash(txt)) return;
  sendChat(txt);
});
$("msg").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
    ev.preventDefault(); $("chat-form").requestSubmit();
  }
});

// ── Init ─────────────────────────────────────────────────────────────────
fitCanvas(); draw(); tick();
refreshHealth();
refreshProjects().then(() => { refreshStats(); refreshProjection(); });
setInterval(refreshHealth, 10000);
setInterval(refreshStats, 8000);
addFeed(`<span class="hl">●</span> Sift desktop ready · API ${API}`);
addMsg("agent", "Hi — I'm Sift. Click ＋ in the Projects sidebar to add a folder, then ⟳ Index project to embed it. Ask me to find anything semantically afterward.");
