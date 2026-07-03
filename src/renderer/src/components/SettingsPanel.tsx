import React, { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, ExternalLink, CheckCircle2 } from 'lucide-react'
import { AppSettings } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SettingsPanelProps {
  settings: AppSettings
  onSave: (s: AppSettings) => Promise<void>
}

const PRESET_ENDPOINTS = [
  { label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { label: 'Ollama (local)', url: 'http://localhost:11434/v1' },
  { label: 'LM Studio', url: 'http://localhost:1234/v1' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1' },
]

export function SettingsPanel({ settings, onSave }: SettingsPanelProps): React.ReactElement {
  const [form, setForm] = useState<AppSettings>(settings)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setForm(settings) }, [settings])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const set = (k: keyof AppSettings, v: string): void =>
    setForm((prev) => ({ ...prev, [k]: v }))

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <h1 className="text-xl font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Configure your AI provider and preferences.
        </p>

        {/* API Configuration */}
        <Section title="AI Provider" description="Connect to any OpenAI-compatible endpoint.">
          {/* Preset quick-select */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-2">Quick select</label>
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

          <Field label="API Base URL" hint="The base URL for your OpenAI-compatible endpoint">
            <input
              type="url"
              value={form.apiBaseUrl}
              onChange={(e) => set('apiBaseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="input-field"
            />
          </Field>

          <Field label="API Key" hint="Your API key. Stored locally on this machine only.">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => set('apiKey', e.target.value)}
                placeholder="sk-..."
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Field label="Default Model" hint="Model name to use for new sessions.">
            <input
              type="text"
              value={form.defaultModel}
              onChange={(e) => set('defaultModel', e.target.value)}
              placeholder="gpt-4o-mini"
              className="input-field"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Examples: <code className="text-primary">gpt-4o</code>,{' '}
              <code className="text-primary">gpt-4o-mini</code>,{' '}
              <code className="text-primary">llama3</code>,{' '}
              <code className="text-primary">claude-sonnet-4-6</code>
            </p>
          </Field>
        </Section>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saved
              ? <><CheckCircle2 className="size-4" /> Saved</>
              : <><Save className="size-4" /> {saving ? 'Saving…' : 'Save settings'}</>
            }
          </Button>
        </div>

        {/* About */}
        <Section title="About" className="mt-10">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
            <p><span className="text-foreground font-medium">Ares</span> v0.1.0</p>
            <p>OpenCode-style AI desktop app built with Electron, React, Tailwind v4 + shadcn.</p>
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
      <h2 className="text-sm font-semibold text-foreground mb-0.5">{title}</h2>
      {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
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
      <label className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
