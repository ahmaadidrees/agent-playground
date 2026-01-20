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
  addOrchestratorRunEvent,
  addOrchestratorValidationArtifact,
  addRepo,
  addTask,
  addTaskValidationRun,
  addPlannerMessage,
  addPlannerRunEvent,
  approveTaskReview,
  assignTask,
  claimTask,
  createAgent,
  createAgentRun,
  createAgentSession,
  createOrchestratorRun,
  createOrchestratorTaskRun,
  createPlannerRun,
  createPlannerThread,
  deleteAgent,
  deletePlannerThread,
  deleteTask,
  getAgentById,
  getAgentSessionById,
  getDbPath,
  getRepoById,
  getPlannerThreadById,
  getTaskById,
  getTaskNote,
  initDb,
  listAgents,
  listAgentMessages,
  listAgentSessions,
  listOrchestratorRuns,
  listOrchestratorRunEvents,
  listOrchestratorTaskRuns,
  listOrchestratorValidationArtifacts,
  listPlannerMessages,
  listPlannerThreads,
  listRepos,
  listTaskValidations,
  listTasks,
  releaseTask,
  requestTaskChanges,
  requestTaskReview,
  updatePlannerRunStatus,
  updatePlannerThread,
  updateOrchestratorRunStatus,
  updateOrchestratorTaskRunDetails,
  updateOrchestratorTaskRunStatus,
  updateOrchestratorTaskRunValidation,
  updateAgent,
  updateAgentRunStatus,
  updateTaskStatus,
  upsertTaskNote,
} from './db'
import type { OrchestratorRunStatus, OrchestratorTaskRunStatus, TaskStatus } from './db'
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

type OrchestratorRunConfig = {
  concurrency: number
  maxAttempts: number
  conflictPolicy: 'continue' | 'halt'
  baseBranch?: string
  model?: string | null
  reasoningEffort?: string | null
  sandbox?: string | null
  approval?: string | null
  taskIds?: number[]
  workerValidationCommand?: string
  integrationValidationCommand?: string
}

type OrchestratorTaskWork = {
  taskRunId: string
  taskId: number
  title: string
  note: string | null
  attempt: number
}

type OrchestratorActiveTask = {
  taskRunId: string
  taskId: number
  proc: ReturnType<typeof spawn>
  worktreePath: string
  stdout: string
  stderr: string
}

type OrchestratorRunState = {
  runId: string
  repoId: number
  repoPath: string
  baseRef: string
  integrationBranch: string
  integrationPath: string
  config: OrchestratorRunConfig
  queue: OrchestratorTaskWork[]
  active: Map<string, OrchestratorActiveTask>
  failures: number
  canceled: boolean
  halted: boolean
}

const activeOrchestratorRuns = new Map<string, OrchestratorRunState>()

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

function createOrchestratorWorktree(repoPath: string, baseRef: string, worktreePath: string, branchName: string) {
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true })
  execFileSync('git', ['-C', repoPath, 'worktree', 'add', '-b', branchName, worktreePath, baseRef], {
    stdio: 'pipe',
  })
}

