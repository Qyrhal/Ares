import * as React from 'react'
import { cn } from '@/lib/utils'

type MarkerVariant = 'default' | 'border' | 'separator'

interface MarkerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: MarkerVariant
  asChild?: boolean
}

const Marker = React.forwardRef<HTMLDivElement, MarkerProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      data-variant={variant}
      className={cn(
        'flex items-center gap-2 py-1 text-xs text-muted-foreground',
        variant === 'border' && 'border-b border-border pb-2 mb-1',
        variant === 'separator' && [
          'justify-center',
          'before:flex-1 before:border-t before:border-border',
          'after:flex-1 after:border-t after:border-border'
        ],
        className
      )}
      {...props}
    />
  )
)
Marker.displayName = 'Marker'

const MarkerIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn('flex shrink-0 items-center [&_svg]:size-3', className)}
      {...props}
    />
  )
)
MarkerIcon.displayName = 'MarkerIcon'

const MarkerContent = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn('', className)} {...props} />
  )
)
MarkerContent.displayName = 'MarkerContent'

export { Marker, MarkerIcon, MarkerContent }
