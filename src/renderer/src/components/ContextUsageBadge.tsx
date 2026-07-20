import { useMemo } from 'react'
import { Gauge } from 'lucide-react'
import type { Message } from '@/types'
import { estimateTokens, contextWindow } from '@/lib/context'
import { cn } from '@/lib/utils'

interface ContextUsageBadgeProps {
  messages: Message[]
  model: string
}

export function ContextUsageBadge({ messages, model }: ContextUsageBadgeProps): React.ReactElement {
  const { pct, used, total } = useMemo(() => {
    const used = estimateTokens(messages)
    const total = contextWindow(model)
    const pct = Math.min(100, Math.round((used / total) * 100))
    return { pct, used, total }
  }, [messages, model])

  const color =
    pct < 50
      ? 'green'
      : pct < 75
        ? 'yellow'
        : pct < 90
          ? 'orange'
          : 'red'

  const textColor =
    color === 'green'
      ? 'text-green-500'
      : color === 'yellow'
        ? 'text-yellow-500'
        : color === 'orange'
          ? 'text-orange-500'
          : 'text-red-500'

  const barColor =
    color === 'green'
      ? 'bg-green-500'
      : color === 'yellow'
        ? 'bg-yellow-500'
        : color === 'orange'
          ? 'bg-orange-500'
          : 'bg-red-500'

  return (
    <span
      className={cn('flex items-center gap-1 shrink-0', textColor)}
      title={`Context: ${used.toLocaleString()} / ${total.toLocaleString()} tokens (${pct}%)`}
    >
      <Gauge className="size-3" />
      <span className="relative h-[6px] w-10 overflow-hidden rounded-sm bg-muted">
        <span
          className={cn('absolute inset-y-0 left-0 rounded-sm', barColor, color === 'red' && 'animate-pulse')}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-mono text-[9.5px]">Ctx {pct}%</span>
    </span>
  )
}
