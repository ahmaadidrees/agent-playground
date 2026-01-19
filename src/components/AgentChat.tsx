import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Sparkles, XCircle, PlusCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AgentMessage, AgentSession, Task, StreamingMessage } from '../types'

type AgentProvider = AgentSession['agentKey']

interface AgentChatProps {
  sessions: AgentSession[]
  activeSession: AgentSession | null
  messages: AgentMessage[]
  streamingMessage: StreamingMessage | null
  tasks: Task[]
  onSendMessage: (content: string) => void
  onCancelRun: (sessionId: number) => void
  onCreateSession: (taskId?: number | null, provider?: 'claude' | 'gemini' | 'codex') => void
  onSelectSession: (id: number) => void
  onCreateTasks: (message: AgentMessage) => void
  taskById: Map<number, Task>
}

export const AgentChat: React.FC<AgentChatProps> = ({
  sessions,
  activeSession,
  messages,
  streamingMessage,
  onSendMessage,
  onCancelRun,
  onCreateSession,
  onSelectSession,
  onCreateTasks,
  taskById,
}) => {
  const [input, setInput] = React.useState('')
  const [provider, setProvider] = React.useState<AgentProvider>('claude')
  const [isThinkingOpen, setIsThinkingOpen] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMessage])

  React.useEffect(() => {
    setIsThinkingOpen(false)
  }, [streamingMessage?.runId])

  const hasThinking = Boolean(streamingMessage?.stderr.trim())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && activeSession) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  return (
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl border border-amber-900/10 rounded-3xl overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/5 bg-white/20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-amber-950">AI Assistant</h2>
          </div>
          <div className="h-4 w-px bg-amber-900/10" />
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AgentProvider)}
            className="bg-transparent text-xs font-bold text-amber-900/60 uppercase tracking-widest focus:outline-none cursor-pointer hover:text-amber-600 transition-colors"
          >
            <option value="claude">Claude 3.5 Sonnet</option>
            <option value="gemini">Gemini 1.5 Pro</option>
            <option value="codex">Codex AI</option>
          </select>
        </div>
        <button
          onClick={() => onCreateSession(null, provider)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sessions Sidebar */}
        <div className="w-64 border-r border-amber-900/5 bg-amber-900/[0.02] flex flex-col min-h-0">
          <div className="p-3 text-[10px] font-bold text-amber-900/30 uppercase tracking-[0.2em] px-5">Recent Chats</div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
            {sessions.map((s) => {
              const task = s.taskId ? taskById.get(s.taskId) : null
              const isActive = s.id === activeSession?.id
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  className={cn(
                    "flex flex-col gap-1 p-3 rounded-2xl transition-all text-left group",
                    isActive 
                      ? "bg-white border border-amber-900/5 shadow-sm" 
                      : "hover:bg-amber-900/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", isActive ? "text-amber-600" : "text-amber-900/40")}>
                      {s.agentKey}
                    </span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                  </div>
                  <span className={cn("text-xs font-semibold truncate", isActive ? "text-amber-950" : "text-amber-900/60")}>
                    {task ? task.title : 'General Discussion'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 relative bg-white/20">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
            {messages.length === 0 && !streamingMessage ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-40">
                <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-950">Start a conversation</h3>
                  <p className="text-sm font-medium">Ask me to help with your code, plan tasks, or debug issues.</p>
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
                      m.role === 'user' ? "bg-amber-500 text-white" : "bg-white border border-amber-900/10 text-amber-600"
                    )}>
                      {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className={cn(
                        "p-4 rounded-3xl text-sm leading-relaxed shadow-sm",
                        m.role === 'user' 
                          ? "bg-amber-500 text-white rounded-tr-none" 
                          : "bg-white border border-amber-900/5 text-amber-950 rounded-tl-none"
                      )}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: (props) => <pre className="bg-amber-950 text-amber-50 p-4 rounded-2xl my-2 overflow-x-auto text-[13px] font-mono" {...props} />,
                            code: (props) => <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md font-mono text-[12px]" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                      {m.role === 'assistant' && (
                        <button
                          onClick={() => onCreateTasks(m)}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 uppercase tracking-widest pl-1"
                        >
                          <PlusCircle className="w-3 h-3" />
                          Extract Tasks
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {streamingMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 max-w-[85%] mr-auto"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-amber-900/10 text-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="p-4 rounded-3xl bg-white border border-amber-900/5 text-amber-950 text-sm leading-relaxed rounded-tl-none shadow-sm">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: (props) => <pre className="bg-amber-950 text-amber-50 p-4 rounded-2xl my-2 overflow-x-auto text-[13px] font-mono" {...props} />,
                            code: (props) => <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md font-mono text-[12px]" {...props} />,
                          }}
                        >
                          {streamingMessage.stdout}
                        </ReactMarkdown>
                        <span className="inline-block w-1.5 h-4 bg-amber-500 ml-1 animate-pulse align-middle" />
                      </div>
                      {hasThinking && (
                        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 shadow-inner">
                          <button
                            type="button"
                            onClick={() => setIsThinkingOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900/50 hover:text-amber-900/70 transition-colors"
                            aria-expanded={isThinkingOpen}
                            aria-controls="agent-thinking-panel"
                          >
                            <span>Thinking output (stderr)</span>
                            {isThinkingOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <div
                            id="agent-thinking-panel"
                            className={cn(
                              "transition-[max-height,opacity] duration-300 ease-out overflow-hidden",
                              isThinkingOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                            )}
                          >
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                              <pre className="px-4 pb-4 text-[12px] leading-relaxed font-mono text-amber-900/80 whitespace-pre-wrap break-words">
                                {streamingMessage.stderr}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 pt-0">
            <form onSubmit={handleSubmit} className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder={activeSession ? "Describe what you need..." : "Select a session to chat"}
                disabled={!activeSession}
                className="w-full bg-white border border-amber-900/10 rounded-2xl px-6 py-4 pr-32 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/50 transition-all shadow-sm resize-none min-h-[100px] custom-scrollbar"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                {streamingMessage && (
                  <button
                    type="button"
                    onClick={() => activeSession && onCancelRun(activeSession.id)}
                    className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                    title="Stop generation"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!activeSession || !input.trim()}
                  className="p-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all disabled:opacity-30 disabled:grayscale shadow-lg shadow-amber-500/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
            <div className="mt-2 flex items-center justify-center gap-4 text-[10px] font-bold text-amber-900/20 uppercase tracking-[0.2em]">
              <span>Markdown Supported</span>
              <span>•</span>
              <span>Press Enter to Send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
