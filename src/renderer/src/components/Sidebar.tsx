import React, { Suspense, useState, useCallback, useRef, useEffect } from 'react'
import { cn, timeAgo, truncate } from '@/lib/utils'
import { Session, SessionGroup, FileNode, ActivityView } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { FileTree, FileTreeProps } from './FileTree'
const GitPane = React.lazy(() => import('./GitPane').then(m => ({ default: m.GitPane })))
import { ErrorBoundary } from './ErrorBoundary'
import { AgentTimeline } from './AgentTimeline'
import { toast } from 'sonner'
import { MessageSquare, Pin, Download, Upload, Search, X, Trash2Icon } from '@/lib/icons'

const el = window.electron

interface SidebarProps {
  onRenameSession?: (id: string, title: string) => void
  onDuplicateSession?: (session: Session) => void
  onExportSession?: (session: Session) => void
  onArchiveSession?: (id: string) => void
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
  onRenameSession, onDuplicateSession, onExportSession, onArchiveSession,
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
          onRename={onRenameSession}
          onDuplicate={onDuplicateSession}
          onExport={onExportSession}
          onArchive={onArchiveSession}
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
        <ErrorBoundary key="git-pane">
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-muted-foreground text-xs animate-pulse">Loading…</div>}>
            <GitPane workspacePath={workspacePath} />
          </Suspense>
        </ErrorBoundary>
      )}
    </aside>
  )
}

// ── Sessions pane ─────────────────────────────────────────────────────────────

