import React, { useState } from 'react'
import { MessageSquare, Pin } from 'lucide-react'
import { Trash2Icon } from '@animateicons/react/lucide'
import { cn, timeAgo, truncate } from '@/lib/utils'
import { Session, FileNode, ActivityView } from '@/types'
import { FileTree, FileTreeProps } from './FileTree'
import { GitPane } from './GitPane'
import { ErrorBoundary } from './ErrorBoundary'

interface SidebarProps {
  mode: ActivityView
  // sessions
  sessions: Session[]
  activeSessionId: string | null
  onNewSession: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onTogglePinSession: (id: string) => void
  // explorer
  fileNodes: FileNode[]
  workspacePath: string | null
  selectedFilePath?: string
  onOpenFile: (node: FileNode) => void
  onOpenFolder: () => void
  onFsCreateFile: FileTreeProps['onCreateFile']
  onFsCreateFolder: FileTreeProps['onCreateFolder']
  onFsRename: FileTreeProps['onRename']
  onFsDelete: FileTreeProps['onDelete']
}

export function Sidebar({
  mode,
  sessions, activeSessionId, onNewSession, onSelectSession, onDeleteSession, onTogglePinSession,
  fileNodes, workspacePath, selectedFilePath, onOpenFile, onOpenFolder,
  onFsCreateFile, onFsCreateFolder, onFsRename, onFsDelete,
}: SidebarProps): React.ReactElement {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      {mode === 'chat' && (
        <SessionsPane
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNew={onNewSession}
          onSelect={onSelectSession}
          onDelete={onDeleteSession}
          onTogglePin={onTogglePinSession}
        />
      )}
      {mode === 'explorer' && (
        <FileTree
          nodes={fileNodes}
          workspacePath={workspacePath}
          selectedPath={selectedFilePath}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onCreateFile={onFsCreateFile}
          onCreateFolder={onFsCreateFolder}
          onRename={onFsRename}
          onDelete={onFsDelete}
        />
      )}
      {mode === 'git' && (
        <ErrorBoundary key="git-pane"><GitPane workspacePath={workspacePath} /></ErrorBoundary>
      )}
    </aside>
  )
}

// ── Sessions pane ─────────────────────────────────────────────────────────────

function SessionsPane({
  sessions, activeSessionId, onNew, onSelect, onDelete, onTogglePin
}: {
  sessions: Session[]
  activeSessionId: string | null
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
}): React.ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const pinned = sessions.filter((s) => s.pinned)
  const unpinned = sessions.filter((s) => !s.pinned)

  const renderSession = (s: Session) => (
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
        <div className="ml-auto flex shrink-0 self-center items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(s.id) }}
            className={cn(
              'rounded p-1 opacity-0 transition-opacity group-hover:opacity-100',
              s.pinned
                ? 'text-primary opacity-100 hover:bg-primary/10'
                : 'hover:bg-accent hover:text-foreground'
            )}
            aria-label={s.pinned ? 'Unpin session' : 'Pin session'}
          >
            <Pin className={cn('size-3', s.pinned && 'fill-current')} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
            className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
            aria-label="Delete session"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      )}
    </button>
  )

  return (
    <>
      <div className="flex h-9 shrink-0 items-center px-3 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
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

        {pinned.length > 0 && (
          <>
            <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Pinned
            </p>
            {pinned.map(renderSession)}
            {unpinned.length > 0 && (
              <div className="my-1 border-t border-border" />
            )}
          </>
        )}

        {unpinned.map(renderSession)}
      </div>
    </>
  )
}
