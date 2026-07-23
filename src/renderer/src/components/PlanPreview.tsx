import React from 'react'
import { Sparkles, X, Check } from 'lucide-react'

interface PlanPreviewProps {
  content: string
  onApprove: () => void
  onCancel: () => void
}

export const PlanPreview = React.memo(function PlanPreview({ content, onApprove, onCancel }: PlanPreviewProps): React.ReactElement {
  return (
    <div className="border-t border-border bg-gradient-to-b from-accent/5 to-background px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Agent Plan</span>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-xs text-muted-foreground">
          {content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              <br />
            </React.Fragment>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Check className="size-3.5" />
            Execute this plan
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
})