function SessionsPane({
  sessions, activeSessionId, onNew, onSelect, onDelete, onTogglePin,
  onRename, onDuplicate, onExport, onArchive
}: {
  sessions: Session[]
  activeSessionId: string | null
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  onRename?: (id: string, title: string) => void
  onDuplicate?: (session: Session) => void
  onExport?: (session: Session) => void
  onArchive?: (id: string) => void
}): React.ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')
  const [contextMenu, setContextMenu] = useState<{ session: Session; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [showArchived, setShowArchived] = useState(false)

  // ── Session group state ────────────────────────────────────────────────────
  const sessionGroups = useAppStore((s) => s.sessionGroups)
  const addSessionGroup = useAppStore((s) => s.addSessionGroup)
  const renameSessionGroup = useAppStore((s) => s.renameSessionGroup)
  const removeSessionGroup = useAppStore((s) => s.removeSessionGroup)
  const setSessionGroup = useAppStore((s) => s.setSessionGroup)

  const [groupContextMenu, setGroupContextMenu] = useState<{ group: SessionGroup; x: number; y: number } | null>(null)
  const [moveToGroupSession, setMoveToGroupSession] = useState<Session | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [groupRenamingId, setGroupRenamingId] = useState<string | null>(null)
  const [groupRenameValue, setGroupRenameValue] = useState('')
  const groupRenameInputRef = useRef<HTMLInputElement>(null)

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

  const handleStartRename = useCallback((session: Session) => {
    setRenamingId(session.id)
    setRenameValue(session.title)
    setContextMenu(null)
    setTimeout(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }, 50)
  }, [])

  const handleFinishRename = useCallback(() => {
    if (renamingId && renameValue.trim() && onRename) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, onRename])

  const handleContextMenuAction = useCallback((action: string, session: Session) => {
    setContextMenu(null)
    switch (action) {
      case 'rename':
        handleStartRename(session)
        break
      case 'duplicate':
        onDuplicate?.(session)
        break
      case 'export':
        onExport?.(session)
        break
      case 'pin':
        onTogglePin(session.id)
        break
      case 'delete':
        onDelete(session.id)
        break
      case 'archive':
        onArchive?.(session.id)
        break
    }
  }, [onDuplicate, onExport, onTogglePin, onDelete, handleStartRename])

  // ── Group action handlers ─────────────────────────────────────────────────
  const handleAddGroup = useCallback(() => {
    const name = prompt('Enter group name:')
    if (name && name.trim()) {
      addSessionGroup(name.trim())
    }
  }, [addSessionGroup])

  const handleGroupContextMenuAction = useCallback((action: string, group: SessionGroup) => {
    setGroupContextMenu(null)
    switch (action) {
      case 'rename':
        setGroupRenamingId(group.id)
        setGroupRenameValue(group.name)
        setTimeout(() => groupRenameInputRef.current?.focus(), 50)
        break
      case 'delete':
        removeSessionGroup(group.id)
        break
    }
  }, [removeSessionGroup])

  const handleFinishGroupRename = useCallback(() => {
    if (groupRenamingId && groupRenameValue.trim()) {
      renameSessionGroup(groupRenamingId, groupRenameValue.trim())
    }
    setGroupRenamingId(null)
    setGroupRenameValue('')
  }, [groupRenamingId, groupRenameValue, renameSessionGroup])

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const handleMoveToGroup = useCallback((groupId: string | null) => {
    if (moveToGroupSession) {
      setSessionGroup(moveToGroupSession.id, groupId)
      setMoveToGroupSession(null)
    }
  }, [moveToGroupSession, setSessionGroup])

  // Close context menu on click outside or Escape
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (): void => setContextMenu(null)
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    // Delay adding listener to avoid the same right-click event from closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleKey)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

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

  const renderSession = (s: Session) => {
    const isSubAgent = !!s.parentId
    const isRenaming = renamingId === s.id
    return (
    <button
      key={s.id}
      onClick={() => onSelect(s.id)}
      onMouseEnter={() => setHoveredId(s.id)}
      onMouseLeave={() => setHoveredId(null)}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ session: s, x: e.clientX, y: e.clientY })
      }}
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
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.stopPropagation(); handleFinishRename() }
              if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) }
            }}
            onBlur={handleFinishRename}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-xs font-medium outline-none border-b border-primary/40"
            autoFocus
          />
        ) : (
          <p className="truncate text-xs font-medium leading-snug">
            {truncate(s.title, isSubAgent ? 26 : 32)}
          </p>
        )}
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
            onClick={(e) => { e.stopPropagation(); onArchive?.(s.id) }}
            className={cn(
              'rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground',
              s.archived && 'opacity-100'
            )}
            aria-label={s.archived ? 'Unarchive session' : 'Archive session'}
          >
            <Archive className="size-3" />
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

  const pinned = orderWithChildren(sessions.filter((s) => s.pinned && !s.archived))
  const unpinned = sessions.filter((s) => !s.pinned)
  const visibleSessions = showArchived ? unpinned : unpinned.filter((s) => !s.archived)

  // Group unpinned sessions by their group field
  const groupedSessions = new Map<string, Session[]>()
  const ungrouped: Session[] = []
  for (const s of visibleSessions) {
    if (s.group && sessionGroups.some((g) => g.id === s.group)) {
      const arr = groupedSessions.get(s.group) ?? []
      arr.push(s)
      groupedSessions.set(s.group, arr)
    } else {
      ungrouped.push(s)
    }
  }
  // Apply parent-child ordering within each group and ungrouped
  for (const [id, arr] of groupedSessions) {
    groupedSessions.set(id, orderWithChildren(arr))
  }
  const orderedUngrouped = orderWithChildren(ungrouped)

  // Sort groups by createdAt
  const orderedGroups = [...sessionGroups].sort((a, b) => a.createdAt - b.createdAt)

  return (
    <>
      <div className="flex h-9 shrink-0 items-center px-3 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              'rounded p-1 transition-colors',
              showArchived
                ? 'text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title={showArchived ? 'Hide archived' : 'Show archived'}
          >
            <Archive className={cn('size-3.5', showArchived && 'fill-current')} />
          </button>
          <button
            onClick={handleAddGroup}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Add session group"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'timeline' : 'list')}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={viewMode === 'list' ? 'Timeline view' : 'List view'}
          >
            {viewMode === 'list' ? <Clock className="size-3.5" /> : <LayoutList className="size-3.5" />}
          </button>
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

      {viewMode === 'timeline' ? (
        <AgentTimeline
          sessions={sessions}
          sessionGroups={sessionGroups}
          activeSessionId={activeSessionId}
          onSelectSession={onSelect}
        />
      ) : (
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

        {/* ── Pinned section ─────────────────────────────────────────────── */}
        {pinned.length > 0 && (
          <>
            <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Pinned
            </p>
            {pinned.map(renderSession)}
            {(orderedGroups.length > 0 || orderedUngrouped.length > 0) && (
              <div className="my-1 border-t border-border" />
            )}
          </>
        )}

        {/* ── Group sections ─────────────────────────────────────────────── */}
        {orderedGroups.map((group) => {
          const groupSessions = groupedSessions.get(group.id) ?? []
          const isCollapsed = collapsedGroups.has(group.id)
          const isRenaming = groupRenamingId === group.id
          return (
            <div key={group.id} className="flex flex-col gap-0.5">
              <div
                className="group/header flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent/50 cursor-pointer select-none"
                onClick={() => toggleCollapse(group.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setGroupContextMenu({ group, x: e.clientX, y: e.clientY })
                }}
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3 shrink-0" />
                ) : (
                  <ChevronDown className="size-3 shrink-0" />
                )}
                <Folder className="size-3 shrink-0 text-muted-foreground/70" />
                {isRenaming ? (
                  <input
                    ref={groupRenameInputRef}
                    type="text"
                    value={groupRenameValue}
                    onChange={(e) => setGroupRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.stopPropagation(); handleFinishGroupRename() }
                      if (e.key === 'Escape') { e.stopPropagation(); setGroupRenamingId(null) }
                    }}
                    onBlur={handleFinishGroupRename}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-transparent text-xs font-medium outline-none border-b border-primary/40"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 truncate">{group.name}</span>
                )}
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/50">
                  {groupSessions.length}
                </span>
              </div>
              {!isCollapsed && groupSessions.map(renderSession)}
            </div>
          )
        })}

        {/* ── Ungrouped section ──────────────────────────────────────────── */}
        {orderedUngrouped.length > 0 && (
          <>
            {orderedGroups.length > 0 && (
              <div className="my-1 border-t border-border" />
            )}
            <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Ungrouped ({orderedUngrouped.length})
            </p>
            {orderedUngrouped.map(renderSession)}
          </>
        )}
      </div>
      )}

      {/* ── Session context menu ─────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-50 w-40 rounded-lg border border-border bg-card py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            label="Rename"
            icon="Edit3"
            onClick={() => handleContextMenuAction('rename', contextMenu.session)}
          />
          <ContextMenuItem
            label="Duplicate"
            icon="Copy"
            onClick={() => handleContextMenuAction('duplicate', contextMenu.session)}
          />
          <ContextMenuItem
            label="Export"
            icon="Download"
            onClick={() => handleContextMenuAction('export', contextMenu.session)}
          />
          <div className="mx-2 my-1 border-t border-border" />
          {sessionGroups.length > 0 && (
            <>
              <div className="relative">
                <button
                  onClick={() => setMoveToGroupSession(contextMenu.session)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent transition-colors"
                >
                  Move to group
                </button>
                {moveToGroupSession?.id === contextMenu.session.id && (
                  <div
                    className="absolute left-full top-0 z-50 w-36 rounded-lg border border-border bg-card py-1 shadow-xl ml-1"
                    onMouseLeave={() => setMoveToGroupSession(null)}
                  >
                    {sessionGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => handleMoveToGroup(g.id)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent transition-colors"
                      >
                        <Folder className="size-3" />
                        {g.name}
                      </button>
                    ))}
                    <div className="mx-2 my-1 border-t border-border" />
                    <button
                      onClick={() => handleMoveToGroup(null)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent transition-colors"
                    >
                      Ungrouped
                    </button>
                  </div>
                )}
              </div>
              <div className="mx-2 my-1 border-t border-border" />
            </>
          )}
          <ContextMenuItem
            label={contextMenu.session.pinned ? 'Unpin' : 'Pin'}
            icon="Pin"
            onClick={() => handleContextMenuAction('pin', contextMenu.session)}
          />
          <div className="mx-2 my-1 border-t border-border" />
          <ContextMenuItem
            label={contextMenu.session.archived ? 'Unarchive' : 'Archive'}
            icon="Archive"
            onClick={() => handleContextMenuAction('archive', contextMenu.session)}
          />
          <div className="mx-2 my-1 border-t border-border" />
          <ContextMenuItem
            label="Delete"
            icon="Trash2"
            destructive
            onClick={() => handleContextMenuAction('delete', contextMenu.session)}
          />
        </div>
      )}

      {/* ── Group context menu ───────────────────────────────────────────── */}
      {groupContextMenu && (
        <div
          className="fixed z-50 w-36 rounded-lg border border-border bg-card py-1 shadow-xl"
          style={{ left: groupContextMenu.x, top: groupContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            label="Rename"
            icon="Pencil"
            onClick={() => handleGroupContextMenuAction('rename', groupContextMenu.group)}
          />
          <div className="mx-2 my-1 border-t border-border" />
          <ContextMenuItem
            label="Delete"
            icon="Trash2"
            destructive
            onClick={() => handleGroupContextMenuAction('delete', groupContextMenu.group)}
          />
        </div>
      )}
    </>
  )
}

// ── Context menu item ──────────────────────────────────────────────────────────
function ContextMenuItem({
  label, icon, destructive, onClick
}: {
  label: string
  icon: string
  destructive?: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-accent'
      )}
    >
      {label}
    </button>
  )
}
