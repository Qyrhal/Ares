import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'

describe('Store — closeTab edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [],
      activeTabId: null,
      sessions: [],
      messages: [],
    })
  })

  it('closing the only tab leaves no tabs', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'Session 1' }],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(0)
    expect(state.activeTabId).toBeNull()
  })

  it('closing a non-existent tab is a no-op', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'Session 1' }],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('nonexistent')
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(1)
    expect(state.activeTabId).toBe('s1')
  })

  it('closing the active tab falls back to adjacent tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Session 1' },
        { type: 'session', id: 's2', title: 'Session 2' },
        { type: 'session', id: 's3', title: 'Session 3' },
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(2)
    expect(state.activeTabId === 's1' || state.activeTabId === 's3').toBe(true)
  })

  it('closing all session tabs one by one', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'A' },
        { type: 'session', id: 's2', title: 'B' },
      ],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    useAppStore.getState().closeTab('s2')
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(0)
    expect(state.activeTabId).toBeNull()
  })
})

describe('Store — removeTabsByPath edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [],
      activeTabId: null,
    })
  })

  it('removing a file tab by exact path', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false },
        { type: 'file', path: '/src/app.ts', name: 'app.ts', isDirty: false },
      ],
      activeTabId: '/src/index.ts',
    })
    useAppStore.getState().removeTabsByPath('/src/index.ts', false)
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(1)
  })

  it('removing a directory removes all child tabs', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false },
        { type: 'file', path: '/src/app.ts', name: 'app.ts', isDirty: false },
        { type: 'file', path: '/test/spec.ts', name: 'spec.ts', isDirty: false },
      ],
      activeTabId: '/src/index.ts',
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(1)
  })

  it('removing a path that matches no tabs is a no-op', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false },
      ],
      activeTabId: '/src/index.ts',
    })
    useAppStore.getState().removeTabsByPath('/other/file.ts', false)
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(1)
  })
})

describe('Store — renameTabPaths edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [],
      activeTabId: null,
    })
  })

  it('renaming a file updates its path and name', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/old.ts', name: 'old.ts', isDirty: false },
      ],
      activeTabId: '/src/old.ts',
    })
    useAppStore.getState().renameTabPaths('/src/old.ts', '/src/new.ts', 'new.ts')
    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(1)
    const tab = state.tabs[0]
    if (tab.type === 'file') {
      expect(tab.path).toBe('/src/new.ts')
      expect(tab.name).toBe('new.ts')
    }
  })

  it('renaming a directory updates all child file paths', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/old/index.ts', name: 'index.ts', isDirty: false },
        { type: 'file', path: '/old/app.ts', name: 'app.ts', isDirty: false },
        { type: 'file', path: '/keep/spec.ts', name: 'spec.ts', isDirty: false },
      ],
      activeTabId: '/old/index.ts',
    })
    useAppStore.getState().renameTabPaths('/old', '/renamed', 'renamed')
    const state = useAppStore.getState()
    const tab0 = state.tabs[0]
    const tab1 = state.tabs[1]
    const tab2 = state.tabs[2]
    if (tab0.type === 'file') expect(tab0.path).toBe('/renamed/index.ts')
    if (tab1.type === 'file') expect(tab1.path).toBe('/renamed/app.ts')
    if (tab2.type === 'file') expect(tab2.path).toBe('/keep/spec.ts')
  })

  it('renaming a path that matches no tabs is a no-op', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false },
      ],
      activeTabId: '/src/index.ts',
    })
    useAppStore.getState().renameTabPaths('/other/old.ts', '/other/new.ts', 'new.ts')
    const state = useAppStore.getState()
    const tab = state.tabs[0]
    if (tab.type === 'file') expect(tab.path).toBe('/src/index.ts')
  })
})

describe('Store — upsertMessage edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] })
  })

  it('upserting a new message appends it', () => {
    useAppStore.getState().appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'Hello', createdAt: Date.now() })
    useAppStore.getState().upsertMessage('m2', { id: 'm2', sessionId: 's1', role: 'assistant', content: 'Hi', createdAt: Date.now() })
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(2)
    expect(state.messages[1].id).toBe('m2')
  })

  it('upserting an existing message replaces it in-place', () => {
    useAppStore.getState().appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'Hello', createdAt: Date.now() })
    useAppStore.getState().appendMessage({ id: 'm2', sessionId: 's1', role: 'assistant', content: 'Hi', createdAt: Date.now() })
    useAppStore.getState().upsertMessage('m2', { id: 'm2', sessionId: 's1', role: 'assistant', content: 'Updated', createdAt: Date.now() })
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(2)
    expect(state.messages[1].content).toBe('Updated')
  })

  it('upserting on empty array appends', () => {
    useAppStore.getState().upsertMessage('m1', { id: 'm1', sessionId: 's1', role: 'user', content: 'First', createdAt: Date.now() })
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(1)
    expect(state.messages[0].content).toBe('First')
  })
})

