import React, { useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentQuestion } from '@/types'

interface AgentQuestionCardProps {
  questions: AgentQuestion[]
  onSubmit: (answers: Record<string, string>) => void
}

export function AgentQuestionCard({ questions, onSubmit }: AgentQuestionCardProps): React.ReactElement {
  const [selected, setSelected] = useState<Record<number, string[]>>({})
  const [text, setText] = useState<Record<number, string>>({})

  const toggle = (qi: number, option: string, multiSelect: boolean): void => {
    setSelected((prev) => {
      const current = prev[qi] ?? []
      if (multiSelect) {
        return {
          ...prev,
          [qi]: current.includes(option) ? current.filter((o) => o !== option) : [...current, option],
        }
      }
      return { ...prev, [qi]: current.includes(option) ? [] : [option] }
    })
  }

  const canSubmit = questions.every((_q, i) => {
    return (selected[i] ?? []).length > 0 || (text[i] ?? '').trim().length > 0
  })

  const handleSubmit = (): void => {
    if (!canSubmit) return
    const answers: Record<string, string> = {}
    questions.forEach((q, i) => {
      const sel = selected[i] ?? []
      const custom = (text[i] ?? '').trim()
      const parts = [...sel, ...(custom ? [custom] : [])]
      answers[q.header] = parts.join(', ') || '(no answer)'
    })
    onSubmit(answers)
  }

  return (
    <div className="border-t border-border bg-card/80 px-4 py-4 space-y-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Agent has questions
      </p>

      {questions.map((q, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
              {q.header}
            </span>
            <p className="text-sm text-foreground">{q.question}</p>
          </div>

          {q.options && q.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const isSelected = (selected[i] ?? []).includes(opt)
                return (
                  <button
                    key={opt}
                    onClick={() => toggle(i, opt, q.multiSelect ?? false)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )}

          <input
            type="text"
            placeholder={q.options && q.options.length > 0 ? 'Or type a custom answer…' : 'Your answer…'}
            value={text[i] ?? ''}
            onChange={(e) => setText((prev) => ({ ...prev, [i]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit() }}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
          />
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
          canSubmit
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'cursor-not-allowed bg-muted text-muted-foreground'
        )}
      >
        <Send className="size-3" />
        Submit
      </button>
    </div>
  )
}
