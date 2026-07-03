import React, { useState } from 'react'
import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import { cn, timeAgo, truncate } from '@/lib/utils'
import { Session, FileNode, ActivityView } from '@/types'
import { Button } from '@/components/ui/button'
import { FileTree } from './FileTree'

interface SidebarProps {
  mode: ActivityView
  // sessions
  sessions: Session[]
  activeSessionId: string | null
  onNewSession: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  // explorer
  fileNodes: FileNode[]
  workspacePath: string | null
  onOpenFile: (node: FileNode) => void
  onOpenFolder: () => void
}

export function Sidebar({
  mode,
  sessions, activeSessionId, onNewSession, onSelectSession, onDeleteSession,
  fileNodes, workspacePath, onOpenFile, onOpenFolder
}: SidebarProps): React.ReactElement {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      {mode === 'chat'
        ? <SessionsPane
            sessions={sessions}
            activeSessionId={activeSessionId}
            onNew={onNewSession}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
          />
        : <FileTree
            nodes={fileNodes}
            workspacePath={workspacePath}
            onOpenFile={onOpenFile}
            onOpenFolder={onOpenFolder}
          />
      }
    </aside>
  )
}

// ── Sessions pane ─────────────────────────────────────────────────────────────

function SessionsPane({
  sessions, activeSessionId, onNew, onSelect, onDelete
}: {
  sessions: Session[]
  activeSessionId: string | null
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}): React.ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
        <button
          onClick={onNew}
          title="New session (⌘N)"
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5 overflow-y-auto px-2 py-1 flex-1">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <MessageSquare className="size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No sessions yet</p>
            <button
              onClick={onNew}
              className="text-xs text-primary hover:underline"
            >
              Start one
            </button>
          </div>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              'group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
              activeSessionId === s.id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <MessageSquare className="mt-0.5 size-3.5 shrink-0 opacity-60" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium leading-snug">{truncate(s.title, 32)}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                {timeAgo(s.updatedAt)} · {s.messageCount ?? 0} msg
              </p>
            </div>
            {(hoveredId === s.id || activeSessionId === s.id) && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                aria-label="Delete session"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </button>
        ))}
      </div>
    </>
  )
}
