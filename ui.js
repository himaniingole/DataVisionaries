// ============================================================
// ui.js - draws the page and handles clicks, sliders and forms.
// All scoring lives in logic.js; this file only calls it and shows the result.
// ============================================================

const STORAGE_KEY = "workforce-allocator-v2";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AVATAR_COLORS = ["#dbe7ff", "#fbd9d3", "#dcebd9", "#e8dcfb", "#fde5c4", "#d9eef0", "#f3e6c8"];
const STATUSES = ["To Do", "In Progress", "Done"];
const WEIGHT_KEYS = ["urgency", "importance", "quickWin"];

// ---------- state (everything the user can change) ----------

let tasks = [];
let members = [];
let weightPct = { urgency: 40, importance: 40, quickWin: 20 };   // whole percentages that total 100
let selectedId = null;
let plan = null;

const $ = id => document.getElementById(id);
function clone(x) { return JSON.parse(JSON.stringify(x)); }

function pctFromWeights(w) {
  const total = w.urgency + w.importance + w.quickWin;
  const u = Math.round(w.urgency / total * 100);
  const i = Math.round(w.importance / total * 100);
  return { urgency: u, importance: i, quickWin: 100 - u - i };
}
function currentWeights() {
  return { urgency: weightPct.urgency / 100, importance: weightPct.importance / 100, quickWin: weightPct.quickWin / 100 };
}

function setDefaults() {
  tasks = clone(TASKS);
  members = clone(MEMBERS);
  weightPct = pctFromWeights(DEFAULT_WEIGHTS);
}

// ---------- saving (browser localStorage) ----------

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (s && Array.isArray(s.tasks) && Array.isArray(s.members) && s.weightPct && typeof s.weightPct.urgency === "number") {
      tasks = s.tasks; members = s.members; weightPct = s.weightPct;
      return;
    }
  } catch (e) { /* storage unavailable or damaged: fall back to sample data */ }
  setDefaults();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, members, weightPct })); } catch (e) { /* ignore */ }
}

// ---------- small helpers ----------

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function memberById(id) { return members.find(m => m.id === id) || null; }
function shortDate(str) { const p = str.split("-").map(Number); return MONTHS[p[1] - 1] + " " + p[2]; }
function longToday() {
  const d = new Date(parseDay(DEMO_TODAY));
  return WEEKDAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}
function addDays(str, n) { return new Date(parseDay(str) + n * MS_PER_DAY).toISOString().slice(0, 10); }
function fmtWeight(w) { return String(+w.toFixed(2)); }

function nextId(prefix, list) {
  let max = 0;
  list.forEach(x => { const n = parseInt(String(x.id).replace(/\D/g, ""), 10); if (n > max) max = n; });
  return prefix + (max + 1);
}

function allSkills() {
  const set = new Set();
  members.forEach(m => m.skills.forEach(s => set.add(s)));
  tasks.forEach(t => set.add(t.skill));
  return Array.from(set).sort();
}
// "frontend " -> "Frontend" (reuses the spelling that already exists)
function canonSkill(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  const existing = allSkills().find(x => x.toLowerCase() === s.toLowerCase());
  return existing || (s.charAt(0).toUpperCase() + s.slice(1));
}

// ---------- task table ----------

