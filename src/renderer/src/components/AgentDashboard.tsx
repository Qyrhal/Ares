import React, { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Circle, Bot, MessageSquare, Plus } from 'lucide-react'
import { cn, timeAgo, truncate } from '@/lib/utils'
import type { Session, AgentStatus } from '@/types'
import { SpawnAgentDialog } from '@/components/SpawnAgentDialog'

interface AgentDashboardProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onSpawnAgent: (task: string, title: string) => void
}

function StatusBadge({ status }: { status: AgentStatus | undefined }) {
  switch (status) {
    case 'running':
      return (
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          <Loader2 className="size-2.5 animate-spin" /> Running
        </span>
      )
    case 'done':
      return (
        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
          <CheckCircle2 className="size-2.5" /> Done
        </span>
      )
    case 'error':
      return (
        <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
          <XCircle className="size-2.5" /> Error
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <Circle className="size-2.5" /> Idle
        </span>
      )
  }
}

function AgentCard({
  session, isActive, onSelect
}: {
  session: Session
  isActive: boolean
  onSelect: () => void
}): React.ReactElement {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:shadow-md',
        isActive
          ? 'border-primary/40 bg-primary/5 shadow-sm shadow-primary/10'
          : 'border-border bg-card hover:border-border/80 hover:bg-accent/30'
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
          <span className="truncate text-sm font-semibold text-foreground">
            {truncate(session.title, 32)}
          </span>
        </div>
        <StatusBadge status={session.agentStatus} />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <MessageSquare className="size-2.5" />
          {session.messageCount ?? 0} messages
        </span>
        <span>{timeAgo(session.updatedAt)}</span>
      </div>

      {/* Model */}
      {session.model && (
        <span className="text-[10px] text-muted-foreground/40 truncate">
          {session.model}
        </span>
      )}
    </button>
  )
}

export function AgentDashboard({ sessions, activeSessionId, onSelectSession, onSpawnAgent }: AgentDashboardProps): React.ReactElement {
  const [showSpawn, setShowSpawn] = useState(false)
  const rootSessions = sessions.filter((s) => !s.parentId)
  const childSessions = sessions.filter((s) => s.parentId)
  const running = sessions.filter((s) => s.agentStatus === 'running').length
  const done = sessions.filter((s) => s.agentStatus === 'done').length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3 bg-card/50">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{sessions.length}</span> agents
        </span>
        {running > 0 && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <Loader2 className="size-3 animate-spin" />
            {running} running
          </span>
        )}
        {done > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <CheckCircle2 className="size-3" />
            {done} done
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowSpawn(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Plus className="size-3.5" />
          Spawn Agent
        </button>
      </div>

      {showSpawn && (
        <SpawnAgentDialog
          onSpawn={(task, title) => { onSpawnAgent(task, title); setShowSpawn(false) }}
          onClose={() => setShowSpawn(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Orchestrators */}
        {rootSessions.length > 0 && (
          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Orchestrators
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rootSessions.map((s) => (
                <AgentCard
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onSelect={() => onSelectSession(s.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Sub-agents */}
        {childSessions.length > 0 && (
          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sub-Agents
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {childSessions.map((s) => (
                <AgentCard
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onSelect={() => onSelectSession(s.id)}
                />
              ))}
            </div>
          </section>
        )}

        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <Bot className="size-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No agents yet.</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs">
              Open a chat session and use the Spawn Agent button to create sub-agents.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
