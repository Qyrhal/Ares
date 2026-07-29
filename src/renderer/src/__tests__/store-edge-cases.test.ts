import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, Message, Tab, FileNode, Todo } from '@/types'

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

function mkTab(overrides: Partial<Tab> = {}): Tab {
  return {
    type: 'session', id: 's1', title: 'Tab', ...overrides,
  }
}

function mkFileNode(overrides: Partial<FileNode> = {}): FileNode {
  return { name: 'test.ts', path: '/test.ts', type: 'file', ...overrides }
}

function mkTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 't1', sessionId: 's1', text: 'Do something',
    completed: false, createdAt: 0, ...overrides,
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
    commits: [],
    activeCommit: null,
    gitLoading: false,
    workspacePath: null,
    fileNodes: [],
    recentProjects: [],
    lastDeletedMessage: null,
    promptHistory: [],
    promptHistoryIdx: -1,
    sessionFilter: null,
    sessionSort: { by: 'recent', asc: false },
    lastExecCommand: null,
    isLoading: false,
  })
})

// ── appendMessage edge cases ────────────────────────────────────────────────

describe('store — appendMessage edge cases', () => {
  it('appends to empty array', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1' }))
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('appends at the end', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2' }))
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[1].id).toBe('m2')
  })

  it('preserves order', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1', content: 'first' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2', content: 'second' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm3', content: 'third' }))
    const msgs = useAppStore.getState().messages
    expect(msgs.map((m) => m.content)).toEqual(['first', 'second', 'third'])
  })
})

// ── removeMessage edge cases ────────────────────────────────────────────────

describe('store — removeMessage edge cases', () => {
  it('no-ops for non-existent id', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().removeMessage('nonexistent')
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('removes first message', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', content: 'first' }),
        mkMessage({ id: 'm2', content: 'second' }),
      ],
    })
    useAppStore.getState().removeMessage('m1')
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('m2')
  })

  it('removes last message', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', content: 'first' }),
        mkMessage({ id: 'm2', content: 'second' }),
      ],
    })
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('m1')
  })

  it('removes middle message', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1' }),
        mkMessage({ id: 'm2' }),
        mkMessage({ id: 'm3' }),
      ],
    })
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('empty array remains empty', () => {
    useAppStore.getState().removeMessage('nonexistent')
    expect(useAppStore.getState().messages).toHaveLength(0)
  })
})

// ── upsertMessage edge cases ────────────────────────────────────────────────

describe('store — upsertMessage edge cases', () => {
  it('appends new message at end', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().upsertMessage('m2', mkMessage({ id: 'm2' }))
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[1].id).toBe('m2')
  })

  it('replaces existing message in-place', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', content: 'old' }),
        mkMessage({ id: 'm2', content: 'keep' }),
      ],
    })
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'new' }))
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toBe('new')
    expect(msgs[1].content).toBe('keep')
  })

  it('idempotent for same update', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1', content: 'x' })] })
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'x' }))
    expect(useAppStore.getState().messages).toHaveLength(1)
  })
})

// ── closeTab edge cases ─────────────────────────────────────────────────────

describe('store — closeTab edge cases', () => {
  it('no-ops for non-existent tab', () => {
    useAppStore.setState({
      tabs: [mkTab({ id: 's1' })],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('nonexistent')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('closes last remaining tab', () => {
    useAppStore.setState({
      tabs: [mkTab({ id: 's1' })],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('closes active tab, activates adjacent', () => {
    useAppStore.setState({
      tabs: [
        mkTab({ id: 's1', title: 'Tab 1' }),
        mkTab({ id: 's2', title: 'Tab 2' }),
        mkTab({ id: 's3', title: 'Tab 3' }),
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    // Should activate s1 (left) or s3 (right) — depends on implementation
    expect(useAppStore.getState().activeTabId).not.toBe('s2')
  })

  it('closes first tab, activates next', () => {
    useAppStore.setState({
      tabs: [
        mkTab({ id: 's1' }),
        mkTab({ id: 's2' }),
      ],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('closes last tab, activates previous', () => {
    useAppStore.setState({
      tabs: [
        mkTab({ id: 's1' }),
        mkTab({ id: 's2' }),
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

// ── setTabDirty edge cases ──────────────────────────────────────────────────

describe('store — setTabDirty edge cases', () => {
  it('marks file tab as dirty', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/test.ts', name: 'test.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/test.ts', true)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(true)
  })

  it('marks file tab as clean', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/test.ts', name: 'test.ts', isDirty: true }],
    })
    useAppStore.getState().setTabDirty('/test.ts', false)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(false)
  })

  it('no-ops for non-existent path', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/other.ts', name: 'other.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/test.ts', true)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(false)
  })
})

// ── removeTabsByPath edge cases ─────────────────────────────────────────────

describe('store — removeTabsByPath edge cases', () => {
  it('removes file tab by exact path', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/test.ts', name: 'test.ts', isDirty: false } as Tab,
        { type: 'file', path: '/src/other.ts', name: 'other.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/src/test.ts',
    })
    useAppStore.getState().removeTabsByPath('/src/test.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/src/other.ts')
  })

  it('removes directory tabs recursively', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/utils/helper.ts', name: 'helper.ts', isDirty: false } as Tab,
        { type: 'file', path: '/src/utils/format.ts', name: 'format.ts', isDirty: false } as Tab,
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/src/utils/helper.ts',
    })
    useAppStore.getState().removeTabsByPath('/src/utils', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/src/index.ts')
  })

  it('does not remove tabs outside the directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/other/file.ts', name: 'file.ts', isDirty: false } as Tab,
        { type: 'file', path: '/src/test.ts', name: 'test.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/src/test.ts',
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/other/file.ts')
  })
})

// ── renameTabPaths edge cases ───────────────────────────────────────────────

describe('store — renameTabPaths edge cases', () => {
  it('renames a single file tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/old.ts', name: 'old.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/old.ts',
    })
    useAppStore.getState().renameTabPaths('/old.ts', '/new.ts', 'new.ts')
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/new.ts')
    expect((useAppStore.getState().tabs[0] as any).name).toBe('new.ts')
    expect(useAppStore.getState().activeTabId).toBe('/new.ts')
  })

  it('renames directory children tabs', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/dir/old.ts', name: 'old.ts', isDirty: false } as Tab,
        { type: 'file', path: '/dir/other.ts', name: 'other.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/dir/old.ts',
    })
    useAppStore.getState().renameTabPaths('/dir', '/newdir', 'newdir')
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/newdir/old.ts')
    expect((useAppStore.getState().tabs[1] as any).path).toBe('/newdir/other.ts')
  })

  it('does not rename tabs outside the directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/other/file.ts', name: 'file.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/other/file.ts',
    })
    useAppStore.getState().renameTabPaths('/src', '/newsrc', 'newsrc')
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/other/file.ts')
  })
})

// ── updateSession edge cases ────────────────────────────────────────────────

describe('store — updateSession edge cases', () => {
  it('no-ops for non-existent session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1' })] })
    useAppStore.getState().updateSession('nonexistent', { title: 'Updated' })
    expect(useAppStore.getState().sessions[0].title).toBe('Test')
  })

  it('updates single field', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', title: 'Old' })] })
    useAppStore.getState().updateSession('s1', { title: 'New' })
    expect(useAppStore.getState().sessions[0].title).toBe('New')
  })

  it('updates multiple fields', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', title: 'Old', model: 'gpt-4' })] })
    useAppStore.getState().updateSession('s1', { title: 'New', model: 'claude-3' })
    expect(useAppStore.getState().sessions[0].title).toBe('New')
    expect(useAppStore.getState().sessions[0].model).toBe('claude-3')
  })
})

