import React from 'react'
import { FileCode, MessageSquare } from 'lucide-react'
import { PlusIcon, XIcon } from '@animateicons/react/lucide'
import { cn, truncate } from '@/lib/utils'
import { Tab } from '@/types'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewSession: () => void
}

function tabId(tab: Tab): string {
  return tab.type === 'session' ? tab.id : tab.path
}

function tabLabel(tab: Tab): string {
  return tab.type === 'session' ? tab.title : tab.name
}

export const TabBar = React.memo(function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onNewSession }: TabBarProps): React.ReactElement {
  return (
    <div className="flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-card/50" data-testid="tab-bar">
      <button
        onClick={onNewSession}
        className="flex h-full shrink-0 items-center px-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="New session"
        title="New session"
      >
        <PlusIcon className="size-4" />
      </button>
      {tabs.map((tab) => {
        const id = tabId(tab)
        const isActive = id === activeTabId
        const isDirty = tab.type === 'file' && tab.isDirty

        return (
          <button
            key={id}
            onClick={() => onSelectTab(id)}
            className={cn(
              'group relative flex h-full min-w-0 max-w-44 shrink-0 items-center gap-1.5 border-r border-border px-3 text-xs transition-all',
              isActive
                ? 'surface-raised text-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {isActive && (
              <span className="absolute inset-x-0 top-0 h-[2px] rounded-b-sm bg-primary" />
            )}

            {tab.type === 'session'
              ? <MessageSquare className="size-3 shrink-0 opacity-60" />
              : <FileCode className="size-3 shrink-0 opacity-60" />
            }

            <span className="truncate">{truncate(tabLabel(tab), 20)}</span>

            {isDirty && <span className="size-1.5 shrink-0 rounded-full bg-amber-400" />}

            <button
              onClick={(e) => { e.stopPropagation(); onCloseTab(id) }}
              className="ml-auto flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              aria-label="Close tab"
            >
              <XIcon className="size-3" />
            </button>
          </button>
        )
      })}
    </div>
  )
})
