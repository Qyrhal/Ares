import React, { Fragment, useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { XIcon, GitCommitHorizontalIcon } from '@/lib/icons'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function CommitDetail(): React.ReactElement | null {
  const activeCommit = useAppStore((s) => s.activeCommit)
  const commits = useAppStore((s) => s.commits)
  const setActiveCommit = useAppStore((s) => s.setActiveCommit)

  const commit = useMemo(
    () => commits.find((c) => c.hash === activeCommit),
    [commits, activeCommit]
  )

  if (!commit) return null

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitCommitHorizontalIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium text-foreground">
            {commit.message}
          </span>
        </div>
        <button
          onClick={() => setActiveCommit(null)}
          className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Commit:</span>{' '}
          <code className="font-mono text-primary">{commit.shortHash}</code>
        </span>
        <span><span className="font-medium text-foreground">Author:</span> {commit.author}</span>
        <span><span className="font-medium text-foreground">Date:</span> {formatDate(commit.date)}</span>
        {commit.parents.length > 0 && (
          <span>
            <span className="font-medium text-foreground">Parents:</span>{' '}
            {commit.parents.map((p, i) => (
              <Fragment key={p}>
                {i > 0 && <span>, </span>}
                <code className="font-mono">{p.slice(0, 7)}</code>
              </Fragment>
            ))}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
          {commit.message}
        </p>
      </div>
    </div>
  )
}
