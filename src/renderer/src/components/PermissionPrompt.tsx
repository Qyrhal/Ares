import React from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, X, Zap } from '@/lib/icons'

interface PermissionPromptProps {
  toolName: string
  toolArgs: string
  onApprove: () => void
  onDeny: () => void
}

export function PermissionPrompt({ toolName, toolArgs, onApprove, onDeny }: PermissionPromptProps): React.ReactElement {
  let argsDisplay: string
  try {
    const parsed = JSON.parse(toolArgs)
    argsDisplay = Object.entries(parsed)
      .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 80)}`)
      .join(', ')
  } catch {
    argsDisplay = toolArgs.slice(0, 100)
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 mx-4 mb-2">
      <AlertTriangle className="size-4 shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-amber-300">Allow {toolName}?</span>
        <p className="text-[11px] text-amber-200/70 truncate">{argsDisplay}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onApprove}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
          )}
        >
          <Check className="size-3" /> Approve
        </button>
        <button
          type="button"
          onClick={onDeny}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            'bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive'
          )}
        >
          <X className="size-3" /> Deny
        </button>
      </div>
    </div>
  )
}
