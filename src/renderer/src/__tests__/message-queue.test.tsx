import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageQueue, type QueueItem } from '../components/MessageQueue'

const makeItems = (): QueueItem[] => [
  { id: '1', title: 'Task 1', description: 'First task', status: 'pending' },
  { id: '2', title: 'Task 2', description: 'Second task', status: 'running' },
  { id: '3', title: 'Task 3', description: 'Third task', status: 'done' },
  { id: '4', title: 'Task 4', description: 'Fourth task', status: 'error' },
]

describe('MessageQueue', () => {
  it('renders nothing when items are empty', () => {
    const { container } = render(
      <MessageQueue items={[]} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders all items', () => {
    render(
      <MessageQueue items={makeItems()} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.getByText('Task 3')).toBeInTheDocument()
    expect(screen.getByText('Task 4')).toBeInTheDocument()
  })

  it('shows the queue count', () => {
    render(
      <MessageQueue items={makeItems()} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(screen.getByText('Queue (4)')).toBeInTheDocument()
  })

  it('shows descriptions', () => {
    render(
      <MessageQueue items={makeItems()} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(screen.getByText('First task')).toBeInTheDocument()
    expect(screen.getByText('Second task')).toBeInTheDocument()
  })

  it('shows status indicators', () => {
    render(
      <MessageQueue items={makeItems()} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    // running item has a pulsing indicator
    const runningIndicators = screen.getAllByTitle('Running')
    expect(runningIndicators).toHaveLength(1)
    expect(screen.getByTitle('Done')).toBeInTheDocument()
    expect(screen.getByTitle('Error')).toBeInTheDocument()
  })

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn()
    render(
      <MessageQueue items={makeItems()} onRemove={onRemove} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    const removeButtons = screen.getAllByTitle('Remove from queue')
    fireEvent.click(removeButtons[0])
    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('calls onRunNow when run button is clicked', () => {
    const onRunNow = vi.fn()
    render(
      <MessageQueue items={makeItems()} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={onRunNow} />
    )
    // Each item has a "Run now" button
    const runButtons = screen.getAllByTitle('Run now')
    fireEvent.click(runButtons[0])
    expect(onRunNow).toHaveBeenCalledWith('1')
  })

  it('calls onReorder with correct indices for move up', () => {
    const onReorder = vi.fn()
    render(
      <MessageQueue items={makeItems()} onRemove={vi.fn()} onReorder={onReorder} onRunNow={vi.fn()} />
    )
    // Items 2,3,4 have "Move up" buttons (item 1 is at top)
    const moveUpButtons = screen.getAllByTitle('Move up')
    expect(moveUpButtons).toHaveLength(3)
    fireEvent.click(moveUpButtons[0])
    expect(onReorder).toHaveBeenCalledWith(1, 0)
  })

  it('calls onReorder with correct indices for move down', () => {
    const onReorder = vi.fn()
    render(
      <MessageQueue items={makeItems()} onRemove={vi.fn()} onReorder={onReorder} onRunNow={vi.fn()} />
    )
    // Items 1,2,3 have "Move down" buttons (item 4 is at bottom)
    const moveDownButtons = screen.getAllByTitle('Move down')
    expect(moveDownButtons).toHaveLength(3)
    fireEvent.click(moveDownButtons[2])
    expect(onReorder).toHaveBeenCalledWith(2, 3)
  })

  it('item with no description still renders', () => {
    const items: QueueItem[] = [
      { id: '1', title: 'No desc', description: '', status: 'pending' },
    ]
    render(
      <MessageQueue items={items} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    expect(screen.getByText('No desc')).toBeInTheDocument()
  })

  it('reorders items programmatically (all items get correct buttons)', () => {
    const singleItem: QueueItem[] = [
      { id: '1', title: 'Solo', description: '', status: 'pending' },
    ]
    render(
      <MessageQueue items={singleItem} onRemove={vi.fn()} onReorder={vi.fn()} onRunNow={vi.fn()} />
    )
    // One item — no move up/down buttons
    expect(screen.queryByTitle('Move up')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Move down')).not.toBeInTheDocument()
    // But still has remove and run now
    expect(screen.getByTitle('Remove from queue')).toBeInTheDocument()
    expect(screen.getByTitle('Run now')).toBeInTheDocument()
  })
})
