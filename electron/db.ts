import path from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'

export type Repo = {
  id: number
  name: string
  path: string
  createdAt: string
}

export type TaskStatus = 'proposed' | 'backlog' | 'in_progress' | 'review' | 'blocked' | 'failed' | 'canceled' | 'done'

export type Task = {
  id: number
  repoId: number
  title: string
  status: TaskStatus
  createdAt: string
  assignedAgentId: number | null
  claimedAt: string | null
  reviewRequestedAt: string | null
  reviewedAt: string | null
  reviewedByAgentId: number | null
}

export type TaskNote = {
  taskId: number
  content: string
  updatedAt: string
}

export type Agent = {
  id: number
  repoId: number
  name: string
  provider: 'claude' | 'gemini' | 'codex'
  workspacePath: string | null
  status: 'active' | 'paused'
  createdAt: string
  updatedAt: string
}

export type TaskValidation = {
  id: number
  taskId: number
  agentId: number | null
  command: string
  ok: boolean
  output: string
  cwd: string
  createdAt: string
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

export type OrchestratorRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

export type OrchestratorRun = {
  id: string
  repoId: number
  status: OrchestratorRunStatus
  config: Record<string, unknown>
  createdAt: string
  startedAt: string | null
  endedAt: string | null
}

export type OrchestratorTaskRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'blocked'

export type OrchestratorTaskValidationStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped'

export type OrchestratorTaskRun = {
  id: string
  runId: string
  taskId: number
  plannerThreadId: number | null
  status: OrchestratorTaskRunStatus
  validationStatus: OrchestratorTaskValidationStatus
  worktreePath: string | null
  branchName: string | null
  attempt: number
  startedAt: string | null
  endedAt: string | null
  error: string | null
}

export type OrchestratorRunEvent = {
  id: number
  runId: string
  kind: string
  payload: string
  createdAt: string
}

export type OrchestratorValidationArtifact = {
  id: number
  runId: string
  taskRunId: string
  scope: 'worker' | 'integration'
  command: string
  ok: boolean
  output: string
  createdAt: string
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
  assigned_agent_id: number | null
  claimed_at: string | null
  review_requested_at: string | null
  reviewed_at: string | null
  reviewed_by_agent_id: number | null
}

type TaskNoteRow = {
  task_id: number
  content: string
  updated_at: string
}

type AgentRow = {
  id: number
  repo_id: number
  name: string
  provider: Agent['provider']
  workspace_path: string | null
  status: Agent['status']
  created_at: string
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

type TaskValidationRow = {
  id: number
  task_id: number
  agent_id: number | null
  command: string
  ok: number
  output: string
  cwd: string
  created_at: string
}

type OrchestratorRunRow = {
  id: string
  repo_id: number
  status: OrchestratorRunStatus
  config: string
  created_at: string
  started_at: string | null
  ended_at: string | null
}

type OrchestratorTaskRunRow = {
  id: string
  run_id: string
  task_id: number
  planner_thread_id: number | null
  status: OrchestratorTaskRunStatus
  validation_status: OrchestratorTaskValidationStatus
  worktree_path: string | null
  branch_name: string | null
  attempt: number
  started_at: string | null
  ended_at: string | null
  error: string | null
}

type OrchestratorRunEventRow = {
  id: number
  run_id: string
  kind: string
  payload: string
  created_at: string
}

type OrchestratorValidationArtifactRow = {
  id: number
  run_id: string
  task_run_id: string
  scope: 'worker' | 'integration'
  command: string
  ok: number
  output: string
  created_at: string
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
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      workspace_path TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agents_repo ON agents(repo_id, created_at);
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      assigned_agent_id INTEGER,
      claimed_at TEXT,
      review_requested_at TEXT,
      reviewed_at TEXT,
      reviewed_by_agent_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL
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
    CREATE TABLE IF NOT EXISTS task_validations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      agent_id INTEGER,
      command TEXT NOT NULL,
      ok INTEGER NOT NULL,
      output TEXT NOT NULL,
      cwd TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_validations_task ON task_validations(task_id, created_at);
    CREATE TABLE IF NOT EXISTS orchestrator_runs (
      id TEXT PRIMARY KEY,
      repo_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      ended_at TEXT,
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_repo ON orchestrator_runs(repo_id, created_at);
    CREATE TABLE IF NOT EXISTS orchestrator_run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES orchestrator_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_orchestrator_run_events_run ON orchestrator_run_events(run_id);
    CREATE TABLE IF NOT EXISTS orchestrator_task_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      task_id INTEGER NOT NULL,
      planner_thread_id INTEGER,
      status TEXT NOT NULL,
      validation_status TEXT NOT NULL DEFAULT 'pending',
      worktree_path TEXT,
      branch_name TEXT,
      attempt INTEGER NOT NULL DEFAULT 1,
      started_at TEXT,
      ended_at TEXT,
      error TEXT,
      FOREIGN KEY (run_id) REFERENCES orchestrator_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (planner_thread_id) REFERENCES planner_threads(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orchestrator_task_runs_run ON orchestrator_task_runs(run_id);
    CREATE INDEX IF NOT EXISTS idx_orchestrator_task_runs_task ON orchestrator_task_runs(task_id);
    CREATE TABLE IF NOT EXISTS orchestrator_validation_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      task_run_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      command TEXT NOT NULL,
      ok INTEGER NOT NULL,
      output TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES orchestrator_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (task_run_id) REFERENCES orchestrator_task_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_orchestrator_validation_run ON orchestrator_validation_artifacts(run_id);
    CREATE INDEX IF NOT EXISTS idx_orchestrator_validation_task_run ON orchestrator_validation_artifacts(task_run_id);
  `)

  const ensureColumn = (table: string, column: string, definition: string) => {
    const columns = getDb().pragma(`table_info(${table})`) as { name: string }[]
    if (columns.some((item) => item.name === column)) return
    getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }

  ensureColumn('tasks', 'assigned_agent_id', 'INTEGER')
  ensureColumn('tasks', 'claimed_at', 'TEXT')
  ensureColumn('tasks', 'review_requested_at', 'TEXT')
  ensureColumn('tasks', 'reviewed_at', 'TEXT')
  ensureColumn('tasks', 'reviewed_by_agent_id', 'INTEGER')

  getDb().exec('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id)')
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
    assignedAgentId: row.assigned_agent_id,
    claimedAt: row.claimed_at,
    reviewRequestedAt: row.review_requested_at,
    reviewedAt: row.reviewed_at,
    reviewedByAgentId: row.reviewed_by_agent_id,
  }
}

function mapTaskNote(row: TaskNoteRow): TaskNote {
  return {
    taskId: row.task_id,
    content: row.content,
    updatedAt: row.updated_at,
  }
}

function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    repoId: row.repo_id,
    name: row.name,
    provider: row.provider,
    workspacePath: row.workspace_path,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTaskValidation(row: TaskValidationRow): TaskValidation {
  return {
    id: row.id,
    taskId: row.task_id,
    agentId: row.agent_id,
    command: row.command,
    ok: Boolean(row.ok),
    output: row.output,
    cwd: row.cwd,
    createdAt: row.created_at,
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

function safeParseJson(value: string): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function mapOrchestratorRun(row: OrchestratorRunRow): OrchestratorRun {
  return {
    id: row.id,
    repoId: row.repo_id,
    status: row.status,
    config: safeParseJson(row.config),
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function mapOrchestratorTaskRun(row: OrchestratorTaskRunRow): OrchestratorTaskRun {
  return {
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    plannerThreadId: row.planner_thread_id,
    status: row.status,
    validationStatus: row.validation_status,
    worktreePath: row.worktree_path,
    branchName: row.branch_name,
    attempt: row.attempt,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    error: row.error,
  }
}

function mapOrchestratorRunEvent(row: OrchestratorRunEventRow): OrchestratorRunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind,
    payload: row.payload,
    createdAt: row.created_at,
  }
}

function mapOrchestratorValidationArtifact(row: OrchestratorValidationArtifactRow): OrchestratorValidationArtifact {
  return {
    id: row.id,
    runId: row.run_id,
    taskRunId: row.task_run_id,
    scope: row.scope,
    command: row.command,
    ok: Boolean(row.ok),
    output: row.output,
    createdAt: row.created_at,
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
      .prepare<TaskRow>(
        'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE repo_id = ? ORDER BY created_at DESC'
      )
      .all(repoId)
    return rows.map(mapTask)
  }
  const rows = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks ORDER BY created_at DESC'
    )
    .all()
  return rows.map(mapTask)
}

export function getTaskById(taskId: number): Task | null {
  const row = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
    .get(taskId)
  return row ? mapTask(row) : null
}

export function addTask(repoId: number, title: string, status: TaskStatus): Task {
  const info = getDb()
    .prepare('INSERT INTO tasks (repo_id, title, status) VALUES (?, ?, ?)')
    .run(repoId, title, status)
  const created = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
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
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
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

export function listAgents(repoId?: number): Agent[] {
  if (repoId) {
    const rows = getDb()
      .prepare<AgentRow>(
        'SELECT id, repo_id, name, provider, workspace_path, status, created_at, updated_at FROM agents WHERE repo_id = ? ORDER BY created_at DESC'
      )
      .all(repoId)
    return rows.map(mapAgent)
  }
  const rows = getDb()
    .prepare<AgentRow>('SELECT id, repo_id, name, provider, workspace_path, status, created_at, updated_at FROM agents ORDER BY created_at DESC')
    .all()
  return rows.map(mapAgent)
}

export function getAgentById(agentId: number): Agent | null {
  const row = getDb()
    .prepare<AgentRow>('SELECT id, repo_id, name, provider, workspace_path, status, created_at, updated_at FROM agents WHERE id = ?')
    .get(agentId)
  return row ? mapAgent(row) : null
}

export function createAgent(input: {
  repoId: number
  name: string
  provider: Agent['provider']
  workspacePath?: string | null
  status?: Agent['status']
}): Agent {
  const info = getDb()
    .prepare('INSERT INTO agents (repo_id, name, provider, workspace_path, status) VALUES (?, ?, ?, ?, ?)')
    .run(input.repoId, input.name, input.provider, input.workspacePath ?? null, input.status ?? 'active')
  const row = getDb()
    .prepare<AgentRow>('SELECT id, repo_id, name, provider, workspace_path, status, created_at, updated_at FROM agents WHERE id = ?')
    .get(info.lastInsertRowid)
  if (!row) {
    throw new Error('Failed to load created agent')
  }
  return mapAgent(row)
}

export function updateAgent(agentId: number, updates: {
  name?: string
  provider?: Agent['provider']
  workspacePath?: string | null
  status?: Agent['status']
}): Agent {
  const existing = getAgentById(agentId)
  if (!existing) {
    throw new Error('Agent not found')
  }
  const next = {
    name: updates.name ?? existing.name,
    provider: updates.provider ?? existing.provider,
    workspacePath: updates.workspacePath ?? existing.workspacePath,
    status: updates.status ?? existing.status,
  }
  getDb()
    .prepare('UPDATE agents SET name = ?, provider = ?, workspace_path = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(next.name, next.provider, next.workspacePath, next.status, agentId)
  const row = getDb()
    .prepare<AgentRow>('SELECT id, repo_id, name, provider, workspace_path, status, created_at, updated_at FROM agents WHERE id = ?')
    .get(agentId)
  if (!row) {
    throw new Error('Failed to load updated agent')
  }
  return mapAgent(row)
}

export function deleteAgent(agentId: number): { id: number } {
  getDb()
    .prepare('UPDATE tasks SET assigned_agent_id = NULL, claimed_at = NULL WHERE assigned_agent_id = ?')
    .run(agentId)
  getDb()
    .prepare('UPDATE tasks SET reviewed_by_agent_id = NULL WHERE reviewed_by_agent_id = ?')
    .run(agentId)
  const info = getDb()
    .prepare('DELETE FROM agents WHERE id = ?')
    .run(agentId)
  if (info.changes === 0) {
    throw new Error('Agent not found')
  }
  return { id: agentId }
}

export function assignTask(taskId: number, agentId: number | null): Task {
  const info = getDb()
    .prepare(
      `UPDATE tasks
       SET assigned_agent_id = ?,
           claimed_at = CASE WHEN ? IS NULL THEN NULL ELSE COALESCE(claimed_at, datetime('now')) END,
           status = CASE
             WHEN ? IS NOT NULL AND status IN ('backlog', 'proposed') THEN 'in_progress'
             ELSE status
           END
       WHERE id = ?`
    )
    .run(agentId, agentId, agentId, taskId)
  if (info.changes === 0) {
    throw new Error('Task not found')
  }
  const updated = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
    .get(taskId)
  if (!updated) {
    throw new Error('Failed to load updated task')
  }
  return mapTask(updated)
}

export function claimTask(taskId: number, agentId: number): Task {
  const info = getDb()
    .prepare(
      `UPDATE tasks
       SET assigned_agent_id = ?,
           claimed_at = datetime('now'),
           status = CASE
             WHEN status IN ('backlog', 'proposed') THEN 'in_progress'
             ELSE status
           END
       WHERE id = ? AND assigned_agent_id IS NULL`
    )
    .run(agentId, taskId)
  if (info.changes === 0) {
    throw new Error('Task already claimed')
  }
  const updated = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
    .get(taskId)
  if (!updated) {
    throw new Error('Failed to load updated task')
  }
  return mapTask(updated)
}

export function releaseTask(taskId: number): Task {
  const info = getDb()
    .prepare(
      `UPDATE tasks
       SET assigned_agent_id = NULL,
           claimed_at = NULL,
           status = CASE
             WHEN status = 'in_progress' THEN 'backlog'
             ELSE status
           END
       WHERE id = ?`
    )
    .run(taskId)
  if (info.changes === 0) {
    throw new Error('Task not found')
  }
  const updated = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
    .get(taskId)
  if (!updated) {
    throw new Error('Failed to load updated task')
  }
  return mapTask(updated)
}

export function requestTaskReview(taskId: number): Task {
  const info = getDb()
    .prepare(`UPDATE tasks SET status = 'review', review_requested_at = datetime('now') WHERE id = ?`)
    .run(taskId)
  if (info.changes === 0) {
    throw new Error('Task not found')
  }
  const updated = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
    .get(taskId)
  if (!updated) {
    throw new Error('Failed to load updated task')
  }
  return mapTask(updated)
}

export function approveTaskReview(taskId: number, reviewerAgentId?: number | null): Task {
  const info = getDb()
    .prepare(`UPDATE tasks SET status = 'done', reviewed_at = datetime('now'), reviewed_by_agent_id = ? WHERE id = ?`)
    .run(reviewerAgentId ?? null, taskId)
  if (info.changes === 0) {
    throw new Error('Task not found')
  }
  const updated = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
    .get(taskId)
  if (!updated) {
    throw new Error('Failed to load updated task')
  }
  return mapTask(updated)
}

export function requestTaskChanges(taskId: number): Task {
  const info = getDb()
    .prepare(`UPDATE tasks SET status = 'in_progress' WHERE id = ?`)
    .run(taskId)
  if (info.changes === 0) {
    throw new Error('Task not found')
  }
  const updated = getDb()
    .prepare<TaskRow>(
      'SELECT id, repo_id, title, status, created_at, assigned_agent_id, claimed_at, review_requested_at, reviewed_at, reviewed_by_agent_id FROM tasks WHERE id = ?'
    )
    .get(taskId)
  if (!updated) {
    throw new Error('Failed to load updated task')
  }
  return mapTask(updated)
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

export function listTaskValidations(taskId: number): TaskValidation[] {
  const rows = getDb()
    .prepare<TaskValidationRow>(
      'SELECT id, task_id, agent_id, command, ok, output, cwd, created_at FROM task_validations WHERE task_id = ? ORDER BY created_at DESC, id DESC'
    )
    .all(taskId)
  return rows.map(mapTaskValidation)
}

export function addTaskValidationRun(input: {
  taskId: number
  agentId?: number | null
  command: string
  ok: boolean
  output: string
  cwd: string
}): TaskValidation {
  const info = getDb()
    .prepare('INSERT INTO task_validations (task_id, agent_id, command, ok, output, cwd) VALUES (?, ?, ?, ?, ?, ?)')
    .run(input.taskId, input.agentId ?? null, input.command, input.ok ? 1 : 0, input.output, input.cwd)
  const row = getDb()
    .prepare<TaskValidationRow>('SELECT id, task_id, agent_id, command, ok, output, cwd, created_at FROM task_validations WHERE id = ?')
    .get(info.lastInsertRowid)
  if (!row) {
    throw new Error('Failed to load task validation')
  }
  return mapTaskValidation(row)
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

function isTerminalOrchestratorRunStatus(status: OrchestratorRunStatus) {
  return status === 'succeeded' || status === 'failed' || status === 'canceled'
}

function isTerminalOrchestratorTaskStatus(status: OrchestratorTaskRunStatus) {
  return status === 'succeeded' || status === 'failed' || status === 'canceled' || status === 'blocked'
}

export function listOrchestratorRuns(repoId?: number): OrchestratorRun[] {
  if (repoId) {
    const rows = getDb()
      .prepare<OrchestratorRunRow>(
        'SELECT id, repo_id, status, config, created_at, started_at, ended_at FROM orchestrator_runs WHERE repo_id = ? ORDER BY created_at DESC'
      )
      .all(repoId)
    return rows.map(mapOrchestratorRun)
  }
  const rows = getDb()
    .prepare<OrchestratorRunRow>('SELECT id, repo_id, status, config, created_at, started_at, ended_at FROM orchestrator_runs ORDER BY created_at DESC')
    .all()
  return rows.map(mapOrchestratorRun)
}

export function getOrchestratorRunById(runId: string): OrchestratorRun | null {
  const row = getDb()
    .prepare<OrchestratorRunRow>('SELECT id, repo_id, status, config, created_at, started_at, ended_at FROM orchestrator_runs WHERE id = ?')
    .get(runId)
  return row ? mapOrchestratorRun(row) : null
}

export function createOrchestratorRun(run: {
  id: string
  repoId: number
  status: OrchestratorRunStatus
  config?: Record<string, unknown>
}): OrchestratorRun {
  const config = JSON.stringify(run.config ?? {})
  getDb()
    .prepare('INSERT INTO orchestrator_runs (id, repo_id, status, config) VALUES (?, ?, ?, ?)')
    .run(run.id, run.repoId, run.status, config)
  const row = getDb()
    .prepare<OrchestratorRunRow>('SELECT id, repo_id, status, config, created_at, started_at, ended_at FROM orchestrator_runs WHERE id = ?')
    .get(run.id)
  if (!row) {
    throw new Error('Failed to load orchestrator run')
  }
  return mapOrchestratorRun(row)
}

export function updateOrchestratorRunStatus(runId: string, status: OrchestratorRunStatus): OrchestratorRun {
  if (status === 'running') {
    getDb()
      .prepare('UPDATE orchestrator_runs SET status = ?, started_at = COALESCE(started_at, datetime(\'now\')) WHERE id = ?')
      .run(status, runId)
  } else if (isTerminalOrchestratorRunStatus(status)) {
    getDb()
      .prepare('UPDATE orchestrator_runs SET status = ?, ended_at = datetime(\'now\') WHERE id = ?')
      .run(status, runId)
  } else {
    getDb()
      .prepare('UPDATE orchestrator_runs SET status = ? WHERE id = ?')
      .run(status, runId)
  }
  const row = getDb()
    .prepare<OrchestratorRunRow>('SELECT id, repo_id, status, config, created_at, started_at, ended_at FROM orchestrator_runs WHERE id = ?')
    .get(runId)
  if (!row) {
    throw new Error('Failed to load orchestrator run')
  }
  return mapOrchestratorRun(row)
}

export function addOrchestratorRunEvent(runId: string, kind: string, payload: string) {
  getDb()
    .prepare('INSERT INTO orchestrator_run_events (run_id, kind, payload) VALUES (?, ?, ?)')
    .run(runId, kind, payload)
}

export function listOrchestratorRunEvents(runId: string): OrchestratorRunEvent[] {
  const rows = getDb()
    .prepare<OrchestratorRunEventRow>(
      'SELECT id, run_id, kind, payload, created_at FROM orchestrator_run_events WHERE run_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(runId)
  return rows.map(mapOrchestratorRunEvent)
}

export function addOrchestratorValidationArtifact(payload: {
  runId: string
  taskRunId: string
  scope: OrchestratorValidationArtifact['scope']
  command: string
  ok: boolean
  output: string
}): OrchestratorValidationArtifact {
  const info = getDb()
    .prepare(
      'INSERT INTO orchestrator_validation_artifacts (run_id, task_run_id, scope, command, ok, output) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(payload.runId, payload.taskRunId, payload.scope, payload.command, payload.ok ? 1 : 0, payload.output)
  const row = getDb()
    .prepare<OrchestratorValidationArtifactRow>(
      'SELECT id, run_id, task_run_id, scope, command, ok, output, created_at FROM orchestrator_validation_artifacts WHERE id = ?'
    )
    .get(info.lastInsertRowid)
  if (!row) {
    throw new Error('Failed to load validation artifact')
  }
  return mapOrchestratorValidationArtifact(row)
}

export function listOrchestratorValidationArtifacts(runId: string): OrchestratorValidationArtifact[] {
  const rows = getDb()
    .prepare<OrchestratorValidationArtifactRow>(
      'SELECT id, run_id, task_run_id, scope, command, ok, output, created_at FROM orchestrator_validation_artifacts WHERE run_id = ? ORDER BY created_at DESC, id DESC'
    )
    .all(runId)
  return rows.map(mapOrchestratorValidationArtifact)
}

export function listOrchestratorTaskRuns(runId: string): OrchestratorTaskRun[] {
  const rows = getDb()
    .prepare<OrchestratorTaskRunRow>(
      'SELECT id, run_id, task_id, planner_thread_id, status, validation_status, worktree_path, branch_name, attempt, started_at, ended_at, error FROM orchestrator_task_runs WHERE run_id = ? ORDER BY started_at ASC'
    )
    .all(runId)
  return rows.map(mapOrchestratorTaskRun)
}

export function getOrchestratorTaskRunById(taskRunId: string): OrchestratorTaskRun | null {
  const row = getDb()
    .prepare<OrchestratorTaskRunRow>(
      'SELECT id, run_id, task_id, planner_thread_id, status, validation_status, worktree_path, branch_name, attempt, started_at, ended_at, error FROM orchestrator_task_runs WHERE id = ?'
    )
    .get(taskRunId)
  return row ? mapOrchestratorTaskRun(row) : null
}

export function createOrchestratorTaskRun(run: {
  id: string
  runId: string
  taskId: number
  plannerThreadId?: number | null
  status: OrchestratorTaskRunStatus
  validationStatus?: OrchestratorTaskValidationStatus
  worktreePath?: string | null
  branchName?: string | null
  attempt?: number
}): OrchestratorTaskRun {
  getDb()
    .prepare(
      'INSERT INTO orchestrator_task_runs (id, run_id, task_id, planner_thread_id, status, validation_status, worktree_path, branch_name, attempt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      run.id,
      run.runId,
      run.taskId,
      run.plannerThreadId ?? null,
      run.status,
      run.validationStatus ?? 'pending',
      run.worktreePath ?? null,
      run.branchName ?? null,
      run.attempt ?? 1
    )
  const row = getDb()
    .prepare<OrchestratorTaskRunRow>(
      'SELECT id, run_id, task_id, planner_thread_id, status, validation_status, worktree_path, branch_name, attempt, started_at, ended_at, error FROM orchestrator_task_runs WHERE id = ?'
    )
    .get(run.id)
  if (!row) {
    throw new Error('Failed to load orchestrator task run')
  }
  return mapOrchestratorTaskRun(row)
}

export function updateOrchestratorTaskRunStatus(taskRunId: string, status: OrchestratorTaskRunStatus): OrchestratorTaskRun {
  if (status === 'running') {
    getDb()
      .prepare(
        'UPDATE orchestrator_task_runs SET status = ?, started_at = COALESCE(started_at, datetime(\'now\')) WHERE id = ?'
      )
      .run(status, taskRunId)
  } else if (isTerminalOrchestratorTaskStatus(status)) {
    getDb()
      .prepare('UPDATE orchestrator_task_runs SET status = ?, ended_at = datetime(\'now\') WHERE id = ?')
      .run(status, taskRunId)
  } else {
    getDb()
      .prepare('UPDATE orchestrator_task_runs SET status = ? WHERE id = ?')
      .run(status, taskRunId)
  }
  const row = getDb()
    .prepare<OrchestratorTaskRunRow>(
      'SELECT id, run_id, task_id, planner_thread_id, status, validation_status, worktree_path, branch_name, attempt, started_at, ended_at, error FROM orchestrator_task_runs WHERE id = ?'
    )
    .get(taskRunId)
  if (!row) {
    throw new Error('Failed to load orchestrator task run')
  }
  return mapOrchestratorTaskRun(row)
}

export function updateOrchestratorTaskRunValidation(
  taskRunId: string,
  validationStatus: OrchestratorTaskValidationStatus
): OrchestratorTaskRun {
  getDb()
    .prepare('UPDATE orchestrator_task_runs SET validation_status = ? WHERE id = ?')
    .run(validationStatus, taskRunId)
  const row = getDb()
    .prepare<OrchestratorTaskRunRow>(
      'SELECT id, run_id, task_id, planner_thread_id, status, validation_status, worktree_path, branch_name, attempt, started_at, ended_at, error FROM orchestrator_task_runs WHERE id = ?'
    )
    .get(taskRunId)
  if (!row) {
    throw new Error('Failed to load orchestrator task run')
  }
  return mapOrchestratorTaskRun(row)
}

export function updateOrchestratorTaskRunDetails(taskRunId: string, payload: {
  plannerThreadId?: number | null
  worktreePath?: string | null
  branchName?: string | null
  error?: string | null
  attempt?: number
}): OrchestratorTaskRun {
  const updates: string[] = []
  const values: Array<string | number | null> = []
  if (payload.plannerThreadId !== undefined) {
    updates.push('planner_thread_id = ?')
    values.push(payload.plannerThreadId ?? null)
  }
  if (payload.worktreePath !== undefined) {
    updates.push('worktree_path = ?')
    values.push(payload.worktreePath ?? null)
  }
  if (payload.branchName !== undefined) {
    updates.push('branch_name = ?')
    values.push(payload.branchName ?? null)
  }
  if (payload.error !== undefined) {
    updates.push('error = ?')
    values.push(payload.error ?? null)
  }
  if (payload.attempt !== undefined) {
    updates.push('attempt = ?')
    values.push(payload.attempt)
  }
  if (updates.length === 0) {
    const existing = getOrchestratorTaskRunById(taskRunId)
    if (!existing) {
      throw new Error('Failed to load orchestrator task run')
    }
    return existing
  }
  values.push(taskRunId)
  getDb()
    .prepare(`UPDATE orchestrator_task_runs SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values)
  const row = getDb()
    .prepare<OrchestratorTaskRunRow>(
      'SELECT id, run_id, task_id, planner_thread_id, status, validation_status, worktree_path, branch_name, attempt, started_at, ended_at, error FROM orchestrator_task_runs WHERE id = ?'
    )
    .get(taskRunId)
  if (!row) {
    throw new Error('Failed to load orchestrator task run')
  }
  return mapOrchestratorTaskRun(row)
}
