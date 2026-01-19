import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { KanbanBoard } from './components/KanbanBoard'
import { TaskDrawer } from './components/TaskDrawer'
import { Layout } from './components/Layout'
import { PlannerPanel } from './components/PlannerPanel'
import { RepoToolbar } from './components/RepoToolbar'
import { ResizableSidebar } from './components/ResizableSidebar'
import { extractTasksFromText } from './lib/agentParsing'
import type { PlannerMessage, PlannerThread, Repo, StreamingMessage, Task, TaskStatus } from './types'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message
  return fallback
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

  const taskPollIntervalMs = 2000

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
        <ResizableSidebar initialWidth={560} minWidth={420} maxWidth={820}>
          <PlannerPanel
            threads={plannerThreads}
            activeThread={activePlannerThread}
            messages={plannerMessages}
            streamingMessage={activePlannerThreadId ? plannerStreamingMessage : null}
            thinkingOutput={activePlannerThreadId ? plannerThinkingByThreadId[activePlannerThreadId]?.stderr ?? '' : ''}
            thinkingRunId={activePlannerThreadId ? plannerThinkingByThreadId[activePlannerThreadId]?.runId ?? null : null}
            activeRunId={activePlannerThreadId ? plannerRunIds[activePlannerThreadId] ?? null : null}
            isRepoSelected={!!selectedRepo}
            className="h-full rounded-none border-0 border-r border-amber-900/10 shadow-none"
            layout="stacked"
            onCreateThread={handleCreatePlannerThread}
            onSelectThread={handleSelectPlannerThread}
            onDeleteThread={handleDeletePlannerThread}
            onSendMessage={handleSendPlannerMessage}
            onCancelRun={handleCancelPlannerRun}
            onUpdateThread={handleUpdatePlannerThread}
            onExtractTasks={handleExtractPlannerTasks}
          />
        </ResizableSidebar>
      }
    >
      <div className="flex flex-col gap-8 h-full min-h-0">
        <div className="flex-1 min-h-0">
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
