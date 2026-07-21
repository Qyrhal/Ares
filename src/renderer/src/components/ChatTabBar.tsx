import React from 'react'
import { MessageSquare, PanelRight, XIcon, PlusIcon } from 'lucide-react'
import { cn, truncate } from '@/lib/utils'

export interface ChatTab {
  id: string
  title: string
  isSideChat: boolean
}

interface ChatTabBarProps {
  tabs: ChatTab[]
  activeTabId: string | null
  sideChatSessionId: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewSideChat: () => void
}

export const ChatTabBar = React.memo(function ChatTabBar({
  tabs,
  activeTabId,
  sideChatSessionId,
  onSelectTab,
  onCloseTab,
  onNewSideChat,
}: ChatTabBarProps): React.ReactElement {
  return (
    <div
      className="flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-card/50"
      data-testid="chat-tab-bar"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId && tab.id !== sideChatSessionId
        const isSide = tab.id === sideChatSessionId

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              'group relative flex h-full min-w-0 max-w-44 shrink-0 items-center gap-1.5 border-r border-border px-2.5 text-xs transition-all',
              isActive
                ? 'surface-raised text-foreground'
                : isSide
                  ? 'bg-primary/5 text-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {(isActive || isSide) && (
              <span className="absolute inset-x-0 top-0 h-[2px] rounded-b-sm bg-primary" />
            )}

            {isSide ? (
              <PanelRight className="size-3 shrink-0 text-primary/70" />
            ) : (
              <MessageSquare className="size-3 shrink-0 opacity-60" />
            )}

            <span className="truncate">
              {isSide ? '↳ ' : ''}{truncate(tab.title, 20)}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
              className="ml-auto flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              aria-label={`Close ${tab.title}`}
            >
              <XIcon className="size-3" />
            </button>
          </button>
        )
      })}

      <button
        onClick={onNewSideChat}
        className="flex h-full shrink-0 items-center px-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="New side chat"
        title="New side chat"
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  )
})
