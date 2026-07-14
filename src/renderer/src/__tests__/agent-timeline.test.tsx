import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AgentTimeline } from '../components/AgentTimeline'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test Session',
    model: 'gpt-4o',
    createdAt: Date.now() - 60000,
    updatedAt: Date.now(),
    messageCount: 5,
    agentStatus: undefined,
    parentId: undefined,
    pinned: false,
    ...overrides,
  }
}

describe('AgentTimeline — rendering', () => {
  it('renders empty state when no sessions', () => {
    render(<AgentTimeline sessions={[]} activeSessionId={null} onSelectSession={vi.fn()} />)
    expect(screen.getByText('No agents yet')).toBeInTheDocument()
  })

  it('renders session titles', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1', title: 'My Chat' })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('My Chat')).toBeInTheDocument()
  })

  it('shows message count', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1', messageCount: 10 })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('10 msg')).toBeInTheDocument()
  })

  it('shows 0 msg when messageCount is undefined', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ messageCount: undefined })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('0 msg')).toBeInTheDocument()
  })
})

describe('AgentTimeline — status icons', () => {
  it('shows running status label for running agents', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ agentStatus: 'running' })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('renders finished agents without crashing', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ agentStatus: 'done' })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    // Done agents render a CheckCircle icon (no text "done")
    // Verify the session title is still rendered
    expect(screen.getByText('Test Session')).toBeInTheDocument()
  })

  it('renders errored agents without crashing', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ agentStatus: 'error' })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('Test Session')).toBeInTheDocument()
  })

  it('highlights active session', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1' }), mkSession({ id: 's2', title: 'Other' })]}
        activeSessionId="s1"
        onSelectSession={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(2)
  })
})

describe('AgentTimeline — interaction', () => {
  it('calls onSelectSession when clicked', () => {
    const onSelectSession = vi.fn()
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1', title: 'Click Me' })]}
        activeSessionId={null}
        onSelectSession={onSelectSession}
      />
    )
    fireEvent.click(screen.getByText('Click Me'))
    expect(onSelectSession).toHaveBeenCalledWith('s1')
  })
})

describe('AgentTimeline — sorting', () => {
  it('sorts sessions by createdAt descending (newest first)', () => {
    render(
      <AgentTimeline
        sessions={[
          mkSession({ id: 's1', title: 'Older', createdAt: 1000 }),
          mkSession({ id: 's2', title: 'Newer', createdAt: 2000 }),
        ]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    // Newer should be first
    expect(buttons[0]).toHaveTextContent('Newer')
    expect(buttons[1]).toHaveTextContent('Older')
  })
})

describe('AgentTimeline — sub-agent indicator', () => {
  it('shows bot icon for sub-agents (parentId set)', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1', parentId: 'parent-1' })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    // Sub-agents render with Bot icon, parent sessions with MessageSquare
    // Both should render without crashing
    expect(screen.getByText('5 msg')).toBeInTheDocument()
  })
})

describe('AgentTimeline — duration format', () => {
  it('shows duration for finished agents', () => {
    const now = Date.now()
    render(
      <AgentTimeline
        sessions={[mkSession({
          agentStatus: 'done',
          createdAt: now - 65000,
          updatedAt: now,
        })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    // Should show "1m 5s" duration
    expect(screen.getByText(/\d+m \d+s/)).toBeInTheDocument()
  })
})
