// ============================================================
// MOCK DATA - sample data for demonstration only.
// These are invented people and tasks. NOT real evidence.
// ============================================================

// Fixed "today" so the demo is repeatable (deadlines below are relative to it).
const DEMO_TODAY = "2026-10-12";

// capacityHours  = hours the person can work this week
// baseLoadHours  = hours already committed elsewhere this week
// available      = false means the person is excluded from suggestions
const MEMBERS = [
  { id: "m1", name: "Aarav", role: "Frontend Dev", skills: ["Frontend", "Design"],  capacityHours: 30, baseLoadHours: 8,  available: true },
  { id: "m2", name: "Diya",  role: "Backend Dev",  skills: ["Backend", "Data"],     capacityHours: 30, baseLoadHours: 33, available: true }, // deliberately overloaded (110%)
  { id: "m3", name: "Kabir", role: "Full-stack",   skills: ["Frontend", "Backend"], capacityHours: 25, baseLoadHours: 2,  available: true },
  { id: "m4", name: "Meera", role: "QA / Docs",    skills: ["Testing", "Docs"],     capacityHours: 20, baseLoadHours: 5,  available: true },
  { id: "m5", name: "Rohan", role: "Data Analyst", skills: ["Data", "Docs"],        capacityHours: 20, baseLoadHours: 12, available: true }
];

// importance : 1 (low) to 5 (critical), set by the manager
// status     : "To Do" | "In Progress" | "Done"
// assigneeId : null = let the tool suggest; manual = true when the manager overrode it
const TASKS = [
  { id: "t1", title: "Security review of auth flow", project: "Identity",   importance: 5, deadline: "2026-10-13", effortHours: 6,  skill: "Security", status: "To Do", assigneeId: null, manual: false },
  // t1 needs "Security" and NOBODY has it. Deliberate: the tool must say
  // "no suitable assignee" instead of guessing.
  { id: "t2", title: "Fix login page bug",           project: "Identity",   importance: 5, deadline: "2026-10-14", effortHours: 4,  skill: "Frontend", status: "To Do", assigneeId: null, manual: false },
  { id: "t3", title: "Mobile layout fixes",          project: "Product UI", importance: 4, deadline: "2026-10-15", effortHours: 5,  skill: "Frontend", status: "To Do", assigneeId: null, manual: false },
  { id: "t4", title: "Build payment API endpoint",   project: "Payments",   importance: 5, deadline: "2026-10-16", effortHours: 12, skill: "Backend",  status: "To Do", assigneeId: null, manual: false },
  { id: "t5", title: "Write regression test suite",  project: "Quality",    importance: 4, deadline: "2026-10-17", effortHours: 8,  skill: "Testing",  status: "To Do", assigneeId: null, manual: false },
  { id: "t6", title: "Dashboard chart component",    project: "Analytics",  importance: 4, deadline: "2026-10-18", effortHours: 9,  skill: "Frontend", status: "To Do", assigneeId: null, manual: false },
  { id: "t7", title: "Clean customer dataset",       project: "Data",       importance: 3, deadline: "2026-10-19", effortHours: 6,  skill: "Data",     status: "To Do", assigneeId: null, manual: false },
  { id: "t8", title: "Database index optimisation",  project: "Platform",   importance: 3, deadline: "2026-10-22", effortHours: 7,  skill: "Backend",  status: "To Do", assigneeId: null, manual: false }
];

// Default scoring weights for the priority score (they always total 1.0).
const DEFAULT_WEIGHTS = {
  urgency: 0.4,     // how close the deadline is
  importance: 0.4,  // manager's 1-5 rating
  quickWin: 0.2     // small bonus for short tasks
};