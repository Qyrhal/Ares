import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, FolderOpen, FolderIcon } from '@/lib/icons'

interface ProjectPickerProps {
  workspacePath: string | null
  recentProjects: string[]
  onSelectPath: (path: string) => void
  onOpenFinder: () => void
}

function shortPath(p: string): string {
  const parts = p.split('/').filter(Boolean)
  return parts.slice(-2).join('/')
}

export function ProjectPicker({
  workspacePath,
  recentProjects,
  onSelectPath,
  onOpenFinder,
}: ProjectPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const others = recentProjects.filter((p) => p !== workspacePath)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
          open
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
        )}
      >
        <FolderIcon className="size-3 shrink-0" />
        <span className="max-w-[160px] truncate">
          {workspacePath ? shortPath(workspacePath) : 'Select project'}
        </span>
        <ChevronDown className={cn('size-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg z-50">
          {workspacePath && (
            <div className="border-b border-border px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Current
              </p>
              <div className="flex items-center gap-1.5 text-xs text-foreground">
                <FolderOpen className="size-3 shrink-0 text-primary" />
                <span className="truncate" title={workspacePath}>{shortPath(workspacePath)}</span>
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div className="border-b border-border p-1">
              <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent
              </p>
              {others.map((p) => (
                <button
                  key={p}
                  onClick={() => { onSelectPath(p); setOpen(false) }}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <FolderIcon className="size-3 shrink-0" />
                  <span className="truncate" title={p}>{shortPath(p)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="p-1">
            <button
              onClick={() => { onOpenFinder(); setOpen(false) }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <FolderOpen className="size-3 shrink-0" />
              <span>Open folder…</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