// ── togglePinSession edge cases ─────────────────────────────────────────────

describe('store — togglePinSession edge cases', () => {
  it('pins an unpinned session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', pinned: false })] })
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions[0].pinned).toBe(true)
  })

  it('unpins a pinned session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', pinned: true })] })
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions[0].pinned).toBe(false)
  })

  it('no-ops for non-existent session', () => {
    useAppStore.setState({ sessions: [] })
    expect(() => useAppStore.getState().togglePinSession('nonexistent')).not.toThrow()
  })
})

// ── toggleArchiveSession edge cases ─────────────────────────────────────────

describe('store — toggleArchiveSession edge cases', () => {
  it('archives an unarchived session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: false })] })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
  })

  it('unarchives an archived session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: true })] })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(false)
  })
})

// ── setSessionGroup edge cases ──────────────────────────────────────────────

describe('store — setSessionGroup edge cases', () => {
  it('assigns session to group', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1' })] })
    useAppStore.getState().setSessionGroup('s1', 'g1')
    expect(useAppStore.getState().sessions[0].group).toBe('g1')
  })

  it('removes session from group', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', group: 'g1' })] })
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })

  it('moves session between groups', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', group: 'g1' })] })
    useAppStore.getState().setSessionGroup('s1', 'g2')
    expect(useAppStore.getState().sessions[0].group).toBe('g2')
  })
})

// ── selectTab edge cases ────────────────────────────────────────────────────

describe('store — selectTab edge cases', () => {
  it('sets activeTabId', () => {
    useAppStore.setState({
      tabs: [mkTab({ id: 's1' }), mkTab({ id: 's2' })],
      activeTabId: 's1',
    })
    useAppStore.getState().selectTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('switches to chat view for session tabs', () => {
    useAppStore.setState({
      tabs: [mkTab({ id: 's1', type: 'session' })],
      activeView: 'settings',
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })
})

// ── clearAllMessages edge cases ─────────────────────────────────────────────

describe('store — clearAllMessages edge cases', () => {
  it('clears all messages', () => {
    useAppStore.setState({
      messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })],
    })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('no-ops on empty array', () => {
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })
})

// ── setLastDeletedMessage edge cases ────────────────────────────────────────

describe('store — lastDeletedMessage edge cases', () => {
  it('sets last deleted message', () => {
    const msg = mkMessage({ id: 'm1' })
    useAppStore.getState().setLastDeletedMessage(msg)
    expect(useAppStore.getState().lastDeletedMessage).toEqual(msg)
  })

  it('clears last deleted message', () => {
    useAppStore.getState().setLastDeletedMessage(mkMessage())
    useAppStore.getState().clearLastDeletedMessage()
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })

  it('setLastDeletedMessage to null', () => {
    useAppStore.getState().setLastDeletedMessage(mkMessage())
    useAppStore.getState().setLastDeletedMessage(null)
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })
})

// ── setWorkspace edge cases ─────────────────────────────────────────────────

describe('store — setWorkspace edge cases', () => {
  it('sets workspace path and nodes', () => {
    const nodes = [mkFileNode()]
    useAppStore.getState().setWorkspace('/project', nodes)
    expect(useAppStore.getState().workspacePath).toBe('/project')
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })

  it('clears workspace', () => {
    useAppStore.getState().setWorkspace('/project', [mkFileNode()])
    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })
})

// ── setLoading edge cases ───────────────────────────────────────────────────

describe('store — setLoading edge cases', () => {
  it('sets loading to true', () => {
    useAppStore.getState().setLoading(true)
    expect(useAppStore.getState().isLoading).toBe(true)
  })

  it('sets loading to false', () => {
    useAppStore.setState({ isLoading: true })
    useAppStore.getState().setLoading(false)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

// ── setCommits edge cases ───────────────────────────────────────────────────

describe('store — setCommits edge cases', () => {
  it('sets commits', () => {
    useAppStore.getState().setCommits([
      { hash: 'abc123', shortHash: 'abc', parents: [], author: 'Test', date: '', message: 'init' },
    ])
    expect(useAppStore.getState().commits).toHaveLength(1)
  })

  it('clears commits', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'Test', date: '', message: 'init' }],
    })
    useAppStore.getState().setCommits([])
    expect(useAppStore.getState().commits).toHaveLength(0)
  })
})

// ── setActiveCommit edge cases ──────────────────────────────────────────────

describe('store — setActiveCommit edge cases', () => {
  it('sets active commit', () => {
    useAppStore.getState().setActiveCommit('abc123')
    expect(useAppStore.getState().activeCommit).toBe('abc123')
  })

  it('clears active commit', () => {
    useAppStore.setState({ activeCommit: 'abc123' })
    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })
})

// ── setRecentProjects edge cases ────────────────────────────────────────────

describe('store — setRecentProjects edge cases', () => {
  it('sets recent projects', () => {
    useAppStore.getState().setRecentProjects(['/a', '/b'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b'])
  })

  it('clears recent projects', () => {
    useAppStore.setState({ recentProjects: ['/a'] })
    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toHaveLength(0)
  })
})

// ── setSettings edge cases ──────────────────────────────────────────────────

describe('store — setSettings edge cases', () => {
  it('updates settings', () => {
    useAppStore.getState().setSettings({
      apiKey: 'new-key',
      apiBaseUrl: 'https://api.example.com/v1',
      defaultModel: 'gpt-4',
      themeId: 'blue',
      systemPrompt: 'You are helpful.',
      permissionMode: 'auto',
    })
    expect(useAppStore.getState().settings.apiKey).toBe('new-key')
    expect(useAppStore.getState().settings.defaultModel).toBe('gpt-4')
  })

  it('preserves unmodified settings fields', () => {
    const initial = useAppStore.getState().settings
    useAppStore.getState().setSettings({ ...initial, apiKey: 'changed' })
    expect(useAppStore.getState().settings.apiKey).toBe('changed')
    expect(useAppStore.getState().settings.themeId).toBe(initial.themeId)
  })
})

describe('store — updateRunningTool edge cases', () => {
  it('no-ops when no tool messages exist', () => {
    useAppStore.setState({ messages: [] })
    expect(() => useAppStore.getState().updateRunningTool({ toolStatus: 'done' })).not.toThrow()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('no-ops when all tools are already done', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'tool', content: '', toolName: 'read', toolStatus: 'done', createdAt: 0 },
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'running' })
    expect(useAppStore.getState().messages[0].toolStatus).toBe('done')
  })

  it('updates the last running tool when multiple running tools exist', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'tool', content: '', toolName: 'read', toolStatus: 'running', createdAt: 0 },
        { id: 'm2', sessionId: 's1', role: 'tool', content: '', toolName: 'write', toolStatus: 'running', createdAt: 1 },
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    expect(useAppStore.getState().messages[0].toolStatus).toBe('running')
    expect(useAppStore.getState().messages[1].toolStatus).toBe('done')
    expect(useAppStore.getState().messages[1].toolOutput).toBe('result')
  })
})

