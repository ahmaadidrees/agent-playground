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
  runCommand: (payload: {
    repoId?: number
    cwd?: string
    command?: string
    args?: string[]
    commandLine?: string
    env?: Record<string, string>
  }) => ipcRenderer.invoke('cmd:run', payload),
    ipcRenderer.invoke('cmd:run', payload),
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
})
