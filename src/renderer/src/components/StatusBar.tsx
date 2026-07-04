import React, { useEffect, useState } from 'react'
import { History, FolderOpen, Cpu } from 'lucide-react'
import { Checkpoint } from '@/types'
import { cn } from '@/lib/utils'

const el = window.electron

interface StatusBarProps {
  workspacePath: string | null
  currentModel: string
  sessionCount: number
  className?: string
}

export function StatusBar({ workspacePath, currentModel, sessionCount, className }: StatusBarProps): React.ReactElement {
  const [cpCount, setCpCount] = useState(0)

  useEffect(() => {
    if (!workspacePath) { setCpCount(0); return }
    const poll = () => {
      el.checkpoint.list(workspacePath).then((list: Checkpoint[]) => setCpCount(list.length)).catch(() => setCpCount(0))
    }
    poll()
    const id = setInterval(poll, 15_000)
    return () => clearInterval(id)
  }, [workspacePath])

  return (
    <div className={cn('flex h-6 shrink-0 items-center gap-3 border-t border-border bg-card/80 px-3 text-[10px] text-muted-foreground', className)}>
      {workspacePath ? (
        <span className="flex items-center gap-1 truncate max-w-[300px]" title={workspacePath}>
          <FolderOpen className="size-3 shrink-0" />
          <span className="truncate">{workspacePath}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <FolderOpen className="size-3 shrink-0" />
          No folder open
        </span>
      )}

      {currentModel && (
        <span className="flex items-center gap-1 shrink-0">
          <Cpu className="size-3" />
          {currentModel}
        </span>
      )}

      <div className="flex-1" />

      {cpCount > 0 && (
        <span className="flex items-center gap-1 shrink-0" title={`${cpCount} checkpoint${cpCount !== 1 ? 's' : ''}`}>
          <History className="size-3" />
          {cpCount}
        </span>
      )}

      <span className="shrink-0">
        {sessionCount} session{sessionCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
