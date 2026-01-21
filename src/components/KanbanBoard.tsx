import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  CheckCircle2,
  PlayCircle,
  ClipboardList,
  Trash2,
  Ban,
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { Agent, Task, TaskStatus } from '../types'

type StatusIcon = React.ComponentType<{ className?: string }>

interface KanbanBoardProps {
  tasks: Task[]
  activeTaskId: number | null
  onSelectTask: (id: number) => void
  onMoveTask: (taskId: number, status: TaskStatus) => void
  onAddTask: (title: string) => void
  onDeleteTask: (taskId: number) => void
  isRepoSelected: boolean
  agents: Agent[]
  activeAgentId: number | null
  onClaimTask: (taskId: number) => void
}

const statusConfig: Record<TaskStatus, { title: string; icon: StatusIcon; color: string; bgColor: string }> = {
  planned: { title: 'Planned', icon: ClipboardList, color: 'text-[color:var(--accent)]', bgColor: 'bg-[color:var(--accent-ghost)]' },
  executed: { title: 'Executed', icon: PlayCircle, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
  done: { title: 'Done', icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
  archived: { title: 'Archived', icon: Ban, color: 'text-slate-500', bgColor: 'bg-slate-100' },
}

const statusOrder: TaskStatus[] = ['planned', 'executed', 'done', 'archived']
const progressionOrder: TaskStatus[] = ['planned', 'executed', 'done']

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  activeTaskId,
  onSelectTask,
  onMoveTask,
  onAddTask,
  onDeleteTask,
  isRepoSelected,
  agents,
  activeAgentId,
  onClaimTask,
}) => {
  const [newTaskInput, setNewTaskInput] = React.useState('')
  const agentById = React.useMemo(() => {
    return new Map(agents.map((agent) => [agent.id, agent]))
  }, [agents])
  const activeAgent = activeAgentId ? agentById.get(activeAgentId) ?? null : null

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTaskInput.trim()) {
      onAddTask(newTaskInput.trim())
      setNewTaskInput('')
    }
  }

  const handleStepTask = (task: Task, direction: 'prev' | 'next') => {
    const index = progressionOrder.indexOf(task.status)
    if (index === -1) return
    const targetIndex = direction === 'next' ? index + 1 : index - 1
    const nextStatus = progressionOrder[targetIndex]
    if (nextStatus) {
      onMoveTask(task.id, nextStatus)
    }
  }

  return (
    <section className="flex flex-col gap-6 h-full min-h-0 bg-[color:var(--panel-soft)] backdrop-blur-xl border border-[color:var(--border)] rounded-3xl shadow-xl p-6 overflow-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[color:var(--text-strong)] tracking-tight">Focus Board</h2>
          <p className="text-sm text-[color:var(--text-muted)] font-medium">Manage your active tasks and priorities</p>
          <p className="text-[11px] text-[color:var(--text-subtle)] font-semibold">
            Active agent: {activeAgent ? activeAgent.name : 'Select an agent to queue tasks'}
          </p>
        </div>
        <form onSubmit={handleAddTask} className="flex items-center gap-2">
          <div className="relative w-full md:w-auto">
            <input
              type="text"
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              placeholder="Quick add task..."
              className="pl-4 pr-10 py-2.5 bg-[color:var(--panel-solid)] border border-[color:var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--accent-border)] transition-all w-full md:w-64 shadow-sm"
              disabled={!isRepoSelected}
            />
            <button
              type="submit"
              disabled={!isRepoSelected || !newTaskInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[color:var(--accent)] hover:bg-[color:var(--accent-ghost)] rounded-lg transition-colors disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-4 h-full min-h-0 pr-2">
          {statusOrder.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status)
            const config = statusConfig[status]
            return (
              <div key={status} className="flex flex-col min-h-0 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--panel-strong)] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <config.icon className={cn("w-4 h-4", config.color)} />
                    <span className="font-bold text-xs uppercase tracking-wider text-[color:var(--text-dim)]">{config.title}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[color:var(--chip-bg)] text-[10px] font-bold text-[color:var(--text-subtle)]">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button className="p-1 hover:bg-[color:var(--accent-ghost)] rounded-md text-[color:var(--text-faint)] transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 custom-scrollbar flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {columnTasks.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-24 rounded-2xl border-2 border-dashed border-[color:var(--border)] flex items-center justify-center text-[11px] text-[color:var(--text-faint)] font-medium text-center px-4"
                      >
                        Drop tasks here
                      </motion.div>
                    ) : (
                      columnTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          layoutId={`task-${task.id}`}
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          onClick={() => onSelectTask(task.id)}
                          className={cn(
                            "group p-4 rounded-2xl border bg-[color:var(--panel-solid)] shadow-sm hover:shadow-md hover:border-[color:var(--accent-border)] transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden",
                            activeTaskId === task.id ? "border-[color:var(--accent-border)] ring-2 ring-[color:var(--ring)]" : "border-[color:var(--border-soft)]"
                        )}
                      >
                        {activeTaskId === task.id && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-[color:var(--accent)]" />
                        )}
                        <h3 className="font-semibold text-[13px] text-[color:var(--text-strong)] leading-tight group-hover:text-[color:var(--accent)] transition-colors">
                          {task.title}
                        </h3>

                        {task.assignedAgentId && (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full bg-[color:var(--chip-bg)] text-[10px] font-bold uppercase tracking-widest text-[color:var(--chip-text)]">
                              {agentById.get(task.assignedAgentId)?.name ?? `Agent ${task.assignedAgentId}`}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[color:var(--text-subtle)] font-medium">
                            #{task.id}
                          </span>
                          <div className="flex items-center gap-1">
                            {!task.assignedAgentId && task.status !== 'done' && task.status !== 'archived' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onClaimTask(task.id)
                                }}
                                disabled={!activeAgentId}
                                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] hover:bg-[color:var(--accent-ghost)] transition-colors disabled:opacity-40"
                                title={activeAgentId ? 'Queue task' : 'Select an agent to queue'}
                              >
                                Queue
                              </button>
                            )}
                            {progressionOrder.indexOf(task.status) > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStepTask(task, 'prev')
                                }}
                                className="p-1 hover:bg-[color:var(--accent-ghost)] rounded-md text-[color:var(--text-faint)] hover:text-[color:var(--accent)] transition-colors"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                            )}
                            {progressionOrder.indexOf(task.status) > -1 && progressionOrder.indexOf(task.status) < progressionOrder.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStepTask(task, 'next')
                                }}
                                className="p-1 hover:bg-[color:var(--accent-ghost)] rounded-md text-[color:var(--text-faint)] hover:text-[color:var(--accent)] transition-colors"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteTask(task.id)
                                }}
                                className="p-1 hover:bg-rose-50 rounded-md text-rose-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete task"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
