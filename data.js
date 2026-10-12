// ============================================================
// MOCK DATA - sample data for demo purposes only.
// This is NOT real evidence about any real team or project.
// ============================================================

// Skills used in this sample: Frontend, Backend, Design, Testing, Docs, Data

const MEMBERS = [
  { id: "m1", name: "Aarav", role: "Frontend Dev",  skills: ["Frontend", "Design"],   capacityHours: 30, baseLoadHours: 8,  available: true },
  { id: "m2", name: "Diya",  role: "Backend Dev",   skills: ["Backend", "Data"],      capacityHours: 30, baseLoadHours: 22, available: true },
  { id: "m3", name: "Kabir", role: "Full-stack",    skills: ["Frontend", "Backend"],  capacityHours: 25, baseLoadHours: 10, available: true },
  { id: "m4", name: "Meera", role: "QA / Docs",     skills: ["Testing", "Docs"],      capacityHours: 20, baseLoadHours: 5,  available: true },
  { id: "m5", name: "Rohan", role: "Data Analyst",  skills: ["Data", "Docs"],         capacityHours: 20, baseLoadHours: 12, available: true }
];

// status: "To Do" | "In Progress" | "Done"
// importance: 1 (low) to 5 (critical)
// assigneeId: null = not assigned yet; manual: true if the manager overrode the suggestion
const TASKS = [
  { id: "t1",  title: "Fix login page bug",            importance: 5, deadline: "2026-10-14", effortHours: 4,  skill: "Frontend", status: "To Do",       assigneeId: null, manual: false },
  { id: "t2",  title: "Build payment API endpoint",    importance: 5, deadline: "2026-10-16", effortHours: 12, skill: "Backend",  status: "To Do",       assigneeId: null, manual: false },
  { id: "t3",  title: "Design onboarding screens",     importance: 3, deadline: "2026-10-20", effortHours: 10, skill: "Design",   status: "To Do",       assigneeId: null, manual: false },
  { id: "t4",  title: "Write regression test suite",   importance: 4, deadline: "2026-10-17", effortHours: 8,  skill: "Testing",  status: "In Progress", assigneeId: "m4", manual: false },
  { id: "t5",  title: "Clean customer dataset",        importance: 3, deadline: "2026-10-19", effortHours: 6,  skill: "Data",     status: "To Do",       assigneeId: null, manual: false },
  { id: "t6",  title: "Update API documentation",      importance: 2, deadline: "2026-10-25", effortHours: 5,  skill: "Docs",     status: "To Do",       assigneeId: null, manual: false },
  { id: "t7",  title: "Dashboard chart component",     importance: 4, deadline: "2026-10-18", effortHours: 9,  skill: "Frontend", status: "To Do",       assigneeId: null, manual: false },
  { id: "t8",  title: "Database index optimisation",   importance: 3, deadline: "2026-10-22", effortHours: 7,  skill: "Backend",  status: "To Do",       assigneeId: null, manual: false },
  { id: "t9",  title: "Monthly usage report",          importance: 2, deadline: "2026-10-30", effortHours: 6,  skill: "Data",     status: "To Do",       assigneeId: null, manual: false },
  { id: "t10", title: "Mobile layout fixes",           importance: 4, deadline: "2026-10-15", effortHours: 5,  skill: "Frontend", status: "To Do",       assigneeId: null, manual: false },
  { id: "t11", title: "User guide for new feature",    importance: 2, deadline: "2026-10-28", effortHours: 4,  skill: "Docs",     status: "To Do",       assigneeId: null, manual: false },
  { id: "t12", title: "Security review of auth flow",  importance: 5, deadline: "2026-10-13", effortHours: 6,  skill: "Security", status: "To Do",       assigneeId: null, manual: false }
  // t12 needs "Security", which NO member has. This is deliberate:
  // the tool should show "no skilled assignee available" instead of guessing.
];

// Default editable scoring weights (used in Phase 2).
const DEFAULT_WEIGHTS = {
  urgency: 0.4,     // how close the deadline is
  importance: 0.4,  // manager's 1-5 rating
  quickWin: 0.2     // small bonus for short tasks
};