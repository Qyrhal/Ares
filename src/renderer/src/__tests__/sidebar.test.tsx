import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Sidebar } from '../components/Sidebar'
import { useAppStore } from '../store/useAppStore'
import type { Session, SessionGroup, FileNode } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test Session', model: 'gpt-4o',
    createdAt: Date.now() - 60000, updatedAt: Date.now(), messageCount: 5,
    parentId: null, agentStatus: 'idle', ...overrides,
  }
}

function mkGroup(overrides: Partial<SessionGroup> = {}): SessionGroup {
  return { id: 'g1', name: 'Group 1', createdAt: Date.now(), ...overrides }
}

function mkFileNode(overrides: Partial<FileNode> = {}): FileNode {
  return { name: 'test.ts', path: '/test.ts', type: 'file', ...overrides }
}

const NOOP_PROPS = {
  mode: 'chat' as const,
  sessions: [] as Session[],
  activeSessionId: null,
  onNewSession: vi.fn(),
  onSelectSession: vi.fn(),
  onDeleteSession: vi.fn(),
  onTogglePinSession: vi.fn(),
  onRenameSession: vi.fn(),
  onDuplicateSession: vi.fn(),
  onExportSession: vi.fn(),
  onArchiveSession: vi.fn(),
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
  useAppStore.setState({
    sessionGroups: [],
    activeView: 'chat',
  })
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.click()
})

// ── Mode switching ──────────────────────────────────────────────────────────

describe('Sidebar — mode switching', () => {
  it('renders sessions pane in chat mode', () => {
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[mkSession()]} />)
    expect(screen.getByText('Sessions')).toBeDefined()
  })

  it('renders file tree in explorer mode', () => {
    const nodes = [mkFileNode()]
    render(<Sidebar {...NOOP_PROPS} mode="explorer" fileNodes={nodes} workspacePath="/project" sessions={[]} />)
    expect(screen.getByText('test.ts')).toBeDefined()
  })

  it('renders git pane in git mode', () => {
    render(<Sidebar {...NOOP_PROPS} mode="git" sessions={[]} />)
    expect(screen.getByText('Loading…')).toBeDefined()
  })
})

// ── Sessions pane rendering ─────────────────────────────────────────────────

describe('Sidebar — sessions pane', () => {
  it('renders toolbar buttons', () => {
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[]} />)
    expect(screen.getByTitle('Add session group')).toBeDefined()
    expect(screen.getByTitle('Import session')).toBeDefined()
    expect(screen.getByTitle('Export active session')).toBeDefined()
  })

  it('renders all sessions', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'First' }),
      mkSession({ id: 's2', title: 'Second' }),
      mkSession({ id: 's3', title: 'Third' }),
    ]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(screen.getByText('First')).toBeDefined()
    expect(screen.getByText('Second')).toBeDefined()
    expect(screen.getByText('Third')).toBeDefined()
  })

  it('calls onSelectSession when session clicked', () => {
    const onSelect = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Session 1' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onSelectSession={onSelect} />)
    fireEvent.click(screen.getByText('Session 1'))
    expect(onSelect).toHaveBeenCalledWith('s1')
  })

  it('shows time ago and message count', () => {
    const sessions = [mkSession({ id: 's1', title: 'Session', messageCount: 42 })]
    const { container } = render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    // Message count appears in "42 msg" format
    expect(container.textContent).toContain('42')
    expect(container.textContent).toContain('msg')
  })

  it('renders empty state when no sessions', () => {
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[]} />)
    expect(screen.getByText('No sessions yet')).toBeDefined()
    expect(screen.getByText('Start one')).toBeDefined()
  })

  it('calls onNewSession when Start one clicked', () => {
    const onNew = vi.fn()
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[]} onNewSession={onNew} />)
    fireEvent.click(screen.getByText('Start one'))
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('renders sub-agent sessions with bot icon', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Parent' }),
      mkSession({ id: 's2', title: 'Child', parentId: 's1' }),
    ]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(screen.getByText('Parent')).toBeDefined()
    expect(screen.getByText('Child')).toBeDefined()
  })

  it('shows running status for running sessions', () => {
    const sessions = [mkSession({ id: 's1', title: 'Running', agentStatus: 'running' })]
    const { container } = render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(container.textContent).toContain('running')
  })

  it('shows done status for completed sessions', () => {
    const sessions = [mkSession({ id: 's1', title: 'Done', agentStatus: 'done' })]
    const { container } = render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(container.textContent).toContain('done')
  })

  it('shows error status for failed sessions', () => {
    const sessions = [mkSession({ id: 's1', title: 'Error', agentStatus: 'error' })]
    const { container } = render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(container.textContent).toContain('error')
  })
})

