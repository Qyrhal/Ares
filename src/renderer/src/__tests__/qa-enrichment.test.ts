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

beforeEach(() => {
  useAppStore.setState({
    sessions: [], messages: [], todos: [], tabs: [],
    activeTabId: null, activeView: 'chat', sessionGroups: [],
    sideChatMessages: [], sideChatSessionId: null, sideChatIsLoading: false,
    commits: [], activeCommit: null, gitLoading: false,
    workspacePath: null, fileNodes: [], recentProjects: [],
    lastDeletedMessage: null, promptHistory: [], promptHistoryIdx: -1,
    settings: {
      apiKey: '', apiBaseUrl: 'https://api.openai.com/v1',
      providers: [], defaultModel: 'gpt-4o-mini', themeId: 'steel',
      colorMode: 'dark', systemPrompt: '', permissionMode: 'ask',
    },
  })
})

describe('Store — prompt history edge cases', () => {
  it('navigates up past the oldest entry stays at oldest', () => {
    const { addPromptToHistory, navigatePromptHistory } = useAppStore.getState()
    addPromptToHistory('only')
    navigatePromptHistory('up') // → 'only'
    navigatePromptHistory('up') // already at oldest, should stay
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
  })

  it('navigates down past newest returns empty string and resets idx', () => {
    const { addPromptToHistory, navigatePromptHistory } = useAppStore.getState()
    addPromptToHistory('item')
    navigatePromptHistory('up') // → 'item' (idx 0)
    const result = navigatePromptHistory('down') // → '' (idx -1)
    expect(result).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('down from initial position returns null', () => {
    const result = useAppStore.getState().navigatePromptHistory('down')
    expect(result).toBeNull()
  })

  it('non-consecutive duplicate prompts are preserved', () => {
    const { addPromptToHistory } = useAppStore.getState()
    addPromptToHistory('same')
    addPromptToHistory('different')
    addPromptToHistory('same')
    expect(useAppStore.getState().promptHistory).toEqual(['same', 'different', 'same'])
  })

  it('trims history from front when exceeding 100 entries', () => {
    const { addPromptToHistory } = useAppStore.getState()
    for (let i = 0; i < 101; i++) addPromptToHistory(`p-${i}`)
    const hist = useAppStore.getState().promptHistory
    expect(hist.length).toBe(100)
    // Newest at index 0, oldest at index 99. p-0 was evicted, p-1 is oldest kept.
    expect(hist[0]).toBe('p-100')
    expect(hist[99]).toBe('p-1')
  })
})

describe('Store — side chat operations', () => {
  it('setSideChat sets the side chat session id', () => {
    useAppStore.getState().setSideChat('sc1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc1')
  })

  it('setSideChat clears when passed null', () => {
    useAppStore.setState({ sideChatSessionId: 'sc1' })
    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })

  it('appendSideChatMessage adds messages in order', () => {
    const msg1 = mkMessage({ id: 'sc1', content: 'first' })
    const msg2 = mkMessage({ id: 'sc2', content: 'second' })
    useAppStore.getState().appendSideChatMessage(msg1)
    useAppStore.getState().appendSideChatMessage(msg2)
    const msgs = useAppStore.getState().sideChatMessages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toBe('first')
    expect(msgs[1].content).toBe('second')
  })

  it('upsertSideChatMessage replaces existing message', () => {
    const msg = mkMessage({ id: 'sc1', content: 'original' })
    useAppStore.getState().appendSideChatMessage(msg)
    const updated = mkMessage({ id: 'sc1', content: 'edited' })
    useAppStore.getState().upsertSideChatMessage('sc1', updated)
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('edited')
  })

  it('removeSideChatMessage removes by id', () => {
    useAppStore.getState().appendSideChatMessage(mkMessage({ id: 'sc1' }))
    useAppStore.getState().appendSideChatMessage(mkMessage({ id: 'sc2' }))
    useAppStore.getState().removeSideChatMessage('sc1')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
    expect(useAppStore.getState().sideChatMessages[0].id).toBe('sc2')
  })

  it('setSideChatLoading toggles', () => {
    useAppStore.getState().setSideChatLoading(true)
    expect(useAppStore.getState().sideChatIsLoading).toBe(true)
    useAppStore.getState().setSideChatLoading(false)
    expect(useAppStore.getState().sideChatIsLoading).toBe(false)
  })
})

describe('Store — tab operations comprehensive', () => {
  it('openFileTab does not duplicate if already open', () => {
    const node = { name: 'a.ts', path: '/a.ts', type: 'file' as const }
    useAppStore.getState().openFileTab(node)
    useAppStore.getState().openFileTab(node)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('openSessionTab does not duplicate if already open', () => {
    const s = mkSession({ id: 's1' })
    useAppStore.getState().openSessionTab(s)
    useAppStore.getState().openSessionTab(s)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('selectTab sets activeTabId', () => {
    useAppStore.setState({
      tabs: [mkSession({ id: 's1' }), mkSession({ id: 's2' })].map(s => ({ type: 'session' as const, id: s.id, title: s.title })),
      activeTabId: 's1',
    })
    useAppStore.getState().selectTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('closeTab on middle tab keeps adjacent tabs', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'T1' },
        { type: 'session' as const, id: 's2', title: 'T2' },
        { type: 'session' as const, id: 's3', title: 'T3' },
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().tabs.map(t => t.type === 'session' ? t.id : '')).toEqual(['s1', 's3'])
  })

  it('closeTab falls back to adjacent tab when closing active', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'T1' },
        { type: 'session' as const, id: 's2', title: 'T2' },
      ],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('renameTabPaths updates file tab name and path', () => {
    useAppStore.setState({
      tabs: [{ type: 'file' as const, path: '/old.ts', name: 'old.ts', isDirty: false }],
    })
    useAppStore.getState().renameTabPaths('/old.ts', '/new.ts', 'new.ts')
    const tab = useAppStore.getState().tabs[0] as { type: 'file'; path: string; name: string }
    expect(tab.path).toBe('/new.ts')
    expect(tab.name).toBe('new.ts')
  })

  it('removeTabsByPath removes a single file tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file' as const, path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file' as const, path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/a.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as { path: string }).path).toBe('/b.ts')
  })

  it('removeTabsByPath with isDir removes children tabs', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file' as const, path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file' as const, path: '/src/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file' as const, path: '/other/c.ts', name: 'c.ts', isDirty: false },
      ],
      activeTabId: '/src/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as { path: string }).path).toBe('/other/c.ts')
  })
})

