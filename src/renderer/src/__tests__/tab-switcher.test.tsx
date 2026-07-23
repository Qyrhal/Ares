import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabSwitcher } from '@/components/TabSwitcher'
import type { Tab } from '@/types'

function mkSessionTab(id: string, title: string): Tab {
  return { type: 'session', id, title }
}

function mkFileTab(path: string, name: string, isDirty = false): Tab {
  return { type: 'file', path, name, isDirty }
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  tabs: [] as Tab[],
  activeTabId: null as string | null,
  onSelectTab: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TabSwitcher — open/close', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <TabSwitcher {...defaultProps} open={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders overlay when open', () => {
    render(<TabSwitcher {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search open tabs…')).toBeDefined()
  })

  it('shows search input when open', () => {
    render(<TabSwitcher {...defaultProps} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    expect(input).toBeDefined()
  })
})

describe('TabSwitcher — tab rendering', () => {
  it('renders all tabs when no filter', () => {
    const tabs: Tab[] = [
      mkSessionTab('s1', 'Chat 1'),
      mkFileTab('/a.ts', 'a.ts'),
    ]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('Chat 1')).toBeDefined()
    expect(screen.getByText('a.ts')).toBeDefined()
  })

  it('shows tab count', () => {
    const tabs: Tab[] = [
      mkSessionTab('s1', 'Chat 1'),
      mkSessionTab('s2', 'Chat 2'),
    ]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('2 tabs')).toBeDefined()
  })

  it('shows singular "tab" for one result', () => {
    const tabs: Tab[] = [mkSessionTab('s1', 'Chat 1')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('1 tab')).toBeDefined()
  })

  it('shows "Chat session" subtitle for session tabs', () => {
    const tabs: Tab[] = [mkSessionTab('s1', 'My Chat')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('Chat session')).toBeDefined()
  })

  it('shows file path subtitle for file tabs', () => {
    const tabs: Tab[] = [mkFileTab('/src/main.ts', 'main.ts')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('/src/main.ts')).toBeDefined()
  })

  it('shows dirty indicator for dirty file tabs', () => {
    const tabs: Tab[] = [mkFileTab('/a.ts', 'a.ts', true)]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    // The dirty dot has title="Unsaved changes"
    expect(screen.getByTitle('Unsaved changes')).toBeDefined()
  })

  it('shows "chat" badge for session tabs', () => {
    const tabs: Tab[] = [mkSessionTab('s1', 'My Chat')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('chat')).toBeDefined()
  })

  it('highlights active tab with border', () => {
    const tabs: Tab[] = [mkSessionTab('s1', 'Chat 1')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} activeTabId="s1" />)
    const tabBtn = screen.getByText('Chat 1').closest('button')!
    expect(tabBtn.className).toContain('border-primary')
  })
})

describe('TabSwitcher — filtering', () => {
  it('filters tabs by query', () => {
    const tabs: Tab[] = [
      mkSessionTab('s1', 'React session'),
      mkSessionTab('s2', 'Vue session'),
    ]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.change(input, { target: { value: 'React' } })
    expect(screen.getByText('React session')).toBeDefined()
    expect(screen.queryByText('Vue session')).toBeNull()
  })

  it('shows "No matching tabs" when filter has no matches', () => {
    const tabs: Tab[] = [mkSessionTab('s1', 'React session')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.change(input, { target: { value: 'xyz' } })
    expect(screen.getByText('No matching tabs')).toBeDefined()
  })

  it('shows "No open tabs" when tabs list is empty', () => {
    render(<TabSwitcher {...defaultProps} tabs={[]} />)
    expect(screen.getByText('No open tabs')).toBeDefined()
  })

  it('is case-insensitive for filtering', () => {
    const tabs: Tab[] = [mkSessionTab('s1', 'React Hook')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.change(input, { target: { value: 'react' } })
    expect(screen.getByText('React Hook')).toBeDefined()
  })

  it('searches file path as well as name', () => {
    const tabs: Tab[] = [mkFileTab('/src/components/App.tsx', 'App.tsx')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.change(input, { target: { value: 'components' } })
    expect(screen.getByText('App.tsx')).toBeDefined()
  })
})

describe('TabSwitcher — keyboard navigation', () => {
  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    const tabs: Tab[] = [mkSessionTab('s1', 'Chat 1')]
    render(<TabSwitcher {...defaultProps} tabs={tabs} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('selects tab on Enter', () => {
    const onSelectTab = vi.fn()
    const onClose = vi.fn()
    const tabs: Tab[] = [mkSessionTab('s1', 'Chat 1')]
    render(
      <TabSwitcher
        {...defaultProps}
        tabs={tabs}
        onSelectTab={onSelectTab}
        onClose={onClose}
      />,
    )
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectTab).toHaveBeenCalledWith('s1')
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates down with ArrowDown then selects', () => {
    const onSelectTab = vi.fn()
    const tabs: Tab[] = [
      mkSessionTab('s1', 'Chat 1'),
      mkSessionTab('s2', 'Chat 2'),
    ]
    render(
      <TabSwitcher
        {...defaultProps}
        tabs={tabs}
        onSelectTab={onSelectTab}
      />,
    )
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectTab).toHaveBeenCalledWith('s2')
  })

  it('navigates up with ArrowUp then selects', () => {
    const onSelectTab = vi.fn()
    const tabs: Tab[] = [
      mkSessionTab('s1', 'Chat 1'),
      mkSessionTab('s2', 'Chat 2'),
    ]
    render(
      <TabSwitcher
        {...defaultProps}
        tabs={tabs}
        onSelectTab={onSelectTab}
      />,
    )
    const input = screen.getByPlaceholderText('Search open tabs…')
    // Go down to index 1, then back up to index 0
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectTab).toHaveBeenCalledWith('s1')
  })

  it('does not crash when Enter pressed with no tabs', () => {
    const onClose = vi.fn()
    render(<TabSwitcher {...defaultProps} tabs={[]} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('TabSwitcher — interactions', () => {
  it('closes when clicking backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TabSwitcher {...defaultProps} tabs={[]} onClose={onClose} />,
    )
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when clicking inside dialog', () => {
    const onClose = vi.fn()
    render(<TabSwitcher {...defaultProps} tabs={[]} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Search open tabs…')
    fireEvent.click(input)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('selects tab on click', () => {
    const onSelectTab = vi.fn()
    const onClose = vi.fn()
    const tabs: Tab[] = [mkSessionTab('s1', 'Chat 1')]
    render(
      <TabSwitcher
        {...defaultProps}
        tabs={tabs}
        onSelectTab={onSelectTab}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByText('Chat 1'))
    expect(onSelectTab).toHaveBeenCalledWith('s1')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('TabSwitcher — Tab icon selection', () => {
  it('renders without crashing for different file extensions', () => {
    const tabs: Tab[] = [
      mkFileTab('/a.tsx', 'a.tsx'),
      mkFileTab('/b.md', 'b.md'),
      mkFileTab('/c.png', 'c.png'),
      mkFileTab('/d.xyz', 'd.xyz'),
    ]
    render(<TabSwitcher {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('a.tsx')).toBeDefined()
    expect(screen.getByText('b.md')).toBeDefined()
    expect(screen.getByText('c.png')).toBeDefined()
    expect(screen.getByText('d.xyz')).toBeDefined()
  })
})
