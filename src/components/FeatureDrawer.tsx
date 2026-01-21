import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Save,
  MessageSquare,
  Calendar,
  Tag,
  Hash,
  Trash2,
  PlayCircle,
  GitBranch,
  FolderOpen,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { Subtask, Task, TaskStatus, TaskValidation, Repo } from '../types'

interface FeatureDrawerProps {
  feature: Task | null
  repo: Repo | null
  note: string
  noteStatus: 'idle' | 'saving' | 'saved'
  validations: TaskValidation[]
  subtasks: Subtask[]
  mergeStatus?: { baseRef: string; branchName: string; ahead: number; behind: number; needsMerge: boolean; error?: string }
  threadInfo?: { sessionId: number; agentKey: 'claude' | 'gemini' | 'codex' } | null
  onClose: () => void
  onNoteChange: (note: string) => void
  onSaveNote: () => void
  onDeleteFeature?: (featureId: number) => void
  onUpdateStatus: (featureId: number, status: TaskStatus) => void
  onRunValidation: (payload: { taskId: number; command: string; agentId?: number | null }) => void
  onAddSubtask: (featureId: number, title: string) => void
  onUpdateSubtask: (subtaskId: number, updates: { title?: string; status?: 'todo' | 'doing' | 'done'; orderIndex?: number | null }) => void
  onDeleteSubtask: (featureId: number, subtaskId: number) => void
  onReorderSubtasks: (featureId: number, orderedIds: number[]) => void
  onStartThread?: (featureId: number) => void
  onOpenThread?: (sessionId: number) => void
  onUpdateMetadata: (payload: {
    taskId: number
    baseRef?: string | null
    worktreePath?: string | null
    branchName?: string | null
    needsReview?: boolean
    planDocPath?: string | null
  }) => void
}

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'executed', label: 'Executed' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

