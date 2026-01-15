/// <reference types="vite/client" />

type Repo = {
  id: number
  name: string
  path: string
  createdAt: string
}

type TaskStatus = 'proposed' | 'backlog' | 'in_progress' | 'done'

type Task = {
  id: number
  repoId: number
  title: string
  status: TaskStatus
  createdAt: string
}

type TaskNote = {
  taskId: number
  content: string
  updatedAt: string
}

type AgentSession = {
  id: number
  repoId: number
  taskId: number | null
  agentKey: 'claude' | 'gemini' | 'codex'
  createdAt: string
}

type AgentMessage = {
  id: number
  sessionId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

type CommandOutput = {
  runId: string
  kind: 'stdout' | 'stderr' | 'exit' | 'error'
  text?: string
  code?: number
}

interface Window {
  api: {
    listRepos: () => Promise<Repo[]>
    addRepo: (repoPath: string) => Promise<Repo>
    pickRepo: () => Promise<{ canceled: boolean; repo?: Repo; error?: string }>
    listTasks: (repoId?: number) => Promise<Task[]>
    addTask: (payload: { repoId: number; title: string; status: TaskStatus }) => Promise<Task>
    moveTask: (payload: { taskId: number; status: TaskStatus }) => Promise<Task>
    getTaskNote: (taskId: number) => Promise<TaskNote | null>
    saveTaskNote: (payload: { taskId: number; content: string }) => Promise<TaskNote>
    listAgentSessions: (repoId?: number) => Promise<AgentSession[]>
    createAgentSession: (payload: { repoId: number; agentKey: 'claude' | 'gemini' | 'codex'; taskId?: number | null }) => Promise<AgentSession>
    listAgentMessages: (sessionId: number) => Promise<AgentMessage[]>
    sendAgentMessage: (payload: { sessionId: number; content: string }) => Promise<{ runId: string }>
    cancelAgentRun: (runId: string) => Promise<void>
    runCommand: (payload: { repoId?: number; cwd?: string; command?: string; args?: string[]; commandLine?: string }) => Promise<{
      runId: string
    }>
    sendCommandInput: (payload: { runId: string; data: string }) => Promise<void>
    onCommandOutput: (callback: (data: CommandOutput) => void) => () => void
    onAgentOutput: (
      callback: (data: { runId: string; sessionId: number; kind: string; text?: string; code?: number }) => void
    ) => () => void
  }
}