function commitWorktreeChanges(worktreePath: string, message: string) {
  execFileSync('git', ['-C', worktreePath, 'add', '-A'], { stdio: 'pipe' })
  const status = execFileSync('git', ['-C', worktreePath, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
  if (!status) {
    return false
  }
  execFileSync('git', ['-C', worktreePath, 'commit', '-m', message], {
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? 'agent-playground',
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? 'agent-playground@example.com',
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? 'agent-playground',
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? 'agent-playground@example.com',
    },
  })
  return true
}

function runValidationCommand(workingDir: string, commandLine: string) {
  try {
    const output = execFileSync(defaultShell, ['-lc', commandLine], {
      cwd: workingDir,
      encoding: 'utf8',
      env: { ...process.env },
    })
    return { ok: true, output: output.trim() }
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdout = String((error as { stdout?: Buffer | string }).stdout ?? '')
      const stderr = String((error as { stderr?: Buffer | string }).stderr ?? '')
      const combined = [stdout, stderr].filter((chunk) => chunk.trim().length > 0).join('\n')
      return { ok: false, output: combined.trim() || 'Validation failed' }
    }
    return { ok: false, output: error instanceof Error ? error.message : 'Validation failed' }
  }
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

function normalizeOrchestratorConfig(payload: {
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
}): OrchestratorRunConfig {
  return {
    concurrency: Math.max(1, payload.concurrency ?? 1),
    maxAttempts: Math.max(1, payload.maxAttempts ?? 1),
    conflictPolicy: payload.conflictPolicy === 'halt' ? 'halt' : 'continue',
    baseBranch: payload.baseBranch?.trim() || undefined,
    model: payload.model ?? null,
    reasoningEffort: payload.reasoningEffort ?? null,
    sandbox: payload.sandbox ?? null,
    approval: payload.approval ?? null,
    taskIds: payload.taskIds,
    workerValidationCommand: payload.workerValidationCommand?.trim() || undefined,
    integrationValidationCommand: payload.integrationValidationCommand?.trim() || undefined,
  }
}

function getOrchestratorBaseRef(repoPath: string, baseBranch?: string) {
  if (!baseBranch) {
    return getRepoBaseRef(repoPath)
  }
  const ref = baseBranch.trim()
  if (ref.startsWith('origin/')) {
    const remoteBranch = ref.replace(/^origin\//, '')
    execFileSync('git', ['-C', repoPath, 'fetch', 'origin', remoteBranch], { stdio: 'pipe' })
  }
  return ref
}

function buildOrchestratorPrompt(repoPath: string, taskTitle: string, taskNote: string | null) {
  const transcript = formatTranscript([{ role: 'user', content: taskTitle }])
  return buildPrompt({
    repoPath,
    taskTitle,
    taskNote: taskNote ?? undefined,
    transcript,
  })
}

function addOrchestratorOutput(runId: string, taskRunId: string, taskId: number, kind: string, text: string) {
  addOrchestratorRunEvent(runId, kind, JSON.stringify({ taskRunId, taskId, text }))
}

function scheduleOrchestratorRun(state: OrchestratorRunState) {
  if (state.canceled || state.halted) {
    if (state.active.size === 0) {
      finalizeOrchestratorRun(state)
    }
    return
  }
  while (state.active.size < state.config.concurrency && state.queue.length > 0) {
    const next = state.queue.shift()
    if (next) {
      startOrchestratorTask(state, next)
    }
  }
  if (state.active.size === 0 && state.queue.length === 0) {
    finalizeOrchestratorRun(state)
  }
}

function finalizeOrchestratorRun(state: OrchestratorRunState) {
  const status: OrchestratorRunStatus = state.canceled ? 'canceled' : state.failures > 0 ? 'failed' : 'succeeded'
  updateOrchestratorRunStatus(state.runId, status)
  addOrchestratorRunEvent(state.runId, 'run:complete', JSON.stringify({ status, failures: state.failures }))
  cleanupOrchestratorRunArtifacts(state)
  activeOrchestratorRuns.delete(state.runId)
}

function startOrchestratorTask(state: OrchestratorRunState, work: OrchestratorTaskWork) {
  const worktreeRoot = path.join(app.getPath('userData'), 'orchestrator-worktrees', `repo-${state.repoId}`, `run-${state.runId}`)
  const worktreePath = path.join(worktreeRoot, `task-${work.taskId}-${work.taskRunId}`)
  const branchName = `orchestrator/task-${work.taskId}-${work.taskRunId.slice(0, 8)}`

  try {
    createOrchestratorWorktree(state.repoPath, state.baseRef, worktreePath, branchName)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create worktree'
    if (work.attempt < state.config.maxAttempts) {
      const nextAttempt = work.attempt + 1
      updateOrchestratorTaskRunDetails(work.taskRunId, { error: message, branchName, attempt: nextAttempt })
      updateOrchestratorTaskRunValidation(work.taskRunId, 'pending')
      updateOrchestratorTaskRunStatus(work.taskRunId, 'queued')
      state.queue.push({ ...work, attempt: nextAttempt })
      addOrchestratorRunEvent(
        state.runId,
        'task:retry',
        JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, attempt: nextAttempt, reason: message })
      )
    } else {
      updateOrchestratorTaskRunDetails(work.taskRunId, { error: message, branchName })
      updateOrchestratorTaskRunStatus(work.taskRunId, 'failed')
      updateTaskStatus(work.taskId, 'failed')
      addOrchestratorRunEvent(state.runId, 'task:error', JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, message }))
      state.failures += 1
    }
    queueMicrotask(() => scheduleOrchestratorRun(state))
    return
  }

  updateOrchestratorTaskRunDetails(work.taskRunId, { worktreePath, branchName })
  updateOrchestratorTaskRunStatus(work.taskRunId, 'running')
  addOrchestratorRunEvent(
    state.runId,
    'task:start',
    JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, worktreePath, branchName })
  )

  const prompt = buildOrchestratorPrompt(worktreePath, work.title, work.note)
  const args: string[] = ['exec', '--color', 'never']
  if (state.config.model) {
    args.push('-m', state.config.model)
  }
  if (state.config.reasoningEffort) {
    args.push('-c', `model_reasoning_effort="${state.config.reasoningEffort}"`)
  }
  if (state.config.sandbox) {
    args.push('-s', state.config.sandbox)
  }
  if (state.config.approval) {
    args.push('-c', `approval_policy="${state.config.approval}"`)
  }
  args.push('-')

  const child = spawn('codex', args, {
    cwd: worktreePath,
    env: {
      ...process.env,
      NO_COLOR: '1',
      AGENT_PLAYGROUND_DB_PATH: getDbPath(),
      AGENT_PLAYGROUND_REPO_ID: String(state.repoId),
      AGENT_PLAYGROUND_REPO_PATH: worktreePath,
      AGENT_PLAYGROUND_REPO_NAME: path.basename(state.repoPath),
      AGENT_PLAYGROUND_PLAN_DIR: 'docs/plans',
    },
  })

  const activeTask: OrchestratorActiveTask = {
    taskRunId: work.taskRunId,
    taskId: work.taskId,
    proc: child,
    worktreePath,
    stdout: '',
    stderr: '',
  }
  state.active.set(work.taskRunId, activeTask)

  const enqueueRetry = (reason: string, finalTaskStatus: TaskStatus) => {
    if (work.attempt < state.config.maxAttempts && !state.canceled) {
      const nextAttempt = work.attempt + 1
      updateOrchestratorTaskRunDetails(work.taskRunId, { error: reason, attempt: nextAttempt })
      updateOrchestratorTaskRunValidation(work.taskRunId, 'pending')
      updateOrchestratorTaskRunStatus(work.taskRunId, 'queued')
      state.queue.push({ ...work, attempt: nextAttempt })
      addOrchestratorRunEvent(
        state.runId,
        'task:retry',
        JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, attempt: nextAttempt, reason })
      )
      return true
    }
    updateTaskStatus(work.taskId, finalTaskStatus)
    state.failures += 1
    return false
  }

  child.stdin.write(prompt)
  child.stdin.end()

  child.stdout.on('data', (data) => {
    const text = data.toString()
    activeTask.stdout += text
    addOrchestratorOutput(state.runId, work.taskRunId, work.taskId, 'task:stdout', text)
  })
  child.stderr.on('data', (data) => {
    const text = data.toString()
    activeTask.stderr += text
    addOrchestratorOutput(state.runId, work.taskRunId, work.taskId, 'task:stderr', text)
  })
  child.on('error', (error) => {
    const message = error instanceof Error ? error.message : 'Worker process error'
    activeTask.stderr += message
    addOrchestratorOutput(state.runId, work.taskRunId, work.taskId, 'task:error', message)
  })
  child.on('close', (code) => {
    const canceled = state.canceled
    const hasValidation = Boolean(state.config.workerValidationCommand || state.config.integrationValidationCommand)
    let status: OrchestratorTaskRunStatus = 'failed'
    let shouldLogComplete = true
    if (!hasValidation) {
      updateOrchestratorTaskRunValidation(work.taskRunId, 'skipped')
    }
    if (canceled) {
      status = 'canceled'
      updateTaskStatus(work.taskId, 'canceled')
    } else if (code === 0) {
      if (hasValidation) {
        updateOrchestratorTaskRunValidation(work.taskRunId, 'running')
      }
      if (state.config.workerValidationCommand) {
        const result = runValidationCommand(worktreePath, state.config.workerValidationCommand)
        addOrchestratorValidationArtifact({
          runId: state.runId,
          taskRunId: work.taskRunId,
          scope: 'worker',
          command: state.config.workerValidationCommand,
          ok: result.ok,
          output: result.output,
        })
        addOrchestratorRunEvent(
          state.runId,
          'task:validation',
          JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, ok: result.ok, output: result.output })
        )
        if (!result.ok) {
          updateOrchestratorTaskRunValidation(work.taskRunId, 'failed')
          const message = result.output || 'Worker validation failed'
          updateOrchestratorTaskRunDetails(work.taskRunId, { error: message })
          const retried = enqueueRetry(message, 'failed')
          if (retried) {
            status = 'queued'
            shouldLogComplete = false
          } else {
            status = 'failed'
          }
        }
      }

      if (status !== 'failed' && status !== 'queued') {
        const committed = commitWorktreeChanges(worktreePath, `Task ${work.taskId}`)
        if (!committed) {
          addOrchestratorRunEvent(
            state.runId,
            'task:noop',
            JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, branchName })
          )
        }
        try {
          let preMergeSha = ''
          if (committed) {
            preMergeSha = execFileSync('git', ['-C', state.integrationPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
            execFileSync('git', ['-C', state.integrationPath, 'merge', '--no-ff', branchName], { stdio: 'pipe' })
            addOrchestratorRunEvent(
              state.runId,
              'task:merge',
              JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, branchName })
            )
          }

          if (committed && state.config.integrationValidationCommand) {
            const result = runValidationCommand(state.integrationPath, state.config.integrationValidationCommand)
            addOrchestratorValidationArtifact({
              runId: state.runId,
              taskRunId: work.taskRunId,
              scope: 'integration',
              command: state.config.integrationValidationCommand,
              ok: result.ok,
              output: result.output,
            })
            addOrchestratorRunEvent(
              state.runId,
              'integration:validation',
              JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, ok: result.ok, output: result.output })
            )
            if (!result.ok) {
              updateOrchestratorTaskRunValidation(work.taskRunId, 'failed')
              const message = result.output || 'Integration validation failed'
              updateOrchestratorTaskRunDetails(work.taskRunId, { error: message })
              const retried = enqueueRetry(message, 'blocked')
              if (retried) {
                status = 'queued'
                shouldLogComplete = false
              } else {
                status = 'blocked'
              }
              try {
                if (preMergeSha) {
                  execFileSync('git', ['-C', state.integrationPath, 'reset', '--hard', preMergeSha], { stdio: 'pipe' })
                }
              } catch {
                // ignore rollback failures
              }
              addOrchestratorRunEvent(
                state.runId,
                'integration:validation_failed',
                JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, branchName, message })
              )
            }
          }

          if (status !== 'blocked' && status !== 'queued') {
            if (hasValidation) {
              updateOrchestratorTaskRunValidation(work.taskRunId, 'succeeded')
            }
            status = 'succeeded'
            updateTaskStatus(work.taskId, 'done')
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to merge task branch'
          try {
            execFileSync('git', ['-C', state.integrationPath, 'merge', '--abort'], { stdio: 'pipe' })
          } catch {
            // ignore abort failures
          }
          updateOrchestratorTaskRunDetails(work.taskRunId, { error: message })
          const retried = enqueueRetry(message, 'blocked')
          if (retried) {
            status = 'queued'
            shouldLogComplete = false
          } else {
            status = 'blocked'
            if (state.config.conflictPolicy === 'halt') {
              haltOrchestratorRun(state, 'merge_conflict')
            }
          }
          addOrchestratorRunEvent(
            state.runId,
            'task:merge_failed',
            JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, branchName, message })
          )
        }
      }
    } else {
      const errorText = activeTask.stderr.trim() || activeTask.stdout.trim() || 'Worker failed'
      updateOrchestratorTaskRunDetails(work.taskRunId, { error: errorText })
      const retried = enqueueRetry(errorText, 'failed')
      if (retried) {
        status = 'queued'
        shouldLogComplete = false
      } else {
        status = 'failed'
      }
    }

    if (shouldLogComplete) {
      updateOrchestratorTaskRunStatus(work.taskRunId, status)
      addOrchestratorRunEvent(state.runId, 'task:complete', JSON.stringify({ taskRunId: work.taskRunId, taskId: work.taskId, status }))
    }
    state.active.delete(work.taskRunId)
    queueMicrotask(() => scheduleOrchestratorRun(state))
  })
}

