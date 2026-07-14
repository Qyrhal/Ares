import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  content: string
}

interface AgentDiffViewProps {
  diff: string
  filePath?: string
  language?: string
}

/**
 * Parses a unified-diff string into structured lines.
 * Handles standard git diff format, including hunk headers (@@ ... @@).
 */
function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = []
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lines.push({ type: 'add', content: line.slice(1) })
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      lines.push({ type: 'del', content: line.slice(1) })
    } else if (line.startsWith('@@')) {
      // Hunk header — treat as context
      lines.push({ type: 'ctx', content: line })
    } else {
      lines.push({ type: 'ctx', content: line })
    }
  }
  return lines
}

export function AgentDiffView({ diff, filePath, language }: AgentDiffViewProps): React.ReactElement | null {
  const [collapsed, setCollapsed] = useState(false)

  if (!diff || !diff.trim()) return null

  const lines = parseDiff(diff)
  const addCount = lines.filter((l) => l.type === 'add').length
  const delCount = lines.filter((l) => l.type === 'del').length

  // Show nothing if there are no meaningful changes (only context/whitespace lines)
  const meaningfulLines = lines.filter((l) => l.type === 'add' || l.type === 'del')
  if (lines.length === 0 || meaningfulLines.length === 0) return null

  return (
    <div className="my-1.5 rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 bg-muted/30 px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {collapsed ? <ChevronRight className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
        <FileCode className="size-3 shrink-0" />
        <span className="truncate">{filePath ?? 'Changes'}</span>
        <span className="ml-auto flex items-center gap-2 text-[10px] tabular-nums">
          <span className="text-green-500">+{addCount}</span>
          <span className="text-red-500">-{delCount}</span>
        </span>
      </button>

      {/* Diff content */}
      {!collapsed && (
        <pre className="overflow-x-auto p-0 text-[11px] leading-[1.5]">
          <code>
            {lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'px-3 py-px font-mono whitespace-pre',
                  line.type === 'add' && 'bg-green-500/10 text-green-400',
                  line.type === 'del' && 'bg-red-500/10 text-red-400',
                  line.type === 'ctx' && 'text-muted-foreground'
                )}
              >
                {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                {line.content}
              </div>
            ))}
          </code>
        </pre>
      )}
    </div>
  )
}
