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
  addPlannerMessage,
  addPlannerRunEvent,
  createAgentRun,
  createAgentSession,
  createPlannerRun,
  createPlannerThread,
  deletePlannerThread,
  deleteTask,
  getAgentSessionById,
  getDbPath,
  getRepoById,
  getPlannerThreadById,
  getTaskById,
  getTaskNote,
  initDb,
  listAgentMessages,
  listAgentSessions,
  listPlannerMessages,
  listPlannerThreads,
  listRepos,
  listTasks,
  updatePlannerRunStatus,
  updatePlannerThread,
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
const activePlannerRuns = new Map<string, { proc: ReturnType<typeof spawn>; threadId: number; canceled: boolean }>()

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

function getRepoBaseRef(repoPath: string, requested?: string) {
  if (requested && requested.trim()) return requested.trim()
  try {
    const branch = execFileSync('git', ['-C', repoPath, 'branch', '--show-current'], { encoding: 'utf8' }).trim()
    if (branch) return branch
  } catch {
    // ignore
  }
  try {
    const branch = execFileSync('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
    if (branch && branch !== 'HEAD') return branch
  } catch {
    // ignore
  }
  return execFileSync('git', ['-C', repoPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

function createPlannerWorktree(repoPath: string, baseRef: string, worktreePath: string) {
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true })
  execFileSync('git', ['-C', repoPath, 'worktree', 'add', '--detach', worktreePath, baseRef], {
    stdio: 'pipe',
  })
}

function removePlannerWorktree(repoPath: string, worktreePath: string) {
  if (!fs.existsSync(worktreePath)) {
    return { removed: false, warning: 'Worktree already missing.' }
  }
  let warning: string | undefined
  try {
    execFileSync('git', ['-C', repoPath, 'worktree', 'remove', '--force', worktreePath], {
      stdio: 'pipe',
    })
  } catch (error) {
    warning = error instanceof Error ? error.message : 'Failed to remove worktree.'
  }
  if (fs.existsSync(worktreePath)) {
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true })
    } catch (error) {
      warning = warning ?? (error instanceof Error ? error.message : 'Failed to delete worktree folder.')
    }
  }
  try {
    execFileSync('git', ['-C', repoPath, 'worktree', 'prune'], { stdio: 'pipe' })
  } catch {
    // ignore pruning failures
  }
  return { removed: !fs.existsSync(worktreePath), warning }
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

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const label = level === 0 ? 'log' : level === 1 ? 'warn' : 'error'
    console.log(`[renderer:${label}] ${message} (${sourceId}:${line})`)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer:crash]', details)
  })
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer:load] ${errorCode} ${errorDescription} ${validatedURL}`)
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

  ipcMain.handle('tasks:delete', (_event, taskId: number) => {
    return deleteTask(taskId)
  })

  ipcMain.handle('tasks:note:get', (_event, taskId: number) => getTaskNote(taskId))

  ipcMain.handle('tasks:note:save', (_event, payload: { taskId: number; content: string }) => {
    return upsertTaskNote(payload.taskId, payload.content)
  })

  ipcMain.handle('app:db:path', () => getDbPath())

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

  ipcMain.handle('planner:threads:list', (_event, repoId?: number) => listPlannerThreads(repoId))

  ipcMain.handle('planner:threads:create', (_event, payload: {
    repoId: number
    title?: string
    baseBranch?: string
    model?: string
    reasoningEffort?: string
    sandbox?: string
    approval?: string
  }) => {
    const repo = getRepoById(payload.repoId)
    if (!repo) {
      throw new Error('Repo not found')
    }
    const baseBranch = getRepoBaseRef(repo.path, payload.baseBranch)
    const worktreeRoot = path.join(app.getPath('userData'), 'planner-worktrees', `repo-${repo.id}`)
    const worktreePath = path.join(worktreeRoot, `thread-${randomUUID()}`)
    createPlannerWorktree(repo.path, baseBranch, worktreePath)
    try {
      return createPlannerThread({
        repoId: repo.id,
        title: payload.title?.trim() || 'Planner Thread',
        worktreePath,
        baseBranch,
        model: payload.model ?? null,
        reasoningEffort: payload.reasoningEffort ?? null,
        sandbox: payload.sandbox ?? null,
        approval: payload.approval ?? null,
      })
    } catch (error) {
      try {
        removePlannerWorktree(repo.path, worktreePath)
      } catch {
        // ignore cleanup failures
      }
      throw error
    }
  })

  ipcMain.handle('planner:threads:update', (_event, payload: {
    threadId: number
    title?: string
    model?: string | null
    reasoningEffort?: string | null
    sandbox?: string | null
    approval?: string | null
  }) => {
    return updatePlannerThread(payload.threadId, payload)
  })

  ipcMain.handle('planner:threads:delete', (_event, threadId: number) => {
    const thread = getPlannerThreadById(threadId)
    if (!thread) {
      throw new Error('Planner thread not found')
    }
    const repo = getRepoById(thread.repoId)
    if (!repo) {
      throw new Error('Repo not found')
    }
    const removal = removePlannerWorktree(repo.path, thread.worktreePath)
    deletePlannerThread(threadId)
    return {
      id: threadId,
      worktreeRemoved: removal.removed,
      warning: removal.warning,
    }
  })

  ipcMain.handle('planner:messages:list', (_event, threadId: number) => listPlannerMessages(threadId))

  ipcMain.handle('planner:message:send', (event, payload: { threadId: number; content: string }) => {
    const thread = getPlannerThreadById(payload.threadId)
    if (!thread) {
      throw new Error('Planner thread not found')
    }
    const repo = getRepoById(thread.repoId)
    if (!repo) {
      throw new Error('Repo not found')
    }
    const content = payload.content.trim()
    if (!content) {
      throw new Error('Message is required')
    }
    if (!fs.existsSync(thread.worktreePath)) {
      throw new Error('Planner worktree is missing')
    }

    addPlannerMessage(thread.id, 'user', content)
    if (thread.title === 'Planner Thread') {
      const nextTitle = content.trim().slice(0, 60)
      if (nextTitle) {
        updatePlannerThread(thread.id, { title: nextTitle })
      }
    }

    const transcript = formatTranscript(listPlannerMessages(thread.id))
    const prompt = buildPrompt({
      repoPath: thread.worktreePath,
      transcript,
    })

    const args: string[] = ['exec', '--color', 'never']
    if (thread.model) {
      args.push('-m', thread.model)
    }
    if (thread.reasoningEffort) {
      args.push('-c', `model_reasoning_effort="${thread.reasoningEffort}"`)
    }
    if (thread.sandbox) {
      args.push('-s', thread.sandbox)
    }
    if (thread.approval) {
      args.push('-c', `approval_policy="${thread.approval}"`)
    }
    args.push('-')

    const commandLine = ['codex', ...args].map(shellEscape).join(' ')
    const runId = randomUUID()
    createPlannerRun({
      id: runId,
      threadId: thread.id,
      status: 'running',
      command: commandLine,
      cwd: thread.worktreePath,
    })

    const child = spawn('codex', args, {
      cwd: thread.worktreePath,
      env: {
        ...process.env,
        NO_COLOR: '1',
        AGENT_PLAYGROUND_DB_PATH: getDbPath(),
        AGENT_PLAYGROUND_REPO_ID: String(repo.id),
        AGENT_PLAYGROUND_REPO_PATH: thread.worktreePath,
        AGENT_PLAYGROUND_REPO_NAME: repo.name,
        AGENT_PLAYGROUND_PLAN_DIR: 'docs/plans',
      },
    })
    activePlannerRuns.set(runId, { proc: child, threadId: thread.id, canceled: false })

    const sendOutput = (data: { runId: string; threadId: number; kind: string; text?: string; code?: number }) => {
      event.sender.send('planner:output', data)
    }

    let stdoutBuffer = ''
    let stderrBuffer = ''

    child.stdout.on('data', (data) => {
      const text = data.toString()
      stdoutBuffer += text
      addPlannerRunEvent(runId, 'stdout', text)
      sendOutput({ runId, threadId: thread.id, kind: 'stdout', text })
    })
    child.stderr.on('data', (data) => {
      const text = data.toString()
      stderrBuffer += text
      addPlannerRunEvent(runId, 'stderr', text)
      sendOutput({ runId, threadId: thread.id, kind: 'stderr', text })
    })
    child.on('error', (error) => {
      const message = error.message
      stderrBuffer += message
      addPlannerRunEvent(runId, 'error', message)
      sendOutput({ runId, threadId: thread.id, kind: 'error', text: message })
    })
    child.on('close', (code) => {
      const canceled = activePlannerRuns.get(runId)?.canceled ?? false
      const status = canceled ? 'canceled' : code === 0 ? 'succeeded' : 'failed'
      updatePlannerRunStatus(runId, status)
      activePlannerRuns.delete(runId)
      const finalText = stdoutBuffer.trim() ? stdoutBuffer : stderrBuffer
      if (finalText.trim()) {
        addPlannerMessage(thread.id, 'assistant', finalText.trim())
      }
      sendOutput({ runId, threadId: thread.id, kind: 'exit', code: code ?? -1 })
    })

    child.stdin.write(prompt)
    child.stdin.end()

    return { runId }
  })

  ipcMain.handle('planner:run:cancel', (_event, runId: string) => {
    const entry = activePlannerRuns.get(runId)
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
    (
      event,
      payload: {
        runId?: string
        repoId?: number
        cwd?: string
        command?: string
        args?: string[]
        commandLine?: string
        env?: Record<string, string>
      }
    ) => {
      const { repoId, cwd, command, args = [], commandLine, env = {} } = payload
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

      const runId = payload.runId ?? randomUUID()
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
          env: { ...process.env, TERM: 'xterm-256color', ...env },
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
