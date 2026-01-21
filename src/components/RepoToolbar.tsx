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
    <div className="flex items-center justify-between gap-4 bg-[color:var(--panel-muted)] border border-[color:var(--border)] rounded-2xl px-5 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[color:var(--accent)] rounded-xl flex items-center justify-center shadow-lg shadow-accent">
          <Activity className="w-5 h-5 text-[color:var(--accent-contrast)]" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-[color:var(--text-strong)]">Agent Playground</span>
          <span className="text-[11px] text-[color:var(--text-subtle)] font-semibold">Threads + Feature board</span>
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
              "appearance-none bg-[color:var(--panel-solid)] border border-[color:var(--border)] rounded-xl pl-4 pr-10 py-2 text-xs font-semibold text-[color:var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]",
              !selectedRepoId && "text-[color:var(--text-subtle)]"
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
          <ChevronDown className="w-4 h-4 text-[color:var(--accent)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={onPickRepo}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-wider hover:bg-[color:var(--accent-strong)] transition-all shadow-md shadow-accent"
        >
          <Plus className="w-4 h-4" />
          Add Repo
        </button>
      </div>
    </div>
  )
}
