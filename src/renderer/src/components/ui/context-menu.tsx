import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}

export interface ContextMenuSeparator {
  separator: true
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface ContextMenuProps {
  entries: ContextMenuEntry[]
  x: number
  y: number
  onClose: () => void
}

export function ContextMenu({ entries, x, y, onClose }: ContextMenuProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    const onMouse = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onMouse)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [onClose])

  // Keep the menu inside the viewport
  const vw = window.innerWidth
  const vh = window.innerHeight
  const estimatedH = entries.length * 30 + 16
  const adjustedX = Math.min(x, vw - 200)
  const adjustedY = Math.min(y, vh - estimatedH)

  const menu = (
    <div
      ref={ref}
      style={{ position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 9999 }}
      className="surface-overlay min-w-[180px] rounded-lg border border-border p-1"
    >
      {entries.map((entry, i) => {
        if ('separator' in entry) {
          return <div key={i} className="mx-1 my-1 h-px bg-border" />
        }
        const { label, icon, shortcut, onClick, disabled, destructive } = entry
        return (
          <button
            key={i}
            disabled={disabled}
            onClick={() => { if (!disabled) { onClick(); onClose() } }}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left',
              disabled && 'cursor-not-allowed opacity-40',
              !disabled && destructive && 'text-destructive hover:bg-destructive/10',
              !disabled && !destructive && 'text-foreground hover:bg-accent'
            )}
          >
            {icon && (
              <span className="size-3.5 shrink-0 flex items-center justify-center text-muted-foreground">
                {icon}
              </span>
            )}
            <span className="flex-1">{label}</span>
            {shortcut && (
              <span className="ml-4 text-[10px] text-muted-foreground/60">{shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )

  return ReactDOM.createPortal(menu, document.body)
}
