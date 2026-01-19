import path from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'

export type Repo = {
  id: number
  name: string
  path: string
  createdAt: string
}

export type TaskStatus = 'proposed' | 'backlog' | 'in_progress' | 'done'

export type Task = {
  id: number
  repoId: number
  title: string
  status: TaskStatus
  createdAt: string
}

export type TaskNote = {
  taskId: number
  content: string
  updatedAt: string
}

export type AgentSession = {
  id: number
  repoId: number
  taskId: number | null
  agentKey: string
  createdAt: string
}

export type AgentMessage = {
  id: number
  sessionId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export type AgentRun = {
  id: string
  sessionId: number
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  command: string
  cwd: string
  startedAt: string
  endedAt: string | null
}

export type PlannerThread = {
  id: number
  repoId: number
  title: string
  worktreePath: string
  baseBranch: string
  model: string | null
  reasoningEffort: string | null
  sandbox: string | null
  approval: string | null
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
}

export type PlannerMessage = {
  id: number
  threadId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export type PlannerRun = {
  id: string
  threadId: number
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  command: string
  cwd: string
  startedAt: string
  endedAt: string | null
}

type RepoRow = {
  id: number
  name: string
  path: string
  created_at: string
}

type TaskRow = {
  id: number
  repo_id: number
  title: string
  status: TaskStatus
  created_at: string
}

type TaskNoteRow = {
  task_id: number
  content: string
  updated_at: string
}

type AgentSessionRow = {
  id: number
  repo_id: number
  task_id: number | null
  agent_key: string
  created_at: string
}

type AgentMessageRow = {
  id: number
  session_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

type AgentRunRow = {
  id: string
  session_id: number
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  command: string
  cwd: string
  started_at: string
  ended_at: string | null
}

type PlannerThreadRow = {
  id: number
  repo_id: number
  title: string
  worktree_path: string
  base_branch: string
  model: string | null
  reasoning_effort: string | null
  sandbox: string | null
  approval: string | null
  created_at: string
  updated_at: string
  last_used_at: string | null
}

type PlannerMessageRow = {
  id: number
  thread_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

type PlannerRunRow = {
  id: string
  thread_id: number
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  command: string
  cwd: string
  started_at: string
  ended_at: string | null
}

let db: Database.Database | null = null

export function getDbPath() {
  return path.join(app.getPath('userData'), 'agent-playground.sqlite3')
}

export function initDb() {
  if (db) return
  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_repo_status ON tasks(repo_id, status);
    CREATE TABLE IF NOT EXISTS task_notes (
      task_id INTEGER PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      task_id INTEGER,
      agent_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_repo ON agent_sessions(repo_id);
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, created_at);
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      session_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);
    CREATE TABLE IF NOT EXISTS agent_run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agent_run_events_run ON agent_run_events(run_id);
    CREATE TABLE IF NOT EXISTS planner_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      worktree_path TEXT NOT NULL,
      base_branch TEXT NOT NULL,
      model TEXT,
      reasoning_effort TEXT,
      sandbox TEXT,
      approval TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_planner_threads_repo ON planner_threads(repo_id, created_at);
    CREATE TABLE IF NOT EXISTS planner_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES planner_threads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_planner_messages_thread ON planner_messages(thread_id, created_at);
    CREATE TABLE IF NOT EXISTS planner_runs (
      id TEXT PRIMARY KEY,
      thread_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      FOREIGN KEY (thread_id) REFERENCES planner_threads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_planner_runs_thread ON planner_runs(thread_id);
    CREATE TABLE IF NOT EXISTS planner_run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES planner_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_planner_run_events_run ON planner_run_events(run_id);
  `)
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

function mapRepo(row: RepoRow): Repo {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
  }
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    repoId: row.repo_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
  }
}

function mapTaskNote(row: TaskNoteRow): TaskNote {
  return {
    taskId: row.task_id,
    content: row.content,
    updatedAt: row.updated_at,
  }
}

function mapAgentSession(row: AgentSessionRow): AgentSession {
  return {
    id: row.id,
    repoId: row.repo_id,
    taskId: row.task_id,
    agentKey: row.agent_key,
    createdAt: row.created_at,
  }
}

function mapAgentMessage(row: AgentMessageRow): AgentMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

function mapAgentRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    command: row.command,
    cwd: row.cwd,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function mapPlannerThread(row: PlannerThreadRow): PlannerThread {
  return {
    id: row.id,
    repoId: row.repo_id,
    title: row.title,
    worktreePath: row.worktree_path,
    baseBranch: row.base_branch,
    model: row.model,
    reasoningEffort: row.reasoning_effort,
    sandbox: row.sandbox,
    approval: row.approval,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  }
}

function mapPlannerMessage(row: PlannerMessageRow): PlannerMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

function mapPlannerRun(row: PlannerRunRow): PlannerRun {
  return {
    id: row.id,
    threadId: row.thread_id,
    status: row.status,
    command: row.command,
    cwd: row.cwd,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

export function listRepos(): Repo[] {
  const rows = getDb()
    .prepare<RepoRow>('SELECT id, name, path, created_at FROM repos ORDER BY created_at DESC')
    .all()
  return rows.map(mapRepo)
}

export function getRepoById(id: number): Repo | null {
  const row = getDb()
    .prepare<RepoRow>('SELECT id, name, path, created_at FROM repos WHERE id = ?')
    .get(id)
  return row ? mapRepo(row) : null
}

export function addRepo(repoPath: string): Repo {
  const name = path.basename(repoPath)
  const info = getDb()
    .prepare('INSERT OR IGNORE INTO repos (name, path) VALUES (?, ?)')
    .run(name, repoPath)

  if (info.changes === 0) {
    const existing = getDb()
      .prepare<RepoRow>('SELECT id, name, path, created_at FROM repos WHERE path = ?')
      .get(repoPath)
    if (!existing) {
      throw new Error('Failed to load existing repo')
    }
    return mapRepo(existing)
  }

  const created = getDb()
    .prepare<RepoRow>('SELECT id, name, path, created_at FROM repos WHERE id = ?')
    .get(info.lastInsertRowid)
  if (!created) {
    throw new Error('Failed to load created repo')
  }
  return mapRepo(created)
}

export function listTasks(repoId?: number): Task[] {
  if (repoId) {
    const rows = getDb()
      .prepare<TaskRow>('SELECT id, repo_id, title, status, created_at FROM tasks WHERE repo_id = ? ORDER BY created_at DESC')
      .all(repoId)
    return rows.map(mapTask)
  }
  const rows = getDb()
    .prepare<TaskRow>('SELECT id, repo_id, title, status, created_at FROM tasks ORDER BY created_at DESC')
    .all()
  return rows.map(mapTask)
}

export function getTaskById(taskId: number): Task | null {
  const row = getDb()
    .prepare<TaskRow>('SELECT id, repo_id, title, status, created_at FROM tasks WHERE id = ?')
    .get(taskId)
  return row ? mapTask(row) : null
}

export function addTask(repoId: number, title: string, status: TaskStatus): Task {
  const info = getDb()
    .prepare('INSERT INTO tasks (repo_id, title, status) VALUES (?, ?, ?)')
    .run(repoId, title, status)
  const created = getDb()
    .prepare<TaskRow>('SELECT id, repo_id, title, status, created_at FROM tasks WHERE id = ?')
    .get(info.lastInsertRowid)
  if (!created) {
    throw new Error('Failed to load created task')
  }
  return mapTask(created)
}

export function updateTaskStatus(taskId: number, status: TaskStatus): Task {
  const info = getDb()
    .prepare('UPDATE tasks SET status = ? WHERE id = ?')
    .run(status, taskId)
  if (info.changes === 0) {
    throw new Error('Task not found')
  }
  const updated = getDb()
    .prepare<TaskRow>('SELECT id, repo_id, title, status, created_at FROM tasks WHERE id = ?')
    .get(taskId)
  if (!updated) {
    throw new Error('Failed to load updated task')
  }
  return mapTask(updated)
}

export function deleteTask(taskId: number): { id: number } {
  const info = getDb()
    .prepare('DELETE FROM tasks WHERE id = ?')
    .run(taskId)
  if (info.changes === 0) {
    throw new Error('Task not found')
  }
  return { id: taskId }
}

export function getTaskNote(taskId: number): TaskNote | null {
  const row = getDb()
    .prepare<TaskNoteRow>('SELECT task_id, content, updated_at FROM task_notes WHERE task_id = ?')
    .get(taskId)
  return row ? mapTaskNote(row) : null
}

export function upsertTaskNote(taskId: number, content: string): TaskNote {
  getDb()
    .prepare('INSERT INTO task_notes (task_id, content, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(task_id) DO UPDATE SET content = excluded.content, updated_at = datetime(\'now\')')
    .run(taskId, content)
  const row = getDb()
    .prepare<TaskNoteRow>('SELECT task_id, content, updated_at FROM task_notes WHERE task_id = ?')
    .get(taskId)
  if (!row) {
    throw new Error('Failed to load task note')
  }
  return mapTaskNote(row)
}

export function listAgentSessions(repoId?: number): AgentSession[] {
  if (repoId) {
    const rows = getDb()
      .prepare<AgentSessionRow>(
        'SELECT id, repo_id, task_id, agent_key, created_at FROM agent_sessions WHERE repo_id = ? ORDER BY created_at DESC'
      )
      .all(repoId)
    return rows.map(mapAgentSession)
  }
  const rows = getDb()
    .prepare<AgentSessionRow>('SELECT id, repo_id, task_id, agent_key, created_at FROM agent_sessions ORDER BY created_at DESC')
    .all()
  return rows.map(mapAgentSession)
}

export function getAgentSessionById(sessionId: number): AgentSession | null {
  const row = getDb()
    .prepare<AgentSessionRow>('SELECT id, repo_id, task_id, agent_key, created_at FROM agent_sessions WHERE id = ?')
    .get(sessionId)
  return row ? mapAgentSession(row) : null
}

export function createAgentSession(repoId: number, agentKey: string, taskId?: number | null): AgentSession {
  const info = getDb()
    .prepare('INSERT INTO agent_sessions (repo_id, task_id, agent_key) VALUES (?, ?, ?)')
    .run(repoId, taskId ?? null, agentKey)
  const row = getDb()
    .prepare<AgentSessionRow>('SELECT id, repo_id, task_id, agent_key, created_at FROM agent_sessions WHERE id = ?')
    .get(info.lastInsertRowid)
  if (!row) {
    throw new Error('Failed to load created session')
  }
  return mapAgentSession(row)
}

export function listAgentMessages(sessionId: number): AgentMessage[] {
  const rows = getDb()
    .prepare<AgentMessageRow>(
      'SELECT id, session_id, role, content, created_at FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC'
    )
    .all(sessionId)
  return rows.map(mapAgentMessage)
}

export function addAgentMessage(sessionId: number, role: AgentMessage['role'], content: string): AgentMessage {
  const info = getDb()
    .prepare('INSERT INTO agent_messages (session_id, role, content) VALUES (?, ?, ?)')
    .run(sessionId, role, content)
  const row = getDb()
    .prepare<AgentMessageRow>('SELECT id, session_id, role, content, created_at FROM agent_messages WHERE id = ?')
    .get(info.lastInsertRowid)
  if (!row) {
    throw new Error('Failed to load created message')
  }
  return mapAgentMessage(row)
}

export function createAgentRun(run: {
  id: string
  sessionId: number
  status: AgentRun['status']
  command: string
  cwd: string
}): AgentRun {
  getDb()
    .prepare('INSERT INTO agent_runs (id, session_id, status, command, cwd) VALUES (?, ?, ?, ?, ?)')
    .run(run.id, run.sessionId, run.status, run.command, run.cwd)
  const row = getDb()
    .prepare<AgentRunRow>('SELECT id, session_id, status, command, cwd, started_at, ended_at FROM agent_runs WHERE id = ?')
    .get(run.id)
  if (!row) {
    throw new Error('Failed to load agent run')
  }
  return mapAgentRun(row)
}

export function updateAgentRunStatus(runId: string, status: AgentRun['status']): AgentRun {
  getDb()
    .prepare('UPDATE agent_runs SET status = ?, ended_at = datetime(\'now\') WHERE id = ?')
    .run(status, runId)
  const row = getDb()
    .prepare<AgentRunRow>('SELECT id, session_id, status, command, cwd, started_at, ended_at FROM agent_runs WHERE id = ?')
    .get(runId)
  if (!row) {
    throw new Error('Failed to load agent run')
  }
  return mapAgentRun(row)
}

export function addAgentRunEvent(runId: string, kind: string, payload: string) {
  getDb()
    .prepare('INSERT INTO agent_run_events (run_id, kind, payload) VALUES (?, ?, ?)')
    .run(runId, kind, payload)
}

export function listPlannerThreads(repoId?: number): PlannerThread[] {
  if (repoId) {
    const rows = getDb()
      .prepare<PlannerThreadRow>(
        'SELECT id, repo_id, title, worktree_path, base_branch, model, reasoning_effort, sandbox, approval, created_at, updated_at, last_used_at FROM planner_threads WHERE repo_id = ? ORDER BY last_used_at DESC, created_at DESC'
      )
      .all(repoId)
    return rows.map(mapPlannerThread)
  }
  const rows = getDb()
    .prepare<PlannerThreadRow>(
      'SELECT id, repo_id, title, worktree_path, base_branch, model, reasoning_effort, sandbox, approval, created_at, updated_at, last_used_at FROM planner_threads ORDER BY last_used_at DESC, created_at DESC'
    )
    .all()
  return rows.map(mapPlannerThread)
}

export function getPlannerThreadById(threadId: number): PlannerThread | null {
  const row = getDb()
    .prepare<PlannerThreadRow>(
      'SELECT id, repo_id, title, worktree_path, base_branch, model, reasoning_effort, sandbox, approval, created_at, updated_at, last_used_at FROM planner_threads WHERE id = ?'
    )
    .get(threadId)
  return row ? mapPlannerThread(row) : null
}

export function createPlannerThread(input: {
  repoId: number
  title: string
  worktreePath: string
  baseBranch: string
  model?: string | null
  reasoningEffort?: string | null
  sandbox?: string | null
  approval?: string | null
}): PlannerThread {
  const info = getDb()
    .prepare(
      'INSERT INTO planner_threads (repo_id, title, worktree_path, base_branch, model, reasoning_effort, sandbox, approval) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      input.repoId,
      input.title,
      input.worktreePath,
      input.baseBranch,
      input.model ?? null,
      input.reasoningEffort ?? null,
      input.sandbox ?? null,
      input.approval ?? null
    )
  const created = getDb()
    .prepare<PlannerThreadRow>(
      'SELECT id, repo_id, title, worktree_path, base_branch, model, reasoning_effort, sandbox, approval, created_at, updated_at, last_used_at FROM planner_threads WHERE id = ?'
    )
    .get(info.lastInsertRowid)
  if (!created) {
    throw new Error('Failed to load created planner thread')
  }
  return mapPlannerThread(created)
}

export function updatePlannerThread(threadId: number, updates: {
  title?: string
  model?: string | null
  reasoningEffort?: string | null
  sandbox?: string | null
  approval?: string | null
}): PlannerThread {
  const existing = getPlannerThreadById(threadId)
  if (!existing) {
    throw new Error('Planner thread not found')
  }
  const next = {
    title: updates.title ?? existing.title,
    model: updates.model !== undefined ? updates.model : existing.model,
    reasoningEffort: updates.reasoningEffort !== undefined ? updates.reasoningEffort : existing.reasoningEffort,
    sandbox: updates.sandbox !== undefined ? updates.sandbox : existing.sandbox,
    approval: updates.approval !== undefined ? updates.approval : existing.approval,
  }
  getDb()
    .prepare(
      'UPDATE planner_threads SET title = ?, model = ?, reasoning_effort = ?, sandbox = ?, approval = ?, updated_at = datetime(\'now\') WHERE id = ?'
    )
    .run(
      next.title,
      next.model,
      next.reasoningEffort,
      next.sandbox,
      next.approval,
      threadId
    )
  const updated = getPlannerThreadById(threadId)
  if (!updated) {
    throw new Error('Failed to load updated planner thread')
  }
  return updated
}

export function deletePlannerThread(threadId: number): { id: number } {
  getDb()
    .prepare(
      'DELETE FROM planner_run_events WHERE run_id IN (SELECT id FROM planner_runs WHERE thread_id = ?)'
    )
    .run(threadId)
  getDb()
    .prepare('DELETE FROM planner_runs WHERE thread_id = ?')
    .run(threadId)
  getDb()
    .prepare('DELETE FROM planner_messages WHERE thread_id = ?')
    .run(threadId)
  const info = getDb()
    .prepare('DELETE FROM planner_threads WHERE id = ?')
    .run(threadId)
  if (info.changes === 0) {
    throw new Error('Planner thread not found')
  }
  return { id: threadId }
}

export function listPlannerMessages(threadId: number): PlannerMessage[] {
  const rows = getDb()
    .prepare<PlannerMessageRow>(
      'SELECT id, thread_id, role, content, created_at FROM planner_messages WHERE thread_id = ? ORDER BY created_at ASC'
    )
    .all(threadId)
  return rows.map(mapPlannerMessage)
}

export function addPlannerMessage(threadId: number, role: PlannerMessage['role'], content: string): PlannerMessage {
  const info = getDb()
    .prepare('INSERT INTO planner_messages (thread_id, role, content) VALUES (?, ?, ?)')
    .run(threadId, role, content)
  getDb()
    .prepare('UPDATE planner_threads SET updated_at = datetime(\'now\'), last_used_at = datetime(\'now\') WHERE id = ?')
    .run(threadId)
  const row = getDb()
    .prepare<PlannerMessageRow>('SELECT id, thread_id, role, content, created_at FROM planner_messages WHERE id = ?')
    .get(info.lastInsertRowid)
  if (!row) {
    throw new Error('Failed to load created planner message')
  }
  return mapPlannerMessage(row)
}

export function createPlannerRun(run: {
  id: string
  threadId: number
  status: PlannerRun['status']
  command: string
  cwd: string
}): PlannerRun {
  getDb()
    .prepare('INSERT INTO planner_runs (id, thread_id, status, command, cwd) VALUES (?, ?, ?, ?, ?)')
    .run(run.id, run.threadId, run.status, run.command, run.cwd)
  const row = getDb()
    .prepare<PlannerRunRow>('SELECT id, thread_id, status, command, cwd, started_at, ended_at FROM planner_runs WHERE id = ?')
    .get(run.id)
  if (!row) {
    throw new Error('Failed to load planner run')
  }
  return mapPlannerRun(row)
}

export function updatePlannerRunStatus(runId: string, status: PlannerRun['status']): PlannerRun {
  getDb()
    .prepare('UPDATE planner_runs SET status = ?, ended_at = datetime(\'now\') WHERE id = ?')
    .run(status, runId)
  const row = getDb()
    .prepare<PlannerRunRow>('SELECT id, thread_id, status, command, cwd, started_at, ended_at FROM planner_runs WHERE id = ?')
    .get(runId)
  if (!row) {
    throw new Error('Failed to load planner run')
  }
  return mapPlannerRun(row)
}

export function addPlannerRunEvent(runId: string, kind: string, payload: string) {
  getDb()
    .prepare('INSERT INTO planner_run_events (run_id, kind, payload) VALUES (?, ?, ?)')
    .run(runId, kind, payload)
}
