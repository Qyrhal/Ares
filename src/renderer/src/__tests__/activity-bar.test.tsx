import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityBar } from '@/components/ActivityBar'
import type { ActivityView } from '@/types'

const defaultProps = {
  activeView: 'chat' as ActivityView,
  onChangeView: vi.fn(),
  terminalOpen: false,
  onToggleTerminal: vi.fn(),
  gitBadge: 0,
  agentBadge: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ActivityBar — renders all buttons', () => {
  it('renders Chat, Explorer, Git, Extensions, Terminal, and Settings buttons', () => {
    render(<ActivityBar {...defaultProps} />)
    expect(screen.getByTitle('Chat')).toBeDefined()
    expect(screen.getByTitle('Explorer')).toBeDefined()
    expect(screen.getByTitle('Source Control')).toBeDefined()
    expect(screen.getByTitle('Extensions')).toBeDefined()
    expect(screen.getByTitle('Terminal (⌘` / ⌘J)')).toBeDefined()
    expect(screen.getByTitle('Settings')).toBeDefined()
  })

  it('renders all 6 interactive buttons', () => {
    const { container } = render(<ActivityBar {...defaultProps} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(6)
  })
})

describe('ActivityBar — view switching', () => {
  it('calls onChangeView with "chat" when Chat button clicked', () => {
    const onChangeView = vi.fn()
    render(<ActivityBar {...defaultProps} onChangeView={onChangeView} />)
    fireEvent.click(screen.getByTitle('Chat'))
    expect(onChangeView).toHaveBeenCalledWith('chat')
  })

  it('calls onChangeView with "explorer" when Explorer button clicked', () => {
    const onChangeView = vi.fn()
    render(<ActivityBar {...defaultProps} onChangeView={onChangeView} />)
    fireEvent.click(screen.getByTitle('Explorer'))
    expect(onChangeView).toHaveBeenCalledWith('explorer')
  })

  it('calls onChangeView with "git" when Source Control button clicked', () => {
    const onChangeView = vi.fn()
    render(<ActivityBar {...defaultProps} onChangeView={onChangeView} />)
    fireEvent.click(screen.getByTitle('Source Control'))
    expect(onChangeView).toHaveBeenCalledWith('git')
  })

  it('calls onChangeView with "extensions" when Extensions button clicked', () => {
    const onChangeView = vi.fn()
    render(<ActivityBar {...defaultProps} onChangeView={onChangeView} />)
    fireEvent.click(screen.getByTitle('Extensions'))
    expect(onChangeView).toHaveBeenCalledWith('extensions')
  })

  it('calls onChangeView with "settings" when Settings button clicked', () => {
    const onChangeView = vi.fn()
    render(<ActivityBar {...defaultProps} onChangeView={onChangeView} />)
    fireEvent.click(screen.getByTitle('Settings'))
    expect(onChangeView).toHaveBeenCalledWith('settings')
  })
})

describe('ActivityBar — terminal toggle', () => {
  it('calls onToggleTerminal when terminal button clicked', () => {
    const onToggleTerminal = vi.fn()
    render(<ActivityBar {...defaultProps} onToggleTerminal={onToggleTerminal} />)
    fireEvent.click(screen.getByTitle(/Terminal/))
    expect(onToggleTerminal).toHaveBeenCalledTimes(1)
  })

  it('applies active class when terminal is open', () => {
    render(<ActivityBar {...defaultProps} terminalOpen={true} />)
    const terminalBtn = screen.getByTitle(/Terminal/)
    expect(terminalBtn.className).toContain('bg-primary/15')
  })

  it('applies inactive class when terminal is closed', () => {
    render(<ActivityBar {...defaultProps} terminalOpen={false} />)
    const terminalBtn = screen.getByTitle(/Terminal/)
    expect(terminalBtn.className).toContain('text-muted-foreground')
  })
})

describe('ActivityBar — active view highlighting', () => {
  it('highlights the active view button', () => {
    render(<ActivityBar {...defaultProps} activeView="chat" />)
    const chatBtn = screen.getByTitle('Chat')
    expect(chatBtn.className).toContain('bg-primary/15')
  })

  it('does not highlight inactive view buttons', () => {
    render(<ActivityBar {...defaultProps} activeView="chat" />)
    const explorerBtn = screen.getByTitle('Explorer')
    expect(explorerBtn.className).toContain('text-muted-foreground')
  })

  it('highlights settings when activeView is settings', () => {
    render(<ActivityBar {...defaultProps} activeView="settings" />)
    const settingsBtn = screen.getByTitle('Settings')
    expect(settingsBtn.className).toContain('bg-primary/15')
  })
})

describe('ActivityBar — badges', () => {
  it('shows agent badge when agentBadge > 0', () => {
    render(<ActivityBar {...defaultProps} agentBadge={5} />)
    expect(screen.getByText('5')).toBeDefined()
  })

  it('shows git badge when gitBadge > 0', () => {
    render(<ActivityBar {...defaultProps} gitBadge={3} />)
    expect(screen.getByText('3')).toBeDefined()
  })

  it('shows "99+" for badges exceeding 99', () => {
    render(<ActivityBar {...defaultProps} agentBadge={150} />)
    expect(screen.getByText('99+')).toBeDefined()
  })

  it('does not show badge when badge is 0', () => {
    render(<ActivityBar {...defaultProps} agentBadge={0} />)
    const chatBtn = screen.getByTitle('Chat')
    const badgeSpan = chatBtn.querySelector('span')
    expect(badgeSpan).toBeNull()
  })

  it('defaults badges to 0 when not provided', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />,
    )
    const chatBtn = screen.getByTitle('Chat')
    const badgeSpan = chatBtn.querySelector('span')
    expect(badgeSpan).toBeNull()
  })
})

describe('ActivityBar — layout structure', () => {
  it('has proper container classes', () => {
    const { container } = render(<ActivityBar {...defaultProps} />)
    const root = container.firstElementChild!
    expect(root.className).toContain('flex')
    expect(root.className).toContain('w-12')
    expect(root.className).toContain('flex-col')
  })

  it('has a spacer div between main buttons and terminal/settings', () => {
    const { container } = render(<ActivityBar {...defaultProps} />)
    const divs = container.querySelectorAll('div.flex-1')
    expect(divs.length).toBeGreaterThanOrEqual(1)
  })
})
