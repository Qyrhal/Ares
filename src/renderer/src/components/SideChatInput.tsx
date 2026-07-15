import React, { useRef, useState, useCallback } from 'react'
import { Square } from 'lucide-react'
import { SendIcon } from '@animateicons/react/lucide'
import { cn } from '@/lib/utils'

interface SideChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  onCancel?: () => void
  placeholder?: string
}

// ponytail: deliberately minimal — no attachments/mentions/commands; use the main InputBar for that
export function SideChatInput({ onSend, disabled, onCancel, placeholder }: SideChatInputProps): React.ReactElement {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, disabled, onSend])

  const canSend = text.trim().length > 0 && !disabled

  return (
    <div className="shrink-0 border-t border-border bg-card/80 px-2.5 py-2">
      <div className="flex items-end gap-1.5 rounded-lg border border-border bg-input px-2.5 py-1.5 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          disabled={disabled}
          placeholder={placeholder ?? 'Ask side chat…'}
          rows={1}
          aria-label="Side chat message"
          className="w-full flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[24px] max-h-40 leading-6 py-0.5"
        />
        {disabled && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mb-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
            aria-label="Stop generation"
          >
            <Square className="size-3 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'press-effect mb-0.5 flex size-6 shrink-0 items-center justify-center rounded-md transition-all',
              canSend
                ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                : 'text-muted-foreground opacity-40 cursor-not-allowed'
            )}
            aria-label="Send side chat message"
          >
            <SendIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
