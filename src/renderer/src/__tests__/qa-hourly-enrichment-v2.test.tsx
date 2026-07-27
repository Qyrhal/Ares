import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InputBar, BUILTIN_COMMANDS } from '../components/InputBar'
import { useAppStore } from '@/store/useAppStore'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1', title: 'Test', model: '', createdAt: Date.now(),
    updatedAt: Date.now(), messageCount: 0, pinned: false,
    archived: false, agentStatus: 'idle' as const,
    ...overrides,
  } as any
}

// ── InputBar: rapid interaction edge cases ────────────────────────────────────

describe('InputBar — rapid interaction edge cases', () => {
  it('typing / opens picker with all builtins visible', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    expect(screen.queryByText('/help')).toBeInTheDocument()
  })

  it('pasting /nonexistent shows no matching commands', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/nonexistent' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('multiple rapid Enter on /clear dispatches once then stops', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    // After first Enter, textarea is cleared and picker closes
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledTimes(1)
  })

  it('switching from / to @ closes command picker and opens mentions', () => {
    const fileNodes = [
      { name: 'test.ts', path: '/test.ts', type: 'file', children: [] },
    ]
    renderInputBar({ fileNodes, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.getByText('test.ts')).toBeInTheDocument()
  })

  it('clearing filter back to / re-shows all commands', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/xyz' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).toBeInTheDocument()
  })

  it('typing / then space closes the picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '/ ' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('Tab does nothing when picker has no filtered results', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/zzz' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea).toHaveValue('/zzz')
  })

  it('Escape closes picker without affecting textarea content', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(textarea).toHaveValue('/mod')
  })

  it('clicking outside picker (mousedown on document) closes it', async () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/c' } })
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    await waitFor(() => {
      expect(screen.queryByText('/clear')).not.toBeInTheDocument()
    })
  })

  it('ArrowDown then Enter dispatches highlighted builtin command', () => {
    const onRevealInExplorer = vi.fn()
    renderInputBar({ onRevealInExplorer, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Navigate to second item (index 1 = /folder)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onRevealInExplorer).toHaveBeenCalled()
  })
})

// ── InputBar: Tab completion edge cases ──────────────────────────────────────

describe('InputBar — Tab completion edge cases', () => {
  it('Tab completion of builtin command clears textarea', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect(textarea).toHaveValue('')
  })

  it('Tab with plugin command having argumentHint inserts name for args', () => {
    const pluginCommands = [
      { name: 'deploy', description: 'Deploy to server', argumentHint: '--env prod', prompt: 'Deploy {{args}}' },
    ]
    renderInputBar({ pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/dep' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toContain('/deploy')
  })

  it('Tab with ArrowDown then Tab dispatches correct item', () => {
    const onRevealInExplorer = vi.fn()
    renderInputBar({ onRevealInExplorer, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Navigate to /folder (index 1)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onRevealInExplorer).toHaveBeenCalled()
  })
})

// ── InputBar: Enter dispatch edge cases ──────────────────────────────────────

describe('InputBar — Enter dispatch edge cases', () => {
  it('Enter sends normal text when no picker is open', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello world', [], undefined)
  })

  it('uppercase /CLEAR dispatches as lowercase clear', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/CLEAR' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('mixed case /Model gpt-4o dispatches model with args', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/Model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('Enter on /clear via send button also dispatches', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})

// ── InputBar: text reflection ────────────────────────────────────────────────

describe('InputBar — text reflection', () => {
  it('textarea shows exactly what user types', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    expect(textarea).toHaveValue('hello world')
  })

  it('textarea cleared after executing builtin via Enter', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect(textarea).toHaveValue('')
  })

  it('textarea retains text after Escape closes picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(textarea).toHaveValue('/mod')
  })
})

// ── InputBar: picker content ─────────────────────────────────────────────────

describe('InputBar — picker content', () => {
  it('all builtin commands are listed in picker when / is typed', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    for (const cmd of BUILTIN_COMMANDS) {
      expect(screen.queryByText(`/${cmd.name}`)).toBeInTheDocument()
    }
  })

  it('plugin commands appear in picker alongside builtins', () => {
    const pluginCommands = [
      { name: 'my-plugin', description: 'My custom command', prompt: 'Plugin {{args}}' },
    ]
    renderInputBar({ pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/my-plugin')).toBeInTheDocument()
    expect(screen.queryByText('/model')).toBeInTheDocument()
  })
})

// ── Store: updateRunningTool reversed iteration ──────────────────────────────

describe('Store — updateRunningTool reversed iteration', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] })
  })

  it('updates the most recently added running tool', () => {
    const { appendMessage, updateRunningTool } = useAppStore.getState()
    appendMessage({ id: 'm1', sessionId: 's1', role: 'tool', content: '', toolName: 'tool_a', toolStatus: 'running', toolInput: '{}', createdAt: Date.now() })
    appendMessage({ id: 'm2', sessionId: 's1', role: 'tool', content: '', toolName: 'tool_b', toolStatus: 'running', toolInput: '{}', createdAt: Date.now() })
    updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    const msgs = useAppStore.getState().messages
    const toolB = msgs.find(m => m.id === 'm2')
    expect(toolB?.toolStatus).toBe('done')
    expect(toolB?.toolOutput).toBe('result')
    const toolA = msgs.find(m => m.id === 'm1')
    expect(toolA?.toolStatus).toBe('running')
  })

  it('no-ops when no running tools exist', () => {
    const { updateRunningTool } = useAppStore.getState()
    updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('updates last of multiple same-name running tools', () => {
    const { appendMessage, updateRunningTool } = useAppStore.getState()
    appendMessage({ id: 'm1', sessionId: 's1', role: 'tool', content: '', toolName: 'tool_a', toolStatus: 'running', toolInput: '{}', createdAt: Date.now() })
    appendMessage({ id: 'm2', sessionId: 's1', role: 'tool', content: '', toolName: 'tool_b', toolStatus: 'running', toolInput: '{}', createdAt: Date.now() })
    appendMessage({ id: 'm3', sessionId: 's1', role: 'tool', content: '', toolName: 'tool_a', toolStatus: 'running', toolInput: '{}', createdAt: Date.now() })
    updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    const msgs = useAppStore.getState().messages
    const lastToolA = msgs.find(m => m.id === 'm3')
    expect(lastToolA?.toolStatus).toBe('done')
    const firstToolA = msgs.find(m => m.id === 'm1')
    expect(firstToolA?.toolStatus).toBe('running')
  })
})

