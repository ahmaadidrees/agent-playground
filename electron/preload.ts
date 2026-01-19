import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {
  listRepos: () => ipcRenderer.invoke('repos:list'),
  addRepo: (repoPath: string) => ipcRenderer.invoke('repos:add', repoPath),
  pickRepo: () => ipcRenderer.invoke('repos:pick'),
  listTasks: (repoId?: number) => ipcRenderer.invoke('tasks:list', repoId),
  addTask: (payload: { repoId: number; title: string; status: 'proposed' | 'backlog' | 'in_progress' | 'done' }) =>
    ipcRenderer.invoke('tasks:add', payload),
  moveTask: (payload: { taskId: number; status: 'proposed' | 'backlog' | 'in_progress' | 'done' }) =>
    ipcRenderer.invoke('tasks:move', payload),
  deleteTask: (taskId: number) => ipcRenderer.invoke('tasks:delete', taskId),
  getTaskNote: (taskId: number) => ipcRenderer.invoke('tasks:note:get', taskId),
  saveTaskNote: (payload: { taskId: number; content: string }) => ipcRenderer.invoke('tasks:note:save', payload),
  getDbPath: () => ipcRenderer.invoke('app:db:path'),
  listAgentSessions: (repoId?: number) => ipcRenderer.invoke('agents:sessions:list', repoId),
  createAgentSession: (payload: { repoId: number; agentKey: 'claude' | 'gemini' | 'codex'; taskId?: number | null }) =>
    ipcRenderer.invoke('agents:sessions:create', payload),
  listAgentMessages: (sessionId: number) => ipcRenderer.invoke('agents:messages:list', sessionId),
  sendAgentMessage: (payload: { sessionId: number; content: string }) =>
    ipcRenderer.invoke('agents:message:send', payload),
  cancelAgentRun: (runId: string) => ipcRenderer.invoke('agents:run:cancel', runId),
  listPlannerThreads: (repoId?: number) => ipcRenderer.invoke('planner:threads:list', repoId),
  createPlannerThread: (payload: {
    repoId: number
    title?: string
    baseBranch?: string
    model?: string
    reasoningEffort?: string
    sandbox?: string
    approval?: string
  }) => ipcRenderer.invoke('planner:threads:create', payload),
  updatePlannerThread: (payload: {
    threadId: number
    title?: string
    model?: string | null
    reasoningEffort?: string | null
    sandbox?: string | null
    approval?: string | null
  }) => ipcRenderer.invoke('planner:threads:update', payload),
  deletePlannerThread: (threadId: number) => ipcRenderer.invoke('planner:threads:delete', threadId),
  listPlannerMessages: (threadId: number) => ipcRenderer.invoke('planner:messages:list', threadId),
  sendPlannerMessage: (payload: { threadId: number; content: string }) =>
    ipcRenderer.invoke('planner:message:send', payload),
  cancelPlannerRun: (runId: string) => ipcRenderer.invoke('planner:run:cancel', runId),
  runCommand: (payload: {
    runId?: string
    repoId?: number
    cwd?: string
    command?: string
    args?: string[]
    commandLine?: string
    env?: Record<string, string>
  }) => ipcRenderer.invoke('cmd:run', payload),
  sendCommandInput: (payload: { runId: string; data: string }) => ipcRenderer.invoke('cmd:input', payload),
  onCommandOutput: (callback: (data: { runId: string; kind: string; text?: string; code?: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data as { runId: string; kind: string; text?: string; code?: number })
    }
    ipcRenderer.on('cmd:output', listener)
    return () => ipcRenderer.off('cmd:output', listener)
  },
  onAgentOutput: (
    callback: (data: {
      runId: string
      sessionId: number
      kind: string
      text?: string
      code?: number
    }) => void
  ) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(
        data as {
          runId: string
          sessionId: number
          kind: string
          text?: string
          code?: number
        }
      )
    }
    ipcRenderer.on('agents:output', listener)
    return () => ipcRenderer.off('agents:output', listener)
  },
  onPlannerOutput: (
    callback: (data: {
      runId: string
      threadId: number
      kind: string
      text?: string
      code?: number
    }) => void
  ) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(
        data as {
          runId: string
          threadId: number
          kind: string
          text?: string
          code?: number
        }
      )
    }
    ipcRenderer.on('planner:output', listener)
    return () => ipcRenderer.off('planner:output', listener)
  },
})
