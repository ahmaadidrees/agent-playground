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
  onRequestReview: (taskId: number) => void
  onApproveReview: (taskId: number, reviewerAgentId?: number | null) => void
  onRequestChanges: (taskId: number) => void
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
  onRequestReview,
  onApproveReview,
  onRequestChanges,
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
            className="fixed inset-0 bg-amber-950/20 backdrop-blur-sm z-40"
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
              className="w-full max-w-[720px] max-h-[90vh] bg-white rounded-[36px] shadow-2xl flex flex-col overflow-hidden border border-amber-900/10"
            >
              <div className="flex items-center justify-between p-8 border-b border-amber-900/5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    <Hash className="w-3 h-3" />
                    <span>Task-{task.id}</span>
                  </div>
                  <h2 className="text-xl font-bold text-amber-950 leading-tight pr-8">{task.title}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-2xl bg-amber-50 text-amber-900/40 hover:text-amber-600 transition-all hover:rotate-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="flex flex-col gap-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl bg-amber-50/50 border border-amber-900/5 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-amber-900/30 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3 h-3" /> Status
                      </span>
                      <span className="text-sm font-bold text-amber-900/80 capitalize">{task.status.replace('_', ' ')}</span>
                    </div>
                    <div className="p-4 rounded-3xl bg-amber-50/50 border border-amber-900/5 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-amber-900/30 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Created
                      </span>
                      <span className="text-sm font-bold text-amber-900/80">{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-white/80 border border-amber-900/10 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-amber-900/30 uppercase tracking-widest">Assignment</div>
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
                      <label className="text-[11px] font-semibold text-amber-900/60">Assignee</label>
                      <select
                        value={task.assignedAgentId ?? ''}
                        onChange={(event) => {
                          const value = event.target.value
                          onAssignAgent(task.id, value ? Number(value) : null)
                        }}
                        className="px-3 py-2 rounded-2xl border border-amber-900/10 bg-white text-sm text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} · {agent.provider}
                          </option>
                        ))}
                      </select>
                      {assignedAgent ? (
                        <div className="text-[11px] text-amber-900/50">
                          Claimed {task.claimedAt ? new Date(task.claimedAt).toLocaleString() : '—'} · {assignedAgent.workspacePath || 'No workspace set'}
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-900/40">Select an agent to claim this task.</div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-amber-50/40 border border-amber-900/10 flex flex-col gap-3">
                    <div className="text-[10px] font-bold text-amber-900/30 uppercase tracking-widest">Review Flow</div>
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => onRequestReview(task.id)}
                        className="px-4 py-2 rounded-2xl bg-amber-500 text-white text-xs font-bold uppercase tracking-widest shadow-md shadow-amber-500/20"
                      >
                        Request Review
                      </button>
                    )}
                    {task.status === 'review' && (
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => onApproveReview(task.id, reviewerAgentId)}
                          className="px-4 py-2 rounded-2xl bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest shadow-md shadow-emerald-500/20"
                        >
                          Approve &amp; Done
                        </button>
                        <button
                          onClick={() => onRequestChanges(task.id)}
                          className="px-4 py-2 rounded-2xl bg-rose-500/10 text-rose-600 text-xs font-bold uppercase tracking-widest"
                        >
                          Needs Changes
                        </button>
                        <div className="text-[11px] text-amber-900/50">
                          Reviewer: {activeAgent?.name ?? assignedAgent?.name ?? 'Unassigned'} · Requested {task.reviewRequestedAt ? new Date(task.reviewRequestedAt).toLocaleString() : '—'}
                        </div>
                      </div>
                    )}
                    {task.status !== 'in_progress' && task.status !== 'review' && (
                      <div className="text-[11px] text-amber-900/40">
                        Move the task to in progress to request a review.
                      </div>
                    )}
                  </div>

                  <div className="p-5 rounded-3xl bg-white/80 border border-amber-900/10 shadow-sm flex flex-col gap-4">
                    <div className="text-[10px] font-bold text-amber-900/30 uppercase tracking-widest">Validation</div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-semibold text-amber-900/60">Command</label>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <input
                          value={validationCommand}
                          onChange={(event) => setValidationCommand(event.target.value)}
                          placeholder="npm test"
                          className="flex-1 px-3 py-2 rounded-2xl border border-amber-900/10 bg-white text-sm text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <button
                          onClick={() => {
                            const trimmed = validationCommand.trim()
                            if (!trimmed) return
                            onRunValidation({ taskId: task.id, command: trimmed, agentId: reviewerAgentId })
                          }}
                          disabled={!validationCommand.trim()}
                          className="px-4 py-2 rounded-2xl bg-amber-500 text-white text-xs font-bold uppercase tracking-widest shadow-md shadow-amber-500/20 disabled:opacity-40"
                        >
                          Run
                        </button>
                      </div>
                      <div className="text-[11px] text-amber-900/40">
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
                      <div className="text-[11px] text-amber-900/40">No validations run yet.</div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-bold text-amber-900/30 uppercase tracking-widest px-1">Implementation Notes</label>
                    <textarea
                      value={note}
                      onChange={(e) => onNoteChange(e.target.value)}
                      placeholder="Describe implementation details, acceptance criteria, or technical constraints..."
                      className="w-full min-h-[300px] bg-amber-50/30 border border-amber-900/10 rounded-[32px] p-6 text-sm text-amber-950 focus:outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/50 transition-all resize-none shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 bg-amber-50/50 border-t border-amber-900/5 flex items-center gap-3">
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
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-3xl font-bold text-sm transition-all shadow-lg shadow-amber-500/10",
                    noteStatus === 'saved' 
                      ? "bg-emerald-500 text-white" 
                      : "bg-amber-500 text-white hover:bg-amber-600"
                  )}
                >
                  <Save className="w-4 h-4" />
                  {noteStatus === 'saving' ? 'Saving...' : noteStatus === 'saved' ? 'Note Saved!' : 'Save Changes'}
                </button>
                {showAgentAction && (
                  <button
                    onClick={() => onSendToAgent?.(task.id)}
                    className="flex items-center gap-2 px-6 py-4 rounded-3xl bg-white border border-amber-900/10 text-amber-600 font-bold text-sm hover:bg-amber-50 transition-all shadow-sm"
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