// ── Store: message ordering stress ───────────────────────────────────────────

describe('Store — message ordering after rapid operations', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] })
  })

  it('append many messages preserves insertion order', () => {
    const { appendMessage } = useAppStore.getState()
    for (let i = 0; i < 50; i++) {
      appendMessage({ id: `m${i}`, sessionId: 's1', role: 'user', content: `msg ${i}`, createdAt: Date.now() + i })
    }
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(50)
    for (let i = 0; i < 50; i++) {
      expect(msgs[i].id).toBe(`m${i}`)
    }
  })

  it('upsertMessage replaces existing in-place', () => {
    const { appendMessage, upsertMessage } = useAppStore.getState()
    appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'original', createdAt: Date.now() })
    appendMessage({ id: 'm2', sessionId: 's1', role: 'user', content: 'msg 2', createdAt: Date.now() })
    const updated = { ...useAppStore.getState().messages[0], content: 'updated' }
    upsertMessage('m1', updated)
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].id).toBe('m1')
    expect(msgs[0].content).toBe('updated')
    expect(msgs[1].id).toBe('m2')
  })

  it('upsertMessage appends new message when id not found', () => {
    const { appendMessage, upsertMessage } = useAppStore.getState()
    appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'original', createdAt: Date.now() })
    const newMsg = { id: 'm99', sessionId: 's1', role: 'user' as const, content: 'new', createdAt: Date.now() }
    upsertMessage('m99', newMsg)
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[1].id).toBe('m99')
  })

  it('remove first, middle, last preserves remaining order', () => {
    const { appendMessage, removeMessage } = useAppStore.getState()
    for (let i = 0; i < 10; i++) {
      appendMessage({ id: `m${i}`, sessionId: 's1', role: 'user', content: `msg ${i}`, createdAt: Date.now() })
    }
    removeMessage('m0')
    removeMessage('m5')
    removeMessage('m9')
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(7)
    expect(msgs.map(m => m.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm6', 'm7', 'm8'])
  })

  it('removeMessage on non-existent id is a no-op', () => {
    const { appendMessage, removeMessage } = useAppStore.getState()
    appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'test', createdAt: Date.now() })
    removeMessage('nonexistent')
    expect(useAppStore.getState().messages).toHaveLength(1)
  })
})

// ── Store: session group operations ──────────────────────────────────────────

describe('Store — session group round-trip', () => {
  beforeEach(() => {
    useAppStore.setState({ sessions: [], sessionGroups: [] })
  })

  it('create group → assign → rename → remove clears assignment', () => {
    const { addSessionGroup, renameSessionGroup, removeSessionGroup, setSessionGroup, addSession } = useAppStore.getState()
    const session = mkSession({ id: 's1', title: 'Test session' })
    addSession(session)
    const groupId = addSessionGroup('My Group')
    setSessionGroup(session.id, groupId)
    expect(useAppStore.getState().sessions.find(s => s.id === session.id)?.group).toBe(groupId)
    renameSessionGroup(groupId, 'Renamed Group')
    expect(useAppStore.getState().sessionGroups.find(g => g.id === groupId)?.name).toBe('Renamed Group')
    removeSessionGroup(groupId)
    expect(useAppStore.getState().sessions.find(s => s.id === session.id)?.group).toBeUndefined()
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })

  it('assigning session to new group removes from old group', () => {
    const { addSessionGroup, setSessionGroup, addSession } = useAppStore.getState()
    const session = mkSession({ id: 's2', title: 'Test' })
    addSession(session)
    const g1 = addSessionGroup('Group 1')
    const g2 = addSessionGroup('Group 2')
    setSessionGroup(session.id, g1)
    expect(useAppStore.getState().sessions.find(s => s.id === session.id)?.group).toBe(g1)
    setSessionGroup(session.id, g2)
    expect(useAppStore.getState().sessions.find(s => s.id === session.id)?.group).toBe(g2)
  })

  it('setSessionGroup with null removes session from group', () => {
    const { addSessionGroup, setSessionGroup, addSession } = useAppStore.getState()
    const session = mkSession({ id: 's3', title: 'Test' })
    addSession(session)
    const g1 = addSessionGroup('Group 1')
    setSessionGroup(session.id, g1)
    expect(useAppStore.getState().sessions.find(s => s.id === session.id)?.group).toBe(g1)
    setSessionGroup(session.id, null)
    expect(useAppStore.getState().sessions.find(s => s.id === session.id)?.group).toBeUndefined()
  })
})

