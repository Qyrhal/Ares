import React, { useEffect, useState } from 'react'
import { History, FolderOpen, Cpu, Plug, PlugZap, Loader2 } from 'lucide-react'
import { Checkpoint } from '@/types'
import type { Message } from '@/types'
import { ContextUsageBadge } from './ContextUsageBadge'
import { ModelHoverCard } from './ModelHoverCard'
import { cn } from '@/lib/utils'

const el = window.electron

interface McpStatus {
  name: string
  connected: boolean
  error?: string
  toolCount: number
}

interface StatusBarProps {
  agentCount?: number
  contextRemaining?: number
  workspacePath: string | null
  currentModel: string
  sessionCount: number
  messages?: Message[]
  className?: string
}

export const StatusBar = React.memo(function StatusBar({ workspacePath, currentModel, sessionCount, messages, className }: StatusBarProps): React.ReactElement {
  const [cpCount, setCpCount] = useState(0)
  const [mcpStatus, setMcpStatus] = useState<McpStatus[]>([])
  const [mcpBgTools, setMcpBgTools] = useState<string[]>([])

  useEffect(() => {
    if (!workspacePath) { setCpCount(0); return }
    const poll = () => {
      el.checkpoint.list(workspacePath).then((list: Checkpoint[]) => setCpCount(list.length)).catch(() => setCpCount(0))
    }
    poll()
    const id = setInterval(poll, 15_000)
    return () => clearInterval(id)
  }, [workspacePath])

  useEffect(() => {
    const poll = () => {
      el.mcp.status().then(setMcpStatus).catch(() => setMcpStatus([]))
    }
    poll()
    const id = setInterval(poll, 10_000)
    return () => clearInterval(id)
  }, [])

  // Listen for MCP auto-background events
  useEffect(() => {
    const unsubStart = el.pi.onMcpAutoBackground((toolName) => {
      setMcpBgTools((prev) => prev.includes(toolName) ? prev : [...prev, toolName])
    })
    const unsubEnd = el.pi.onMcpToolBackgroundResult((toolName) => {
      setMcpBgTools((prev) => prev.filter((t) => t !== toolName))
    })
    return () => { unsubStart(); unsubEnd() }
  }, [])

  const mcpConnected = mcpStatus.filter((s) => s.connected).length
  const mcpTotal = mcpStatus.length

  return (
    <div className={cn('flex h-6 shrink-0 items-center gap-3 border-t border-border bg-card/80 px-3 font-mono text-[9.5px] tracking-wide text-muted-foreground shadow-[var(--shadow-inset-sm)]', className)}>
      {workspacePath ? (
        <span className="flex items-center gap-1 truncate max-w-[300px]" title={workspacePath}>
          <FolderOpen className="size-3 shrink-0" />
          <span className="truncate">{workspacePath}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1 shrink-0">
          <FolderOpen className="size-3 shrink-0" />
          No folder
        </span>
      )}

      {currentModel && (
        <ModelHoverCard modelId={currentModel}>
          <span className="flex items-center gap-1 shrink-0 cursor-default">
            <Cpu className="size-3" />
            {currentModel.length > 20 ? currentModel.slice(0, 20) + '…' : currentModel}
          </span>
        </ModelHoverCard>
      )}

      {messages && messages.length > 0 && (
        <ContextUsageBadge messages={messages} model={currentModel} />
      )}

      {/* MCP status */}
      {mcpTotal > 0 && (
        <span
          className={cn('flex items-center gap-1 shrink-0', mcpConnected === mcpTotal ? 'text-green-500' : 'text-amber-400')}
          title={mcpStatus.map((s) => `${s.name}: ${s.connected ? 'connected' : s.error || 'disconnected'}`).join('\n')}
        >
          {mcpConnected === mcpTotal ? <PlugZap className="size-3" /> : <Plug className="size-3" />}
          {mcpConnected}/{mcpTotal}
        </span>
      )}

      {/* MCP background indicator */}
      {mcpBgTools.length > 0 && (
        <span className="flex items-center gap-1 shrink-0 text-blue-400 animate-pulse" title={`MCP tool(s) running in background: ${mcpBgTools.join(', ')}`}>
          <Loader2 className="size-3 animate-spin" />
          bg
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
})
