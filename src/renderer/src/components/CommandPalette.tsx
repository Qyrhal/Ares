import React, { useEffect, useRef, useState, useMemo } from 'react'

export interface CommandEntry {
  id: string
  label: string
  description?: string
  shortcut?: string
  category?: string
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: CommandEntry[]
  placeholder?: string
}

export function CommandPalette({ open, onClose, commands, placeholder = 'Search commands…' }: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q)
    )
  }, [commands, query])

  // Reset when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined
    try { el?.scrollIntoView({ block: 'nearest' }) } catch { /* noop */ }
  }, [selectedIdx])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIdx((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[selectedIdx]) {
          filtered[selectedIdx].action()
          onClose()
        }
        break
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="surface-overlay relative z-10 w-full max-w-lg rounded-xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <svg className="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {filtered.length > 0 && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query ? 'No matching commands' : 'Type to search'}
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                role="option"
                aria-selected={idx === selectedIdx}
                onClick={() => { cmd.action(); onClose() }}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  idx === selectedIdx
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{cmd.label}</div>
                  {cmd.description && (
                    <div className="text-[11px] text-muted-foreground truncate">{cmd.description}</div>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
