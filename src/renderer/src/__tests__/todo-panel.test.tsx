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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TodoPanel — header', () => {
  it('renders "Plan" heading', () => {
    render(<TodoPanel todos={[]} />)
    expect(screen.getByText('Plan')).toBeInTheDocument()
  })

  it('does not show count when todos list is empty', () => {
    render(<TodoPanel todos={[]} />)
    expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument()
  })

  it('shows done/total count when todos present', () => {
    const todos = [
      mkTodo({ id: 't1', completed: true }),
      mkTodo({ id: 't2', completed: false }),
      mkTodo({ id: 't3', completed: false }),
    ]
    render(<TodoPanel todos={todos} />)
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('shows all-done count correctly', () => {
    const todos = [
      mkTodo({ id: 't1', completed: true }),
      mkTodo({ id: 't2', completed: true }),
    ]
    render(<TodoPanel todos={todos} />)
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })
})

describe('TodoPanel — collapse / expand', () => {
  it('is expanded by default', () => {
    const todos = [mkTodo({ id: 't1', text: 'First task' })]
    render(<TodoPanel todos={todos} />)
    expect(screen.getByText('First task')).toBeInTheDocument()
  })

  it('hides todos when header is clicked', () => {
    const todos = [mkTodo({ id: 't1', text: 'Visible task' })]
    render(<TodoPanel todos={todos} />)
    fireEvent.click(screen.getByText('Plan'))
    expect(screen.queryByText('Visible task')).not.toBeInTheDocument()
  })

  it('re-expands on second header click', () => {
    const todos = [mkTodo({ id: 't1', text: 'Toggled task' })]
    render(<TodoPanel todos={todos} />)
    const header = screen.getByText('Plan')
    fireEvent.click(header)
    fireEvent.click(header)
    expect(screen.getByText('Toggled task')).toBeInTheDocument()
  })
})

describe('TodoPanel — empty state', () => {
  it('shows placeholder text when no todos and panel is open', () => {
    render(<TodoPanel todos={[]} />)
    expect(screen.getByText(/agent will outline/i)).toBeInTheDocument()
  })

  it('does not show placeholder when collapsed', () => {
    render(<TodoPanel todos={[]} />)
    fireEvent.click(screen.getByText('Plan'))
    expect(screen.queryByText(/agent will outline/i)).not.toBeInTheDocument()
  })
})

describe('TodoPanel — read-only todo rendering', () => {
  it('renders todo text', () => {
    const todos = [mkTodo({ id: 't1', text: 'Deploy to production' })]
    render(<TodoPanel todos={todos} />)
    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
  })

  it('renders multiple todos', () => {
    const todos = [
      mkTodo({ id: 't1', text: 'First task' }),
      mkTodo({ id: 't2', text: 'Second task' }),
    ]
    render(<TodoPanel todos={todos} />)
    expect(screen.getByText('First task')).toBeInTheDocument()
    expect(screen.getByText('Second task')).toBeInTheDocument()
  })

  it('completed todo has line-through class', () => {
    const todos = [mkTodo({ id: 't1', text: 'Done item', completed: true })]
    render(<TodoPanel todos={todos} />)
    expect(screen.getByText('Done item').className).toContain('line-through')
  })

  it('incomplete todo does not have line-through class', () => {
    const todos = [mkTodo({ id: 't1', text: 'Pending item', completed: false })]
    render(<TodoPanel todos={todos} />)
    expect(screen.getByText('Pending item').className).not.toContain('line-through')
  })
})

describe('TodoPanel — no user-interaction elements', () => {
  it('does not render an add task input', () => {
    render(<TodoPanel todos={[mkTodo()]} />)
    expect(screen.queryByPlaceholderText(/add/i)).not.toBeInTheDocument()
  })

  it('does not render delete buttons', () => {
    const todos = [mkTodo({ id: 't1' })]
    render(<TodoPanel todos={todos} />)
    const deleteButtons = screen.queryAllByRole('button').filter((b) =>
      b.className.includes('hover:text-destructive')
    )
    expect(deleteButtons).toHaveLength(0)
  })

  it('only the collapse header button is present', () => {
    const todos = [mkTodo({ id: 't1', text: 'Static task' })]
    render(<TodoPanel todos={todos} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