describe('store — addSessionGroup edge cases', () => {
  it('creates a group with a generated id', () => {
    const id = useAppStore.getState().addSessionGroup('My Group')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
    expect(useAppStore.getState().sessionGroups[0].name).toBe('My Group')
  })

  it('creates multiple groups', () => {
    useAppStore.getState().addSessionGroup('Group A')
    useAppStore.getState().addSessionGroup('Group B')
    expect(useAppStore.getState().sessionGroups).toHaveLength(2)
  })

  it('each group gets a unique id', () => {
    const id1 = useAppStore.getState().addSessionGroup('A')
    const id2 = useAppStore.getState().addSessionGroup('B')
    expect(id1).not.toBe(id2)
  })
})

describe('store — renameSessionGroup edge cases', () => {
  it('renames a group by id', () => {
    const id = useAppStore.getState().addSessionGroup('Old Name')
    useAppStore.getState().renameSessionGroup(id, 'New Name')
    expect(useAppStore.getState().sessionGroups.find((g) => g.id === id)?.name).toBe('New Name')
  })

  it('no-ops for non-existent group id', () => {
    useAppStore.getState().addSessionGroup('Real')
    useAppStore.getState().renameSessionGroup('fake-id', 'Fake')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
    expect(useAppStore.getState().sessionGroups[0].name).toBe('Real')
  })
})

describe('store — removeSessionGroup edge cases', () => {
  it('removes a group by id', () => {
    const id = useAppStore.getState().addSessionGroup('To Remove')
    useAppStore.getState().removeSessionGroup(id)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })

  it('no-ops for non-existent group id', () => {
    useAppStore.getState().addSessionGroup('Keep')
    useAppStore.getState().removeSessionGroup('nonexistent')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
  })

  it('clears group assignment from sessions in that group', () => {
    const gid = useAppStore.getState().addSessionGroup('Test Group')
    useAppStore.setState({
      sessions: [
        { id: 's1', title: 'S1', model: 'gpt-4o', createdAt: 0, updatedAt: 0, messageCount: 0, pinned: false, archived: false, group: gid },
        { id: 's2', title: 'S2', model: 'gpt-4o', createdAt: 0, updatedAt: 0, messageCount: 0, pinned: false, archived: false, group: 'other' },
      ],
    })
    useAppStore.getState().removeSessionGroup(gid)
    const s1 = useAppStore.getState().sessions.find((s) => s.id === 's1')
    expect(s1?.group).toBeUndefined()
    const s2 = useAppStore.getState().sessions.find((s) => s.id === 's2')
    expect(s2?.group).toBe('other')
  })
})

