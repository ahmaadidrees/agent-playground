# Feature-First Workflow (Plan)

## Goal
Refactor Agent Playground around a **feature-first** workflow that matches Ahmaad’s personal agent coding loop:

1) Plan a major feature in a dedicated planner thread/worktree.
2) Materialize the plan into **one Feature** with a **collapsible list of Subtasks**.
3) A single agent **owns the Feature** and completes subtasks in any order.
4) The UI prioritizes **observability**: what the agent is doing, where it did it (worktree/branch), and what evidence exists (validations).

## Key decisions (locked)
- **Feature status**: `planned → executed → done`
- **Subtask status**: `todo / doing / done`
- **Ownership**: one agent owns a feature (no per-subtask assignees initially)
- **Merge/Review/Validated**: represented as **indicators**, not additional Kanban columns
- **Needs review**: manual toggle; not auto-cleared by validation
- **Validated**: reflects latest validation only (pass/fail/none)
- **Feature list**: grouped by status (planned/executed/done)
- **Subtask ordering**: manual reorder saved (persisted order)
- **Plan doc link**: stored on the feature (new field), not only in notes

## Non-goals (initial)
- Reintroducing a full orchestrator UI/engine as the primary workflow.
- Complex task decomposition or scheduling automation.
- Per-subtask branching, multi-agent subtasks, or conflict resolution automation.
- Perfect git detection across all edge cases (start with pragmatic local checks).

## Data model changes
### Reinterpret existing `tasks` as `features`
Keep the existing `tasks` table and UI concepts but treat each row as a **Feature**.

### Add subtasks
Add a new table `subtasks`:
- `id` (pk)
- `feature_id` (fk → tasks.id)
- `title`
- `status` (`todo|doing|done`)
- `order_index` (optional; supports stable ordering)
- `created_at`, `updated_at`

### Add feature execution metadata
Add columns on `tasks` (features):
- `base_ref` (TEXT, nullable) – what “done/merged” is measured against (default: detected current branch)
- `worktree_path` (TEXT, nullable) – where the feature was executed
- `branch_name` (TEXT, nullable) – branch used for the feature
- `needs_review` (INTEGER boolean, default 1 when entering `executed`)
- `plan_doc_path` (TEXT, nullable) – path to the plan doc that generated the feature

### Reuse existing validations + runs
- Continue using `task_validations` as **feature-level** validations (UI label changes only).
- Continue using `agent_runs` / `agent_run_events` + streaming output for observability.

## UI/UX changes
### Replace Kanban-first with Feature-first
- Primary view becomes a **Feature List**:
  - Each Feature row shows: title, owner agent, status, counters (`todo/doing/done`), and “truth chips”.
  - Click expands to show subtasks inline (collapsible).
- Selecting a Feature opens a **Feature Drawer** (evolve current `TaskDrawer`):
  - Notes (feature notes)
  - Subtasks editor (add/reorder/status changes)
  - Execution panel (runs + live output + last command)
  - Validation panel (history + latest status badge)
  - Git panel (worktree path, branch name, base ref, merge-needed indicator)

### Indicators (not columns)
Surface these as small badges in list + drawer header:
- **Needs merge** (auto-detect): feature branch has commits not in base ref
- **Needs review** (manual toggle): default on when feature becomes `executed`
- **Validated** (auto): latest validation pass/fail/none

### Remove/soft-deprecate the 8-column board
- Keep legacy statuses in DB only as needed for migration.
- The UI uses the new simplified status set for features.

## Planner → Feature materialization
### Planner threads become Feature Plans
- One planner thread ≈ one feature plan.
- Add a single action: “Create Feature from Thread”:
  - Uses thread title as the default feature title (editable).
  - Parses structured output to create subtasks.
  - Links to plan doc (path stored in feature note or a new feature field).

### Structured plan format (recommended)
Require planner output to include JSON:
```json
{
  "featureTitle": "…",
  "subtasks": [
    { "title": "…", "status": "todo" }
  ]
}
```

## Execution model
- “Run agent on feature” sends a prompt containing:
  - feature title + notes
  - full subtask list (with statuses)
  - repo/worktree/branch/baseRef context
- Agent can complete subtasks in any order; the UI reflects updates via:
  - manual subtask toggles, and/or
  - optionally parsing structured agent updates (follow-up enhancement).

## Git + merge detection (pragmatic default)
- Store `base_ref` (default: detected current branch).
- Store `branch_name` + `worktree_path` when a feature is executed.
- “Needs merge” detection (local):
  - `git rev-list --left-right --count base_ref...branch_name` and treat “right > 0” as needs merge.

## Migration / compatibility
- Existing `tasks` become features:
  - Map current statuses to new ones:
    - `proposed/backlog` → `planned`
    - `in_progress/review/blocked/failed` → `executed` (with indicators + warnings)
    - `done` → `done`
    - `canceled` → hidden/archived (or keep as `planned` with a canceled flag in a later iteration)
- Keep old columns temporarily; migrate UI first, then clean up.
- Clear all current `proposed` tasks on the board by deleting those rows (and any dependent validations/runs) during migration.

## Checklist
- [ ] Add DB schema: `subtasks` table + feature metadata columns
- [ ] Add IPC + DB helpers for subtasks CRUD + feature metadata updates
- [ ] Implement Feature List view with collapsible subtasks
- [ ] Evolve `TaskDrawer` into `FeatureDrawer` (notes + subtasks + activity + git + validations)
- [ ] Update Planner panel: “Create Feature from Thread” flow + JSON extraction
- [ ] Update execution: “Run agent on feature” entry point + ensure runs attach to feature
- [ ] Add merge-needed + validated indicators
- [ ] Add migration mapping for legacy tasks
- [ ] Verify end-to-end workflows (below)

## Verification
- Create a planner thread and produce structured plan JSON.
- Materialize plan into a feature + subtasks; confirm subtasks persist and render collapsed/expanded.
- Assign/claim feature by an agent and start a run; confirm live output + events show in feature drawer.
- Mark subtasks `todo/doing/done` and confirm persistence.
- Run a validation command; confirm validation badge updates.
- Set branch/base ref; confirm “needs merge” indicator toggles correctly.

## Risks / assumptions
- Assumes git is available and repos are in a healthy state; branch detection may fail on detached HEAD.
- Merge detection via local git commands may be slow on very large repos; cache results per feature.
- Planner output parsing needs strict structure to avoid flaky extraction.
- UI scope creep: keep the first pass minimal and observability-first.