describe('Store — session operations comprehensive', () => {
  it('togglePinSession pins an unpinned session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', pinned: false })] })
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions[0].pinned).toBe(true)
  })

  it('togglePinSession unpins a pinned session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', pinned: true })] })
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions[0].pinned).toBe(false)
  })

  it('toggleArchiveSession archives an unarchived session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: false })] })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
  })

  it('toggleArchiveSession unarchives an archived session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: true })] })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(false)
  })

  it('removeSession removes the session from the list', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' }), mkSession({ id: 's2' })],
    })
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(1)
    expect(useAppStore.getState().sessions[0].id).toBe('s2')
  })

  it('updateSession with partial fields', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', title: 'Old' })] })
    useAppStore.getState().updateSession('s1', { title: 'New' })
    expect(useAppStore.getState().sessions[0].title).toBe('New')
    // model should remain unchanged
    expect(useAppStore.getState().sessions[0].model).toBe('gpt-4o')
  })
})

describe('Store — message operations comprehensive', () => {
  it('appendMessage adds to empty list', () => {
    const msg = mkMessage({ id: 'm1' })
    useAppStore.getState().appendMessage(msg)
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('m1')
  })

  it('appendMessage adds at end of existing', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2' }))
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[1].id).toBe('m2')
  })

  it('removeMessage removes the correct message', () => {
    useAppStore.setState({
      messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' }), mkMessage({ id: 'm3' })],
    })
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages.map(m => m.id)).toEqual(['m1', 'm3'])
  })

  it('upsertMessage replaces existing message', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1', content: 'old' })] })
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'new' }))
    expect(useAppStore.getState().messages[0].content).toBe('new')
  })

  it('upsertMessage appends new message if not found', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().upsertMessage('m2', mkMessage({ id: 'm2', content: 'new msg' }))
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[1].id).toBe('m2')
  })

  it('clearAllMessages empties the list', () => {
    useAppStore.setState({
      messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })],
    })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('updateRunningTool finds the last running tool message', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', role: 'tool', toolStatus: 'done', toolName: 't1' }),
        mkMessage({ id: 'm2', role: 'tool', toolStatus: 'running', toolName: 't2' }),
        mkMessage({ id: 'm3', role: 'user', content: 'continue' }),
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    const updated = useAppStore.getState().messages.find(m => m.id === 'm2')
    expect(updated?.toolStatus).toBe('done')
    expect(updated?.toolOutput).toBe('result')
  })
})