describe('store — openFileTab edge cases', () => {
  it('adds a file tab and sets activeTabId', () => {
    const node = { name: 'test.ts', path: '/test.ts', isDirectory: false }
    useAppStore.getState().openFileTab(node as any)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual({ type: 'file', path: '/test.ts', name: 'test.ts', isDirty: false })
    expect(useAppStore.getState().activeTabId).toBe('/test.ts')
  })

  it('does not duplicate a file tab that already exists', () => {
    const node = { name: 'test.ts', path: '/test.ts', isDirectory: false }
    useAppStore.getState().openFileTab(node as any)
    useAppStore.getState().openFileTab(node as any)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('switches activeView to chat for session tabs but not file tabs', () => {
    useAppStore.setState({ activeView: 'git' })
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', isDirectory: false } as any)
    expect(useAppStore.getState().activeView).toBe('git')
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('can open multiple different file tabs', () => {
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', isDirectory: false } as any)
    useAppStore.getState().openFileTab({ name: 'b.ts', path: '/b.ts', isDirectory: false } as any)
    expect(useAppStore.getState().tabs).toHaveLength(2)
  })
})

describe('store — side chat operations', () => {
  it('setSideChat sets the side chat session id', () => {
    useAppStore.getState().setSideChat('sc1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc1')
  })

  it('setSideChat clears when passed null', () => {
    useAppStore.setState({ sideChatSessionId: 'sc1' })
    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })

  it('setSideChatMessages replaces messages', () => {
    const msgs = [
      { id: 'm1', sessionId: 'sc1', role: 'user', content: 'Hi', createdAt: 0 },
    ] as any[]
    useAppStore.getState().setSideChatMessages(msgs)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('Hi')
  })

  it('appendSideChatMessage adds to the end', () => {
    useAppStore.getState().appendSideChatMessage({ id: 'm1', content: 'A' } as any)
    useAppStore.getState().appendSideChatMessage({ id: 'm2', content: 'B' } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(2)
    expect(useAppStore.getState().sideChatMessages[1].content).toBe('B')
  })

  it('upsertSideChatMessage appends new message', () => {
    useAppStore.getState().upsertSideChatMessage('m1', { id: 'm1', content: 'New' } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('upsertSideChatMessage updates existing message', () => {
    useAppStore.setState({ sideChatMessages: [{ id: 'm1', content: 'Old' } as any] })
    useAppStore.getState().upsertSideChatMessage('m1', { id: 'm1', content: 'Updated' } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('Updated')
  })

  it('removeSideChatMessage removes by id', () => {
    useAppStore.setState({
      sideChatMessages: [
        { id: 'm1', content: 'A' } as any,
        { id: 'm2', content: 'B' } as any,
      ],
    })
    useAppStore.getState().removeSideChatMessage('m1')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
    expect(useAppStore.getState().sideChatMessages[0].id).toBe('m2')
  })

  it('removeSideChatMessage no-ops for non-existent id', () => {
    useAppStore.setState({ sideChatMessages: [{ id: 'm1', content: 'A' } as any] })
    useAppStore.getState().removeSideChatMessage('fake')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('setSideChatLoading toggles loading state', () => {
    useAppStore.getState().setSideChatLoading(true)
    expect(useAppStore.getState().sideChatIsLoading).toBe(true)
    useAppStore.getState().setSideChatLoading(false)
    expect(useAppStore.getState().sideChatIsLoading).toBe(false)
  })
})

describe('store — toggleTerminal / toggleZenMode edge cases', () => {
  it('toggleTerminal toggles from false to true', () => {
    useAppStore.setState({ terminalOpen: false })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('toggleTerminal toggles from true to false', () => {
    useAppStore.setState({ terminalOpen: true })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })

  it('toggleZenMode toggles', () => {
    useAppStore.setState({ zenMode: false })
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

describe('store — setTerminalHeight edge cases', () => {
  it('sets terminal height', () => {
    useAppStore.getState().setTerminalHeight('300px')
    expect(useAppStore.getState().terminalHeight).toBe('300px')
  })

  it('can set to different values', () => {
    useAppStore.getState().setTerminalHeight('100px')
    useAppStore.getState().setTerminalHeight('500px')
    expect(useAppStore.getState().terminalHeight).toBe('500px')
  })
})

describe('store — selectTab edge cases', () => {
  it('sets activeTabId', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Tab 1' },
        { type: 'session', id: 's2', title: 'Tab 2' },
      ],
    })
    useAppStore.getState().selectTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('selecting a session tab switches activeView to chat', () => {
    useAppStore.setState({
      activeView: 'git',
      tabs: [
        { type: 'session', id: 's1', title: 'Tab 1' },
        { type: 'file', path: '/f.ts', name: 'f.ts', isDirty: false },
      ],
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('selecting a file tab does not change activeView', () => {
    useAppStore.setState({
      activeView: 'git',
      tabs: [{ type: 'file', path: '/f.ts', name: 'f.ts', isDirty: false }],
    })
    useAppStore.getState().selectTab('/f.ts')
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('selecting a non-existent tab id still sets it', () => {
    useAppStore.getState().selectTab('nonexistent')
    expect(useAppStore.getState().activeTabId).toBe('nonexistent')
  })
})

describe('store — addSession edge cases', () => {
  it('adds a session to the list', () => {
    useAppStore.setState({ sessions: [] })
    useAppStore.getState().addSession(mkSession({ id: 's1' }))
    expect(useAppStore.getState().sessions).toHaveLength(1)
  })

  it('preserves existing sessions', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1' })] })
    useAppStore.getState().addSession(mkSession({ id: 's2' }))
    expect(useAppStore.getState().sessions).toHaveLength(2)
  })
})

describe('store — clearAllMessages edge cases', () => {
  it('clears all messages', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: 0 },
        { id: 'm2', sessionId: 's1', role: 'assistant', content: 'B', createdAt: 1 },
      ],
    })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('no-ops on empty array', () => {
    useAppStore.setState({ messages: [] })
    expect(() => useAppStore.getState().clearAllMessages()).not.toThrow()
  })
})

describe('store — setTodos edge cases', () => {
  it('replaces todos array', () => {
    const todos = [{ id: 't1', text: 'Task', completed: false, sessionId: 's1', createdAt: 0 }] as any[]
    useAppStore.getState().setTodos(todos)
    expect(useAppStore.getState().todos).toHaveLength(1)
  })

  it('clears todos when set to empty', () => {
    useAppStore.setState({ todos: [{ id: 't1', text: 'X', completed: false, sessionId: 's1', createdAt: 0 }] as any[] })
    useAppStore.getState().setTodos([])
    expect(useAppStore.getState().todos).toHaveLength(0)
  })
})

describe('store — addTodo / updateTodo / removeTodo edge cases', () => {
  it('addTodo appends to list', () => {
    useAppStore.getState().addTodo({ id: 't1', text: 'First', completed: false, sessionId: 's1', createdAt: 0 } as any)
    useAppStore.getState().addTodo({ id: 't2', text: 'Second', completed: false, sessionId: 's1', createdAt: 1 } as any)
    expect(useAppStore.getState().todos).toHaveLength(2)
    expect(useAppStore.getState().todos[1].text).toBe('Second')
  })

  it('updateTodo toggles completed', () => {
    useAppStore.setState({ todos: [{ id: 't1', text: 'Task', completed: false, sessionId: 's1', createdAt: 0 }] as any[] })
    useAppStore.getState().updateTodo('t1', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(true)
  })

  it('updateTodo no-ops for unknown id', () => {
    useAppStore.setState({ todos: [{ id: 't1', text: 'Task', completed: false, sessionId: 's1', createdAt: 0 }] as any[] })
    useAppStore.getState().updateTodo('fake', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(false)
  })

  it('removeTodo removes by id', () => {
    useAppStore.setState({
      todos: [
        { id: 't1', text: 'A', completed: false, sessionId: 's1', createdAt: 0 },
        { id: 't2', text: 'B', completed: false, sessionId: 's1', createdAt: 1 },
      ] as any[],
    })
    useAppStore.getState().removeTodo('t1')
    expect(useAppStore.getState().todos).toHaveLength(1)
    expect(useAppStore.getState().todos[0].id).toBe('t2')
  })

  it('removeTodo no-ops for unknown id', () => {
    useAppStore.setState({ todos: [{ id: 't1', text: 'A', completed: false, sessionId: 's1', createdAt: 0 }] as any[] })
    useAppStore.getState().removeTodo('fake')
    expect(useAppStore.getState().todos).toHaveLength(1)
  })
})

describe('store — setRecentProjects edge cases', () => {
  it('sets recent projects', () => {
    useAppStore.getState().setRecentProjects(['/a', '/b', '/c'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b', '/c'])
  })

  it('clears when set to empty', () => {
    useAppStore.setState({ recentProjects: ['/a'] })
    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toEqual([])
  })
})

describe('store — setFileNodes edge cases', () => {
  it('sets file nodes', () => {
    const nodes = [{ name: 'src', path: '/src', isDirectory: true, children: [] }] as any[]
    useAppStore.getState().setFileNodes(nodes)
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })

  it('clears when set to empty', () => {
    useAppStore.setState({ fileNodes: [{ name: 'x', path: '/x', isDirectory: false }] as any[] })
    useAppStore.getState().setFileNodes([])
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })
})

describe('store — setGitLoading / setActiveCommit edge cases', () => {
  it('setGitLoading toggles', () => {
    useAppStore.getState().setGitLoading(true)
    expect(useAppStore.getState().gitLoading).toBe(true)
    useAppStore.getState().setGitLoading(false)
    expect(useAppStore.getState().gitLoading).toBe(false)
  })

  it('setActiveCommit sets hash', () => {
    useAppStore.getState().setActiveCommit('abc123')
    expect(useAppStore.getState().activeCommit).toBe('abc123')
  })

  it('setActiveCommit clears when passed null', () => {
    useAppStore.setState({ activeCommit: 'abc' })
    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })
})

// ── removeSession does NOT remove tabs ────────────────────────────────────

describe('store — removeSession does NOT remove tabs', () => {
  it('removing a session leaves its tab intact', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' })],
      tabs: [{ type: 'session', id: 's1', title: 'Tab 1' }],
    })
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual({ type: 'session', id: 's1', title: 'Tab 1' })
  })

  it('removing a session leaves non-matching tabs intact', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' }), mkSession({ id: 's2' })],
      tabs: [
        { type: 'session', id: 's1', title: 'Tab 1' },
        { type: 'session', id: 's2', title: 'Tab 2' },
      ],
    })
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    const sessionIds = useAppStore.getState().tabs
      .filter((t): t is Extract<typeof t, { type: 'session' }> => t.type === 'session')
      .map((t) => t.id)
    expect(sessionIds).toEqual(['s1', 's2'])
  })

  it('removing last session leaves tabs intact', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' })],
      tabs: [{ type: 'session', id: 's1', title: 'Tab 1' }],
      activeTabId: 's1',
    })
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(0)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual(expect.objectContaining({ id: 's1' }))
  })
})

// ── closeTab adjacent activation edge cases ────────────────────────────────

describe('store — closeTab adjacent activation edge cases', () => {
  it('closing middle of 3 tabs activates the next one', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Tab 1' },
        { type: 'session', id: 's2', title: 'Tab 2' },
        { type: 'session', id: 's3', title: 'Tab 3' },
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).toBe('s3')
  })

  it('closing first tab activates the second', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Tab 1' },
        { type: 'session', id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('closing last tab activates the previous', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Tab 1' },
        { type: 'session', id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('closing only tab leaves activeTabId null', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'Tab 1' }],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('closing inactive tab preserves activeTabId', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Tab 1' },
        { type: 'session', id: 's2', title: 'Tab 2' },
        { type: 'session', id: 's3', title: 'Tab 3' },
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })
})

// ── openSessionTab edge cases ──────────────────────────────────────────────

describe('store — openSessionTab edge cases', () => {
  it('switches activeView to chat even from git view', () => {
    useAppStore.setState({ activeView: 'git' })
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('does not switch activeView for file tabs', () => {
    useAppStore.setState({ activeView: 'git' })
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', isDirectory: false } as any)
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('can open multiple different session tabs', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'Session 1' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's2', title: 'Session 2' }))
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().tabs[0]).toEqual(expect.objectContaining({ id: 's1' }))
    expect(useAppStore.getState().tabs[1]).toEqual(expect.objectContaining({ id: 's2' }))
  })

  it('reuses existing tab when opening same session', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'Session 1' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'Session 1 Updated' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual(expect.objectContaining({ id: 's1' }))
  })
})

// ── additional edge cases ────────────────────────────────────────────────

describe('store — upsertMessage idempotency', () => {
  it('upserting same message twice does not duplicate', () => {
    const msg = mkMessage({ id: 'm1', content: 'first' })
    useAppStore.getState().appendMessage(msg)
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'updated' }))
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'updated again' }))
    const msgs = useAppStore.getState().messages.filter((m) => m.id === 'm1')
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('updated again')
  })

  it('upsertMessage on non-existent id appends', () => {
    useAppStore.getState().upsertMessage('brand-new', { id: 'brand-new', content: 'new', role: 'user', sessionId: 's1', createdAt: 0 } as any)
    expect(useAppStore.getState().messages.find((m) => m.id === 'brand-new')).toBeDefined()
  })
})

describe('store — removeMessage edge cases', () => {
  it('removeMessage on empty list is no-op', () => {
    useAppStore.setState({ messages: [] })
    useAppStore.getState().removeMessage('m1')
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('removeMessage preserves order of remaining messages', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', content: 'a' }),
        mkMessage({ id: 'm2', content: 'b' }),
        mkMessage({ id: 'm3', content: 'c' }),
      ],
    })
    useAppStore.getState().removeMessage('m2')
    const ids = useAppStore.getState().messages.map((m) => m.id)
    expect(ids).toEqual(['m1', 'm3'])
  })
})

describe('store — closeTab edge cases', () => {
  it('closeTab on non-existent id is no-op', () => {
    useAppStore.setState({ tabs: [{ type: 'session', id: 't1' } as any] })
    useAppStore.getState().closeTab('nonexistent')
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('closeTab with no tabs is no-op', () => {
    useAppStore.setState({ tabs: [] })
    useAppStore.getState().closeTab('anything')
    expect(useAppStore.getState().tabs).toHaveLength(0)
  })

  it('closing last tab clears activeTabId', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 't1' } as any],
      activeTabId: 't1',
    })
    useAppStore.getState().closeTab('t1')
    expect(useAppStore.getState().activeTabId).toBeNull()
  })
})

