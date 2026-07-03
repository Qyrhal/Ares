import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, RefreshCw, RotateCcw, AlertCircle } from 'lucide-react'
import {
  GitBranchIcon, PlusIcon, MinusIcon,
  ChevronDownIcon, ChevronRightIcon, GitCommitHorizontalIcon,
  GitMergeIcon, CheckIcon, XIcon
} from '@animateicons/react/lucide'
import { cn } from '@/lib/utils'
import { GitFile, GitStatus, GitBranches, GitCommit } from '@/types'
import { Button } from '@/components/ui/button'
import { GitHistory } from '@/components/GitHistory'
import { useAppStore } from '@/store/useAppStore'

const el = window.electron

interface GitPaneProps {
  workspacePath: string | null
}

type OpState = 'idle' | 'loading' | 'error'

const STATUS_LABEL: Record<string, string> = {
  M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed',
  C: 'Copied', U: 'Unmerged', '?': 'Untracked', '!': 'Ignored'
}

const STATUS_COLOR: Record<string, string> = {
  M: 'text-amber-400', A: 'text-green-400', D: 'text-red-400',
  R: 'text-blue-400',  C: 'text-blue-400',  U: 'text-orange-400',
  '?': 'text-muted-foreground'
}

function statusChar(file: GitFile, area: 'staged' | 'unstaged'): string {
  const c = area === 'staged' ? file.index : file.working
  return c === ' ' ? '?' : c
}

// ── File Row ──────────────────────────────────────────────────────────────────

function FileRow({
  file, area, onAction, onDiscard, onOpenFile
}: {
  file: GitFile
  area: 'staged' | 'unstaged' | 'untracked'
  onAction: (f: GitFile) => void
  onDiscard?: (f: GitFile) => void
  onOpenFile?: (f: GitFile) => void
}): React.ReactElement {
  const char = area === 'staged' ? file.index : (file.working === ' ' ? '?' : file.working)
  const color = STATUS_COLOR[char] ?? 'text-muted-foreground'
  const name = file.path.split('/').pop() ?? file.path
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''

  return (
    <div className="group flex items-center gap-1 rounded-sm px-2 py-[2px] hover:bg-accent/40 text-xs">
      <span className={cn('w-3.5 shrink-0 font-mono font-bold', color)} title={STATUS_LABEL[char]}>
        {char}
      </span>
      <span
        className="flex-1 truncate text-foreground/90 cursor-pointer hover:text-primary transition-colors"
        title={file.path}
        onClick={() => onOpenFile?.(file)}
      >
        {name}
        {dir && <span className="ml-1 text-muted-foreground/50">{dir}</span>}
      </span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {onDiscard && (
          <button
            onClick={() => onDiscard(file)}
            title="Discard changes"
            className="flex size-5 items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
        <button
          onClick={() => onAction(file)}
          title={area === 'staged' ? 'Unstage' : 'Stage'}
          className="flex size-5 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        >
          {area === 'staged' ? <MinusIcon className="size-3" /> : <PlusIcon className="size-3" />}
        </button>
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title, count, expanded, onToggle, onBulkAction, bulkLabel, children
}: {
  title: string
  count: number
  expanded: boolean
  onToggle: () => void
  onBulkAction?: () => void
  bulkLabel?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground select-none"
        onClick={onToggle}
      >
        {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        <span className="flex-1">{title}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{count}</span>
        {onBulkAction && count > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onBulkAction() }}
            title={bulkLabel}
            className="ml-1 rounded hover:bg-accent p-0.5"
          >
            {bulkLabel === 'Stage all' ? <PlusIcon className="size-3" /> : <MinusIcon className="size-3" />}
          </button>
        )}
      </div>
      {expanded && <div>{children}</div>}
    </div>
  )
}

// ── Branch picker ─────────────────────────────────────────────────────────────

