import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { extractTasksFromText } from './lib/agentParsing'
import './App.css'

function App() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskInput, setTaskInput] = useState('')
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskNote, setTaskNote] = useState('')
  const [taskNoteStatus, setTaskNoteStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [activeTab, setActiveTab] = useState<'terminal' | 'agent'>('terminal')
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [agentProvider, setAgentProvider] = useState<AgentSession['agentKey']>('claude')
  const [agentTaskId, setAgentTaskId] = useState<number | null>(null)
  const [streamingBySession, setStreamingBySession] = useState<Record<number, { runId: string; text: string }>>(
    {}
  )
  const [commandInput, setCommandInput] = useState('git status')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [plannerRunId, setPlannerRunId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const terminalRef = useRef<HTMLDivElement | null>(null)
  const plannerRef = useRef<HTMLDivElement | null>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const plannerTermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const plannerFitAddonRef = useRef<FitAddon | null>(null)
  const activeRunIdRef = useRef<string | null>(null)
  const plannerRunIdRef = useRef<string | null>(null)
  const showLegacyPanels = false

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId) ?? null,
    [repos, selectedRepoId]
  )

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const activeTask = useMemo(() => (activeTaskId ? taskById.get(activeTaskId) ?? null : null), [activeTaskId, taskById])
  const activeSession = useMemo(
    () => agentSessions.find((session) => session.id === activeSessionId) ?? null,
    [agentSessions, activeSessionId]
  )

  const statusOrder = useMemo(() => ['proposed', 'backlog', 'in_progress', 'done'] as const, [])

  const columns = useMemo(
    () => [
      { key: 'proposed' as const, title: 'Proposed' },
      { key: 'backlog' as const, title: 'Backlog' },
      { key: 'in_progress' as const, title: 'In Progress' },
      { key: 'done' as const, title: 'Done' },
    ],
    []
  )

  useEffect(() => {
    window.api
      .listRepos()
      .then((data) => {
        setRepos(data)
        if (data.length > 0) {
          setSelectedRepoId(data[0].id)
        }
      })
      .catch((error: Error) => {
        setErrorMessage(error.message)
      })
  }, [])

  useEffect(() => {
    if (!selectedRepoId) {
      setTasks([])
      setAgentSessions([])
      setActiveSessionId(null)
      setAgentMessages([])
      setStreamingBySession({})
      setActiveTaskId(null)
      setAgentTaskId(null)
      return
    }
    window.api
      .listTasks(selectedRepoId)
      .then((data) => setTasks(data))
      .catch((error: Error) => {
        setErrorMessage(error.message)
      })
    window.api
      .listAgentSessions(selectedRepoId)
      .then((data) => {
        setAgentSessions(data)
        setActiveSessionId(data[0]?.id ?? null)
      })
      .catch((error: Error) => {
        setErrorMessage(error.message)
      })
  }, [selectedRepoId])

  useEffect(() => {
    if (activeTaskId) {
      setAgentTaskId(activeTaskId)
    }
  }, [activeTaskId])

  useEffect(() => {
    if (!activeSessionId) {
      setAgentMessages([])
      return
    }
    window.api
      .listAgentMessages(activeSessionId)
      .then((data) => setAgentMessages(data))
      .catch((error: Error) => {
        setErrorMessage(error.message)
      })
  }, [activeSessionId])

  useEffect(() => {
    if (activeTaskId && !taskById.has(activeTaskId)) {
      setActiveTaskId(null)
    }
  }, [activeTaskId, taskById])

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
      .catch((error: Error) => {
        setErrorMessage(error.message)
      })
  }, [activeTaskId])

  useEffect(() => {
    activeRunIdRef.current = activeRunId
  }, [activeRunId])

  useEffect(() => {
    plannerRunIdRef.current = plannerRunId
  }, [plannerRunId])

  useEffect(() => {
    if (activeTab === 'terminal') {
      setTimeout(() => fitAddonRef.current?.fit(), 0)
    }
  }, [activeTab])

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      fontSize: 13,
      theme: {
        background: '#1f1c16',
        foreground: '#f7f3ed',
      },
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()
    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(terminalRef.current)
    const dataDisposable = term.onData((data) => {
      const runId = activeRunIdRef.current
      if (!runId) return
      window.api.sendCommandInput({ runId, data }).catch(() => {})
    })
    xtermRef.current = term
    fitAddonRef.current = fitAddon
    return () => {
      dataDisposable.dispose()
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.onCommandOutput((data) => {
      const terminalRunId = activeRunIdRef.current
      const plannerRun = plannerRunIdRef.current
      if (terminalRunId && data.runId === terminalRunId) {
        const term = xtermRef.current
        if (!term) return
        if (data.kind === 'stdout' || data.kind === 'stderr') {
          term.write(data.text ?? '')
        } else if (data.kind === 'exit') {
          term.writeln(`\r\n[exit ${data.code ?? 0}]`)
        } else if (data.kind === 'error') {
          term.writeln(`\r\n[error] ${data.text ?? ''}`)
        }
      }
      if (plannerRun && data.runId === plannerRun) {
        const term = plannerTermRef.current
        if (!term) return
        if (data.kind === 'stdout' || data.kind === 'stderr') {
          term.write(data.text ?? '')
        } else if (data.kind === 'exit') {
          term.writeln(`\r\n[exit ${data.code ?? 0}]`)
          setPlannerRunId(null)
        } else if (data.kind === 'error') {
          term.writeln(`\r\n[error] ${data.text ?? ''}`)
        }
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!plannerRef.current || plannerTermRef.current) return
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      fontSize: 13,
      theme: {
        background: '#1f1c16',
        foreground: '#f7f3ed',
      },
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(plannerRef.current)
    fitAddon.fit()
    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(plannerRef.current)
    const dataDisposable = term.onData((data) => {
      const runId = plannerRunIdRef.current
      if (!runId) return
      window.api.sendCommandInput({ runId, data }).catch(() => {})
    })
    plannerTermRef.current = term
    plannerFitAddonRef.current = fitAddon
    return () => {
      dataDisposable.dispose()
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      term.dispose()
      plannerTermRef.current = null
      plannerFitAddonRef.current = null
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.onAgentOutput((data) => {
      if (data.kind === 'exit') {
        setStreamingBySession((prev) => {
          const next = { ...prev }
          delete next[data.sessionId]
          return next
        })
        if (data.sessionId === activeSessionId) {
          window.api.listAgentMessages(data.sessionId).then((messages) => setAgentMessages(messages))
        }
        return
      }
      if (!data.text) return
      setStreamingBySession((prev) => {
        const current = prev[data.sessionId]
        const text = `${current?.text ?? ''}${data.text ?? ''}`
        return { ...prev, [data.sessionId]: { runId: data.runId, text } }
      })
    })
    return unsubscribe
  }, [activeSessionId])

  const handlePickRepo = async () => {
    setErrorMessage(null)
    const result = await window.api.pickRepo()
    if (result.canceled) return
    if (result.error) {
      setErrorMessage(result.error)
      return
    }
    if (result.repo) {
      const repo = result.repo
      setRepos((prev) => [repo, ...prev.filter((item) => item.id !== repo.id)])
      setSelectedRepoId(repo.id)
    }
  }

  const handleRunCommand = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setErrorMessage(null)
    if (!selectedRepo) {
      setErrorMessage('Select a repo before running a command.')
      return
    }
    if (!commandInput.trim()) return
    const term = xtermRef.current
    term?.reset()
    term?.writeln(`$ ${commandInput}`)
    try {
      const { runId } = await window.api.runCommand({
        repoId: selectedRepo.id,
        commandLine: commandInput,
      })
      setActiveRunId(runId)
      term?.focus()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Command failed to start.')
    }
  }

  const handleStartPlanner = async () => {
    setErrorMessage(null)
    if (!selectedRepo) {
      setErrorMessage('Select a repo before starting the planner.')
      return
    }
    if (plannerRunId) {
      setErrorMessage('Planner is already running.')
      return
    }
    const term = plannerTermRef.current
    term?.reset()
    term?.writeln('$ codex')
    term?.focus()
    try {
      const { runId } = await window.api.runCommand({
        repoId: selectedRepo.id,
        commandLine: 'codex',
      })
      setPlannerRunId(runId)
      plannerFitAddonRef.current?.fit()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start planner.')
    }
  }

  const handleStopPlanner = async () => {
    if (!plannerRunId) return
    try {
      await window.api.sendCommandInput({ runId: plannerRunId, data: '\u0003' })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to stop planner.')
    }
  }

  const handleAddTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    if (!selectedRepo) {
      setErrorMessage('Select a repo before creating a task.')
      return
    }
    const title = taskInput.trim()
    if (!title) return
    try {
      const task = await window.api.addTask({
        repoId: selectedRepo.id,
        title,
        status: 'backlog',
      })
      setTasks((prev) => [task, ...prev])
      setTaskInput('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create task.')
    }
  }

  const updateTaskStatus = async (taskId: number, status: TaskStatus) => {
    try {
      const task = await window.api.moveTask({ taskId, status })
      setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update task.')
    }
  }

  const handleStepTask = async (task: Task, direction: 'prev' | 'next') => {
    const index = statusOrder.indexOf(task.status)
    const targetIndex = direction === 'next' ? index + 1 : index - 1
    const nextStatus = statusOrder[targetIndex]
    if (!nextStatus) return
    await updateTaskStatus(task.id, nextStatus)
  }

  const handleSelectTask = (taskId: number) => {
    setActiveTaskId(taskId)
  }

  const handleSaveNote = async () => {
    if (!activeTaskId) return
    setTaskNoteStatus('saving')
    try {
      const note = await window.api.saveTaskNote({ taskId: activeTaskId, content: taskNote })
      setTaskNote(note.content)
      setTaskNoteStatus('saved')
      setTimeout(() => setTaskNoteStatus('idle'), 1200)
    } catch (error) {
      setTaskNoteStatus('idle')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save note.')
    }
  }

  const handleCreateSession = async (taskOverride?: number | null) => {
    if (!selectedRepo) {
      setErrorMessage('Select a repo before starting a session.')
      return
    }
    try {
      const session = await window.api.createAgentSession({
        repoId: selectedRepo.id,
        agentKey: agentProvider,
        taskId: taskOverride ?? agentTaskId ?? null,
      })
      setAgentSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)])
      setActiveSessionId(session.id)
      setActiveTab('agent')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create session.')
    }
  }

  const handleSendAgentMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeSessionId) {
      setErrorMessage('Select a session before sending a message.')
      return
    }
    const content = agentInput.trim()
    if (!content) return
    setAgentInput('')
    setErrorMessage(null)
    try {
      const { runId } = await window.api.sendAgentMessage({ sessionId: activeSessionId, content })
      const messages = await window.api.listAgentMessages(activeSessionId)
      setAgentMessages(messages)
      setStreamingBySession((prev) => ({ ...prev, [activeSessionId]: { runId, text: '' } }))
      setActiveTab('agent')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message.')
    }
  }

  const handleCancelRun = async (sessionId: number) => {
    const activeRun = streamingBySession[sessionId]
    if (!activeRun) return
    try {
      await window.api.cancelAgentRun(activeRun.runId)
      setStreamingBySession((prev) => {
        const next = { ...prev }
        delete next[sessionId]
        return next
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to cancel run.')
    }
  }

  const handleCreateTasksFromMessage = async (message: AgentMessage) => {
    if (!selectedRepo) {
      setErrorMessage('Select a repo before creating tasks.')
      return
    }
    const parsed = extractTasksFromText(message.content)
    if (parsed.length === 0) {
      setErrorMessage('No JSON tasks found in the message.')
      return
    }
    const created: Task[] = []
    for (const item of parsed) {
      const task = await window.api.addTask({
        repoId: selectedRepo.id,
        title: item.title,
        status: 'proposed',
      })
      created.push(task)
    }
    if (created.length === 0) {
      setErrorMessage('No valid tasks found in the JSON payload.')
      return
    }
    setTasks((prev) => [...created, ...prev])
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span>Agent Playground</span>
          <button className="ghost" onClick={handlePickRepo} type="button">
            Attach repo
          </button>
        </div>

        <div className="section">
          <div className="section-title">Repositories</div>
          <ul className="repo-list">
            {repos.length === 0 ? (
              <li className="empty">No repos yet. Attach one to start.</li>
            ) : (
              repos.map((repo) => (
                <li key={repo.id}>
                  <button
                    className={`repo-item${selectedRepoId === repo.id ? ' selected' : ''}`}
                    onClick={() => setSelectedRepoId(repo.id)}
                    type="button"
                  >
                    <span className="repo-name">{repo.name}</span>
                    <span className="repo-path">{repo.path}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <div className="eyebrow">Active repo</div>
            <div className="title">{selectedRepo ? selectedRepo.name : 'None selected'}</div>
          </div>
          <div className="meta">
            {selectedRepo ? selectedRepo.path : 'Attach or pick a repo to run commands.'}
          </div>
        </header>

        <section className="board">
          <div className="board-header">
            <div>
              <div className="eyebrow">Kanban</div>
              <div className="board-title">Focus board</div>
            </div>
            <form className="board-form" onSubmit={handleAddTask}>
              <input
                className="board-input"
                value={taskInput}
                onChange={(event) => setTaskInput(event.target.value)}
                placeholder="Add a task"
                spellCheck={false}
                disabled={!selectedRepo}
              />
              <button className="primary" type="submit" disabled={!selectedRepo}>
                Add
              </button>
            </form>
          </div>

          <div className="board-columns">
            {columns.map((column) => {
              const columnTasks = tasks.filter((task) => task.status === column.key)
              return (
                <div className="column" key={column.key}>
                  <div className="column-header">
                    <div className="column-title">{column.title}</div>
                    <div className="column-count">{columnTasks.length}</div>
                  </div>
                  <div className="column-body">
                    {columnTasks.length === 0 ? (
                      <div className="column-empty">Drop a task here when ready.</div>
                    ) : (
                      columnTasks.map((task) => (
                        <div
                          className={`task-card${activeTaskId === task.id ? ' selected' : ''}`}
                          key={task.id}
                          onClick={() => handleSelectTask(task.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              handleSelectTask(task.id)
                            }
                          }}
                        >
                          <div className="task-title">{task.title}</div>
                          <div className="task-actions">
                            <button
                              className="ghost tiny"
                              type="button"
                              disabled={statusOrder.indexOf(task.status) === 0}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleStepTask(task, 'prev')
                              }}
                            >
                              Prev
                            </button>
                            <button
                              className="ghost tiny"
                              type="button"
                              disabled={statusOrder.indexOf(task.status) === statusOrder.length - 1}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleStepTask(task, 'next')
                              }}
                            >
                              {task.status === 'proposed' ? 'Approve' : 'Next'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="planner-panel">
            <div className="planner-header">
              <div>
                <div className="eyebrow">Planner</div>
                <div className="planner-title">Planning agent</div>
              </div>
              <div className="planner-actions">
                <button className="ghost tiny" type="button" onClick={handleStopPlanner} disabled={!plannerRunId}>
                  Stop
                </button>
                <button className="primary" type="button" onClick={handleStartPlanner} disabled={!selectedRepo || !!plannerRunId}>
                  {plannerRunId ? 'Running' : 'Start'}
                </button>
              </div>
            </div>
            <div
              className="planner-terminal"
              onClick={() => {
                plannerTermRef.current?.focus()
              }}
            >
              <div className="planner-terminal-title">Codex (interactive)</div>
              <div className="planner-terminal-body" ref={plannerRef} />
            </div>
          </div>
        </section>

        {activeTask ? (
          <section className="task-drawer">
            <div className="task-drawer-header">
              <div>
                <div className="eyebrow">Task</div>
                <div className="task-drawer-title">{activeTask.title}</div>
              </div>
              <button className="ghost tiny" type="button" onClick={() => setActiveTaskId(null)}>
                Close
              </button>
            </div>
            <div className="task-drawer-meta">
              <span>Status: {activeTask.status}</span>
              <span>Repo: {selectedRepo?.name ?? 'Unknown'}</span>
            </div>
            <textarea
              className="task-drawer-notes"
              value={taskNote}
              onChange={(event) => setTaskNote(event.target.value)}
              placeholder="Add notes, acceptance criteria, or doc links..."
            />
            <div className="task-drawer-actions">
              <button className="primary" type="button" onClick={handleSaveNote}>
                {taskNoteStatus === 'saving' ? 'Saving...' : taskNoteStatus === 'saved' ? 'Saved' : 'Save note'}
              </button>
              <button className="ghost" type="button" onClick={() => handleCreateSession(activeTask.id)}>
                Send to agent
              </button>
            </div>
          </section>
        ) : null}

        {showLegacyPanels ? (
          <section className="panel">
            <div className="panel-tabs">
              <button
                className={`tab${activeTab === 'agent' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveTab('agent')}
              >
                Agent
              </button>
              <button
                className={`tab${activeTab === 'terminal' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveTab('terminal')}
              >
                Terminal
              </button>
            </div>

            {errorMessage ? <div className="error">{errorMessage}</div> : null}

            <div className="panel-body">
              <div className={`panel-section ${activeTab === 'terminal' ? 'active' : ''}`}>
                <form className="command-form" onSubmit={handleRunCommand}>
                  <input
                    className="command-input"
                    value={commandInput}
                    onChange={(event) => setCommandInput(event.target.value)}
                    placeholder="git status"
                    spellCheck={false}
                  />
                  <button className="primary" type="submit" disabled={!selectedRepo}>
                    Run
                  </button>
                </form>

                <div className="terminal">
                  <div className="terminal-title">Terminal</div>
                  <div className="terminal-body" ref={terminalRef} />
                </div>
              </div>

              <div className={`panel-section agent-section ${activeTab === 'agent' ? 'active' : ''}`}>
                <div className="agent-panel">
                  <div className="agent-sidebar">
                    <div className="agent-controls">
                      <div className="agent-control">
                        <label>Agent</label>
                        <select
                          value={agentProvider}
                          onChange={(event) => setAgentProvider(event.target.value as AgentSession['agentKey'])}
                        >
                          <option value="claude">Claude</option>
                          <option value="gemini">Gemini</option>
                          <option value="codex">Codex</option>
                        </select>
                      </div>
                      <div className="agent-control">
                        <label>Task</label>
                        <select
                          value={agentTaskId ?? ''}
                          onChange={(event) => setAgentTaskId(event.target.value ? Number(event.target.value) : null)}
                        >
                          <option value="">No task</option>
                          {tasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="primary" type="button" onClick={() => handleCreateSession()} disabled={!selectedRepo}>
                        New session
                      </button>
                    </div>

                    <div className="agent-sessions">
                      {agentSessions.length === 0 ? (
                        <div className="column-empty">No sessions yet.</div>
                      ) : (
                        agentSessions.map((session) => {
                          const task = session.taskId ? taskById.get(session.taskId) : null
                          const isActive = session.id === activeSessionId
                          const isRunning = Boolean(streamingBySession[session.id])
                          return (
                            <button
                              key={session.id}
                              type="button"
                              className={`agent-session${isActive ? ' active' : ''}`}
                              onClick={() => {
                                setActiveSessionId(session.id)
                                setActiveTab('agent')
                              }}
                            >
                              <div className="agent-session-title">
                                {session.agentKey}
                                {isRunning ? <span className="agent-session-badge">Running</span> : null}
                              </div>
                              <div className="agent-session-subtitle">{task ? task.title : 'General session'}</div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="agent-chat">
                    <div className="agent-chat-header">
                      <div>
                        <div className="agent-chat-title">
                          {activeSession ? `${activeSession.agentKey} session` : 'No session selected'}
                        </div>
                        <div className="agent-chat-subtitle">
                          {activeSession?.taskId
                            ? taskById.get(activeSession.taskId)?.title ?? 'Linked task'
                            : 'No task linked'}
                        </div>
                      </div>
                      {activeSession && streamingBySession[activeSession.id] ? (
                        <button className="ghost tiny" type="button" onClick={() => handleCancelRun(activeSession.id)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>

                    <div className="agent-messages">
                      {activeSessionId ? (
                        <>
                          {agentMessages.map((message) => (
                            <div key={message.id} className={`agent-message ${message.role}`}>
                              <div className="agent-message-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                              </div>
                              {message.role === 'assistant' ? (
                                <button
                                  className="ghost tiny"
                                  type="button"
                                  onClick={() => handleCreateTasksFromMessage(message)}
                                >
                                  Create tasks
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {streamingBySession[activeSessionId] ? (
                            <div className="agent-message assistant">
                              <div className="agent-message-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {streamingBySession[activeSessionId].text}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="column-empty">Select a session to view messages.</div>
                      )}
                    </div>

                    <form className="agent-input" onSubmit={handleSendAgentMessage}>
                      <input
                        value={agentInput}
                        onChange={(event) => setAgentInput(event.target.value)}
                        placeholder={activeSessionId ? 'Send a message' : 'Create a session to start chatting'}
                        disabled={!activeSessionId}
                      />
                      <button className="primary" type="submit" disabled={!activeSessionId}>
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
