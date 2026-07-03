import React, { useRef, useState, useCallback } from 'react'
import { Paperclip, Send, X, File, Image, FileText } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import { FileAttachment } from '@/types'
import {
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle,
  AttachmentDescription, AttachmentActions, AttachmentAction, AttachmentGroup
} from '@/components/ui/attachment'
import { Button } from '@/components/ui/button'
import { v4 as uuidv4 } from 'uuid'

interface InputBarProps {
  onSend: (text: string, attachments: FileAttachment[]) => void
  disabled?: boolean
  placeholder?: string
}

function fileIcon(type: string): React.ReactElement {
  if (type.startsWith('image/')) return <Image className="size-4" />
  if (type === 'application/pdf') return <FileText className="size-4" />
  return <File className="size-4" />
}

export function InputBar({ onSend, disabled, placeholder }: InputBarProps): React.ReactElement {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    onSend(trimmed, attachments)
    setText('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, attachments, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? [])
    const newAttachments: FileAttachment[] = files.map((f) => ({
      id: uuidv4(),
      name: f.name,
      size: f.size,
      type: f.type,
      path: (f as File & { path?: string }).path ?? f.name
    }))
    setAttachments((prev) => [...prev, ...newAttachments])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (id: string): void => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const newAttachments: FileAttachment[] = files.map((f) => ({
      id: uuidv4(),
      name: f.name,
      size: f.size,
      type: f.type,
      path: (f as File & { path?: string }).path ?? f.name
    }))
    setAttachments((prev) => [...prev, ...newAttachments])
  }

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled

  return (
    <div
      className="border-t border-border bg-card/80 backdrop-blur-sm px-4 pt-3 pb-4"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <AttachmentGroup className="mb-2">
          {attachments.map((att) => (
            <Attachment key={att.id} size="sm" className="max-w-48">
              <AttachmentMedia>{fileIcon(att.type)}</AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{att.name}</AttachmentTitle>
                <AttachmentDescription>{formatBytes(att.size)}</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${att.name}`}
                  onClick={() => removeAttachment(att.id)}
                  className="opacity-100"
                >
                  <X />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}

      {/* Input row */}
      <div className={cn(
        'flex items-end gap-2 rounded-xl border border-border bg-input px-3 py-2 transition-colors',
        'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20'
      )}>
        {/* File attach */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Attach file"
        >
          <Paperclip className="size-4" />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder ?? 'Ask anything… (Enter to send, Shift+Enter for newline)'}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[28px] max-h-60 leading-6 py-0.5"
        />

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
            canSend
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground opacity-40 cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <Send className="size-3.5" />
        </button>
      </div>

      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
        Ares can make mistakes. Verify important information.
      </p>
    </div>
  )
}
