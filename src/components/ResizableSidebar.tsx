import React from 'react'
import { cn } from '../lib/utils'

interface ResizableSidebarProps {
  children: React.ReactNode
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
  storageKey?: string
  className?: string
  hideDivider?: boolean
}

export const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  children,
  initialWidth = 520,
  minWidth = 360,
  maxWidth = 760,
  storageKey = 'plannerSidebarWidth',
  className,
  hideDivider = false,
}) => {
  const [width, setWidth] = React.useState(() => {
    if (typeof window === 'undefined') return initialWidth
    try {
      const stored = window.localStorage.getItem(storageKey)
      const parsed = stored ? Number(stored) : NaN
      if (Number.isFinite(parsed)) {
        return Math.min(maxWidth, Math.max(minWidth, parsed))
      }
      return initialWidth
    } catch {
      return initialWidth
    }
  })
  const startXRef = React.useRef(0)
  const startWidthRef = React.useRef(width)
  const draggingRef = React.useRef(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, String(width))
    } catch {
      // ignore storage failures
    }
  }, [storageKey, width])

  const clamp = React.useCallback(
    (value: number) => Math.min(maxWidth, Math.max(minWidth, value)),
    [minWidth, maxWidth]
  )

  const onPointerMove = React.useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) return
      const delta = event.clientX - startXRef.current
      const nextWidth = clamp(startWidthRef.current + delta)
      setWidth(nextWidth)
    },
    [clamp]
  )

  const stopDrag = React.useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (typeof document !== 'undefined') {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopDrag)
    }
  }, [onPointerMove])

  React.useEffect(() => {
    return () => stopDrag()
  }, [stopDrag])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    draggingRef.current = true
    startXRef.current = event.clientX
    startWidthRef.current = width
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', stopDrag)
    }
  }

  return (
    <aside
      className={cn("relative h-full flex-shrink-0", className)}
      style={{ width }}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize planner panel"
        aria-valuenow={Math.round(width)}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        onPointerDown={startDrag}
        className={cn(
          "absolute right-0 top-0 h-full w-2 cursor-col-resize z-20 transition-opacity",
          hideDivider ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="h-full w-px bg-[color:var(--border)] mx-auto" />
      </div>
    </aside>
  )
}