// ── View mode toggle ────────────────────────────────────────────────────────

describe('Sidebar — view mode toggle', () => {
  it('defaults to list view', () => {
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[]} />)
    expect(screen.getByTitle('Timeline view')).toBeDefined()
  })

  it('toggles to timeline view on click', async () => {
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[]} />)
    fireEvent.click(screen.getByTitle('Timeline view'))
    await waitFor(() => {
      expect(screen.getByTitle('List view')).toBeDefined()
    })
  })
})

// ── Context menu ────────────────────────────────────────────────────────────

describe('Sidebar — context menu', () => {
  it('opens context menu on right-click', async () => {
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    fireEvent.contextMenu(screen.getByText('Session').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeDefined()
    })
  })

  it('context menu has all expected options', async () => {
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    fireEvent.contextMenu(screen.getByText('Session').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeDefined()
      expect(screen.getByText('Duplicate')).toBeDefined()
      expect(screen.getByText('Export')).toBeDefined()
      expect(screen.getByText('Pin')).toBeDefined()
      expect(screen.getByText('Delete')).toBeDefined()
    })
  })

  it('context menu closes on Escape', async () => {
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    fireEvent.contextMenu(screen.getByText('Session').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeDefined()
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByText('Rename')).toBeNull()
    })
  })

  it('calls onDeleteSession when delete clicked', async () => {
    const onDelete = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onDeleteSession={onDelete} />)
    fireEvent.contextMenu(screen.getByText('Session').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'))
    })
    expect(onDelete).toHaveBeenCalledWith('s1')
  })

  it('calls onTogglePinSession when pin clicked', async () => {
    const onTogglePin = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onTogglePinSession={onTogglePin} />)
    fireEvent.contextMenu(screen.getByText('Session').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Pin'))
    })
    expect(onTogglePin).toHaveBeenCalledWith('s1')
  })

  it('calls onExportSession when export clicked', async () => {
    const onExport = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onExportSession={onExport} />)
    fireEvent.contextMenu(screen.getByText('Session').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Export'))
    })
    expect(onExport).toHaveBeenCalledWith(sessions[0])
  })

  it('calls onDuplicateSession when duplicate clicked', async () => {
    const onDuplicate = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onDuplicateSession={onDuplicate} />)
    fireEvent.contextMenu(screen.getByText('Session').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Duplicate'))
    })
    expect(onDuplicate).toHaveBeenCalledWith(sessions[0])
  })
})

// ── Inline rename ───────────────────────────────────────────────────────────