function rowHTML(it, index) {
  const t = it.task, s = it.suggestion;
  const eff = memberById(it.effectiveId);

  // small lines under the assignee dropdown
  let note = "";
  if (it.isOverride) {
    note = '<span class="tag-override">Override</span><span class="sub">Suggested: ' + (s.member ? esc(s.member.name) : "none") + "</span>";
  } else if (s.member) {
    note = '<span class="sub">Suggested: ' + esc(s.member.name) + "</span>";
  } else if (!eff) {
    note = '<span class="sub no-assignee">' + esc(s.message) + "</span>";
  }
  if (eff && !eff.skills.includes(t.skill)) {
    note += '<span class="sub warn">&#9888; ' + esc(eff.name) + " lacks " + esc(t.skill) + " skill</span>";
  }
  if (eff && !eff.available && t.status !== "Done") {
    note += '<span class="sub warn">&#9888; ' + esc(eff.name) + " is unavailable</span>";
  }

  let assignOptions = '<option value="">' + (eff ? "&#8634; Auto (use suggestion)" : "Unassigned") + "</option>";
  members.forEach(m => {
    assignOptions += '<option value="' + m.id + '"' + (m.id === it.effectiveId ? " selected" : "") + ">" + esc(m.name) + "</option>";
  });
  const statusOptions = STATUSES.map(st => "<option" + (st === t.status ? " selected" : "") + ">" + st + "</option>").join("");

  return '<div class="row' + (t.id === selectedId ? " selected" : "") + '" data-id="' + t.id + '">' +
    '<div class="rank">' + String(index + 1).padStart(2, "0") + "</div>" +
    '<div><div class="task-title">' + esc(t.title) + '</div><div class="task-project">' + esc(t.project || "") + "</div></div>" +
    '<div><span class="score' + (index === 0 ? " hot" : "") + '">' + it.priority.score.toFixed(1) + "</span></div>" +
    '<div class="due"><strong>' + shortDate(t.deadline) + '</strong><span class="small ' + (it.days <= 2 ? "due-hot" : "muted") + '">' + relativeDay(it.days) + "</span></div>" +
    "<div><strong>" + t.effortHours + "h</strong></div>" +
    '<div><span class="skill-pill">' + esc(t.skill) + "</span></div>" +
    '<div class="assign-cell"><select class="assign-select" aria-label="Assigned to">' + assignOptions + "</select>" + note + "</div>" +
    '<div><select class="status-select" aria-label="Status">' + statusOptions + "</select></div>" +
    '<div><button class="chev" type="button" aria-label="Why this suggestion?">&#8250;</button></div>' +
    "</div>";
}

function renderTasks() {
  $("taskList").innerHTML = plan.rows.length
    ? plan.rows.map(rowHTML).join("")
    : '<div class="empty">No tasks yet. Click <strong>+ Add task</strong> to create one.</div>';
}

// ---------- team panel ----------

function renderTeam() {
  $("memberCount").textContent = members.length + (members.length === 1 ? " member" : " members");
  $("teamList").innerHTML = members.map((m, i) => {
    const w = plan.workloads[m.id];
    const away = !m.available;
    const chips = m.skills.map(sk => '<span class="chip">' + esc(sk) + "</span>").join("");
    return '<div class="member' + (w.level === "over" && !away ? " over" : "") + (away ? " away" : "") + '">' +
      '<div class="member-top">' +
        '<div class="avatar" style="background:' + AVATAR_COLORS[i % AVATAR_COLORS.length] + '">' + esc(m.name.slice(0, 2).toUpperCase()) + "</div>" +
        '<div><div class="member-name">' + esc(m.name) + '</div><div class="member-role">' + esc(m.role) + "</div></div>" +
        '<div class="member-pct ' + (away ? "" : w.level) + '">' + w.percent + "%" + (w.level === "over" && !away ? ' <span class="bang">!</span>' : "") + "</div>" +
      "</div>" +
      '<div class="chips">' + chips + "</div>" +
      '<div class="bar"><span class="' + (away ? "" : w.level) + '" style="width:' + Math.min(100, w.percent) + '%"></span></div>' +
      '<div class="member-meta"><span>' + w.hours + "h / " + w.capacity + "h</span><span>" + (away ? "unavailable" : w.free + "h available") + "</span></div>" +
      '<div class="member-actions">' +
        '<label class="avail-toggle"><input type="checkbox" class="avail-cb" data-id="' + m.id + '"' + (away ? "" : " checked") + "> Available</label>" +
        (away ? '<span class="away-tag">Away</span>' : "") +
        '<button type="button" class="link-btn edit-member" data-id="' + m.id + '">Edit</button>' +
      "</div>" +
    "</div>";
  }).join("");
  $("capacityFooter").innerHTML = "<strong>" + plan.totalFree + "h</strong> total capacity remains this week (available members only).";
}

