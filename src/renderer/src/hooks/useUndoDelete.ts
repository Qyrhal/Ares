import React from 'react'
import { toast } from 'sonner'

export function useUndoDelete() {
  const lastDeleted = React.useRef<{ id: string; sessionId: string; content: string } | null>(null)

  const deleteWithUndo = React.useCallback((msg: { id: string; sessionId: string; content: string }, onRestore: (msg: any) => void) => {
    lastDeleted.current = msg
    toast('Message deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          if (lastDeleted.current) onRestore(lastDeleted.current)
          lastDeleted.current = null
        },
      },
      duration: 5000,
    })
  }, [])

  return { deleteWithUndo }
}
