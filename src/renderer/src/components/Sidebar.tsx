import React, { useState, useCallback } from 'react'
import { MessageSquare, Pin, Download, Upload, Search, X, Bot, Loader2 } from 'lucide-react'
import { Trash2Icon } from '@animateicons/react/lucide'
import { cn, timeAgo, truncate } from '@/lib/utils'
import { Session, FileNode, ActivityView } from '@/types'
import { FileTree, FileTreeProps } from './FileTree'
import { GitPane } from './GitPane'
import { ErrorBoundary } from './ErrorBoundary'
import { toast } from 'sonner'

const el = window.electron

interface SidebarProps {
  onRenameSession?: (id: string, title: string) => void
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
    <aside className="surface-card flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
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

  const handleExport = useCallback(async () => {
    const active = sessions.find((s) => s.id === activeSessionId)
    if (!active) { toast.error('No active session to export'); return }
    const msgs = await el.db.getMessages(active.id)
    const result = await el.session.export(active.title, active.id, msgs)
    if (result) toast.success(`Session exported to ${result}`)
  }, [sessions, activeSessionId])

  const handleImport = useCallback(async () => {
    const result = await el.session.import()
    if (!result) return
    if ('error' in result) { toast.error(result.error as string); return }
    // Create a new session with imported messages
    const raw = await el.db.createSession((result as { title: string }).title)
    const msgs = (result as { messages: unknown[] }).messages as Array<{ role: string; content: string; toolName?: string; toolInput?: string; toolOutput?: string; thinking?: string; createdAt: number }>
    for (const m of msgs) {
      await el.db.addMessage(raw.id, m.role, m.content, {
        toolName: m.toolName,
        toolInput: m.toolInput,
        toolOutput: m.toolOutput,
        thinking: m.thinking,
      })
    }
    toast.success(`Imported session "${(result as { title: string }).title}"`)
    // Force reload
    const freshSessions = await el.db.getSessions()
    // The parent should refresh — signal via location reload for simplicity
    window.location.reload()
  }, [])

  // Orders sessions so each parent is immediately followed by its own
  // children in spawn order, instead of the flat store order (which
  // prepends new sessions and scatters children above/below parents).
  const orderWithChildren = (list: Session[]): Session[] => {
    const childrenOf = new Map<string, Session[]>()
    const roots: Session[] = []
    for (const s of list) {
      if (s.parentId && list.some((p) => p.id === s.parentId)) {
        const arr = childrenOf.get(s.parentId) ?? []
        arr.push(s)
        childrenOf.set(s.parentId, arr)
      } else {
        roots.push(s)
      }
    }
    for (const arr of childrenOf.values()) arr.sort((a, b) => a.createdAt - b.createdAt)
    return roots.flatMap((root) => [root, ...(childrenOf.get(root.id) ?? [])])
  }

  const pinned = orderWithChildren(sessions.filter((s) => s.pinned))
  const unpinned = orderWithChildren(sessions.filter((s) => !s.pinned))

  const renderSession = (s: Session) => {
    const isSubAgent = !!s.parentId
    return (
    <button
      key={s.id}
      onClick={() => onSelect(s.id)}
      onMouseEnter={() => setHoveredId(s.id)}
      onMouseLeave={() => setHoveredId(null)}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-all',
        isSubAgent ? 'pl-5' : 'pl-2',
        activeSessionId === s.id
          ? 'bg-accent text-foreground shadow-xs'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      {isSubAgent ? (
        <Bot className={cn('size-3 shrink-0', s.agentStatus === 'running' ? 'text-primary' : s.agentStatus === 'done' ? 'text-green-500' : 'opacity-60')} />
      ) : (
        <MessageSquare className="size-3 shrink-0 opacity-60" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-snug">
          {truncate(s.title, isSubAgent ? 26 : 32)}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-muted-foreground/60 whitespace-nowrap">
          {s.agentStatus === 'running' && (
            <span className="inline-flex items-center gap-0.5 text-primary">
              <Loader2 className="size-2.5 animate-spin" /> running
            </span>
          )}
          {s.agentStatus === 'done' && <span className="text-green-500">done</span>}
          {s.agentStatus === 'error' && <span className="text-destructive">error</span>}
          <span className="truncate">{timeAgo(s.updatedAt)} · {s.messageCount ?? 0} msg</span>
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
  )}

  return (
    <>
      <div className="flex h-9 shrink-0 items-center px-3 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={handleImport}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Import session"
          >
            <Download className="size-3.5" />
          </button>
          <button
            onClick={handleExport}
            disabled={!activeSessionId}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
            title="Export active session"
          >
            <Upload className="size-3.5" />
          </button>
        </div>
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