// ---------- "Why this suggestion?" panel ----------

function renderWhy() {
  const it = plan.rows.find(r => r.task.id === selectedId);
  if (!it) {
    $("whyDetail").innerHTML = '<div><div class="eyebrow">WHY THIS SUGGESTION?</div><p class="muted">Add a task to see how it is scored and who is suggested.</p></div>';
    return;
  }
  const t = it.task, s = it.suggestion, p = it.priority;

  const lines = p.parts.map(x =>
    "<li><strong>" + x.label + "</strong> " + fmtWeight(x.weight) + " &times; " + x.value + " = " + x.points.toFixed(1) +
    ' <span class="muted small">(' + esc(x.detail) + ")</span></li>"
  ).join("");

  let match;
  if (!s.member) {
    match = '<p class="bad-text">' + esc(s.message) + '.</p><p class="muted small">The tool does not guess. Pick someone manually in the table, or add a member with this skill.</p>';
  } else {
    match = "<p><strong>" + esc(s.member.name) + "</strong>: " + s.reasons.map(esc).join(". ") + ".</p>";
    if (s.warning) match += '<p class="warn-text">&#9888; ' + esc(s.warning) + "</p>";
  }
  const eff = memberById(it.effectiveId);
  if (it.isOverride) {
    match += '<p class="override-note">You assigned this to <strong>' + (eff ? esc(eff.name) : "nobody") +
      "</strong> instead of the suggested <strong>" + (s.member ? esc(s.member.name) : "nobody") + "</strong>.</p>";
  } else if (it.locked && t.status !== "To Do") {
    match += '<p class="muted small">Assignment is fixed because the task is ' + esc(t.status) + ".</p>";
  }
  if (eff && !eff.skills.includes(t.skill)) {
    match += '<p class="warn-text">&#9888; ' + esc(eff.name) + " does not have the " + esc(t.skill) + " skill.</p>";
  }
  if (eff && !eff.available && t.status !== "Done") {
    match += '<p class="warn-text">&#9888; ' + esc(eff.name) + " is marked unavailable.</p>";
  }

  const others = s.rejected.length
    ? s.rejected.map(r => esc(r.name) + ": " + esc(r.why)).join(" &middot; ")
    : "No other members.";

  $("whyDetail").innerHTML =
    "<div>" +
      '<div class="eyebrow">WHY THIS SUGGESTION? &middot; ' + esc(t.title).toUpperCase() + "</div>" +
      "<h3>Priority score</h3><ul>" + lines + "</ul>" +
      '<div class="total">Total = ' + p.score.toFixed(1) + " / 10</div>" +
      '<div class="edit-line"><button type="button" class="btn small-btn" data-edit-task="' + t.id + '">Edit this task</button></div>' +
    "</div>" +
    "<div>" +
      '<div class="eyebrow">&nbsp;</div>' +
      "<h3>Assignee match</h3>" + match +
      '<div class="others"><div class="eyebrow" style="margin-bottom:4px">OTHERS CONSIDERED</div>' + others + "</div>" +
    "</div>";
}

// ---------- scoring weight sliders ----------

function syncWeights() {
  WEIGHT_KEYS.forEach(k => {
    $("w-" + k).value = weightPct[k];
    $("o-" + k).textContent = weightPct[k] + "%";
  });
  $("weightTotal").textContent = "Total " + (weightPct.urgency + weightPct.importance + weightPct.quickWin) + "%";
}

