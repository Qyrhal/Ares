import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { PlusIcon, XIcon, ChevronDownIcon } from '@animateicons/react/lucide'
import { GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TerminalTab {
  id: string
  label: string
}

interface TerminalViewProps {
  cwd: string | null
  onClose: () => void
  onHeightChange?: (height: string) => void
}

type WriteFn = (data: string) => void

function tabLabel(cwd: string | null): string {
  if (!cwd) return 'shell'
  const parts = cwd.split('/').filter(Boolean)
  return parts.slice(-2).join('/') || parts[0] || 'shell'
}

// TerminalInstance manages ONLY the xterm DOM — never the pty lifecycle.
// pty create/kill is owned by TerminalView so React StrictMode's
// effect double-invoke doesn't kill the pty between mount cycles.
function TerminalInstance({
  id,
  onReady,
  onDispose,
}: {
  id: string
  onReady: (id: string, fn: WriteFn) => void
  onDispose: (id: string) => void
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const term = new Terminal({
      cols: 80,
      rows: 24,
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
      fontFamily: 'Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(el)
    term.focus()

    const doFit = (): void => { try { fitAddon.fit() } catch { /* noop */ } }
    requestAnimationFrame(doFit)
    const fitTimer = setTimeout(doFit, 200)

    term.onData((data) => window.electron.terminal.write(id, data))
    term.onResize(({ cols, rows }) => window.electron.terminal.resize(id, cols, rows))

    const ro = new ResizeObserver(doFit)
    ro.observe(el)

    // Tell TerminalView this xterm is ready to receive output.
    // Any history buffered before this mount is replayed immediately.
    onReady(id, (data) => term.write(data))

    return () => {
      onDispose(id)
      ro.disconnect()
      clearTimeout(fitTimer)
      term.dispose()
      // NOTE: do NOT kill the pty here — TerminalView owns that lifecycle.
    }
  }, [id])

  return <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
}

export function TerminalView({ cwd, onClose, onHeightChange }: TerminalViewProps): React.ReactElement {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const creating = useRef(false)

  // Per-terminal write callbacks set by TerminalInstance on mount.
  const writeCallbacks = useRef<Record<string, WriteFn>>({})
  // Output that arrived before TerminalInstance mounted (pre-mount buffer).
  const outputBuffers = useRef<Record<string, string[]>>({})
  // Full output history per terminal — replayed when xterm re-mounts
  // (React StrictMode double-invoke, or tab switching if we ever remount).
  const outputHistory = useRef<Record<string, string[]>>({})

  // Subscribe once before any terminal is created so no early output is lost.
  useEffect(() => {
    const unsub = window.electron.terminal.onOutput((termId: string, data: string) => {
      const fn = writeCallbacks.current[termId]
      if (fn) {
        fn(data)
      } else {
        if (!outputBuffers.current[termId]) outputBuffers.current[termId] = []
        outputBuffers.current[termId].push(data)
      }
      // Always accumulate history for replay on xterm re-mount.
      if (!outputHistory.current[termId]) outputHistory.current[termId] = []
      outputHistory.current[termId].push(data)
    })
    return unsub
  }, [])

  const onReady = useCallback((id: string, fn: WriteFn) => {
    writeCallbacks.current[id] = fn

    // Drain anything that arrived before this mount.
    const buffered = outputBuffers.current[id]
    if (buffered?.length) {
      buffered.forEach((chunk) => fn(chunk))
      delete outputBuffers.current[id]
    } else {
      // Re-mount (Strict Mode): replay full history so the new xterm catches up.
      const history = outputHistory.current[id]
      if (history?.length) history.forEach((chunk) => fn(chunk))
    }
  }, [])

  const onDispose = useCallback((id: string) => {
    delete writeCallbacks.current[id]
  }, [])

  const createTerminal = useCallback(async () => {
    if (creating.current) return
    creating.current = true
    setCreateError(null)
    try {
      const dir = cwd ?? '/'
      const id = await window.electron.terminal.create(dir)
      if (!id) { setCreateError('Failed to create terminal'); return }
      setTabs((prev) => [...prev, { id, label: tabLabel(cwd) }])
      setActiveId(id)
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      creating.current = false
    }
  }, [cwd])

  // Create the first terminal on mount.
  useEffect(() => { createTerminal() }, [])

  const closeTerminal = (id: string): void => {
    window.electron.terminal.kill(id)
    delete writeCallbacks.current[id]
    delete outputBuffers.current[id]
    delete outputHistory.current[id]
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const next = prev.filter((t) => t.id !== id)
      if (activeId === id) setActiveId(next[Math.min(idx, next.length - 1)]?.id ?? null)
      return next
    })
  }

  // Kill all ptys when the panel closes.
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => () => { tabsRef.current.forEach((t) => window.electron.terminal.kill(t.id)) }, [])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Drag handle */}
      <div
        className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center bg-transparent hover:bg-primary/10 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault()
          const parent = (e.currentTarget as HTMLElement).parentElement
          if (!parent) return
          const startY = e.clientY
          const startH = parent.offsetHeight
          const onMove = (ev: MouseEvent) => {
            const dy = ev.clientY - startY
            const h = Math.max(80, Math.min(600, startH - dy))
            onHeightChange?.(`${h}px`)
            ev.preventDefault()
          }
          const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
          document.body.style.cursor = 'row-resize'
          document.body.style.userSelect = 'none'
        }}
      >
        <GripHorizontal className="size-3 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
      </div>

      <div className="flex items-center border-b border-border bg-card px-2 py-1 gap-0.5 shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'group flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs border transition-colors cursor-pointer',
              tab.id === activeId
                ? 'bg-background text-foreground border-border/60'
                : 'text-muted-foreground border-transparent hover:border-border/40 hover:text-foreground'
            )}
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

      <div className="flex flex-1 flex-col min-h-0">
        {createError && (
          <div className="flex flex-1 items-center justify-center text-xs text-destructive p-4 text-center">
            {createError}
          </div>
        )}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeId ? 'flex flex-1 flex-col min-h-0' : 'hidden'}
          >
            <TerminalInstance id={tab.id} onReady={onReady} onDispose={onDispose} />
          </div>
        ))}
        {tabs.length === 0 && !createError && (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            Starting terminal…
          </div>
        )}
      </div>
    </div>
  )
}
