import React, { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Save } from 'lucide-react'
import { EyeIcon, EyeOffIcon, WifiIcon, WifiOffIcon } from '@animateicons/react/lucide'
import { AppSettings } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { THEMES, applyTheme, DEFAULT_THEME_ID } from '@/lib/theme'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (s: AppSettings) => Promise<void>
}

const PRESET_ENDPOINTS = [
  { label: 'OpenAI',      url: 'https://api.openai.com/v1' },
  { label: 'Ollama',      url: 'http://localhost:11434/v1' },
  { label: 'LM Studio',   url: 'http://localhost:1234/v1' },
  { label: 'Groq',        url: 'https://api.groq.com/openai/v1' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1' },
  { label: 'Anthropic',   url: 'https://api.anthropic.com/v1' },
]

type ConnStatus = 'idle' | 'loading' | 'ok' | 'error'

// Well-known fallback models when the API doesn't list them
const FALLBACK_MODELS: SelectOption[] = [
  { value: 'gpt-4o',              label: 'GPT-4o',              group: 'OpenAI' },
  { value: 'gpt-4o-mini',         label: 'GPT-4o Mini',         group: 'OpenAI' },
  { value: 'gpt-4-turbo',         label: 'GPT-4 Turbo',         group: 'OpenAI' },
  { value: 'o1-mini',             label: 'o1 Mini',             group: 'OpenAI' },
  { value: 'claude-opus-4-8',     label: 'Claude Opus 4.8',     group: 'Anthropic' },
  { value: 'claude-sonnet-4-6',   label: 'Claude Sonnet 4.6',   group: 'Anthropic' },
  { value: 'llama3',              label: 'Llama 3',             group: 'Local' },
  { value: 'llama3.1',            label: 'Llama 3.1',           group: 'Local' },
  { value: 'mistral',             label: 'Mistral',             group: 'Local' },
  { value: 'codellama',           label: 'Code Llama',          group: 'Local' },
  { value: 'deepseek-coder',      label: 'DeepSeek Coder',      group: 'Local' },
]

export function SettingsPanel({ settings, onSave }: SettingsPanelProps): React.ReactElement {
  const [form, setForm] = useState<AppSettings>(settings)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [connStatus, setConnStatus] = useState<ConnStatus>('idle')
  const [connMessage, setConnMessage] = useState('')
  const [fetchedModels, setFetchedModels] = useState<SelectOption[]>([])

  useEffect(() => { setForm(settings) }, [settings])

  // Reset connection status when URL or key changes
  useEffect(() => {
    setConnStatus('idle')
    setConnMessage('')
  }, [form.apiBaseUrl, form.apiKey])

  const set = (k: keyof AppSettings, v: string): void =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestAndFetch = useCallback(async (): Promise<void> => {
    const baseUrl = form.apiBaseUrl.replace(/\/$/, '')
    const apiKey = form.apiKey

    setConnStatus('loading')
    setConnMessage('')
    setFetchedModels([])

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

      const res = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000)
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }

      const json = await res.json()
      const models: SelectOption[] = (json.data ?? [])
        .map((m: { id: string }) => ({ value: m.id, label: m.id }))
        .sort((a: SelectOption, b: SelectOption) => a.value.localeCompare(b.value))

      setFetchedModels(models)
      setConnStatus('ok')
      setConnMessage(`Connected · ${models.length} model${models.length !== 1 ? 's' : ''} available`)

      // Auto-select first model if none set
      if (!form.defaultModel && models.length > 0) {
        set('defaultModel', models[0].value)
      }
    } catch (err) {
      setConnStatus('error')
      setConnMessage((err as Error).message)
    }
  }, [form.apiBaseUrl, form.apiKey, form.defaultModel])

  const modelOptions: SelectOption[] = fetchedModels.length > 0 ? fetchedModels : FALLBACK_MODELS
  const currentModelInList = modelOptions.some((m) => m.value === form.defaultModel)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Settings</h1>
        <p className="mb-8 text-sm text-muted-foreground">Configure your AI provider and preferences.</p>

        {/* ── AI Provider ───────────────────────────────────────────────── */}
        <Section title="AI Provider" description="Connect to any OpenAI-compatible endpoint.">

          {/* Preset buttons */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Quick select</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ENDPOINTS.map((p) => (
                <button
                  key={p.url}
                  onClick={() => set('apiBaseUrl', p.url)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    form.apiBaseUrl === p.url
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="API Base URL">
            <input
              type="url"
              value={form.apiBaseUrl}
              onChange={(e) => set('apiBaseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="input-field"
            />
          </Field>

          <Field label="API Key">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)}
                  placeholder="sk-…"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAndFetch}
                disabled={connStatus === 'loading' || !form.apiBaseUrl}
                className="shrink-0 gap-1.5"
              >
                {connStatus === 'loading'
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <RefreshCw className="size-3.5" />}
                Test & fetch models
              </Button>
            </div>

            {/* Connection status feedback */}
            {connStatus !== 'idle' && (
              <div className={cn(
                'mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                connStatus === 'ok'      && 'border-green-500/30 bg-green-500/10 text-green-400',
                connStatus === 'error'   && 'border-destructive/30 bg-destructive/10 text-destructive',
                connStatus === 'loading' && 'border-border bg-muted/30 text-muted-foreground'
              )}>
                {connStatus === 'ok'      && <WifiIcon className="size-3.5 shrink-0" />}
                {connStatus === 'error'   && <WifiOffIcon className="size-3.5 shrink-0" />}
                {connStatus === 'loading' && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
                {connStatus === 'loading' ? 'Connecting…' : connMessage}
              </div>
            )}
          </Field>

          {/* Model selector */}
          <Field
            label="Default model"
            hint={fetchedModels.length > 0
              ? `${fetchedModels.length} models fetched from your endpoint`
              : 'Select from presets or type your own'}
          >
            <div className="space-y-2">
              <Select
                value={form.defaultModel}
                onChange={(v) => set('defaultModel', v)}
                options={modelOptions}
                placeholder="Choose a model…"
                searchable
              />
              {!currentModelInList && form.defaultModel && (
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
                className="input-field text-xs"
              />
            </div>
          </Field>
        </Section>

        {/* ── Theme ─────────────────────────────────────────────────── */}
        <Section title="Accent colour" description="Choose the highlight colour used throughout the interface.">
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
                  {/* Swatch */}
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
        </Section>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saved
              ? <><CheckCircle2 className="size-4" /> Saved</>
              : <><Save className="size-4" /> {saving ? 'Saving…' : 'Save settings'}</>}
          </Button>
        </div>

        {/* About */}
        <Section title="About" className="mt-10">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">Ares</span> v0.1.0</p>
            <p>OpenCode-style AI desktop app — Electron · React · Tailwind v4 · shadcn.</p>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title, description, children, className
}: {
  title: string; description?: string; children: React.ReactNode; className?: string
}): React.ReactElement {
  return (
    <div className={cn('mb-8', className)}>
      <h2 className="mb-0.5 text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mb-4 text-xs text-muted-foreground">{description}</p>}
      <div className="space-y-4">{children}</div>
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
