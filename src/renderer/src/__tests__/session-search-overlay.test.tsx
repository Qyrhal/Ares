import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { SessionSearchOverlay } from '@/components/SessionSearchOverlay'
import type { SearchResult } from '@/globals'

const mockResults: SearchResult[] = [
  { sessionId: 's1', sessionTitle: 'Chat about project', messageId: 'm1', content: 'How do I implement this feature?', role: 'user' },
  { sessionId: 's1', sessionTitle: 'Chat about project', messageId: 'm2', content: 'You should use the useCallback hook', role: 'assistant' },
  { sessionId: 's2', sessionTitle: 'Bug investigation', messageId: 'm3', content: 'Found a regression in the parser', role: 'user' },
  { sessionId: 's2', sessionTitle: 'Bug investigation', messageId: 'm4', content: 'The issue is in the lexer module', role: 'assistant' },
  { sessionId: 's3', sessionTitle: 'Code review', messageId: 'm5', content: 'Need to check the PR for edge cases', role: 'user' },
]

describe('SessionSearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const db = (mock as Record<string, Record<string, unknown>>).db
    db.searchMessages = vi.fn().mockResolvedValue(mockResults)
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <SessionSearchOverlay
        open={false}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders search input when open', () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Search across all sessions…')).toBeDefined()
  })

  it('shows "Type to search" message when query is empty', () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('Type to search across all sessions')).toBeDefined()
  })

  it('calls searchMessages on query change and displays results', async () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'hook' } })

    // Wait for debounce + search to resolve
    await vi.waitFor(() => {
      expect(screen.getByText('You should use the useCallback hook')).toBeDefined()
    })
  })

  it('displays results grouped by session', async () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'the' } })

    await vi.waitFor(() => {
      // Session headers should be visible
      expect(screen.getByText('Chat about project')).toBeDefined()
      expect(screen.getByText('Bug investigation')).toBeDefined()
      // Results under each session
      expect(screen.getByText('How do I implement this feature?')).toBeDefined()
      expect(screen.getByText('The issue is in the lexer module')).toBeDefined()
    })
  })

  it('shows result count', async () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'the' } })

    await vi.waitFor(() => {
      expect(screen.getByText('5 results')).toBeDefined()
    })
  })

  it('shows "No results found" when search returns empty', async () => {
    const mock = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const db = (mock as Record<string, Record<string, unknown>>).db
    db.searchMessages = vi.fn().mockResolvedValue([])

    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'zzzzz' } })

    await vi.waitFor(() => {
      expect(screen.getByText('No results found')).toBeDefined()
    })
  })

  it('shows loading spinner while searching', async () => {
    // Make searchMessages return a promise that doesn't resolve immediately
    const mock = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const db = (mock as Record<string, Record<string, unknown>>).db
    let resolvePromise: (value: SearchResult[]) => void
    db.searchMessages = vi.fn().mockReturnValue(new Promise<SearchResult[]>((resolve) => {
      resolvePromise = resolve
    }))

    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'hook' } })

    // The component should show loading state — the spinner is an SVG with animate-spin class
    // The "Searching…" text should appear
    await vi.waitFor(() => {
      expect(screen.getByText('Searching…')).toBeDefined()
    })

    // Resolve the search
    resolvePromise!(mockResults)
  })

  it('navigates with ArrowDown and selects with Enter', async () => {
    const onSelectSession = vi.fn()
    const onClose = vi.fn()

    render(
      <SessionSearchOverlay
        open={true}
        onClose={onClose}
        onSelectSession={onSelectSession}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'feature' } })

    await vi.waitFor(() => {
      expect(screen.getByText('How do I implement this feature?')).toBeDefined()
    })

    // ArrowDown to second item
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Enter selects it
    fireEvent.keyDown(input, { key: 'Enter' })

    // Second result is "You should use the useCallback hook" with sessionId 's1'
    expect(onSelectSession).toHaveBeenCalledWith('s1')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(
      <SessionSearchOverlay
        open={true}
        onClose={onClose}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('selects session on click', async () => {
    const onSelectSession = vi.fn()
    const onClose = vi.fn()

    render(
      <SessionSearchOverlay
        open={true}
        onClose={onClose}
        onSelectSession={onSelectSession}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'feature' } })

    await vi.waitFor(() => {
      expect(screen.getByText('How do I implement this feature?')).toBeDefined()
    })

    // Click on first result
    const resultBtn = screen.getByText('How do I implement this feature?').closest('button')!
    fireEvent.click(resultBtn)

    expect(onSelectSession).toHaveBeenCalledWith('s1')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking backdrop', async () => {
    const onClose = vi.fn()

    const { container } = render(
      <SessionSearchOverlay
        open={true}
        onClose={onClose}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    // Click the outermost overlay div
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows role badges on results', async () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'hook' } })

    await vi.waitFor(() => {
      // User role badges (multiple results have role 'user')
      const userBadges = screen.getAllByText('user')
      expect(userBadges.length).toBeGreaterThan(0)
      // Assistant role badges (multiple results have role 'assistant')
      const assistantBadges = screen.getAllByText('assistant')
      expect(assistantBadges.length).toBeGreaterThan(0)
    })
  })
})

