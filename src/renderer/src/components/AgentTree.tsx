import React, { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Circle, ChevronRight, ChevronDown } from 'lucide-react'
import { cn, truncate } from '@/lib/utils'
import type { Session, AgentStatus } from '@/types'

interface AgentTreeProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
}

interface TreeNode {
  session: Session
  children: TreeNode[]
}

function buildTree(sessions: Session[]): TreeNode[] {
  const byId = new Map(sessions.map((s) => [s.id, { session: s, children: [] as TreeNode[] }]))
  const roots: TreeNode[] = []

  for (const node of byId.values()) {
    const parentId = node.session.parentId
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function StatusIcon({ status }: { status: AgentStatus | undefined }) {
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

function TreeNodeView({
  node, depth, activeSessionId, onSelect
}: {
  node: TreeNode
  depth: number
  activeSessionId: string | null
  onSelect: (id: string) => void
}): React.ReactElement {
  const [expanded, setExpanded] = useState(true)
  const { session, children } = node
  const isActive = session.id === activeSessionId
  const hasChildren = children.length > 0

  return (
    <div>
      <button
        onClick={() => onSelect(session.id)}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-all',
          isActive
            ? 'bg-primary/10 text-foreground shadow-xs'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {expanded
              ? <ChevronDown className="size-3" />
              : <ChevronRight className="size-3" />
            }
          </button>
        ) : (
          <span className="size-3 shrink-0" />
        )}

        <StatusIcon status={session.agentStatus} />

        <span className="flex-1 truncate font-medium leading-snug">
          {truncate(session.title, 28)}
        </span>

        {session.messageCount > 0 && (
          <span className="shrink-0 text-[9px] text-muted-foreground/50">
            {session.messageCount}
          </span>
        )}
      </button>

      {expanded && children.map((child) => (
        <TreeNodeView
          key={child.session.id}
          node={child}
          depth={depth + 1}
          activeSessionId={activeSessionId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function AgentTree({ sessions, activeSessionId, onSelectSession }: AgentTreeProps): React.ReactElement {
  const roots = buildTree(sessions)
  const runningCount = sessions.filter((s) => s.agentStatus === 'running').length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center px-3 border-b border-border gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Agent Tree
        </span>
        {runningCount > 0 && (
          <span className="flex items-center gap-1 text-[9px] text-primary">
            <Loader2 className="size-2.5 animate-spin" />
            {runningCount} running
          </span>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
            <p className="text-xs text-muted-foreground">No agents yet.</p>
            <p className="text-[10px] text-muted-foreground/50">
              Agents are spawned automatically by the orchestrator.
            </p>
          </div>
        ) : (
          roots.map((node) => (
            <TreeNodeView
              key={node.session.id}
              node={node}
              depth={0}
              activeSessionId={activeSessionId}
              onSelect={onSelectSession}
            />
          ))
        )}
      </div>
    </div>
  )
}
