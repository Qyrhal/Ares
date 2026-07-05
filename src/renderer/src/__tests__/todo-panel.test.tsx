import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TodoPanel } from '../components/TodoPanel'
import type { Todo } from '@/types'

function mkTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 't1', sessionId: 's1', text: 'Write tests',
    completed: false, createdAt: 0, ...overrides,
  }
}

const DEFAULT_PROPS = {
  todos: [] as Todo[],
  onAdd: vi.fn(),
  onToggle: vi.fn(),
  onDelete: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TodoPanel — header', () => {
  it('renders "Todos" heading', () => {
    render(<TodoPanel {...DEFAULT_PROPS} />)
    expect(screen.getByText('Todos')).toBeInTheDocument()
  })

  it('does not show count when todos list is empty', () => {
    render(<TodoPanel {...DEFAULT_PROPS} />)
    expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument()
  })

  it('shows done/total count when todos present', () => {
    const todos = [
      mkTodo({ id: 't1', completed: true }),
      mkTodo({ id: 't2', completed: false }),
      mkTodo({ id: 't3', completed: false }),
    ]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} />)
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('updates count as all todos are completed', () => {
    const todos = [
      mkTodo({ id: 't1', completed: true }),
      mkTodo({ id: 't2', completed: true }),
    ]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} />)
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })
})

describe('TodoPanel — collapse / expand', () => {
  it('is expanded by default showing the add input', () => {
    render(<TodoPanel {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText('Add a task…')).toBeInTheDocument()
  })

  it('hides content when header is clicked', () => {
    render(<TodoPanel {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('Todos'))
    expect(screen.queryByPlaceholderText('Add a task…')).not.toBeInTheDocument()
  })

  it('re-expands on second header click', () => {
    render(<TodoPanel {...DEFAULT_PROPS} />)
    const header = screen.getByText('Todos')
    fireEvent.click(header)
    fireEvent.click(header)
    expect(screen.getByPlaceholderText('Add a task…')).toBeInTheDocument()
  })
})

describe('TodoPanel — todo rendering', () => {
  it('renders todo text', () => {
    const todos = [mkTodo({ id: 't1', text: 'Deploy to production' })]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} />)
    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
  })

  it('renders multiple todos', () => {
    const todos = [
      mkTodo({ id: 't1', text: 'First task' }),
      mkTodo({ id: 't2', text: 'Second task' }),
    ]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} />)
    expect(screen.getByText('First task')).toBeInTheDocument()
    expect(screen.getByText('Second task')).toBeInTheDocument()
  })

  it('completed todo has line-through class', () => {
    const todos = [mkTodo({ id: 't1', text: 'Done item', completed: true })]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} />)
    const span = screen.getByText('Done item')
    expect(span.className).toContain('line-through')
  })

  it('incomplete todo does not have line-through class', () => {
    const todos = [mkTodo({ id: 't1', text: 'Pending item', completed: false })]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} />)
    const span = screen.getByText('Pending item')
    expect(span.className).not.toContain('line-through')
  })
})

describe('TodoPanel — toggle', () => {
  it('calls onToggle with id and true when completing an item', () => {
    const onToggle = vi.fn()
    const todos = [mkTodo({ id: 't1', completed: false })]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} onToggle={onToggle} />)
    // Toggle button has hover:text-primary class; delete button has hover:text-destructive
    const toggleBtn = screen.getAllByRole('button').find((b) =>
      b.className.includes('hover:text-primary')
    )
    fireEvent.click(toggleBtn!)
    expect(onToggle).toHaveBeenCalledWith('t1', true)
  })

  it('calls onToggle with id and false when unchecking a completed item', () => {
    const onToggle = vi.fn()
    const todos = [mkTodo({ id: 't1', completed: true })]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} onToggle={onToggle} />)
    const toggleBtn = screen.getAllByRole('button').find((b) =>
      b.className.includes('hover:text-primary')
    )
    fireEvent.click(toggleBtn!)
    expect(onToggle).toHaveBeenCalledWith('t1', false)
  })
})

describe('TodoPanel — delete', () => {
  it('calls onDelete with todo id when delete button is clicked', () => {
    const onDelete = vi.fn()
    const todos = [mkTodo({ id: 't1', text: 'Remove me' })]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} onDelete={onDelete} />)
    // Delete button has hover:text-destructive class
    const deleteBtn = screen.getAllByRole('button').find((b) =>
      b.className.includes('hover:text-destructive')
    )
    fireEvent.click(deleteBtn!)
    expect(onDelete).toHaveBeenCalledWith('t1')
  })

  it('calls correct onDelete when multiple todos present', () => {
    const onDelete = vi.fn()
    const todos = [
      mkTodo({ id: 't1', text: 'First' }),
      mkTodo({ id: 't2', text: 'Second' }),
    ]
    render(<TodoPanel {...DEFAULT_PROPS} todos={todos} onDelete={onDelete} />)
    const deleteButtons = screen.getAllByRole('button').filter((b) =>
      b.className.includes('hover:text-destructive')
    )
    fireEvent.click(deleteButtons[1])
    expect(onDelete).toHaveBeenCalledWith('t2')
  })
})

describe('TodoPanel — add input', () => {
  it('calls onAdd with trimmed text on Enter', () => {
    const onAdd = vi.fn()
    render(<TodoPanel {...DEFAULT_PROPS} onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Add a task…')
    fireEvent.change(input, { target: { value: '  New task  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAdd).toHaveBeenCalledWith('New task')
  })

  it('clears input after successful add', () => {
    const onAdd = vi.fn()
    render(<TodoPanel {...DEFAULT_PROPS} onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Add a task…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'A task' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('')
  })

  it('does not call onAdd when input is empty', () => {
    const onAdd = vi.fn()
    render(<TodoPanel {...DEFAULT_PROPS} onAdd={onAdd} />)
    fireEvent.keyDown(screen.getByPlaceholderText('Add a task…'), { key: 'Enter' })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('does not call onAdd when input is only whitespace', () => {
    const onAdd = vi.fn()
    render(<TodoPanel {...DEFAULT_PROPS} onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Add a task…')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('clears input on Escape without adding', () => {
    const onAdd = vi.fn()
    render(<TodoPanel {...DEFAULT_PROPS} onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Add a task…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Abandoned task' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('')
    expect(onAdd).not.toHaveBeenCalled()
  })
})
