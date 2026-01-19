export interface Repo {
  id: number
  name: string
  path: string
}

export type TaskStatus = 'proposed' | 'backlog' | 'in_progress' | 'done'

export interface Task {
  id: number
  repoId: number
  title: string
  status: TaskStatus
  createdAt: string
}

export interface AgentSession {
  id: number
  repoId: number
  agentKey: 'claude' | 'gemini' | 'codex'
  taskId: number | null
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
