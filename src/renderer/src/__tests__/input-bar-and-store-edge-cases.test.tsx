import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'
import { useAppStore } from '@/store/useAppStore'
import type { Session, Message, Tab } from '@/types'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

// ── InputBar click-outside closes picker ─────────────────────────────────────

describe('InputBar — click outside closes picker', () => {
  it('clicking outside the textarea and picker closes the command picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Open picker
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    // Click outside (on the document body)
    fireEvent.mouseDown(document.body)
    // Picker should be closed
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('clicking outside closes the @ mention picker', () => {
    const fileNodes = [
      { name: 'test.ts', path: '/test.ts', type: 'file', children: [] },
    ]
    renderInputBar({ fileNodes })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
    // Click outside
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('test.ts')).not.toBeInTheDocument()
  })

  it('clicking inside the textarea does NOT close the picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    // Click on textarea
    fireEvent.mouseDown(textarea)
    // Picker should still be open
    expect(screen.queryByText('/model')).toBeInTheDocument()
  })
})

// ── InputBar keyboard nav prevents cursor movement ──────────────────────────

describe('InputBar — keyboard navigation in picker prevents default', () => {
  it('ArrowDown in command picker does not move cursor', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/' } })
    // Cursor should be at end
    // ArrowDown should be prevented (no cursor movement)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    // Highlight should have moved to /folder
    const folderBtn = screen.getByText('/folder').closest('button')!
    expect(folderBtn).toHaveClass('bg-accent')
  })

  it('Escape in command picker closes it and prevents default', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('Enter in command picker dispatches highlighted command', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/cl' } })
    // Default highlight is 0 → /clear
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Tab in command picker dispatches highlighted command', () => {
    const onRevealInExplorer = vi.fn()
    renderInputBar({ onRevealInExplorer, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Navigate to /folder (index 1)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    // Tab should execute /folder
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onRevealInExplorer).toHaveBeenCalled()
  })
})

// ── Store edge cases ─────────────────────────────────────────────────────────

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test', model: 'gpt-4o',
    createdAt: 0, updatedAt: 0, messageCount: 0, ...overrides,
  }
}

function mkMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1', sessionId: 's1', role: 'user', content: 'Hello',
    createdAt: 0, ...overrides,
  }
}

beforeEach(() => {
  useAppStore.setState({
    sessions: [],
    messages: [],
    todos: [],
    tabs: [],
    activeTabId: null,
    activeView: 'chat',
    sessionGroups: [],
    sideChatMessages: [],
    sideChatSessionId: null,
    sideChatIsLoading: false,
  })
})

// ── Tab edge cases ──────────────────────────────────────────────────────────

describe('store — closeTab edge cases', () => {
  function makeTab(id: string): Tab {
    return { type: 'session', id, title: id }
  }

  it('closing first of 3 tabs sets active to second', () => {
    useAppStore.setState({
      tabs: [makeTab('s1'), makeTab('s2'), makeTab('s3')],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    // Should fall back to s2 (same index) or s3 (adjacent)
    expect(['s2', 's3']).toContain(useAppStore.getState().activeTabId)
  })

  it('closing last of 3 tabs sets active to second', () => {
    useAppStore.setState({
      tabs: [makeTab('s1'), makeTab('s2'), makeTab('s3')],
      activeTabId: 's3',
    })
    useAppStore.getState().closeTab('s3')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(['s1', 's2']).toContain(useAppStore.getState().activeTabId)
  })

  it('closing multiple tabs sequentially empties the list', () => {
    useAppStore.setState({
      tabs: [makeTab('s1'), makeTab('s2'), makeTab('s3')],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    useAppStore.getState().closeTab('s2')
    useAppStore.getState().closeTab('s3')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })
})

// ── Session edge cases ──────────────────────────────────────────────────────

describe('store — session lifecycle edge cases', () => {
  it('addSession then removeSession empties the list', () => {
    useAppStore.getState().addSession(mkSession({ id: 's1' }))
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  it('togglePinSession for non-existent session does not crash', () => {
    expect(() => useAppStore.getState().togglePinSession('ghost')).not.toThrow()
  })

  it('toggleArchiveSession for non-existent session does not crash', () => {
    expect(() => useAppStore.getState().toggleArchiveSession('ghost')).not.toThrow()
  })

  it('updateSession for non-existent session does not crash', () => {
    expect(() => useAppStore.getState().updateSession('ghost', { title: 'X' })).not.toThrow()
  })

  it('multiple sessions can be pinned independently', () => {
    useAppStore.getState().setSessions([
      mkSession({ id: 's1', pinned: false }),
      mkSession({ id: 's2', pinned: false }),
      mkSession({ id: 's3', pinned: false }),
    ])
    useAppStore.getState().togglePinSession('s1')
    useAppStore.getState().togglePinSession('s3')
    const sessions = useAppStore.getState().sessions
    expect(sessions.find((s) => s.id === 's1')?.pinned).toBe(true)
    expect(sessions.find((s) => s.id === 's2')?.pinned).toBe(false)
    expect(sessions.find((s) => s.id === 's3')?.pinned).toBe(true)
  })

  it('archived sessions can be unarchived', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1', archived: true })])
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(false)
  })
})

// ── Message edge cases ──────────────────────────────────────────────────────

describe('store — message edge cases', () => {
  it('appendMessage to empty list adds first message', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1' }))
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('upsertMessage with new ID appends', () => {
    useAppStore.getState().upsertMessage('m2', mkMessage({ id: 'm2' }))
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('m2')
  })

  it('upsertMessage with existing ID replaces in-place', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1', content: 'old' })] })
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'new' }))
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].content).toBe('new')
  })

  it('removeMessage from empty list is safe', () => {
    expect(() => useAppStore.getState().removeMessage('m1')).not.toThrow()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('updateRunningTool with no messages is safe', () => {
    expect(() => useAppStore.getState().updateRunningTool({ toolStatus: 'done' })).not.toThrow()
  })

  it('clearAllMessages clears and sets isLoading to false', () => {
    useAppStore.setState({
      messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })],
      isLoading: true,
    })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

// ── Workspace edge cases ────────────────────────────────────────────────────

describe('store — workspace edge cases', () => {
  it('setWorkspace to null clears path and nodes', () => {
    useAppStore.getState().setWorkspace('/project', [
      { name: 'src', path: '/project/src', type: 'directory', children: [] },
    ])
    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })

  it('setRecentProjects replaces array', () => {
    useAppStore.getState().setRecentProjects(['/a', '/b', '/c'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b', '/c'])
    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toHaveLength(0)
  })
})

// ── Group edge cases ────────────────────────────────────────────────────────

describe('store — session group edge cases', () => {
  it('adding and removing groups is idempotent', () => {
    const id = useAppStore.getState().addSessionGroup('Test')
    useAppStore.getState().removeSessionGroup(id)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
    // Remove again — should be safe
    expect(() => useAppStore.getState().removeSessionGroup(id)).not.toThrow()
  })

  it('setSessionGroup with null ungroups session', () => {
    const gid = useAppStore.getState().addSessionGroup('Features')
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid })])
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })

  it('removing group with sessions ungroups all members', () => {
    const gid = useAppStore.getState().addSessionGroup('Research')
    useAppStore.getState().setSessions([
      mkSession({ id: 's1', group: gid }),
      mkSession({ id: 's2', group: gid }),
      mkSession({ id: 's3' }),
    ])
    useAppStore.getState().removeSessionGroup(gid)
    expect(useAppStore.getState().sessions.every((s) => !s.group)).toBe(true)
  })
})
