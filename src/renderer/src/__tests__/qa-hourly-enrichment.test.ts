import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, Message, Tab } from '@/types'

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

beforeEach(() => {
  useAppStore.setState({
    sessions: [], messages: [], todos: [], tabs: [],
    activeTabId: null, activeView: 'chat', sessionGroups: [],
    sideChatMessages: [], sideChatSessionId: null, sideChatIsLoading: false,
    commits: [], activeCommit: null, gitLoading: false,
    workspacePath: null, fileNodes: [], recentProjects: [],
    lastDeletedMessage: null, promptHistory: [], promptHistoryIdx: -1,
    isLoading: false, zenMode: false, terminalOpen: false,
    terminalHeight: '200px', settings: {
      apiKey: 'test', apiBaseUrl: 'https://api.openai.com/v1',
      providers: [], defaultModel: 'gpt-4o-mini', themeId: 'steel',
      colorMode: 'dark', systemPrompt: '', permissionMode: 'ask',
    },
  })
})

// ── setSessions / setMessages bulk replacement ────────────────────────────────

describe('store — setSessions bulk replacement', () => {
  it('replaces all sessions atomically', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1' }), mkSession({ id: 's2' })] })
    useAppStore.getState().setSessions([mkSession({ id: 's3' }), mkSession({ id: 's4' }), mkSession({ id: 's5' })])
    expect(useAppStore.getState().sessions).toHaveLength(3)
    expect(useAppStore.getState().sessions.map((s) => s.id)).toEqual(['s3', 's4', 's5'])
  })

  it('clears sessions with empty array', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1' })] })
    useAppStore.getState().setSessions([])
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  it('preserves session order from replacement', () => {
    useAppStore.getState().setSessions([
      mkSession({ id: 'a', title: 'Alpha' }),
      mkSession({ id: 'b', title: 'Beta' }),
      mkSession({ id: 'c', title: 'Gamma' }),
    ])
    expect(useAppStore.getState().sessions.map((s) => s.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })
})

describe('store — setMessages bulk replacement', () => {
  it('replaces all messages atomically', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().setMessages([
      mkMessage({ id: 'm2', content: 'A' }),
      mkMessage({ id: 'm3', content: 'B' }),
    ])
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages.map((m) => m.content)).toEqual(['A', 'B'])
  })

  it('clears messages with empty array', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().setMessages([])
    expect(useAppStore.getState().messages).toHaveLength(0)
  })
})

// ── prompt history cap and edge cases ─────────────────────────────────────────

describe('store — prompt history cap at 100', () => {
  it('caps history at 100 entries', () => {
    const { addPromptToHistory } = useAppStore.getState()
    for (let i = 0; i < 110; i++) {
      addPromptToHistory(`prompt-${i}`)
    }
    expect(useAppStore.getState().promptHistory.length).toBeLessThanOrEqual(100)
    expect(useAppStore.getState().promptHistory[0]).toBe('prompt-109')
  })

  it('duplicate of last entry is not added', () => {
    const { addPromptToHistory } = useAppStore.getState()
    addPromptToHistory('same')
    addPromptToHistory('same')
    expect(useAppStore.getState().promptHistory).toEqual(['same'])
  })

  it('non-consecutive duplicates are preserved', () => {
    const { addPromptToHistory } = useAppStore.getState()
    addPromptToHistory('first')
    addPromptToHistory('second')
    addPromptToHistory('first')
    expect(useAppStore.getState().promptHistory).toEqual(['first', 'second', 'first'])
  })
})

