import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('selects first item by default', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
    expect(options[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('highlights first item on ArrowDown from initial state', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')

    // ArrowDown at index 0 -> stays at 0 (no more items below)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('highlights second item on ArrowDown from initial state (if there are >=2 items)', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')

    // Move to item 1
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Move to item 2
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('does not go below the last item on ArrowDown', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')

    // ArrowDown 5 times — should clamp at index 2
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    }

    const options = screen.getAllByRole('option')
    expect(options[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('does not go above the first item on ArrowUp', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')

    // ArrowUp at index 0 -> stays at 0
    fireEvent.keyDown(input, { key: 'ArrowUp' })

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('selects previous item on ArrowUp', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')

    // Move down 2 to index 2
    for (let i = 0; i < 2; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    }
    // Move up 1 to index 1
    fireEvent.keyDown(input, { key: 'ArrowUp' })

    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('calls the selected command action on Enter', () => {
    const actions = sampleCommands.map((c) => vi.fn())
    const commands: CommandEntry[] = sampleCommands.map((c, i) => ({ ...c, action: actions[i] }))

    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} commands={commands} />)
    const input = screen.getByPlaceholderText('Search commands…')

    // Move to item 2
    for (let i = 0; i < 2; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    }
    // Select
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(actions[2]).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // First two items should NOT be called
    expect(actions[0]).not.toHaveBeenCalled()
    expect(actions[1]).not.toHaveBeenCalled()
  })

  it('calls action on click', () => {
    const action = vi.fn()
    const onClose = vi.fn()
    const commands: CommandEntry[] = [{ id: '1', label: 'Clickable', category: 'Test', action }]

    render(<CommandPalette open={true} onClose={onClose} commands={commands} />)
    fireEvent.click(screen.getByText('Clickable'))

    expect(action).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets selection to first item on filter change', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={sampleCommands} />)
    const input = screen.getByPlaceholderText('Search commands…')

    // Move to item 2
    for (let i = 0; i < 2; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    }
    // Filter
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(input, { target: { value: 'toggle' } })

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('renders empty state when commands list is empty', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={[]} />)
    expect(screen.getByText('Type to search')).toBeDefined()
  })

  it('closes on backdrop click', () => {
    const onClose = vi.fn()
    const { container } = render(
      <CommandPalette open={true} onClose={onClose} commands={sampleCommands} />
    )
    // Click the backdrop — the outermost div's onClick
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
