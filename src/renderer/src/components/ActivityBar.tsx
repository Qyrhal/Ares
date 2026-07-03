import React from 'react'
import { MessageSquare, FolderOpen, GitBranch, Settings, SquareTerminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActivityView } from '@/types'

interface ActivityBarProps {
  activeView: ActivityView
  onChangeView: (v: ActivityView) => void
  terminalOpen: boolean
  onToggleTerminal: () => void
}

const TOP_ITEMS: { view: ActivityView; icon: React.FC<{ className?: string }>; label: string }[] = [
  { view: 'chat',     icon: MessageSquare, label: 'Chat' },
  { view: 'explorer', icon: FolderOpen,    label: 'Explorer' },
  { view: 'git',      icon: GitBranch,     label: 'Source Control' },
]

export function ActivityBar({ activeView, onChangeView, terminalOpen, onToggleTerminal }: ActivityBarProps): React.ReactElement {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-card py-2 gap-1">
      {TOP_ITEMS.map(({ view, icon: Icon, label }) => (
        <button
          key={view}
          title={label}
          onClick={() => onChangeView(view)}
          className={cn(
            'flex size-9 items-center justify-center rounded-lg transition-colors',
            activeView === view
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Icon className="size-5" />
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Terminal toggle */}
      <button
        title="Terminal (⌘`)"
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
        <Settings className="size-5" />
      </button>
    </div>
  )
}
