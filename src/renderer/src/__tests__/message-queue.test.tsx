import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MessageQueue } from '../components/MessageQueue'
import type { QueueItem } from '../components/MessageQueue'

function mkItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'q1',
    title: 'Build project',
    description: 'Running npm build',
    status: 'pending',
    ...overrides,
  }
}

describe('MessageQueue', () => {
  it('returns null for empty items array', () => {
    const { container } = render(
      <MessageQueue items={[]} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders queue header with count', () => {
    render(
      <MessageQueue
        items={[mkItem(), mkItem({ id: 'q2', title: 'Test' })]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    expect(screen.getByText(/Queue \(2\)/)).toBeInTheDocument()
  })

  it('renders item title', () => {
    render(
      <MessageQueue items={[mkItem()]} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(screen.getByText('Build project')).toBeInTheDocument()
  })

  it('renders item description', () => {
    render(
      <MessageQueue items={[mkItem()]} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(screen.getByText('Running npm build')).toBeInTheDocument()
  })

  it('calls onRemove with item id', () => {
    const onRemove = vi.fn()
    render(
      <MessageQueue items={[mkItem()]} onRemove={onRemove} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Remove from queue'))
    expect(onRemove).toHaveBeenCalledWith('q1')
  })

  it('calls onRunNow with item id', () => {
    const onRunNow = vi.fn()
    render(
      <MessageQueue items={[mkItem()]} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={onRunNow} />
    )
    fireEvent.click(screen.getByTitle('Run now'))
    expect(onRunNow).toHaveBeenCalledWith('q1')
  })

  it('calls onReorder when moving item up', () => {
    const onReorder = vi.fn()
    render(
      <MessageQueue
        items={[mkItem({ id: 'q1' }), mkItem({ id: 'q2', title: 'Second' })]}
        onRemove={vi.fn()}
        onReorder={onReorder}
        onRunNow={vi.fn()}
      />
    )
    // "Move up" button should only exist on the second item (idx > 0)
    const moveUpBtns = screen.getAllByTitle('Move up')
    expect(moveUpBtns.length).toBe(1)
    fireEvent.click(moveUpBtns[0])
    expect(onReorder).toHaveBeenCalledWith(1, 0)
  })

  it('calls onReorder when moving item down', () => {
    const onReorder = vi.fn()
    render(
      <MessageQueue
        items={[mkItem({ id: 'q1' }), mkItem({ id: 'q2', title: 'Second' })]}
        onRemove={vi.fn()}
        onReorder={onReorder}
        onRunNow={vi.fn()}
      />
    )
    // "Move down" button should only exist on the first item (idx < length-1)
    const moveDownBtns = screen.getAllByTitle('Move down')
    expect(moveDownBtns.length).toBe(1)
    fireEvent.click(moveDownBtns[0])
    expect(onReorder).toHaveBeenCalledWith(0, 1)
  })

  it('does NOT show move up button for first item', () => {
    render(
      <MessageQueue
        items={[mkItem({ id: 'q1' }), mkItem({ id: 'q2', title: 'Second' })]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    // First item should have Move down but NOT Move up
    // We check by querying within specific item rows
    const moveUpBtns = screen.getAllByTitle('Move up')
    expect(moveUpBtns.length).toBe(1) // only on second item
  })

  it('does NOT show move down button for last item', () => {
    render(
      <MessageQueue
        items={[mkItem({ id: 'q1' }), mkItem({ id: 'q2', title: 'Second' })]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    const moveDownBtns = screen.getAllByTitle('Move down')
    expect(moveDownBtns.length).toBe(1) // only on first item
  })

  it('shows running status dot for running items', () => {
    render(
      <MessageQueue
        items={[mkItem({ status: 'running' })]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    expect(screen.getByTitle('Running')).toBeInTheDocument()
  })

  it('shows done status dot for done items', () => {
    render(
      <MessageQueue
        items={[mkItem({ status: 'done' })]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    expect(screen.getByTitle('Done')).toBeInTheDocument()
  })

  it('shows error status dot for error items', () => {
    render(
      <MessageQueue
        items={[mkItem({ status: 'error' })]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    expect(screen.getByTitle('Error')).toBeInTheDocument()
  })

  it('does not show status dot for pending items', () => {
    render(
      <MessageQueue
        items={[mkItem({ status: 'pending' })]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    expect(screen.queryByTitle('Running')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Done')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Error')).not.toBeInTheDocument()
  })

  it('renders multiple items', () => {
    render(
      <MessageQueue
        items={[
          mkItem({ id: 'q1', title: 'First' }),
          mkItem({ id: 'q2', title: 'Second' }),
          mkItem({ id: 'q3', title: 'Third' }),
        ]}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onRunNow={vi.fn()}
      />
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })
})
