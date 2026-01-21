import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, MessageSquare, Calendar, Tag, ChevronRight, Hash, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Agent, Task, TaskValidation, Repo } from '../types'

interface TaskDrawerProps {
  task: Task | null
  repo: Repo | null
  note: string
  noteStatus: 'idle' | 'saving' | 'saved'
  agents: Agent[]
  assignedAgent: Agent | null
  activeAgent: Agent | null
  validations: TaskValidation[]
  onClose: () => void
  onNoteChange: (note: string) => void
  onSaveNote: () => void
  onSendToAgent?: (taskId: number) => void
  onDeleteTask?: (taskId: number) => void
  onAssignAgent: (taskId: number, agentId: number | null) => void
  onReleaseTask: (taskId: number) => void
  onRunValidation: (payload: { taskId: number; command: string; agentId?: number | null }) => void
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  task,
  repo,
  note,
  noteStatus,
  agents,
  assignedAgent,
  activeAgent,
  validations,
  onClose,
  onNoteChange,
  onSaveNote,
  onSendToAgent,
  onDeleteTask,
  onAssignAgent,
  onReleaseTask,
  onRunValidation,
}) => {
  const showAgentAction = Boolean(onSendToAgent)
  const showDeleteAction = Boolean(onDeleteTask)
  const [validationCommand, setValidationCommand] = React.useState('')
  const reviewerAgentId = activeAgent?.id ?? assignedAgent?.id ?? null

  React.useEffect(() => {
    setValidationCommand('')
  }, [task?.id])

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[color:var(--overlay)] backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
          >
            <motion.div
              layoutId={`task-${task.id}`}
              className="w-full max-w-[720px] max-h-[90vh] bg-[color:var(--panel-solid)] rounded-[36px] shadow-2xl flex flex-col overflow-hidden border border-[color:var(--border)]"
            >
              <div className="flex items-center justify-between p-8 border-b border-[color:var(--border-soft)]">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[color:var(--accent)] uppercase tracking-widest">
                    <Hash className="w-3 h-3" />
                    <span>Task-{task.id}</span>
                  </div>
                  <h2 className="text-xl font-bold text-[color:var(--text-strong)] leading-tight pr-8">{task.title}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-2xl bg-[color:var(--accent-ghost)] text-[color:var(--text-subtle)] hover:text-[color:var(--accent)] transition-all hover:rotate-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="flex flex-col gap-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl bg-[color:var(--accent-ghost)] border border-[color:var(--border-soft)] flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3 h-3" /> Status
                      </span>
                      <span className="text-sm font-bold text-[color:var(--text-dim)] capitalize">{task.status.replace('_', ' ')}</span>
                    </div>
                    <div className="p-4 rounded-3xl bg-[color:var(--accent-ghost)] border border-[color:var(--border-soft)] flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Created
                      </span>
                      <span className="text-sm font-bold text-[color:var(--text-dim)]">{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-[color:var(--panel-strong)] border border-[color:var(--border)] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest">Assignment</div>
                      {task.assignedAgentId && (
                        <button
                          onClick={() => onReleaseTask(task.id)}
                          className="text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600"
                        >
                          Release
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-semibold text-[color:var(--text-muted)]">Assignee</label>
                      <select
                        value={task.assignedAgentId ?? ''}
                        onChange={(event) => {
                          const value = event.target.value
                          onAssignAgent(task.id, value ? Number(value) : null)
                        }}
                        className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} · {agent.provider}
                          </option>
                        ))}
                      </select>
                      {assignedAgent ? (
                        <div className="text-[11px] text-[color:var(--text-muted)]">
                          Queued {task.claimedAt ? new Date(task.claimedAt).toLocaleString() : '—'} · {assignedAgent.workspacePath || 'No workspace set'}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[color:var(--text-subtle)]">Select an agent to queue this task.</div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-[color:var(--accent-ghost)] border border-[color:var(--border)] flex flex-col gap-3">
                    <div className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest">Review Flow</div>
                    <div className="text-[11px] text-[color:var(--text-subtle)]">
                      Review indicators are handled in the feature-first workflow. Use the feature drawer to toggle review needs.
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-[color:var(--panel-strong)] border border-[color:var(--border)] shadow-sm flex flex-col gap-4">
                    <div className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest">Validation</div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-semibold text-[color:var(--text-muted)]">Command</label>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <input
                          value={validationCommand}
                          onChange={(event) => setValidationCommand(event.target.value)}
                          placeholder="npm test"
                          className="flex-1 px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                        />
                        <button
                          onClick={() => {
                            const trimmed = validationCommand.trim()
                            if (!trimmed) return
                            onRunValidation({ taskId: task.id, command: trimmed, agentId: reviewerAgentId })
                          }}
                          disabled={!validationCommand.trim()}
                          className="px-4 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent disabled:opacity-40"
                        >
                          Run
                        </button>
                      </div>
                      <div className="text-[11px] text-[color:var(--text-subtle)]">
                        Runs in {activeAgent?.workspacePath || assignedAgent?.workspacePath || repo?.path || 'repo workspace'}.
                      </div>
                    </div>
                    {validations.length > 0 ? (
                      <div className="flex flex-col gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {validations.map((validation) => (
                          <div
                            key={validation.id}
                            className={cn(
                              "p-3 rounded-2xl border text-[11px] whitespace-pre-wrap break-words",
                              validation.ok ? "border-emerald-200 bg-emerald-50/40 text-emerald-700" : "border-rose-200 bg-rose-50/40 text-rose-700"
                            )}
                          >
                            <div className="flex items-center justify-between font-semibold text-[10px] uppercase tracking-widest mb-2">
                              <span>{validation.ok ? 'Pass' : 'Fail'} · {validation.command}</span>
                              <span>{new Date(validation.createdAt).toLocaleString()}</span>
                            </div>
                            {validation.output || 'No output captured.'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[color:var(--text-subtle)]">No validations run yet.</div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest px-1">Implementation Notes</label>
                    <textarea
                      value={note}
                      onChange={(e) => onNoteChange(e.target.value)}
                      placeholder="Describe implementation details, acceptance criteria, or technical constraints..."
                      className="w-full min-h-[300px] bg-[color:var(--accent-ghost)] border border-[color:var(--border)] rounded-[32px] p-6 text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-4 focus:ring-[color:var(--ring-strong)] focus:border-[color:var(--accent-border)] transition-all resize-none shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 bg-[color:var(--accent-ghost)] border-t border-[color:var(--border-soft)] flex items-center gap-3">
                {showDeleteAction && (
                  <button
                    onClick={() => onDeleteTask?.(task.id)}
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wider hover:bg-rose-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
                <button
                  onClick={onSaveNote}
                  disabled={noteStatus === 'saving'}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-3xl font-bold text-sm transition-all shadow-lg shadow-accent",
                    noteStatus === 'saved' 
                      ? "bg-emerald-500 text-white" 
                      : "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] hover:bg-[color:var(--accent-strong)]"
                  )}
                >
                  <Save className="w-4 h-4" />
                  {noteStatus === 'saving' ? 'Saving...' : noteStatus === 'saved' ? 'Note Saved!' : 'Save Changes'}
                </button>
                {showAgentAction && (
                  <button
                    onClick={() => onSendToAgent?.(task.id)}
                    className="flex items-center gap-2 px-6 py-4 rounded-3xl bg-[color:var(--panel-solid)] border border-[color:var(--border)] text-[color:var(--accent)] font-bold text-sm hover:bg-[color:var(--accent-ghost)] transition-all shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Agent
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