describe('store — navigatePromptHistory edge cases', () => {
  it('returns null on empty history', () => {
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBeNull()
  })

  it('stays at oldest when navigating up past the end', () => {
    const { addPromptToHistory, navigatePromptHistory } = useAppStore.getState()
    addPromptToHistory('only-one')
    navigatePromptHistory('up') // idx 0
    navigatePromptHistory('up') // already at oldest, stays
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
  })

  it('resets idx to -1 when navigating down past newest', () => {
    const { addPromptToHistory, navigatePromptHistory } = useAppStore.getState()
    addPromptToHistory('item')
    navigatePromptHistory('up') // idx 0
    const result = navigatePromptHistory('down') // idx -1
    expect(result).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('resetPromptHistoryIdx resets to -1', () => {
    const { addPromptToHistory, navigatePromptHistory, resetPromptHistoryIdx } = useAppStore.getState()
    addPromptToHistory('item')
    navigatePromptHistory('up')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
    resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })
})

// ── updateSession cascades to tab title ───────────────────────────────────────

describe('store — updateSession cascades to tab title', () => {
  it('updating session title also updates corresponding tab', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Old Title' })],
      tabs: [{ type: 'session', id: 's1', title: 'Old Title' }],
    })
    useAppStore.getState().updateSession('s1', { title: 'New Title' })
    expect(useAppStore.getState().sessions[0].title).toBe('New Title')
    expect(useAppStore.getState().tabs[0].title).toBe('New Title')
  })

  it('non-title update does not affect tab', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Keep' })],
      tabs: [{ type: 'session', id: 's1', title: 'Keep' }],
    })
    useAppStore.getState().updateSession('s1', { model: 'gpt-4o' })
    expect(useAppStore.getState().tabs[0].title).toBe('Keep')
  })
})

// ── closeTab fallback behavior ────────────────────────────────────────────────

describe('store — closeTab fallback to left tab', () => {
  it('closes active tab at index 2, activates index 1 (left)', () => {
    useAppStore.setState({
      tabs: [
        mkTab({ id: 's1' }),
        mkTab({ id: 's2' }),
        mkTab({ id: 's3' }),
      ],
      activeTabId: 's3',
    })
    useAppStore.getState().closeTab('s3')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('closes single remaining tab', () => {
    useAppStore.setState({
      tabs: [mkTab({ id: 's1' })],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })
})

// ── removeTabsByPath activeTabId fallback ─────────────────────────────────────

describe('store — removeTabsByPath activeTabId fallback', () => {
  it('updates activeTabId when removed tab is active', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false } as Tab,
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/a.ts', false)
    expect(useAppStore.getState().activeTabId).toBe('/b.ts')
  })

  it('sets activeTabId to null when all tabs removed', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false } as Tab],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/a.ts', false)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })
})

// ── renameTabPaths activeTabId tracking ───────────────────────────────────────

describe('store — renameTabPaths activeTabId tracking', () => {
  it('updates activeTabId when renamed tab is active', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/old.ts', name: 'old.ts', isDirty: false } as Tab],
      activeTabId: '/old.ts',
    })
    useAppStore.getState().renameTabPaths('/old.ts', '/new.ts', 'new.ts')
    expect(useAppStore.getState().activeTabId).toBe('/new.ts')
  })

  it('updates activeTabId for directory children when renamed dir is active', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/dir/a.ts', name: 'a.ts', isDirty: false } as Tab,
        { type: 'file', path: '/dir/b.ts', name: 'b.ts', isDirty: false } as Tab,
      ],
      activeTabId: '/dir/a.ts',
    })
    useAppStore.getState().renameTabPaths('/dir', '/newdir', 'newdir')
    expect(useAppStore.getState().activeTabId).toBe('/newdir/a.ts')
  })
})

// ── togglePinSession order preservation ────────────────────────────────────────

describe('store — togglePinSession order preservation', () => {
  it('pinning does not reorder unpinned sessions', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', pinned: false }),
        mkSession({ id: 's2', pinned: false }),
        mkSession({ id: 's3', pinned: false }),
      ],
    })
    useAppStore.getState().togglePinSession('s2')
    const unpinned = useAppStore.getState().sessions.filter((s) => !s.pinned)
    expect(unpinned.map((s) => s.id)).toEqual(['s1', 's3'])
  })
})

// ── toggleArchiveSession preserves tab link ────────────────────────────────────

describe('store — toggleArchiveSession preserves tab link', () => {
  it('archiving does not remove session from tabs', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', archived: false })],
      tabs: [{ type: 'session', id: 's1', title: 'Tab' }],
    })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].id).toBe('s1')
  })
})

// ── removeSessionGroup clears group from sessions ──────────────────────────────

