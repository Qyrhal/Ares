import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AgentConfig, McpServer, PiExtension } from '@/types'
import { cn } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import { CheckCircle2, ChevronDown, ChevronRight, Plug, Plus, Trash2 } from '@/lib/icons'

const el = window.electron

const INPUT = 'w-full rounded border border-border bg-input px-3 py-[0.4rem] text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground'

const EMPTY: AgentConfig = { skills: [], extensions: [], mcpServers: [], commands: [] }

export function PluginsPanel(): React.ReactElement {
  const [config, setConfig] = useState<AgentConfig>(EMPTY)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    el.agentConfig.get().then((c) => setConfig(c ?? EMPTY))
  }, [])

  const persist = useCallback((next: AgentConfig) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await el.agentConfig.set(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 400)
  }, [])

  const patchConfig = useCallback((patch: Partial<AgentConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [persist])

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <div className="mb-2 flex items-center gap-2">
          <Plug className="size-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Plugins &amp; MCPs</h1>
          {saved && (
            <span className="flex items-center gap-1 text-[10px] text-green-400 animate-in fade-in">
              <CheckCircle2 className="size-3" /> Saved
            </span>
          )}
        </div>
        <p className="mb-10 text-sm text-muted-foreground">
          MCP servers are spawned on demand when a session starts. Extensions are Pi agent factory modules loaded at session creation.
        </p>

        {/* MCP Servers */}
        <McpServersSection
          servers={config.mcpServers}
          onChange={(mcpServers) => patchConfig({ mcpServers })}
        />

        <div className="my-10 border-t border-border" />

        {/* Extensions */}
        <ExtensionsSection
          extensions={config.extensions}
          onChange={(extensions) => patchConfig({ extensions })}
        />
      </div>
    </div>
  )
}

// ── MCP Servers ───────────────────────────────────────────────────────────────

function McpServersSection({ servers, onChange }: { servers: McpServer[]; onChange: (s: McpServer[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const add = () => {
    const s: McpServer = { id: uuidv4(), name: 'New server', command: 'npx', args: [], env: {}, enabled: true }
    onChange([...servers, s])
    setExpanded(s.id)
  }

  const update = (id: string, patch: Partial<McpServer>) =>
    onChange(servers.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const remove = (id: string) => {
    onChange(servers.filter((s) => s.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">MCP Servers</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Model Context Protocol servers — expose tools to the agent via stdio.</p>
        </div>
        <button
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="size-3.5" /> Add server
        </button>
      </div>

      {servers.length === 0 ? (
        <EmptyState label="No MCP servers" hint="Add a server to expose external tools to the agent." onAdd={add} />
      ) : (
        <div className="space-y-2">
          {servers.map((s) => (
            <McpServerRow
              key={s.id}
              server={s}
              open={expanded === s.id}
              onToggle={() => setExpanded((v) => (v === s.id ? null : s.id))}
              onUpdate={(patch) => update(s.id, patch)}
              onRemove={() => remove(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function McpServerRow({ server, open, onToggle, onUpdate, onRemove }: {
  server: McpServer
  open: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<McpServer>) => void
  onRemove: () => void
}) {
  const argsText = server.args.join('\n')
  const envText = Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n')

  const parseArgs = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean)
  const parseEnv = (t: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const line of t.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1)
    }
    return out
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden transition-shadow hover:shadow-sm">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors select-none"
        onClick={onToggle}
      >
        <button
          className="shrink-0"
          onClick={(e) => { e.stopPropagation(); onUpdate({ enabled: !server.enabled }) }}
          title={server.enabled ? 'Disable' : 'Enable'}
        >
          <span className={cn('inline-block size-2.5 rounded-full transition-colors', server.enabled ? 'bg-green-500' : 'bg-muted-foreground/30')} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{server.name || 'Unnamed'}</p>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {server.command} {server.args.slice(0, 2).join(' ')}{server.args.length > 2 ? ' …' : ''}
          </p>
        </div>
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-muted/5 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Name</label>
              <input value={server.name} onChange={(e) => onUpdate({ name: e.target.value })} className={cn(INPUT, 'text-xs')} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Command</label>
              <input value={server.command} onChange={(e) => onUpdate({ command: e.target.value })} placeholder="npx" className={cn(INPUT, 'text-xs font-mono')} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Arguments</label>
            <p className="mb-1.5 text-[11px] text-muted-foreground">One argument per line.</p>
            <textarea
              value={argsText}
              onChange={(e) => onUpdate({ args: parseArgs(e.target.value) })}
              rows={4}
              className={cn(INPUT, 'text-xs font-mono resize-y min-h-[70px]')}
              placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/Users/me/projects'}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Environment variables</label>
            <textarea
              value={envText}
              onChange={(e) => onUpdate({ env: parseEnv(e.target.value) })}
              rows={2}
              className={cn(INPUT, 'text-xs font-mono resize-y min-h-[40px]')}
              placeholder="API_KEY=abc123"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Extensions ────────────────────────────────────────────────────────────────

function ExtensionsSection({ extensions, onChange }: { extensions: PiExtension[]; onChange: (e: PiExtension[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const add = () => {
    const e: PiExtension = { id: uuidv4(), name: 'New extension', path: '', enabled: true }
    onChange([...extensions, e])
    setExpanded(e.id)
  }

  const update = (id: string, patch: Partial<PiExtension>) =>
    onChange(extensions.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const remove = (id: string) => {
    onChange(extensions.filter((e) => e.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Extensions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Pi agent extension factories loaded at session creation. Point to a <code className="rounded bg-muted px-1">.js</code> file exporting an ExtensionFactory.</p>
        </div>
        <button
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="size-3.5" /> Add extension
        </button>
      </div>

      {extensions.length === 0 ? (
        <EmptyState label="No extensions" hint="Extensions add custom tools, hooks, or behaviours to the Pi agent." onAdd={add} />
      ) : (
        <div className="space-y-2">
          {extensions.map((e) => (
            <ExtensionRow
              key={e.id}
              ext={e}
              open={expanded === e.id}
              onToggle={() => setExpanded((v) => (v === e.id ? null : e.id))}
              onUpdate={(patch) => update(e.id, patch)}
              onRemove={() => remove(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExtensionRow({ ext, open, onToggle, onUpdate, onRemove }: {
  ext: PiExtension
  open: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<PiExtension>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden transition-shadow hover:shadow-sm">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors select-none"
        onClick={onToggle}
      >
        <button
          className="shrink-0"
          onClick={(ev) => { ev.stopPropagation(); onUpdate({ enabled: !ext.enabled }) }}
          title={ext.enabled ? 'Disable' : 'Enable'}
        >
          <span className={cn('inline-block size-2.5 rounded-full transition-colors', ext.enabled ? 'bg-green-500' : 'bg-muted-foreground/30')} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{ext.name || 'Unnamed'}</p>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{ext.path || 'no path set'}</p>
        </div>
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        <button
          onClick={(ev) => { ev.stopPropagation(); onRemove() }}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-muted/5 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Name</label>
              <input value={ext.name} onChange={(ev) => onUpdate({ name: ev.target.value })} className={cn(INPUT, 'text-xs')} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">File path</label>
              <input value={ext.path} onChange={(ev) => onUpdate({ path: ev.target.value })} placeholder="/Users/me/my-extension.js" className={cn(INPUT, 'text-xs font-mono')} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function EmptyState({ label, hint, onAdd }: { label: string; hint: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-border px-5 py-6 text-left">
      <Plug className="size-8 text-muted-foreground/30 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        onClick={onAdd}
        className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
      >
        <Plus className="size-3.5" /> Add
      </button>
    </div>
  )
}
