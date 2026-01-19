import React, { forwardRef } from 'react'
import { Terminal as TerminalIcon, Maximize2, StopCircle, Play } from 'lucide-react'
import { cn } from '../lib/utils'

interface TerminalPanelProps {
  title: string
  subtitle?: string
  isRunning: boolean
  onStart?: () => void
  onStop?: () => void
  className?: string
  children?: React.ReactNode
}

export const TerminalPanel = forwardRef<HTMLDivElement, TerminalPanelProps>(({
  title,
  subtitle,
  isRunning,
  onStart,
  onStop,
  className,
  children
}, ref) => {
  return (
    <div className={cn("flex flex-col bg-[#110f0b] rounded-3xl border border-white/5 shadow-2xl overflow-hidden min-h-0", className)}>
      <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/50" />
            <div className="w-3 h-3 rounded-full bg-amber-500/50" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-3.5 h-3.5 text-amber-500/80" />
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em]">{title}</span>
            </div>
            {subtitle && <span className="text-[10px] text-white/20 font-medium">{subtitle}</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onStop && isRunning && (
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider transition-all"
            >
              <StopCircle className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
          {onStart && !isRunning && (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Start
            </button>
          )}
          <button className="p-2 text-white/20 hover:text-white/60 transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative min-h-0 p-4">
        <div ref={ref} className="w-full h-full" />
        {children}
      </div>
    </div>
  )
})

TerminalPanel.displayName = 'TerminalPanel'
