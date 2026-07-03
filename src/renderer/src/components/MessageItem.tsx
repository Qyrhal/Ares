import React from 'react'
import { AlertCircle, CheckCircle2, File, FileText, Image, Loader2 } from 'lucide-react'
import { ChevronDownIcon, ChevronRightIcon, TerminalIcon, XIcon } from '@animateicons/react/lucide'
import { cn, formatBytes } from '@/lib/utils'
import { Message } from '@/types'
import {
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle,
  AttachmentDescription, AttachmentGroup
} from '@/components/ui/attachment'
import { Marker, MarkerIcon, MarkerContent } from '@/components/ui/marker'

interface MessageItemProps {
  message: Message
}

function fileIcon(type: string): React.ReactElement {
  if (type.startsWith('image/')) return <Image className="size-4" />
  if (type === 'application/pdf') return <FileText className="size-4" />
  return <File className="size-4" />
}

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
            <span className="shimmer text-muted-foreground text-[10px]">running…</span>
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

export function MessageItem({ message }: MessageItemProps): React.ReactElement {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const isSystem = message.role === 'system'

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
        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
      )}>
        {isUser ? 'U' : 'A'}
      </div>

      {/* Bubble */}
      <div className={cn('flex max-w-[80%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
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

        {/* Message text */}
        {message.content && (
          <div className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-card border border-border text-foreground'
          )}>
            {message.isStreaming ? (
              <span className="shimmer shimmer-duration-1500">{message.content}</span>
            ) : (
              <MessageContent content={message.content} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }): React.ReactElement {
  // Simple markdown-like rendering: code blocks, inline code
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0].trim()
          const code = lines.slice(1).join('\n')
          return (
            <pre key={i} className="my-2 -mx-1">
              {lang && <div className="mb-1 text-[10px] text-muted-foreground font-mono">{lang}</div>}
              <code>{code}</code>
            </pre>
          )
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
