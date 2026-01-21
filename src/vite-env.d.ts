/// <reference types="vite/client" />

type Repo = {
  id: number
  name: string
  path: string
  createdAt: string
}

type TaskStatus = 'planned' | 'executed' | 'done' | 'archived'
type SubtaskStatus = 'todo' | 'doing' | 'done'
type AgentRole = 'worker' | 'validator'

type Task = {
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
  baseRef: string | null
  worktreePath: string | null
  branchName: string | null
  needsReview: boolean
  planDocPath: string | null
}

type Subtask = {
  id: number
  featureId: number
  title: string
  status: SubtaskStatus
  orderIndex: number | null
  createdAt: string
  updatedAt: string
}

type TaskNote = {
  taskId: number
  content: string
  updatedAt: string
}

type Agent = {
  id: number
  repoId: number
  name: string
  provider: 'claude' | 'gemini' | 'codex'
  role: AgentRole
  workspacePath: string | null
  status: 'active' | 'paused'
  createdAt: string
  updatedAt: string
}

type TaskValidation = {
  id: number
  taskId: number
  agentId: number | null
  command: string
  ok: boolean
  output: string
  cwd: string
  createdAt: string
}

type AgentEvent = {
  id: number
  repoId: number
  agentId: number | null
  taskId: number | null
  kind: string
  message: string
  createdAt: string
}