// ── Store: pin and archive round-trip ────────────────────────────────────────

describe('Store — pin and archive round-trip', () => {
  beforeEach(() => {
    useAppStore.setState({ sessions: [] })
  })

  it('pin moves session to top', () => {
    const { addSession, togglePinSession } = useAppStore.getState()
    const s1 = mkSession({ id: 's1', title: 'Session 1' })
    const s2 = mkSession({ id: 's2', title: 'Session 2' })
    const s3 = mkSession({ id: 's3', title: 'Session 3' })
    addSession(s1)
    addSession(s2)
    addSession(s3)
    togglePinSession(s3.id)
    const sessions = useAppStore.getState().sessions
    expect(sessions[0].id).toBe(s3.id)
    expect(sessions[0].pinned).toBe(true)
  })

  it('unpin removes pinned flag', () => {
    const { addSession, togglePinSession } = useAppStore.getState()
    const s1 = mkSession({ id: 's1', title: 'Session 1', pinned: true })
    addSession(s1)
    togglePinSession(s1.id)
    expect(useAppStore.getState().sessions.find(s => s.id === s1.id)?.pinned).toBe(false)
  })

  it('archive → verify archived → unarchive → verify visible', () => {
    const { addSession, toggleArchiveSession } = useAppStore.getState()
    const s1 = mkSession({ id: 's1', title: 'Session 1' })
    addSession(s1)
    toggleArchiveSession(s1.id)
    expect(useAppStore.getState().sessions.find(s => s.id === s1.id)?.archived).toBe(true)
    toggleArchiveSession(s1.id)
    expect(useAppStore.getState().sessions.find(s => s.id === s1.id)?.archived).toBe(false)
  })
})

// ── Store: tab operations boundary ───────────────────────────────────────────

describe('Store — tab operations boundary conditions', () => {
  beforeEach(() => {
    useAppStore.setState({ tabs: [], activeTabId: null })
  })

  it('closeTab with zero tabs does not crash', () => {
    const { closeTab } = useAppStore.getState()
    closeTab('nonexistent')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('closeTab using session id as key', () => {
    const { openSessionTab, closeTab } = useAppStore.getState()
    openSessionTab(mkSession({ id: 's1', title: 'Test Session' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('closeTab of middle tab activates adjacent tab', () => {
    const { openSessionTab, closeTab } = useAppStore.getState()
    openSessionTab(mkSession({ id: 's1', title: 'Session 1' }))
    openSessionTab(mkSession({ id: 's2', title: 'Session 2' }))
    openSessionTab(mkSession({ id: 's3', title: 'Session 3' }))
    closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).not.toBeNull()
  })

  it('removeTabsByPath for directory removes all child tabs', () => {
    const { openFileTab, removeTabsByPath } = useAppStore.getState()
    openFileTab({ path: '/src/components/App.tsx', name: 'App.tsx', type: 'file', children: [] } as any)
    openFileTab({ path: '/src/components/Button.tsx', name: 'Button.tsx', type: 'file', children: [] } as any)
    openFileTab({ path: '/src/utils/helpers.ts', name: 'helpers.ts', type: 'file', children: [] } as any)
    removeTabsByPath('/src/components', true)
    const remaining = useAppStore.getState().tabs
    expect(remaining).toHaveLength(1)
    expect(remaining[0].path).toBe('/src/utils/helpers.ts')
  })

  it('renameTabPaths updates file tab path and children', () => {
    const { openFileTab, renameTabPaths } = useAppStore.getState()
    openFileTab({ path: '/old/dir/file.ts', name: 'file.ts', type: 'file', children: [] } as any)
    openFileTab({ path: '/old/dir/other.ts', name: 'other.ts', type: 'file', children: [] } as any)
    renameTabPaths('/old/dir', '/new/dir', 'dir')
    const tabs = useAppStore.getState().tabs
    expect(tabs[0].path).toBe('/new/dir/file.ts')
    expect(tabs[1].path).toBe('/new/dir/other.ts')
  })
})

// ── Component: empty state handling ──────────────────────────────────────────

describe('Component — empty state handling', () => {
  it('InputBar renders with no props beyond onSend', () => {
    renderInputBar()
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('InputBar with empty plugin arrays renders correctly', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('InputBar with null replyTo does not show reply chip', () => {
    renderInputBar({ replyTo: null })
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
  })
})
