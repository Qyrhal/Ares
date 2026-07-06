import React from 'react'
import { AlertTriangle, File } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface LargeFileBannerProps {
  fileName: string
  fileSize: number
  onOpen: () => void
  onCancel: () => void
}

export function LargeFileBanner({ fileName, fileSize, onOpen, onCancel }: LargeFileBannerProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-yellow-500/10">
        <AlertTriangle className="size-6 text-yellow-500" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground">Large file detected</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          <span className="font-medium">{fileName}</span> is {formatBytes(fileSize)}.
          Opening large files may slow down the editor.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onOpen}
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Open anyway
        </button>
      </div>
    </div>
  )
}
