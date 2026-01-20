import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { KanbanBoard } from './components/KanbanBoard'
import { TaskDrawer } from './components/TaskDrawer'
import { Layout } from './components/Layout'
import { PlannerPanel } from './components/PlannerPanel'
import { OrchestratorPanel } from './components/OrchestratorPanel'
import { RepoToolbar } from './components/RepoToolbar'
import { ResizableSidebar } from './components/ResizableSidebar'
import { extractTasksFromText } from './lib/agentParsing'
import { cn } from './lib/utils'
import type {
  OrchestratorRunEvent,
  OrchestratorRun,
  OrchestratorTaskRun,
  OrchestratorValidationArtifact,
  PlannerMessage,
  PlannerThread,
  Repo,
  StreamingMessage,
  Task,
  TaskStatus,
} from './types'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message
  return fallback
}

const defaultOrchestratorConfig = {
  concurrency: 2,
  maxAttempts: 2,
  conflictPolicy: 'halt' as const,
  baseBranch: '',
  model: '',
  reasoningEffort: '',
  sandbox: '',
  approval: '',
  workerValidationCommand: '',
  integrationValidationCommand: '',
}

function App() {
  // State
  const [repos, setRepos] = useState<Repo[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskNote, setTaskNote] = useState('')
  const [taskNoteStatus, setTaskNoteStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)

  const [plannerThreads, setPlannerThreads] = useState<PlannerThread[]>([])
  const [activePlannerThreadId, setActivePlannerThreadId] = useState<number | null>(null)
  const [plannerMessages, setPlannerMessages] = useState<PlannerMessage[]>([])
  const [plannerStreamingMessage, setPlannerStreamingMessage] = useState<StreamingMessage | null>(null)
  const [plannerRunIds, setPlannerRunIds] = useState<Record<number, string>>({})
  const [plannerThinkingByThreadId, setPlannerThinkingByThreadId] = useState<Record<number, { runId: string; stderr: string }>>({})

  const [orchestratorRuns, setOrchestratorRuns] = useState<OrchestratorRun[]>([])
  const [activeOrchestratorRunId, setActiveOrchestratorRunId] = useState<string | null>(null)
  const [orchestratorTasks, setOrchestratorTasks] = useState<OrchestratorTaskRun[]>([])
  const [orchestratorEvents, setOrchestratorEvents] = useState<OrchestratorRunEvent[]>([])
  const [orchestratorValidationArtifacts, setOrchestratorValidationArtifacts] = useState<OrchestratorValidationArtifact[]>([])
  const [orchestratorConfig, setOrchestratorConfig] = useState(() => {
    if (typeof window === 'undefined') return defaultOrchestratorConfig
    try {
      const stored = window.localStorage.getItem('orchestratorConfig')
      if (!stored) return defaultOrchestratorConfig
      const parsed = JSON.parse(stored) as Partial<typeof defaultOrchestratorConfig>
      return { ...defaultOrchestratorConfig, ...parsed }
    } catch {
      return defaultOrchestratorConfig
    }
  })
  const [sidebarView, setSidebarView] = useState<'planner' | 'orchestrator'>(() => {
    if (typeof window === 'undefined') return 'planner'
    try {
      const stored = window.localStorage.getItem('sidebarView')
      if (stored === 'planner' || stored === 'orchestrator') {
        return stored
      }
      return 'planner'
    } catch {
      return 'planner'
    }
  })

  const taskPollIntervalMs = 2000
  const orchestratorPollIntervalMs = 2500

  // Derived State
  const selectedRepo = useMemo(() => repos.find((r) => r.id === selectedRepoId) ?? null, [repos, selectedRepoId])
  const activeTask = useMemo(
    () => (activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null),
    [activeTaskId, tasks]
  )
  const activePlannerThread = useMemo(
    () => (activePlannerThreadId ? plannerThreads.find((thread) => thread.id === activePlannerThreadId) ?? null : null),
    [activePlannerThreadId, plannerThreads]
  )
  const activeOrchestratorRun = useMemo(
    () => (activeOrchestratorRunId ? orchestratorRuns.find((run) => run.id === activeOrchestratorRunId) ?? null : null),
    [activeOrchestratorRunId, orchestratorRuns]
  )

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
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('orchestratorConfig', JSON.stringify(orchestratorConfig))
    } catch {
      // ignore storage failures
    }
  }, [orchestratorConfig])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('sidebarView', sidebarView)
    } catch {
      // ignore storage failures
    }
  }, [sidebarView])

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

  // Orchestrator runs
  useEffect(() => {
    if (!selectedRepoId) {
      setOrchestratorRuns([])
      setActiveOrchestratorRunId(null)
      return
    }

    let canceled = false
    const refreshRuns = (reportError: boolean) => {
      window.api
        .listOrchestratorRuns(selectedRepoId)
        .then((data) => {
          if (canceled) return
          setOrchestratorRuns(data)
          if (data.length > 0 && !data.find((run) => run.id === activeOrchestratorRunId)) {
            setActiveOrchestratorRunId(data[0].id)
          }
        })
        .catch((error) => {
          if (reportError && !canceled) {
            setErrorMessage(getErrorMessage(error, 'Failed to load orchestrator runs.'))
          }
        })
    }

    refreshRuns(true)
    const interval = window.setInterval(() => refreshRuns(false), orchestratorPollIntervalMs)

    return () => {
      canceled = true
      window.clearInterval(interval)
    }
  }, [selectedRepoId, activeOrchestratorRunId])

  // Orchestrator task runs
  useEffect(() => {
    if (!activeOrchestratorRunId) {
      setOrchestratorTasks([])
      return
    }

    let canceled = false
    const refreshTasks = (reportError: boolean) => {
      window.api
        .listOrchestratorTasks(activeOrchestratorRunId)
        .then((data) => {
          if (!canceled) setOrchestratorTasks(data)
        })
        .catch((error) => {
          if (reportError && !canceled) {
            setErrorMessage(getErrorMessage(error, 'Failed to load orchestrator tasks.'))
          }
        })
    }

    refreshTasks(true)
    const interval = window.setInterval(() => refreshTasks(false), orchestratorPollIntervalMs)

    return () => {
      canceled = true
      window.clearInterval(interval)
    }
  }, [activeOrchestratorRunId])

  // Orchestrator run events
  useEffect(() => {
    if (!activeOrchestratorRunId) {
      setOrchestratorEvents([])
      return
    }

    let canceled = false
    const refreshEvents = (reportError: boolean) => {
      window.api
        .listOrchestratorEvents(activeOrchestratorRunId)
        .then((data) => {
          if (!canceled) setOrchestratorEvents(data)
        })
        .catch((error) => {
          if (reportError && !canceled) {
            setErrorMessage(getErrorMessage(error, 'Failed to load orchestrator events.'))
          }
        })
    }

    refreshEvents(true)
    const interval = window.setInterval(() => refreshEvents(false), orchestratorPollIntervalMs)

    return () => {
      canceled = true
      window.clearInterval(interval)
    }
  }, [activeOrchestratorRunId])

  // Orchestrator validation artifacts
  useEffect(() => {
    if (!activeOrchestratorRunId) {
      setOrchestratorValidationArtifacts([])
      return
    }

    let canceled = false
    const refreshArtifacts = (reportError: boolean) => {
      window.api
        .listOrchestratorValidationArtifacts(activeOrchestratorRunId)
        .then((data) => {
          if (!canceled) setOrchestratorValidationArtifacts(data)
        })
        .catch((error) => {
          if (reportError && !canceled) {
            setErrorMessage(getErrorMessage(error, 'Failed to load validation artifacts.'))
          }
        })
    }

    refreshArtifacts(true)
    const interval = window.setInterval(() => refreshArtifacts(false), orchestratorPollIntervalMs)

    return () => {
      canceled = true
      window.clearInterval(interval)
    }
  }, [activeOrchestratorRunId])

  // Planner messages
  useEffect(() => {
    if (!activePlannerThreadId) {
      setPlannerMessages([])
      return
    }
    window.api
      .listPlannerMessages(activePlannerThreadId)
      .then(setPlannerMessages)
      .catch((error) => setErrorMessage(getErrorMessage(error, 'Failed to load planner messages.')))
  }, [activePlannerThreadId])

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
        setRepos((prev) => [res.repo, ...prev.filter((r) => r.id !== res.repo.id)])
        setSelectedRepoId(res.repo.id)
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to pick repo.'))
    }
  }

  const handleAddTask = async (title: string) => {
    if (!selectedRepo) return
    try {
      const task = await window.api.addTask({ repoId: selectedRepo.id, title, status: 'backlog' })
      setTasks(prev => [task, ...prev])
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to add task.'))
    }
  }

  const handleMoveTask = async (taskId: number, status: TaskStatus) => {
    try {
      const task = await window.api.moveTask({ taskId, status })
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
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
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to create planner thread.'))
    }
  }

  const handleSelectPlannerThread = (threadId: number) => {
    setActivePlannerThreadId(threadId)
    setPlannerStreamingMessage(null)
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
        const nextThread = plannerThreads.find((item) => item.id !== threadId)
        setActivePlannerThreadId(nextThread?.id ?? null)
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

  const handleCancelPlannerRun = async (runId: string) => {
    try {
      await window.api.cancelPlannerRun(runId)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to cancel planner run.'))
    }
  }

  const handleExtractPlannerTasks = async (message: PlannerMessage) => {
    if (!selectedRepo) return
    const parsed = extractTasksFromText(message.content)
    if (parsed.length === 0) {
      setNoticeMessage('No JSON tasks found in that response.')
      setTimeout(() => setNoticeMessage(null), 2500)
      return
    }
    try {
      const created = await Promise.all(
        parsed.map((item) => window.api.addTask({ repoId: selectedRepo.id, title: item.title, status: 'proposed' }))
      )
      setTasks((prev) => [...created, ...prev])
      setNoticeMessage(`Added ${created.length} proposed task${created.length === 1 ? '' : 's'}.`)
      setTimeout(() => setNoticeMessage(null), 2500)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to add tasks from planner output.'))
    }
  }

  const handleStartOrchestratorRun = async () => {
    if (!selectedRepo) return
    try {
      const payload = {
        repoId: selectedRepo.id,
        concurrency: orchestratorConfig.concurrency,
        maxAttempts: orchestratorConfig.maxAttempts,
        conflictPolicy: orchestratorConfig.conflictPolicy,
        baseBranch: orchestratorConfig.baseBranch.trim() || undefined,
        model: orchestratorConfig.model.trim() || undefined,
        reasoningEffort: orchestratorConfig.reasoningEffort || undefined,
        sandbox: orchestratorConfig.sandbox || undefined,
        approval: orchestratorConfig.approval || undefined,
        workerValidationCommand: orchestratorConfig.workerValidationCommand.trim() || undefined,
        integrationValidationCommand: orchestratorConfig.integrationValidationCommand.trim() || undefined,
      }
      const { runId } = await window.api.startOrchestratorRun(payload)
      setActiveOrchestratorRunId(runId)
      setNoticeMessage('Orchestrator run started.')
      setTimeout(() => setNoticeMessage(null), 2500)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to start orchestrator run.'))
    }
  }

  const handleCancelOrchestratorRun = async (runId: string) => {
    try {
      await window.api.cancelOrchestratorRun(runId)
      setNoticeMessage('Orchestrator run canceled.')
      setTimeout(() => setNoticeMessage(null), 2500)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to cancel orchestrator run.'))
    }
  }

  return (
    <Layout
      errorMessage={errorMessage}
      noticeMessage={noticeMessage}
      topbar={
        <RepoToolbar
          repos={repos}
          selectedRepoId={selectedRepoId}
          onSelectRepo={setSelectedRepoId}
          onPickRepo={handlePickRepo}
        />
      }
      sidebar={
        <ResizableSidebar initialWidth={560} minWidth={420} maxWidth={820} hideDivider={!!activeTaskId}>
          <div className="flex flex-col h-full min-h-0">
            <div className="px-4 py-3 border-b border-amber-900/10 bg-white/30 backdrop-blur">
              <div className="flex items-center gap-2 rounded-2xl bg-amber-900/5 p-1">
                <button
                  type="button"
                  onClick={() => setSidebarView('planner')}
                  className={cn(
                    "flex-1 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all",
                    sidebarView === 'planner'
                      ? "bg-white text-amber-900 shadow-sm"
                      : "text-amber-900/50 hover:text-amber-900"
                  )}
                >
                  Planner
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarView('orchestrator')}
                  className={cn(
                    "flex-1 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all",
                    sidebarView === 'orchestrator'
                      ? "bg-white text-amber-900 shadow-sm"
                      : "text-amber-900/50 hover:text-amber-900"
                  )}
                >
                  Orchestrator
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {sidebarView === 'planner' ? (
                <PlannerPanel
                  threads={plannerThreads}
                  activeThread={activePlannerThread}
                  messages={plannerMessages}
                  streamingMessage={activePlannerThreadId ? plannerStreamingMessage : null}
                  thinkingOutput={activePlannerThreadId ? plannerThinkingByThreadId[activePlannerThreadId]?.stderr ?? '' : ''}
                  thinkingRunId={activePlannerThreadId ? plannerThinkingByThreadId[activePlannerThreadId]?.runId ?? null : null}
                  activeRunId={activePlannerThreadId ? plannerRunIds[activePlannerThreadId] ?? null : null}
                  isRepoSelected={!!selectedRepo}
                  className="h-full rounded-none border-0 shadow-none"
                  layout="stacked"
                  onCreateThread={handleCreatePlannerThread}
                  onSelectThread={handleSelectPlannerThread}
                  onDeleteThread={handleDeletePlannerThread}
                  onSendMessage={handleSendPlannerMessage}
                  onCancelRun={handleCancelPlannerRun}
                  onUpdateThread={handleUpdatePlannerThread}
                  onExtractTasks={handleExtractPlannerTasks}
                />
              ) : (
                <OrchestratorPanel
                  runs={orchestratorRuns}
                  activeRun={activeOrchestratorRun}
                  tasks={orchestratorTasks}
                  events={orchestratorEvents}
                  validationArtifacts={orchestratorValidationArtifacts}
                  config={orchestratorConfig}
                  isRepoSelected={!!selectedRepo}
                  className="h-full rounded-none border-0 shadow-none"
                  onSelectRun={setActiveOrchestratorRunId}
                  onStartRun={handleStartOrchestratorRun}
                  onCancelRun={handleCancelOrchestratorRun}
                  onConfigChange={setOrchestratorConfig}
                />
              )}
            </div>
          </div>
        </ResizableSidebar>
      }
    >
      <div className="flex flex-col h-full min-h-0">
        <KanbanBoard
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelectTask={setActiveTaskId}
          onMoveTask={handleMoveTask}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          isRepoSelected={!!selectedRepo}
        />
      </div>

      <TaskDrawer
        task={activeTask}
        repo={selectedRepo}
        note={taskNote}
        noteStatus={taskNoteStatus}
        onClose={() => setActiveTaskId(null)}
        onNoteChange={setTaskNote}
        onSaveNote={handleSaveNote}
        onDeleteTask={handleDeleteTask}
      />
    </Layout>
  )
}

export default App
