import React, { useCallback, useEffect, useState } from 'react'
import { AppSettings } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { THEMES, applyTheme, DEFAULT_THEME_ID } from '@/lib/theme'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Save, EyeIcon, EyeOffIcon, WifiIcon, WifiOffIcon } from '@/lib/icons'

const el = window.electron

const INPUT = 'w-full rounded border border-border bg-input px-3 py-[0.4rem] text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground'

const SKILL_PROMPT = `You are an AI coding assistant with full read/write access to the user's workspace. You can perform the following operations:

1. readFile(path) — Read the full contents of any file.
2. writeFile(path, content) — Write new content to a file (creates directories, overwrites existing).
3. editFile(path, oldString, newString) — Find-and-replace text in an existing file. Use this for targeted changes.
4. createFile(path, content) — Create a brand new file (fails if it already exists).
5. listFiles(dir) — List files and directories (excludes hidden files and node_modules).

ALWAYS prefer editFile over writeFile for making changes to existing files — it preserves surrounding context. Use writeFile only when replacing an entire file or creating a file that already needs to exist.`

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
]

type ConnStatus = 'idle' | 'loading' | 'ok' | 'error'

export function SettingsPanel({ settings, onSave }: SettingsPanelProps): React.ReactElement {
  const [form, setForm] = useState<AppSettings>(settings)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [connStatus, setConnStatus] = useState<ConnStatus>('idle')
  const [connMessage, setConnMessage] = useState('')
  const [fetchedModels, setFetchedModels] = useState<SelectOption[]>([])

  useEffect(() => { setForm(settings) }, [settings])

  // Auto-fetch models when URL or key changes
  useEffect(() => {
    const baseUrl = form.apiBaseUrl.replace(/\/$/, '')
    if (!baseUrl) return

    const timer = setTimeout(async () => {
      setConnStatus('loading')
      setConnMessage('')
      setFetchedModels([])

      try {
        const json = await el.ext.fetchModels(baseUrl, form.apiKey)
        const models: SelectOption[] = (json.data ?? [])
          .map((m: { id: string }) => ({ value: m.id, label: m.id }))
          .sort((a: SelectOption, b: SelectOption) => a.value.localeCompare(b.value))

        setFetchedModels(models)
        setConnStatus('ok')
        setConnMessage(`Connected · ${models.length} model${models.length !== 1 ? 's' : ''} available`)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setConnStatus('error')
        setConnMessage((err as Error).message)
      }
    }, 600)

    return () => { clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const json = await el.ext.fetchModels(baseUrl, apiKey)
      const models: SelectOption[] = (json.data ?? [])
        .map((m: { id: string }) => ({ value: m.id, label: m.id }))
        .sort((a: SelectOption, b: SelectOption) => a.value.localeCompare(b.value))

      setFetchedModels(models)
      setConnStatus('ok')
      setConnMessage(`Connected · ${models.length} model${models.length !== 1 ? 's' : ''} available`)
    } catch (err) {
      setConnStatus('error')
      setConnMessage((err as Error).message)
    }
  }, [form.apiBaseUrl, form.apiKey])

  const modelOptions: SelectOption[] = fetchedModels
  const currentModelInList = modelOptions.some((m) => m.value === form.defaultModel)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Settings</h1>
        <p className="mb-8 text-sm text-muted-foreground">Configure your AI endpoint and preferences.</p>

        {/* ── AI Endpoint ────────────────────────────────────────────── */}
        <Section title="AI endpoint" description="Connect to any OpenAI-compatible API. Ares uses Pi Agent as its runtime, so it works with any server that speaks the OpenAI chat completions protocol.">

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
              className={INPUT}
            />
          </Field>

          <Field label="API Key">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)}
                  placeholder="sk-… (leave blank for local servers)"
                  className={cn(INPUT, 'pr-10')}
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

          <Field
            label="Default model"
            hint={connStatus === 'ok'
              ? `${fetchedModels.length} models fetched from your endpoint`
              : connStatus === 'error'
                ? 'Could not fetch models — type a model ID below'
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

        {/* ── System prompt ─────────────────────────────��────────────── */}
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

          <Field label="Skill prompt (auto-injected)" hint="This is automatically added so the AI knows its capabilities. Not editable.">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
              {SKILL_PROMPT.trim()}
            </div>
          </Field>
        </Section>

        {/* ── Permissions ────────────────────────────���─────────────────── */}
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
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                    form.permissionMode === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
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
