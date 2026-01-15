import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import {
  addAgentMessage,
  addAgentRunEvent,
  addRepo,
  addTask,
  createAgentRun,
  createAgentSession,
  getAgentSessionById,
  getRepoById,
  getTaskById,
  getTaskNote,
  initDb,
  listAgentMessages,
  listAgentSessions,
  listRepos,
  listTasks,
  updateAgentRunStatus,
  updateTaskStatus,
  upsertTaskNote,
} from './db'
import type { TaskStatus } from './db'
import * as pty from 'node-pty'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const defaultShell = process.env.SHELL && process.env.SHELL.trim().length > 0 ? process.env.SHELL : '/bin/zsh'
const shellPath = resolveShellPath(defaultShell)

if (shellPath) {
  process.env.PATH = shellPath
  process.env.SHELL = defaultShell
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const activeTerms = new Map<string, pty.IPty>()
const activeAgentRuns = new Map<string, { proc: ReturnType<typeof spawn>; sessionId: number; canceled: boolean }>()

ensurePtyHelperExecutable()

function resolveShellPath(shell: string) {
  try {
    return execFileSync(shell, ['-lc', 'source ~/.zshrc >/dev/null 2>&1; echo $PATH'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return process.env.PATH ?? ''
  }
}

function ensurePtyHelperExecutable() {
  if (process.platform !== 'darwin') return
  try {
    const resolved = require.resolve('node-pty')
    const packageRoot = path.resolve(resolved, '..', '..')
    const archDir = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
    const candidates = [
      path.join(packageRoot, 'build', 'Release', 'spawn-helper'),
      path.join(packageRoot, 'prebuilds', archDir, 'spawn-helper'),
    ]
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue
      const stats = fs.statSync(candidate)
      if ((stats.mode & 0o111) === 0) {
        fs.chmodSync(candidate, 0o755)
      }
    }
  } catch {
    // No-op: only improves dev ergonomics if helper lacks exec bit.
  }
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

type AgentKey = 'claude' | 'gemini' | 'codex'

function buildAgentCommand(agentKey: AgentKey, prompt: string) {
  switch (agentKey) {
    case 'claude':
      return { command: 'claude', args: ['-p', prompt] }
    case 'gemini':
      return { command: 'gemini', args: ['-p', prompt] }
    case 'codex':
      return { command: 'codex', args: ['exec', '--color', 'never', prompt] }
    default:
      throw new Error(`Unknown agent: ${agentKey}`)
  }
}

function formatTranscript(messages: { role: string; content: string }[]) {
  return messages
    .map((message) => {
      const label = message.role === 'assistant' ? 'Assistant' : message.role === 'system' ? 'System' : 'User'
      return `${label}: ${message.content}`
    })
    .join('\n')
}

function buildPrompt(options: {
  taskTitle?: string
  taskNote?: string
  repoPath?: string
  transcript: string
}) {
  const header: string[] = []
  if (options.repoPath) header.push(`Repo: ${options.repoPath}`)
  if (options.taskTitle) header.push(`Task: ${options.taskTitle}`)
  if (options.taskNote) header.push(`Notes:\n${options.taskNote}`)
  const contextBlock = header.length > 0 ? `${header.join('\n')}\n\n` : ''
  return `${contextBlock}${options.transcript}`.trim()
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    minWidth: 900,
    minHeight: 600,
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function isGitRepo(repoPath: string) {
  return fs.existsSync(path.join(repoPath, '.git'))
}

function registerIpcHandlers() {
  ipcMain.handle('repos:list', () => listRepos())

  ipcMain.handle('repos:add', (_event, repoPath: string) => addRepo(repoPath))

  ipcMain.handle('tasks:list', (_event, repoId?: number) => listTasks(repoId))

  ipcMain.handle('tasks:add', (_event, payload: { repoId: number; title: string; status: TaskStatus }) => {
    return addTask(payload.repoId, payload.title, payload.status)
  })

  ipcMain.handle('tasks:move', (_event, payload: { taskId: number; status: TaskStatus }) => {
    return updateTaskStatus(payload.taskId, payload.status)
  })

  ipcMain.handle('tasks:note:get', (_event, taskId: number) => getTaskNote(taskId))

  ipcMain.handle('tasks:note:save', (_event, payload: { taskId: number; content: string }) => {
    return upsertTaskNote(payload.taskId, payload.content)
  })

  ipcMain.handle('agents:sessions:list', (_event, repoId?: number) => listAgentSessions(repoId))

  ipcMain.handle('agents:sessions:create', (_event, payload: { repoId: number; agentKey: AgentKey; taskId?: number | null }) => {
    return createAgentSession(payload.repoId, payload.agentKey, payload.taskId)
  })

  ipcMain.handle('agents:messages:list', (_event, sessionId: number) => listAgentMessages(sessionId))

  ipcMain.handle('agents:message:send', (event, payload: { sessionId: number; content: string }) => {
    const session = getAgentSessionById(payload.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    const repo = getRepoById(session.repoId)
    if (!repo) {
      throw new Error('Repo not found')
    }
    const content = payload.content.trim()
    if (!content) {
      throw new Error('Message is required')
    }

    addAgentMessage(session.id, 'user', content)
    const transcript = formatTranscript(listAgentMessages(session.id))
    const task = session.taskId ? getTaskById(session.taskId) : null
    const note = session.taskId ? getTaskNote(session.taskId) : null
    const prompt = buildPrompt({
      repoPath: repo.path,
      taskTitle: task?.title,
      taskNote: note?.content,
      transcript,
    })

    const agentCommand = buildAgentCommand(session.agentKey as AgentKey, prompt)
    const commandLine = [agentCommand.command, ...agentCommand.args].map(shellEscape).join(' ')
    const runId = randomUUID()
    createAgentRun({
      id: runId,
      sessionId: session.id,
      status: 'running',
      command: commandLine,
      cwd: repo.path,
    })

    const child = spawn(agentCommand.command, agentCommand.args, {
      cwd: repo.path,
      env: { ...process.env, NO_COLOR: '1' },
    })
    activeAgentRuns.set(runId, { proc: child, sessionId: session.id, canceled: false })

    const sendOutput = (data: { runId: string; sessionId: number; kind: string; text?: string; code?: number }) => {
      event.sender.send('agents:output', data)
    }

    let stdoutBuffer = ''
    let stderrBuffer = ''

    child.stdout.on('data', (data) => {
      const text = data.toString()
      stdoutBuffer += text
      addAgentRunEvent(runId, 'stdout', text)
      sendOutput({ runId, sessionId: session.id, kind: 'stdout', text })
    })
    child.stderr.on('data', (data) => {
      const text = data.toString()
      stderrBuffer += text
      addAgentRunEvent(runId, 'stderr', text)
      sendOutput({ runId, sessionId: session.id, kind: 'stderr', text })
    })
    child.on('error', (error) => {
      const message = error.message
      stderrBuffer += message
      addAgentRunEvent(runId, 'error', message)
      sendOutput({ runId, sessionId: session.id, kind: 'error', text: message })
    })
    child.on('close', (code) => {
      const canceled = activeAgentRuns.get(runId)?.canceled ?? false
      const status = canceled ? 'canceled' : code === 0 ? 'succeeded' : 'failed'
      updateAgentRunStatus(runId, status)
      activeAgentRuns.delete(runId)
      const finalText = stdoutBuffer.trim() ? stdoutBuffer : stderrBuffer
      if (finalText.trim()) {
        addAgentMessage(session.id, 'assistant', finalText.trim())
      }
      sendOutput({ runId, sessionId: session.id, kind: 'exit', code: code ?? -1 })
    })

    return { runId }
  })

  ipcMain.handle('agents:run:cancel', (_event, runId: string) => {
    const entry = activeAgentRuns.get(runId)
    if (!entry) {
      throw new Error('Run not found')
    }
    entry.canceled = true
    entry.proc.kill('SIGTERM')
  })

  ipcMain.handle('repos:pick', async () => {
    if (!win) return { canceled: true }
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select a git repository',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    const repoPath = result.filePaths[0]
    if (!isGitRepo(repoPath)) {
      return { canceled: false, error: 'Selected folder does not look like a git repo.' }
    }
    const repo = addRepo(repoPath)
    return { canceled: false, repo }
  })

  ipcMain.handle(
    'cmd:run',
    (event, payload: { repoId?: number; cwd?: string; command?: string; args?: string[]; commandLine?: string }) => {
      const { repoId, cwd, command, args = [], commandLine } = payload
      if (!commandLine && !command) {
        throw new Error('Command is required')
      }
      const repo = repoId ? getRepoById(repoId) : null
      if (repoId && !repo) {
        throw new Error('Repo not found')
      }
      const workingDir = repo?.path ?? cwd
      if (!workingDir) {
        throw new Error('Working directory is required')
      }

      const runId = randomUUID()
      const send = (message: { runId: string; kind: string; text?: string; code?: number }) => {
        event.sender.send('cmd:output', message)
      }

      try {
        const shellCommand = (commandLine ?? [command, ...args].map(shellEscape).join(' ')).trim()
        if (!shellCommand) {
          throw new Error('Command is required')
        }
        const term = pty.spawn(defaultShell, ['-lc', shellCommand], {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd: workingDir,
          env: { ...process.env, TERM: 'xterm-256color' },
        })
        activeTerms.set(runId, term)
        term.onData((data) => {
          send({ runId, kind: 'stdout', text: data })
        })
        term.onExit(({ exitCode }) => {
          send({ runId, kind: 'exit', code: exitCode })
          activeTerms.delete(runId)
        })
      } catch (error) {
        send({ runId, kind: 'error', text: error instanceof Error ? error.message : 'Failed to start command' })
      }

      return { runId }
    }
  )

  ipcMain.handle('cmd:input', (_event, payload: { runId: string; data: string }) => {
    const term = activeTerms.get(payload.runId)
    if (!term) {
      throw new Error('Run not found')
    }
    term.write(payload.data)
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initDb()
  createWindow()
  registerIpcHandlers()
})
