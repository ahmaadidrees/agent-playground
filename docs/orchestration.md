# Orchestrator Agent Workflow

## Overview
- The orchestrator runs in the Electron main process and coordinates multiple headless Codex workers.
- It claims Kanban backlog tasks, spawns isolated worktrees, merges work into an integration branch, and gates completion on validation.
- Run + task lifecycle is persisted in SQLite for auditability.

## Lifecycle
1) Start a run for a repo (optionally configure concurrency, base ref, validations).
2) Create an integration worktree on a dedicated branch (`orchestrator/run-<id>`).
3) Claim backlog tasks (move to `in_progress`) and enqueue them.
4) For each task, create a branch worktree (`orchestrator/task-<taskId>-<shortId>`).
5) Run the worker agent in the task worktree.
6) Optional worker validation (per task).
7) Commit changes, merge into the integration branch.
8) Optional integration validation (post-merge).
9) Mark the task `done` only if validations pass and merge succeeds.

## Configuration (current UI fields)
- `concurrency`: Max simultaneous workers.
- `baseBranch`: Git ref to base from (use `origin/main` to base from latest remote).
- `conflictPolicy`: `continue` or `halt` when a merge conflict occurs.
- `workerValidationCommand`: Command run in each task worktree after the agent finishes.
- `integrationValidationCommand`: Command run in the integration worktree after each merge.

## Safety & failure handling
- Worker failures or validation failures mark tasks `failed`.
- Merge conflicts trigger merge abort and mark the task `blocked`.
- Canceling a run stops queued tasks and SIGTERMs active workers.
- Only `done` tasks are considered validated + merged.

## Task states & retries
- Orchestrator uses explicit terminal states: `failed`, `blocked`, `canceled`, `done`.
- Tasks stay `in_progress` during retries and return to `backlog` only when halted.
- Retry count is bounded by `maxAttempts` (default 2).

## Observability
- Run events are recorded in `orchestrator_run_events`.
- The UI shows recent events for the active run.
- Validation output is retained in `orchestrator_validation_artifacts`.

## Worktrees & cleanup
- Worktrees live under the app user data directory at `orchestrator-worktrees/`.
- Cleanup automation is tracked separately (see Kanban task 36).
