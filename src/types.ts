export interface Repo {
  id: number
  name: string
  path: string
}

export type TaskStatus = 'proposed' | 'backlog' | 'in_progress' | 'review' | 'blocked' | 'failed' | 'canceled' | 'done'

export interface Task {
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

export interface AgentSession {
  id: number
  repoId: number
  agentKey: 'claude' | 'gemini' | 'codex'
  taskId: number | null
}

export interface Agent {
  id: number
  repoId: number
  name: string
  provider: 'claude' | 'gemini' | 'codex'
  workspacePath: string | null
  status: 'active' | 'paused'
  createdAt: string
  updatedAt: string
}

export interface TaskValidation {
  id: number
  taskId: number
  agentId: number | null
  command: string
  ok: boolean
  output: string
  cwd: string
  createdAt: string
}

export interface AgentMessage {
  id: number
  sessionId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface StreamingMessage {
  runId: string
  stdout: string
  stderr: string
}

export interface PlannerThread {
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

export interface PlannerMessage {
  id: number
  threadId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export type OrchestratorRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

export type OrchestratorTaskRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'blocked'

export type OrchestratorTaskValidationStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped'

export interface OrchestratorRun {
  id: string
  repoId: number
  status: OrchestratorRunStatus
  config: Record<string, unknown>
  createdAt: string
  startedAt: string | null
  endedAt: string | null
}

export interface OrchestratorTaskRun {
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

export interface OrchestratorRunEvent {
  id: number
  runId: string
  kind: string
  payload: string
  createdAt: string
}

export interface OrchestratorValidationArtifact {
  id: number
  runId: string
  taskRunId: string
  scope: 'worker' | 'integration'
  command: string
  ok: boolean
  output: string
  createdAt: string
}