describe('Sidebar — inline rename', () => {
  it('shows rename input when rename clicked', async () => {
    const sessions = [mkSession({ id: 's1', title: 'Original' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    fireEvent.contextMenu(screen.getByText('Original').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Rename'))
    })
    await waitFor(() => {
      expect(screen.getByDisplayValue('Original')).toBeDefined()
    })
  })

  it('saves rename on Enter', async () => {
    const onRename = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Original' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onRenameSession={onRename} />)
    fireEvent.contextMenu(screen.getByText('Original').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Rename'))
    })
    await waitFor(() => {
      const input = screen.getByDisplayValue('Original')
      fireEvent.change(input, { target: { value: 'Renamed' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onRename).toHaveBeenCalledWith('s1', 'Renamed')
  })

  it('cancels rename on Escape', async () => {
    const onRename = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Original' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onRenameSession={onRename} />)
    fireEvent.contextMenu(screen.getByText('Original').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Rename'))
    })
    await waitFor(() => {
      const input = screen.getByDisplayValue('Original')
      fireEvent.change(input, { target: { value: 'Changed' } })
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    expect(onRename).not.toHaveBeenCalled()
  })

  it('does not save empty rename', async () => {
    const onRename = vi.fn()
    const sessions = [mkSession({ id: 's1', title: 'Original' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} onRenameSession={onRename} />)
    fireEvent.contextMenu(screen.getByText('Original').closest('button')!)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Rename'))
    })
    await waitFor(() => {
      const input = screen.getByDisplayValue('Original')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onRename).not.toHaveBeenCalled()
  })
})

// ── Session groups ──────────────────────────────────────────────────────────

describe('Sidebar — session groups', () => {
  it('renders groups when sessions have groups', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Session 1', group: 'g1' }),
    ]
    const groups = [mkGroup({ id: 'g1', name: 'My Group' })]
    useAppStore.setState({ sessionGroups: groups })
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(screen.getByText('My Group')).toBeDefined()
  })

  it('renders ungrouped sessions', () => {
    const sessions = [mkSession({ id: 's1', title: 'Ungrouped' })]
    useAppStore.setState({ sessionGroups: [] })
    const { container } = render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(container.textContent).toContain('Ungrouped')
  })

  it('collapses group on chevron click', async () => {
    const sessions = [
      mkSession({ id: 's1', title: 'In Group', group: 'g1' }),
    ]
    const groups = [mkGroup({ id: 'g1', name: 'Group' })]
    useAppStore.setState({ sessionGroups: groups })
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    const groupHeader = screen.getByText('Group').closest('[class*="cursor-pointer"]')!
    fireEvent.click(groupHeader)
    await waitFor(() => {
      expect(screen.queryByText('In Group')).toBeNull()
    })
  })

  it('expands group on second chevron click', async () => {
    const sessions = [
      mkSession({ id: 's1', title: 'In Group', group: 'g1' }),
    ]
    const groups = [mkGroup({ id: 'g1', name: 'Group' })]
    useAppStore.setState({ sessionGroups: groups })
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    const groupHeader = screen.getByText('Group').closest('[class*="cursor-pointer"]')!
    fireEvent.click(groupHeader)
    await waitFor(() => {
      expect(screen.queryByText('In Group')).toBeNull()
    })
    fireEvent.click(groupHeader)
    await waitFor(() => {
      expect(screen.getByText('In Group')).toBeDefined()
    })
  })
})

// ── Empty states ────────────────────────────────────────────────────────────

describe('Sidebar — empty states', () => {
  it('shows empty message for chat mode with no sessions', () => {
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[]} />)
    expect(screen.getByText('No sessions yet')).toBeDefined()
  })

  it('shows open folder prompt for explorer mode with no workspace', () => {
    render(<Sidebar {...NOOP_PROPS} mode="explorer" fileNodes={[]} workspacePath={null} sessions={[]} />)
    expect(screen.getByText('Open a folder to browse files.')).toBeDefined()
  })

  it('calls onOpenFolder when open folder button clicked', () => {
    const onOpenFolder = vi.fn()
    render(<Sidebar {...NOOP_PROPS} mode="explorer" fileNodes={[]} workspacePath={null} onOpenFolder={onOpenFolder} sessions={[]} />)
    fireEvent.click(screen.getByText('Open folder'))
    expect(onOpenFolder).toHaveBeenCalledTimes(1)
  })
})

// ── Many sessions stress test ───────────────────────────────────────────────

describe('Sidebar — many sessions', () => {
  it('renders 50 sessions without crashing', () => {
    const sessions = Array.from({ length: 50 }, (_, i) =>
      mkSession({ id: `s${i}`, title: `Session ${i}` })
    )
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(screen.getByText('Session 0')).toBeDefined()
    expect(screen.getByText('Session 49')).toBeDefined()
  })
})

// ── Pinned sessions ─────────────────────────────────────────────────────────

describe('Sidebar — pinned sessions', () => {
  it('shows pinned section header', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Pinned One', pinned: true }),
    ]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(screen.getByText('Pinned')).toBeDefined()
  })

  it('renders pinned sessions in pinned section', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'My Pinned', pinned: true }),
    ]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} />)
    expect(screen.getByText('My Pinned')).toBeDefined()
  })
})

// ── Export button state ──────────────────────────────────────────────────────

describe('Sidebar — export button', () => {
  it('export button is disabled when no active session', () => {
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={[]} activeSessionId={null} />)
    const btn = screen.getByTitle('Export active session')
    expect(btn).toBeDisabled()
  })

  it('export button is enabled when active session exists', () => {
    const sessions = [mkSession({ id: 's1', title: 'Session' })]
    render(<Sidebar {...NOOP_PROPS} mode="chat" sessions={sessions} activeSessionId="s1" />)
    const btn = screen.getByTitle('Export active session')
    expect(btn).not.toBeDisabled()
  })
})
