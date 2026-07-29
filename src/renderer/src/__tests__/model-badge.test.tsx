import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Sidebar } from '../components/Sidebar'
import { useAppStore } from '@/store/useAppStore'
import type { Session } from '@/types'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    title: 'Test Session',
    model: 'gpt-4o',
    createdAt: Date.now() - 60000,
    updatedAt: Date.now(),
    messageCount: 5,
    ...overrides,
  }
}

const noop = () => {}
const baseProps = {
  mode: 'chat' as const,
  sessions: [] as Session[],
  activeSessionId: null,
  onNewSession: noop,
  onSelectSession: noop,
  onDeleteSession: noop,
  onTogglePinSession: noop,
  fileNodes: [],
  workspacePath: null,
  onOpenFile: noop,
  onOpenFolder: noop,
  onFsCreateFile: noop as never,
  onFsCreateFolder: noop as never,
  onFsRename: noop as never,
  onFsDelete: noop as never,
}

beforeEach(() => {
  useAppStore.setState({
    sessions: [],
    sessionGroups: [],
    activeTabId: null,
  })
})

describe('Model badge on session cards', () => {
  it('renders model badge when model is set', () => {
    const session = makeSession({ model: 'claude-3.5-sonnet' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    expect(screen.getByText('claude-3.5-sonnet')).toBeInTheDocument()
  })

  it('does not render model badge when model is empty string', () => {
    const session = makeSession({ model: '' })
    const { container } = render(<Sidebar {...baseProps} sessions={[session]} />)
    const badge = container.querySelector('span.font-mono')
    expect(badge).toBeNull()
  })

  it('renders model badge with correct CSS classes', () => {
    const session = makeSession({ model: 'gpt-4o' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    const badge = screen.getByText('gpt-4o')
    expect(badge.tagName).toBe('SPAN')
    expect(badge.className).toContain('font-mono')
    expect(badge.className).toContain('rounded')
    expect(badge.className).toContain('truncate')
    expect(badge.className).toContain('max-w-[120px]')
  })

  it('truncates long model names via CSS truncate class', () => {
    const longModel = 'very-long-model-name-that-exceeds-twenty-characters'
    const session = makeSession({ model: longModel })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    const badge = screen.getByText(longModel)
    expect(badge.className).toContain('truncate')
    expect(badge.className).toContain('max-w-[120px]')
  })
})

describe('Model badge — multiple sessions', () => {
  it('renders model badge for each session that has a model', () => {
    const sessions = [
      makeSession({ id: 's1', model: 'claude-3.5-sonnet' }),
      makeSession({ id: 's2', model: 'gpt-4o-mini' }),
    ]
    render(<Sidebar {...baseProps} sessions={sessions} />)
    expect(screen.getByText('claude-3.5-sonnet')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
  })

  it('renders model badges for sessions with the same model', () => {
    const sessions = [
      makeSession({ id: 's1', model: 'gpt-4o' }),
      makeSession({ id: 's2', model: 'gpt-4o' }),
    ]
    render(<Sidebar {...baseProps} sessions={sessions} />)
    const badges = screen.getAllByText('gpt-4o')
    expect(badges.length).toBe(2)
  })
})

describe('Model badge — session without model', () => {
  it('does not render model badge when model is undefined', () => {
    const session = makeSession({ model: undefined as unknown as string })
    const { container } = render(<Sidebar {...baseProps} sessions={[session]} />)
    const badge = container.querySelector('span.font-mono')
    expect(badge).toBeNull()
  })

  it('does not render model badge when model is null', () => {
    const session = makeSession({ model: null as unknown as string })
    const { container } = render(<Sidebar {...baseProps} sessions={[session]} />)
    const badge = container.querySelector('span.font-mono')
    expect(badge).toBeNull()
  })
})

describe('Model badge — active session styling', () => {
  it('applies active styling to the selected session', () => {
    const sessions = [
      makeSession({ id: 's1', model: 'gpt-4o' }),
      makeSession({ id: 's2', model: 'claude-3.5' }),
    ]
    render(<Sidebar {...baseProps} sessions={sessions} activeSessionId="s1" />)
    // Both model badges should still render
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('claude-3.5')).toBeInTheDocument()
  })
})

describe('Model badge — special characters in model name', () => {
  it('renders model name with special characters', () => {
    const session = makeSession({ model: 'model/v2.1-beta_1' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    expect(screen.getByText('model/v2.1-beta_1')).toBeInTheDocument()
  })

  it('renders model name with dots and colons', () => {
    const session = makeSession({ model: 'anthropic.claude-3:latest' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    expect(screen.getByText('anthropic.claude-3:latest')).toBeInTheDocument()
  })
})

describe('Model badge — position in session card', () => {
  it('renders model badge as a span element', () => {
    const session = makeSession({ model: 'gpt-4o' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    const badge = screen.getByText('gpt-4o')
    expect(badge.tagName).toBe('SPAN')
  })

  it('renders model badge with muted styling', () => {
    const session = makeSession({ model: 'gpt-4o' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    const badge = screen.getByText('gpt-4o')
    expect(badge.className).toContain('text-muted-foreground/70')
    expect(badge.className).toContain('bg-muted/50')
  })
})

describe('Model badge — mixed sessions', () => {
  it('only shows model badge for sessions that have a model', () => {
    const sessions = [
      makeSession({ id: 's1', model: 'gpt-4o' }),
      makeSession({ id: 's2', model: '' }),
      makeSession({ id: 's3', model: 'claude-3.5' }),
    ]
    render(<Sidebar {...baseProps} sessions={sessions} />)
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('claude-3.5')).toBeInTheDocument()
    // Empty model should not render a badge
    const { container } = render(<Sidebar {...baseProps} sessions={[sessions[1]]} />)
    const badge = container.querySelector('span.font-mono')
    expect(badge).toBeNull()
  })
})
