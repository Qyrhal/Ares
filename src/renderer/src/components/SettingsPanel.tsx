import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Moon, Plus, RefreshCw, Sun, Trash2 } from 'lucide-react'
import { EyeIcon, EyeOffIcon, WifiIcon, WifiOffIcon } from '@animateicons/react/lucide'
import { AppSettings, ProviderConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { THEMES, applyTheme, applyColorMode, DEFAULT_THEME_ID } from '@/lib/theme'
import { makeModelRef } from '@/lib/providers'
import { ARES_PROMPT } from '../../../shared/ares-prompt'

const el = window.electron

const INPUT = 'w-full rounded-md border border-border bg-input px-3 py-[0.4rem] text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (s: AppSettings) => Promise<void>
  sessionCount: number
  onDeleteAllSessions: () => Promise<void>
}

const PRESET_ENDPOINTS = [
  { label: 'OpenAI',      url: 'https://api.openai.com/v1' },
  { label: 'Ollama',      url: 'http://localhost:11434/v1' },
  { label: 'LM Studio',   url: 'http://localhost:1234/v1' },
  { label: 'Groq',        url: 'https://api.groq.com/openai/v1' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1' },
  { label: 'OpenRouter',  url: 'https://openrouter.ai/api/v1' },
]

type ConnStatus = 'idle' | 'loading' | 'ok' | 'error'
type SaveState = 'idle' | 'saving' | 'saved'
interface ProviderStatus { status: ConnStatus; message: string }
interface FetchedModel { value: string; label: string; provider: string }

const AUTOSAVE_DELAY = 600

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'provider'
}

