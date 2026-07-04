import React from 'react'
import { AlertCircle, BrainIcon, CheckCircle2, File, FileText, Image, Loader2 } from 'lucide-react'
import { ChevronDownIcon, ChevronRightIcon, TerminalIcon, XIcon } from '@animateicons/react/lucide'
import { cn, formatBytes } from '@/lib/utils'
import { Message } from '@/types'
import {
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle,
  AttachmentDescription, AttachmentGroup
} from '@/components/ui/attachment'
import { Marker, MarkerIcon, MarkerContent } from '@/components/ui/marker'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

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

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
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
          {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        </span>
      </Marker>
      {expanded && (
        <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
          <code>{content}</code>
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

        {/* Message text */}
        {message.content && (
          isUser ? (
            <div className="markdown-content rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
              {message.isStreaming ? (
                <span className="shimmer shimmer-color-primary shimmer-duration-1500 text-muted-foreground">{message.content}</span>
              ) : (
                <MessageContent content={message.content} />
              )}
            </div>
          ) : (
            <div className="markdown-content text-sm leading-relaxed text-foreground">
              {message.isStreaming ? (
                <span className="shimmer shimmer-color-primary shimmer-duration-1500 text-muted-foreground">{message.content}</span>
              ) : (
                <MessageContent content={message.content} />
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }): React.ReactElement {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
      {content}
    </ReactMarkdown>
  )
}
