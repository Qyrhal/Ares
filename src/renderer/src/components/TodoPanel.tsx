import React, { useState } from 'react'
import { CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Todo } from '@/types'

interface TodoPanelProps {
  todos: Todo[]
}

export function TodoPanel({ todos }: TodoPanelProps): React.ReactElement {
  const [open, setOpen] = useState(true)

  const done = todos.filter((t) => t.completed).length
  const pending = todos.filter((t) => !t.completed)
  const completed = todos.filter((t) => t.completed)

  return (
    <div className="border-b border-border bg-card/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <CheckSquare className="size-3.5 text-primary shrink-0" />
        <span className="font-medium">
          Plan
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

      {open && todos.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {pending.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
          {completed.length > 0 && (
            <div className="mt-2 space-y-1">
              {completed.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            </div>
          )}
        </div>
      )}

      {open && todos.length === 0 && (
        <p className="px-4 pb-3 text-xs text-muted-foreground/50 italic">
          The agent will outline its plan here.
        </p>
      )}
    </div>
  )
}

function TodoItem({ todo }: { todo: Todo }): React.ReactElement {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <div className="mt-0.5 shrink-0 text-muted-foreground">
        {todo.completed
          ? <CheckSquare className="size-3.5 text-primary" />
          : <Square className="size-3.5" />
        }
      </div>
      <span className={cn(
        'flex-1 text-xs leading-relaxed',
        todo.completed ? 'line-through text-muted-foreground/50' : 'text-foreground'
      )}>
        {todo.text}
      </span>
    </div>
  )
}
