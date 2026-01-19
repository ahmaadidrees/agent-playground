import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, MessageSquare, Calendar, Tag, ChevronRight, Hash, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Task, Repo } from '../types'

interface TaskDrawerProps {
  task: Task | null
  repo: Repo | null
  note: string
  noteStatus: 'idle' | 'saving' | 'saved'
  onClose: () => void
  onNoteChange: (note: string) => void
  onSaveNote: () => void
  onSendToAgent?: (taskId: number) => void
  onDeleteTask?: (taskId: number) => void
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  task,
  note,
  noteStatus,
  onClose,
  onNoteChange,
  onSaveNote,
  onSendToAgent,
  onDeleteTask,
}) => {
  const showAgentAction = Boolean(onSendToAgent)
  const showDeleteAction = Boolean(onDeleteTask)

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
