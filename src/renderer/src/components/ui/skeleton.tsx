import React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className, lines = 3 }: SkeletonProps): React.ReactElement {
  return (
    <div className={cn('space-y-2 p-4', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-muted animate-pulse"
          style={{ width: `${Math.max(40, 100 - i * 20)}%` }}
        />
      ))}
    </div>
  )
}

export function MessageSkeleton(): React.ReactElement {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="size-7 rounded-full bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
      </div>
    </div>
  )
}
