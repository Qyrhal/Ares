import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Plus, X } from 'lucide-react'

interface TerminalViewProps {
  cwd: string | null
  onClose: () => void
  onNewTerminal: () => void
}

export function TerminalView({ cwd, onClose, onNewTerminal }: TerminalViewProps): React.ReactElement {
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
      // Give the DOM a tick to compute dimensions before fitting
      requestAnimationFrame(() => { try { fitAddon.fit() } catch (_) {} })
    }

    window.electron.terminal.create(cwd || '/')

    const cleanup = window.electron.terminal.onOutput((data) => { term.write(data) })

    term.onData((data) => { window.electron.terminal.write(data) })
    term.onResize(({ cols, rows }) => { window.electron.terminal.resize(cols, rows) })

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit() } catch (_) {}
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      cleanup()
      ro.disconnect()
      window.electron.terminal.kill()
      term.dispose()
    }
  }, [cwd])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Terminal tab bar */}
      <div className="flex items-center border-b border-border bg-card px-2 py-1 gap-2 shrink-0">
        <div className="flex items-center gap-1.5 rounded-md bg-background px-2.5 py-0.5 text-xs text-foreground/70 border border-border/60">
          <span>{cwd?.split('/').pop() ?? 'shell'}</span>
        </div>
        <div className="flex-1" />
        <button
          title="New terminal"
          onClick={onNewTerminal}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          title="Close terminal"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* xterm.js mount point */}
      <div ref={containerRef} className="flex-1 overflow-hidden px-1" />
    </div>
  )
}
