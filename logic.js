// ============================================================
// logic.js - scoring, suggestion and workload rules.
// NO user-interface code in this file, so it can be tested alone
// (see test.js). Rules match README section 8.
// ============================================================

const MS_PER_DAY = 86400000;

// ---------- small helpers ----------

function parseDay(str) {                       // "2026-10-13" -> milliseconds (UTC midnight)
  const [y, m, d] = str.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysUntil(deadline, today) {          // whole days from today to deadline
  return Math.round((parseDay(deadline) - parseDay(today || DEMO_TODAY)) / MS_PER_DAY);
}

function round1(n) { return Math.round((n + 1e-9) * 10) / 10; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function relativeDay(days) {                   // text shown in the Due column
  if (days < 0) { const a = Math.abs(days); return a + (a === 1 ? " day" : " days") + " overdue"; }
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "In " + days + " days";
}

// ---------- priority score (README 8.1) ----------

function urgencyScore(days) {                  // 0-10, closer deadline = higher
  if (days <= 1) return 10;                    // overdue, today or tomorrow
  if (days <= 3) return 8;
  if (days <= 7) return 6;
  if (days <= 14) return 4;
  return 2;
}

function quickWinScore(hours) {                // 0-10, shorter task = higher
  if (hours <= 2) return 10;
  if (hours <= 4) return 7;
  if (hours <= 8) return 4;
  return 1;
}

function normalizeWeights(w) {                 // make the three weights total exactly 1
  const total = w.urgency + w.importance + w.quickWin;
  if (!total) return { urgency: 1 / 3, importance: 1 / 3, quickWin: 1 / 3 };
  return { urgency: w.urgency / total, importance: w.importance / total, quickWin: w.quickWin / total };
}

// Returns { score, days, weights, parts: [ {key,label,weight,value,points,detail} ] }
function calcPriority(task, weights, today) {
  const w = normalizeWeights(weights || DEFAULT_WEIGHTS);
  const days = daysUntil(task.deadline, today);
  const parts = [
    { key: "urgency",    label: "Urgency",    weight: w.urgency,    value: urgencyScore(days),
      detail: "Due: " + relativeDay(days) },
    { key: "importance", label: "Importance", weight: w.importance, value: task.importance * 2,
      detail: "Manager rating " + task.importance + "/5, scaled to 0-10" },
    { key: "quickWin",   label: "Quick win",  weight: w.quickWin,   value: quickWinScore(task.effortHours),
      detail: task.effortHours + "h effort" }
  ];
  let raw = 0;
  parts.forEach(p => { raw += p.weight * p.value; p.points = round1(p.weight * p.value); });
  return { score: round1(raw), days, weights: w, parts };
}

// ---------- assignee suggestion (README 8.2) ----------
// loadMap = { memberId: hoursCommittedSoFar }. If a member is missing, baseLoadHours is used.
// Returns { member|null, score, reasons[], rejected[{name,why}], overload, warning, message, candidates[] }
function suggestAssignee(task, members, loadMap) {
  const loads = loadMap || {};
  const candidates = [];
  const rejected = [];

  members.forEach(m => {
    if (!m.available) { rejected.push({ name: m.name, why: "marked unavailable" }); return; }
    if (!m.skills.includes(task.skill)) { rejected.push({ name: m.name, why: "lacks " + task.skill + " skill" }); return; }
    const load = loads[m.id] !== undefined ? loads[m.id] : m.baseLoadHours;
    const freeBefore = m.capacityHours - load;
    const freeAfter = freeBefore - task.effortHours;
    const ratio = clamp(freeAfter / m.capacityHours, -0.5, 1);
    candidates.push({
      member: m, load, freeBefore, freeAfter,
      loadPct: Math.round(load / m.capacityHours * 100),
      score: round1(50 + 50 * ratio),          // 50 for having the skill + up to 50 for free capacity
      overload: freeAfter < 0
    });
  });

  if (candidates.length === 0) {
    const anySkilled = members.some(m => m.skills.includes(task.skill));
    const message = anySkilled
      ? "No suitable assignee: everyone with " + task.skill + " skill is unavailable"
      : "No suitable assignee: nobody has " + task.skill + " skill";
    return { member: null, score: 0, reasons: [], rejected, overload: false, warning: null, message, candidates: [] };
  }

  // best fit first; tie goes to the person with the lower current load %
  candidates.sort((a, b) => b.score - a.score || a.loadPct - b.loadPct);
  const best = candidates[0];

  const lowerFit = candidates.slice(1).map(c => ({
    name: c.member.name,
    why: c.overload
      ? "has the skill, but would exceed capacity by " + (-c.freeAfter) + "h"
      : c.freeBefore + "h free, but lower fit (" + c.score + " vs " + best.score + ")"
  }));

  return {
    member: best.member,
    score: best.score,
    reasons: [
      "Has " + task.skill + " skill",
      best.freeBefore + "h free before this task (" + best.loadPct + "% loaded)",
      "Fit score " + best.score + "/100"
    ],
    rejected: lowerFit.concat(rejected),
    overload: best.overload,
    warning: best.overload ? "Would exceed capacity by " + (-best.freeAfter) + "h" : null,
    message: "",
    candidates
  };
}

// ---------- workload (README 8.3) ----------
// plannedTasks: array of { assigneeId, effortHours, status } (use the plan's effective assignee).
function getWorkload(member, plannedTasks) {
  let hours = member.baseLoadHours;
  plannedTasks.forEach(t => {
    if (t.assigneeId === member.id && t.status !== "Done") hours += t.effortHours;
  });
  const ratio = hours / member.capacityHours;
  return {
    hours,
    capacity: member.capacityHours,
    percent: Math.round(ratio * 100),
    free: Math.max(0, member.capacityHours - hours),
    overloaded: ratio > 1,
    level: ratio > 1 ? "over" : (ratio >= 0.85 ? "high" : "ok")
  };
}

// ---------- the whole plan ----------
// 1. rank tasks by priority; 2. count manual / in-progress / done work first;
// 3. go down the ranked list suggesting an assignee, adding each task to that person's load
//    so one person is not suggested for everything.
// Returns { rows: [ {task, priority, days, locked, effectiveId, suggestion, isOverride} ], workloads, totalFree }
function buildPlan(tasks, members, weights, today) {
  const loadMap = {};
  members.forEach(m => { loadMap[m.id] = m.baseLoadHours; });

  const rows = tasks.map(t => ({ task: t, priority: calcPriority(t, weights, today), days: daysUntil(t.deadline, today) }));
  rows.sort((a, b) => b.priority.score - a.priority.score || a.days - b.days);

  // locked = the manager chose the person, or work has already started / finished
  rows.forEach(r => {
    const t = r.task;
    r.locked = !!t.assigneeId && (t.manual || t.status !== "To Do");
    if (r.locked && t.status !== "Done" && loadMap[t.assigneeId] !== undefined) loadMap[t.assigneeId] += t.effortHours;
  });

  rows.forEach(r => {
    const t = r.task;
    if (r.locked) {
      const temp = Object.assign({}, loadMap);               // what would we suggest, ignoring this task's own hours?
      if (t.status !== "Done" && temp[t.assigneeId] !== undefined) temp[t.assigneeId] -= t.effortHours;
      r.suggestion = suggestAssignee(t, members, temp);
      r.effectiveId = t.assigneeId;
      r.isOverride = !!t.manual && (!r.suggestion.member || r.suggestion.member.id !== t.assigneeId);
    } else {
      r.suggestion = suggestAssignee(t, members, loadMap);
      r.effectiveId = r.suggestion.member ? r.suggestion.member.id : null;
      r.isOverride = false;
      if (r.effectiveId) loadMap[r.effectiveId] += t.effortHours;
    }
  });

  const planned = rows.map(r => ({ assigneeId: r.effectiveId, effortHours: r.task.effortHours, status: r.task.status }));
  const workloads = {};
  let totalFree = 0;
  members.forEach(m => {
    workloads[m.id] = getWorkload(m, planned);
    if (m.available) totalFree += workloads[m.id].free;   // people who are away add no capacity
  });

  return { rows, workloads, totalFree };
}