describe('store — updateSession edge cases', () => {
  it('updateSession on non-existent id does not crash', () => {
    expect(() => useAppStore.getState().updateSession('nonexistent', { title: 'new' })).not.toThrow()
  })

  it('updateSession with partial fields', () => {
    const s = mkSession({ id: 's1', title: 'Old', model: 'gpt-4' })
    useAppStore.getState().addSession(s)
    useAppStore.getState().updateSession('s1', { title: 'New' })
    const updated = useAppStore.getState().sessions.find((s) => s.id === 's1')
    expect(updated?.title).toBe('New')
    expect(updated?.model).toBe('gpt-4') // model unchanged
  })
})

describe('store — appendMessage batching', () => {
  it('appending 100 messages maintains order', () => {
    useAppStore.setState({ messages: [] })
    for (let i = 0; i < 100; i++) {
      useAppStore.getState().appendMessage(mkMessage({ id: `m${i}`, content: `msg${i}` }))
    }
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(100)
    expect(msgs[0].content).toBe('msg0')
    expect(msgs[99].content).toBe('msg99')
  })
})

describe('store — selectTab does not crash on missing tab', () => {
  it('selectTab with non-existent id does not crash', () => {
    expect(() => useAppStore.getState().selectTab('nonexistent')).not.toThrow()
  })
})

describe('store — setWorkspace edge cases', () => {
  it('setWorkspace with null clears path and nodes', () => {
    useAppStore.setState({ workspacePath: '/some/path', fileNodes: [{ name: 'f.ts', path: '/f.ts', type: 'file', children: [] }] })
    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })

  it('setWorkspace with path sets path and nodes', () => {
    useAppStore.getState().setWorkspace('/project', [{ name: 'src', path: '/src', type: 'directory', children: [] }])
    expect(useAppStore.getState().workspacePath).toBe('/project')
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })
})

