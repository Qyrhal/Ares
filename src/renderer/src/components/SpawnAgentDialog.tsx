import React, { useState, useRef, useEffect } from 'react'
import { X, Bot } from '@/lib/icons'

interface SpawnAgentDialogProps {
  onSpawn: (task: string, title: string) => void
  onClose: () => void
}

export function SpawnAgentDialog({ onSpawn, onClose }: SpawnAgentDialogProps): React.ReactElement {
  const [task, setTask] = useState('')
  const [title, setTitle] = useState('')
  const taskRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    taskRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedTask = task.trim()
    if (!trimmedTask) return
    const agentTitle = title.trim() || `Agent: ${trimmedTask.slice(0, 40)}${trimmedTask.length > 40 ? '…' : ''}`
    onSpawn(trimmedTask, agentTitle)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Bot className="size-4 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground">Spawn Sub-Agent</h2>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Task */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Task / Instructions
            </label>
            <textarea
              ref={taskRef}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as any)
                if (e.key === 'Escape') onClose()
              }}
              rows={5}
              placeholder="Describe what this agent should do…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {/* Optional title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Agent Name <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated from task"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!task.trim()}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Spawn Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
