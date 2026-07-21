import React from 'react'

interface TokenBadgeProps {
  tokens: number
  tokensPerSecond?: number
  cost?: number
  duration?: number
}

export const TokenBadge = React.memo(function TokenBadge({ tokens, tokensPerSecond, cost, duration }: TokenBadgeProps): React.ReactElement {
  if (tokens === 0) return <></>
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-xs">
      <span>{tokens.toLocaleString()} tok</span>
      {tokensPerSecond !== undefined && tokensPerSecond > 0 && (
        <span className="text-[10px]">· {tokensPerSecond} tok/s</span>
      )}
      {duration !== undefined && (
        <span className="text-[10px]">· {(duration / 1000).toFixed(1)}s</span>
      )}
      {cost !== undefined && cost > 0 && (
        <span className="text-[10px]">· ${cost.toFixed(4)}</span>
      )}
    </span>
  )
})
