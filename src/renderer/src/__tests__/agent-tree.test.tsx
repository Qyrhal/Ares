import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentTree } from '../components/AgentTree'
import type { Session } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test Session', model: 'gpt-4o',
    createdAt: 0, updatedAt: 0, messageCount: 0,
    parentId: null, agentStatus: 'idle', ...overrides,
  }
}

const DEFAULT_PROPS = {
  sessions: [] as Session[],
  activeSessionId: null as string | null,
  onSelectSession: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AgentTree — empty state', () => {
  it('shows "No agents yet." when sessions is empty', () => {
    render(<AgentTree {...DEFAULT_PROPS} />)
    expect(screen.getByText('No agents yet.')).toBeInTheDocument()
  })

  it('shows informational message that agents are spawned automatically', () => {
    render(<AgentTree {...DEFAULT_PROPS} />)
    expect(screen.getByText(/spawned automatically/i)).toBeInTheDocument()
  })

  it('does not show a spawn button in empty state', () => {
    render(<AgentTree {...DEFAULT_PROPS} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('AgentTree — header', () => {
  it('renders "Agent Tree" label', () => {
    render(<AgentTree {...DEFAULT_PROPS} />)
    expect(screen.getByText('Agent Tree')).toBeInTheDocument()
  })

  it('does not render a Spawn button in the header', () => {
    render(<AgentTree {...DEFAULT_PROPS} />)
    expect(screen.queryByTitle('Spawn new agent')).not.toBeInTheDocument()
  })

  it('shows running count badge when agents are running', () => {
    const sessions = [
      mkSession({ id: 's1', agentStatus: 'running' }),
      mkSession({ id: 's2', agentStatus: 'running' }),
      mkSession({ id: 's3', agentStatus: 'done' }),
    ]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.getByText('2 running')).toBeInTheDocument()
  })

  it('hides running badge when no agents are running', () => {
    const sessions = [mkSession({ id: 's1', agentStatus: 'done' })]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.queryByText(/running/)).not.toBeInTheDocument()
  })
})

describe('AgentTree — session nodes', () => {
  it('renders session title', () => {
    const sessions = [mkSession({ id: 's1', title: 'My Agent Task' })]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.getByText('My Agent Task')).toBeInTheDocument()
  })

  it('renders multiple root sessions', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Agent One' }),
      mkSession({ id: 's2', title: 'Agent Two' }),
    ]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.getByText('Agent One')).toBeInTheDocument()
    expect(screen.getByText('Agent Two')).toBeInTheDocument()
  })

  it('calls onSelectSession with correct id when session clicked', () => {
    const onSelectSession = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Clickable Agent' })]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} onSelectSession={onSelectSession} />)
    fireEvent.click(screen.getByText('Clickable Agent'))
    expect(onSelectSession).toHaveBeenCalledWith('s1')
  })

  it('shows message count when > 0', () => {
    const sessions = [mkSession({ id: 's1', messageCount: 7 })]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('does not show message count when 0', () => {
    const sessions = [mkSession({ id: 's1', title: 'Empty Agent', messageCount: 0 })]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})

describe('AgentTree — tree nesting', () => {
  it('renders child session under parent', () => {
    const sessions = [
      mkSession({ id: 'parent', title: 'Parent Agent', parentId: null }),
      mkSession({ id: 'child', title: 'Child Agent', parentId: 'parent' }),
    ]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.getByText('Parent Agent')).toBeInTheDocument()
    expect(screen.getByText('Child Agent')).toBeInTheDocument()
  })

  it('clicking child node calls onSelectSession with child id', () => {
    const onSelectSession = vi.fn()
    const sessions = [
      mkSession({ id: 'parent', title: 'Parent', parentId: null }),
      mkSession({ id: 'child', title: 'Child', parentId: 'parent' }),
    ]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} onSelectSession={onSelectSession} />)
    fireEvent.click(screen.getByText('Child'))
    expect(onSelectSession).toHaveBeenCalledWith('child')
  })

  it('orphaned sessions (invalid parentId) appear at root', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Orphan', parentId: 'nonexistent-parent' }),
    ]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} />)
    expect(screen.getByText('Orphan')).toBeInTheDocument()
  })
})

describe('AgentTree — active session highlighting', () => {
  it('active session button has primary bg class', () => {
    const sessions = [mkSession({ id: 's1', title: 'Active Agent' })]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} activeSessionId="s1" />)
    const btn = screen.getByText('Active Agent').closest('button')
    expect(btn?.className).toContain('bg-primary')
  })

  it('inactive session does not have primary bg class', () => {
    const sessions = [mkSession({ id: 's1', title: 'Inactive' })]
    render(<AgentTree {...DEFAULT_PROPS} sessions={sessions} activeSessionId="other" />)
    const btn = screen.getByText('Inactive').closest('button')
    expect(btn?.className).not.toContain('bg-primary/10')
  })
})
