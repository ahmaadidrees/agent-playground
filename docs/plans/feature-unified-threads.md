# Unified Threads + Feature-First Execution

## Context
The current UX splits planner, agents, and orchestrator into separate tabs and hides live execution details. The goal is a single unified Threads panel (planner + execution) and a simplified feature-first workflow where a feature starts a thread, live output is visible, and feature cards show meaningful activity signals.

## Goals
- One Threads panel (planner + execution) with live output and steering.
- Start a feature thread directly from the feature board.
- Show live status/activity on feature cards (thread running, latest event, validation/merge signals).
- Remove the Agents/Orchestrator tabs from the UI.
- Keep agent execution in the same repo/worktree and write to the shared DB.

## Checklist
- [ ] Add unified Threads panel component (planner + execution threads).
- [ ] Add agent-session state + output streaming in `src/App.tsx`.
- [ ] Add IPC to start a feature thread (create session, update metadata, kick off run).
- [ ] Update feature board to show thread state + start/open thread actions.
- [ ] Simplify/remove Agents/Orchestrator tabs and related UI wiring.
- [ ] Smoke test basic flows: plan → create feature → start thread → view output.

## Risks / Assumptions
- Agent sessions currently lack `createdAt` in the front-end type; update is required.
- Needs careful UI/state merging so planner + execution output don’t conflict.
- Some legacy agent/orchestrator code remains; UI should hide it cleanly.
