import React from 'react'
import { Plus, Database, FolderCode, Activity, Settings } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Repo } from '../types'

interface SidebarProps {
  repos: Repo[]
  selectedRepoId: number | null
  onSelectRepo: (id: number) => void
  onPickRepo: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  repos,
  selectedRepoId,
  onSelectRepo,
  onPickRepo,
}) => {
  return (
    <aside className="flex flex-col w-72 bg-white/50 backdrop-blur-xl border-r border-amber-900/10 h-full p-6 gap-8">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-amber-950 tracking-tight">Agent Playground</span>
        </div>
      </div>

      <div className="flex flex-col gap-6 flex-1 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-amber-900/40">
            <span>Repositories</span>
            <button
              onClick={onPickRepo}
              className="p-1 hover:bg-amber-100 rounded-md transition-colors text-amber-600"
              title="Add repository"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {repos.length === 0 ? (
              <div className="px-3 py-4 text-sm text-amber-900/40 bg-amber-50/50 rounded-xl border border-dashed border-amber-200 text-center">
                No repos attached
              </div>
            ) : (
              repos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onSelectRepo(repo.id)}
                  className={cn(
                    "group flex flex-col gap-1 p-3 rounded-xl transition-all text-left border",
                    selectedRepoId === repo.id
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-950 shadow-sm"
                      : "bg-transparent border-transparent text-amber-900/60 hover:bg-amber-50 hover:border-amber-200"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FolderCode className={cn("w-4 h-4", selectedRepoId === repo.id ? "text-amber-600" : "text-amber-400")} />
                    <span className="font-semibold text-sm truncate">{repo.name}</span>
                  </div>
                  <span className="text-[10px] opacity-60 truncate pl-6">{repo.path}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <button className="flex items-center gap-3 p-3 rounded-xl text-amber-900/60 hover:bg-amber-50 hover:text-amber-950 transition-all text-sm font-medium">
            <Database className="w-4 h-4" />
            <span>Database</span>
          </button>
          <button className="flex items-center gap-3 p-3 rounded-xl text-amber-900/60 hover:bg-amber-50 hover:text-amber-950 transition-all text-sm font-medium">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
