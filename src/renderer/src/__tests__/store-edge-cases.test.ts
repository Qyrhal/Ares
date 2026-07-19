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
