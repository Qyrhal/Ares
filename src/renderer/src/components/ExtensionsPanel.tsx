import React, { useState } from 'react'
import { Sparkles, Plug, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkillsPanel } from '@/components/SkillsPanel'
import { PluginsPanel } from '@/components/PluginsPanel'
import { HooksPanel } from '@/components/HooksPanel'

type ExtensionsTab = 'skills' | 'plugins' | 'hooks'

const TABS: { id: ExtensionsTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'plugins', label: 'Plugins & MCPs', icon: Plug },
  { id: 'hooks', label: 'Hooks', icon: Zap },
]

export function ExtensionsPanel(): React.ReactElement {
  const [tab, setTab] = useState<ExtensionsTab>('skills')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-border bg-card/50 px-3 pt-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors',
              tab === id
                ? 'border-border bg-background text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'skills' && <SkillsPanel />}
      {tab === 'plugins' && <PluginsPanel />}
      {tab === 'hooks' && <HooksPanel />}
    </div>
  )
}
