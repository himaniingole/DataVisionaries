# Workforce Allocator: Task Prioritization & Assignment Aid

> College hackathon project, Problem Statement 14: *Workforce Allocation & Task Prioritization*
> **Team:** [Name 1] (Logic & Data) and [Name 2] (Interface & Demo)

---

## 1. Problem

Team leads usually assign tasks by gut feeling. They have to juggle skills, deadlines, effort and who is already overloaded, and the trade-offs are hard to see. When someone asks "why did you give this to her?", there is often no clear answer.

## 2. Target user

A **team lead / project manager** of a small team (5-15 people) who distributes tasks every week and wants a quick, explainable starting point instead of deciding from memory.

## 3. Our solution

A single-page web app that:

1. Shows all **tasks** with priority score, deadline, effort, required skill and status.
2. Shows all **team members** with skills, capacity and current workload.
3. Uses a **transparent scoring rule** to suggest both the task priority order and a possible assignee, and explains every number.
4. Lets the manager **override** any assignment, change status and edit the scoring weights. The board re-ranks instantly.

**It is a decision aid, not an auto-assigner.** The manager always has the final say.

## 4. Core features

| # | Feature | What the user sees |
|---|---|---|
| 1 | Prioritized task board | Tasks sorted by priority score, with deadline, effort, skill, status |
| 2 | Team panel with workload comparison | Per-member skills and a workload bar (hours used vs capacity), with an overload flag |
| 3 | Suggested assignee with explanation | Click a task and see a "Why?" panel with score breakdown and rejected candidates |
| 4 | Manual override and editable rules | Assignment dropdown, status dropdown, and weight sliders that re-rank tasks live |

## 5. How to run

No installation, build step or internet connection is needed.

1. Download or clone this folder.
2. Open `index.html` in Chrome, Edge or Firefox.
3. Changes are saved in your browser's `localStorage`. Use **Reset data** to restore the sample data.

## 6. Project structure

```
workforce-allocator/
  index.html   page structure
  style.css    styling
  data.js      MOCK sample members, tasks and default weights
  logic.js     scoring, suggestion and workload functions (no UI code)
  ui.js        rendering and event handling (no scoring code)
  README.md    this file
```

`logic.js` and `ui.js` are deliberately separate. The logic can be tested without the interface, and each teammate can work without touching the other's file.

## 7. Data model

**Task**

| Field | Type | Meaning |
|---|---|---|
| `id`, `title` | string | identity |
| `importance` | 1-5 | set by the manager (5 = critical) |
| `deadline` | YYYY-MM-DD | due date |
| `effortHours` | number | estimated hours of work |
| `skill` | string | the one required skill |
| `status` | "To Do" / "In Progress" / "Done" | progress |
| `assigneeId` | string or null | who currently owns it |
| `manual` | boolean | true if the manager overrode the suggestion |

**Member**

| Field | Type | Meaning |
|---|---|---|
| `id`, `name`, `role` | string | identity |
| `skills` | string[] | what they can do |
| `capacityHours` | number | hours available this week |
| `baseLoadHours` | number | hours already committed elsewhere |
| `available` | boolean | false = excluded from suggestions |

**Derived values (calculated, never stored)**

```
workload hours = baseLoadHours + effortHours of tasks assigned to them that are not Done
workload %     = workload hours / capacityHours x 100
```

## 8. How the scoring works (the transparent rules)

All rules are simple on purpose, so a manager can read them and disagree with them.

### 8.1 Priority score (0 to 10, higher = do sooner)

```
priority = (wU x urgency) + (wI x importance) + (wQ x quickWin)
```

Each part is first converted to a 0-10 scale:

| Part | How it is calculated |
|---|---|
| **urgency** | Days left until deadline: overdue or 1 day or less = 10, up to 3 days = 8, up to 7 days = 6, up to 14 days = 4, more than 14 days = 2 |
| **importance** | manager rating x 2 (so 1-5 becomes 2-10) |
| **quickWin** | Effort 2h or less = 10, up to 4h = 7, up to 8h = 4, more than 8h = 1 (a small bonus for easy wins) |

**Default weights:** urgency 0.4, importance 0.4, quickWin 0.2. They are editable with sliders in the UI, and the board re-ranks immediately.

*Example:* a task due tomorrow (urgency 10), importance 5 (10), effort 4h (7):
`0.4 x 10 + 0.4 x 10 + 0.2 x 7 = 9.4`

### 8.2 Assignee suggestion (0 to 100, higher = better fit)

For each task, every team member is checked in turn:

