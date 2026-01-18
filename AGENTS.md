# Agent Playground Instructions

## Planning agent (Codex)
- Default to the interactive Codex CLI (`codex`) from the repo root.
- You can manage the Kanban via the helper CLI:
  - `node scripts/ap.js tasks list`
  - `node scripts/ap.js tasks add "Title"` (adds a `proposed` task)
  - `node scripts/ap.js plan save <taskId> [path]` (writes the plan doc + updates the task note)
- Plan docs live in `docs/plans/` by default. Use `docs/plans/task-<id>.md` unless specified otherwise.
- When you draft a plan, include a concise checklist of steps and any risks or assumptions.
