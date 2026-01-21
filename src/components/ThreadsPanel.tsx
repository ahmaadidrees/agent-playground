import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Bot,
  User,
  PlusCircle,
  MessageSquare,
  Trash2,
  XCircle,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { StreamingMessage } from '../types'

export type ThreadKind = 'planner' | 'execution'

export type ThreadItem = {
  id: number
  kind: ThreadKind
  title: string
  subtitle: string
  timestamp?: string | null
  featureId?: number | null
  agentKey?: 'claude' | 'gemini' | 'codex'
  baseBranch?: string
  worktreePath?: string | null
  branchName?: string | null
  model?: string | null
  reasoningEffort?: string | null
  sandbox?: string | null
  approval?: string | null
}

export type ThreadMessage = {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
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

interface ThreadsPanelProps {
  threads: ThreadItem[]
  activeThread: ThreadItem | null
  messages: ThreadMessage[]
  streamingMessage: StreamingMessage | null
  thinkingOutput?: string
  thinkingRunId?: string | null
  activeRunId: string | null
  isRepoSelected: boolean
  className?: string
  layout?: 'split' | 'stacked'
  onCreatePlannerThread: () => void
  onSelectThread: (kind: ThreadKind, id: number) => void
  onDeletePlannerThread: (id: number) => void
  onSendMessage: (content: string) => void
  onCancelRun: (runId: string) => void
  onUpdatePlannerThread: (payload: {
    threadId: number
    title?: string
    model?: string | null
    reasoningEffort?: string | null
    sandbox?: string | null
    approval?: string | null
  }) => void
  onCreateFeature: (message: { threadId: number; content: string }) => void
}

export const ThreadsPanel: React.FC<ThreadsPanelProps> = ({
  threads,
  activeThread,
  messages,
  streamingMessage,
  thinkingOutput = '',
  thinkingRunId = null,
  activeRunId,
  isRepoSelected,
  className,
  layout = 'split',
  onCreatePlannerThread,
  onSelectThread,
  onDeletePlannerThread,
  onSendMessage,
  onCancelRun,
  onUpdatePlannerThread,
  onCreateFeature,
}) => {
  const [input, setInput] = React.useState('')
  const [modelInput, setModelInput] = React.useState(activeThread?.model ?? '')
  const [isThreadDrawerOpen, setIsThreadDrawerOpen] = React.useState(() => !activeThread)
  const [isThinkingOpen, setIsThinkingOpen] = React.useState(false)
  const lastThinkingRunId = React.useRef<string | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setModelInput(activeThread?.model ?? '')
  }, [activeThread?.id, activeThread?.model])

  React.useEffect(() => {
    if (!activeThread) {
      setIsThreadDrawerOpen(true)
    }
  }, [activeThread])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage])

  const currentThinkingRunId = streamingMessage?.runId ?? thinkingRunId

  React.useEffect(() => {
    if (!currentThinkingRunId || currentThinkingRunId === lastThinkingRunId.current) return
    setIsThinkingOpen(false)
    lastThinkingRunId.current = currentThinkingRunId
  }, [currentThinkingRunId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeThread || !input.trim()) return
    onSendMessage(input.trim())
    setInput('')
  }

  const handleModelBlur = () => {
    if (!activeThread || activeThread.kind !== 'planner') return
    const normalized = modelInput.trim()
    if (normalized === (activeThread.model ?? '')) return
    onUpdatePlannerThread({
      threadId: activeThread.id,
      model: normalized.length ? normalized : null,
    })
  }

  const isStacked = layout === 'stacked'
  const streamingThinking = streamingMessage?.stderr ?? ''
  const persistentThinking = streamingMessage ? '' : thinkingOutput
  const shouldShowPersistentThinking = !streamingMessage && Boolean(persistentThinking.trim())
  const hasStreamingThinking = Boolean(streamingThinking.trim())

  return (
    <div className={cn("flex flex-col h-full bg-[color:var(--panel-soft)] backdrop-blur-xl border border-[color:var(--border)] rounded-3xl overflow-hidden shadow-xl", className)}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)] bg-[color:var(--panel-soft)]">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-[color:var(--accent)]" />
          <div className="flex flex-col">
            <span className="font-bold text-[color:var(--text-strong)]">Threads</span>
            <span className="text-[11px] text-[color:var(--text-muted)] font-medium">Planner + execution output</span>
          </div>
        </div>
        <button
          onClick={onCreatePlannerThread}
          disabled={!isRepoSelected}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-[11px] font-bold uppercase tracking-wider hover:bg-[color:var(--accent-strong)] transition-all shadow-md shadow-accent disabled:opacity-40"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          New Planner
        </button>
      </div>

      <div className={cn("flex-1 flex overflow-hidden", isStacked ? "flex-col" : "flex-row")}>
        <div
          className={cn(
            "bg-[color:var(--panel-muted)] flex flex-col min-h-0",
            isStacked
              ? "w-full border-b border-[color:var(--border)] flex-none max-h-[260px]"
              : "w-72 border-r border-[color:var(--border)]"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[color:var(--text-faint)] uppercase tracking-[0.2em]">Threads</span>
              {activeThread && (
                <span className="text-xs font-semibold text-[color:var(--text-muted)] truncate max-w-[220px]">
                  Active: {activeThread.title}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsThreadDrawerOpen((prev) => !prev)}
              className="p-1.5 rounded-lg text-[color:var(--text-subtle)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent-ghost)] transition-colors"
              aria-expanded={isThreadDrawerOpen}
              aria-controls="threads-drawer"
            >
              {isThreadDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <div
            id="threads-drawer"
            className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
              isThreadDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{ maxHeight: isThreadDrawerOpen ? (isStacked ? 220 : 1000) : 0 }}
          >
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
              {threads.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-[color:var(--text-muted)]">
                  Start a planner or feature thread.
                </div>
              ) : (
                threads.map((thread) => {
                  const isActive = thread.id === activeThread?.id && thread.kind === activeThread?.kind
                  return (
                    <button
                      key={`${thread.kind}-${thread.id}`}
                      onClick={() => {
                        onSelectThread(thread.kind, thread.id)
                        setIsThreadDrawerOpen(false)
                      }}
                      className={cn(
                        "group flex items-center justify-between gap-2 p-3 rounded-2xl transition-all text-left",
                        isActive
                          ? "bg-[color:var(--panel-solid)] border border-[color:var(--border)] shadow-sm"
                          : "hover:bg-[color:var(--accent-ghost)]"
                      )}
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className={cn("text-xs font-semibold truncate", isActive ? "text-[color:var(--text-strong)]" : "text-[color:var(--text-muted)]")}>
                          {thread.title}
                        </span>
                        <span className="text-[10px] text-[color:var(--text-subtle)] truncate">{thread.subtitle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest",
                          thread.kind === 'planner'
                            ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                            : "bg-[color:var(--chip-bg)] text-[color:var(--chip-text)]"
                        )}>
                          {thread.kind}
                        </span>
                        {thread.kind === 'planner' && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              onDeletePlannerThread(thread.id)
                            }}
                            className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete thread"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 relative bg-[color:var(--panel-soft)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)] bg-[color:var(--panel-solid)]">
            <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] font-semibold">
              <Sliders className="w-4 h-4 text-[color:var(--accent)]" />
              {activeThread ? 'Thread Settings' : 'Select a thread'}
            </div>
            {activeThread?.kind === 'planner' && (
              <div className="flex items-center gap-3">
                <input
                  value={modelInput}
                  onChange={(event) => setModelInput(event.target.value)}
                  onBlur={handleModelBlur}
                  placeholder="Model (default)"
                  className="px-3 py-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-xs font-semibold text-[color:var(--text-strong)] placeholder:text-[color:var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                />
                <select
                  value={activeThread.reasoningEffort ?? ''}
                  onChange={(event) =>
                    onUpdatePlannerThread({
                      threadId: activeThread.id,
                      reasoningEffort: event.target.value || null,
                    })
                  }
                  className="px-2 py-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-xs font-semibold text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                >
                  {reasoningOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={activeThread.sandbox ?? ''}
                  onChange={(event) =>
                    onUpdatePlannerThread({
                      threadId: activeThread.id,
                      sandbox: event.target.value || null,
                    })
                  }
                  className="px-2 py-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-xs font-semibold text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                >
                  {sandboxOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={activeThread.approval ?? ''}
                  onChange={(event) =>
                    onUpdatePlannerThread({
                      threadId: activeThread.id,
                      approval: event.target.value || null,
                    })
                  }
                  className="px-2 py-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-xs font-semibold text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                >
                  {approvalOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeThread?.kind === 'execution' && (
              <div className="flex items-center gap-3 text-[11px] font-semibold text-[color:var(--text-muted)]">
                {activeThread.agentKey && <span>{activeThread.agentKey.toUpperCase()}</span>}
                {activeThread.featureId && <span>Feature #{activeThread.featureId}</span>}
                {activeThread.branchName && <span>{activeThread.branchName}</span>}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
            {!activeThread ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50">
                <div className="w-16 h-16 bg-[color:var(--accent-soft)] rounded-3xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[color:var(--accent)]" />
                </div>
                <div>
                  <h3 className="font-bold text-[color:var(--text-strong)]">Select a thread</h3>
                  <p className="text-sm font-medium text-[color:var(--text-muted)]">Planner output and live execution logs show up here.</p>
                </div>
              </div>
            ) : messages.length === 0 && !streamingMessage ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50">
                <div className="w-16 h-16 bg-[color:var(--accent-soft)] rounded-3xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[color:var(--accent)]" />
                </div>
                <div>
                  <h3 className="font-bold text-[color:var(--text-strong)]">Start the thread</h3>
                  <p className="text-sm font-medium text-[color:var(--text-muted)]">Send a message to begin.</p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-4 max-w-[85%]",
                      m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                      m.role === 'user'
                        ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                        : "bg-[color:var(--panel-solid)] border border-[color:var(--border)] text-[color:var(--accent)]"
                    )}>
                      {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className={cn(
                        "p-4 rounded-3xl text-sm leading-relaxed shadow-sm",
                        m.role === 'user'
                          ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] rounded-tr-none"
                          : "bg-[color:var(--panel-solid)] border border-[color:var(--border-soft)] text-[color:var(--text-strong)] rounded-tl-none"
                      )}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: (props) => <pre className="bg-[color:var(--code-bg)] text-[color:var(--code-text)] p-4 rounded-2xl my-2 overflow-x-auto text-[13px] font-mono" {...props} />,
                            code: (props) => <code className="bg-[color:var(--accent-soft)] text-[color:var(--text)] px-1.5 py-0.5 rounded-md font-mono text-[12px]" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                      {activeThread.kind === 'planner' && m.role === 'assistant' && (
                        <button
                          onClick={() => onCreateFeature({ threadId: activeThread.id, content: m.content })}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] uppercase tracking-widest pl-1"
                        >
                          <PlusCircle className="w-3 h-3" />
                          Create Feature
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {streamingMessage && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 max-w-[85%] mr-auto">
                    <div className="w-8 h-8 rounded-xl bg-[color:var(--panel-solid)] border border-[color:var(--border)] text-[color:var(--accent)] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="p-4 rounded-3xl bg-[color:var(--panel-solid)] border border-[color:var(--border-soft)] text-[color:var(--text-strong)] text-sm leading-relaxed rounded-tl-none shadow-sm">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: (props) => <pre className="bg-[color:var(--code-bg)] text-[color:var(--code-text)] p-4 rounded-2xl my-2 overflow-x-auto text-[13px] font-mono" {...props} />,
                            code: (props) => <code className="bg-[color:var(--accent-soft)] text-[color:var(--text)] px-1.5 py-0.5 rounded-md font-mono text-[12px]" {...props} />,
                          }}
                        >
                          {streamingMessage.stdout}
                        </ReactMarkdown>
                        <span className="inline-block w-1.5 h-4 bg-[color:var(--accent)] ml-1 animate-pulse align-middle" />
                      </div>
                      {(hasStreamingThinking || shouldShowPersistentThinking) && (
                        <div className="rounded-2xl border border-[color:var(--accent-soft)] bg-[color:var(--accent-ghost)] shadow-inner">
                          <button
                            type="button"
                            onClick={() => setIsThinkingOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--text-muted)] hover:text-[color:var(--text-dim)] transition-colors"
                            aria-expanded={isThinkingOpen}
                            aria-controls="thread-thinking-panel"
                          >
                            <span>Thinking output (stderr)</span>
                            {isThinkingOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <div
                            id="thread-thinking-panel"
                            className={cn("px-4 pb-4 text-[11px] font-mono whitespace-pre-wrap", isThinkingOpen ? "block" : "hidden")}
                          >
                            {hasStreamingThinking ? streamingThinking : persistentThinking}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </AnimatePresence>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[color:var(--border)] bg-[color:var(--panel-solid)] p-4">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={activeThread ? "Message thread..." : "Select a thread first"}
                disabled={!activeThread}
                className="flex-1 px-4 py-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] disabled:opacity-40"
              />
              {activeRunId ? (
                <button
                  type="button"
                  onClick={() => onCancelRun(activeRunId)}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-rose-100 text-rose-600 text-xs font-bold uppercase tracking-widest"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!activeThread || !input.trim()}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
