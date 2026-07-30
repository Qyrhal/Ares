import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { Sidebar } from '../components/Sidebar'
import { useAppStore } from '@/store/useAppStore'
import type { Session } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    title: 'Test Session',
    model: 'gpt-4o',
    tags: ['work', 'frontend'],
    notes: 'Some notes here',
    agentStatus: 'done',
    createdAt: Date.now() - 60000,
    updatedAt: Date.now(),
    messageCount: 5,
    pinned: false,
    archived: false,
    ...overrides,
  } as Session
}

const defaultProps = {
  mode: 'chat' as const,
  sessions: [mkSession()],
  activeSessionId: null,
  onNewSession: () => {},
  onSelectSession: () => {},
  onDeleteSession: () => {},
  onTogglePinSession: () => {},
  fileNodes: [],
  workspacePath: null,
  onOpenFile: () => {},
  onOpenFolder: () => {},
  onFsCreateFile: undefined,
  onFsCreateFolder: undefined,
  onFsRename: undefined,
  onFsDelete: undefined,
}

function renderSidebar(overrides: Record<string, unknown> = {}) {
  return render(<Sidebar {...defaultProps} {...overrides} />)
}

describe('Sidebar — compact mode', () => {
  beforeEach(() => {
    // Reset compactSidebar to false before each test
    useAppStore.setState({ compactSidebar: false })
  })

  it('renders in normal mode by default', () => {
    renderSidebar()
    expect(screen.getByText('Test Session')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    // Pinned header visible in normal mode (no pinned sessions, so not rendered)
    // Tags should be visible
    expect(screen.getByText('work')).toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
  })

  it('renders in compact mode when compactSidebar is true', () => {
    useAppStore.setState({ compactSidebar: true })
    renderSidebar()
    expect(screen.getByText('Test Session')).toBeInTheDocument()
  })

  it('toggle switches between normal and compact mode', () => {
    renderSidebar()
    // Find the compact toggle button by title
    const toggleButton = screen.getByTitle('Compact sidebar')
    expect(toggleButton).toBeInTheDocument()

    // Click to enable compact mode
    fireEvent.click(toggleButton)
    expect(useAppStore.getState().compactSidebar).toBe(true)

    // Button title should change
    expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument()

    // Click again to disable
    fireEvent.click(screen.getByTitle('Expand sidebar'))
    expect(useAppStore.getState().compactSidebar).toBe(false)
  })

  it('compact mode hides model badge', () => {
    useAppStore.setState({ compactSidebar: true })
    renderSidebar()
    expect(screen.queryByText('gpt-4o')).not.toBeInTheDocument()
  })

  it('compact mode hides tags', () => {
    useAppStore.setState({ compactSidebar: true })
    renderSidebar()
    expect(screen.queryByText('work')).not.toBeInTheDocument()
    expect(screen.queryByText('frontend')).not.toBeInTheDocument()
  })

  it('compact mode hides notes', () => {
    useAppStore.setState({ compactSidebar: true })
    renderSidebar()
    expect(screen.queryByText(/Some notes here/)).not.toBeInTheDocument()
  })

  it('compact mode applies reduced padding (py-0.5)', () => {
    useAppStore.setState({ compactSidebar: true })
    const { container } = renderSidebar()
    // Session card button should have py-0.5 class
    const sessionButton = container.querySelector('button.group')
    expect(sessionButton).toBeInTheDocument()
    expect(sessionButton?.className).toContain('py-0.5')
  })

  it('normal mode applies standard padding (py-1.5)', () => {
    useAppStore.setState({ compactSidebar: false })
    const { container } = renderSidebar()
    const sessionButton = container.querySelector('button.group')
    expect(sessionButton).toBeInTheDocument()
    expect(sessionButton?.className).toContain('py-1.5')
  })

  it('compact mode hides pinned section header text', () => {
    const pinnedSession = mkSession({ id: 'p1', title: 'Pinned Session', pinned: true })
    useAppStore.setState({ compactSidebar: true })
    renderSidebar({ sessions: [pinnedSession] })
    // "Pinned" section header should not be visible
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
    // But the session title should still be there
    expect(screen.getByText('Pinned Session')).toBeInTheDocument()
  })

  it('normal mode shows pinned section header text', () => {
    const pinnedSession = mkSession({ id: 'p1', title: 'Pinned Session', pinned: true })
    useAppStore.setState({ compactSidebar: false })
    renderSidebar({ sessions: [pinnedSession] })
    expect(screen.getByText('Pinned')).toBeInTheDocument()
  })
})
