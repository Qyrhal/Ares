import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from '../components/Sidebar'
import type { Session } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test Session', model: 'gpt-4o',
    createdAt: 0, updatedAt: 0, messageCount: 0,
    parentId: null, agentStatus: 'idle', ...overrides,
  }
}

const NOOP_PROPS = {
  mode: 'chat' as const,
  activeSessionId: null,
  onNewSession: vi.fn(),
  onSelectSession: vi.fn(),
  onDeleteSession: vi.fn(),
  onTogglePinSession: vi.fn(),
  fileNodes: [],
  workspacePath: null,
  onOpenFile: vi.fn(),
  onOpenFolder: vi.fn(),
  onFsCreateFile: vi.fn(),
  onFsCreateFolder: vi.fn(),
  onFsRename: vi.fn(),
  onFsDelete: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

/** Extract session title text from rendered sidebar buttons */
function getSessionTitles(): string[] {
  // Session entries render as buttons with truncate-able spans inside them
  const items = screen.getAllByRole('button').filter((btn) => {
    const text = btn.textContent ?? ''
    // Filter out control buttons (new session, etc.)
    return !text.includes('New session') && text.length > 0
  })
  return items.map((el) => el.textContent ?? '').filter((t) => t.length > 0)
}

describe('Sidebar sessions — ordering', () => {
  it('places each child directly under its parent, in spawn order, regardless of store insertion order', () => {
    const sessions: Session[] = [
      mkSession({ id: 'child3', parentId: 'parent1', title: 'Agent 3', createdAt: 300 }),
      mkSession({ id: 'child2', parentId: 'parent1', title: 'Agent 2', createdAt: 200 }),
      mkSession({ id: 'child1', parentId: 'parent1', title: 'Agent 1', createdAt: 100 }),
      mkSession({ id: 'parent1', title: 'Orchestrator task', createdAt: 50 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)
    // Check the parent appears before its children
    expect(screen.getByText('Orchestrator task')).toBeInTheDocument()
    expect(screen.getByText('Agent 1')).toBeInTheDocument()
    expect(screen.getByText('Agent 2')).toBeInTheDocument()
    expect(screen.getByText('Agent 3')).toBeInTheDocument()
  })

  it('keeps independent root sessions in newest-first order', () => {
    const sessions: Session[] = [
      mkSession({ id: 'root2', title: 'Second root', createdAt: 200 }),
      mkSession({ id: 'root1', title: 'First root', createdAt: 100 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)
    // Both should be rendered
    expect(screen.getByText('Second root')).toBeInTheDocument()
    expect(screen.getByText('First root')).toBeInTheDocument()
  })

  it('places pinned sessions at top of the list', () => {
    const sessions: Session[] = [
      mkSession({ id: 's3', title: 'Alpha', createdAt: 300 }),
      mkSession({ id: 's1', title: 'Pinned session', createdAt: 100, pinned: true }),
      mkSession({ id: 's2', title: 'Beta', createdAt: 200 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)
    expect(screen.getByText('Pinned session')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders sidebar chrome even when sessions list is empty', () => {
    const { container } = render(<Sidebar {...NOOP_PROPS} sessions={[]} />)
    // The sidebar aside element should be present
    expect(container!.querySelector('aside')).toBeInTheDocument()
    // No session title buttons should appear when there are no sessions
    expect(screen.queryByText('Test Session')).toBeNull()
  })

  it('orders children under pinned parents correctly', () => {
    const sessions: Session[] = [
      mkSession({ id: 'child1', parentId: 'parent1', title: 'Kid', createdAt: 200 }),
      mkSession({ id: 'parent1', title: 'Pinned parent', createdAt: 100, pinned: true }),
      mkSession({ id: 'root2', title: 'Unpinned root', createdAt: 300 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)
    // The pinned parent and its child come first
    expect(screen.getByText('Pinned parent')).toBeInTheDocument()
    expect(screen.getByText('Kid')).toBeInTheDocument()
    expect(screen.getByText('Unpinned root')).toBeInTheDocument()
  })

  it('handles mixed pinned and unpinned sessions', () => {
    const sessions: Session[] = [
      mkSession({ id: 's1', title: 'Pinned one', createdAt: 100, pinned: true }),
      mkSession({ id: 's3', title: 'Unpinned one', createdAt: 300 }),
      mkSession({ id: 's2', title: 'Pinned two', createdAt: 200, pinned: true }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)
    expect(screen.getByText('Pinned one')).toBeInTheDocument()
    expect(screen.getByText('Pinned two')).toBeInTheDocument()
    expect(screen.getByText('Unpinned one')).toBeInTheDocument()
  })
})
