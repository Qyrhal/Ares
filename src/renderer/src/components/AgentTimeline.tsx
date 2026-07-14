import React from 'react'
import { Loader2, CheckCircle2, XCircle, Circle, Bot, MessageSquare } from 'lucide-react'
import { cn, timeAgo, truncate } from '@/lib/utils'
import type { Session } from '@/types'

interface AgentTimelineProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
}

function StatusIcon({ status }: { status: string | undefined }): React.ReactElement {
  switch (status) {
    case 'running':
      return <Loader2 className="size-3 animate-spin text-primary" />
    case 'done':
      return <CheckCircle2 className="size-3 text-green-500" />
    case 'error':
      return <XCircle className="size-3 text-destructive" />
    default:
      return <Circle className="size-3 text-muted-foreground/40" />
  }
}

function formatDuration(createdAt: number, updatedAt: number): string {
  const diff = updatedAt - createdAt
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

export function AgentTimeline({ sessions, activeSessionId, onSelectSession }: AgentTimelineProps): React.ReactElement {
  // Sort by createdAt descending (newest first)
  const sorted = [...sessions].sort((a, b) => b.createdAt - a.createdAt)

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bot className="size-8 text-muted-foreground/20" />
        <p className="mt-2 text-xs text-muted-foreground">No agents yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 overflow-y-auto px-2 py-1 flex-1">
      {sorted.map((session, idx) => {
        const isActive = session.id === activeSessionId
        const isLast = idx === sorted.length - 1
        return (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={cn(
              'relative flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left text-sm transition-colors',
              isActive
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {/* Timeline line and dot */}
            <div className="flex flex-col items-center shrink-0 pt-0.5">
              <StatusIcon status={session.agentStatus} />
              {!isLast && <div className="mt-1 w-px flex-1 min-h-[16px] bg-border" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {session.parentId ? (
                  <Bot className="size-3 shrink-0 text-muted-foreground/40" />
                ) : (
                  <MessageSquare className="size-3 shrink-0 text-muted-foreground/40" />
                )}
                <span className="truncate text-xs font-medium">
                  {truncate(session.title, 30)}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                <span>{timeAgo(session.createdAt)}</span>
                {session.createdAt !== session.updatedAt && session.agentStatus && (session.agentStatus === 'done' || session.agentStatus === 'error') && (
                  <>
                    <span>·</span>
                    <span>{formatDuration(session.createdAt, session.updatedAt)}</span>
                  </>
                )}
                <span>·</span>
                <span>{session.messageCount ?? 0} msg</span>
              </div>

              {/* Duration bar for finished agents */}
              {session.agentStatus && (session.agentStatus === 'done' || session.agentStatus === 'error') && session.createdAt && session.updatedAt && (
                <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden max-w-[120px]">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      session.agentStatus === 'done' ? 'bg-green-500/60' : 'bg-destructive/60'
                    )}
                    style={{ width: `${Math.min(100, Math.floor((session.updatedAt - session.createdAt) / 100))}%` }}
                  />
                </div>
              )}

              {/* Agent status label */}
              {session.agentStatus === 'running' && (
                <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-primary">
                  <Loader2 className="size-2 animate-spin" /> running
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
