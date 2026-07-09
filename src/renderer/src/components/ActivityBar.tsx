import React from 'react'
import { MessageSquare, SquareTerminal, Plug, Network } from 'lucide-react'
import { FolderOpenIcon, GitBranchIcon, SettingsIcon } from '@animateicons/react/lucide'
import { cn } from '@/lib/utils'
import type { ActivityView } from '@/types'

interface ActivityBarProps {
  activeView: ActivityView
  onChangeView: (v: ActivityView) => void
  terminalOpen: boolean
  onToggleTerminal: () => void
  gitBadge?: number
  agentBadge?: number
}

export function ActivityBar({ activeView, onChangeView, terminalOpen, onToggleTerminal, gitBadge = 0, agentBadge = 0 }: ActivityBarProps): React.ReactElement {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-card py-2 gap-1">
      {([
        { view: 'chat'       as ActivityView, icon: MessageSquare,   label: 'Chat',           badge: 0 },
        { view: 'agents'     as ActivityView, icon: Network,         label: 'Orchestrator',   badge: agentBadge },
        { view: 'explorer'   as ActivityView, icon: FolderOpenIcon,  label: 'Explorer',       badge: 0 },
        { view: 'git'        as ActivityView, icon: GitBranchIcon,   label: 'Source Control', badge: gitBadge },
        { view: 'extensions' as ActivityView, icon: Plug,            label: 'Extensions',     badge: 0 },
      ] as const).map(({ view, icon: Icon, label, badge }) => (
        <button
          key={view}
          title={label}
          onClick={() => onChangeView(view)}
          className={cn(
            'relative flex size-9 items-center justify-center rounded-lg transition-colors',
            activeView === view
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Icon className="size-5" />
          {badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-none text-primary-foreground">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Terminal toggle */}
      <button
        title="Terminal (⌘` / ⌘J)"
        onClick={onToggleTerminal}
        className={cn(
          'flex size-9 items-center justify-center rounded-lg transition-colors',
          terminalOpen
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <SquareTerminal className="size-5" />
      </button>

      {/* Settings at the bottom */}
      <button
        title="Settings"
        onClick={() => onChangeView('settings')}
        className={cn(
          'flex size-9 items-center justify-center rounded-lg transition-colors',
          activeView === 'settings'
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <SettingsIcon className="size-5" />
      </button>
    </div>
  )
}