// Move one slider; the other two share what is left in proportion to their current size.
function setWeight(key, value) {
  value = clamp(Math.round(value), 0, 100);
  const others = WEIGHT_KEYS.filter(k => k !== key);
  const rest = 100 - value;
  const sumOthers = weightPct[others[0]] + weightPct[others[1]];
  const first = sumOthers === 0 ? Math.round(rest / 2) : Math.round(rest * weightPct[others[0]] / sumOthers);
  weightPct[key] = value;
  weightPct[others[0]] = first;
  weightPct[others[1]] = rest - first;
}

// ---------- main render ----------

function render() {
  plan = buildPlan(tasks, members, currentWeights());
  if (!plan.rows.some(r => r.task.id === selectedId)) selectedId = plan.rows.length ? plan.rows[0].task.id : null;
  $("subtitle").textContent = "Operations workspace · " + longToday();
  $("skillList").innerHTML = allSkills().map(s => '<option value="' + esc(s) + '"></option>').join("");
  renderTasks();
  renderTeam();
  renderWhy();
}

// ---------- popup forms ----------

function openModal(id) {
  $(id).hidden = false;
  const first = $(id).querySelector("input:not([type=hidden]), select");
  if (first) first.focus();
}
function closeModals() {
  document.querySelectorAll(".modal").forEach(m => { m.hidden = true; });
}

function openTaskModal(task) {
  const editing = !!task;
  $("taskModalTitle").textContent = editing ? "Edit task" : "Add task";
  $("tf-id").value = editing ? task.id : "";
  $("tf-title").value = editing ? task.title : "";
  $("tf-project").value = editing ? (task.project || "") : "";
  $("tf-importance").value = editing ? String(task.importance) : "3";
  $("tf-deadline").value = editing ? task.deadline : addDays(DEMO_TODAY, 7);
  $("tf-effort").value = editing ? task.effortHours : "4";
  $("tf-skill").value = editing ? task.skill : "";
  $("tf-delete").hidden = !editing;
  $("tf-error").textContent = "";
  openModal("taskModal");
}

function openMemberModal(member) {
  const editing = !!member;
  $("memberModalTitle").textContent = editing ? "Edit member" : "Add member";
  $("mf-id").value = editing ? member.id : "";
  $("mf-name").value = editing ? member.name : "";
  $("mf-role").value = editing ? member.role : "";
  $("mf-skills").value = editing ? member.skills.join(", ") : "";
  $("mf-capacity").value = editing ? member.capacityHours : "30";
  $("mf-load").value = editing ? member.baseLoadHours : "0";
  $("mf-available").checked = editing ? member.available : true;
  $("mf-error").textContent = "";
  openModal("memberModal");
}

$("taskForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("tf-id").value;
  const title = $("tf-title").value.trim();
  const skill = canonSkill($("tf-skill").value);
  const deadline = $("tf-deadline").value;
  const effort = Number($("tf-effort").value);
  const importance = Number($("tf-importance").value);

  let err = "";
  if (!title) err = "Please enter a title.";
  else if (!skill) err = "Please enter the required skill.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) err = "Please pick a deadline.";
  else if (!(effort > 0)) err = "Effort must be more than 0 hours.";
  if (err) { $("tf-error").textContent = err; return; }

  if (id) {
    const t = tasks.find(x => x.id === id);
    Object.assign(t, { title, project: $("tf-project").value.trim(), importance, deadline, effortHours: effort, skill });
    selectedId = id;
  } else {
    const newTask = {
      id: nextId("t", tasks), title, project: $("tf-project").value.trim(),
      importance, deadline, effortHours: effort, skill,
      status: "To Do", assigneeId: null, manual: false
    };
    tasks.push(newTask);
    selectedId = newTask.id;
  }
  closeModals();
  saveState();
  render();
});

$("tf-delete").addEventListener("click", () => {
  const id = $("tf-id").value;
  if (!id || !window.confirm("Delete this task?")) return;
  tasks = tasks.filter(t => t.id !== id);
  selectedId = null;
  closeModals();
  saveState();
  render();
});

