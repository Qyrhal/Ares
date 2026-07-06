import React, { useEffect, useRef, useState, useMemo } from 'react'
import type { Tab } from '@/types'
import { FileCode, MessageSquare, FileText, Image, File } from '@/lib/icons'

interface TabSwitcherProps {
  open: boolean
  onClose: () => void
  tabs: Tab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
}

function tabKey(t: Tab): string {
  return t.type === 'session' ? t.id : t.path
}

function TabIcon({ tab }: { tab: Tab }): React.ReactElement {
  if (tab.type === 'session') return <MessageSquare className="size-4" />
  const ext = tab.name.split('.').pop()?.toLowerCase()
  if (ext === 'tsx' || ext === 'ts' || ext === 'js' || ext === 'jsx') return <FileCode className="size-4" />
  if (ext === 'md' || ext === 'txt') return <FileText className="size-4" />
  if (ext === 'png' || ext === 'jpg' || ext === 'svg') return <Image className="size-4" />
  return <File className="size-4" />
}

export function TabSwitcher({ open, onClose, tabs, activeTabId, onSelectTab }: TabSwitcherProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return tabs
    const q = query.toLowerCase()
    return tabs.filter((t) => {
      const label = t.type === 'session' ? t.title : t.name + ' ' + t.path
      return label.toLowerCase().includes(q)
    })
  }, [tabs, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault(); onClose()
        break
      case 'ArrowDown':
        e.preventDefault(); setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault(); setSelectedIdx((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[selectedIdx]) {
          onSelectTab(tabKey(filtered[selectedIdx]))
          onClose()
        }
        break
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <svg className="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search open tabs…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {filtered.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{filtered.length} tab{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {tabs.length === 0 ? 'No open tabs' : query ? 'No matching tabs' : 'Type to filter tabs'}
            </div>
          ) : (
            filtered.map((tab, idx) => {
              const key = tabKey(tab)
              return (
                <button
                  key={key}
                  onClick={() => { onSelectTab(key); onClose() }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    idx === selectedIdx
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  } ${key === activeTabId ? 'border-l-2 border-primary' : ''}`}
                >
                  <TabIcon tab={tab} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {tab.type === 'session' ? tab.title : tab.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {tab.type === 'session' ? 'Chat session' : tab.path}
                    </div>
                  </div>
                  {tab.type === 'file' && tab.isDirty && (
                    <span className="size-2 rounded-full bg-yellow-500 shrink-0" title="Unsaved changes" />
                  )}
                  {tab.type === 'session' && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">chat</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
