import React, { useMemo } from 'react'
import { GitCommit } from '@/types'
import { cn } from '@/lib/utils'
import { GitCommitHorizontalIcon } from '@/lib/icons'

const COL_WIDTH = 10
const ROW_HEIGHT = 18
const DOT_R = 2.5

interface GraphNode {
  commit: GitCommit
  column: number
  parentIndices: number[]
}

function buildGraph(commits: GitCommit[]): { nodes: GraphNode[]; maxColumn: number } {
  if (commits.length === 0) return { nodes: [], maxColumn: 0 }

  const commitIdx = new Map<string, number>()
  commits.forEach((c, i) => commitIdx.set(c.hash, i))

  const columns: number[] = []
  const laneOf = new Map<number, number>()

  for (let i = commits.length - 1; i >= 0; i--) {
    const c = commits[i]
    let col = -1
    for (let j = 0; j < columns.length; j++) {
      const tip = commits[columns[j]]
      if (tip && c.parents.includes(tip.hash)) { col = j; break }
    }
    if (col === -1) { col = columns.length; columns.push(-1) }
    columns[col] = i
    laneOf.set(i, col)
  }

  const nodes: GraphNode[] = commits.map((c, i) => ({
    commit: c,
    column: laneOf.get(i) ?? 0,
    parentIndices: c.parents
      .map((h) => commitIdx.get(h))
      .filter((idx): idx is number => idx !== undefined),
  }))

  return { nodes, maxColumn: Math.max(1, columns.length) }
}

interface GitHistoryProps {
  commits: GitCommit[]
  activeCommit: string | null
  onSelectCommit: (hash: string) => void
}

export function GitHistory({ commits, activeCommit, onSelectCommit }: GitHistoryProps): React.ReactElement {
  const { nodes, maxColumn } = useMemo(() => buildGraph(commits), [commits])

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <GitCommitHorizontalIcon className="size-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">No commits yet</p>
      </div>
    )
  }

  const graphWidth = maxColumn * COL_WIDTH + 4
  const totalHeight = commits.length * ROW_HEIGHT

  const mid = (col: number) => col * COL_WIDTH + COL_WIDTH / 2
  const yPos = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={graphWidth}
        height={totalHeight}
      >
        {nodes.map((node, i) => {
          const cy = yPos(i)
          const cx = mid(node.column)
          return node.parentIndices.map((pi) => {
            const parent = nodes[pi]
            if (!parent) return null
            const py = yPos(pi)
            const px = mid(parent.column)
            const key = `${node.commit.shortHash}-${pi}`
            if (node.column === parent.column) {
              return (
                <line
                  key={key}
                  x1={cx} y1={cy} x2={px} y2={py}
                  stroke="currentColor"
                  strokeWidth={1}
                  className="text-muted-foreground/25"
                />
              )
            }
            return (
              <polyline
                key={key}
                points={`${cx},${cy} ${px},${cy} ${px},${py}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                className="text-muted-foreground/25"
              />
            )
          })
        })}
        {nodes.map((node, i) => (
          <circle
            key={node.commit.hash}
            cx={mid(node.column)}
            cy={yPos(i)}
            r={DOT_R}
            className={cn(
              'stroke-background stroke-[2]',
              node.commit.parents.length > 1
                ? 'fill-primary'
                : node.commit.parents.length > 0
                  ? 'fill-muted-foreground'
                  : 'fill-muted-foreground/40'
            )}
          />
        ))}
      </svg>

      {nodes.map((node, i) => (
        <div
          key={node.commit.hash}
          title={node.commit.message}
          onClick={() => onSelectCommit(node.commit.hash)}
          className={cn(
            'flex cursor-pointer items-center gap-1 rounded-sm px-1 py-[1px] text-xs leading-tight hover:bg-accent/40',
            activeCommit === node.commit.hash && 'bg-accent/60'
          )}
          style={{ paddingLeft: graphWidth + 4 }}
        >
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70 w-[46px]">
            {node.commit.shortHash}
          </span>
          <span className="flex-1 truncate text-foreground/80">{node.commit.message}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatRelativeTime(node.commit.date)}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const date = new Date(isoDate).getTime()
  const diff = Math.max(0, now - date)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}