describe('store — removeSessionGroup clears group from sessions', () => {
  it('clears group from sessions in that group only', () => {
    const gid = useAppStore.getState().addSessionGroup('Test')
    useAppStore.setState({
      sessions: [
        { ...mkSession({ id: 's1' }), group: gid },
        { ...mkSession({ id: 's2' }), group: 'other' },
        mkSession({ id: 's3' }),
      ],
    })
    useAppStore.getState().removeSessionGroup(gid)
    expect(useAppStore.getState().sessions.find((s) => s.id === 's1')?.group).toBeUndefined()
    expect(useAppStore.getState().sessions.find((s) => s.id === 's2')?.group).toBe('other')
    expect(useAppStore.getState().sessions.find((s) => s.id === 's3')?.group).toBeUndefined()
  })
})

// ── clearAllMessages also resets isLoading ─────────────────────────────────────

describe('store — clearAllMessages also resets isLoading', () => {
  it('clears messages and sets isLoading to false', () => {
    useAppStore.setState({ messages: [mkMessage()], isLoading: true })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

// ── setSettings preserves unmodified fields ────────────────────────────────────

describe('store — setSettings preserves unmodified fields', () => {
  it('partial settings update preserves other fields', () => {
    const initial = useAppStore.getState().settings
    useAppStore.getState().setSettings({ ...initial, apiKey: 'new-key' })
    expect(useAppStore.getState().settings.apiKey).toBe('new-key')
    expect(useAppStore.getState().settings.apiBaseUrl).toBe(initial.apiBaseUrl)
    expect(useAppStore.getState().settings.defaultModel).toBe(initial.defaultModel)
  })
})

// ── side chat message operations ──────────────────────────────────────────────

describe('store — side chat message operations', () => {
  it('upsertSideChatMessage updates existing', () => {
    useAppStore.setState({ sideChatMessages: [{ id: 'm1', content: 'Old' } as any] })
    useAppStore.getState().upsertSideChatMessage('m1', { id: 'm1', content: 'New' } as any)
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('New')
  })

  it('upsertSideChatMessage appends new', () => {
    useAppStore.getState().upsertSideChatMessage('m1', { id: 'm1', content: 'New' } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('removeSideChatMessage no-ops for non-existent', () => {
    useAppStore.setState({ sideChatMessages: [{ id: 'm1', content: 'X' } as any] })
    useAppStore.getState().removeSideChatMessage('nonexistent')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })
})

// ── addSessionGroup unique ids ────────────────────────────────────────────────

describe('store — addSessionGroup unique ids', () => {
  it('each group gets a unique id', () => {
    const id1 = useAppStore.getState().addSessionGroup('A')
    const id2 = useAppStore.getState().addSessionGroup('B')
    expect(id1).not.toBe(id2)
    expect(typeof id1).toBe('string')
    expect(id1.length).toBeGreaterThan(0)
  })
})

// ── renameSessionGroup edge cases ─────────────────────────────────────────────

describe('store — renameSessionGroup edge cases', () => {
  it('renames group by id', () => {
    const id = useAppStore.getState().addSessionGroup('Old')
    useAppStore.getState().renameSessionGroup(id, 'New')
    expect(useAppStore.getState().sessionGroups.find((g) => g.id === id)?.name).toBe('New')
  })

  it('no-ops for non-existent id', () => {
    useAppStore.getState().addSessionGroup('Real')
    useAppStore.getState().renameSessionGroup('fake', 'Fake')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
  })
})

// ── openSessionTab deduplication ──────────────────────────────────────────────

describe('store — openSessionTab deduplication', () => {
  it('does not create duplicate tab for same session', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('creates tabs for different sessions', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's2' }))
    expect(useAppStore.getState().tabs).toHaveLength(2)
  })
})

// ── openFileTab deduplication ─────────────────────────────────────────────────

describe('store — openFileTab deduplication', () => {
  it('does not create duplicate file tab', () => {
    const node = { name: 'a.ts', path: '/a.ts', isDirectory: false }
    useAppStore.getState().openFileTab(node as any)
    useAppStore.getState().openFileTab(node as any)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })
})

// ── selectTab view switching ──────────────────────────────────────────────────

describe('store — selectTab view switching', () => {
  it('selecting file tab does not change activeView', () => {
    useAppStore.setState({
      activeView: 'git',
      tabs: [{ type: 'file', path: '/f.ts', name: 'f.ts', isDirty: false }],
    })
    useAppStore.getState().selectTab('/f.ts')
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('selecting session tab switches to chat view', () => {
    useAppStore.setState({
      activeView: 'git',
      tabs: [{ type: 'session', id: 's1', title: 'Tab' }],
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })
})

// ── setSessionGroup assignment edge cases ──────────────────────────────────────

describe('store — setSessionGroup assignment edge cases', () => {
  it('assigns session to group', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1' })] })
    useAppStore.getState().setSessionGroup('s1', 'g1')
    expect(useAppStore.getState().sessions[0].group).toBe('g1')
  })

  it('removes session from group', () => {
    useAppStore.setState({ sessions: [{ ...mkSession({ id: 's1' }), group: 'g1' }] })
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })

  it('no-ops for non-existent session', () => {
    useAppStore.setState({ sessions: [] })
    expect(() => useAppStore.getState().setSessionGroup('ghost', 'g1')).not.toThrow()
  })
})

// ── updateRunningTool edge cases ──────────────────────────────────────────────

describe('store — updateRunningTool edge cases', () => {
  it('no-ops when no running tools exist', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1', role: 'tool', toolStatus: 'done' })] })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[0].toolStatus).toBe('done')
  })

  it('updates the last running tool (reversed search)', () => {
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

// ── setLoading / setGitLoading / setActiveView ─────────────────────────────────

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

describe('store — setGitLoading edge cases', () => {
  it('toggles git loading', () => {
    useAppStore.getState().setGitLoading(true)
    expect(useAppStore.getState().gitLoading).toBe(true)
    useAppStore.getState().setGitLoading(false)
    expect(useAppStore.getState().gitLoading).toBe(false)
  })
})

describe('store — setActiveView edge cases', () => {
  it('sets active view', () => {
    useAppStore.getState().setActiveView('git')
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('can set to settings', () => {
    useAppStore.getState().setActiveView('settings')
    expect(useAppStore.getState().activeView).toBe('settings')
  })
})

// ── toggleTerminal / toggleZenMode ────────────────────────────────────────────

describe('store — toggleTerminal edge cases', () => {
  it('toggles false to true', () => {
    useAppStore.setState({ terminalOpen: false })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('toggles true to false', () => {
    useAppStore.setState({ terminalOpen: true })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })

  it('triple toggle ends at true', () => {
    useAppStore.setState({ terminalOpen: false })
    useAppStore.getState().toggleTerminal()
    useAppStore.getState().toggleTerminal()
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })
})

describe('store — toggleZenMode edge cases', () => {
  it('toggles', () => {
    useAppStore.setState({ zenMode: false })
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

// ── setTerminalHeight ─────────────────────────────────────────────────────────

describe('store — setTerminalHeight edge cases', () => {
  it('sets height', () => {
    useAppStore.getState().setTerminalHeight('300px')
    expect(useAppStore.getState().terminalHeight).toBe('300px')
  })

  it('can set to different values', () => {
    useAppStore.getState().setTerminalHeight('100px')
    useAppStore.getState().setTerminalHeight('500px')
    expect(useAppStore.getState().terminalHeight).toBe('500px')
  })
})

// ── setWorkspace ──────────────────────────────────────────────────────────────

describe('store — setWorkspace edge cases', () => {
  it('sets workspace path and nodes', () => {
    const nodes = [{ name: 'src', path: '/src', isDirectory: true, children: [] }] as any[]
    useAppStore.getState().setWorkspace('/project', nodes)
    expect(useAppStore.getState().workspacePath).toBe('/project')
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })

  it('clears workspace', () => {
    useAppStore.getState().setWorkspace('/project', [{ name: 'x', path: '/x', isDirectory: false }] as any[])
    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })
})

// ── setCommits / setActiveCommit ──────────────────────────────────────────────

describe('store — setCommits edge cases', () => {
  it('sets commits', () => {
    useAppStore.getState().setCommits([
      { hash: 'abc', shortHash: 'abc', parents: [], author: 'T', date: '', message: 'init' },
    ])
    expect(useAppStore.getState().commits).toHaveLength(1)
  })

  it('clears commits', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'T', date: '', message: 'init' }],
    })
    useAppStore.getState().setCommits([])
    expect(useAppStore.getState().commits).toHaveLength(0)
  })
})

describe('store — setActiveCommit edge cases', () => {
  it('sets active commit', () => {
    useAppStore.getState().setActiveCommit('abc')
    expect(useAppStore.getState().activeCommit).toBe('abc')
  })

  it('clears active commit', () => {
    useAppStore.setState({ activeCommit: 'abc' })
    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })
})

// ── setRecentProjects ─────────────────────────────────────────────────────────

describe('store — setRecentProjects edge cases', () => {
  it('sets recent projects', () => {
    useAppStore.getState().setRecentProjects(['/a', '/b'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b'])
  })

  it('clears when set to empty', () => {
    useAppStore.setState({ recentProjects: ['/a'] })
    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toEqual([])
  })
})

// ── setFileNodes ──────────────────────────────────────────────────────────────

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

// ── setTodos / addTodo / updateTodo / removeTodo ──────────────────────────────

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

// ── lastDeletedMessage ────────────────────────────────────────────────────────

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

// ── message ordering after multiple operations ────────────────────────────────

describe('store — message ordering after multiple operations', () => {
  it('append then upsert preserves order', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1', content: 'first' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2', content: 'second' }))
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'UPDATED' }))
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toBe('UPDATED')
    expect(msgs[1].content).toBe('second')
  })

  it('append then remove preserves remaining order', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1', content: 'A' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2', content: 'B' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm3', content: 'C' }))
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages.map((m) => m.content)).toEqual(['A', 'C'])
  })
})

// ── Integration — session lifecycle CRUD ──────────────────────────────────────

describe('Integration — session lifecycle CRUD', () => {
  it('create → select → update → delete', () => {
    useAppStore.getState().addSession(mkSession({ id: 's1', title: 'Initial' }))
    expect(useAppStore.getState().sessions).toHaveLength(1)

    useAppStore.getState().updateSession('s1', { title: 'Updated' })
    expect(useAppStore.getState().sessions[0].title).toBe('Updated')

    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  it('pin → verify pinned → unpin → verify unpinned', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', pinned: false }),
        mkSession({ id: 's2', pinned: false }),
      ],
    })
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions.find((s) => s.id === 's1')?.pinned).toBe(true)
    expect(useAppStore.getState().sessions.find((s) => s.id === 's2')?.pinned).toBe(false)

    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions.find((s) => s.id === 's1')?.pinned).toBe(false)
  })

  it('archive → verify archived → unarchive', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: false })] })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(false)
  })
})