function BranchPicker({
  current, branches, onCheckout, onCreateBranch, disabled
}: {
  current: string
  branches: string[]
  onCheckout: (b: string) => void
  onCreateBranch: (b: string) => void
  disabled: boolean
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleCreate = (): void => {
    const name = newName.trim()
    if (!name) return
    onCreateBranch(name)
    setNewName('')
    setCreating(false)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors max-w-full',
          disabled ? 'opacity-40 cursor-default' : 'hover:bg-accent cursor-pointer'
        )}
      >
        <GitBranchIcon className="size-3 shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground">{current || '—'}</span>
        {!disabled && <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-popover shadow-xl">
          <div className="max-h-48 overflow-y-auto py-1">
            {branches.map((b) => (
              <button
                key={b}
                onClick={() => { if (b !== current) onCheckout(b); setOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent',
                  b === current ? 'text-primary' : 'text-foreground'
                )}
              >
                {b === current && <CheckIcon className="size-3" />}
                {b !== current && <span className="w-3" />}
                {b}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2">
            {creating ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
                  placeholder="branch-name"
                  className="flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
                <button onClick={handleCreate} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                  <CheckIcon className="size-3" />
                </button>
                <button onClick={() => setCreating(false)} className="rounded px-1 text-muted-foreground hover:text-foreground">
                  <XIcon className="size-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <PlusIcon className="size-3" /> Create branch…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Resize Handle ────────────────────────────────────────────────────────────

function ResizeHandle({ onResize }: { onResize: (dy: number) => void }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startY = 0
    let dragging = false

    const onMouseDown = (e: MouseEvent) => {
      dragging = true
      startY = e.clientY
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      onResize(e.clientY - startY)
      startY = e.clientY
    }
    const onMouseUp = () => {
      dragging = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    el.addEventListener('mousedown', onMouseDown)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onResize])

  return (
    <div
      ref={ref}
      className="h-[3px] shrink-0 cursor-row-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function GitPane({ workspacePath }: GitPaneProps): React.ReactElement {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<GitBranches>({ local: [], current: '' })
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [opState, setOpState] = useState<OpState>('idle')
  const [opError, setOpError] = useState('')
  const [opLabel, setOpLabel] = useState('')
  const [stagedOpen, setStagedOpen] = useState(true)
  const [changesOpen, setChangesOpen] = useState(true)
  const [untrackedOpen, setUntrackedOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [historyHeight, setHistoryHeight] = useState(200)
  const handleResizeHistory = useCallback((dy: number) => {
    setHistoryHeight((prev) => Math.max(80, Math.min(600, prev - dy)))
  }, [])

  const setActiveCommit = useAppStore((s) => s.setActiveCommit)
  const activeCommit = useAppStore((s) => s.activeCommit)
  const setStoreCommits = useAppStore((s) => s.setCommits)
  const openFileTab = useAppStore((s) => s.openFileTab)
  const setActiveView = useAppStore((s) => s.setActiveView)

  const handleOpenFile = useCallback((f: GitFile) => {
    if (!workspacePath) return
    const absPath = workspacePath + '/' + f.path
    const name = f.path.split('/').pop() ?? f.path
    openFileTab({ name, path: absPath, type: 'file' })
    setActiveView('explorer')
  }, [workspacePath, openFileTab, setActiveView])

  const refresh = useCallback(async (cwd: string) => {
    const [s, b, log] = await Promise.all([
      el.git.status(cwd),
      el.git.branches(cwd).catch(() => ({ local: [], current: '' })),
      el.git.log(cwd, 50).catch(() => []),
    ])
    setStatus(s)
    setBranches(b)
    setCommits(log)
    setStoreCommits(log)
  }, [setStoreCommits])

  useEffect(() => {
    if (workspacePath) refresh(workspacePath)
  }, [workspacePath, refresh])

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    if (!workspacePath) return
    setOpState('loading'); setOpLabel(label); setOpError('')
    try {
      await fn()
      await refresh(workspacePath)
      setOpState('idle')
    } catch (e) {
      setOpState('error')
      setOpError((e as Error).message)
    }
  }, [workspacePath, refresh])

  // ── Render: no workspace ───────────────────────────────────────────────────
  if (!workspacePath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <GitBranchIcon className="size-10 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Open a folder to use source control.</p>
      </div>
    )
  }

  // ── Render: not a git repo ─────────────────────────────────────────────────
  if (status && !status.hasRepo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <GitBranchIcon className="size-10 text-muted-foreground/30" />
        <div>
          <p className="text-xs font-medium text-foreground">Not a git repository</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Initialize to start tracking changes.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run('git init', () => el.git.init(workspacePath))}
          disabled={opState === 'loading'}
        >
          {opState === 'loading' ? <Loader2 className="size-3 animate-spin" /> : <GitMergeIcon className="size-3" />}
          Initialize repository
        </Button>
      </div>
    )
  }

  const totalChanges = (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0)

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-xs">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Source Control
          {totalChanges > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-primary">{totalChanges}</span>
          )}
        </span>
        <button
          onClick={() => refresh(workspacePath)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('size-3.5', opState === 'loading' && opLabel === 'refresh' && 'animate-spin')} />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Upper area — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Branch row */}
          <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
            <BranchPicker
              current={status?.branch ?? branches.current}
              branches={branches.local}
              disabled={!status?.hasRepo}
              onCheckout={(b) => run(`checkout ${b}`, () => el.git.checkout(workspacePath, b))}
              onCreateBranch={(b) => run(`create ${b}`, () => el.git.createBranch(workspacePath, b))}
            />
            <div className="flex items-center gap-0.5 shrink-0">
              {(status?.behind ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <ArrowDown className="size-3" />{status!.behind}
                </span>
              )}
              {(status?.ahead ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <ArrowUp className="size-3" />{status!.ahead}
                </span>
              )}
              <button
                onClick={() => run('pull', () => el.git.pull(workspacePath))}
                title="Pull"
                disabled={opState === 'loading'}
                className="ml-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                onClick={() => run('push', () => el.git.push(workspacePath))}
                title="Push"
                disabled={opState === 'loading'}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <ArrowUp className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Op feedback */}
          {opState === 'loading' && (
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{opLabel}…</span>
            </div>
          )}
          {opState === 'error' && (
            <div
              className="flex items-start gap-2 border-b border-border bg-destructive/10 px-3 py-1.5 cursor-pointer"
              onClick={() => setOpState('idle')}
            >
              <AlertCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
              <span className="text-xs text-destructive leading-snug">{opError}</span>
            </div>
          )}

          {/* Commit box */}
          <div className="border-b border-border p-2 space-y-2">
            <textarea
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit message (type(scope): desc)…"
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  if (!commitMsg.trim()) return
                  run('commit', async () => {
                    if ((status?.staged.length ?? 0) === 0) await el.git.stageAll(workspacePath)
                    await el.git.commit(workspacePath, commitMsg)
                    setCommitMsg('')
                  })
                }}
                disabled={!commitMsg.trim() || opState === 'loading'}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GitCommitHorizontalIcon className="size-3.5" />
                {(status?.staged.length ?? 0) > 0 ? 'Commit staged' : 'Commit all'}
              </button>
            </div>
          </div>

          {/* Staged */}
          {(status?.staged.length ?? 0) > 0 && (
            <Section
              title="Staged"
              count={status!.staged.length}
              expanded={stagedOpen}
              onToggle={() => setStagedOpen((v) => !v)}
              onBulkAction={() => run('unstage all', () => el.git.unstageAll(workspacePath))}
              bulkLabel="Unstage all"
            >
              {status!.staged.map((f) => (
                <FileRow
                  key={`staged-${f.path}`}
                  file={f}
                  area="staged"
                  onAction={(f) => run(`unstage ${f.path}`, () => el.git.unstageFile(workspacePath, f.path))}
                  onOpenFile={handleOpenFile}
                />
              ))}
            </Section>
          )}

          {/* Unstaged changes */}
          {(status?.unstaged.length ?? 0) > 0 && (
            <Section
              title="Changes"
              count={status!.unstaged.length}
              expanded={changesOpen}
              onToggle={() => setChangesOpen((v) => !v)}
              onBulkAction={() => run('stage all changes', () => el.git.stageAll(workspacePath))}
              bulkLabel="Stage all"
            >
              {status!.unstaged.map((f) => (
                <FileRow
                  key={`unstaged-${f.path}`}
                  file={f}
                  area="unstaged"
                  onAction={(f) => run(`stage ${f.path}`, () => el.git.stageFile(workspacePath, f.path))}
                  onDiscard={(f) => run(`discard ${f.path}`, () => el.git.discardFile(workspacePath, f.path))}
                  onOpenFile={handleOpenFile}
                />
              ))}
            </Section>
          )}

          {/* Untracked */}
          {(status?.untracked.length ?? 0) > 0 && (
            <Section
              title="Untracked"
              count={status!.untracked.length}
              expanded={untrackedOpen}
              onToggle={() => setUntrackedOpen((v) => !v)}
              onBulkAction={() => run('stage all', () => el.git.stageAll(workspacePath))}
              bulkLabel="Stage all"
            >
              {status!.untracked.map((f) => (
                <FileRow
                  key={`untracked-${f.path}`}
                  file={f}
                  area="untracked"
                  onAction={(f) => run(`stage ${f.path}`, () => el.git.stageFile(workspacePath, f.path))}
                  onOpenFile={handleOpenFile}
                />
              ))}
            </Section>
          )}

          {/* Empty state */}
          {status?.hasRepo && totalChanges === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <CheckIcon className="size-6 text-green-500/60" />
              <p className="text-xs text-muted-foreground">No changes</p>
            </div>
          )}
        </div>

        {/* History — resizable bottom pane */}
        {status?.hasRepo && (
          <>
            <ResizeHandle onResize={handleResizeHistory} />
            <div className="border-t border-border shrink-0" />
            <Section
              title="History"
              count={commits.length}
              expanded={historyOpen}
              onToggle={() => setHistoryOpen((v) => !v)}
            >
              <div className="overflow-y-auto" style={{ height: historyHeight }}>
                <GitHistory
                  commits={commits}
                  activeCommit={activeCommit}
                  onSelectCommit={(hash) => setActiveCommit(hash === activeCommit ? null : hash)}
                />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
