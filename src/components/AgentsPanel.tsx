import React from 'react'
import { Users, PlusCircle, FolderOpen } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Agent, Task } from '../types'

interface AgentsPanelProps {
  agents: Agent[]
  activeAgentId: number | null
  tasks: Task[]
  isRepoSelected: boolean
  onSelectAgent: (agentId: number) => void
  onCreateAgent: (payload: { name: string; provider: Agent['provider']; role?: Agent['role']; workspacePath?: string | null }) => void
  onUpdateAgent: (payload: {
    agentId: number
    name?: string
    provider?: Agent['provider']
    role?: Agent['role']
    workspacePath?: string | null
    status?: Agent['status']
  }) => void
  onDeleteAgent: (agentId: number) => void
}

const providerOptions: { value: Agent['provider']; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'codex', label: 'Codex' },
]

const roleOptions: { value: Agent['role']; label: string }[] = [
  { value: 'worker', label: 'Worker' },
  { value: 'validator', label: 'Validator' },
]

export const AgentsPanel: React.FC<AgentsPanelProps> = ({
  agents,
  activeAgentId,
  tasks,
  isRepoSelected,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
}) => {
  const [newAgentName, setNewAgentName] = React.useState('')
  const [newAgentProvider, setNewAgentProvider] = React.useState<Agent['provider']>('codex')
  const [newAgentRole, setNewAgentRole] = React.useState<Agent['role']>('worker')
  const [newAgentWorkspace, setNewAgentWorkspace] = React.useState('')
  const activeAgent = React.useMemo(
    () => (activeAgentId ? agents.find((agent) => agent.id === activeAgentId) ?? null : null),
    [activeAgentId, agents]
  )
  const [workspaceDraft, setWorkspaceDraft] = React.useState(activeAgent?.workspacePath ?? '')

  React.useEffect(() => {
    setWorkspaceDraft(activeAgent?.workspacePath ?? '')
  }, [activeAgent?.id, activeAgent?.workspacePath])

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault()
    if (!newAgentName.trim()) return
    onCreateAgent({
      name: newAgentName.trim(),
      provider: newAgentProvider,
      role: newAgentRole,
      workspacePath: newAgentWorkspace.trim() || null,
    })
    setNewAgentName('')
    setNewAgentWorkspace('')
  }

  return (
    <section className="flex flex-col gap-4 h-full min-h-0 bg-[color:var(--panel-soft)] backdrop-blur-xl border border-[color:var(--border)] rounded-3xl shadow-xl overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)] bg-[color:var(--panel-soft)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] flex items-center justify-center shadow-lg shadow-accent">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-strong)]">Agent Dispatch</p>
            <p className="text-[11px] text-[color:var(--text-muted)]">Claim tasks and track active work</p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 custom-scrollbar space-y-5">
        <form onSubmit={handleCreate} className="p-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-sm space-y-3">
          <div className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest">Create Agent</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={newAgentName}
              onChange={(event) => setNewAgentName(event.target.value)}
              placeholder="Agent name"
              disabled={!isRepoSelected}
              className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
            <select
              value={newAgentProvider}
              onChange={(event) => setNewAgentProvider(event.target.value as Agent['provider'])}
              disabled={!isRepoSelected}
              className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={newAgentRole}
              onChange={(event) => setNewAgentRole(event.target.value as Agent['role'])}
              disabled={!isRepoSelected}
              className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={newAgentWorkspace}
              onChange={(event) => setNewAgentWorkspace(event.target.value)}
              placeholder="Workspace path (optional)"
              disabled={!isRepoSelected}
              className="md:col-span-2 px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          </div>
          <button
            type="submit"
            disabled={!isRepoSelected || !newAgentName.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent disabled:opacity-40"
          >
            <PlusCircle className="w-4 h-4" />
            Add Agent
          </button>
        </form>

        {activeAgent && (
          <div className="p-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--accent-ghost)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-widest">Active Agent</div>
              <button
                onClick={() => onDeleteAgent(activeAgent.id)}
                className="text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600"
              >
                Delete
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[color:var(--text-strong)]">{activeAgent.name}</div>
                <div className="text-[11px] text-[color:var(--text-muted)]">
                  {activeAgent.provider.toUpperCase()} · {activeAgent.role}
                </div>
              </div>
              <span className={cn(
                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                activeAgent.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
              )}>
                {activeAgent.status}
              </span>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[color:var(--text-muted)]">Role</label>
              <select
                value={activeAgent.role}
                onChange={(event) => onUpdateAgent({ agentId: activeAgent.id, role: event.target.value as Agent['role'] })}
                className="w-full px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[color:var(--text-muted)]">Workspace</label>
              <div className="flex items-center gap-2">
                <input
                  value={workspaceDraft}
                  onChange={(event) => setWorkspaceDraft(event.target.value)}
                  placeholder="Path to workspace"
                  className="flex-1 px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                />
                <button
                  onClick={() => onUpdateAgent({ agentId: activeAgent.id, workspacePath: workspaceDraft.trim() || null })}
                  className="px-3 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Agents</p>
            <p className="text-[11px] text-[color:var(--text-subtle)]">{agents.length} total</p>
          </div>
          {agents.length === 0 ? (
            <div className="px-4 py-4 rounded-2xl border border-dashed border-[color:var(--accent-soft)] text-sm text-[color:var(--text-subtle)] text-center">
              Create an agent to start claiming tasks.
            </div>
          ) : (
            <div className="grid gap-3">
              {agents.map((agent) => {
                const agentTasks = tasks.filter((task) => task.assignedAgentId === agent.id)
                const isActive = agent.id === activeAgentId
                return (
                  <button
                    key={agent.id}
                    onClick={() => onSelectAgent(agent.id)}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all",
                      isActive ? "border-[color:var(--accent-border)] bg-[color:var(--accent-ghost)] shadow-sm" : "border-[color:var(--border)] bg-[color:var(--panel-strong)] hover:bg-[color:var(--accent-ghost)]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[color:var(--text-strong)]">{agent.name}</div>
                        <div className="text-[11px] text-[color:var(--text-muted)]">
                          {agent.provider.toUpperCase()} · {agent.role}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[color:var(--chip-bg)] text-[color:var(--chip-text)]">
                        {agentTasks.length} tasks
                      </span>
                    </div>
                    {agent.workspacePath && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span className="truncate">{agent.workspacePath}</span>
                      </div>
                    )}
                    {agentTasks.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {agentTasks.slice(0, 3).map((task) => (
                          <div key={task.id} className="text-[11px] text-[color:var(--text-muted)] truncate">
                            #{task.id} · {task.title}
                          </div>
                        ))}
                        {agentTasks.length > 3 && (
                          <div className="text-[10px] text-[color:var(--text-subtle)]">+{agentTasks.length - 3} more</div>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