describe('store — toggleZenMode', () => {
  it('toggles zen mode on and off', () => {
    useAppStore.setState({ zenMode: false })
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

describe('store — updateRunningTool idempotency', () => {
  it('calling updateRunningTool with no running tool and status=done is no-op', () => {
    useAppStore.setState({ messages: [] })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    // No crash, no messages added
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('calling updateRunningTool updates the last running tool message', () => {
    // First create a running tool message
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', role: 'tool', toolName: 'bash', toolStatus: 'running', toolInput: 'ls' } as any),
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    const toolMsg = useAppStore.getState().messages.find((m) => m.id === 'm1')
    expect(toolMsg?.toolStatus).toBe('done')
    expect(toolMsg?.toolOutput).toBe('result')
  })
})

describe('store — multiple session operations', () => {
  it('add + select + remove session lifecycle', () => {
    const s = mkSession({ id: 's1', title: 'Test' })
    useAppStore.getState().addSession(s)
    expect(useAppStore.getState().sessions).toHaveLength(1)
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeTabId).toBe('s1')
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(0)
    // Note: removeSession only removes from sessions array, activeTabId is managed separately
  })

  it('removeSession on non-existent id is no-op', () => {
    useAppStore.setState({ sessions: [] })
    useAppStore.getState().removeSession('nonexistent')
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  Prompt history tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — addPromptToHistory', () => {
  it('adds a prompt to history', () => {
    useAppStore.getState().addPromptToHistory('hello world')
    expect(useAppStore.getState().promptHistory).toEqual(['hello world'])
  })

  it('prepends new prompt to the front', () => {
    useAppStore.getState().addPromptToHistory('first')
    useAppStore.getState().addPromptToHistory('second')
    expect(useAppStore.getState().promptHistory).toEqual(['second', 'first'])
  })

  it('deduplicates consecutive identical prompts', () => {
    useAppStore.getState().addPromptToHistory('same')
    useAppStore.getState().addPromptToHistory('same')
    // The second 'same' is a duplicate of the last entry, so it's rejected
    expect(useAppStore.getState().promptHistory).toEqual(['same'])
  })

  it('allows non-consecutive duplicates', () => {
    useAppStore.getState().addPromptToHistory('abc')
    useAppStore.getState().addPromptToHistory('def')
    useAppStore.getState().addPromptToHistory('abc')
    expect(useAppStore.getState().promptHistory).toEqual(['abc', 'def', 'abc'])
  })

  it('rejects empty prompts', () => {
    useAppStore.getState().addPromptToHistory('')
    expect(useAppStore.getState().promptHistory).toEqual([])
  })

  it('rejects whitespace-only prompts', () => {
    useAppStore.getState().addPromptToHistory('   ')
    expect(useAppStore.getState().promptHistory).toEqual([])
  })

  it('caps history at 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      useAppStore.getState().addPromptToHistory(`prompt-${i}`)
    }
    expect(useAppStore.getState().promptHistory).toHaveLength(100)
    // Most recent should be first
    expect(useAppStore.getState().promptHistory[0]).toBe('prompt-109')
    // Oldest should be prompt-10 (110 - 100 = 10)
    expect(useAppStore.getState().promptHistory[99]).toBe('prompt-10')
  })

  it('resets promptHistoryIdx to -1 on add', () => {
    useAppStore.setState({ promptHistoryIdx: 5 })
    useAppStore.getState().addPromptToHistory('new')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('rejects duplicate of last entry even when historyIdx is not -1', () => {
    useAppStore.getState().addPromptToHistory('abc')
    useAppStore.setState({ promptHistoryIdx: 0 })
    useAppStore.getState().addPromptToHistory('abc')
    // Same as last entry, rejected; idx reset
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
    expect(useAppStore.getState().promptHistory).toEqual(['abc'])
  })
})

describe('store — navigatePromptHistory', () => {
  it('returns null on empty history', () => {
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBeNull()
  })

  it('navigates up through history entries', () => {
    useAppStore.getState().addPromptToHistory('first')
    useAppStore.getState().addPromptToHistory('second')
    useAppStore.getState().addPromptToHistory('third')

    // idx was -1 after addPromptToHistory, up goes to 0
    const r1 = useAppStore.getState().navigatePromptHistory('up')
    expect(r1).toBe('third')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)

    // up goes to 1
    const r2 = useAppStore.getState().navigatePromptHistory('up')
    expect(r2).toBe('second')
    expect(useAppStore.getState().promptHistoryIdx).toBe(1)

    // up goes to 2
    const r3 = useAppStore.getState().navigatePromptHistory('up')
    expect(r3).toBe('first')
    expect(useAppStore.getState().promptHistoryIdx).toBe(2)
  })

  it('caps navigation at the end of history (no overflow)', () => {
    useAppStore.getState().addPromptToHistory('only-one')

    useAppStore.getState().navigatePromptHistory('up')
    useAppStore.getState().navigatePromptHistory('up') // should cap
    useAppStore.getState().navigatePromptHistory('up') // should still cap

    expect(useAppStore.getState().promptHistoryIdx).toBe(0) // only 1 entry
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('only-one')
  })

  it('navigates down back toward empty string', () => {
    useAppStore.getState().addPromptToHistory('first')
    useAppStore.getState().addPromptToHistory('second')
    // promptHistory = ['second', 'first'] (most recent at idx 0)

    // Navigate up twice to reach idx=1
    useAppStore.getState().navigatePromptHistory('up') // idx 0 → 'second'
    useAppStore.getState().navigatePromptHistory('up') // idx 1 → 'first'

    // Navigate down
    const r1 = useAppStore.getState().navigatePromptHistory('down')
    expect(r1).toBe('second') // idx 0
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)

    const r2 = useAppStore.getState().navigatePromptHistory('down')
    expect(r2).toBe('') // idx -1 = empty
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('down from -1 stays at -1 and returns empty string', () => {
    useAppStore.getState().addPromptToHistory('something')
    // promptHistoryIdx is already -1
    const r = useAppStore.getState().navigatePromptHistory('down')
    expect(r).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('returns correct text for each position', () => {
    useAppStore.getState().addPromptToHistory('alpha')
    useAppStore.getState().addPromptToHistory('beta')
    useAppStore.getState().addPromptToHistory('gamma')
    // promptHistory = ['gamma', 'beta', 'alpha'] (most recent at idx 0)

    // Up: idx 0→'gamma', idx 1→'beta', idx 2→'alpha'
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('gamma')
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('beta')
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('alpha')

    // Down: idx 1→'beta', idx 0→'gamma', idx -1→''
    expect(useAppStore.getState().navigatePromptHistory('down')).toBe('beta')
    expect(useAppStore.getState().navigatePromptHistory('down')).toBe('gamma')
    expect(useAppStore.getState().navigatePromptHistory('down')).toBe('')
  })
})

describe('store — resetPromptHistoryIdx', () => {
  it('resets idx to -1', () => {
    useAppStore.getState().addPromptToHistory('test')
    useAppStore.getState().navigatePromptHistory('up')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
    useAppStore.getState().resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('is a no-op when already -1', () => {
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
    useAppStore.getState().resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  Session filter and sort
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — setSessionFilter', () => {
  it('sets a model filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt-4o' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'model', value: 'gpt-4o' })
  })

  it('sets a status filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'status', value: 'running' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'status', value: 'running' })
  })

  it('sets a keyword filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'keyword', value: 'search term' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'keyword', value: 'search term' })
  })

  it('sets a tag filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'tag', value: 'important' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'tag', value: 'important' })
  })

  it('clears filter when set to null', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt-4o' })
    useAppStore.getState().setSessionFilter(null)
    expect(useAppStore.getState().sessionFilter).toBeNull()
  })

  it('replaces previous filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt-4o' })
    useAppStore.getState().setSessionFilter({ type: 'keyword', value: 'test' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'keyword', value: 'test' })
  })
})

describe('store — setSessionSort', () => {
  it('sets sort by recent ascending', () => {
    useAppStore.getState().setSessionSort({ by: 'recent', asc: true })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'recent', asc: true })
  })

  it('sets sort by name descending', () => {
    useAppStore.getState().setSessionSort({ by: 'name', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'name', asc: false })
  })

  it('sets sort by duration', () => {
    useAppStore.getState().setSessionSort({ by: 'duration', asc: true })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'duration', asc: true })
  })

  it('sets sort by messages count', () => {
    useAppStore.getState().setSessionSort({ by: 'messages', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'messages', asc: false })
  })

  it('replaces previous sort', () => {
    useAppStore.getState().setSessionSort({ by: 'recent', asc: true })
    useAppStore.getState().setSessionSort({ by: 'name', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'name', asc: false })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  Exec history
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — setLastExecCommand', () => {
  it('sets the last exec command', () => {
    useAppStore.getState().setLastExecCommand('npm test')
    expect(useAppStore.getState().lastExecCommand).toBe('npm test')
  })

  it('replaces previous command', () => {
    useAppStore.getState().setLastExecCommand('ls -la')
    useAppStore.getState().setLastExecCommand('git status')
    expect(useAppStore.getState().lastExecCommand).toBe('git status')
  })

  it('handles empty string', () => {
    useAppStore.getState().setLastExecCommand('something')
    useAppStore.getState().setLastExecCommand('')
    expect(useAppStore.getState().lastExecCommand).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  upsertMessage streaming patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — upsertMessage streaming', () => {
  it('simulates streaming response by progressive content updates', () => {
    // Initial assistant message placeholder
    useAppStore.getState().upsertMessage('m1', mkMessage({
      id: 'm1', sessionId: 's1', role: 'assistant', content: '', createdAt: 0,
    }))
    expect(useAppStore.getState().messages[0].content).toBe('')

    // Stream chunk 1
    useAppStore.getState().upsertMessage('m1', mkMessage({
      id: 'm1', sessionId: 's1', role: 'assistant', content: 'Hello', createdAt: 0,
    }))
    expect(useAppStore.getState().messages[0].content).toBe('Hello')

    // Stream chunk 2
    useAppStore.getState().upsertMessage('m1', mkMessage({
      id: 'm1', sessionId: 's1', role: 'assistant', content: 'Hello, world!', createdAt: 0,
    }))
    expect(useAppStore.getState().messages[0].content).toBe('Hello, world!')

    // Stream chunk 3
    useAppStore.getState().upsertMessage('m1', mkMessage({
      id: 'm1', sessionId: 's1', role: 'assistant', content: 'Hello, world! How can I help?', createdAt: 0,
    }))

    // Only one message, content grew each time
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].content).toBe('Hello, world! How can I help?')
  })

  it('streaming does not disturb adjacent messages', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm0', sessionId: 's1', role: 'user', content: 'Question' }),
        mkMessage({ id: 'm1', sessionId: 's1', role: 'assistant', content: '' }),
      ],
    })

    // Update assistant message multiple times (streaming)
    for (let i = 1; i <= 5; i++) {
      useAppStore.getState().upsertMessage('m1', mkMessage({
        id: 'm1', sessionId: 's1', role: 'assistant', content: `chunk-${i} `,
      }))
    }

    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[0].content).toBe('Question')
    expect(useAppStore.getState().messages[1].content).toBe('chunk-5 ')
  })

  it('streaming with tool messages interleaved', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', sessionId: 's1', role: 'assistant', content: 'Let me check...' }),
        mkMessage({ id: 'm2', sessionId: 's1', role: 'tool', toolName: 'read', toolStatus: 'running', content: '' }),
        mkMessage({ id: 'm3', sessionId: 's1', role: 'assistant', content: '' }),
      ],
    })

    // Tool completes
    useAppStore.getState().upsertMessage('m2', mkMessage({
      id: 'm2', sessionId: 's1', role: 'tool', toolName: 'read', toolStatus: 'done', content: 'file contents',
    }))

    // Assistant streams final response
    useAppStore.getState().upsertMessage('m3', mkMessage({
      id: 'm3', sessionId: 's1', role: 'assistant', content: 'Here is what I found',
    }))

    expect(useAppStore.getState().messages[1].toolStatus).toBe('done')
    expect(useAppStore.getState().messages[1].content).toBe('file contents')
    expect(useAppStore.getState().messages[2].content).toBe('Here is what I found')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  removeTabsByPath: deeper nesting and mixed types
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — removeTabsByPath deep nesting', () => {
  it('removes tabs at multiple nesting levels under a directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/src/sub/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file', path: '/src/sub/deep/c.ts', name: 'c.ts', isDirty: false },
        { type: 'file', path: '/other/d.ts', name: 'd.ts', isDirty: false },
        { type: 'session', id: 's1', title: 'Chat' },
      ],
      activeTabId: '/src/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    const tabs = useAppStore.getState().tabs
    expect(tabs).toHaveLength(2)
    expect((tabs[0] as any).path).toBe('/other/d.ts')
    expect(tabs[1].type).toBe('session')
  })

  it('does not remove directory path itself when isDir=false', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/components/Button.tsx', name: 'Button.tsx', isDirty: false },
        { type: 'file', path: '/src/components/Input.tsx', name: 'Input.tsx', isDirty: false },
      ],
    })
    useAppStore.getState().removeTabsByPath('/src/components', false)
    // Exact match only — neither tab has path === '/src/components'
    expect(useAppStore.getState().tabs).toHaveLength(2)
  })

  it('removes matching directory tabs while session tabs survive', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/lib/util.ts', name: 'util.ts', isDirty: false },
        { type: 'file', path: '/lib/format.ts', name: 'format.ts', isDirty: false },
        { type: 'session', id: 's1', title: 'Chat' },
        { type: 'file', path: '/lib/types.ts', name: 'types.ts', isDirty: false },
      ],
      activeTabId: 's1',
    })
    useAppStore.getState().removeTabsByPath('/lib', true)
    const tabs = useAppStore.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0].type).toBe('session')
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  renameTabPaths: deeper nesting edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — renameTabPaths deep nesting', () => {
  it('renames nested directories and updates activeTabId for deep child', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/pkg/deep/file.ts', name: 'file.ts', isDirty: false },
        { type: 'file', path: '/src/other.ts', name: 'other.ts', isDirty: false },
      ],
      activeTabId: '/src/pkg/deep/file.ts',
    })
    useAppStore.getState().renameTabPaths('/src/pkg', '/src/lib', 'lib')
    const tabs = useAppStore.getState().tabs as Extract<Tab, { type: 'file' }>[]
    expect(tabs[0].path).toBe('/src/lib/deep/file.ts')
    expect(tabs[1].path).toBe('/src/other.ts') // unaffected
    expect(useAppStore.getState().activeTabId).toBe('/src/lib/deep/file.ts')
  })

  it('does not rename partial prefix matches', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/componentsX/Button.tsx', name: 'Button.tsx', isDirty: false },
      ],
      activeTabId: '/src/componentsX/Button.tsx',
    })
    useAppStore.getState().renameTabPaths('/src/components', '/src/ui', 'ui')
    const tab = useAppStore.getState().tabs[0] as Extract<Tab, { type: 'file' }>
    // 'componentsX' should not match 'components' (needs / separator)
    expect(tab.path).toBe('/src/componentsX/Button.tsx')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  updateSession with non-existent ID
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — updateSession non-existent ID', () => {
  it('does not modify existing sessions', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Real' }), mkSession({ id: 's2', title: 'Also Real' })],
    })
    useAppStore.getState().updateSession('ghost', { title: 'Hacked' })
    expect(useAppStore.getState().sessions[0].title).toBe('Real')
    expect(useAppStore.getState().sessions[1].title).toBe('Also Real')
  })

  it('does not throw', () => {
    expect(() => useAppStore.getState().updateSession('nonexistent', { model: 'new' })).not.toThrow()
  })

  it('does not modify tabs when session id not found', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' })],
      tabs: [{ type: 'session', id: 's1', title: 'Chat' }],
    })
    useAppStore.getState().updateSession('ghost', { title: 'Changed' })
    expect(useAppStore.getState().tabs[0]).toMatchObject({ type: 'session', title: 'Chat' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  togglePinSession: position preservation
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — togglePinSession position preservation', () => {
  it('pin then unpin returns to original position in array', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', title: 'A', pinned: false }),
        mkSession({ id: 's2', title: 'B', pinned: false }),
        mkSession({ id: 's3', title: 'C', pinned: false }),
      ],
    })

    // Pin s2
    useAppStore.getState().togglePinSession('s2')
    const pinnedSessions = useAppStore.getState().sessions.filter((s) => s.pinned)
    const unpinnedSessions = useAppStore.getState().sessions.filter((s) => !s.pinned)
    expect(pinnedSessions).toHaveLength(1)
    expect(pinnedSessions[0].id).toBe('s2')
    expect(unpinnedSessions).toHaveLength(2)

    // Unpin s2
    useAppStore.getState().togglePinSession('s2')
    const afterUnpin = useAppStore.getState().sessions
    expect(afterUnpin.filter((s) => s.pinned)).toHaveLength(0)
    // Order preserved: s1, s2, s3
    expect(afterUnpin.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })

  it('multiple pins do not change relative unpinned order', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', title: 'A', pinned: false }),
        mkSession({ id: 's2', title: 'B', pinned: false }),
        mkSession({ id: 's3', title: 'C', pinned: false }),
        mkSession({ id: 's4', title: 'D', pinned: false }),
      ],
    })

    useAppStore.getState().togglePinSession('s1')
    useAppStore.getState().togglePinSession('s3')

    // Unpin all
    useAppStore.getState().togglePinSession('s1')
    useAppStore.getState().togglePinSession('s3')

    expect(useAppStore.getState().sessions.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  Integration flows
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration — send message → receive response → reply → edit', () => {
  it('full conversation lifecycle', () => {
    // Create session and open tab
    const session = mkSession({ id: 's1', title: 'Chat' })
    useAppStore.getState().addSession(session)
    useAppStore.getState().openSessionTab(session)
    expect(useAppStore.getState().activeTabId).toBe('s1')

    // User sends message
    useAppStore.getState().appendMessage(mkMessage({
      id: 'u1', sessionId: 's1', role: 'user', content: 'What is 2+2?', createdAt: 100,
    }))
    expect(useAppStore.getState().messages).toHaveLength(1)

    // Assistant responds (streaming)
    useAppStore.getState().upsertMessage('a1', mkMessage({
      id: 'a1', sessionId: 's1', role: 'assistant', content: '', createdAt: 200,
    }))
    expect(useAppStore.getState().messages).toHaveLength(2)

    // Stream update
    useAppStore.getState().upsertMessage('a1', mkMessage({
      id: 'a1', sessionId: 's1', role: 'assistant', content: 'The answer is 4.', createdAt: 200,
    }))
    expect(useAppStore.getState().messages[1].content).toBe('The answer is 4.')

    // User replies
    useAppStore.getState().appendMessage(mkMessage({
      id: 'u2', sessionId: 's1', role: 'user', content: 'And 3+3?', createdAt: 300,
    }))
    expect(useAppStore.getState().messages).toHaveLength(3)

    // User edits their first message
    useAppStore.getState().upsertMessage('u1', mkMessage({
      id: 'u1', sessionId: 's1', role: 'user', content: 'What is 2+2? (edited)', createdAt: 100,
    }))
    expect(useAppStore.getState().messages[0].content).toBe('What is 2+2? (edited)')
    expect(useAppStore.getState().messages).toHaveLength(3) // no new messages added

    // Update session title based on first message
    useAppStore.getState().updateSession('s1', { title: 'Math Question' })
    expect(useAppStore.getState().sessions[0].title).toBe('Math Question')
    // Tab title should also be updated
    expect(useAppStore.getState().tabs[0]).toMatchObject({ type: 'session', title: 'Math Question' })
  })
})

