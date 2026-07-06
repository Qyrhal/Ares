import React from 'react'
import { AlertCircle, BrainIcon, CheckCircle2, File, FileText, Image, Loader2, Reply, Pencil, Copy, Check, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { ChevronDownIcon, ChevronRightIcon, TerminalIcon, XIcon } from '@animateicons/react/lucide'
import { cn, formatBytes } from '@/lib/utils'
import { Message } from '@/types'
import {
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle,
  AttachmentDescription, AttachmentGroup
} from '@/components/ui/attachment'
import { Marker, MarkerIcon, MarkerContent } from '@/components/ui/marker'
import { Tooltip } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

interface MessageItemProps {
  message: Message
  onReply?: (message: Message) => void
  onEdit?: (id: string, content: string) => void
  onDelete?: (message: Message) => void
  onReact?: (id: string, reactions: { up: boolean | null }) => void
}

function formatMessageTime(createdAt: number): string {
  const date = new Date(createdAt)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (isToday) return time
  if (isYesterday) return `Yesterday, ${time}`

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + time
}

function formatFullDate(createdAt: number): string {
  return new Date(createdAt).toLocaleString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  })
}

function fileIcon(type: string): React.ReactElement {
  if (type.startsWith('image/')) return <Image className="size-4" />
  if (type === 'application/pdf') return <FileText className="size-4" />
  return <File className="size-4" />
}

// ── Code block component with copy button ─────────────────────────────────────

function CodeBlock({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>): React.ReactElement {
  const [copied, setCopied] = React.useState(false)
  const text = React.useMemo(() => String(children ?? '').replace(/\n$/, ''), [children])

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])

  // Only add the copy button for fenced code blocks (pre > code)
  const isInline = !className && !text.includes('\n')

  if (isInline) {
    return <code className={className} {...props}>{children}</code>
  }

  return (
    <div className="group relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition-opacity z-10"
        aria-label={copied ? 'Copied' : 'Copy code'}
      >
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </button>
      <pre>
        <code className={className} {...props}>{children}</code>
      </pre>
    </div>
  )
}

// ── Tool call block ───────────────────────────────────────────────────────────

function ToolCallBlock({ message }: { message: Message }): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const statusIcon = {
    running: <Loader2 className="size-3 animate-spin" />,
    done: <CheckCircle2 className="size-3 text-green-500" />,
    error: <AlertCircle className="size-3 text-destructive" />
  }[message.toolStatus ?? 'running']

  return (
    <div className="my-1">
      <Marker variant="default" className="cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <MarkerIcon>{statusIcon}</MarkerIcon>
        <MarkerContent className="flex items-center gap-1.5">
          <TerminalIcon className="size-3" />
          <span className="font-mono text-[11px]">{message.toolName}</span>
          {message.toolStatus === 'running' && (
            <span className="shimmer shimmer-color-primary text-muted-foreground text-[10px]">running…</span>
          )}
        </MarkerContent>
        <span className="ml-auto">
          {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        </span>
      </Marker>
      {expanded && message.toolInput && (
        <pre className="mt-1 text-[11px]">
          <code>{message.toolInput}</code>
        </pre>
      )}
      {expanded && message.toolOutput && (
        <pre className="mt-1 text-[11px] border-primary/20">
          <code>{message.toolOutput}</code>
        </pre>
      )}
    </div>
  )
}

// ── Thinking block ────────────────────────────────────────────────────────────

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const isOpen = isStreaming || expanded
  return (
    <div className="my-1 w-full">
      <Marker variant="default" className="cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <MarkerIcon>
          {isStreaming
            ? <Loader2 className="size-3 animate-spin text-muted-foreground" />
            : <BrainIcon className="size-3 text-muted-foreground" />}
        </MarkerIcon>
        <MarkerContent className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            {isStreaming ? 'Thinking…' : 'Thought'}
          </span>
        </MarkerContent>
        <span className="ml-auto">
          {isOpen ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        </span>
      </Marker>
      {isOpen && (
        <pre className="mt-1 max-h-56 overflow-y-auto text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
          <code>{content}</code>
          {isStreaming && <span className="inline-block w-px h-[0.75em] bg-muted-foreground/70 ml-0.5 animate-pulse align-middle" />}
        </pre>
      )}
    </div>
  )
}

// ── Reply quote block ─────────────────────────────────────────────────────────

function ReplyQuote({ replyTo }: { replyTo: NonNullable<Message['replyTo']> }): React.ReactElement {
  return (
    <div className="mb-1.5 pl-3 border-l-2 border-primary/40">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Reply className="size-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {replyTo.role === 'user' ? 'You' : 'Assistant'}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-snug">
        {replyTo.content}
      </p>
    </div>
  )
}

// ── Edit mode ─────────────────────────────────────────────────────────────────

function EditMode({
  initialContent,
  onSave,
  onCancel,
}: {
  initialContent: string
  onSave: (content: string) => void
  onCancel: () => void
}): React.ReactElement {
  const [text, setText] = React.useState(initialContent)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
    const ta = inputRef.current
    if (ta) {
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(text) }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 min-h-[60px]"
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(text)}
          className="rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ── Main MessageItem ──────────────────────────────────────────────────────────