function startOrchestratorRun(payload: {
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
}) {
  const repo = getRepoById(payload.repoId)
  if (!repo) {
    throw new Error('Repo not found')
  }

  const config = normalizeOrchestratorConfig(payload)
  const runId = randomUUID()
  let baseRef = ''
  let integrationBranch = ''
  let integrationPath = ''
  createOrchestratorRun({
    id: runId,
    repoId: repo.id,
    status: 'running',
    config,
  })
  addOrchestratorRunEvent(runId, 'run:start', JSON.stringify({ config }))

  try {
    baseRef = getOrchestratorBaseRef(repo.path, config.baseBranch)
    integrationBranch = `orchestrator/run-${runId}`
    integrationPath = path.join(
      app.getPath('userData'),
      'orchestrator-worktrees',
      `repo-${repo.id}`,
      `run-${runId}`,
      'integration'
    )
    createOrchestratorWorktree(repo.path, baseRef, integrationPath, integrationBranch)
    addOrchestratorRunEvent(
      runId,
      'integration:ready',
      JSON.stringify({ branch: integrationBranch, path: integrationPath, baseRef })
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create integration worktree'
    updateOrchestratorRunStatus(runId, 'failed')
    addOrchestratorRunEvent(runId, 'integration:error', JSON.stringify({ message }))
    throw error
  }

  const candidateTasks = config.taskIds?.length
    ? config.taskIds
        .map((taskId) => getTaskById(taskId))
        .filter((task): task is NonNullable<typeof task> => Boolean(task))
        .filter((task) => task.repoId === repo.id)
    : listTasks(repo.id)

  const eligibleTasks = candidateTasks.filter((task) => task.status === 'backlog')
  const skippedTasks = candidateTasks.filter((task) => task.status !== 'backlog')
  if (skippedTasks.length > 0) {
    addOrchestratorRunEvent(
      runId,
      'task:skip',
      JSON.stringify({ taskIds: skippedTasks.map((task) => task.id), reason: 'status_not_backlog' })
    )
  }

  if (eligibleTasks.length === 0) {
    updateOrchestratorRunStatus(runId, 'succeeded')
    addOrchestratorRunEvent(runId, 'run:empty', JSON.stringify({ reason: 'no_backlog_tasks' }))
    return { runId }
  }

  const orderedTasks = eligibleTasks.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const queue: OrchestratorTaskWork[] = orderedTasks.map((task) => {
    const note = getTaskNote(task.id)?.content ?? null
    updateTaskStatus(task.id, 'in_progress')
    const taskRunId = randomUUID()
    createOrchestratorTaskRun({
      id: taskRunId,
      runId,
      taskId: task.id,
      status: 'queued',
      attempt: 1,
    })
    return {
      taskRunId,
      taskId: task.id,
      title: task.title,
      note,
      attempt: 1,
    }
  })

  const state: OrchestratorRunState = {
    runId,
    repoId: repo.id,
    repoPath: repo.path,
    baseRef,
    integrationBranch,
    integrationPath,
    config,
    queue,
    active: new Map(),
    failures: 0,
    canceled: false,
    halted: false,
  }
  activeOrchestratorRuns.set(runId, state)
  queueMicrotask(() => scheduleOrchestratorRun(state))

  return { runId }
}

function cancelOrchestratorRun(runId: string) {
  const state = activeOrchestratorRuns.get(runId)
  if (!state) {
    throw new Error('Orchestrator run not found')
  }
  state.canceled = true
  updateOrchestratorRunStatus(runId, 'canceled')
  addOrchestratorRunEvent(runId, 'run:cancel', JSON.stringify({ runId }))

  for (const queued of state.queue) {
    updateOrchestratorTaskRunStatus(queued.taskRunId, 'canceled')
    updateTaskStatus(queued.taskId, 'canceled')
  }
  state.queue = []

  for (const task of state.active.values()) {
    task.proc.kill('SIGTERM')
  }

  if (state.active.size === 0) {
    finalizeOrchestratorRun(state)
  }
}

function haltOrchestratorRun(state: OrchestratorRunState, reason: string) {
  if (state.halted) return
  state.halted = true
  addOrchestratorRunEvent(state.runId, 'run:halted', JSON.stringify({ reason }))
  for (const queued of state.queue) {
    updateOrchestratorTaskRunStatus(queued.taskRunId, 'canceled')
    updateTaskStatus(queued.taskId, 'backlog')
  }
  state.queue = []
}

function cleanupOrchestratorRunArtifacts(state: OrchestratorRunState) {
  const taskRuns = listOrchestratorTaskRuns(state.runId)
  for (const taskRun of taskRuns) {
    if (taskRun.worktreePath) {
      try {
        removePlannerWorktree(state.repoPath, taskRun.worktreePath)
      } catch {
        // ignore cleanup failures
      }
    }
    if (taskRun.branchName) {
      try {
        execFileSync('git', ['-C', state.repoPath, 'branch', '-D', taskRun.branchName], { stdio: 'pipe' })
      } catch {
        // ignore cleanup failures
      }
    }
  }

  if (state.integrationPath) {
    try {
      removePlannerWorktree(state.repoPath, state.integrationPath)
    } catch {
      // ignore cleanup failures
    }
  }
  if (state.integrationBranch) {
    try {
      execFileSync('git', ['-C', state.repoPath, 'branch', '-D', state.integrationBranch], { stdio: 'pipe' })
    } catch {
      // ignore cleanup failures
    }
  }
}

function cleanupOrchestratorOrphans() {
  const runs = listOrchestratorRuns()
  const terminalRuns = runs.filter((run) => run.status !== 'running')
  for (const run of terminalRuns) {
    const repo = getRepoById(run.repoId)
    if (!repo) continue
    const taskRuns = listOrchestratorTaskRuns(run.id)
    const integrationPath = path.join(
      app.getPath('userData'),
      'orchestrator-worktrees',
      `repo-${run.repoId}`,
      `run-${run.id}`,
      'integration'
    )
    const state: OrchestratorRunState = {
      runId: run.id,
      repoId: run.repoId,
      repoPath: repo.path,
      baseRef: '',
      integrationBranch: `orchestrator/run-${run.id}`,
      integrationPath,
      config: {
        concurrency: 1,
        maxAttempts: 1,
        conflictPolicy: 'continue',
      },
      queue: [],
      active: new Map(),
      failures: 0,
      canceled: run.status === 'canceled',
      halted: false,
    }
    if (taskRuns.length > 0 || fs.existsSync(integrationPath)) {
      cleanupOrchestratorRunArtifacts(state)
    }
  }
}

function recoverOrchestratorRuns() {
  const runs = listOrchestratorRuns()
  const activeRuns = runs.filter((run) => run.status === 'running')
  if (activeRuns.length === 0) return

  for (const run of activeRuns) {
    updateOrchestratorRunStatus(run.id, 'failed')
    addOrchestratorRunEvent(run.id, 'run:recovered', JSON.stringify({ reason: 'app_restart' }))
    const taskRuns = listOrchestratorTaskRuns(run.id)
    for (const taskRun of taskRuns) {
      if (taskRun.status === 'running' || taskRun.status === 'queued') {
        updateOrchestratorTaskRunStatus(taskRun.id, 'canceled')
        const task = getTaskById(taskRun.taskId)
        if (task && task.status === 'in_progress') {
          updateTaskStatus(task.id, 'canceled')
        }
      }
    }
  }
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

  ipcMain.handle('agents:list', (_event, repoId?: number) => listAgents(repoId))

  ipcMain.handle('agents:create', (_event, payload: { repoId: number; name: string; provider: AgentKey; workspacePath?: string | null }) => {
    return createAgent({
      repoId: payload.repoId,
      name: payload.name,
      provider: payload.provider,
      workspacePath: payload.workspacePath ?? null,
    })
  })

  ipcMain.handle('agents:update', (_event, payload: {
    agentId: number
    name?: string
    provider?: AgentKey
    workspacePath?: string | null
    status?: 'active' | 'paused'
  }) => {
    return updateAgent(payload.agentId, {
      name: payload.name,
      provider: payload.provider,
      workspacePath: payload.workspacePath ?? null,
      status: payload.status,
    })
  })

  ipcMain.handle('agents:delete', (_event, agentId: number) => deleteAgent(agentId))

  ipcMain.handle('tasks:assign', (_event, payload: { taskId: number; agentId: number | null }) => {
    if (payload.agentId) {
      const agent = getAgentById(payload.agentId)
      if (!agent) {
        throw new Error('Agent not found')
      }
      const task = getTaskById(payload.taskId)
      if (!task) {
        throw new Error('Task not found')
      }
      if (task.repoId !== agent.repoId) {
        throw new Error('Agent does not belong to this repo')
      }
    }
    return assignTask(payload.taskId, payload.agentId)
  })

  ipcMain.handle('tasks:claim', (_event, payload: { taskId: number; agentId: number }) => {
    const agent = getAgentById(payload.agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }
    const task = getTaskById(payload.taskId)
    if (!task) {
      throw new Error('Task not found')
    }
    if (task.repoId !== agent.repoId) {
      throw new Error('Agent does not belong to this repo')
    }
    return claimTask(payload.taskId, payload.agentId)
  })

  ipcMain.handle('tasks:release', (_event, payload: { taskId: number }) => {
    return releaseTask(payload.taskId)
  })

  ipcMain.handle('tasks:review:request', (_event, payload: { taskId: number }) => {
    return requestTaskReview(payload.taskId)
  })

  ipcMain.handle('tasks:review:approve', (_event, payload: { taskId: number; reviewerAgentId?: number | null }) => {
    if (payload.reviewerAgentId) {
      const agent = getAgentById(payload.reviewerAgentId)
      if (!agent) {
        throw new Error('Agent not found')
      }
    }
    return approveTaskReview(payload.taskId, payload.reviewerAgentId ?? null)
  })

  ipcMain.handle('tasks:review:changes', (_event, payload: { taskId: number }) => {
    return requestTaskChanges(payload.taskId)
  })

  ipcMain.handle('tasks:validations:list', (_event, payload: { taskId: number }) => {
    return listTaskValidations(payload.taskId)
  })

  ipcMain.handle('tasks:validations:run', (_event, payload: { taskId: number; command: string; agentId?: number | null }) => {
    const task = getTaskById(payload.taskId)
    if (!task) {
      throw new Error('Task not found')
    }
    const repo = getRepoById(task.repoId)
    if (!repo) {
      throw new Error('Repo not found')
    }
    const commandLine = payload.command.trim()
    if (!commandLine) {
      throw new Error('Command is required')
    }
    let cwd = repo.path
    if (payload.agentId) {
      const agent = getAgentById(payload.agentId)
      if (!agent) {
        throw new Error('Agent not found')
      }
      if (agent.repoId !== task.repoId) {
        throw new Error('Agent does not belong to this repo')
      }
      if (agent.workspacePath) {
        cwd = agent.workspacePath
      }
    }
    const result = runValidationCommand(cwd, commandLine)
    return addTaskValidationRun({
      taskId: payload.taskId,
      agentId: payload.agentId ?? null,
      command: commandLine,
      ok: result.ok,
      output: result.output,
      cwd,
    })
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

  ipcMain.handle('orchestrator:runs:list', (_event, repoId?: number) => listOrchestratorRuns(repoId))

  ipcMain.handle('orchestrator:tasks:list', (_event, runId: string) => listOrchestratorTaskRuns(runId))

  ipcMain.handle('orchestrator:events:list', (_event, runId: string) => listOrchestratorRunEvents(runId))

  ipcMain.handle('orchestrator:validation:list', (_event, runId: string) => listOrchestratorValidationArtifacts(runId))

  ipcMain.handle('orchestrator:runs:start', (_event, payload: {
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
  }) => startOrchestratorRun(payload))

  ipcMain.handle('orchestrator:runs:cancel', (_event, runId: string) => cancelOrchestratorRun(runId))

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
  recoverOrchestratorRuns()
  cleanupOrchestratorOrphans()
  createWindow()
  registerIpcHandlers()
})