describe('Store — removeMessage edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] })
  })

  it('removing the first message', () => {
    useAppStore.getState().appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: Date.now() })
    useAppStore.getState().appendMessage({ id: 'm2', sessionId: 's1', role: 'assistant', content: 'B', createdAt: Date.now() })
    useAppStore.getState().removeMessage('m1')
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(1)
    expect(state.messages[0].id).toBe('m2')
  })

  it('removing the last message', () => {
    useAppStore.getState().appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: Date.now() })
    useAppStore.getState().appendMessage({ id: 'm2', sessionId: 's1', role: 'assistant', content: 'B', createdAt: Date.now() })
    useAppStore.getState().removeMessage('m2')
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(1)
    expect(state.messages[0].id).toBe('m1')
  })

  it('removing a non-existent message is idempotent', () => {
    useAppStore.getState().appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: Date.now() })
    useAppStore.getState().removeMessage('nonexistent')
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(1)
  })

  it('removing all messages one by one', () => {
    useAppStore.getState().appendMessage({ id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: Date.now() })
    useAppStore.getState().appendMessage({ id: 'm2', sessionId: 's1', role: 'assistant', content: 'B', createdAt: Date.now() })
    useAppStore.getState().removeMessage('m1')
    useAppStore.getState().removeMessage('m2')
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(0)
  })
})

describe('Store — togglePinSession edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({ sessions: [] })
  })

  it('pinning a session sets pinned to true', () => {
    useAppStore.setState({
      sessions: [
        { id: 's1', title: 'A', model: '', createdAt: 1, updatedAt: 1, messageCount: 0, pinned: false, archived: false, agentStatus: 'idle' },
        { id: 's2', title: 'B', model: '', createdAt: 2, updatedAt: 2, messageCount: 0, pinned: false, archived: false, agentStatus: 'idle' },
      ],
    })
    useAppStore.getState().togglePinSession('s2')
    const state = useAppStore.getState()
    expect(state.sessions.find(s => s.id === 's2')?.pinned).toBe(true)
    expect(state.sessions.find(s => s.id === 's1')?.pinned).toBe(false)
  })

  it('unpinning a session sets pinned to false', () => {
    useAppStore.setState({
      sessions: [
        { id: 's1', title: 'A', model: '', createdAt: 1, updatedAt: 1, messageCount: 0, pinned: false, archived: false, agentStatus: 'idle' },
        { id: 's2', title: 'B', model: '', createdAt: 2, updatedAt: 2, messageCount: 0, pinned: true, archived: false, agentStatus: 'idle' },
      ],
    })
    useAppStore.getState().togglePinSession('s2')
    const state = useAppStore.getState()
    expect(state.sessions.find(s => s.id === 's2')?.pinned).toBe(false)
  })

  it('toggling pin twice returns to original state', () => {
    useAppStore.setState({
      sessions: [
        { id: 's1', title: 'A', model: '', createdAt: 1, updatedAt: 1, messageCount: 0, pinned: false, archived: false, agentStatus: 'idle' },
      ],
    })
    useAppStore.getState().togglePinSession('s1')
    useAppStore.getState().togglePinSession('s1')
    const state = useAppStore.getState()
    expect(state.sessions[0].pinned).toBe(false)
  })

  it('toggling pin on non-existent session is a no-op', () => {
    useAppStore.setState({
      sessions: [
        { id: 's1', title: 'A', model: '', createdAt: 1, updatedAt: 1, messageCount: 0, pinned: false, archived: false, agentStatus: 'idle' },
      ],
    })
    useAppStore.getState().togglePinSession('nonexistent')
    const state = useAppStore.getState()
    expect(state.sessions.length).toBe(1)
    expect(state.sessions[0].pinned).toBe(false)
  })
})

describe('Store — updateRunningTool edge cases', () => {
  it('updating a running tool in the messages array', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: Date.now() },
        { id: 'm2', sessionId: 's1', role: 'tool', content: '', toolName: 'grep', toolStatus: 'running', toolInput: '', toolOutput: '', createdAt: Date.now() },
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    const state = useAppStore.getState()
    const toolMsg = state.messages.find(m => m.id === 'm2')
    expect(toolMsg?.toolStatus).toBe('done')
    expect(toolMsg?.toolOutput).toBe('result')
  })

  it('no running tool — updateRunningTool is a no-op', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: Date.now() },
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    const state = useAppStore.getState()
    expect(state.messages.length).toBe(1)
  })
})
