import React from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Activity, Gamepad2, PlusCircle, ShieldCheck, PlayCircle, UserCircle } from 'lucide-react'
import * as THREE from 'three'
import { cn } from '../lib/utils'
import { KanbanBoard } from './KanbanBoard'
import type { Agent, AgentEvent, AgentRunEvent, AgentRunSummary, Task } from '../types'

type ZoneId = 'kanban' | 'execution' | 'review'

type Position = { x: number; z: number }

type Zone = {
  id: ZoneId
  title: string
  description: string
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  color: string
}

const WORLD_BOUNDS = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }

const ZONES: Zone[] = [
  {
    id: 'kanban',
    title: 'Planning Hall',
    description: 'Plan and queue features.',
    bounds: { minX: -9, maxX: -2, minZ: -4, maxZ: 4 },
    color: '#c8f4ef',
  },
  {
    id: 'execution',
    title: 'Execution Bay',
    description: 'Run agents on active features.',
    bounds: { minX: 2, maxX: 9, minZ: -4, maxZ: 4 },
    color: '#bdeaf5',
  },
  {
    id: 'review',
    title: 'Finish Dock',
    description: 'Review and close out features.',
    bounds: { minX: -2, maxX: 2, minZ: 4, maxZ: 9 },
    color: '#d1f7f3',
  },
]

const zoneFromPosition = (position: Position | null) => {
  if (!position) return null
  return (
    ZONES.find((zone) => {
      const { minX, maxX, minZ, maxZ } = zone.bounds
      return position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ
    }) ?? null
  )
}

const getDefaultPositions = (agents: Agent[]) => {
  const radius = 7
  const count = Math.max(agents.length, 1)
  const sorted = [...agents].sort((a, b) => a.id - b.id)
  return sorted.reduce<Record<number, Position>>((acc, agent, index) => {
    const angle = (index / count) * Math.PI * 2
    acc[agent.id] = {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    }
    return acc
  }, {})
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const isTextInputActive = () => {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

const useMovementKeys = () => {
  const keysRef = React.useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  })

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputActive()) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'w' || key === 'arrowup') {
        keysRef.current.up = true
        event.preventDefault()
      }
      if (key === 's' || key === 'arrowdown') {
        keysRef.current.down = true
        event.preventDefault()
      }
      if (key === 'a' || key === 'arrowleft') {
        keysRef.current.left = true
        event.preventDefault()
      }
      if (key === 'd' || key === 'arrowright') {
        keysRef.current.right = true
        event.preventDefault()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'w' || key === 'arrowup') keysRef.current.up = false
      if (key === 's' || key === 'arrowdown') keysRef.current.down = false
      if (key === 'a' || key === 'arrowleft') keysRef.current.left = false
      if (key === 'd' || key === 'arrowright') keysRef.current.right = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return keysRef
}

const AgentAvatar: React.FC<{
  position: Position
  label: string
  sublabel?: string
  isActive: boolean
  isWorking: boolean
  isDistressed: boolean
  color: string
}> = ({ position, label, sublabel, isActive, isWorking, isDistressed, color }) => {
  const groupRef = React.useRef<THREE.Group>(null)
  const ringRef = React.useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (groupRef.current) {
      const bounce = isWorking ? Math.sin(t * 4) * 0.08 : 0
      const wobble = isDistressed ? Math.sin(t * 10) * 0.05 : 0
      groupRef.current.position.set(position.x + wobble, 0.55 + bounce, position.z + wobble)
      groupRef.current.rotation.y = isWorking ? t * 0.8 : 0
    }
    if (ringRef.current) {
      const pulse = isWorking ? 1 + Math.sin(t * 5) * 0.1 : 1
      ringRef.current.scale.set(pulse, pulse, pulse)
    }
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color={isDistressed ? '#f86a6a' : color} emissive={isActive ? '#14b8a6' : '#000000'} emissiveIntensity={isActive ? 0.3 : 0} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <torusGeometry args={[0.8, 0.08, 12, 24]} />
        <meshStandardMaterial color={isWorking ? '#2dd4bf' : '#7fbfb5'} emissive={isDistressed ? '#f86a6a' : '#000000'} emissiveIntensity={isDistressed ? 0.4 : 0} />
      </mesh>
      <Html center position={[0, 1.3, 0]} style={{ pointerEvents: 'none' }}>
        <div className={cn(
          "px-2 py-1 rounded-xl text-[10px] font-semibold tracking-wide shadow-md",
          isDistressed ? "bg-rose-500/90 text-white" : "bg-[color:var(--panel-strong)] text-[color:var(--text)]"
        )}>
          <div className="text-[10px] font-bold">{label}</div>
          {sublabel && <div className="text-[9px] text-[color:var(--accent-strong)]">{sublabel}</div>}
        </div>
      </Html>
    </group>
  )
}

