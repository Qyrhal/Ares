import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu, ContextMenuEntry } from '../components/ui/context-menu'

const baseEntries: ContextMenuEntry[] = [
  { label: 'New file', onClick: vi.fn() },
  { separator: true },
  { label: 'Delete', onClick: vi.fn(), destructive: true },
]

describe('ContextMenu — rendering', () => {
  it('renders all item labels', () => {
    render(<ContextMenu entries={baseEntries} x={100} y={100} onClose={vi.fn()} />)
    expect(screen.getByText('New file')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('renders keyboard shortcut hint when provided', () => {
    render(
      <ContextMenu
        entries={[{ label: 'Close tab', shortcut: '⌘W', onClick: vi.fn() }]}
        x={0} y={0}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('⌘W')).toBeInTheDocument()
  })

  it('does not render labels for separators', () => {
    render(<ContextMenu entries={[{ separator: true }]} x={0} y={0} onClose={vi.fn()} />)
    // The only element should be the separator div, no buttons
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ContextMenu — interaction', () => {
  let onClick: ReturnType<typeof vi.fn>
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onClick = vi.fn()
    onClose = vi.fn()
  })

  it('calls item onClick when clicked', () => {
    render(
      <ContextMenu entries={[{ label: 'Action', onClick }]} x={0} y={0} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Action'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('calls onClose after item click', () => {
    render(
      <ContextMenu entries={[{ label: 'Action', onClick }]} x={0} y={0} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Action'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape keydown', () => {
    render(<ContextMenu entries={baseEntries} x={0} y={0} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on outside mousedown', () => {
    render(<ContextMenu entries={baseEntries} x={0} y={0} onClose={onClose} />)
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClick or onClose for disabled items', () => {
    render(
      <ContextMenu
        entries={[{ label: 'Disabled', onClick, disabled: true }]}
        x={0} y={0}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByText('Disabled'))
    expect(onClick).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ContextMenu — positioning', () => {
  it('renders at the given coordinates', () => {
    render(<ContextMenu entries={baseEntries} x={120} y={80} onClose={vi.fn()} />)
    // The portal renders into document.body; find the positioned div
    const menu = document.querySelector('[style*="left: 120px"]') ??
      document.querySelector('[style*="left:120px"]')
    expect(menu).not.toBeNull()
  })
})
