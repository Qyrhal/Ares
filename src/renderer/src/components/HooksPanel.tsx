import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Hook, HookEvent, HookAction } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { CheckCircle2, Plug, Plus, Trash2, Zap, ChevronDownIcon, ChevronRightIcon } from '@/lib/icons'

const el = window.electron

const INPUT = 'w-full rounded border border-border bg-input px-3 py-[0.4rem] text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground'

const EVENT_OPTIONS: { value: HookEvent; label: string }[] = [
  { value: 'preTool', label: 'Before tool execution' },
  { value: 'postTool', label: 'After tool execution' },
  { value: 'preSend', label: 'Before sending to AI' },
  { value: 'postSend', label: 'After AI response' },
  { value: 'onError', label: 'On error' },
]

const ACTION_OPTIONS: { value: HookAction; label: string; hint: string }[] = [
  { value: 'script', label: 'Run script', hint: 'Path to executable script' },
  { value: 'webhook', label: 'Webhook POST', hint: 'URL to POST to' },
  { value: 'prompt', label: 'Prompt template', hint: 'Extra prompt context' },
]

/**
 * Hooks Panel — lifecycle event hooks (inspired by Claude Code Desktop).
 */
export function HooksPanel(): React.ReactElement {
  const [hooks, setHooks] = useState<Hook[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    el.hooks.get().then(setHooks)
  }, [])

  const persist = useCallback((next: Hook[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await el.hooks.set(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 400)
  }, [])

  const add = () => {
    const h: Hook = { id: uuidv4(), event: 'preTool', action: 'script', target: '', enabled: true }
    const next = [...hooks, h]
    setHooks(next)
    persist(next)
    setExpanded(h.id)
  }

  const update = (id: string, patch: Partial<Hook>) => {
    const next = hooks.map((h) => (h.id === id ? { ...h, ...patch } : h))
    setHooks(next)
    persist(next)
  }

  const remove = (id: string) => {
    const next = hooks.filter((h) => h.id !== id)
    setHooks(next)
    persist(next)
    if (expanded === id) setExpanded(null)
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Hooks</h1>
              {saved && (
                <span className="flex items-center gap-1 text-[10px] text-green-400 animate-in fade-in">
                  <CheckCircle2 className="size-3" /> Saved
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Lifecycle hooks fire on agent events. Each hook can run a script, send a webhook, or add prompt context.
              Inspired by Claude Code Desktop's hook system.
            </p>
          </div>
          <button
            onClick={add}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="size-3.5" /> Add hook
          </button>
        </div>

        {hooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-dashed border-border">
              <Zap className="size-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No hooks yet</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Hooks let you run scripts or send webhooks during the agent lifecycle — before tool execution,
                after responses, and on errors.
              </p>
            </div>
            <button
              onClick={add}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="size-4" /> Add your first hook
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {hooks.map((hook) => (
              <HookRow
                key={hook.id}
                hook={hook}
                open={expanded === hook.id}
                onToggle={() => setExpanded((v) => (v === hook.id ? null : hook.id))}
                onUpdate={(patch) => update(hook.id, patch)}
                onRemove={() => remove(hook.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HookRow({ hook, open, onToggle, onUpdate, onRemove }: {
  hook: Hook
  open: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<Hook>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden transition-shadow hover:shadow-sm">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors select-none"
        onClick={onToggle}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onUpdate({ enabled: !hook.enabled }) }}
          title={hook.enabled ? 'Disable' : 'Enable'}
        >
          <span className={cn('inline-block size-2.5 rounded-full transition-colors', hook.enabled ? 'bg-green-500' : 'bg-muted-foreground/30')} />
        </button>
        <Zap className={cn('size-4 shrink-0', hook.enabled ? 'text-primary/60' : 'text-muted-foreground/30')} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {hook.event} · {hook.action}
          </p>
          {hook.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{hook.description}</p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/50 font-mono truncate max-w-[150px]">{hook.target}</span>
        {open ? <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
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
              <label className="mb-1.5 block text-xs font-medium text-foreground">Event</label>
              <select
                value={hook.event}
                onChange={(e) => onUpdate({ event: e.target.value as HookEvent })}
                className={INPUT}
              >
                {EVENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Action</label>
              <select
                value={hook.action}
                onChange={(e) => onUpdate({ action: e.target.value as HookAction })}
                className={INPUT}
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Target</label>
            <p className="mb-1.5 text-[11px] text-muted-foreground">
              {hook.action === 'script' ? 'Absolute path to script (use ${HOME} for home)' :
               hook.action === 'webhook' ? 'URL to POST JSON payload to' :
               'Extra context to inject into the prompt'}
            </p>
            <input
              value={hook.target}
              onChange={(e) => onUpdate({ target: e.target.value })}
              placeholder={
                hook.action === 'script' ? '/path/to/script.sh' :
                hook.action === 'webhook' ? 'https://example.com/hook' :
                'Additional prompt instructions…'
              }
              className={cn(INPUT, 'text-xs font-mono')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Description (optional)</label>
            <input
              value={hook.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="What does this hook do?"
              className={cn(INPUT, 'text-xs')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
