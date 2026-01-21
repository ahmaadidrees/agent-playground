import React from 'react'
import { Rocket, Play, Square, Sliders, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'
import type { OrchestratorRun, OrchestratorRunEvent, OrchestratorTaskRun, OrchestratorValidationArtifact } from '../types'

type OrchestratorConfigDraft = {
  concurrency: number
  maxAttempts: number
  conflictPolicy: 'continue' | 'halt'
  baseBranch: string
  model: string
  reasoningEffort: string
  sandbox: string
  approval: string
  workerValidationCommand: string
  integrationValidationCommand: string
}

interface OrchestratorPanelProps {
  runs: OrchestratorRun[]
  activeRun: OrchestratorRun | null
  tasks: OrchestratorTaskRun[]
  events: OrchestratorRunEvent[]
  validationArtifacts: OrchestratorValidationArtifact[]
  config: OrchestratorConfigDraft
  isRepoSelected: boolean
  className?: string
  onSelectRun: (runId: string) => void
  onStartRun: () => void
  onCancelRun: (runId: string) => void
  onConfigChange: (next: OrchestratorConfigDraft) => void
}

const statusStyles: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]',
  succeeded: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
  canceled: 'bg-slate-200 text-slate-600',
  blocked: 'bg-[color:var(--accent-ghost)] text-[color:var(--accent-strong)]',
}

