import * as React from 'react'
import { cn } from '@/lib/utils'

// -- Root
interface AttachmentProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: 'idle' | 'uploading' | 'processing' | 'error' | 'done'
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
}

const Attachment = React.forwardRef<HTMLDivElement, AttachmentProps>(
  ({ className, state = 'idle', orientation = 'horizontal', size = 'md', ...props }, ref) => (
    <div
      ref={ref}
      data-state={state}
      data-orientation={orientation}
      data-size={size}
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-card-foreground transition-colors',
        orientation === 'vertical' && 'flex-col items-start',
        size === 'sm' && 'p-1.5 gap-1.5',
        size === 'lg' && 'p-3 gap-3',
        state === 'error' && 'border-destructive/50 bg-destructive/5',
        state === 'done' && 'border-primary/30',
        className
      )}
      {...props}
    />
  )
)
Attachment.displayName = 'Attachment'

// -- Media (icon / image preview)
const AttachmentMedia = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4',
        className
      )}
      {...props}
    />
  )
)
AttachmentMedia.displayName = 'AttachmentMedia'

// -- Content wrapper
const AttachmentContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('min-w-0 flex-1', className)} {...props} />
  )
)
AttachmentContent.displayName = 'AttachmentContent'

// -- Title
const AttachmentTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('truncate text-sm font-medium leading-none', className)} {...props} />
  )
)
AttachmentTitle.displayName = 'AttachmentTitle'

// -- Description
const AttachmentDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('mt-0.5 truncate text-xs text-muted-foreground', className)} {...props} />
  )
)
AttachmentDescription.displayName = 'AttachmentDescription'

// -- Actions container
const AttachmentActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('ml-auto flex shrink-0 items-center gap-1', className)} {...props} />
  )
)
AttachmentActions.displayName = 'AttachmentActions'

// -- Individual action button
const AttachmentAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 [&_svg]:size-3.5',
        className
      )}
      {...props}
    />
  )
)
AttachmentAction.displayName = 'AttachmentAction'

// -- Group (scrollable row of attachments)
const AttachmentGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-wrap gap-2', className)}
      {...props}
    />
  )
)
AttachmentGroup.displayName = 'AttachmentGroup'

export {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentGroup
}