$("memberForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("mf-id").value;
  const name = $("mf-name").value.trim();
  const role = $("mf-role").value.trim();
  const skills = [];
  $("mf-skills").value.split(",").map(canonSkill).forEach(s => { if (s && !skills.includes(s)) skills.push(s); });
  const capacity = Number($("mf-capacity").value);
  const load = Number($("mf-load").value);

  let err = "";
  if (!name) err = "Please enter a name.";
  else if (skills.length === 0) err = "Please enter at least one skill.";
  else if (!(capacity > 0)) err = "Capacity must be more than 0 hours.";
  else if (!(load >= 0)) err = "Committed hours cannot be negative.";
  if (err) { $("mf-error").textContent = err; return; }

  const data = { name, role: role || "Team member", skills, capacityHours: capacity, baseLoadHours: load, available: $("mf-available").checked };
  if (id) {
    Object.assign(members.find(m => m.id === id), data);
  } else {
    members.push(Object.assign({ id: nextId("m", members) }, data));
  }
  closeModals();
  saveState();
  render();
});

$("addTaskBtn").addEventListener("click", () => openTaskModal(null));
$("addMemberBtn").addEventListener("click", () => openMemberModal(null));
$("tf-cancel").addEventListener("click", closeModals);
$("mf-cancel").addEventListener("click", closeModals);
document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m) closeModals(); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });

// ---------- table events ----------

$("taskList").addEventListener("click", e => {
  if (e.target.closest("select")) return;          // opening a dropdown should not re-render the row
  const row = e.target.closest(".row");
  if (!row) return;
  selectedId = row.dataset.id;
  render();
  if (e.target.closest(".chev")) {
    $("whyPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

$("taskList").addEventListener("change", e => {
  const select = e.target;
  const row = select.closest(".row");
  if (!row) return;
  const t = tasks.find(x => x.id === row.dataset.id);
  const planRow = plan.rows.find(r => r.task.id === t.id);

  if (select.classList.contains("assign-select")) {
    if (select.value === "") {                      // back to the tool's own suggestion
      t.assigneeId = null;
      t.manual = false;
    } else {                                        // manual override
      t.assigneeId = select.value;
      t.manual = true;
    }
  } else if (select.classList.contains("status-select")) {
    if (select.value === "To Do") {
      if (!t.manual) t.assigneeId = null;           // unlocked again: the tool may re-suggest
    } else if (!t.assigneeId && planRow.effectiveId) {
      t.assigneeId = planRow.effectiveId;           // started or finished work keeps its owner
    }
    t.status = select.value;
  }
  selectedId = t.id;
  saveState();
  render();
});

$("whyDetail").addEventListener("click", e => {
  const btn = e.target.closest("[data-edit-task]");
  if (btn) openTaskModal(tasks.find(t => t.id === btn.dataset.editTask));
});

// ---------- team events ----------

$("teamList").addEventListener("change", e => {
  if (!e.target.classList.contains("avail-cb")) return;
  const m = memberById(e.target.dataset.id);
  m.available = e.target.checked;                   // the "what if this person is away?" switch
  saveState();
  render();
});

$("teamList").addEventListener("click", e => {
  const btn = e.target.closest(".edit-member");
  if (btn) openMemberModal(memberById(btn.dataset.id));
});

// ---------- weights and reset ----------

$("weightsBox").addEventListener("input", e => {
  const key = e.target.dataset.key;
  if (!key) return;
  setWeight(key, Number(e.target.value));
  syncWeights();
  saveState();
  render();                                         // render() does not rebuild the sliders, so dragging stays smooth
});

$("resetWeights").addEventListener("click", () => {
  weightPct = pctFromWeights(DEFAULT_WEIGHTS);
  syncWeights();
  saveState();
  render();
});

$("resetBtn").addEventListener("click", () => {
  if (!window.confirm("Reset all tasks, members and weights to the sample data?")) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  setDefaults();
  selectedId = null;
  syncWeights();
  render();
});

// ---------- start ----------

loadState();
syncWeights();
render();