type AgentSession = {
  id: number
  repoId: number
  agentId: number | null
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

type AgentRunSummary = {
  id: string
  sessionId: number
  agentId: number | null
  taskId: number | null
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  command: string
  cwd: string
  startedAt: string
  endedAt: string | null
}

type AgentRunEvent = {
  id: number
  runId: string
  kind: string
  payload: string
  createdAt: string
}

type PlannerThread = {
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

type PlannerMessage = {
  id: number
  threadId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

type OrchestratorRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

type OrchestratorTaskRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'blocked'

type OrchestratorTaskValidationStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped'

type OrchestratorRun = {
  id: string
  repoId: number
  status: OrchestratorRunStatus
  config: Record<string, unknown>
  createdAt: string
  startedAt: string | null
  endedAt: string | null
}

type OrchestratorTaskRun = {
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

type OrchestratorRunEvent = {
  id: number
  runId: string
  kind: string
  payload: string
  createdAt: string
}

type OrchestratorValidationArtifact = {
  id: number
  runId: string
  taskRunId: string
  scope: 'worker' | 'integration'
  command: string
  ok: boolean
  output: string
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
    assignTask: (payload: { taskId: number; agentId: number | null }) => Promise<Task>
    claimTask: (payload: { taskId: number; agentId: number }) => Promise<Task>
    releaseTask: (payload: { taskId: number }) => Promise<Task>
    requestTaskReview: (payload: { taskId: number }) => Promise<Task>
    approveTaskReview: (payload: { taskId: number; reviewerAgentId?: number | null }) => Promise<Task>
    requestTaskChanges: (payload: { taskId: number }) => Promise<Task>
    listTaskValidations: (payload: { taskId: number }) => Promise<TaskValidation[]>
    runTaskValidation: (payload: { taskId: number; command: string; agentId?: number | null }) => Promise<TaskValidation>
    deleteTask: (taskId: number) => Promise<{ id: number }>
    getTaskNote: (taskId: number) => Promise<TaskNote | null>
    saveTaskNote: (payload: { taskId: number; content: string }) => Promise<TaskNote>
    updateTaskMetadata: (payload: {
      taskId: number
      baseRef?: string | null
      worktreePath?: string | null
      branchName?: string | null
      needsReview?: boolean
      planDocPath?: string | null
    }) => Promise<Task>
    listLatestTaskValidations: (payload: { taskIds: number[] }) => Promise<TaskValidation[]>
    getTaskMergeStatus: (payload: { taskId: number }) => Promise<{ baseRef: string; branchName: string; ahead: number; behind: number; needsMerge: boolean; error?: string }>
    getDbPath: () => Promise<string>
    listAgents: (repoId?: number) => Promise<Agent[]>
    createAgent: (payload: {
      repoId: number
      name: string
      provider: 'claude' | 'gemini' | 'codex'
      role?: AgentRole
      workspacePath?: string | null
    }) => Promise<Agent>
    updateAgent: (payload: {
      agentId: number
      name?: string
      provider?: 'claude' | 'gemini' | 'codex'
      role?: AgentRole
      workspacePath?: string | null
      status?: 'active' | 'paused'
    }) => Promise<Agent>
    deleteAgent: (agentId: number) => Promise<{ id: number }>
    listAgentEvents: (payload: { repoId?: number; agentId?: number; taskId?: number; limit?: number }) => Promise<AgentEvent[]>
    createAgentEvent: (payload: {
      repoId: number
      agentId?: number | null
      taskId?: number | null
      kind: string
      message: string
    }) => Promise<AgentEvent>
    listAgentRuns: (payload: { repoId?: number; agentId?: number; taskId?: number; limit?: number }) => Promise<AgentRunSummary[]>
    listAgentRunEvents: (payload: { runId: string; limit?: number }) => Promise<AgentRunEvent[]>
    startAgentTaskRun: (payload: { taskId: number; agentId: number; message?: string }) => Promise<{ runId: string; sessionId: number }>
    startFeatureThread: (payload: { taskId: number; agentKey?: 'claude' | 'gemini' | 'codex'; message?: string }) => Promise<{ session: AgentSession; runId: string; task: Task }>
    listAgentSessions: (repoId?: number) => Promise<AgentSession[]>
    createAgentSession: (payload: { repoId: number; agentKey: 'claude' | 'gemini' | 'codex'; taskId?: number | null; agentId?: number | null }) => Promise<AgentSession>
    listAgentMessages: (sessionId: number) => Promise<AgentMessage[]>
    sendAgentMessage: (payload: { sessionId: number; content: string }) => Promise<{ runId: string }>
    cancelAgentRun: (runId: string) => Promise<void>
    listPlannerThreads: (repoId?: number) => Promise<PlannerThread[]>
    createPlannerThread: (payload: {
      repoId: number
      title?: string
      baseBranch?: string
      model?: string
      reasoningEffort?: string
      sandbox?: string
      approval?: string
    }) => Promise<PlannerThread>
    updatePlannerThread: (payload: {
      threadId: number
      title?: string
      model?: string | null
      reasoningEffort?: string | null
      sandbox?: string | null
      approval?: string | null
    }) => Promise<PlannerThread>
    deletePlannerThread: (threadId: number) => Promise<{ id: number; worktreeRemoved: boolean; warning?: string }>
    listPlannerMessages: (threadId: number) => Promise<PlannerMessage[]>
    sendPlannerMessage: (payload: { threadId: number; content: string }) => Promise<{ runId: string }>
    cancelPlannerRun: (runId: string) => Promise<void>
    listSubtasks: (payload: { featureId: number }) => Promise<Subtask[]>
    addSubtask: (payload: { featureId: number; title: string; status?: SubtaskStatus; orderIndex?: number | null }) => Promise<Subtask>
    updateSubtask: (payload: { subtaskId: number; title?: string; status?: SubtaskStatus; orderIndex?: number | null }) => Promise<Subtask>
    deleteSubtask: (payload: { subtaskId: number }) => Promise<{ id: number }>
    reorderSubtasks: (payload: { featureId: number; orderedIds: number[] }) => Promise<Subtask[]>
    listSubtaskSummary: (payload: { featureIds: number[] }) => Promise<Record<number, { todo: number; doing: number; done: number; total: number }>>
    listOrchestratorRuns: (repoId?: number) => Promise<OrchestratorRun[]>
    listOrchestratorTasks: (runId: string) => Promise<OrchestratorTaskRun[]>
    listOrchestratorEvents: (runId: string) => Promise<OrchestratorRunEvent[]>
    listOrchestratorValidationArtifacts: (runId: string) => Promise<OrchestratorValidationArtifact[]>
    startOrchestratorRun: (payload: {
      repoId: number
      concurrency?: number
      maxAttempts?: number
      conflictPolicy?: 'continue' | 'halt'
      baseBranch?: string
      model?: string | null
      reasoningEffort?: string | null
      sandbox?: string | null
      approval?: string | null
      taskIds?: number[]
      workerValidationCommand?: string
      integrationValidationCommand?: string
    }) => Promise<{ runId: string }>
    cancelOrchestratorRun: (runId: string) => Promise<void>
    runCommand: (payload: {
      runId?: string
      repoId?: number
      cwd?: string
      command?: string
      args?: string[]
      commandLine?: string
      env?: Record<string, string>
    }) => Promise<{ runId: string }>
    sendCommandInput: (payload: { runId: string; data: string }) => Promise<void>
    onCommandOutput: (callback: (data: CommandOutput) => void) => () => void
    onAgentOutput: (
      callback: (data: { runId: string; sessionId: number; kind: string; text?: string; code?: number }) => void
    ) => () => void
    onPlannerOutput: (
      callback: (data: { runId: string; threadId: number; kind: string; text?: string; code?: number }) => void
    ) => () => void
  }
}