export function SettingsPanel({ settings, onSave, sessionCount, onDeleteAllSessions }: SettingsPanelProps): React.ReactElement {
  const [form, setForm] = useState<AppSettings>(settings)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [deletingAll, setDeletingAll] = useState(false)

  const [provStatus, setProvStatus] = useState<Record<string, ProviderStatus>>({})
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([])

  // Tracks the JSON of the last settings we saved (or received) so the
  // autosave effect and the incoming-props effect don't feed each other.
  const savedJson = useRef(JSON.stringify(settings))

  useEffect(() => {
    const json = JSON.stringify(settings)
    if (json === savedJson.current) return
    savedJson.current = json
    setForm(settings)
  }, [settings])

  // Materialize the legacy single endpoint as a provider card
  useEffect(() => {
    if (form.providers.length === 0 && form.apiBaseUrl.trim()) {
      setForm((prev) => prev.providers.length > 0 ? prev : {
        ...prev,
        providers: [{ id: 'default', label: 'Default', baseUrl: prev.apiBaseUrl, apiKey: prev.apiKey }],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.providers.length, form.apiBaseUrl])

  // ── Autosave: debounce every form change straight to disk ──────────────────
  useEffect(() => {
    const json = JSON.stringify(form)
    if (json === savedJson.current) return
    setSaveState('saving')
    const timer = setTimeout(() => {
      savedJson.current = json
      onSave(form).then(() => setSaveState('saved'))
    }, AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // ── Providers ───────────────────────────────────────────────────────────────
  const setProviders = (providers: ProviderConfig[]): void =>
    setForm((prev) => ({ ...prev, providers }))

  const updateProvider = (id: string, patch: Partial<ProviderConfig>): void =>
    setProviders(form.providers.map((p) => p.id === id ? { ...p, ...patch } : p))

  const removeProvider = (id: string): void => {
    setProviders(form.providers.filter((p) => p.id !== id))
    setFetchedModels((prev) => prev.filter((m) => !m.value.startsWith(`${id}::`)))
  }

  const addProvider = (label: string, url: string): void => {
    const base = slugify(label)
    let id = base
    let n = 2
    while (form.providers.some((p) => p.id === id)) id = `${base}-${n++}`
    setProviders([...form.providers, { id, label, baseUrl: url, apiKey: '' }])
  }

  const testProvider = useCallback(async (p: ProviderConfig, multi: boolean): Promise<FetchedModel[]> => {
    setProvStatus((prev) => ({ ...prev, [p.id]: { status: 'loading', message: '' } }))
    try {
      const json = await el.ext.fetchModels(p.baseUrl.replace(/\/$/, ''), p.apiKey)
      const models: FetchedModel[] = ((json.data ?? []) as { id: string }[])
        .map((m) => ({ value: multi ? makeModelRef(p.id, m.id) : m.id, label: m.id, provider: p.label }))
        .sort((a, b) => a.label.localeCompare(b.label))
      setProvStatus((prev) => ({
        ...prev,
        [p.id]: { status: 'ok', message: `Connected · ${models.length} model${models.length !== 1 ? 's' : ''} available` },
      }))
      return models
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setProvStatus((prev) => ({ ...prev, [p.id]: { status: 'error', message: (err as Error).message } }))
      }
      return []
    }
  }, [])

  const refreshAllModels = useCallback(async (providers: ProviderConfig[]): Promise<void> => {
    const usable = providers.filter((p) => p.baseUrl.trim())
    const multi = usable.length > 1
    const results = await Promise.all(usable.map((p) => testProvider(p, multi)))
    setFetchedModels(results.flat())
  }, [testProvider])

  // Auto-fetch models whenever the provider list changes
  const providersJson = JSON.stringify(form.providers)
  useEffect(() => {
    const providers = JSON.parse(providersJson) as ProviderConfig[]
    if (providers.every((p) => !p.baseUrl.trim())) return
    const timer = setTimeout(() => { refreshAllModels(providers) }, 600)
    return () => clearTimeout(timer)
  }, [providersJson, refreshAllModels])

  const set = (k: keyof AppSettings, v: string): void =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleDeleteAllSessions = async (): Promise<void> => {
    if (sessionCount === 0) return
    if (!window.confirm(`Delete all ${sessionCount} session${sessionCount !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeletingAll(true)
    await onDeleteAllSessions()
    setDeletingAll(false)
  }

  const multiProvider = form.providers.filter((p) => p.baseUrl.trim()).length > 1
  const modelOptions: SelectOption[] = fetchedModels.map((m) => ({
    value: m.value,
    label: multiProvider ? `${m.label} — ${m.provider}` : m.label,
  }))
  const currentModelInList = modelOptions.some((m) => m.value === form.defaultModel)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-xl font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Changes are saved automatically.</p>
          </div>
          <div
            role="status"
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              saveState === 'saving' && 'border-border text-muted-foreground',
              saveState === 'saved' && 'border-green-500/30 bg-green-500/10 text-green-400',
              saveState === 'idle' && 'border-transparent text-transparent select-none'
            )}
          >
            {saveState === 'saving' && <><Loader2 className="size-3 animate-spin" /> Saving…</>}
            {saveState === 'saved' && <><CheckCircle2 className="size-3" /> Saved</>}
            {saveState === 'idle' && <span className="size-3" />}
          </div>
        </div>

        {/* ── Providers ─────────────────────────────────────────────── */}
        <Section title="Providers" description="Connect any number of OpenAI-compatible endpoints — a local server and hosted APIs side by side. Every session picks its model from any of them.">

          {form.providers.map((p) => {
            const status = provStatus[p.id] ?? { status: 'idle' as ConnStatus, message: '' }
            return (
              <div key={p.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => updateProvider(p.id, { label: e.target.value })}
                    aria-label="Provider name"
                    className="w-40 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-semibold text-foreground outline-none transition-colors hover:border-border focus:border-primary"
                  />
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshAllModels(form.providers)}
                    disabled={status.status === 'loading' || !p.baseUrl}
                    className="h-6 shrink-0 gap-1.5 px-2 text-[11px]"
                  >
                    {status.status === 'loading'
                      ? <Loader2 className="size-3 animate-spin" />
                      : <RefreshCw className="size-3" />}
                    Test & fetch models
                  </Button>
                  <button
                    type="button"
                    onClick={() => removeProvider(p.id)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${p.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <input
                  type="url"
                  value={p.baseUrl}
                  onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  aria-label={`${p.label} base URL`}
                  className={INPUT}
                />

                <div className="relative">
                  <input
                    type={showKey[p.id] ? 'text' : 'password'}
                    value={p.apiKey}
                    onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                    placeholder="sk-… (leave blank for local servers)"
                    aria-label={`${p.label} API key`}
                    className={cn(INPUT, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey[p.id] ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>

                {status.status !== 'idle' && (
                  <div className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                    status.status === 'ok'      && 'border-green-500/30 bg-green-500/10 text-green-400',
                    status.status === 'error'   && 'border-destructive/30 bg-destructive/10 text-destructive',
                    status.status === 'loading' && 'border-border bg-muted/30 text-muted-foreground'
                  )}>
                    {status.status === 'ok'      && <WifiIcon className="size-3.5 shrink-0" />}
                    {status.status === 'error'   && <WifiOffIcon className="size-3.5 shrink-0" />}
                    {status.status === 'loading' && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
                    {status.status === 'loading' ? 'Connecting…' : status.message}
                  </div>
                )}
              </div>
            )
          })}

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Add provider</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ENDPOINTS.map((preset) => (
                <button
                  key={preset.url}
                  onClick={() => addProvider(preset.label, preset.url)}
                  className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Plus className="size-3" />
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => addProvider('Custom', '')}
                className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="size-3" />
                Custom
              </button>
            </div>
          </div>

          <Field
            label="Default model"
            hint={fetchedModels.length > 0
              ? `${fetchedModels.length} models fetched from ${multiProvider ? 'your providers' : 'your endpoint'}`
              : undefined}
          >
            <div className="space-y-2">
              {modelOptions.length > 0 ? (
                <Select
                  value={form.defaultModel}
                  onChange={(v) => set('defaultModel', v)}
                  options={modelOptions}
                  placeholder="Choose a model…"
                  searchable
                />
              ) : (
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Test your endpoint above to discover available models</span>
                </div>
              )}
              {!currentModelInList && form.defaultModel && modelOptions.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>"{form.defaultModel}" not in list — will be sent as-is</span>
                </div>
              )}
              <input
                type="text"
                value={form.defaultModel}
                onChange={(e) => set('defaultModel', e.target.value)}
                placeholder="Or type a model ID directly…"
                className={cn(INPUT, 'text-xs')}
              />
            </div>
          </Field>
        </Section>

        {/* ── Appearance ─────────────────────────────────────────────── */}
        <Section title="Appearance" description="Colour mode and the accent colour used throughout the interface.">
          <Field label="Colour mode">
            <div className="flex w-fit items-center overflow-hidden rounded-lg border border-border">
              {([
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'light', label: 'Light', icon: Sun },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    set('colorMode', opt.value)
                    applyColorMode(opt.value)
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors',
                    (form.colorMode ?? 'dark') === opt.value
                      ? 'bg-primary/15 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <opt.icon className="size-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Accent colour">
            <div className="flex flex-wrap gap-3">
              {THEMES.map((theme) => {
                const active = (form.themeId || DEFAULT_THEME_ID) === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    title={theme.label}
                    onClick={() => {
                      set('themeId', theme.id)
                      applyTheme(theme.id)
                    }}
                    className={cn(
                      'group flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all',
                      active
                        ? 'ring-2 ring-offset-2 ring-offset-background'
                        : 'hover:bg-accent/50'
                    )}
                    style={active ? { ['--tw-ring-color' as string]: theme.primary } : {}}
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-full shadow-md transition-transform group-hover:scale-110"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {active && (
                        <svg className="size-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.707 4.293a1 1 0 0 1 0 1.414l-7 7a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 1.414-1.414L6 10.586l6.293-6.293a1 1 0 0 1 1.414 0z" />
                        </svg>
                      )}
                    </span>
                    <span className={cn('text-xs', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      {theme.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>
        </Section>

        {/* ── System prompt ───────────────────────────────────────────── */}
        <Section title="System prompt" description="Custom instructions injected before every AI request.">
          <Field label="System prompt">
            <textarea
              value={form.systemPrompt}
              onChange={(e) => set('systemPrompt', e.target.value)}
              placeholder="You are a helpful coding assistant..."
              rows={4}
              className={cn(INPUT, 'min-h-[80px] resize-y text-xs leading-relaxed')}
            />
          </Field>

          <Field label="Agent protocol (auto-injected)" hint="Appended to every agent request so the AI knows how to use Ares' tools. Per-tool details travel in the tool schemas; this is the operating policy. Not editable.">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
              {ARES_PROMPT.trim()}
            </div>
          </Field>
        </Section>

        {/* ── Permissions ─────────────────────────────────────────────── */}
        <Section title="Permissions" description="Control how tool calls are handled.">
          <Field label="Permission mode">
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'ask', label: 'Ask', desc: 'Prompt for every tool call' },
                { value: 'auto', label: 'Auto', desc: 'Auto-approve reads, ask for writes' },
                { value: 'yolo', label: 'YOLO', desc: 'Auto-approve everything' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('permissionMode', opt.value)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all',
                    form.permissionMode === opt.value
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* ── Agent ───────────────────────────────────────────── */}
        <Section title="Agent" description="Configure agent behaviour and preview behaviour.">
          <Field label="Plan preview" hint="Before executing in agent mode, generate a plan preview for you to review and approve first.">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, planPreviewEnabled: !prev.planPreviewEnabled }))}
              className={cn(
                'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
                form.planPreviewEnabled ?? true
                  ? 'border-primary/50 bg-primary/20'
                  : 'border-border bg-muted/30'
              )}
              role="switch"
              aria-checked={form.planPreviewEnabled ?? true}
            >
              <span
                className={cn(
                  'inline-block size-4 rounded-full shadow-sm transition-transform',
                  form.planPreviewEnabled ?? true
                    ? 'translate-x-[18px] bg-primary'
                    : 'translate-x-[2px] bg-muted-foreground'
                )}
              />
            </button>
          </Field>
        </Section>

        {/* ── MCP ──────────────────────────────────────────────────── */}
        <Section title="MCP Tools" description="Configure behaviour for Model Context Protocol tools.">
          <Field label="Auto-background timeout" hint="When an MCP tool call exceeds this threshold (in seconds) it is automatically moved to background so the session stays responsive. Set to 0 to disable (always wait foreground).">
            <input
              type="number"
              min={0}
              max={600}
              value={(form.mcpAutoBackgroundMs ?? 120000) / 1000}
              onChange={(e) => setForm((prev) => ({ ...prev, mcpAutoBackgroundMs: Math.max(0, parseInt(e.target.value) || 0) * 1000 }))}
              className={cn(INPUT, 'w-32 text-xs')}
            />
          </Field>
        </Section>

        {/* ── Guardrails ───────────────────────────────────────────── */}
        <Section title="Guardrails" description="Per-session limits to prevent runaway agents. The budget resets when a new Pi session starts (e.g., after restart or session switch). Adjust limits or disable them by setting to 0.">
          <Field label="Max sub-agent spawns per session">
            <input
              type="number"
              min={0}
              max={10000}
              value={form.maxSubagentSpawns ?? 200}
              onChange={(e) => setForm((prev) => ({ ...prev, maxSubagentSpawns: Math.max(0, parseInt(e.target.value) || 0) }))}
              className={cn(INPUT, 'w-32 text-xs')}
            />
          </Field>
          <Field label="Max web searches per session">
            <input
              type="number"
              min={0}
              max={10000}
              value={form.maxWebSearches ?? 200}
              onChange={(e) => setForm((prev) => ({ ...prev, maxWebSearches: Math.max(0, parseInt(e.target.value) || 0) }))}
              className={cn(INPUT, 'w-32 text-xs')}
            />
          </Field>
        </Section>

        {/* ── Data ──────────────────────────────────────────────────── */}
        <Section title="Data" description="Manage locally stored chat data.">
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-foreground">Delete all sessions</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Permanently deletes all {sessionCount} session{sessionCount !== 1 ? 's' : ''} and their messages. This cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAllSessions}
              disabled={deletingAll || sessionCount === 0}
              className="shrink-0 gap-1.5"
            >
              {deletingAll ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete all
            </Button>
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">Ares</span> v0.1.0</p>
            <p>OpenCode-style AI desktop app — Electron · React · Tailwind v4 · shadcn · Pi Agent.</p>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({
  title, description, children, className
}: {
  title: string; description?: string; children: React.ReactNode; className?: string
}): React.ReactElement {
  return (
    <div className={cn('mb-5 rounded-xl border border-border bg-card p-5 surface-card', className)}>
      <h2 className="mb-0.5 text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mb-4 text-xs text-muted-foreground">{description}</p>}
      <div className={cn('space-y-4', !description && 'mt-3')}>{children}</div>
    </div>
  )
}

function Field({
  label, hint, children
}: {
  label: string; hint?: string; children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
