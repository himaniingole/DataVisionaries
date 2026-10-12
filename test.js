// Run with:  node test.js
// Tests the rules in logic.js without any browser or UI.
const fs = require("fs");

const code = fs.readFileSync("data.js", "utf8") + "\n" + fs.readFileSync("logic.js", "utf8") +
  "\nreturn { MEMBERS, TASKS, DEFAULT_WEIGHTS, calcPriority, suggestAssignee, getWorkload, buildPlan };";
const L = new Function(code)();

let passed = 0, failed = 0;
function check(name, condition) {
  if (condition) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name); }
}
const clone = x => JSON.parse(JSON.stringify(x));
const byId = (plan, id) => plan.rows.find(r => r.task.id === id);

console.log("\n1. Priority scores (hand-calculated from README rules)");
const expected = { t1: 8.8, t2: 8.6, t3: 7.2, t4: 6.6, t5: 6.4, t6: 5.8, t7: 5.6, t8: 4.8 };
L.TASKS.forEach(t => {
  const s = L.calcPriority(t, L.DEFAULT_WEIGHTS).score;
  check(t.id + " " + t.title + " = " + expected[t.id] + " (got " + s + ")", s === expected[t.id]);
});

console.log("\n2. Plan on the default sample data");
let plan = L.buildPlan(clone(L.TASKS), L.MEMBERS, L.DEFAULT_WEIGHTS);
check("tasks are sorted highest score first", plan.rows.every((r, i) => i === 0 || plan.rows[i - 1].priority.score >= r.priority.score));
check("t1 (Security) has NO suggested assignee", byId(plan, "t1").effectiveId === null);
check("t1 message says nobody has Security skill", /nobody has Security skill/.test(byId(plan, "t1").suggestion.message));
check("t2 login bug goes to Kabir", byId(plan, "t2").effectiveId === "m3");
check("t3 mobile layout goes to Aarav", byId(plan, "t3").effectiveId === "m1");
check("t5 regression tests go to Meera (only tester)", byId(plan, "t5").effectiveId === "m4");
check("no Frontend task goes to Diya or Meera", plan.rows.filter(r => r.task.skill === "Frontend").every(r => ["m1", "m3"].includes(r.effectiveId)));
check("Diya is flagged overloaded (110%)", plan.workloads.m2.overloaded && plan.workloads.m2.percent === 110);
check("Diya is not given extra work", plan.rows.every(r => r.effectiveId !== "m2"));
check("workload hours add up (Kabir = 2 + 4 + 12 + 7 = 25)", plan.workloads.m3.hours === 25);

console.log("\n3. Manual override");
let tasks = clone(L.TASKS);
tasks.find(t => t.id === "t2").assigneeId = "m1";
tasks.find(t => t.id === "t2").manual = true;
plan = L.buildPlan(tasks, L.MEMBERS, L.DEFAULT_WEIGHTS);
check("t2 now belongs to Aarav", byId(plan, "t2").effectiveId === "m1");
check("t2 is marked as an override", byId(plan, "t2").isOverride === true);
check("t2 still remembers the original suggestion (Kabir)", byId(plan, "t2").suggestion.member.id === "m3");
check("Aarav's workload includes t2's 4h (at least 8 + 4)", plan.workloads.m1.hours >= 12);
// An override only MOVES hours between people, so the team total must not change.
// (Other unlocked tasks are re-suggested, so one person's hours can go up or down.)
const totalHours = p => L.MEMBERS.reduce((sum, m) => sum + p.workloads[m.id].hours, 0);
const baselinePlan = L.buildPlan(clone(L.TASKS), L.MEMBERS, L.DEFAULT_WEIGHTS);
check("override moves hours but team total stays the same", totalHours(plan) === totalHours(baselinePlan));

console.log("\n4. Status changes");
tasks = clone(L.TASKS);
plan = L.buildPlan(tasks, L.MEMBERS, L.DEFAULT_WEIGHTS);
const hoursBefore = totalHours(plan);
const t4 = tasks.find(t => t.id === "t4");
t4.assigneeId = byId(plan, "t4").effectiveId;   // what the UI does when work starts
t4.status = "Done";
plan = L.buildPlan(tasks, L.MEMBERS, L.DEFAULT_WEIGHTS);
check("marking t4 Done removes exactly its 12h from the team total", totalHours(plan) === hoursBefore - 12);
check("a Done task keeps its owner", byId(plan, "t4").effectiveId === t4.assigneeId);

console.log("\n5. Edge cases");
let members = clone(L.MEMBERS);
members.find(m => m.id === "m4").available = false;
plan = L.buildPlan(clone(L.TASKS), members, L.DEFAULT_WEIGHTS);
check("unavailable Meera => t5 has no assignee", byId(plan, "t5").effectiveId === null);
check("message says everyone with Testing is unavailable", /unavailable/.test(byId(plan, "t5").suggestion.message));

const heavy = L.buildPlan(clone(L.TASKS), L.MEMBERS, { urgency: 0, importance: 0, quickWin: 1 });
check("weights are normalised even when they are extreme", heavy.rows[0].priority.score > 0);
check("extreme weights re-rank tasks (quick win first)", heavy.rows[0].task.effortHours <= 4);

console.log("\n6. Availability what-if (Aarav on leave)");
members = clone(L.MEMBERS);
members.find(m => m.id === "m1").available = false;
plan = L.buildPlan(clone(L.TASKS), members, L.DEFAULT_WEIGHTS);
check("unavailable Aarav gets no new suggestions", plan.rows.every(r => r.effectiveId !== "m1"));
check("all Frontend tasks move to Kabir", plan.rows.filter(r => r.task.skill === "Frontend").every(r => r.effectiveId === "m3"));
check("Aarav shows as rejected: marked unavailable", /unavailable/.test(JSON.stringify(byId(plan, "t2").suggestion.rejected)));
const freeOfAvailable = members.filter(m => m.available).reduce((s, m) => s + plan.workloads[m.id].free, 0);
check("team free capacity ignores people who are away", plan.totalFree === freeOfAvailable);

console.log("\n7. Newly added data");
let extra = clone(L.TASKS);
extra.push({ id: "t99", title: "Build iOS app", project: "", importance: 3, deadline: "2026-10-30", effortHours: 5, skill: "iOS", status: "To Do", assigneeId: null, manual: false });
plan = L.buildPlan(extra, L.MEMBERS, L.DEFAULT_WEIGHTS);
check("a new task with a skill nobody has gets no assignee", byId(plan, "t99").effectiveId === null);
check("the new task is ranked and scored", byId(plan, "t99").priority.score > 0);

members = clone(L.MEMBERS);
members.push({ id: "m6", name: "Nisha", role: "Security Eng", skills: ["Security"], capacityHours: 20, baseLoadHours: 4, available: true });
plan = L.buildPlan(clone(L.TASKS), members, L.DEFAULT_WEIGHTS);
check("adding a Security person fixes the Security review", byId(plan, "t1").effectiveId === "m6");
check("the new member appears in the workloads", plan.workloads.m6 && plan.workloads.m6.hours === 10);

console.log("\nResult: " + passed + " passed, " + failed + " failed\n");
process.exit(failed ? 1 : 0);