describe('Store — git operations', () => {
  it('setCommits replaces commits', () => {
    useAppStore.getState().setCommits([
      { hash: 'abc', shortHash: 'abc', message: 'first', author: 'me', date: '', parents: [] },
      { hash: 'def', shortHash: 'def', message: 'second', author: 'me', date: '', parents: [] },
    ])
    expect(useAppStore.getState().commits).toHaveLength(2)
  })

  it('setActiveCommit sets hash', () => {
    useAppStore.getState().setActiveCommit('abc123')
    expect(useAppStore.getState().activeCommit).toBe('abc123')
  })

  it('setActiveCommit clears when null', () => {
    useAppStore.setState({ activeCommit: 'abc' })
    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })

  it('setGitLoading toggles', () => {
    useAppStore.getState().setGitLoading(true)
    expect(useAppStore.getState().gitLoading).toBe(true)
    useAppStore.getState().setGitLoading(false)
    expect(useAppStore.getState().gitLoading).toBe(false)
  })
})

describe('Store — workspace and file nodes', () => {
  it('setWorkspace sets path and nodes', () => {
    const nodes = [
      { name: 'src', path: '/p/src', type: 'directory' as const, children: [] },
    ]
    useAppStore.getState().setWorkspace('/p', nodes)
    expect(useAppStore.getState().workspacePath).toBe('/p')
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })

  it('setWorkspace clears when null', () => {
    useAppStore.setState({ workspacePath: '/p', fileNodes: [{ name: 'a', path: '/a', type: 'file' as const }] })
    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })

  it('setFileNodes replaces nodes', () => {
    const nodes = [
      { name: 'a.ts', path: '/a.ts', type: 'file' as const },
      { name: 'b.ts', path: '/b.ts', type: 'file' as const },
    ]
    useAppStore.getState().setFileNodes(nodes)
    expect(useAppStore.getState().fileNodes).toHaveLength(2)
  })

  it('setRecentProjects replaces list', () => {
    useAppStore.getState().setRecentProjects(['/a', '/b', '/c'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b', '/c'])
  })
})

describe('Store — settings', () => {
  it('setSettings replaces settings', () => {
    const newSettings = {
      apiKey: 'new-key', apiBaseUrl: 'https://new.api/v1',
      providers: [], defaultModel: 'gpt-4', themeId: 'red',
      colorMode: 'light' as const, systemPrompt: 'Be concise',
      permissionMode: 'yolo' as const,
    }
    useAppStore.getState().setSettings(newSettings)
    expect(useAppStore.getState().settings.apiKey).toBe('new-key')
    expect(useAppStore.getState().settings.defaultModel).toBe('gpt-4')
    expect(useAppStore.getState().settings.themeId).toBe('red')
  })
})

describe('Store — view and terminal', () => {
  it('setActiveView changes the view', () => {
    useAppStore.getState().setActiveView('explorer')
    expect(useAppStore.getState().activeView).toBe('explorer')
  })

  it('toggleTerminal toggles on', () => {
    expect(useAppStore.getState().terminalOpen).toBe(false)
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('toggleTerminal toggles off', () => {
    useAppStore.setState({ terminalOpen: true })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })

  it('toggleZenMode toggles', () => {
    const initial = useAppStore.getState().zenMode
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(!initial)
  })

  it('setTerminalHeight sets height', () => {
    useAppStore.getState().setTerminalHeight('300px')
    expect(useAppStore.getState().terminalHeight).toBe('300px')
  })
})

describe('Store — todos', () => {
  it('addTodo appends', () => {
    const todo = { id: 't1', text: 'Do this', completed: false, sessionId: 's1', createdAt: 0 }
    useAppStore.getState().addTodo(todo)
    expect(useAppStore.getState().todos).toHaveLength(1)
    expect(useAppStore.getState().todos[0].text).toBe('Do this')
  })

  it('updateTodo patches fields', () => {
    useAppStore.setState({ todos: [{ id: 't1', text: 'Task', completed: false, sessionId: 's1', createdAt: 0 }] })
    useAppStore.getState().updateTodo('t1', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(true)
  })

  it('removeTodo removes by id', () => {
    useAppStore.setState({ todos: [{ id: 't1', text: 'Task', completed: false, sessionId: 's1', createdAt: 0 }] })
    useAppStore.getState().removeTodo('t1')
    expect(useAppStore.getState().todos).toHaveLength(0)
  })

  it('setTodos replaces', () => {
    useAppStore.setState({ todos: [{ id: 't1', text: 'A', completed: false, sessionId: 's1', createdAt: 0 }] })
    useAppStore.getState().setTodos([
      { id: 't2', text: 'B', completed: true, sessionId: 's1', createdAt: 0 },
      { id: 't3', text: 'C', completed: false, sessionId: 's1', createdAt: 0 },
    ])
    expect(useAppStore.getState().todos).toHaveLength(2)
  })
})

describe('Store — session groups', () => {
  it('addSessionGroup creates group with id', () => {
    const id = useAppStore.getState().addSessionGroup('My Group')
    expect(id).toBeTruthy()
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
    expect(useAppStore.getState().sessionGroups[0].name).toBe('My Group')
  })

  it('renameSessionGroup updates name', () => {
    const id = useAppStore.getState().addSessionGroup('Old Name')
    useAppStore.getState().renameSessionGroup(id, 'New Name')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('New Name')
  })

  it('removeSessionGroup removes group', () => {
    const id = useAppStore.getState().addSessionGroup('To Delete')
    useAppStore.getState().removeSessionGroup(id)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })

  it('setSessionGroup assigns session to group', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', group: undefined })] })
    const gid = useAppStore.getState().addSessionGroup('G1')
    useAppStore.getState().setSessionGroup('s1', gid)
    expect(useAppStore.getState().sessions[0].group).toBe(gid)
  })

  it('setSessionGroup with null removes group assignment', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', group: 'g1' })] })
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })
})

describe('Store — last deleted message', () => {
  it('setLastDeletedMessage stores message', () => {
    const msg = mkMessage({ id: 'del1' })
    useAppStore.getState().setLastDeletedMessage(msg)
    expect(useAppStore.getState().lastDeletedMessage?.id).toBe('del1')
  })

  it('clearLastDeletedMessage nulls it', () => {
    useAppStore.setState({ lastDeletedMessage: mkMessage({ id: 'del1' }) })
    useAppStore.getState().clearLastDeletedMessage()
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })
})

describe('Store — loading state', () => {
  it('setLoading sets to true', () => {
    useAppStore.getState().setLoading(true)
    expect(useAppStore.getState().isLoading).toBe(true)
  })

  it('setLoading sets to false', () => {
    useAppStore.setState({ isLoading: true })
    useAppStore.getState().setLoading(false)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

describe('Store — agent status', () => {
  it('updates agent status via updateSession', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', agentStatus: 'idle' })] })
    useAppStore.getState().updateSession('s1', { agentStatus: 'running' })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('running')
  })

  it('syncs tab title when session title is updated', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Old' })],
      tabs: [{ type: 'session' as const, id: 's1', title: 'Old' }],
    })
    useAppStore.getState().updateSession('s1', { title: 'New' })
    const tab = useAppStore.getState().tabs[0] as { type: 'session'; title: string }
    expect(tab.title).toBe('New')
  })
})

describe('Store — tab dirty state', () => {
  it('setTabDirty marks file tab as dirty', () => {
    useAppStore.setState({
      tabs: [{ type: 'file' as const, path: '/a.ts', name: 'a.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/a.ts', true)
    expect((useAppStore.getState().tabs[0] as { isDirty: boolean }).isDirty).toBe(true)
  })

  it('setTabDirty marks file tab as clean', () => {
    useAppStore.setState({
      tabs: [{ type: 'file' as const, path: '/a.ts', name: 'a.ts', isDirty: true }],
    })
    useAppStore.getState().setTabDirty('/a.ts', false)
    expect((useAppStore.getState().tabs[0] as { isDirty: boolean }).isDirty).toBe(false)
  })
})
