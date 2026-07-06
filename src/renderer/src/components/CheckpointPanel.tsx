import React, { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Checkpoint } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { RotateCcw, History, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Play, Undo2 } from '@/lib/icons'

const el = window.electron

/**
 * Checkpoints Panel — git stash-backed undo/redo (inspired by Claude Code Desktop).
 *
 * The AI automatically creates a checkpoint before every tool operation.
 * Users can view, diff, restore, or delete checkpoints from this panel.
 */

interface CheckpointPanelProps {
  workspacePath: string | null
}

type OpState = 'idle' | 'loading' | 'error'

export function CheckpointPanel({ workspacePath }: CheckpointPanelProps): React.ReactElement {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [diffContent, setDiffContent] = useState<string>('')
  const [opState, setOpState] = useState<OpState>('idle')
  const [opMessage, setOpMessage] = useState('')
  const [autoCheckpoint, setAutoCheckpoint] = useState(true)

  const refresh = useCallback(async () => {
    if (!workspacePath) { setCheckpoints([]); return }
    const list = await el.checkpoint.list(workspacePath)
    setCheckpoints(list)
  }, [workspacePath])

  useEffect(() => { refresh() }, [refresh])

  const handleRestore = useCallback(async (idx: number) => {
    if (!workspacePath) return
    setOpState('loading')
    setOpMessage('Restoring checkpoint…')
    const result = await el.checkpoint.restore(workspacePath, idx)
    if (result.ok) {
      setOpState('idle')
      setOpMessage('')
      await refresh()
    } else {
      setOpState('error')
      setOpMessage(result.error || 'Failed to restore')
    }
  }, [workspacePath, refresh])

  const handleDrop = useCallback(async (idx: number) => {
    if (!workspacePath) return
    await el.checkpoint.drop(workspacePath, idx)
    await refresh()
  }, [workspacePath, refresh])

  const handleShowDiff = useCallback(async (idx: number) => {
    if (!workspacePath) return
    if (expandedIdx === idx) {
      setExpandedIdx(null)
      setDiffContent('')
      return
    }
    setExpandedIdx(idx)
    const diff = await el.checkpoint.diff(workspacePath, idx)
    setDiffContent(diff || 'No diff available')
  }, [workspacePath, expandedIdx])

  const handleCreateNow = useCallback(async () => {
    if (!workspacePath) return
    setOpState('loading')
    setOpMessage('Creating checkpoint…')
    const result = await el.checkpoint.create(workspacePath, `Manual checkpoint — ${new Date().toLocaleString()}`)
    setOpState('idle')
    setOpMessage(result ? 'Checkpoint created' : 'No changes to save')
    await refresh()
    setTimeout(() => setOpMessage(''), 2500)
  }, [workspacePath, refresh])

  if (!workspacePath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <History className="size-10 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Open a folder to use checkpoints.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Checkpoints
          {checkpoints.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-primary">{checkpoints.length}</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateNow}
            disabled={opState === 'loading'}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            title="Create checkpoint now"
          >
            <Play className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Auto-checkpoint toggle */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <label className="text-xs text-muted-foreground">Auto-checkpoint before tool ops</label>
        <button
          onClick={() => setAutoCheckpoint((v) => !v)}
          className={cn(
            'relative inline-flex h-4 w-7 shrink-0 rounded-full border border-border transition-colors',
            autoCheckpoint ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span className={cn(
            'inline-block size-3 rounded-full bg-white shadow-sm transition-transform',
            autoCheckpoint ? 'translate-x-3.5' : 'translate-x-0.5'
          )} />
        </button>
      </div>

      {/* Op feedback */}
      {opState === 'loading' && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
          <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <span className="text-xs text-muted-foreground">{opMessage}</span>
        </div>
      )}
      {opMessage && opState === 'idle' && (
        <div className="flex items-center gap-2 border-b border-border bg-green-500/10 px-3 py-1.5">
          <CheckCircle2 className="size-3 text-green-400" />
          <span className="text-xs text-green-400">{opMessage}</span>
        </div>
      )}
      {opState === 'error' && (
        <div className="flex items-start gap-2 border-b border-border bg-destructive/10 px-3 py-1.5">
          <AlertCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
          <span className="text-xs text-destructive">{opMessage}</span>
        </div>
      )}

      {/* Checkpoint list */}
      <div className="flex-1 overflow-y-auto">
        {checkpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <History className="size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground max-w-[200px]">
              No checkpoints yet. Checkpoints are created automatically before AI tool operations.
            </p>
          </div>
        ) : (
          <div className="py-1">
            {checkpoints.map((cp) => (
              <div key={cp.id}>
                <div
                  className="group flex items-center gap-2 rounded-sm px-3 py-2 hover:bg-accent/40 cursor-pointer"
                  onClick={() => handleShowDiff(cp.index)}
                >
                  <History className="size-3.5 shrink-0 text-muted-foreground/60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {cp.message.replace(/^ares:/, '')}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      stash@{cp.index} · {cp.branch}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore(cp.index) }}
                      title="Restore checkpoint"
                      className="flex size-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    >
                      <Undo2 className="size-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDrop(cp.index) }}
                      title="Delete checkpoint"
                      className="flex size-6 items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  </div>
                </div>
                {expandedIdx === cp.index && diffContent && (
                  <div className="border-t border-border bg-muted/10 px-4 py-2">
                    <pre className="max-h-48 overflow-auto text-[10px] text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
                      {diffContent.slice(0, 2000)}
                      {diffContent.length > 2000 ? '\n\n… (diff truncated)' : ''}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
