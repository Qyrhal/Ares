import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AgentConfig, PiSkill } from '@/types'
import { cn } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import { CheckCircle2, ChevronDown, ChevronRight, Plus, Sparkles, Trash2 } from '@/lib/icons'

const el = window.electron

const INPUT = 'w-full rounded border border-border bg-input px-3 py-[0.4rem] text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground'

const EMPTY: AgentConfig = { skills: [], extensions: [], mcpServers: [] }

export function SkillsPanel(): React.ReactElement {
  const [config, setConfig] = useState<AgentConfig>(EMPTY)
  const [expanded, setExpanded] = useState<string | null>(null)
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

  const updateSkills = useCallback((skills: PiSkill[]) => {
    setConfig((prev) => {
      const next = { ...prev, skills }
      persist(next)
      return next
    })
  }, [persist])

  const add = () => {
    const s: PiSkill = { id: uuidv4(), name: 'New skill', description: '', content: '' }
    const next = [...config.skills, s]
    updateSkills(next)
    setExpanded(s.id)
  }

  const update = (id: string, patch: Partial<PiSkill>) =>
    updateSkills(config.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const remove = (id: string) => {
    updateSkills(config.skills.filter((s) => s.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Skills</h1>
              {saved && (
                <span className="flex items-center gap-1 text-[10px] text-green-400 animate-in fade-in">
                  <CheckCircle2 className="size-3" /> Saved
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Markdown files injected into the agent context. Invoke with <code className="rounded bg-muted px-1 text-xs">/skill:name</code>.
            </p>
          </div>
          <button
            onClick={add}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="size-3.5" /> New skill
          </button>
        </div>

        {config.skills.length === 0 ? (
          <EmptyState onAdd={add} />
        ) : (
          <div className="space-y-2">
            {config.skills.map((s) => (
              <SkillRow
                key={s.id}
                skill={s}
                open={expanded === s.id}
                onToggle={() => setExpanded((v) => (v === s.id ? null : s.id))}
                onUpdate={(patch) => update(s.id, patch)}
                onRemove={() => remove(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SkillRow({ skill, open, onToggle, onUpdate, onRemove }: {
  skill: PiSkill
  open: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<PiSkill>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden transition-shadow hover:shadow-sm">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors select-none"
        onClick={onToggle}
      >
        <Sparkles className="size-4 shrink-0 text-primary/60" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{skill.name || 'Unnamed'}</p>
          {skill.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{skill.description}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground/50 shrink-0">
          {skill.content.length > 0 ? `${skill.content.split('\n').length} lines` : 'empty'}
        </span>
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
              <input
                value={skill.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className={cn(INPUT, 'text-xs')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Description</label>
              <input
                value={skill.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Short description of this skill"
                className={cn(INPUT, 'text-xs')}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Content</label>
            <p className="mb-2 text-[11px] text-muted-foreground">Markdown injected into the agent context. The agent can invoke this with <code className="rounded bg-muted px-1">/skill:{skill.name}</code>.</p>
            <textarea
              value={skill.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={12}
              className={cn(INPUT, 'text-xs font-mono resize-y min-h-[200px]')}
              placeholder="Describe the skill workflow in Markdown..."
            />
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-dashed border-border">
        <Sparkles className="size-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No skills yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Skills teach the agent specialised workflows, imported from your .claude and .pi directories or created here.</p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
      >
        <Plus className="size-4" /> Create your first skill
      </button>
    </div>
  )
}
