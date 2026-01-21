import React from 'react'
import {
  Plus,
  CheckCircle2,
  PlayCircle,
  ClipboardList,
  GitBranch,
  ShieldCheck,
  AlertCircle,
  Trash2,
  Activity,
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { AgentEvent, Subtask, Task, TaskStatus, TaskValidation } from '../types'

type FeatureStatus = Exclude<TaskStatus, 'archived'>

type SubtaskSummary = { todo: number; doing: number; done: number; total: number }

type MergeStatus = { baseRef: string; branchName: string; ahead: number; behind: number; needsMerge: boolean; error?: string }

interface FeatureBoardProps {
  features: Task[]
  activeFeatureId: number | null
  onSelectFeature: (id: number) => void
  onMoveFeature: (featureId: number, status: TaskStatus) => void
  onAddFeature: (title: string) => void
  onDeleteFeature: (featureId: number) => void
  onLoadSubtasks: (featureId: number) => void
  isRepoSelected: boolean
  subtasksByFeature: Record<number, Subtask[]>
  subtaskSummary: Record<number, SubtaskSummary>
  latestValidations: Record<number, TaskValidation | undefined>
  mergeStatusByFeature: Record<number, MergeStatus>
  latestEventsByFeature: Record<number, AgentEvent | undefined>
  featureThreads: Record<number, { sessionId: number; agentKey: 'claude' | 'gemini' | 'codex'; createdAt: string } | undefined>
  runningByFeature: Record<number, boolean>
  onStartThread: (featureId: number) => void
  onOpenThread: (sessionId: number) => void
}

const statusSections: Array<{
  status: FeatureStatus
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  chip: string
}> = [
  {
    status: 'planned',
    title: 'Planned',
    description: 'Ready to be picked up',
    icon: ClipboardList,
    accent: 'text-[color:var(--accent)]',
    chip: 'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]',
  },
  {
    status: 'executed',
    title: 'Executed',
    description: 'In active execution',
    icon: PlayCircle,
    accent: 'text-blue-600',
    chip: 'bg-blue-100 text-blue-700',
  },
  {
    status: 'done',
    title: 'Done',
    description: 'Validated and shipped',
    icon: CheckCircle2,
    accent: 'text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-700',
  },
]

export const FeatureBoard: React.FC<FeatureBoardProps> = ({
  features,
  activeFeatureId,
  onSelectFeature,
  onMoveFeature,
  onAddFeature,
  onDeleteFeature,
  onLoadSubtasks,
  isRepoSelected,
  subtasksByFeature,
  subtaskSummary,
  latestValidations,
  mergeStatusByFeature,
  latestEventsByFeature,
  featureThreads,
  runningByFeature,
  onStartThread,
  onOpenThread,
}) => {
  const [newFeatureInput, setNewFeatureInput] = React.useState('')
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set())

  const handleAddFeature = (event: React.FormEvent) => {
    event.preventDefault()
    if (!newFeatureInput.trim()) return
    onAddFeature(newFeatureInput.trim())
    setNewFeatureInput('')
  }

  const toggleExpanded = (featureId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(featureId)) {
        next.delete(featureId)
      } else {
        next.add(featureId)
        onLoadSubtasks(featureId)
      }
      return next
    })
  }

  return (
    <section className="flex flex-col gap-6 h-full min-h-0 bg-[color:var(--panel-soft)] backdrop-blur-xl border border-[color:var(--border)] rounded-3xl shadow-xl p-6 overflow-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[color:var(--text-strong)] tracking-tight">Feature Flow</h2>
          <p className="text-sm text-[color:var(--text-muted)] font-medium">Planned features, live threads, and merge-ready signals.</p>
        </div>
        <form onSubmit={handleAddFeature} className="flex items-center gap-2">
          <div className="relative w-full md:w-auto">
            <input
              type="text"
              value={newFeatureInput}
              onChange={(event) => setNewFeatureInput(event.target.value)}
              placeholder="Quick add feature..."
              className="pl-4 pr-10 py-2.5 bg-[color:var(--panel-solid)] border border-[color:var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent-border)] transition-all w-full md:w-72 shadow-sm"
              disabled={!isRepoSelected}
            />
            <button
              type="submit"
              disabled={!isRepoSelected || !newFeatureInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[color:var(--accent)] hover:bg-[color:var(--accent-ghost)] rounded-lg transition-colors disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-6 pr-2">
        {statusSections.map((section) => {
          const sectionFeatures = features.filter((feature) => feature.status === section.status)
          return (
            <div key={section.status} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <section.icon className={cn('w-5 h-5', section.accent)} />
                  <div>
                    <div className="text-sm font-bold text-[color:var(--text-strong)]">{section.title}</div>
                    <div className="text-[11px] text-[color:var(--text-subtle)] font-medium">{section.description}</div>
                  </div>
                </div>
                <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest', section.chip)}>
                  {sectionFeatures.length}
                </span>
              </div>

              {sectionFeatures.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-6 text-center text-[11px] text-[color:var(--text-faint)]">
                  Nothing here yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {sectionFeatures.map((feature) => {
                    const isActive = feature.id === activeFeatureId
                    const summary = subtaskSummary[feature.id] ?? { todo: 0, doing: 0, done: 0, total: 0 }
                    const isExpanded = expandedIds.has(feature.id)
                    const latestValidation = latestValidations[feature.id]
                    const mergeStatus = mergeStatusByFeature[feature.id]
                    const threadInfo = featureThreads[feature.id]
                    const isRunning = runningByFeature[feature.id]
                    const latestEvent = latestEventsByFeature[feature.id]

                    return (
                      <div
                        key={feature.id}
                        className={cn(
                          'rounded-2xl border bg-[color:var(--panel-solid)] shadow-sm transition-all',
                          isActive ? 'border-[color:var(--accent-border)] ring-2 ring-[color:var(--ring)]' : 'border-[color:var(--border)]'
                        )}
                      >
                        <div
                          className="p-4 flex flex-col gap-3 cursor-pointer"
                          onClick={() => onSelectFeature(feature.id)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-[13px] font-semibold text-[color:var(--text-strong)]">{feature.title}</div>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[color:var(--text-subtle)]">
                                <span>#{feature.id}</span>
                                {feature.branchName && (
                                  <span className="flex items-center gap-1">
                                    <GitBranch className="w-3 h-3" />
                                    {feature.branchName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isRunning && (
                                <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-sky-100 text-sky-700 flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  Running
                                </span>
                              )}
                              {mergeStatus?.needsMerge && (
                                <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-rose-100 text-rose-600">
                                  Needs Merge
                                </span>
                              )}
                              {latestValidation && (
                                <span
                                  className={cn(
                                    'px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest',
                                    latestValidation.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                                  )}
                                >
                                  {latestValidation.ok ? 'Validated' : 'Validation Failed'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[color:var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              {summary.done}/{summary.total} done
                            </span>
                            <span className="px-2 py-1 rounded-full bg-[color:var(--chip-bg)] text-[color:var(--chip-text)] font-semibold">
                              {summary.todo} todo · {summary.doing} doing
                            </span>
                            {threadInfo ? (
                              <span className="text-[color:var(--accent-strong)]">
                                Thread · {threadInfo.agentKey.toUpperCase()} · #{threadInfo.sessionId}
                              </span>
                            ) : (
                              <span className="text-[color:var(--text-faint)]">No thread yet</span>
                            )}
                          </div>
                          {latestEvent && (
                            <div className="text-[10px] text-[color:var(--text-subtle)] truncate">
                              Latest: {latestEvent.message}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            {!threadInfo && feature.status !== 'done' && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onStartThread(feature.id)
                                }}
                                disabled={!isRepoSelected}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] hover:bg-[color:var(--accent-ghost)] transition-colors disabled:opacity-40"
                              >
                                Start Thread
                              </button>
                            )}
                            {threadInfo && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onOpenThread(threadInfo.sessionId)
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-[color:var(--accent-strong)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent-ghost)] transition-colors"
                              >
                                Open Thread
                              </button>
                            )}
                            {feature.status === 'executed' && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onMoveFeature(feature.id, 'done')
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              >
                                Mark Done
                              </button>
                            )}
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleExpanded(feature.id)
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)] hover:bg-[color:var(--accent-ghost)] transition-colors"
                            >
                              {isExpanded ? 'Hide subtasks' : 'Show subtasks'}
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                onDeleteFeature(feature.id)
                              }}
                              className="ml-auto p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete feature"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-[color:var(--border)] bg-[color:var(--accent-ghost)] px-4 py-3">
                            {subtasksByFeature[feature.id]?.length ? (
                              <div className="space-y-2">
                                {subtasksByFeature[feature.id].map((subtask) => (
                                  <div
                                    key={subtask.id}
                                    className="flex items-center justify-between gap-3 text-[11px] text-[color:var(--text-dim)]"
                                  >
                                    <div className="flex items-center gap-2">
                                      {subtask.status === 'done' ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                      ) : subtask.status === 'doing' ? (
                                        <PlayCircle className="w-3.5 h-3.5 text-blue-500" />
                                      ) : (
                                        <AlertCircle className="w-3.5 h-3.5 text-[color:var(--accent)]" />
                                      )}
                                      <span>{subtask.title}</span>
                                    </div>
                                    <span className="uppercase tracking-widest text-[9px] font-bold text-[color:var(--text-subtle)]">
                                      {subtask.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-[color:var(--text-subtle)]">No subtasks yet.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
