import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { PlusIcon, XIcon, ChevronDownIcon } from '@animateicons/react/lucide'
import { cn } from '@/lib/utils'

interface TerminalTab {
  id: string
  label: string
}

interface TerminalViewProps {
  cwd: string | null
  onClose: () => void
}

function TerminalInstance({ id, cwd }: { id: string; cwd: string }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e8e8e8',
        cursor: '#dc2626',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#ffffff22',
        black: '#1e1e1e',     brightBlack: '#4b5563',
        red: '#ef4444',       brightRed: '#f87171',
        green: '#22c55e',     brightGreen: '#4ade80',
        yellow: '#f59e0b',    brightYellow: '#fbbf24',
        blue: '#3b82f6',      brightBlue: '#60a5fa',
        magenta: '#a78bfa',   brightMagenta: '#c4b5fd',
        cyan: '#22d3ee',      brightCyan: '#67e8f9',
        white: '#e8e8e8',     brightWhite: '#f9fafb',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    if (containerRef.current) {
      term.open(containerRef.current)
      requestAnimationFrame(() => { try { fitAddon.fit() } catch (_) {} })
    }

    const outputCleanup = window.electron.terminal.onOutput((tid, data) => {
      if (tid === id) term.write(data)
    })

    term.onData((data) => window.electron.terminal.write(id, data))
    term.onResize(({ cols, rows }) => window.electron.terminal.resize(id, cols, rows))

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit() } catch (_) {} })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      outputCleanup()
      ro.disconnect()
      window.electron.terminal.kill(id)
      term.dispose()
    }
  }, [id])

  return <div ref={containerRef} className="flex-1 overflow-hidden px-1" />
}

export function TerminalView({ cwd, onClose }: TerminalViewProps): React.ReactElement {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const creating = useRef(false)

  const createTerminal = useCallback(async () => {
    if (creating.current) return
    creating.current = true
    try {
      const dir = cwd || '/'
      const id = await window.electron.terminal.create(dir)
      const label = dir.split('/').pop() || 'shell'
      setTabs((prev) => [...prev, { id, label }])
      setActiveId(id)
    } finally {
      creating.current = false
    }
  }, [cwd])

  useEffect(() => {
    createTerminal()
  }, [])

  const closeTerminal = (id: string): void => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const next = prev.filter((t) => t.id !== id)
      if (activeId === id) {
        const fallback = next[Math.min(idx, next.length - 1)]
        setActiveId(fallback?.id ?? null)
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card px-2 py-1 gap-0.5 shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'group flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs border transition-colors cursor-pointer',
              tab.id === activeId
                ? 'bg-background text-foreground border-border/60'
                : 'text-muted-foreground border-transparent hover:border-border/40 hover:text-foreground'
            )}
            onClick={() => setActiveId(tab.id)}
          >
            <span>{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTerminal(tab.id) }}
              className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
              aria-label="Close terminal"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        ))}
        <button
          title="New terminal"
          onClick={createTerminal}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <PlusIcon className="size-3.5" />
        </button>
        <div className="flex-1" />
        <button
          title="Close terminal panel"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ChevronDownIcon className="size-3.5" />
        </button>
      </div>

      {/* Terminal instances */}
      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === activeId ? 'flex flex-1 flex-col min-h-0' : 'hidden'}>
          <TerminalInstance id={tab.id} cwd={cwd || '/'} />
        </div>
      ))}
      {tabs.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Starting terminal...
        </div>
      )}
    </div>
  )
}
