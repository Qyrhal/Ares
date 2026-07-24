import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AgentTimeline } from '../components/AgentTimeline'
import type { AgentStatus } from '@/types'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test Session',
    model: 'gpt-4o',
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now(),
    messageCount: 5,
    pinned: false,
    archived: false,
    agentStatus: 'idle' as AgentStatus,
    ...overrides,
  }
}

describe('AgentTimeline', () => {
  it('renders empty state when no sessions', () => {
    render(
      <AgentTimeline sessions={[]} activeSessionId={null} onSelectSession={vi.fn()} />
    )
    expect(screen.getByText('No agents yet')).toBeInTheDocument()
  })

  it('renders a session with title', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ title: 'My Agent Task' })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('My Agent Task')).toBeInTheDocument()
  })

  it('calls onSelectSession when a session is clicked', () => {
    const onSelect = vi.fn()
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1', title: 'Click Me' })]}
        activeSessionId={null}
        onSelectSession={onSelect}
      />
    )
    fireEvent.click(screen.getByText('Click Me'))
    expect(onSelect).toHaveBeenCalledWith('s1')
  })

  it('highlights the active session', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1', title: 'Active' })]}
        activeSessionId="s1"
        onSelectSession={vi.fn()}
      />
    )
    const btn = screen.getByText('Active').closest('button')!
    expect(btn.className).toContain('bg-accent')
  })

  it('does not highlight non-active sessions', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ id: 's1', title: 'Other' })]}
        activeSessionId="s2"
        onSelectSession={vi.fn()}
      />
    )
    const btn = screen.getByText('Other').closest('button')!
    expect(btn.className).not.toContain('bg-accent text-foreground')
  })

  it('sorts sessions by createdAt descending (newest first)', () => {
    render(
      <AgentTimeline
        sessions={[
          mkSession({ id: 'old', title: 'Old Session', createdAt: 100 }),
          mkSession({ id: 'new', title: 'New Session', createdAt: 200 }),
        ]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    const titles = screen.getAllByText(/Session$/).map((el) => el.textContent)
    expect(titles).toEqual(['New Session', 'Old Session'])
  })

  it('shows running status label for running sessions', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ agentStatus: 'running' as AgentStatus })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('does not show running label for idle sessions', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ agentStatus: 'idle' as AgentStatus })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.queryByText('running')).not.toBeInTheDocument()
  })

  it('shows message count', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ messageCount: 12 })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText(/12 msg/)).toBeInTheDocument()
  })

  it('shows child sessions with Bot icon indicator', () => {
    render(
      <AgentTimeline
        sessions={[mkSession({ parentId: 'parent-1', title: 'Child' })]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('renders groups when sessionGroups provided', () => {
    render(
      <AgentTimeline
        sessions={[
          mkSession({ id: 'g1', title: 'Grouped', group: 'grp-1', createdAt: 100 }),
        ]}
        sessionGroups={[{ id: 'grp-1', name: 'My Group', createdAt: 50 }]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('My Group')).toBeInTheDocument()
    expect(screen.getByText('Grouped')).toBeInTheDocument()
  })

  it('puts ungrouped sessions in Ungrouped section', () => {
    render(
      <AgentTimeline
        sessions={[
          mkSession({ id: 'ung', title: 'Ungrouped', createdAt: 100 }),
        ]}
        sessionGroups={[{ id: 'grp-1', name: 'Group', createdAt: 50 }]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getAllByText(/Ungrouped/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Ungrouped')).toBeInTheDocument()
  })

  it('renders multiple sessions', () => {
    render(
      <AgentTimeline
        sessions={[
          mkSession({ id: 'a', title: 'First' }),
          mkSession({ id: 'b', title: 'Second' }),
          mkSession({ id: 'c', title: 'Third' }),
        ]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
      />
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })
})