describe('Integration — session creation → switch → verify state isolation', () => {
  it('two sessions have independent message lists', () => {
    // Create two sessions
    useAppStore.getState().addSession(mkSession({ id: 's1', title: 'Session 1' }))
    useAppStore.getState().addSession(mkSession({ id: 's2', title: 'Session 2' }))

    // Open both tabs
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'Session 1' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's2', title: 'Session 2' }))

    // Add messages to session 1 (simulated via sessionId filter)
    useAppStore.getState().appendMessage(mkMessage({
      id: 'u1', sessionId: 's1', role: 'user', content: 'Hi from s1', createdAt: 100,
    }))
    useAppStore.getState().appendMessage(mkMessage({
      id: 'a1', sessionId: 's1', role: 'assistant', content: 'Hello s1', createdAt: 200,
    }))

    // Add messages to session 2
    useAppStore.getState().appendMessage(mkMessage({
      id: 'u2', sessionId: 's2', role: 'user', content: 'Hi from s2', createdAt: 300,
    }))

    // Verify all messages exist (store is flat, filter by sessionId in components)
    const allMessages = useAppStore.getState().messages
    expect(allMessages).toHaveLength(3)

    const s1Messages = allMessages.filter((m) => m.sessionId === 's1')
    const s2Messages = allMessages.filter((m) => m.sessionId === 's2')
    expect(s1Messages).toHaveLength(2)
    expect(s2Messages).toHaveLength(1)

    // Switch active tab
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeTabId).toBe('s1')

    useAppStore.getState().selectTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s2')

    // Remove s2 session — messages remain (store doesn't cascade)
    useAppStore.getState().removeSession('s2')
    expect(useAppStore.getState().sessions).toHaveLength(1)
    // Messages still present — app handles filtering
    expect(useAppStore.getState().messages).toHaveLength(3)
  })

  it('each session has independent todo lists', () => {
    useAppStore.getState().addTodo(mkTodo({
      id: 't1', sessionId: 's1', text: 'Task for s1', completed: false,
    }))
    useAppStore.getState().addTodo(mkTodo({
      id: 't2', sessionId: 's2', text: 'Task for s2', completed: false,
    }))
    useAppStore.getState().addTodo(mkTodo({
      id: 't3', sessionId: 's1', text: 'Another s1', completed: true,
    }))

    // Filter by sessionId
    const s1Todos = useAppStore.getState().todos.filter((t) => t.sessionId === 's1')
    const s2Todos = useAppStore.getState().todos.filter((t) => t.sessionId === 's2')
    expect(s1Todos).toHaveLength(2)
    expect(s2Todos).toHaveLength(1)

    // Remove s1 todos
    useAppStore.getState().removeTodo('t1')
    useAppStore.getState().removeTodo('t3')
    expect(useAppStore.getState().todos.filter((t) => t.sessionId === 's1')).toHaveLength(0)
    expect(useAppStore.getState().todos.filter((t) => t.sessionId === 's2')).toHaveLength(1)
  })
})

