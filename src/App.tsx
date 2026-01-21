import { useEffect, useMemo, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import './App.css'
import { FeatureBoard } from './components/FeatureBoard'
import { FeatureDrawer } from './components/FeatureDrawer'
import { Layout } from './components/Layout'
import { ThreadsPanel } from './components/ThreadsPanel'
import { RepoToolbar } from './components/RepoToolbar'
import { ResizableSidebar } from './components/ResizableSidebar'
import { extractFeaturePlanFromText } from './lib/agentParsing'
import type {
  AgentEvent,
  AgentMessage,
  AgentRunSummary,
  AgentSession,
  PlannerMessage,
  PlannerThread,
  Repo,
  StreamingMessage,
  Subtask,
  Task,
  TaskStatus,
  TaskValidation,
} from './types'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message
  return fallback
}

type ThemeMode = 'light' | 'dark'

type ThreadKind = 'planner' | 'execution'

function App() {
  // State
  const [repos, setRepos] = useState<Repo[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskNote, setTaskNote] = useState('')
  const [taskNoteStatus, setTaskNoteStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [subtasksByFeature, setSubtasksByFeature] = useState<Record<number, Subtask[]>>({})
  const [subtaskSummary, setSubtaskSummary] = useState<Record<number, { todo: number; doing: number; done: number; total: number }>>({})
  const [latestValidationsByTask, setLatestValidationsByTask] = useState<Record<number, TaskValidation | undefined>>({})
  const [mergeStatusByTask, setMergeStatusByTask] = useState<Record<number, { baseRef: string; branchName: string; ahead: number; behind: number; needsMerge: boolean; error?: string }>>({})
  const [agentRuns, setAgentRuns] = useState<AgentRunSummary[]>([])
  const [taskValidations, setTaskValidations] = useState<TaskValidation[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)

  const [plannerThreads, setPlannerThreads] = useState<PlannerThread[]>([])
  const [activePlannerThreadId, setActivePlannerThreadId] = useState<number | null>(null)
  const [plannerMessages, setPlannerMessages] = useState<PlannerMessage[]>([])
  const [plannerStreamingMessage, setPlannerStreamingMessage] = useState<StreamingMessage | null>(null)
  const [plannerRunIds, setPlannerRunIds] = useState<Record<number, string>>({})
  const [plannerThinkingByThreadId, setPlannerThinkingByThreadId] = useState<Record<number, { runId: string; stderr: string }>>({})

  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([])
  const [activeAgentSessionId, setActiveAgentSessionId] = useState<number | null>(null)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentStreamingMessage, setAgentStreamingMessage] = useState<StreamingMessage | null>(null)
  const [agentRunIds, setAgentRunIds] = useState<Record<number, string>>({})
  const [agentThinkingBySessionId, setAgentThinkingBySessionId] = useState<Record<number, { runId: string; stderr: string }>>({})
  const [latestAgentEventsByTask, setLatestAgentEventsByTask] = useState<Record<number, AgentEvent | undefined>>({})
  const [activeThreadKind, setActiveThreadKind] = useState<ThreadKind | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      const stored = window.localStorage.getItem('theme')
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // ignore storage failures
    }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  const taskPollIntervalMs = 2000

  // Derived State
  const selectedRepo = useMemo(() => repos.find((r) => r.id === selectedRepoId) ?? null, [repos, selectedRepoId])
  const activeTask = useMemo(
    () => (activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null),
    [activeTaskId, tasks]
  )
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const threadItems = useMemo(() => {
    const plannerItems = plannerThreads.map((thread) => ({
      id: thread.id,
      kind: 'planner' as const,
      title: thread.title,
      subtitle: `Planner · Base ${thread.baseBranch}`,
      timestamp: thread.lastUsedAt ?? thread.createdAt,
      baseBranch: thread.baseBranch,
      model: thread.model,
      reasoningEffort: thread.reasoningEffort,
      sandbox: thread.sandbox,
      approval: thread.approval,
      worktreePath: thread.worktreePath,
    }))
    const agentItems = agentSessions.map((session) => {
      const feature = session.taskId ? taskById.get(session.taskId) ?? null : null
      return {
        id: session.id,
        kind: 'execution' as const,
        title: feature?.title ?? 'Execution Thread',
        subtitle: feature ? `Feature #${feature.id}` : 'General thread',
        timestamp: session.createdAt,
        agentKey: session.agentKey,
        featureId: feature?.id ?? null,
        worktreePath: feature?.worktreePath ?? null,
        branchName: feature?.branchName ?? null,
      }
    })
    return [...plannerItems, ...agentItems].sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
  }, [plannerThreads, agentSessions, taskById])

  const activeThreadItem = useMemo(() => {
    if (!activeThreadKind) return null
    const activeId = activeThreadKind === 'planner' ? activePlannerThreadId : activeAgentSessionId
    if (!activeId) return null
    return threadItems.find((item) => item.kind === activeThreadKind && item.id === activeId) ?? null
  }, [activeThreadKind, activePlannerThreadId, activeAgentSessionId, threadItems])

  const featureThreadById = useMemo(() => {
    const map: Record<number, { sessionId: number; agentKey: AgentSession['agentKey']; createdAt: string }> = {}
    agentSessions.forEach((session) => {
      if (!session.taskId) return
      const existing = map[session.taskId]
      if (!existing || existing.createdAt < session.createdAt) {
        map[session.taskId] = { sessionId: session.id, agentKey: session.agentKey, createdAt: session.createdAt }
      }
    })
    return map
  }, [agentSessions])

  const runningByFeature = useMemo(() => {
    const map: Record<number, boolean> = {}
    agentRuns.forEach((run) => {
      if (!run.taskId) return
      if (run.status === 'running') {
        map[run.taskId] = true
      }
    })
    return map
  }, [agentRuns])

  const activeThreadMessages =
    activeThreadKind === 'planner' ? plannerMessages : activeThreadKind === 'execution' ? agentMessages : []
  const activeThreadStreaming =
    activeThreadKind === 'planner' ? plannerStreamingMessage : activeThreadKind === 'execution' ? agentStreamingMessage : null
  const activeThreadRunId =
    activeThreadKind === 'planner'
      ? activePlannerThreadId
        ? plannerRunIds[activePlannerThreadId] ?? null
        : null
      : activeThreadKind === 'execution'
        ? activeAgentSessionId
          ? agentRunIds[activeAgentSessionId] ?? null
          : null
        : null
  const activeThreadThinking =
    activeThreadKind === 'planner'
      ? activePlannerThreadId
        ? plannerThinkingByThreadId[activePlannerThreadId]?.stderr ?? ''
        : ''
      : activeThreadKind === 'execution'
        ? activeAgentSessionId
          ? agentThinkingBySessionId[activeAgentSessionId]?.stderr ?? ''
          : ''
        : ''
  const activeThreadThinkingRunId =
    activeThreadKind === 'planner'
      ? activePlannerThreadId
        ? plannerThinkingByThreadId[activePlannerThreadId]?.runId ?? null
        : null
      : activeThreadKind === 'execution'
        ? activeAgentSessionId
          ? agentThinkingBySessionId[activeAgentSessionId]?.runId ?? null
          : null
        : null

  const activeFeatureThread = activeTaskId ? featureThreadById[activeTaskId] ?? null : null

  // Initial load
  useEffect(() => {
    window.api
      .listRepos()
      .then((data) => {
        setRepos(data)
        if (data.length > 0) setSelectedRepoId(data[0].id)
      })
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load repos.')))
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem('theme', theme)
    } catch {
      // ignore storage failures
    }
  }, [theme])

  useEffect(() => {
    if (threadItems.length === 0) {
      if (activeThreadKind) {
        setActiveThreadKind(null)
        setActivePlannerThreadId(null)
        setActiveAgentSessionId(null)
      }
      return
    }
    const activeId = activeThreadKind === 'planner' ? activePlannerThreadId : activeThreadKind === 'execution' ? activeAgentSessionId : null
    const exists = activeId ? threadItems.some((item) => item.kind === activeThreadKind && item.id === activeId) : false
    if (!exists) {
      const next = threadItems[0]
      setActiveThreadKind(next.kind)
      if (next.kind === 'planner') {
        setActivePlannerThreadId(next.id)
      } else {
        setActiveAgentSessionId(next.id)
      }
    }
  }, [threadItems, activeThreadKind, activePlannerThreadId, activeAgentSessionId])

  // Repo selection effects
  useEffect(() => {
    if (!selectedRepoId) {
      setTasks([])
      return
    }

    let canceled = false
    const refreshTasks = (reportError: boolean) => {
      window.api
        .listTasks(selectedRepoId)
        .then((data) => {
          if (!canceled) setTasks(data)
        })
        .catch((error) => {
          if (reportError && !canceled) {
            setErrorMessage(getErrorMessage(error, 'Failed to load tasks.'))
          }
        })
    }

    refreshTasks(true)
    const interval = window.setInterval(() => refreshTasks(false), taskPollIntervalMs)

    return () => {
      canceled = true
      window.clearInterval(interval)
    }
  }, [selectedRepoId, activePlannerThreadId])

  useEffect(() => {
    if (!selectedRepoId) {
      setSubtaskSummary({})
      setLatestValidationsByTask({})
      return
    }
    const featureIds = tasks.map((task) => task.id)
    if (featureIds.length === 0) {
      setSubtaskSummary({})
      setLatestValidationsByTask({})
      return
    }
    window.api
      .listSubtaskSummary({ featureIds })
      .then(setSubtaskSummary)
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load subtask summary.')))
    window.api
      .listLatestTaskValidations({ taskIds: featureIds })
      .then((latest) => {
        const map: Record<number, TaskValidation | undefined> = {}
        latest.forEach((item) => {
          map[item.taskId] = item
        })
        setLatestValidationsByTask(map)
      })
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load latest validations.')))
  }, [tasks, selectedRepoId])

  useEffect(() => {
    const candidates = tasks.filter((task) => task.status === 'executed' && task.branchName)
    if (candidates.length === 0) {
      setMergeStatusByTask({})
      return
    }
    Promise.all(
      candidates.map((task) =>
        window.api
          .getTaskMergeStatus({ taskId: task.id })
          .then((status) => ({ taskId: task.id, status }))
          .catch(() => null)
      )
    ).then((results) => {
      const next: Record<number, { baseRef: string; branchName: string; ahead: number; behind: number; needsMerge: boolean; error?: string }> = {}
      results.forEach((result) => {
        if (!result) return
        next[result.taskId] = result.status
      })
      setMergeStatusByTask(next)
    })
  }, [tasks])

  // Task note effects
  useEffect(() => {
    if (!activeTaskId) {
      setTaskNote('')
      setTaskNoteStatus('idle')
      return
    }
    window.api
      .getTaskNote(activeTaskId)
      .then((note) => {
        setTaskNote(note?.content ?? '')
        setTaskNoteStatus('idle')
      })
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load task note.')))
  }, [activeTaskId])

  useEffect(() => {
    if (!activeTaskId) return
    if (subtasksByFeature[activeTaskId]) return
    window.api
      .listSubtasks({ featureId: activeTaskId })
      .then((data) => {
        setSubtasksByFeature((prev) => ({ ...prev, [activeTaskId]: data }))
      })
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load subtasks.')))
  }, [activeTaskId, subtasksByFeature])

  useEffect(() => {
    if (!activeTaskId) {
      setTaskValidations([])
      return
    }
    window.api
      .listTaskValidations({ taskId: activeTaskId })
      .then(setTaskValidations)
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load task validations.')))
  }, [activeTaskId])

  // Agent sessions
  useEffect(() => {
    if (!selectedRepoId) {
      setAgentSessions([])
      setActiveAgentSessionId(null)
      setAgentMessages([])
      setAgentRunIds({})
      setAgentStreamingMessage(null)
      setAgentThinkingBySessionId({})
      return
    }
    window.api
      .listAgentSessions(selectedRepoId)
      .then((data) => {
        setAgentSessions(data)
        if (data.length === 0) {
          if (activeThreadKind === 'execution') {
            setActiveAgentSessionId(null)
          }
          return
        }
        if (activeThreadKind === 'execution') {
          if (!activeAgentSessionId || !data.find((session) => session.id === activeAgentSessionId)) {
            setActiveAgentSessionId(data[0].id)
          }
        }
      })
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load agent sessions.')))
  }, [selectedRepoId, activeAgentSessionId, activeThreadKind])

  useEffect(() => {
    if (!selectedRepoId) {
      setAgentRuns([])
      return
    }
    let canceled = false
    const refreshRuns = (reportError: boolean) => {
      window.api
        .listAgentRuns({ repoId: selectedRepoId, limit: 50 })
        .then((data) => {
          if (canceled) return
          setAgentRuns(data)
        })
        .catch((error) => {
          if (reportError && !canceled) {
            setErrorMessage(getErrorMessage(error, 'Failed to load agent runs.'))
          }
        })
    }
    refreshRuns(true)
    const interval = window.setInterval(() => refreshRuns(false), 2500)
    return () => {
      canceled = true
      window.clearInterval(interval)
    }
  }, [selectedRepoId])

  useEffect(() => {
    if (!selectedRepoId) {
      setLatestAgentEventsByTask({})
      return
    }
    let canceled = false
    const refreshEvents = (reportError: boolean) => {
      window.api
        .listAgentEvents({ repoId: selectedRepoId, limit: 200 })
        .then((data) => {
          if (canceled) return
          const next: Record<number, AgentEvent | undefined> = {}
          data.forEach((event) => {
            if (!event.taskId) return
            if (!next[event.taskId] || next[event.taskId]!.createdAt < event.createdAt) {
              next[event.taskId] = event
            }
          })
          setLatestAgentEventsByTask(next)
        })
        .catch((error) => {
          if (reportError && !canceled) {
            setErrorMessage(getErrorMessage(error, 'Failed to load agent activity.'))
          }
        })
    }
    refreshEvents(true)
    const interval = window.setInterval(() => refreshEvents(false), 4000)
    return () => {
      canceled = true
      window.clearInterval(interval)
    }
  }, [selectedRepoId])

  // Planner session list
  useEffect(() => {
    if (!selectedRepoId) {
      setPlannerThreads([])
      setActivePlannerThreadId(null)
      setPlannerMessages([])
      setPlannerRunIds({})
      setPlannerStreamingMessage(null)
      setPlannerThinkingByThreadId({})
      return
    }
    window.api
      .listPlannerThreads(selectedRepoId)
      .then((data) => {
        setPlannerThreads(data)
        if (data.length > 0 && !data.find((thread) => thread.id === activePlannerThreadId)) {
          setActivePlannerThreadId(data[0].id)
        }
      })
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load planner threads.')))
  }, [selectedRepoId, activePlannerThreadId])

  // Planner messages
  useEffect(() => {
    if (activeThreadKind !== 'planner' || !activePlannerThreadId) {
      setPlannerMessages([])
      return
    }
    window.api
      .listPlannerMessages(activePlannerThreadId)
      .then(setPlannerMessages)
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load planner messages.')))
  }, [activePlannerThreadId, activeThreadKind])

  // Agent messages
  useEffect(() => {
    if (activeThreadKind !== 'execution' || !activeAgentSessionId) {
      setAgentMessages([])
      return
    }
    window.api
      .listAgentMessages(activeAgentSessionId)
      .then(setAgentMessages)
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load agent messages.')))
  }, [activeAgentSessionId, activeThreadKind])

  // Planner output
  useEffect(() => {
    const unsubPlanner = window.api.onPlannerOutput((data) => {
      const threadId = data.threadId
      if (data.kind === 'stdout' || data.kind === 'stderr') {
        if (activePlannerThreadId !== threadId) return
        setPlannerThinkingByThreadId((prev) => {
          const current = prev[threadId]
          if (!current || current.runId !== data.runId) {
            return {
              ...prev,
              [threadId]: {
                runId: data.runId,
                stderr: data.kind === 'stderr' ? data.text ?? '' : '',
              },
            }
          }
          if (data.kind !== 'stderr' || !data.text) return prev
          return {
            ...prev,
            [threadId]: {
              runId: current.runId,
              stderr: `${current.stderr}${data.text}`,
            },
          }
        })
        setPlannerStreamingMessage((prev) => {
          if (!prev || prev.runId !== data.runId) {
            return {
              runId: data.runId,
              stdout: data.kind === 'stdout' ? data.text ?? '' : '',
              stderr: data.kind === 'stderr' ? data.text ?? '' : '',
            }
          }
          if (data.kind === 'stdout') {
            return { ...prev, stdout: `${prev.stdout}${data.text ?? ''}` }
          }
          return { ...prev, stderr: `${prev.stderr}${data.text ?? ''}` }
        })
      } else if (data.kind === 'exit' || data.kind === 'error') {
        setPlannerRunIds((prev) => {
          const next = { ...prev }
          if (threadId in next) delete next[threadId]
          return next
        })
        if (activePlannerThreadId === threadId) {
          setPlannerStreamingMessage((prev) => (prev?.runId === data.runId ? null : prev))
          window.api
            .listPlannerMessages(threadId)
            .then(setPlannerMessages)
            .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to refresh planner messages.')))
        }
      }
    })

    return () => {
      unsubPlanner()
    }
  }, [activePlannerThreadId])

  // Agent output
  useEffect(() => {
    const unsubAgent = window.api.onAgentOutput((data) => {
      const sessionId = data.sessionId
      if (data.kind === 'stdout' || data.kind === 'stderr') {
        if (activeAgentSessionId !== sessionId) return
        setAgentThinkingBySessionId((prev) => {
          const current = prev[sessionId]
          if (!current || current.runId !== data.runId) {
            return {
              ...prev,
              [sessionId]: {
                runId: data.runId,
                stderr: data.kind === 'stderr' ? data.text ?? '' : '',
              },
            }
          }
          if (data.kind !== 'stderr') return prev
          return {
            ...prev,
            [sessionId]: {
              runId: current.runId,
              stderr: `${current.stderr}${data.text}`,
            },
          }
        })
        setAgentStreamingMessage((prev) => {
          if (!prev || prev.runId !== data.runId) {
            return {
              runId: data.runId,
              stdout: data.kind === 'stdout' ? data.text ?? '' : '',
              stderr: data.kind === 'stderr' ? data.text ?? '' : '',
            }
          }
          if (data.kind === 'stdout') {
            return { ...prev, stdout: `${prev.stdout}${data.text ?? ''}` }
          }
          return { ...prev, stderr: `${prev.stderr}${data.text ?? ''}` }
        })
      } else if (data.kind === 'exit' || data.kind === 'error') {
        setAgentRunIds((prev) => {
          const next = { ...prev }
          if (sessionId in next) delete next[sessionId]
          return next
        })
        if (activeAgentSessionId === sessionId) {
          setAgentStreamingMessage((prev) => (prev?.runId === data.runId ? null : prev))
          window.api
            .listAgentMessages(sessionId)
            .then(setAgentMessages)
            .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to refresh agent messages.')))
        }
      }
    })

    return () => {
      unsubAgent()
    }
  }, [activeAgentSessionId])

  // Handlers
  const handlePickRepo = async () => {
    try {
      const res = await window.api.pickRepo()
      if (res.canceled) return
      if (res.error) {
        setErrorMessage(res.error)
        return
      }
      if (res.repo) {
        const repo = res.repo
        setRepos((prev) => [repo, ...prev.filter((r) => r.id !== repo.id)])
        setSelectedRepoId(repo.id)
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to pick repo.'))
    }
  }

  const handleAddTask = async (title: string) => {
    if (!selectedRepo) return
    try {
      const task = await window.api.addTask({ repoId: selectedRepo.id, title, status: 'planned' })
      setTasks(prev => [task, ...prev])
      logAgentEvent({
        agentId: null,
        taskId: task.id,
        kind: 'feature_created',
        message: `Created feature #${task.id}: ${task.title}`,
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to add task.'))
    }
  }

  const handleMoveTask = async (taskId: number, status: TaskStatus) => {
    try {
      const task = await window.api.moveTask({ taskId, status })
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      const kind = status === 'executed' ? 'start' : status === 'done' ? 'complete' : 'status'
      logAgentEvent({
        agentId: null,
        taskId: task.id,
        kind,
        message: `${status === 'executed' ? 'Started' : 'Moved'} feature #${task.id} to ${task.status.replace('_', ' ')}`,
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to move task.'))
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const confirmDelete = window.confirm(`Delete "${task.title}"? This cannot be undone.`)
    if (!confirmDelete) return
    try {
      await window.api.deleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      if (activeTaskId === taskId) {
        setActiveTaskId(null)
      }
      logAgentEvent({
        agentId: null,
        taskId: task.id,
        kind: 'feature_deleted',
        message: `Deleted feature #${task.id}: ${task.title}`,
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to delete task.'))
    }
  }

  const handleSaveNote = async () => {
    if (!activeTaskId) return
    setTaskNoteStatus('saving')
    try {
      const note = await window.api.saveTaskNote({ taskId: activeTaskId, content: taskNote })
      setTaskNote(note.content)
      setTaskNoteStatus('saved')
      setTimeout(() => setTaskNoteStatus('idle'), 2000)
    } catch (error) {
      setTaskNoteStatus('idle')
      setErrorMessage(getErrorMessage(error, 'Failed to save note.'))
    }
  }

  const logAgentEvent = async (payload: { agentId?: number | null; taskId?: number | null; kind: string; message: string }) => {
    if (!selectedRepoId) return
    try {
      await window.api.createAgentEvent({
        repoId: selectedRepoId,
        agentId: payload.agentId ?? null,
        taskId: payload.taskId ?? null,
        kind: payload.kind,
        message: payload.message,
      })
    } catch (error) {
      console.warn('Failed to log agent event', error)
    }
  }

  const handleRunValidation = async (payload: { taskId: number; command: string; agentId?: number | null }) => {
    try {
      const validation = await window.api.runTaskValidation(payload)
      setTaskValidations((prev) => [validation, ...prev])
      setLatestValidationsByTask((prev) => ({ ...prev, [payload.taskId]: validation }))
      const task = tasks.find((item) => item.id === payload.taskId)
      const statusLabel = validation.ok ? 'passed' : 'failed'
      logAgentEvent({
        agentId: payload.agentId ?? null,
        taskId: payload.taskId,
        kind: validation.ok ? 'validation_pass' : 'validation_fail',
        message: `Validation ${statusLabel} for feature #${payload.taskId}${task ? `: ${task.title}` : ''} · ${validation.command}`,
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to run validation.'))
    }
  }

  const computeSubtaskSummary = (subtasks: Subtask[]) => {
    return subtasks.reduce(
      (acc, subtask) => {
        acc[subtask.status] += 1
        acc.total += 1
        return acc
      },
      { todo: 0, doing: 0, done: 0, total: 0 }
    )
  }

  const handleLoadSubtasks = async (featureId: number) => {
    try {
      const data = await window.api.listSubtasks({ featureId })
      setSubtasksByFeature((prev) => ({ ...prev, [featureId]: data }))
      setSubtaskSummary((prev) => ({ ...prev, [featureId]: computeSubtaskSummary(data) }))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to load subtasks.'))
    }
  }

  const handleAddSubtask = async (featureId: number, title: string) => {
    try {
      const current = subtasksByFeature[featureId] ?? []
      const created = await window.api.addSubtask({
        featureId,
        title,
        status: 'todo',
        orderIndex: current.length,
      })
      const next = [...current, created]
      setSubtasksByFeature((prev) => ({ ...prev, [featureId]: next }))
      setSubtaskSummary((prev) => ({ ...prev, [featureId]: computeSubtaskSummary(next) }))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to add subtask.'))
    }
  }

  const handleUpdateSubtask = async (subtaskId: number, updates: { title?: string; status?: 'todo' | 'doing' | 'done'; orderIndex?: number | null }) => {
    try {
      const updated = await window.api.updateSubtask({ subtaskId, ...updates })
      setSubtasksByFeature((prev) => {
        const list = prev[updated.featureId] ?? []
        const next = list.map((item) => (item.id === updated.id ? updated : item))
        setSubtaskSummary((prevSummary) => ({ ...prevSummary, [updated.featureId]: computeSubtaskSummary(next) }))
        return { ...prev, [updated.featureId]: next }
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to update subtask.'))
    }
  }

  const handleDeleteSubtask = async (featureId: number, subtaskId: number) => {
    try {
      await window.api.deleteSubtask({ subtaskId })
      setSubtasksByFeature((prev) => {
        const list = prev[featureId] ?? []
        const next = list.filter((item) => item.id !== subtaskId)
        setSubtaskSummary((prevSummary) => ({ ...prevSummary, [featureId]: computeSubtaskSummary(next) }))
        return { ...prev, [featureId]: next }
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to delete subtask.'))
    }
  }

  const handleReorderSubtasks = async (featureId: number, orderedIds: number[]) => {
    try {
      const next = await window.api.reorderSubtasks({ featureId, orderedIds })
      setSubtasksByFeature((prev) => ({ ...prev, [featureId]: next }))
      setSubtaskSummary((prev) => ({ ...prev, [featureId]: computeSubtaskSummary(next) }))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to reorder subtasks.'))
    }
  }

  const handleUpdateTaskMetadata = async (payload: {
    taskId: number
    baseRef?: string | null
    worktreePath?: string | null
    branchName?: string | null
    needsReview?: boolean
    planDocPath?: string | null
  }) => {
    try {
      const updated = await window.api.updateTaskMetadata(payload)
      setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to update feature metadata.'))
    }
  }

  const handleStartFeatureThread = async (featureId: number, agentKey: AgentSession['agentKey'] = 'codex') => {
    try {
      const result = await window.api.startFeatureThread({ taskId: featureId, agentKey })
      setTasks((prev) => prev.map((item) => (item.id === result.task.id ? result.task : item)))
      setAgentSessions((prev) => [result.session, ...prev.filter((session) => session.id !== result.session.id)])
      setActiveThreadKind('execution')
      setActiveAgentSessionId(result.session.id)
      setAgentRunIds((prev) => ({ ...prev, [result.session.id]: result.runId }))
      setAgentStreamingMessage({ runId: result.runId, stdout: '', stderr: '' })
      const refreshed = await window.api.listAgentMessages(result.session.id)
      setAgentMessages(refreshed)
      setNoticeMessage('Feature thread started.')
      setTimeout(() => setNoticeMessage(null), 2000)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to start feature thread.'))
    }
  }

  const handleCreatePlannerThread = async () => {
    if (!selectedRepo) return
    try {
      const thread = await window.api.createPlannerThread({
        repoId: selectedRepo.id,
        sandbox: 'workspace-write',
        approval: 'on-request',
        reasoningEffort: 'medium',
      })
      setPlannerThreads((prev) => [thread, ...prev])
      setActivePlannerThreadId(thread.id)
      setActiveThreadKind('planner')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to create planner thread.'))
    }
  }

  const handleSelectThread = (kind: ThreadKind, id: number) => {
    setActiveThreadKind(kind)
    if (kind === 'planner') {
      setActivePlannerThreadId(id)
      setPlannerStreamingMessage(null)
    } else {
      setActiveAgentSessionId(id)
      setAgentStreamingMessage(null)
    }
  }

  const handleDeletePlannerThread = async (threadId: number) => {
    const thread = plannerThreads.find((item) => item.id === threadId)
    if (!thread) return
    const confirmDelete = window.confirm(`Delete "${thread.title}" and remove its worktree? This cannot be undone.`)
    if (!confirmDelete) return
    try {
      const result = await window.api.deletePlannerThread(threadId)
      setPlannerThreads((prev) => prev.filter((item) => item.id !== threadId))
      setPlannerMessages((prev) => (activePlannerThreadId === threadId ? [] : prev))
      if (activePlannerThreadId === threadId) {
        setPlannerStreamingMessage(null)
      }
      setPlannerRunIds((prev) => {
        const next = { ...prev }
        if (threadId in next) delete next[threadId]
        return next
      })
      if (activePlannerThreadId === threadId) {
        setActivePlannerThreadId(null)
        if (activeThreadKind === 'planner') {
          setActiveThreadKind(null)
        }
      }
      if (result.warning) {
        setNoticeMessage(result.warning)
        setTimeout(() => setNoticeMessage(null), 3000)
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to delete planner thread.'))
    }
  }

  const handleUpdatePlannerThread = async (payload: {
    threadId: number
    title?: string
    model?: string | null
    reasoningEffort?: string | null
    sandbox?: string | null
    approval?: string | null
  }) => {
    try {
      const updated = await window.api.updatePlannerThread(payload)
      setPlannerThreads((prev) => prev.map((thread) => (thread.id === updated.id ? updated : thread)))
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to update planner thread.'))
    }
  }

  const handleSendPlannerMessage = async (content: string) => {
    if (!activePlannerThreadId) return
    try {
      const { runId } = await window.api.sendPlannerMessage({ threadId: activePlannerThreadId, content })
      setPlannerRunIds((prev) => ({ ...prev, [activePlannerThreadId]: runId }))
      setPlannerStreamingMessage({ runId, stdout: '', stderr: '' })
      setPlannerThinkingByThreadId((prev) => ({
        ...prev,
        [activePlannerThreadId]: {
          runId,
          stderr: '',
        },
      }))
      const refreshed = await window.api.listPlannerMessages(activePlannerThreadId)
      setPlannerMessages(refreshed)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to send planner message.'))
    }
  }

  const handleSendAgentMessage = async (content: string) => {
    if (!activeAgentSessionId) return
    try {
      const { runId } = await window.api.sendAgentMessage({ sessionId: activeAgentSessionId, content })
      setAgentRunIds((prev) => ({ ...prev, [activeAgentSessionId]: runId }))
      setAgentStreamingMessage({ runId, stdout: '', stderr: '' })
      setAgentThinkingBySessionId((prev) => ({
        ...prev,
        [activeAgentSessionId]: {
          runId,
          stderr: '',
        },
      }))
      const refreshed = await window.api.listAgentMessages(activeAgentSessionId)
      setAgentMessages(refreshed)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to send agent message.'))
    }
  }

  const handleSendThreadMessage = async (content: string) => {
    if (activeThreadKind === 'planner') {
      await handleSendPlannerMessage(content)
    } else if (activeThreadKind === 'execution') {
      await handleSendAgentMessage(content)
    }
  }

  const handleCancelPlannerRun = async (runId: string) => {
    try {
      await window.api.cancelPlannerRun(runId)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to cancel planner run.'))
    }
  }

  const handleCancelAgentRun = async (runId: string) => {
    try {
      await window.api.cancelAgentRun(runId)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to cancel agent run.'))
    }
  }

  const handleCancelThreadRun = async (runId: string) => {
    if (activeThreadKind === 'planner') {
      await handleCancelPlannerRun(runId)
    } else if (activeThreadKind === 'execution') {
      await handleCancelAgentRun(runId)
    }
  }

  const handleCreateFeatureFromPlanner = async (message: { threadId: number; content: string }) => {
    if (!selectedRepo) return
    const parsed = extractFeaturePlanFromText(message.content)
    if (!parsed) {
      setNoticeMessage('No feature JSON found in that response.')
      setTimeout(() => setNoticeMessage(null), 2500)
      return
    }
    const thread = plannerThreads.find((item) => item.id === message.threadId) ?? null
    const featureTitle = parsed.featureTitle?.trim() || thread?.title || 'Untitled Feature'
    try {
      const feature = await window.api.addTask({ repoId: selectedRepo.id, title: featureTitle, status: 'planned' })
      const createdSubtasks = await Promise.all(
        parsed.subtasks.map((item, index) =>
          window.api.addSubtask({
            featureId: feature.id,
            title: item.title,
            status: item.status ?? 'todo',
            orderIndex: index,
          })
        )
      )
      if (thread) {
        await window.api.updateTaskMetadata({
          taskId: feature.id,
          baseRef: thread.baseBranch,
          worktreePath: thread.worktreePath,
        })
      }
      setTasks((prev) => [feature, ...prev])
      setSubtasksByFeature((prev) => ({ ...prev, [feature.id]: createdSubtasks }))
      setSubtaskSummary((prev) => ({ ...prev, [feature.id]: computeSubtaskSummary(createdSubtasks) }))
      setNoticeMessage(`Created feature "${feature.title}" with ${createdSubtasks.length} subtasks.`)
      setTimeout(() => setNoticeMessage(null), 2500)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to create feature from planner output.'))
    }
  }

  return (
    <Layout
      errorMessage={errorMessage}
      noticeMessage={noticeMessage}
      topbar={
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <RepoToolbar
              repos={repos}
              selectedRepoId={selectedRepoId}
              onSelectRepo={setSelectedRepoId}
              onPickRepo={handlePickRepo}
            />
          </div>
          <button
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] text-[color:var(--text)] text-[11px] font-bold uppercase tracking-widest shadow-sm transition-colors hover:bg-[color:var(--panel-strong)]"
            aria-pressed={theme === 'dark'}
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-[color:var(--accent)]" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[color:var(--accent)]" />
                Dark
              </>
            )}
          </button>
        </div>
      }
      sidebar={
        <ResizableSidebar initialWidth={560} minWidth={420} maxWidth={820} hideDivider={!!activeTaskId}>
          <ThreadsPanel
            threads={threadItems}
            activeThread={activeThreadItem}
            messages={activeThreadMessages}
            streamingMessage={activeThreadStreaming}
            thinkingOutput={activeThreadThinking}
            thinkingRunId={activeThreadThinkingRunId}
            activeRunId={activeThreadRunId}
            isRepoSelected={!!selectedRepo}
            className="h-full rounded-none border-0 shadow-none"
            layout="stacked"
            onCreatePlannerThread={handleCreatePlannerThread}
            onSelectThread={handleSelectThread}
            onDeletePlannerThread={handleDeletePlannerThread}
            onSendMessage={handleSendThreadMessage}
            onCancelRun={handleCancelThreadRun}
            onUpdatePlannerThread={handleUpdatePlannerThread}
            onCreateFeature={handleCreateFeatureFromPlanner}
          />
        </ResizableSidebar>
      }
    >
      <div className="flex flex-col h-full min-h-0">
        <FeatureBoard
          features={tasks.filter((task) => task.status !== 'archived')}
          activeFeatureId={activeTaskId}
          onSelectFeature={setActiveTaskId}
          onMoveFeature={handleMoveTask}
          onAddFeature={handleAddTask}
          onDeleteFeature={handleDeleteTask}
          isRepoSelected={!!selectedRepo}
          subtaskSummary={subtaskSummary}
          subtasksByFeature={subtasksByFeature}
          onLoadSubtasks={handleLoadSubtasks}
          latestValidations={latestValidationsByTask}
          mergeStatusByFeature={mergeStatusByTask}
          latestEventsByFeature={latestAgentEventsByTask}
          featureThreads={featureThreadById}
          runningByFeature={runningByFeature}
          onStartThread={handleStartFeatureThread}
          onOpenThread={(sessionId) => handleSelectThread('execution', sessionId)}
        />
      </div>

      <FeatureDrawer
        feature={activeTask}
        repo={selectedRepo}
        note={taskNote}
        noteStatus={taskNoteStatus}
        validations={taskValidations}
        subtasks={activeTaskId ? subtasksByFeature[activeTaskId] ?? [] : []}
        mergeStatus={activeTaskId ? mergeStatusByTask[activeTaskId] : undefined}
        threadInfo={activeFeatureThread}
        onClose={() => setActiveTaskId(null)}
        onNoteChange={setTaskNote}
        onSaveNote={handleSaveNote}
        onDeleteFeature={handleDeleteTask}
        onRunValidation={handleRunValidation}
        onUpdateStatus={handleMoveTask}
        onAddSubtask={handleAddSubtask}
        onUpdateSubtask={handleUpdateSubtask}
        onDeleteSubtask={handleDeleteSubtask}
        onReorderSubtasks={handleReorderSubtasks}
        onStartThread={handleStartFeatureThread}
        onOpenThread={(sessionId) => handleSelectThread('execution', sessionId)}
        onUpdateMetadata={handleUpdateTaskMetadata}
      />
    </Layout>
  )
}

export default App