export const FeatureDrawer: React.FC<FeatureDrawerProps> = ({
  feature,
  repo,
  note,
  noteStatus,
  validations,
  subtasks,
  mergeStatus,
  threadInfo,
  onClose,
  onNoteChange,
  onSaveNote,
  onDeleteFeature,
  onUpdateStatus,
  onRunValidation,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onReorderSubtasks,
  onStartThread,
  onOpenThread,
  onUpdateMetadata,
}) => {
  const showDeleteAction = Boolean(onDeleteFeature)
  const [validationCommand, setValidationCommand] = React.useState('')
  const [subtaskTitle, setSubtaskTitle] = React.useState('')
  const [subtaskDrafts, setSubtaskDrafts] = React.useState<Record<number, string>>({})
  const [metadataDraft, setMetadataDraft] = React.useState({
    baseRef: '',
    branchName: '',
    worktreePath: '',
    planDocPath: '',
  })
  const [isMetadataOpen, setIsMetadataOpen] = React.useState(true)

  const latestValidation = validations[0] ?? null

  React.useEffect(() => {
    setValidationCommand('')
    setSubtaskTitle('')
    if (feature) {
      setMetadataDraft({
        baseRef: feature.baseRef ?? '',
        branchName: feature.branchName ?? '',
        worktreePath: feature.worktreePath ?? '',
        planDocPath: feature.planDocPath ?? '',
      })
    }
  }, [feature?.id])

  React.useEffect(() => {
    if (!feature) return
    const next: Record<number, string> = {}
    subtasks.forEach((subtask) => {
      next[subtask.id] = subtask.title
    })
    setSubtaskDrafts(next)
  }, [feature?.id, subtasks])

  const handleReorder = (direction: 'up' | 'down', subtaskId: number) => {
    const index = subtasks.findIndex((item) => item.id === subtaskId)
    if (index === -1) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= subtasks.length) return
    const ordered = [...subtasks]
    const [moved] = ordered.splice(index, 1)
    ordered.splice(nextIndex, 0, moved)
    onReorderSubtasks(feature!.id, ordered.map((item) => item.id))
  }

  return (
    <AnimatePresence>
      {feature && (
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
              layoutId={`task-${feature.id}`}
              className="w-full max-w-[760px] max-h-[90vh] bg-[color:var(--panel-solid)] rounded-[36px] shadow-2xl flex flex-col overflow-hidden border border-[color:var(--border)]"
            >
              <div className="flex items-center justify-between p-8 border-b border-[color:var(--border-soft)]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[color:var(--accent)] uppercase tracking-widest">
                    <Hash className="w-3 h-3" />
                    <span>Feature-{feature.id}</span>
                  </div>
                  <h2 className="text-xl font-bold text-[color:var(--text-strong)] leading-tight pr-8">{feature.title}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {mergeStatus?.needsMerge && (
                      <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-rose-100 text-rose-600">
                        Needs Merge
                      </span>
                    )}
                    {latestValidation && (
                      <span className={cn(
                        'px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest',
                        latestValidation.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                      )}>
                        {latestValidation.ok ? 'Validated' : 'Validation Failed'}
                      </span>
                    )}
                  </div>
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
                      <div className="flex items-center gap-2">
                        <select
                          value={feature.status}
                          onChange={(event) => onUpdateStatus(feature.id, event.target.value as TaskStatus)}
                          className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="p-4 rounded-3xl bg-[color:var(--accent-ghost)] border border-[color:var(--border-soft)] flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Created
                      </span>
                      <span className="text-sm font-bold text-[color:var(--text-dim)]">{new Date(feature.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-[color:var(--panel-strong)] border border-[color:var(--border)] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest">Thread</div>
                      {threadInfo && onOpenThread && (
                        <button
                          onClick={() => onOpenThread(threadInfo.sessionId)}
                          className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                        >
                          Open
                        </button>
                      )}
                    </div>
                    {threadInfo ? (
                      <div className="space-y-1 text-[11px] text-[color:var(--text-muted)]">
                        <div className="text-sm font-semibold text-[color:var(--text-strong)]">
                          {threadInfo.agentKey.toUpperCase()} session #{threadInfo.sessionId}
                        </div>
                        <div>Worktree: {feature.worktreePath || repo?.path || '—'}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[color:var(--text-subtle)]">No thread started yet.</div>
                    )}
                    {!threadInfo && onStartThread && (
                      <button
                        onClick={() => onStartThread(feature.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start Thread
                      </button>
                    )}
                  </div>

                  <div className="p-5 rounded-3xl bg-[color:var(--accent-ghost)] border border-[color:var(--border)] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest">Subtasks</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={subtaskTitle}
                        onChange={(event) => setSubtaskTitle(event.target.value)}
                        placeholder="Add a subtask"
                        className="flex-1 px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                      />
                      <button
                        onClick={() => {
                          if (!subtaskTitle.trim()) return
                          onAddSubtask(feature.id, subtaskTitle.trim())
                          setSubtaskTitle('')
                        }}
                        className="px-4 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent"
                      >
                        Add
                      </button>
                    </div>
                    {subtasks.length > 0 ? (
                      <div className="space-y-2">
                        {subtasks.map((subtask, index) => (
                          <div key={subtask.id} className="flex items-center gap-2">
                            <select
                              value={subtask.status}
                              onChange={(event) => onUpdateSubtask(subtask.id, { status: event.target.value as 'todo' | 'doing' | 'done' })}
                              className="px-2 py-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-[11px] text-[color:var(--text-dim)]"
                            >
                              <option value="todo">Todo</option>
                              <option value="doing">Doing</option>
                              <option value="done">Done</option>
                            </select>
                            <input
                              value={subtaskDrafts[subtask.id] ?? subtask.title}
                              onChange={(event) =>
                                setSubtaskDrafts((prev) => ({ ...prev, [subtask.id]: event.target.value }))
                              }
                              onBlur={() => {
                                const nextTitle = (subtaskDrafts[subtask.id] ?? subtask.title).trim()
                                if (nextTitle && nextTitle !== subtask.title) {
                                  onUpdateSubtask(subtask.id, { title: nextTitle })
                                }
                              }}
                              className="flex-1 px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                            />
                            <button
                              onClick={() => handleReorder('up', subtask.id)}
                              disabled={index === 0}
                              className="p-1 rounded-lg text-[color:var(--text-subtle)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent-ghost)] disabled:opacity-30"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReorder('down', subtask.id)}
                              disabled={index === subtasks.length - 1}
                              className="p-1 rounded-lg text-[color:var(--text-subtle)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent-ghost)] disabled:opacity-30"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteSubtask(feature.id, subtask.id)}
                              className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[color:var(--text-subtle)]">No subtasks yet.</div>
                    )}
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
                            onRunValidation({ taskId: feature.id, command: trimmed, agentId: null })
                          }}
                          disabled={!validationCommand.trim()}
                          className="px-4 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent disabled:opacity-40"
                        >
                          Run
                        </button>
                      </div>
                      <div className="text-[11px] text-[color:var(--text-subtle)]">
                        Runs in {feature.worktreePath || repo?.path || 'repo workspace'}.
                      </div>
                    </div>
                    {validations.length > 0 ? (
                      <div className="flex flex-col gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {validations.map((validation) => (
                          <div
                            key={validation.id}
                            className={cn(
                              'p-3 rounded-2xl border text-[11px] whitespace-pre-wrap break-words',
                              validation.ok ? 'border-emerald-200 bg-emerald-50/40 text-emerald-700' : 'border-rose-200 bg-rose-50/40 text-rose-700'
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

                  <div className="p-5 rounded-3xl bg-[color:var(--accent-ghost)] border border-[color:var(--border)] flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setIsMetadataOpen((prev) => !prev)}
                      className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[color:var(--text-subtle)]"
                    >
                      <span>Git & Plan Metadata</span>
                      {isMetadataOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isMetadataOpen && (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[color:var(--text-muted)] flex items-center gap-1">
                              <GitBranch className="w-3 h-3" /> Base Ref
                            </label>
                            <input
                              value={metadataDraft.baseRef}
                              onChange={(event) => setMetadataDraft((prev) => ({ ...prev, baseRef: event.target.value }))}
                              className="w-full px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[color:var(--text-muted)] flex items-center gap-1">
                              <GitBranch className="w-3 h-3" /> Branch
                            </label>
                            <input
                              value={metadataDraft.branchName}
                              onChange={(event) => setMetadataDraft((prev) => ({ ...prev, branchName: event.target.value }))}
                              className="w-full px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[color:var(--text-muted)] flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" /> Worktree
                            </label>
                            <input
                              value={metadataDraft.worktreePath}
                              onChange={(event) => setMetadataDraft((prev) => ({ ...prev, worktreePath: event.target.value }))}
                              className="w-full px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[color:var(--text-muted)] flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> Plan Doc Path
                            </label>
                            <input
                              value={metadataDraft.planDocPath}
                              onChange={(event) => setMetadataDraft((prev) => ({ ...prev, planDocPath: event.target.value }))}
                              className="w-full px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[color:var(--text-muted)]">
                          {mergeStatus?.branchName ? (
                            <span>Merge status: {mergeStatus.needsMerge ? `${mergeStatus.ahead} ahead` : 'Up to date'}</span>
                          ) : (
                            <span>No branch metadata set yet.</span>
                          )}
                          <button
                            onClick={() =>
                              onUpdateMetadata({
                                taskId: feature.id,
                                baseRef: metadataDraft.baseRef || null,
                                branchName: metadataDraft.branchName || null,
                                worktreePath: metadataDraft.worktreePath || null,
                                planDocPath: metadataDraft.planDocPath || null,
                              })
                            }
                            className="px-3 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-[11px] font-bold uppercase tracking-widest"
                          >
                            Save Metadata
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest px-1">Implementation Notes</label>
                    <textarea
                      value={note}
                      onChange={(e) => onNoteChange(e.target.value)}
                      placeholder="Add context, decisions, or test notes for this feature..."
                      className="w-full min-h-[260px] bg-[color:var(--accent-ghost)] border border-[color:var(--border)] rounded-[32px] p-6 text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-4 focus:ring-[color:var(--ring-strong)] focus:border-[color:var(--accent-border)] transition-all resize-none shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 bg-[color:var(--accent-ghost)] border-t border-[color:var(--border-soft)] flex items-center gap-3">
                {showDeleteAction && (
                  <button
                    onClick={() => onDeleteFeature?.(feature.id)}
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
                    'flex-1 flex items-center justify-center gap-2 py-4 rounded-3xl font-bold text-sm transition-all shadow-lg shadow-accent',
                    noteStatus === 'saved' ? 'bg-emerald-500 text-white' : 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)] hover:bg-[color:var(--accent-strong)]'
                  )}
                >
                  <Save className="w-4 h-4" />
                  {noteStatus === 'saving' ? 'Saving...' : noteStatus === 'saved' ? 'Note Saved!' : 'Save Notes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
