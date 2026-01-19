import React from 'react'
import { Activity, ChevronDown, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Repo } from '../types'

interface RepoToolbarProps {
  repos: Repo[]
  selectedRepoId: number | null
  onSelectRepo: (id: number | null) => void
  onPickRepo: () => void
}

export const RepoToolbar: React.FC<RepoToolbarProps> = ({
  repos,
  selectedRepoId,
  onSelectRepo,
  onPickRepo,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 bg-white/60 border border-amber-900/10 rounded-2xl px-5 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-amber-950">Agent Playground</span>
          <span className="text-[11px] text-amber-900/40 font-semibold">Planner + Kanban workspace</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={selectedRepoId ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onSelectRepo(value ? Number(value) : null)
            }}
            className={cn(
              "appearance-none bg-white border border-amber-900/10 rounded-xl pl-4 pr-10 py-2 text-xs font-semibold text-amber-900/70 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
              !selectedRepoId && "text-amber-900/40"
            )}
          >
            <option value="" disabled>
              {repos.length === 0 ? 'No repos yet' : 'Select repo'}
            </option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-amber-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={onPickRepo}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Repo
        </button>
      </div>
    </div>
  )
}