describe('SessionSearchOverlay — date range filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders date preset buttons when open', () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('All time')).toBeDefined()
    expect(screen.getByText('Today')).toBeDefined()
    expect(screen.getByText('7 days')).toBeDefined()
    expect(screen.getByText('30 days')).toBeDefined()
  })

  it('has All time selected by default', () => {
    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )
    const allTimeBtn = screen.getByText('All time')
    // Default preset should have the active class (bg-primary/15)
    expect(allTimeBtn.className).toContain('bg-primary/15')
  })

  it('resets date preset to All time when reopened', async () => {
    const { rerender } = render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    // Click "Today" preset
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText('Today'))

    // Today should now be active
    expect(screen.getByText('Today').className).toContain('bg-primary/15')

    // Reopen (close then open)
    rerender(
      <SessionSearchOverlay
        open={false}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )
    rerender(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    // Should be back to All time
    expect(screen.getByText('All time').className).toContain('bg-primary/15')
  })

  it('passes date range filters when searching with a preset selected', async () => {
    const mock = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const db = (mock as Record<string, Record<string, unknown>>).db

    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')

    // First type a query to trigger search
    const input = screen.getByPlaceholderText('Search across all sessions…')
    fireEvent.change(input, { target: { value: 'hook' } })

    await vi.waitFor(() => {
      expect(db.searchMessages).toHaveBeenCalledWith('hook', {})
    })

    // Now click "Today" preset — triggers re-search with date filter
    db.searchMessages = vi.fn().mockResolvedValue(mockResults)
    fireEvent.click(screen.getByText('Today'))

    await vi.waitFor(() => {
      // Should have been called with date range filters
      const calls = (db.searchMessages as ReturnType<typeof vi.fn>).mock.calls
      const todayCall = calls.find((c: unknown[]) => c[0] === 'hook' && typeof c[1]?.startDate === 'number')
      expect(todayCall).toBeDefined()
      expect(todayCall![1].startDate).toBeGreaterThan(0)
      expect(todayCall![1].endDate).toBeGreaterThan(0)
    })
  })

  it('does not re-search when clicking a date preset with no query', async () => {
    const mock = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const db = (mock as Record<string, Record<string, unknown>>).db
    db.searchMessages = vi.fn().mockResolvedValue([])

    render(
      <SessionSearchOverlay
        open={true}
        onClose={vi.fn()}
        onSelectSession={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')

    // Click a date preset without any query — should NOT trigger search
    fireEvent.click(screen.getByText('Today'))

    // searchMessages should not have been called (no query typed)
    expect(db.searchMessages).not.toHaveBeenCalled()
  })
})