// ── Integration — tab operations flow chains ──────────────────────────────────

describe('Integration — tab operations flow chains', () => {
  it('open session → open file → close file → session remains', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', isDirectory: false } as any)
    expect(useAppStore.getState().tabs).toHaveLength(2)

    useAppStore.getState().closeTab('/a.ts')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].type).toBe('session')
  })

  it('close active tab → falls back to adjacent', () => {
    useAppStore.setState({
      tabs: [mkTab({ id: 's1' }), mkTab({ id: 's2' }), mkTab({ id: 's3' })],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).not.toBe('s2')
  })
})

// ── Integration — todo operations flow ────────────────────────────────────────

describe('Integration — todo operations flow', () => {
  it('add → update → remove', () => {
    useAppStore.getState().addTodo({ id: 't1', text: 'Task', completed: false, sessionId: 's1', createdAt: 0 } as any)
    expect(useAppStore.getState().todos).toHaveLength(1)

    useAppStore.getState().updateTodo('t1', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(true)

    useAppStore.getState().removeTodo('t1')
    expect(useAppStore.getState().todos).toHaveLength(0)
  })
})

// ── Integration — side chat flow ──────────────────────────────────────────────

describe('Integration — side chat flow', () => {
  it('setSideChat → append → upsert → remove → clear', () => {
    useAppStore.getState().setSideChat('sc1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc1')

    useAppStore.getState().appendSideChatMessage({ id: 'm1', content: 'Hi' } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)

    useAppStore.getState().upsertSideChatMessage('m1', { id: 'm1', content: 'Updated' } as any)
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('Updated')

    useAppStore.getState().removeSideChatMessage('m1')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(0)

    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })
})