describe('Integration — multiple tabs open → close active → verify fallback', () => {
  it('close active session tab falls back to next tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Chat 1' },
        { type: 'session', id: 's2', title: 'Chat 2' },
        { type: 'session', id: 's3', title: 'Chat 3' },
      ],
      activeTabId: 's2',
    })

    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).toBe('s3')
    // Remaining tabs are s1 and s3
    expect(useAppStore.getState().tabs.map((t) => t.type === 'session' ? t.id : (t as any).path)).toEqual(['s1', 's3'])
  })

  it('close active file tab falls back to session tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Chat' },
        { type: 'file', path: '/src/main.ts', name: 'main.ts', isDirty: false },
        { type: 'file', path: '/src/app.ts', name: 'app.ts', isDirty: false },
      ],
      activeTabId: '/src/main.ts',
    })

    useAppStore.getState().closeTab('/src/main.ts')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).toBe('/src/app.ts')
  })

  it('close all file tabs leaves session tabs intact', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Chat' },
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })

    useAppStore.getState().removeTabsByPath('/a.ts', false)
    useAppStore.getState().removeTabsByPath('/b.ts', false)

    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].type).toBe('session')
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('rapid open-close cycles maintain consistent state', () => {
    // Open 5 tabs
    for (let i = 0; i < 5; i++) {
      useAppStore.getState().openSessionTab(mkSession({ id: `s${i}`, title: `Tab ${i}` }))
    }
    expect(useAppStore.getState().tabs).toHaveLength(5)

    // Close tabs 0, 2, 4 (odd indices remain)
    useAppStore.getState().closeTab('s0')
    useAppStore.getState().closeTab('s2')
    useAppStore.getState().closeTab('s4')

    expect(useAppStore.getState().tabs).toHaveLength(2)
    const remainingIds = useAppStore.getState().tabs
      .filter((t): t is Extract<Tab, { type: 'session' }> => t.type === 'session')
      .map((t) => t.id)
    expect(remainingIds).toEqual(['s1', 's3'])
  })
})
