import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenuOverlay } from '../components/ContextMenuOverlay'

const defaultItems = [
  { id: 'rename', label: 'Rename', action: vi.fn() },
  { id: 'delete', label: 'Delete', action: vi.fn(), danger: true },
  { id: 'copy', label: 'Copy path', action: vi.fn(), shortcut: '⌘C' },
]

describe('ContextMenuOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <ContextMenuOverlay x={0} y={0} items={defaultItems} open={false} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders all items when open', () => {
    render(
      <ContextMenuOverlay x={100} y={200} items={defaultItems} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Copy path')).toBeInTheDocument()
  })

  it('positions at given coordinates', () => {
    render(
      <ContextMenuOverlay x={100} y={200} items={defaultItems} open={true} onClose={vi.fn()} />
    )
    const menuRoot = screen.getByText('Rename').closest('.fixed') as HTMLElement
    expect(menuRoot.style.left).toBe('100px')
    expect(menuRoot.style.top).toBe('200px')
  })

  it('calls item action and closes when item is clicked', () => {
    const itemAction = vi.fn()
    const onClose = vi.fn()
    render(
      <ContextMenuOverlay
        x={0} y={0}
        items={[{ id: 'test', label: 'Test', action: itemAction }]}
        open={true}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    expect(itemAction).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when clicking outside the menu', () => {
    const onClose = vi.fn()
    render(
      <ContextMenuOverlay x={0} y={0} items={defaultItems} open={true} onClose={onClose} />
    )
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when clicking inside the menu', () => {
    const onClose = vi.fn()
    render(
      <ContextMenuOverlay x={0} y={0} items={defaultItems} open={true} onClose={onClose} />
    )
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Rename' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on any keydown when open', () => {
    const onClose = vi.fn()
    render(
      <ContextMenuOverlay x={0} y={0} items={defaultItems} open={true} onClose={onClose} />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows shortcut hint when provided', () => {
    render(
      <ContextMenuOverlay x={0} y={0} items={defaultItems} open={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('⌘C')).toBeInTheDocument()
  })

  it('disables item and shows muted styling', () => {
    render(
      <ContextMenuOverlay
        x={0} y={0}
        items={[{ id: 'disabled', label: 'Disabled Item', action: vi.fn(), disabled: true }]}
        open={true}
        onClose={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: 'Disabled Item' })
    expect(btn).toBeDisabled()
    expect(btn.className).toContain('cursor-not-allowed')
  })

  it('applies danger styling to danger items', () => {
    render(
      <ContextMenuOverlay
        x={0} y={0}
        items={[{ id: 'delete', label: 'Delete Item', action: vi.fn(), danger: true }]}
        open={true}
        onClose={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: 'Delete Item' })
    expect(btn.className).toContain('text-destructive')
  })

  it('handles menu with no items gracefully', () => {
    render(
      <ContextMenuOverlay x={0} y={0} items={[]} open={true} onClose={vi.fn()} />
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ContextMenuOverlay — action and interaction edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not call action when disabled item is clicked', () => {
    const action = vi.fn()
    const onClose = vi.fn()
    render(
      <ContextMenuOverlay
        x={0} y={0}
        items={[{ id: 'disabled', label: 'Disabled', action, disabled: true }]}
        open={true}
        onClose={onClose}
      />
    )
    const btn = screen.getByRole('button', { name: 'Disabled' })
    fireEvent.click(btn)
    // Disabled button doesn't fire onClick, so neither action nor onClose is called
    expect(action).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('each item calls only its own action', () => {
    const action1 = vi.fn()
    const action2 = vi.fn()
    const action3 = vi.fn()
    const onClose = vi.fn()
    render(
      <ContextMenuOverlay
        x={0} y={0}
        items={[
          { id: 'a', label: 'First', action: action1 },
          { id: 'b', label: 'Second', action: action2 },
          { id: 'c', label: 'Third', action: action3 },
        ]}
        open={true}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    expect(action1).not.toHaveBeenCalled()
    expect(action2).toHaveBeenCalledOnce()
    expect(action3).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('repositions when coordinates change via rerender', () => {
    const { rerender } = render(
      <ContextMenuOverlay x={10} y={20} items={defaultItems} open={true} onClose={vi.fn()} />
    )
    const menuRoot = screen.getByText('Rename').closest('.fixed') as HTMLElement
    expect(menuRoot.style.left).toBe('10px')
    expect(menuRoot.style.top).toBe('20px')

    rerender(
      <ContextMenuOverlay x={200} y={300} items={defaultItems} open={true} onClose={vi.fn()} />
    )
    expect(menuRoot.style.left).toBe('200px')
    expect(menuRoot.style.top).toBe('300px')
  })

  it('closes on any keydown, not just Escape', () => {
    const onClose = vi.fn()
    render(
      <ContextMenuOverlay x={0} y={0} items={defaultItems} open={true} onClose={onClose} />
    )
    fireEvent.keyDown(document, { key: 'a' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
