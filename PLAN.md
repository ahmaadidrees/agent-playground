# Agent Playground Plan

## Todo
- [x] Add Proposed column + approval flow for tasks
- [x] Add task notes storage + task drawer UI
- [x] Add agent sessions/messages/runs tables + IPC
- [x] Build CLI-only chat panel with agent selector + parallel sessions
- [x] Implement task -> agent actions + create tasks from agent output
- [x] Add tests for parsing/prompt helpers
- [x] Update docs with verification steps

## Verification
- `npm run dev` and confirm: repo attach, Kanban board with Proposed, task drawer notes save
- Create an agent session, send a message, see streaming output
- Click "Create tasks" on a JSON response and approve via Kanban
- Run `npm test`
