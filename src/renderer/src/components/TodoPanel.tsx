import React, { useState, useRef, useEffect } from 'react'
import { CheckSquare, Square, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Todo } from '@/types'

interface TodoPanelProps {
  todos: Todo[]
  onAdd: (text: string) => void
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}

export function TodoPanel({ todos, onAdd, onToggle, onDelete }: TodoPanelProps): React.ReactElement {
  const [open, setOpen] = useState(true)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const done = todos.filter((t) => t.completed).length
  const pending = todos.filter((t) => !t.completed)
  const completed = todos.filter((t) => t.completed)

  function submit() {
    const text = input.trim()
    if (!text) return
    onAdd(text)
    setInput('')
  }

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <div className="border-b border-border bg-card/50">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <CheckSquare className="size-3.5 text-primary shrink-0" />
        <span className="font-medium">
          Todos
          {todos.length > 0 && (
            <span className="ml-1.5 text-muted-foreground/60">
              {done}/{todos.length}
            </span>
          )}
        </span>
        <div className="ml-auto">
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1">
          {/* Pending todos */}
          {pending.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
          ))}

          {/* Completed todos */}
          {completed.length > 0 && (
            <div className="mt-2 space-y-1">
              {completed.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
              ))}
            </div>
          )}

          {/* Add input */}
          <div className="flex items-center gap-2 mt-2">
            <Plus className="size-3 text-muted-foreground/50 shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') setInput('')
              }}
              placeholder="Add a task…"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function TodoItem({
  todo, onToggle, onDelete
}: {
  todo: Todo
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}): React.ReactElement {
  return (
    <div className="group flex items-start gap-2 rounded py-0.5">
      <button
        onClick={() => onToggle(todo.id, !todo.completed)}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        {todo.completed
          ? <CheckSquare className="size-3.5 text-primary" />
          : <Square className="size-3.5" />
        }
      </button>
      <span className={cn(
        'flex-1 text-xs leading-relaxed',
        todo.completed ? 'line-through text-muted-foreground/50' : 'text-foreground'
      )}>
        {todo.text}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  )
}
