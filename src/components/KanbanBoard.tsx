import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  PlayCircle,
  Inbox,
  Trash2,
  AlertTriangle,
  XCircle,
  Ban,
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { Task, TaskStatus } from '../types'

type StatusIcon = React.ComponentType<{ className?: string }>

interface KanbanBoardProps {
  tasks: Task[]
  activeTaskId: number | null
  onSelectTask: (id: number) => void
  onMoveTask: (taskId: number, status: TaskStatus) => void
  onAddTask: (title: string) => void
  onDeleteTask: (taskId: number) => void
  isRepoSelected: boolean
}

const statusConfig: Record<TaskStatus, { title: string; icon: StatusIcon; color: string; bgColor: string }> = {
  proposed: { title: 'Proposed', icon: Inbox, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  backlog: { title: 'Backlog', icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  in_progress: { title: 'In Progress', icon: PlayCircle, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
  blocked: { title: 'Blocked', icon: AlertTriangle, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  failed: { title: 'Failed', icon: XCircle, color: 'text-rose-500', bgColor: 'bg-rose-50' },
  canceled: { title: 'Canceled', icon: Ban, color: 'text-slate-500', bgColor: 'bg-slate-100' },
  done: { title: 'Done', icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
}

const statusOrder: TaskStatus[] = ['proposed', 'backlog', 'in_progress', 'blocked', 'failed', 'canceled', 'done']

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  activeTaskId,
  onSelectTask,
  onMoveTask,
  onAddTask,
  onDeleteTask,
  isRepoSelected,
}) => {
  const [newTaskInput, setNewTaskInput] = React.useState('')

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTaskInput.trim()) {
      onAddTask(newTaskInput.trim())
      setNewTaskInput('')
    }
  }

  const handleStepTask = (task: Task, direction: 'prev' | 'next') => {
    const index = statusOrder.indexOf(task.status)
    const targetIndex = direction === 'next' ? index + 1 : index - 1
    const nextStatus = statusOrder[targetIndex]
    if (nextStatus) {
      onMoveTask(task.id, nextStatus)
    }
  }

  return (
    <section className="flex flex-col gap-6 h-full min-h-0 bg-white/40 backdrop-blur-xl border border-amber-900/10 rounded-3xl shadow-xl p-6 overflow-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-amber-950 tracking-tight">Focus Board</h2>
          <p className="text-sm text-amber-900/50 font-medium">Manage your active tasks and priorities</p>
        </div>
        <form onSubmit={handleAddTask} className="flex items-center gap-2">
          <div className="relative w-full md:w-auto">
            <input
              type="text"
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              placeholder="Quick add task..."
              className="pl-4 pr-10 py-2.5 bg-white border border-amber-900/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all w-full md:w-64 shadow-sm"
              disabled={!isRepoSelected}
            />
            <button
              type="submit"
              disabled={!isRepoSelected || !newTaskInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-30"
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
              <div key={status} className="flex flex-col min-h-0 rounded-2xl border border-amber-900/10 bg-white/70 shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/10 bg-white/70 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <config.icon className={cn("w-4 h-4", config.color)} />
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-950/60">{config.title}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-900/5 text-[10px] font-bold text-amber-900/40">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button className="p-1 hover:bg-amber-50 rounded-md text-amber-900/30 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 custom-scrollbar flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {columnTasks.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-24 rounded-2xl border-2 border-dashed border-amber-900/10 flex items-center justify-center text-[11px] text-amber-900/20 font-medium text-center px-4"
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
                            "group p-4 rounded-2xl border bg-white shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden",
                            activeTaskId === task.id ? "border-amber-500 ring-2 ring-amber-500/10" : "border-amber-900/5"
                          )}
                        >
                          {activeTaskId === task.id && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                          )}
                          <h3 className="font-semibold text-[13px] text-amber-950 leading-tight group-hover:text-amber-600 transition-colors">
                            {task.title}
                          </h3>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-amber-900/40 font-medium">
                              #{task.id}
                            </span>
                            <div className="flex items-center gap-1">
                              {statusOrder.indexOf(task.status) > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStepTask(task, 'prev')
                                  }}
                                  className="p-1 hover:bg-amber-50 rounded-md text-amber-900/30 hover:text-amber-600 transition-colors"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                              )}
                              {statusOrder.indexOf(task.status) < statusOrder.length - 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStepTask(task, 'next')
                                  }}
                                  className="p-1 hover:bg-amber-50 rounded-md text-amber-900/30 hover:text-amber-600 transition-colors"
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
