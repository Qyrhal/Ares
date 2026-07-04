import React from 'react'
import { Toaster as Sonner } from 'sonner'

export function Toaster(): React.ReactElement {
  return (
    <Sonner
      position="bottom-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast: 'bg-popover border border-border text-foreground text-sm shadow-lg rounded-xl',
          description: 'text-muted-foreground text-xs',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
    />
  )
}
