import React, { useCallback } from 'react'
import { GripVertical, X, Play, ArrowUp, ArrowDown } from '@/lib/icons'

export interface QueueItem {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'done' | 'error'
}

interface MessageQueueProps {
  items: QueueItem[]
  onRemove: (id: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
  onRunNow: (id: string) => void
}

export function MessageQueue({ items, onRemove, onReorder, onRunNow }: MessageQueueProps): React.ReactElement | null {
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-1 px-3 py-2 border-b border-border bg-card/30">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Queue ({items.length})
        </span>
      </div>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 group hover:border-primary/30 transition-colors"
        >
          <button
            className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            title="Drag to reorder"
            aria-label="Reorder"
          >
            <GripVertical className="size-3" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">{item.title}</div>
            {item.description && (
              <div className="text-[10px] text-muted-foreground truncate">{item.description}</div>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {idx > 0 && (
              <button
                onClick={() => onReorder(idx, idx - 1)}
                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Move up"
              >
                <ArrowUp className="size-3" />
              </button>
            )}
            {idx < items.length - 1 && (
              <button
                onClick={() => onReorder(idx, idx + 1)}
                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Move down"
              >
                <ArrowDown className="size-3" />
              </button>
            )}
            <button
              onClick={() => onRunNow(item.id)}
              className="flex size-5 items-center justify-center rounded text-green-500 hover:bg-green-500/10 transition-colors"
              title="Run now"
            >
              <Play className="size-3" />
            </button>
            <button
              onClick={() => onRemove(item.id)}
              className="flex size-5 items-center justify-center rounded text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove from queue"
            >
              <X className="size-3" />
            </button>
          </div>

          {item.status === 'running' && (
            <span className="size-2 rounded-full bg-primary animate-pulse shrink-0" title="Running" />
          )}
          {item.status === 'done' && (
            <span className="size-2 rounded-full bg-green-500 shrink-0" title="Done" />
          )}
          {item.status === 'error' && (
            <span className="size-2 rounded-full bg-destructive shrink-0" title="Error" />
          )}
        </div>
      ))}
    </div>
  )
}
