# Orchestrator Agent MVP (Task 24)

## Goal
Create an “orchestrator agent” that can:
- Read the Kanban board, decide what to do next, and spawn multiple headless worker agents.
- Run workers incrementally or in parallel with proper worktree isolation.
- Gate `done` behind a validation layer.

## Non-goals (initial MVP)
- Perfect task decomposition or optimal scheduling.
- Fully automated conflict resolution.
- Complex UI polish; focus on visibility + control.

## Guiding constraints
- Prefer deterministic state machines in the app; LLMs propose actions, but the app enforces policy.
- Preserve auditability: store orchestration decisions, spawned runs, and validation results.
- Concurrency must be bounded and cancelable.

## Kanban process note
While implementing, update the Kanban board continuously:
- Move the task you are actively implementing to `in_progress`.
- Move tasks to `done` only after validation gates succeed.

## MVP task breakdown (Kanban)
- Task 25: Define orchestrator DB schema + lifecycle
- Task 26: Implement orchestrator run engine (main process)
- Task 27: Task assignment + worker thread management
- Task 28: Worktree strategy: base from origin/main option
- Task 29: Merge/integration workflow (branch-per-task)
- Task 30: Validation gate (worker + orchestrator)
- Task 31: Orchestrator UI: run dashboard + controls
- Task 32: Orchestrator observability: events/logs + cancel
- Task 33: Docs: orchestration workflow + safety
- Task 34: Orchestrator resume/recovery
- Task 35: Task state policy (failed/blocked/canceled + retries)
- Task 36: Cleanup semantics (worktrees/branches + orphan detection)
- Task 37: Orchestrator config surface (defaults + UI)
- Task 38: Conflict handling policy (merge failures)
- Task 39: Validation artifact retention (logs + outputs)

## Suggested lifecycle (high level)
1) Orchestrator run created with config (repo, concurrency, base ref policy, validation commands).
2) Orchestrator selects candidate tasks (e.g., `backlog` → `in_progress` as claimed).
3) For each claimed task, orchestrator provisions a worker worktree (branch-per-task) and spawns a worker run.
4) Worker produces changes + runs worker validation.
5) Orchestrator attempts merge into integration branch (or updates PR/branch).
6) Orchestrator runs integration validation.
7) If validation passes: mark task `done` (and optionally merge to `main`).

## Risks / assumptions
- Assumes consistent local git state; if basing from `origin/main`, orchestrator must fetch and handle offline cases.
- Branch/worktree cleanup must be robust (avoid leaking worktrees).
- Parallel tasks will sometimes conflict; MVP should surface conflicts and fall back to sequential/interactive resolution.
- Validation commands must be configurable and repo-specific.
