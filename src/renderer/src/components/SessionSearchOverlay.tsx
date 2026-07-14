import React, { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/globals'

const el = window.electron

interface GroupedResult {
  sessionId: string
  sessionTitle: string
  results: SearchResult[]
}

function groupResults(results: SearchResult[]): GroupedResult[] {
  const map = new Map<string, GroupedResult>()
  for (const r of results) {
    if (!map.has(r.sessionId)) {
      map.set(r.sessionId, { sessionId: r.sessionId, sessionTitle: r.sessionTitle, results: [] })
    }
    map.get(r.sessionId)!.results.push(r)
  }
  return Array.from(map.values())
}

interface SessionSearchOverlayProps {
  open: boolean
  onClose: () => void
  onSelectSession: (id: string) => void
}

export function SessionSearchOverlay({ open, onClose, onSelectSession }: SessionSearchOverlayProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const grouped = groupResults(results)

  // Flatten for keyboard navigation: each result entry is addressable
  const flatResults = grouped.flatMap((g) => g.results)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await el.db.searchMessages(q)
      setResults(res)
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => doSearch(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-result-idx]')
    const el = items[selectedIdx] as HTMLElement | undefined
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
        setSelectedIdx((prev) => Math.min(prev + 1, flatResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIdx((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatResults[selectedIdx]) {
          onSelectSession(flatResults[selectedIdx].sessionId)
          onClose()
        }
        break
    }
  }

  const showResults = query.trim().length > 0 && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {loading ? (
            <svg className="size-4 shrink-0 text-muted-foreground animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search across all sessions…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {flatResults.length > 0 && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {flatResults.length} result{flatResults.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1" role="listbox">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          )}
          {!loading && showResults && flatResults.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
          {!loading && showResults && flatResults.length > 0 && grouped.map((group) => (
            <div key={group.sessionId}>
              {/* Session header */}
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.sessionTitle}
              </div>
              {group.results.map((r, i) => {
                const flatIdx = flatResults.indexOf(r)
                return (
                  <button
                    key={r.messageId || r.sessionId + '-title'}
                    data-result-idx={flatIdx}
                    role="option"
                    aria-selected={flatIdx === selectedIdx}
                    onClick={() => { onSelectSession(r.sessionId); onClose() }}
                    onMouseEnter={() => setSelectedIdx(flatIdx)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                      flatIdx === selectedIdx
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {r.role && (
                          <span className={cn(
                            'rounded px-1 py-0.5 text-[9px] font-medium uppercase',
                            r.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-green-500/10 text-green-500'
                          )}>
                            {r.role}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          {r.content}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
          {!query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type to search across all sessions
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
