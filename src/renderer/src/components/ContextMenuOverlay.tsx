import React, { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ContextMenuItem } from '@/hooks/useContextMenu'

interface ContextMenuOverlayProps {
  x: number
  y: number
  items: ContextMenuItem[]
  open: boolean
  onClose: () => void
}

export function ContextMenuOverlay({ x, y, items, open, onClose }: ContextMenuOverlayProps): React.ReactElement | null {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handler = () => onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[160px] rounded-lg border border-border bg-popover py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          disabled={item.disabled}
          onClick={() => { item.action(); onClose() }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
            item.danger
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-popover-foreground hover:bg-accent',
            item.disabled && 'opacity-40 cursor-not-allowed'
          )}
        >
          <span className="flex-1">{item.label}</span>
          {item.shortcut && (
            <kbd className="text-[9px] text-muted-foreground">{item.shortcut}</kbd>
          )}
        </button>
      ))}
    </div>
  )
}
