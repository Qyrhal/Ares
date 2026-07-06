import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { CommandPalette, type CommandEntry } from '@/components/CommandPalette'

const sampleCommands: CommandEntry[] = [
  { id: '1', label: 'New session', description: 'Create a new chat', category: 'General', action: vi.fn() },
  { id: '2', label: 'Toggle terminal', description: 'Open/close terminal', shortcut: 'Ctrl+`', category: 'View', action: vi.fn() },
  { id: '3', label: 'Toggle zen mode', description: 'Hide UI chrome', category: 'View', action: vi.fn() },
]

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} commands={sampleCommands} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders search input when open', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    expect(screen.getByPlaceholderText('Search commands…')).toBeDefined()
  })

  it('shows all commands initially', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    expect(screen.getByText('New session')).toBeDefined()
    expect(screen.getByText('Toggle terminal')).toBeDefined()
    expect(screen.getByText('Toggle zen mode')).toBeDefined()
  })

  it('shows result count', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    expect(screen.getByText('3 results')).toBeDefined()
  })

  it('filters commands by label', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(input, { target: { value: 'terminal' } })
    expect(screen.queryByText('New session')).toBeNull()
    expect(screen.getByText('Toggle terminal')).toBeDefined()
  })

  it('shows no results state', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(input, { target: { value: 'zzzzz' } })
    expect(screen.getByText('No matching commands')).toBeDefined()
  })

  it('shows keyboard shortcut hint', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    expect(screen.getByText('Ctrl+`')).toBeDefined()
  })
})
