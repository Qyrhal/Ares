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

describe('Sidebar sessions — ordering', () => {
  it('places each child directly under its parent, in spawn order, regardless of store insertion order', () => {
    // Store prepends new sessions, so children spawned after the parent end up
    // listed newest-first ahead of it (Agent 3, Agent 2, Agent 1, then parent).
    const sessions: Session[] = [
      mkSession({ id: 'child3', parentId: 'parent1', title: 'Agent 3', createdAt: 300 }),
      mkSession({ id: 'child2', parentId: 'parent1', title: 'Agent 2', createdAt: 200 }),
      mkSession({ id: 'child1', parentId: 'parent1', title: 'Agent 1', createdAt: 100 }),
      mkSession({ id: 'parent1', title: 'Orchestrator task', createdAt: 50 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)

    const titles = screen.getAllByText(/Orchestrator task|Agent \d/).map((el) => el.textContent)
    expect(titles).toEqual(['Orchestrator task', 'Agent 1', 'Agent 2', 'Agent 3'])
  })

  it('keeps independent root sessions in their existing relative order', () => {
    const sessions: Session[] = [
      mkSession({ id: 'root2', title: 'Second root', createdAt: 200 }),
      mkSession({ id: 'root1', title: 'First root', createdAt: 100 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)

    const titles = screen.getAllByText(/root/).map((el) => el.textContent)
    expect(titles).toEqual(['Second root', 'First root'])
  })

  it('places pinned sessions before unpinned ones', () => {
    const sessions: Session[] = [
      mkSession({ id: 's3', title: 'Alpha', createdAt: 300 }),
      mkSession({ id: 's1', title: 'Pinned older', createdAt: 100, pinned: true }),
      mkSession({ id: 's2', title: 'Pinned newer', createdAt: 200, pinned: true }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)

    const titles = screen.getAllByText(/Pinned|Alpha/).map((el) => el.textContent)
    expect(titles).toEqual(['Pinned newer', 'Pinned older', 'Alpha'])
  })

  it('renders nothing when sessions list is empty', () => {
    const { container } = render(<Sidebar {...NOOP_PROPS} sessions={[]} />)
    // The sidebar renders the aside even with no sessions — check no session-related content appears
    expect(screen.queryByText(/Session/)).toBeNull()
  })

  it('orders children under pinned parents correctly', () => {
    const sessions: Session[] = [
      mkSession({ id: 'child1', parentId: 'parent1', title: 'Kid', createdAt: 200 }),
      mkSession({ id: 'parent1', title: 'Pinned parent', createdAt: 100, pinned: true }),
      mkSession({ id: 'root2', title: 'Unpinned root', createdAt: 300 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)

    const titles = screen.getAllByText(/Pinned parent|Kid|Unpinned root/).map((el) => el.textContent)
    // Pinned parent and its child come first, then unpinned
    expect(titles).toEqual(['Pinned parent', 'Kid', 'Unpinned root'])
  })

  it('allows multiple pinned sessions at top with correct internal ordering', () => {
    const sessions: Session[] = [
      mkSession({ id: 's4', title: 'Z unpinned', createdAt: 400 }),
      mkSession({ id: 's1', title: 'A pinned', createdAt: 100, pinned: true }),
      mkSession({ id: 's2', title: 'B pinned', createdAt: 200, pinned: true }),
      mkSession({ id: 's3', title: 'C unpinned', createdAt: 300 }),
    ]

    render(<Sidebar {...NOOP_PROPS} sessions={sessions} />)

    const titles = screen.getAllByText(/A pinned|B pinned|C unpinned|Z unpinned/).map((el) => el.textContent)
    expect(titles).toEqual(['B pinned', 'A pinned', 'Z unpinned', 'C unpinned'])
  })
})