const reasoningOptions = [
  { value: '', label: 'Default effort' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const sandboxOptions = [
  { value: '', label: 'Default sandbox' },
  { value: 'read-only', label: 'Read-only' },
  { value: 'workspace-write', label: 'Workspace write' },
  { value: 'danger-full-access', label: 'Danger full access' },
]

const approvalOptions = [
  { value: '', label: 'Default approvals' },
  { value: 'untrusted', label: 'Untrusted' },
  { value: 'on-failure', label: 'On failure' },
  { value: 'on-request', label: 'On request' },
  { value: 'never', label: 'Never' },
]

const conflictOptions = [
  { value: 'continue', label: 'Continue run' },
  { value: 'halt', label: 'Halt on conflict' },
]

const formatRunId = (id: string) => id.slice(0, 8)

const formatTimestamp = (value: string | null) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export const OrchestratorPanel: React.FC<OrchestratorPanelProps> = ({
  runs,
  activeRun,
  tasks,
  events,
  validationArtifacts,
  config,
  isRepoSelected,
  className,
  onSelectRun,
  onStartRun,
  onCancelRun,
  onConfigChange,
}) => {
  const [showConfig, setShowConfig] = React.useState(false)
  const taskSummary = React.useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc.total += 1
        acc[task.status] = (acc[task.status] ?? 0) + 1
        return acc
      },
      { total: 0 } as Record<string, number>
    )
  }, [tasks])

  const formatEventSummary = React.useCallback((event: OrchestratorRunEvent) => {
    try {
      const parsed = JSON.parse(event.payload) as Record<string, unknown>
      if (typeof parsed.text === 'string' && parsed.text.trim()) {
        return parsed.text.trim()
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim()
      }
      if (typeof parsed.status === 'string') {
        return `status: ${parsed.status}`
      }
      if (typeof parsed.taskId === 'number') {
        return `task ${parsed.taskId}`
      }
      return event.payload
    } catch {
      return event.payload
    }
  }, [])

  const handleConfigChange = (partial: Partial<OrchestratorConfigDraft>) => {
    onConfigChange({ ...config, ...partial })
  }

  return (
    <section className={cn("flex flex-col gap-4 h-full min-h-0 overflow-hidden bg-[color:var(--panel-soft)] backdrop-blur-xl border border-[color:var(--border)] rounded-3xl shadow-xl", className)}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)] bg-[color:var(--panel-soft)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] flex items-center justify-center shadow-lg shadow-accent">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-strong)]">Orchestrator</p>
            <p className="text-[11px] text-[color:var(--text-muted)]">Coordinate multi-agent runs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeRun?.status === 'running' && (
            <button
              onClick={() => onCancelRun(activeRun.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-rose-600 transition-all shadow-md shadow-rose-500/20"
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
          <button
            onClick={onStartRun}
            disabled={!isRepoSelected}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-[11px] font-bold uppercase tracking-wider hover:bg-[color:var(--accent-strong)] transition-all shadow-md shadow-accent disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5" />
            Start Run
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-5 custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Run Config</p>
            <p className="text-[11px] text-[color:var(--text-muted)]">Defaults apply when fields are blank</p>
          </div>
          <button
            onClick={() => setShowConfig((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)]"
          >
            <Sliders className="w-4 h-4" />
            {showConfig ? 'Hide' : 'Edit'}
            {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showConfig && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Concurrency
              <input
                type="number"
                min={1}
                value={config.concurrency}
                onChange={(event) => handleConfigChange({ concurrency: Number(event.target.value) || 1 })}
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Max Attempts
              <input
                type="number"
                min={1}
                value={config.maxAttempts}
                onChange={(event) => handleConfigChange({ maxAttempts: Number(event.target.value) || 1 })}
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Conflict Policy
              <select
                value={config.conflictPolicy}
                onChange={(event) => handleConfigChange({ conflictPolicy: event.target.value as OrchestratorConfigDraft['conflictPolicy'] })}
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              >
                {conflictOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Base Ref
              <input
                type="text"
                value={config.baseBranch}
                onChange={(event) => handleConfigChange({ baseBranch: event.target.value })}
                placeholder="origin/main"
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Model
              <input
                type="text"
                value={config.model}
                onChange={(event) => handleConfigChange({ model: event.target.value })}
                placeholder="gpt-4.1"
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Reasoning Effort
              <select
                value={config.reasoningEffort}
                onChange={(event) => handleConfigChange({ reasoningEffort: event.target.value })}
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              >
                {reasoningOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Sandbox
              <select
                value={config.sandbox}
                onChange={(event) => handleConfigChange({ sandbox: event.target.value })}
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              >
                {sandboxOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Approval Policy
              <select
                value={config.approval}
                onChange={(event) => handleConfigChange({ approval: event.target.value })}
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              >
                {approvalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)] md:col-span-2">
              Worker Validation Command
              <input
                type="text"
                value={config.workerValidationCommand}
                onChange={(event) => handleConfigChange({ workerValidationCommand: event.target.value })}
                placeholder="npm test"
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--text-muted)] md:col-span-2">
              Integration Validation Command
              <input
                type="text"
                value={config.integrationValidationCommand}
                onChange={(event) => handleConfigChange({ integrationValidationCommand: event.target.value })}
                placeholder="npm run lint"
                className="px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </label>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Runs</p>
            <p className="text-[11px] text-[color:var(--text-subtle)]">{runs.length} total</p>
          </div>
          {runs.length === 0 ? (
            <div className="px-4 py-4 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
              No orchestrator runs yet.
            </div>
          ) : (
            <div className="grid gap-2">
              {runs.slice(0, 6).map((run) => {
                const isActive = run.id === activeRun?.id
                return (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-left transition-all",
                      isActive
                        ? "border-[color:var(--accent-border)] bg-[color:var(--accent-ghost)] shadow-sm"
                        : "border-[color:var(--border)] bg-[color:var(--panel-muted)] hover:bg-[color:var(--accent-ghost)]"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", statusStyles[run.status] ?? statusStyles.queued)}>
                          {run.status}
                        </span>
                        <span className="text-xs font-semibold text-[color:var(--text-strong)]">Run {formatRunId(run.id)}</span>
                      </div>
                      <p className="text-[11px] text-[color:var(--text-muted)] mt-1">Started {formatTimestamp(run.startedAt ?? run.createdAt)}</p>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-subtle)] text-right">
                      <div>Ended {formatTimestamp(run.endedAt)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Active Run Tasks</p>
              <p className="text-[11px] text-[color:var(--text-subtle)]">
                {activeRun ? `${taskSummary.total} tasks` : 'Select a run to inspect'}
              </p>
            </div>
            {activeRun && (
              <div className="flex items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                <span>Running: {taskSummary.running ?? 0}</span>
                <span>Failed: {(taskSummary.failed ?? 0) + (taskSummary.blocked ?? 0)}</span>
                <span>Done: {taskSummary.succeeded ?? 0}</span>
              </div>
            )}
          </div>
          {activeRun ? (
            <div className="max-h-56 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {tasks.length === 0 ? (
                <div className="px-4 py-3 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
                  No tasks recorded for this run yet.
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col gap-1 px-4 py-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[color:var(--text-strong)]">Task #{task.taskId}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", statusStyles[task.status] ?? statusStyles.queued)}>
                        {task.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-muted)] flex items-center justify-between">
                      <span>Validation: {task.validationStatus}</span>
                      <span>{task.branchName ?? '—'}</span>
                    </div>
                    {task.error && (
                      <div className="text-[11px] text-rose-600/80 break-words">{task.error}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="px-4 py-3 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
              Select a run to view task status.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Run Events</p>
            <p className="text-[11px] text-[color:var(--text-subtle)]">{events.length} events</p>
          </div>
          {activeRun ? (
            <div className="max-h-52 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {events.length === 0 ? (
                <div className="px-4 py-3 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
                  No events captured yet.
                </div>
              ) : (
                events.slice(-20).reverse().map((event) => (
                  <div key={event.id} className="px-4 py-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)]">
                    <div className="flex items-center justify-between text-[11px] text-[color:var(--text-muted)]">
                      <span className="font-semibold text-[color:var(--text-dim)]">{event.kind}</span>
                      <span>{formatTimestamp(event.createdAt)}</span>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-muted)] mt-1 break-words">
                      {formatEventSummary(event)}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="px-4 py-3 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
              Select a run to view events.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Validation Artifacts</p>
            <p className="text-[11px] text-[color:var(--text-subtle)]">{validationArtifacts.length} entries</p>
          </div>
          {activeRun ? (
            <div className="max-h-52 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {validationArtifacts.length === 0 ? (
                <div className="px-4 py-3 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
                  No validation output recorded yet.
                </div>
              ) : (
                validationArtifacts.slice(0, 10).map((artifact) => (
                  <div key={artifact.id} className="px-4 py-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)]">
                    <div className="flex items-center justify-between text-[11px] text-[color:var(--text-muted)]">
                      <span className="font-semibold text-[color:var(--text-dim)]">
                        {artifact.scope} {artifact.ok ? 'passed' : 'failed'}
                      </span>
                      <span>{formatTimestamp(artifact.createdAt)}</span>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-muted)] mt-1 break-words">
                      {artifact.command}
                    </div>
                    {artifact.output && (
                      <div className={cn("text-[11px] mt-2 whitespace-pre-wrap break-words", artifact.ok ? "text-emerald-600/80" : "text-rose-600/80")}>
                        {artifact.output}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="px-4 py-3 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
              Select a run to view validation output.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
