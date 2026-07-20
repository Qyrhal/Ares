import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Sidebar } from '../components/Sidebar'
import { useAppStore } from '@/store/useAppStore'
import type { Session, FileNode } from '@/types'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    title: 'Test Session',
    model: 'gpt-4o-mini',
    createdAt: Date.now() - 60000,
    updatedAt: Date.now(),
    messageCount: 5,
    ...overrides,
  }
}

const noop = () => {}
const baseProps = {
  mode: 'chat' as const,
  sessions: [],
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

describe('Session Notes in Sidebar', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [],
      sessionGroups: [],
      activeTabId: null,
    })
  })

  it('shows notes indicator when session has notes', () => {
    const session = makeSession({ notes: 'Fix the auth bug' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    expect(screen.getByText(/📝.*Fix the auth bug/)).toBeInTheDocument()
  })

  it('does not show notes indicator when session has no notes', () => {
    const session = makeSession({ notes: undefined })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    expect(screen.queryByText(/📝/)).not.toBeInTheDocument()
  })

  it('truncates long notes', () => {
    const longNotes = 'A'.repeat(100)
    const session = makeSession({ notes: longNotes })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    const notesEl = screen.getByText(/📝/)
    expect(notesEl.textContent!.length).toBeLessThan(longNotes.length + 5)
  })

  it('shows full notes in title attribute', () => {
    const session = makeSession({ notes: 'Important context for later' })
    render(<Sidebar {...baseProps} sessions={[session]} />)
    const notesEl = screen.getByText(/📝/)
    expect(notesEl.getAttribute('title')).toBe('Important context for later')
  })
})