1. **Hard filters (a candidate is rejected if either fails):**
   - the member does not have the required skill
   - the member is marked unavailable
2. **Score for the remaining candidates:**

```
fit = 50 (has the skill)
    + 50 x freeRatio

freeRatio = (capacityHours - currentWorkloadHours - taskEffortHours) / capacityHours
            (limited to the range -0.5 to 1)
```

3. The highest score is suggested. **Ties** go to the person with the lower current workload %.
4. If even the best candidate would go over 100% capacity, the suggestion is shown with an **overload warning**.
5. If **nobody** has the skill, the tool says "No suitable assignee: nobody has skill X" and does not guess.

The "Why?" panel lists every candidate with the points they received or the reason they were rejected.

### 8.3 Workload flags

| Workload % | Flag |
|---|---|
| under 85% | normal |
| 85% to 100% | high (warning colour) |
| over 100% | overloaded (red) |

## 9. Function contract (`logic.js`)

```
calcPriority(task, weights)
  -> { score, days, weights, parts: [ { label, weight, value, points, detail } ] }

suggestAssignee(task, members, loadMap)      // loadMap = { memberId: hours committed so far }
  -> { member | null, score, reasons: [ ... ], rejected: [ { name, why } ],
       overload, warning, message }

getWorkload(member, plannedTasks)            // plannedTasks = [ { assigneeId, effortHours, status } ]
  -> { hours, capacity, percent, free, overloaded, level }   // level: "ok" | "high" | "over"

buildPlan(tasks, members, weights)           // the UI calls this after every change
  -> { rows: [ { task, priority, days, locked, effectiveId, suggestion, isOverride } ],
       workloads, totalFree }
```

**How `buildPlan` avoids piling everything on one person:** it ranks the tasks, counts work that is already
fixed (manual overrides, In Progress, Done) first, then goes down the ranked list and adds each suggested
task to its assignee's load before suggesting the next one. Tasks that are still "To Do" and not overridden
are re-suggested after every change, so one override can shift other suggestions. This is intentional.

Run `node test.js` to check the rules without opening a browser.

## 10. Demo workflow (one complete user journey)

1. Open the board. The tasks are already ranked, with the security review and login bug at the top because their deadlines are closest.
2. Click a task and read the **Why?** panel: priority breakdown, the suggested person, and why the others were rejected.
3. See one task with **no suitable assignee** (the Security Review needs a skill nobody has). The tool says so instead of guessing.
4. **Override** an assignment using the dropdown and watch the workload bars change.
5. See a member turn red when overloaded.
6. Drag the **urgency weight** slider and watch the ranking reorder.
7. Move a task to **In Progress**, then **Done**, and watch the workload update.

## 11. Sample data (important)

All members and tasks in `data.js` are **invented sample data** for demonstration. They are not real people, real projects or real evidence. Deadlines are set relative to the hackathon date (12 Oct 2026).

## 12. Assumptions

- Each task needs exactly **one** skill and goes to **one** person.
- Effort estimates and importance ratings are given by the manager and are assumed to be reasonable.
- Capacity and base load are weekly hours entered by hand.
- A task counts toward someone's workload until it is marked Done.
- Today's date comes from the browser clock.

## 13. Limitations (what this prototype cannot do)

- It is a **rule-based suggestion**, not an optimizer. It assigns task by task and may not find the best overall allocation.
- It does not learn from past data, and it does not predict how long a task will really take.
- There are no skill levels (beginner/expert), only "has skill" or "doesn't".
- There are no task dependencies and no part-time splitting of a task.
- Single user and single browser. Data is stored in `localStorage`, with no login, sync or database.
- No integration with HR, calendar or project-management tools.
- The scoring bands and weights are reasonable defaults, not scientifically validated numbers. That is why they are editable.

## 14. Possible next steps

1. **Unavailability what-if:** mark someone on leave and see the suggestions re-run.
2. A **workload balance indicator** for the whole team.
3. Skill levels and multiple skills per task.
4. Task dependencies and CSV import/export.

## 15. Team roles

| Person | Responsibility |
|---|---|
| [Name 1] | `data.js`, `logic.js`, testing edge cases, this README |
| [Name 2] | `index.html`, `style.css`, `ui.js`, demo script and slides |

## 16. Build status

- [x] Phase 1: data model, sample data, function contract
- [ ] Phase 2: scoring and suggestion logic, task table and team panel
- [ ] Phase 3: "Why?" panel, manual override, editable weights, saving
- [ ] Phase 4: testing edge cases and polish
- [ ] Phase 5: README final check and demo rehearsal