const MovableAgent: React.FC<{
  position: Position
  onMove: (pos: Position) => void
  label: string
  sublabel?: string
  isWorking: boolean
  isDistressed: boolean
  color: string
}> = ({ position, onMove, label, sublabel, isWorking, isDistressed, color }) => {
  const keysRef = useMovementKeys()
  const positionRef = React.useRef(position)

  React.useEffect(() => {
    positionRef.current = position
  }, [position])

  useFrame((_state, delta) => {
    const keys = keysRef.current
    const speed = 4.5
    const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    const dz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
    if (dx === 0 && dz === 0) return
    const length = Math.hypot(dx, dz) || 1
    const nextX = clamp(positionRef.current.x + (dx / length) * speed * delta, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX)
    const nextZ = clamp(positionRef.current.z + (dz / length) * speed * delta, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ)
    const next = { x: nextX, z: nextZ }
    positionRef.current = next
    onMove(next)
  })

  return (
    <AgentAvatar
      position={positionRef.current}
      label={label}
      sublabel={sublabel}
      isActive
      isWorking={isWorking}
      isDistressed={isDistressed}
      color={color}
    />
  )
}

const ZoneTiles: React.FC = () => {
  return (
    <>
      {ZONES.map((zone) => {
        const width = zone.bounds.maxX - zone.bounds.minX
        const depth = zone.bounds.maxZ - zone.bounds.minZ
        const centerX = (zone.bounds.maxX + zone.bounds.minX) / 2
        const centerZ = (zone.bounds.maxZ + zone.bounds.minZ) / 2
        return (
          <group key={zone.id} position={[centerX, 0.02, centerZ]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[width, depth]} />
              <meshStandardMaterial color={zone.color} opacity={0.75} transparent />
            </mesh>
            <Html center position={[0, 0.05, 0]} style={{ pointerEvents: 'none' }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                {zone.title}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

const CameraRig: React.FC = () => {
  const { camera } = useThree()
  useFrame(() => {
    camera.lookAt(0, 0, 0)
  })
  return null
}

const AgentsScene: React.FC<{
  agents: Agent[]
  activeAgentId: number | null
  positions: Record<number, Position>
  onMoveActive: (pos: Position) => void
  taskByAgent: Map<number, { current?: Task; queued: Task[]; distressed: boolean; running: boolean }>
}> = ({ agents, activeAgentId, positions, onMoveActive, taskByAgent }) => {
  return (
    <>
      <color attach="background" args={['#f7efe4']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 16, 8]} intensity={0.8} castShadow />
      <fog attach="fog" args={['#f7efe4', 12, 28]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color="#f5eadb" />
      </mesh>

      <ZoneTiles />

      {agents.map((agent) => {
        const agentTasks = taskByAgent.get(agent.id)
        const currentTask = agentTasks?.current
        const queued = agentTasks?.queued ?? []
        const distressed = agentTasks?.distressed ?? false
        const running = agentTasks?.running ?? false
        const label = agent.name
        const sublabel = currentTask
          ? `${running ? 'Working' : 'In progress'}: ${currentTask.title}`
          : queued.length > 0
            ? `Queued: ${queued.length}`
            : 'Idle'
        const color = agent.role === 'validator' ? '#9f7aea' : '#f2b45b'
        const pos = positions[agent.id] ?? { x: 0, z: 0 }
        if (agent.id === activeAgentId) {
          return (
            <MovableAgent
              key={agent.id}
              position={pos}
              onMove={onMoveActive}
              label={label}
              sublabel={sublabel}
              isWorking={running}
              isDistressed={distressed}
              color={color}
            />
          )
        }
        return (
          <AgentAvatar
            key={agent.id}
            position={pos}
            label={label}
            sublabel={sublabel}
            isActive={false}
            isWorking={running}
            isDistressed={distressed}
            color={color}
          />
        )
      })}
    </>
  )
}

interface AgentsWorldProps {
  tasks: Task[]
  agents: Agent[]
  agentEvents: AgentEvent[]
  agentRuns: AgentRunSummary[]
  activeAgentRunId: string | null
  agentRunEvents: Record<string, AgentRunEvent[]>
  agentRunOutput: Record<string, { stdout: string; stderr: string }>
  activeAgentId: number | null
  activeTaskId: number | null
  isRepoSelected: boolean
  onSelectAgent: (agentId: number) => void
  onSelectRun: (runId: string) => void
  onCreateAgent: (payload: { name: string; provider: Agent['provider']; role?: Agent['role']; workspacePath?: string | null }) => void
  onClaimTask: (taskId: number) => void
  onMoveTask: (taskId: number, status: Task['status']) => void
  onRequestReview: (taskId: number) => void
  onApproveReview: (taskId: number, reviewerAgentId?: number | null) => void
  onRequestChanges: (taskId: number) => void
  onStartAgentRun: (payload: { taskId: number; agentId: number; message?: string }) => void
  onAddTask: (title: string) => void
  onDeleteTask: (taskId: number) => void
  onSelectTask: (taskId: number) => void
}

export const AgentsWorld: React.FC<AgentsWorldProps> = ({
  tasks,
  agents,
  agentEvents,
  agentRuns,
  activeAgentRunId,
  agentRunEvents,
  agentRunOutput,
  activeAgentId,
  activeTaskId,
  isRepoSelected,
  onSelectAgent,
  onSelectRun,
  onCreateAgent,
  onClaimTask,
  onMoveTask,
  onRequestReview,
  onApproveReview,
  onRequestChanges,
  onStartAgentRun,
  onAddTask,
  onDeleteTask,
  onSelectTask,
}) => {
  const activeAgent = activeAgentId ? agents.find((agent) => agent.id === activeAgentId) ?? null : null
  const [selectionReason, setSelectionReason] = React.useState<'required' | 'switch' | null>(null)
  const [viewMode, setViewMode] = React.useState<'visual' | 'telemetry'>(() => {
    if (typeof window === 'undefined') return 'visual'
    const stored = window.localStorage.getItem('agentsWorldView')
    return stored === 'telemetry' ? 'telemetry' : 'visual'
  })
  const [showPanels, setShowPanels] = React.useState(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('agentsWorldPanels')
    return stored !== 'hidden'
  })
  const [collapsedPanels, setCollapsedPanels] = React.useState<Record<ZoneId, boolean>>(() => {
    if (typeof window === 'undefined') return { kanban: false, execution: false, review: false }
    try {
      const stored = window.localStorage.getItem('agentsWorldCollapsed')
      return stored ? (JSON.parse(stored) as Record<ZoneId, boolean>) : { kanban: false, execution: false, review: false }
    } catch {
      return { kanban: false, execution: false, review: false }
    }
  })

  const [agentPositions, setAgentPositions] = React.useState<Record<number, Position>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = window.localStorage.getItem('agentWorldPositions')
      return stored ? (JSON.parse(stored) as Record<number, Position>) : {}
    } catch {
      return {}
    }
  })

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('agentsWorldView', viewMode)
  }, [viewMode])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('agentsWorldPanels', showPanels ? 'visible' : 'hidden')
  }, [showPanels])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('agentsWorldCollapsed', JSON.stringify(collapsedPanels))
    } catch {
      // ignore storage failures
    }
  }, [collapsedPanels])

  React.useEffect(() => {
    if (!activeAgent) {
      setSelectionReason('required')
    } else if (selectionReason === 'required') {
      setSelectionReason(null)
    }
  }, [activeAgent, selectionReason])

  React.useEffect(() => {
    const defaults = getDefaultPositions(agents)
    setAgentPositions((prev) => {
      const next: Record<number, Position> = {}
      for (const agent of agents) {
        next[agent.id] = prev[agent.id] ?? defaults[agent.id]
      }
      return next
    })
  }, [agents])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('agentWorldPositions', JSON.stringify(agentPositions))
    } catch {
      // ignore storage failures
    }
  }, [agentPositions])

  const activePosition = activeAgentId ? agentPositions[activeAgentId] ?? { x: 0, z: 0 } : null
  const activeZone = zoneFromPosition(activePosition)

  const runningTaskIds = React.useMemo(() => {
    return new Set(agentRuns.filter((run) => run.status === 'running' && run.taskId).map((run) => run.taskId as number))
  }, [agentRuns])

  const taskByAgent = React.useMemo(() => {
    const map = new Map<number, { current?: Task; queued: Task[]; distressed: boolean; running: boolean }>()
    agents.forEach((agent) => {
      const assigned = tasks.filter((task) => task.assignedAgentId === agent.id)
      const runningTasks = assigned.filter((task) => runningTaskIds.has(task.id))
      const current = runningTasks[0] ?? assigned.find((task) => task.status === 'executed')
      const queued = assigned.filter((task) => task.status === 'planned')
      const distressed = assigned.some((task) => task.needsReview)
      map.set(agent.id, { current, queued, distressed, running: runningTasks.length > 0 })
    })
    return map
  }, [agents, tasks, runningTaskIds])

  const activeAgentTasks = React.useMemo(() => {
    if (!activeAgentId) return []
    return tasks.filter((task) => task.assignedAgentId === activeAgentId)
  }, [tasks, activeAgentId])

  const queuedTasks = activeAgentTasks.filter((task) => task.status === 'planned')
  const workingTasks = activeAgentTasks.filter((task) => task.status === 'executed')
  const reviewTasks = tasks.filter((task) => task.status === 'done')

  const visibleEvents = React.useMemo(() => {
    if (!activeAgentId) return agentEvents
    return agentEvents.filter((event) => event.agentId === activeAgentId)
  }, [agentEvents, activeAgentId])

  const activeRuns = React.useMemo(() => {
    if (!activeAgentId) return agentRuns
    return agentRuns.filter((run) => run.agentId === activeAgentId)
  }, [agentRuns, activeAgentId])

  const activeRunEvents = activeAgentRunId ? agentRunEvents[activeAgentRunId] ?? [] : []
  const activeRunOutput = activeAgentRunId ? agentRunOutput[activeAgentRunId] ?? { stdout: '', stderr: '' } : { stdout: '', stderr: '' }

  const handleMoveActive = React.useCallback((next: Position) => {
    if (!activeAgentId) return
    setAgentPositions((prev) => ({ ...prev, [activeAgentId]: next }))
  }, [activeAgentId])

  const canReview = activeAgent?.role === 'validator'
  const activeRun = activeAgentRunId ? agentRuns.find((run) => run.id === activeAgentRunId) ?? null : null
  const handleSelectAgent = (agentId: number) => {
    onSelectAgent(agentId)
    setSelectionReason(null)
  }

  return (
    <section className="relative flex-1 min-h-0 overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-muted)] shadow-xl">
      <div className="absolute inset-0">
        {viewMode === 'visual' ? (
          <Canvas camera={{ position: [0, 12, 12], fov: 50 }} shadows>
            <CameraRig />
            <AgentsScene
              agents={agents}
              activeAgentId={activeAgentId}
              positions={agentPositions}
              onMoveActive={handleMoveActive}
              taskByAgent={taskByAgent}
            />
          </Canvas>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#e6fbf8] via-[#d9f4f0] to-[#ccefea] p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-subtle)] font-semibold">Telemetry</div>
                  <h2 className="text-2xl font-bold text-[color:var(--text-strong)]">Agent Activity Stream</h2>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[color:var(--text-subtle)]">Active agent</div>
                  <div className="text-sm font-semibold text-[color:var(--text-strong)]">
                    {activeAgent ? `${activeAgent.name} · ${activeAgent.role}` : 'Select an agent'}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                      <Activity className="w-4 h-4" /> Live Events
                    </div>
                    <div className="max-h-[340px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                      {visibleEvents.length === 0 ? (
                        <div className="text-sm text-[color:var(--text-subtle)]">No activity logged yet.</div>
                      ) : (
                        visibleEvents.map((event) => (
                          <div key={event.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent-ghost)] p-3 text-xs text-[color:var(--text-dim)]">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                              <span>{event.kind.replace(/_/g, ' ')}</span>
                              <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <div className="mt-1 font-semibold">{event.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 shadow-sm space-y-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Task Radar</div>
                    <div className="space-y-3">
                      {activeAgentTasks.length === 0 ? (
                        <div className="text-sm text-[color:var(--text-subtle)]">No tasks assigned to this agent.</div>
                      ) : (
                        activeAgentTasks.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => onSelectTask(task.id)}
                            className={cn(
                              "w-full text-left rounded-2xl border p-3 transition-all",
                              task.id === activeTaskId ? "border-[color:var(--accent-border)] bg-[color:var(--accent-ghost)] shadow-sm" : "border-[color:var(--border)] bg-[color:var(--panel-solid)] hover:bg-[color:var(--accent-ghost)]"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-[color:var(--text-strong)]">#{task.id} · {task.title}</div>
                              <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">{task.status.replace('_', ' ')}</span>
                            </div>
                            {task.status === 'executed' && (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                                <PlayCircle className="w-3.5 h-3.5" /> Working
                              </div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 shadow-sm space-y-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Agent Runs</div>
                    <div className="max-h-[260px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                      {activeRuns.length === 0 ? (
                        <div className="text-sm text-[color:var(--text-subtle)]">No runs started yet.</div>
                      ) : (
                        activeRuns.map((run) => {
                          const task = tasks.find((item) => item.id === run.taskId)
                          return (
                            <button
                              key={run.id}
                              onClick={() => onSelectRun(run.id)}
                              className={cn(
                                "w-full text-left rounded-2xl border p-3 transition-all",
                                run.id === activeAgentRunId ? "border-[color:var(--accent-border)] bg-[color:var(--accent-ghost)] shadow-sm" : "border-[color:var(--border)] bg-[color:var(--panel-solid)] hover:bg-[color:var(--accent-ghost)]"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-[color:var(--text-strong)]">
                                  {task ? `#${task.id} · ${task.title}` : `Run ${run.id.slice(0, 6)}`}
                                </div>
                                <span className={cn(
                                  "text-[10px] uppercase tracking-[0.2em]",
                                  run.status === 'running' ? "text-emerald-600" : "text-[color:var(--text-subtle)]"
                                )}>
                                  {run.status}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-[color:var(--text-muted)] truncate">{run.command}</div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">Run Output</div>
                      <div className="text-[10px] text-[color:var(--text-subtle)]">
                        {activeRun ? `${activeRun.status} · ${activeRun.id.slice(0, 6)}` : 'Select a run'}
                      </div>
                    </div>
                    {activeRun ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent-ghost)] p-3 text-[11px] text-[color:var(--text-dim)] max-h-[260px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                        {activeRunOutput.stdout || activeRunOutput.stderr
                          ? `${activeRunOutput.stdout}${activeRunOutput.stderr}`
                          : [...activeRunEvents].reverse().map((event) => `[${event.kind}] ${event.payload}`).join('\n') || 'No output yet.'}
                      </div>
                    ) : (
                      <div className="text-sm text-[color:var(--text-subtle)]">Select a run to see output.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute left-6 top-6 z-20 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 shadow-md">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">Agents World</div>
        <div className="text-sm font-semibold text-[color:var(--text-strong)]">{activeAgent ? activeAgent.name : 'Select an agent'}</div>
        <div className="text-[11px] text-[color:var(--text-muted)]">
          {activeAgent ? `${activeAgent.provider.toUpperCase()} · ${activeAgent.role}` : 'No active agent'}
        </div>
        <div className="mt-1 text-[11px] text-[color:var(--text-subtle)]">
          Zone: {activeZone ? activeZone.title : 'Free Roam'}
        </div>
        {activeAgent && (
          <button
            type="button"
            onClick={() => setSelectionReason('switch')}
            className="mt-2 text-[10px] uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            Switch agent
          </button>
        )}
      </div>

      <div className="absolute right-6 top-6 z-20 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-1 shadow-md">
        <button
          type="button"
          onClick={() => setViewMode('visual')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all",
            viewMode === 'visual' ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]" : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
          )}
        >
          Visual
        </button>
        <button
          type="button"
          onClick={() => setViewMode('telemetry')}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all",
            viewMode === 'telemetry' ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]" : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
          )}
        >
          Telemetry
        </button>
        <button
          type="button"
          onClick={() => setShowPanels((prev) => !prev)}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all",
            showPanels ? "text-[color:var(--text-muted)] hover:text-[color:var(--text)]" : "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
          )}
        >
          Panels
        </button>
      </div>

      <div className="absolute left-6 bottom-6 z-20 flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 text-[11px] font-semibold text-[color:var(--text-muted)] shadow-md">
        <Gamepad2 className="w-4 h-4 text-[color:var(--accent)]" />
        WASD or arrow keys to move
      </div>

      {viewMode === 'visual' && activeZone?.id === 'kanban' && showPanels && !collapsedPanels.kanban && (
        <div className="absolute inset-y-6 right-6 z-20 w-[640px] max-w-[60vw]">
          <div className="h-full rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-2xl backdrop-blur-xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-subtle)] font-semibold">{activeZone.title}</div>
                <div className="text-sm font-semibold text-[color:var(--text-strong)]">{activeZone.description}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('telemetry')}
                  className="text-[10px] uppercase tracking-widest text-[color:var(--text-subtle)] hover:text-[color:var(--text)]"
                >
                  View activity
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsedPanels((prev) => ({ ...prev, kanban: true }))}
                  className="text-[10px] uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                >
                  Collapse
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-48px)]">
              <KanbanBoard
                tasks={tasks}
                activeTaskId={activeTaskId}
                onSelectTask={onSelectTask}
                onMoveTask={onMoveTask}
                onAddTask={onAddTask}
                onDeleteTask={onDeleteTask}
                isRepoSelected={isRepoSelected}
                agents={agents}
                activeAgentId={activeAgentId}
                onClaimTask={onClaimTask}
              />
            </div>
          </div>
        </div>
      )}

      {viewMode === 'visual' && activeZone?.id === 'kanban' && (!showPanels || collapsedPanels.kanban) && (
        <div className="absolute right-6 bottom-6 z-20 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 shadow-md">
          <div className="text-[11px] font-semibold text-[color:var(--text)]">{activeZone.title}</div>
          <button
            type="button"
            onClick={() => {
              setShowPanels(true)
              setCollapsedPanels((prev) => ({ ...prev, kanban: false }))
            }}
            className="text-[10px] uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            Expand
          </button>
        </div>
      )}

      {viewMode === 'visual' && activeZone?.id === 'execution' && showPanels && !collapsedPanels.execution && (
        <div className="absolute right-6 bottom-6 z-20 w-[420px] max-w-[60vw] rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-2xl backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-subtle)] font-semibold">{activeZone.title}</div>
              <div className="text-sm font-semibold text-[color:var(--text-strong)]">{activeZone.description}</div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsedPanels((prev) => ({ ...prev, execution: true }))}
              className="text-[10px] uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            >
              Collapse
            </button>
          </div>
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">Queued</div>
            {queuedTasks.length === 0 ? (
              <div className="text-sm text-[color:var(--text-subtle)]">No queued tasks.</div>
            ) : (
              queuedTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[color:var(--text-strong)]">#{task.id} · {task.title}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectTask(task.id)}
                        className="px-3 py-1.5 rounded-xl bg-[color:var(--chip-bg)] text-[color:var(--accent-strong)] text-[10px] font-bold uppercase tracking-widest"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onMoveTask(task.id, 'executed')}
                        className="px-3 py-1.5 rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-[10px] font-bold uppercase tracking-widest shadow-md shadow-accent"
                      >
                        Start
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">Working</div>
            {workingTasks.length === 0 ? (
              <div className="text-sm text-[color:var(--text-subtle)]">No active work yet.</div>
            ) : (
              workingTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent-ghost)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[color:var(--text-strong)]">#{task.id} · {task.title}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectTask(task.id)}
                        className="px-3 py-1.5 rounded-xl bg-[color:var(--chip-bg)] text-[color:var(--accent-strong)] text-[10px] font-bold uppercase tracking-widest"
                      >
                        Inspect
                      </button>
                      {!runningTaskIds.has(task.id) && activeAgent?.role === 'worker' && (
                        <button
                          onClick={() => onStartAgentRun({ taskId: task.id, agentId: activeAgent.id })}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                        >
                          Run
                        </button>
                      )}
                      {runningTaskIds.has(task.id) && (
                        <span className="px-2 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                          Running
                        </span>
                      )}
                      <button
                        onClick={() => onRequestReview(task.id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {viewMode === 'visual' && activeZone?.id === 'execution' && (!showPanels || collapsedPanels.execution) && (
        <div className="absolute right-6 bottom-6 z-20 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 shadow-md">
          <div className="text-[11px] font-semibold text-[color:var(--text)]">{activeZone.title}</div>
          <button
            type="button"
            onClick={() => {
              setShowPanels(true)
              setCollapsedPanels((prev) => ({ ...prev, execution: false }))
            }}
            className="text-[10px] uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            Expand
          </button>
        </div>
      )}

      {viewMode === 'visual' && activeZone?.id === 'review' && showPanels && !collapsedPanels.review && (
        <div className="absolute right-6 bottom-6 z-20 w-[420px] max-w-[60vw] rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-2xl backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-subtle)] font-semibold">{activeZone.title}</div>
              <div className="text-sm font-semibold text-[color:var(--text-strong)]">{activeZone.description}</div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsedPanels((prev) => ({ ...prev, review: true }))}
              className="text-[10px] uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            >
              Collapse
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[color:var(--text-muted)]">
            <ShieldCheck className="w-4 h-4 text-[color:var(--accent)]" />
            {canReview ? 'Validator tools online' : 'Select a validator agent to approve'}
          </div>
          <div className="space-y-3">
            {reviewTasks.length === 0 ? (
              <div className="text-sm text-[color:var(--text-subtle)]">No finished features yet.</div>
            ) : (
              reviewTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[color:var(--text-strong)]">#{task.id} · {task.title}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectTask(task.id)}
                        className="px-3 py-1.5 rounded-xl bg-[color:var(--chip-bg)] text-[color:var(--accent-strong)] text-[10px] font-bold uppercase tracking-widest"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onApproveReview(task.id, activeAgent?.id ?? null)}
                        disabled={!canReview}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-md disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onRequestChanges(task.id)}
                        disabled={!canReview}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
                      >
                        Changes
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-[color:var(--text-muted)]">
                    Assigned agent: {agents.find((agent) => agent.id === task.assignedAgentId)?.name ?? 'Unassigned'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {viewMode === 'visual' && activeZone?.id === 'review' && (!showPanels || collapsedPanels.review) && (
        <div className="absolute right-6 bottom-6 z-20 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 shadow-md">
          <div className="text-[11px] font-semibold text-[color:var(--text)]">{activeZone.title}</div>
          <button
            type="button"
            onClick={() => {
              setShowPanels(true)
              setCollapsedPanels((prev) => ({ ...prev, review: false }))
            }}
            className="text-[10px] uppercase tracking-widest text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            Expand
          </button>
        </div>
      )}

      {selectionReason && (
        <div className="absolute inset-0 z-30 bg-[color:var(--overlay)] backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-3xl rounded-[32px] border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--text-subtle)] font-semibold">Character Select</div>
                <h2 className="text-2xl font-bold text-[color:var(--text-strong)]">Choose Your Agent</h2>
              </div>
              <div className="flex items-center gap-3">
                {activeAgent && (
                  <button
                    type="button"
                    onClick={() => setSelectionReason(null)}
                    className="text-[10px] uppercase tracking-widest text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                  >
                    Close
                  </button>
                )}
                <UserCircle className="w-8 h-8 text-[color:var(--accent-bright)]" />
              </div>
            </div>

            {agents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--accent-ghost)] p-8 text-center text-[color:var(--text-muted)]">
                No agents yet. Create one below.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent.id)}
                    className="text-left rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="text-sm font-semibold text-[color:var(--text-strong)]">{agent.name}</div>
                    <div className="text-[11px] text-[color:var(--text-muted)]">{agent.provider.toUpperCase()} · {agent.role}</div>
                    {agent.workspacePath && (
                      <div className="mt-2 text-[11px] text-[color:var(--text-subtle)] truncate">{agent.workspacePath}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 space-y-4">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--text-subtle)] font-semibold">Create Agent</div>
              <AgentCreateForm isRepoSelected={isRepoSelected} onCreateAgent={onCreateAgent} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const AgentCreateForm: React.FC<{
  isRepoSelected: boolean
  onCreateAgent: (payload: { name: string; provider: Agent['provider']; role?: Agent['role']; workspacePath?: string | null }) => void
}> = ({ isRepoSelected, onCreateAgent }) => {
  const [name, setName] = React.useState('')
  const [provider, setProvider] = React.useState<Agent['provider']>('codex')
  const [role, setRole] = React.useState<Agent['role']>('worker')
  const [workspace, setWorkspace] = React.useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onCreateAgent({
      name: name.trim(),
      provider,
      role,
      workspacePath: workspace.trim() || null,
    })
    setName('')
    setWorkspace('')
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Agent name"
        disabled={!isRepoSelected}
        className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
      />
      <select
        value={provider}
        onChange={(event) => setProvider(event.target.value as Agent['provider'])}
        disabled={!isRepoSelected}
        className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
      >
        <option value="codex">Codex</option>
        <option value="claude">Claude</option>
        <option value="gemini">Gemini</option>
      </select>
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as Agent['role'])}
        disabled={!isRepoSelected}
        className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
      >
        <option value="worker">Worker</option>
        <option value="validator">Validator</option>
      </select>
      <input
        value={workspace}
        onChange={(event) => setWorkspace(event.target.value)}
        placeholder="Workspace path (optional)"
        disabled={!isRepoSelected}
        className="px-3 py-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-solid)] text-sm text-[color:var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
      />
      <button
        type="submit"
        disabled={!isRepoSelected || !name.trim()}
        className="md:col-span-2 flex items-center gap-2 px-4 py-2 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] text-xs font-bold uppercase tracking-widest shadow-md shadow-accent disabled:opacity-40"
      >
        <PlusCircle className="w-4 h-4" />
        Add Agent
      </button>
    </form>
  )
}
