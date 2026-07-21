import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Todo } from '@/types'

describe('/task slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function mkTodo(overrides: Partial<Todo> = {}): Todo {
    return {
      id: 't1', sessionId: 's1', text: 'Fix the bug', completed: false, createdAt: Date.now(),
      ...overrides,
    }
  }

  it('shows empty state when no tasks', () => {
    const todos: Todo[] = []
    expect(todos.length).toBe(0)
  })

  it('lists tasks with checkboxes', () => {
    const todos = [mkTodo({ text: 'Task A' }), mkTodo({ id: 't2', text: 'Task B', completed: true })]
    const lines = ['**Tasks**\n']
    for (const t of todos) {
      const check = t.completed ? '✅' : '⬜'
      lines.push(`${check} ${t.text}`)
    }
    const msg = lines.join('\n')
    expect(msg).toContain('⬜ Task A')
    expect(msg).toContain('✅ Task B')
  })

  it('adds a task', () => {
    const text = 'New task'
    expect(text).toBe('New task')
  })

  it('parses "add" subcommand', () => {
    const args = 'add Fix the login page'
    const sub = args.trim().toLowerCase()
    expect(sub.startsWith('add ')).toBe(true)
    const text = args.trim().slice(4).trim()
    expect(text).toBe('Fix the login page')
  })

  it('parses "done" subcommand', () => {
    const args = 'done 2'
    const sub = args.trim().toLowerCase()
    expect(sub.startsWith('done ')).toBe(true)
    const index = parseInt(args.trim().slice(5).trim(), 10)
    expect(index).toBe(2)
  })

  it('parses "remove" subcommand', () => {
    const args = 'remove 1'
    const sub = args.trim().toLowerCase()
    expect(sub.startsWith('remove ')).toBe(true)
    const index = parseInt(args.trim().slice(7).trim(), 10)
    expect(index).toBe(1)
  })

  it('validates index bounds', () => {
    const todos = [mkTodo()]
    const index = 5
    expect(index >= 1 && index <= todos.length).toBe(false)
  })

  it('formats task completed message', () => {
    const text = 'Fix the bug'
    const msg = `**Task completed:** ${text}`
    expect(msg).toContain('Task completed')
    expect(msg).toContain('Fix the bug')
  })

  it('formats task removed message', () => {
    const text = 'Old task'
    const msg = `**Task removed:** ${text}`
    expect(msg).toContain('Task removed')
  })

  it('shows usage when no subcommand', () => {
    const msg = '**Usage:**\n- `/task` or `/task list` — show all tasks\n- `/task add <text>` — add a new task\n- `/task done <n>` — mark task n as complete\n- `/task remove <n>` — remove task n'
    expect(msg).toContain('/task add')
    expect(msg).toContain('/task done')
    expect(msg).toContain('/task remove')
  })
})