export function MessageItem({ message, onReply, onEdit, onDelete, onReact }: MessageItemProps): React.ReactElement {
  const [isEditing, setIsEditing] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'
  const isSystem = message.role === 'system'

  const handleCopyMessage = React.useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      toast.success('Copied to clipboard', { duration: 1500 })
      setTimeout(() => setCopied(false), 2000)
    })
  }, [message.content])

  const handleEditSave = React.useCallback((content: string) => {
    onEdit?.(message.id, content)
    setIsEditing(false)
  }, [message.id, onEdit])

  const handleDelete = React.useCallback(() => {
    onDelete?.(message)
  }, [message, onDelete])

  const handleReaction = React.useCallback((up: boolean) => {
    const current = message.reactions?.up
    const next = current === up ? null : up
    onReact?.(message.id, { up: next })
  }, [message.id, message.reactions, onReact])

  if (isSystem) {
    return (
      <Marker variant="separator" className="my-4 px-4">
        <MarkerContent>{message.content}</MarkerContent>
      </Marker>
    )
  }

  if (isTool) {
    return (
      <div className="px-4 py-1">
        <ToolCallBlock message={message} />
      </div>
    )
  }

  return (
    <div className={cn('group flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-primary text-primary-foreground text-xs font-bold' : 'bg-muted text-muted-foreground border border-border'
      )}>
        {isUser ? 'U' : (
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="8" />
            <rect x="5" y="5" width="10" height="10" rx="1" transform="rotate(45 10 10)" />
          </svg>
        )}
      </div>

      {/* Bubble */}
      <div className={cn('flex max-w-[80%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
        {/* Hover actions bar */}
        <div className={cn(
          'flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'flex-row-reverse' : 'flex-row',
          'mb-0.5'
        )}>
          {/* Copy message button */}
          <Tooltip content="Copy message">
            <button
              onClick={handleCopyMessage}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Copy message"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          </Tooltip>

          {/* Reply button */}
          {onReply && (
            <Tooltip content="Reply">
              <button
                onClick={() => onReply(message)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Reply to message"
              >
                <Reply className="size-3" />
              </button>
            </Tooltip>
          )}

          {/* Edit button (user messages only) */}
          {isUser && onEdit && !isEditing && (
            <Tooltip content="Edit message">
              <button
                onClick={() => setIsEditing(true)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Edit message"
              >
                <Pencil className="size-3" />
              </button>
            </Tooltip>
          )}

          {/* Delete button */}
          {onDelete && (
            <Tooltip content="Delete message">
              <button
                onClick={handleDelete}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                aria-label="Delete message"
              >
                <Trash2 className="size-3" />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Timestamp */}
        <span
          className="text-[10px] text-muted-foreground/60 select-none"
          title={formatFullDate(message.createdAt)}
        >
          {formatMessageTime(message.createdAt)}
        </span>

        {/* Reply quote chain */}
        {message.replyTo && (
          <ReplyQuote replyTo={message.replyTo} />
        )}

        {/* Attachments above text for user messages */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <AttachmentGroup>
            {message.attachments.map((att) => (
              <Attachment key={att.id} size="sm" state="done" className="max-w-48">
                <AttachmentMedia>{fileIcon(att.type)}</AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{att.name}</AttachmentTitle>
                  <AttachmentDescription>{formatBytes(att.size)}</AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ))}
          </AttachmentGroup>
        )}

        {/* Thinking block (assistant only) */}
        {!isUser && message.thinking && (
          <ThinkingBlock content={message.thinking} isStreaming={message.isStreaming && !message.content} />
        )}

        {/* Message text — edit mode or rendered */}
        {message.content && isEditing ? (
          <div className="w-full">
            <EditMode
              initialContent={message.content}
              onSave={handleEditSave}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : message.content && (
          isUser ? (
            <div className="markdown-content rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
              <MessageContent content={message.content} />
            </div>
          ) : (
            <div className="markdown-content text-sm leading-relaxed text-foreground">
              {message.isStreaming ? (
                <StreamingContent content={message.content} />
              ) : (
                <MessageContent content={message.content} />
              )}
            </div>
          )
        )}

        {/* Reactions (assistant messages only) */}
        {isAssistant && !message.isStreaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
            <button
              onClick={() => handleReaction(true)}
              className={cn(
                'flex size-6 items-center justify-center rounded-md transition-colors',
                message.reactions?.up === true
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              aria-label="Thumbs up"
            >
              <ThumbsUp className="size-3" />
            </button>
            <button
              onClick={() => handleReaction(false)}
              className={cn(
                'flex size-6 items-center justify-center rounded-md transition-colors',
                message.reactions?.up === false
                  ? 'bg-destructive/10 text-destructive'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              aria-label="Thumbs down"
            >
              <ThumbsDown className="size-3" />
            </button>
          </div>
        )}

        {/* Token summary (non-streaming assistant only) */}
        {isAssistant && !message.isStreaming && (message.tokenCount !== undefined || message.duration !== undefined) && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <span>{message.tokenCount?.toLocaleString() ?? '?'} tok</span>
              {message.duration !== undefined && message.duration > 0 && (
                <span>· {(message.duration / 1000).toFixed(1)}s</span>
              )}
              {message.duration !== undefined && message.duration > 0 && message.tokenCount !== undefined && message.tokenCount > 0 && (
                <span>· {Math.round(message.tokenCount / (message.duration / 1000))} tok/s</span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Streaming content ─────────────────────────────────────────────────────────

function StreamingContent({ content }: { content: string }): React.ReactElement {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{ code: CodeBlock }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── Rendered message content ──────────────────────────────────────────────────

function MessageContent({ content }: { content: string }): React.ReactElement {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{ code: CodeBlock }}
    >
      {content}
    </ReactMarkdown>
  )
}
