import React, { useEffect, useRef } from 'react'
import { SparklesIcon } from '@animateicons/react/lucide'
import { Message } from '@/types'
import { MessageItem } from './MessageItem'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatViewProps {
  messages: Message[]
  sessionTitle: string
  isLoading: boolean
}

export function ChatView({ messages, sessionTitle, isLoading }: ChatViewProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <SparklesIcon className="size-8 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{sessionTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Start a conversation. Ask questions, write code, analyze files, or brainstorm ideas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-2">
          {SUGGESTIONS.map((s) => (
            <div
              key={s}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground cursor-default hover:border-primary/30 hover:bg-accent transition-colors"
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1" viewportRef={viewportRef}>
      <div className="py-4">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex gap-3 px-4 py-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-xs font-bold text-muted-foreground">
              A
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-2.5">
              <span className="shimmer shimmer-duration-1500 text-sm text-muted-foreground">
                Thinking…
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}

const SUGGESTIONS = [
  'Explain this code',
  'Write a function',
  'Debug an error',
  'Review my PR'
]
