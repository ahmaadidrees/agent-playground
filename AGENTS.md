# Agent Playground Instructions

## Planning agent (Codex)
- Default to the interactive Codex CLI (`codex`) from the repo root.
- You can manage the Kanban via the helper CLI:
  - `node scripts/ap.js tasks list`
  - `node scripts/ap.js tasks add "Title"` (adds a `proposed` task)
  - `node scripts/ap.js plan save <taskId> [path]` (writes the plan doc + updates the task note)
- The helper CLI needs environment variables:
  - `AGENT_PLAYGROUND_DB_PATH` (SQLite DB path; default app location is `~/Library/Application Support/agent-playground/agent-playground.sqlite3`)
  - `AGENT_PLAYGROUND_REPO_PATH` (repo path) or `AGENT_PLAYGROUND_REPO_ID`
- Planner threads run in a worktree, but the DB path + repo ID still point at the main app DB, so `ap.js` writes show up in the Kanban immediately.
- If you want the planner to populate Kanban automatically, have it call `node scripts/ap.js tasks add` instead of only describing tasks.
- If the CLI errors about a `better-sqlite3` module version mismatch, run `npm rebuild better-sqlite3`.
- Plan docs live in `docs/plans/` by default. Use `docs/plans/task-<id>.md` unless specified otherwise.
- When you draft a plan, include a concise checklist of steps and any risks or assumptions.
- When working on tasks, use the Kanban board: set tasks to `in_progress` when you start and to `done` when finished (or `backlog` if you are not ready yet).
