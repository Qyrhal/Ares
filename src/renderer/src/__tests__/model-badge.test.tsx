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
