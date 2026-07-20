import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, Message, Tab, FileNode } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test', model: 'gpt-4o',
    createdAt: 0, updatedAt: 0, messageCount: 0, ...overrides,
  }
}

function mkMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1', sessionId: 's1', role: 'user', content: 'Hello', createdAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  useAppStore.setState({
    tabs: [], activeTabId: null, sessions: [], messages: [],
    isLoading: false, sessionGroups: [], todos: [],
    sideChatSessionId: null, sideChatMessages: [], sideChatIsLoading: false,
    workspacePath: null, fileNodes: [], recentProjects: [],
    commits: [], activeCommit: null, gitLoading: false,
    lastDeletedMessage: null, zenMode: false, terminalOpen: false,
    activeView: 'chat', terminalHeight: '200px',
  })
})

describe('Integration — session lifecycle', () => {
  it('create session → appears in sidebar → select → loads', () => {
    const session = mkSession({ id: 's1', title: 'My Session' })
    useAppStore.getState().addSession(session)
    expect(useAppStore.getState().sessions).toHaveLength(1)
    expect(useAppStore.getState().sessions[0].title).toBe('My Session')

    useAppStore.getState().openSessionTab(session)
    expect(useAppStore.getState().activeTabId).toBe('s1')
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('pin session → moves to top → unpin → moves back', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', title: 'A', pinned: false }),
        mkSession({ id: 's2', title: 'B', pinned: false }),
        mkSession({ id: 's3', title: 'C', pinned: false }),
      ],
    })
    useAppStore.getState().togglePinSession('s2')
    const pinned = useAppStore.getState().sessions.filter((s) => s.pinned)
    const unpinned = useAppStore.getState().sessions.filter((s) => !s.pinned)
    expect(pinned).toHaveLength(1)
    expect(pinned[0].id).toBe('s2')
    expect(unpinned).toHaveLength(2)

    useAppStore.getState().togglePinSession('s2')
    expect(useAppStore.getState().sessions.filter((s) => s.pinned)).toHaveLength(0)
  })

  it('delete session → removed from list', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' }), mkSession({ id: 's2' })],
    })
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(1)
    expect(useAppStore.getState().sessions[0].id).toBe('s2')
  })

  it('update session → partial update works', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', title: 'Old' })] })
    useAppStore.getState().updateSession('s1', { title: 'New' })
    expect(useAppStore.getState().sessions[0].title).toBe('New')
    expect(useAppStore.getState().sessions[0].model).toBe('gpt-4o')
  })

  it('archive session → toggles archived flag', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: false })] })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(false)
  })
})

describe('Integration — tab operations flow', () => {
  it('open session tab → open file tab → close file tab → session tab remains', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', isDirectory: false } as any)
    expect(useAppStore.getState().tabs).toHaveLength(2)

    useAppStore.getState().closeTab('/a.ts')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].type).toBe('session')
  })

  it('close active tab → falls back to adjacent tab', () => {
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

  it('close last remaining tab → no tabs, no activeTabId', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'Only' }],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('tab dirty state → set dirty → set clean', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/a.ts', true)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(true)
    useAppStore.getState().setTabDirty('/a.ts', false)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(false)
  })

  it('rename tab paths → updates file tab reference', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/old.ts', name: 'old.ts', isDirty: false }],
      activeTabId: '/old.ts',
    })
    useAppStore.getState().renameTabPaths('/old.ts', '/new.ts', 'new.ts')
    expect(useAppStore.getState().tabs[0]).toEqual({
      type: 'file', path: '/new.ts', name: 'new.ts', isDirty: false,
    })
    expect(useAppStore.getState().activeTabId).toBe('/new.ts')
  })

  it('remove tabs by directory path → removes children', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/src/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file', path: '/other/c.ts', name: 'c.ts', isDirty: false },
      ],
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].path).toBe('/other/c.ts')
  })
})

describe('Integration — message flow chain', () => {
  it('append messages → upsert middle → remove last → verify order', () => {
    useAppStore.getState().appendMessage(mkMsg({ id: 'm1', content: 'First' }))
    useAppStore.getState().appendMessage(mkMsg({ id: 'm2', content: 'Second' }))
    useAppStore.getState().appendMessage(mkMsg({ id: 'm3', content: 'Third' }))
    expect(useAppStore.getState().messages).toHaveLength(3)

    useAppStore.getState().upsertMessage('m2', mkMsg({ id: 'm2', content: 'Updated' }))
    expect(useAppStore.getState().messages[1].content).toBe('Updated')

    useAppStore.getState().removeMessage('m3')
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages.map((m) => m.content)).toEqual(['First', 'Updated'])
  })

  it('clearAllMessages → messages array empty', () => {
    useAppStore.getState().appendMessage(mkMsg({ id: 'm1' }))
    useAppStore.getState().appendMessage(mkMsg({ id: 'm2' }))
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('updateRunningTool → marks last running tool done → can update next', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 't1', role: 'tool', content: '', toolName: 'read', toolStatus: 'running',
    }))
    useAppStore.getState().appendMessage(mkMsg({
      id: 't2', role: 'tool', content: '', toolName: 'write', toolStatus: 'running',
    }))

    // First call updates the LAST running tool (t2, reversed find)
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'write result' })
    expect(useAppStore.getState().messages[1].toolStatus).toBe('done')
    expect(useAppStore.getState().messages[1].toolOutput).toBe('write result')
    expect(useAppStore.getState().messages[0].toolStatus).toBe('running')

    // Second call updates the remaining running tool (t1)
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'read result' })
    expect(useAppStore.getState().messages[0].toolStatus).toBe('done')
  })
})

describe('Integration — workspace and file operations', () => {
  it('set workspace → set file nodes → clear workspace', () => {
    useAppStore.getState().setWorkspace('/project', [
      { name: 'src', path: '/project/src', isDirectory: true } as FileNode,
    ])
    expect(useAppStore.getState().workspacePath).toBe('/project')
    expect(useAppStore.getState().fileNodes).toHaveLength(1)

    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })

  it('open file tab with workspace → file tab opens → rename updates reference', () => {
    useAppStore.getState().setWorkspace('/project', [])
    useAppStore.getState().openFileTab({ name: 'index.ts', path: '/project/index.ts', isDirectory: false } as any)
    expect(useAppStore.getState().tabs).toHaveLength(1)

    useAppStore.getState().renameTabPaths('/project/index.ts', '/project/main.ts', 'main.ts')
    expect(useAppStore.getState().tabs[0].path).toBe('/project/main.ts')
  })
})

describe('Integration — settings and preferences', () => {
  it('change settings → persists → read back', () => {
    useAppStore.getState().setSettings({
      ...useAppStore.getState().settings,
      apiKey: 'new-key',
      defaultModel: 'claude-3',
    })
    expect(useAppStore.getState().settings.apiKey).toBe('new-key')
    expect(useAppStore.getState().settings.defaultModel).toBe('claude-3')
  })

  it('toggle zen mode → sidebar hidden → toggle back', () => {
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })

  it('toggle terminal → height preserved', () => {
    useAppStore.getState().setTerminalHeight('400px')
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    expect(useAppStore.getState().terminalHeight).toBe('400px')
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
    expect(useAppStore.getState().terminalHeight).toBe('400px')
  })
})

describe('Integration — todo operations flow', () => {
  it('add todos → update one → remove one → verify remaining', () => {
    useAppStore.getState().addTodo({ id: 't1', text: 'First task', completed: false, sessionId: 's1', createdAt: 0 } as any)
    useAppStore.getState().addTodo({ id: 't2', text: 'Second task', completed: false, sessionId: 's1', createdAt: 1 } as any)
    useAppStore.getState().addTodo({ id: 't3', text: 'Third task', completed: false, sessionId: 's1', createdAt: 2 } as any)

    useAppStore.getState().updateTodo('t2', { completed: true })
    expect(useAppStore.getState().todos[1].completed).toBe(true)

    useAppStore.getState().removeTodo('t1')
    expect(useAppStore.getState().todos).toHaveLength(2)
    expect(useAppStore.getState().todos[0].text).toBe('Second task')
    expect(useAppStore.getState().todos[1].text).toBe('Third task')
  })

  it('setTodos replaces all → clear → empty', () => {
    useAppStore.getState().addTodo({ id: 't1', text: 'A', completed: false, sessionId: 's1', createdAt: 0 } as any)
    useAppStore.getState().setTodos([
      { id: 't2', text: 'B', completed: true, sessionId: 's1', createdAt: 1 },
      { id: 't3', text: 'C', completed: false, sessionId: 's1', createdAt: 2 },
    ] as any[])
    expect(useAppStore.getState().todos).toHaveLength(2)
    expect(useAppStore.getState().todos[0].text).toBe('B')

    useAppStore.getState().setTodos([])
    expect(useAppStore.getState().todos).toHaveLength(0)
  })
})

describe('Integration — git and commit operations', () => {
  it('set commits → select commit → clear', () => {
    useAppStore.getState().setCommits([
      { hash: 'abc', message: 'First commit', author: 'T', date: '' },
      { hash: 'def', message: 'Second commit', author: 'T', date: '' },
    ] as any[])
    expect(useAppStore.getState().commits).toHaveLength(2)

    useAppStore.getState().setActiveCommit('abc')
    expect(useAppStore.getState().activeCommit).toBe('abc')

    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })

  it('git loading toggle', () => {
    useAppStore.getState().setGitLoading(true)
    expect(useAppStore.getState().gitLoading).toBe(true)
    useAppStore.getState().setGitLoading(false)
    expect(useAppStore.getState().gitLoading).toBe(false)
  })
})

describe('Integration — recent projects', () => {
  it('add project → add another → clear', () => {
    useAppStore.getState().setRecentProjects(['/project1'])
    expect(useAppStore.getState().recentProjects).toEqual(['/project1'])

    useAppStore.getState().setRecentProjects(['/project1', '/project2'])
    expect(useAppStore.getState().recentProjects).toEqual(['/project1', '/project2'])

    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toEqual([])
  })
})

describe('Integration — side chat flow', () => {
  it('open side chat → send messages → close side chat', () => {
    useAppStore.getState().setSideChat('sc1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc1')

    useAppStore.getState().appendSideChatMessage({ id: 'm1', content: 'Hi', role: 'user' } as any)
    useAppStore.getState().appendSideChatMessage({ id: 'm2', content: 'Hello!', role: 'assistant' } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(2)

    useAppStore.getState().upsertSideChatMessage('m2', { id: 'm2', content: 'Hello! How can I help?', role: 'assistant' } as any)
    expect(useAppStore.getState().sideChatMessages[1].content).toBe('Hello! How can I help?')

    useAppStore.getState().removeSideChatMessage('m1')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)

    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
    useAppStore.getState().setSideChatMessages([])
    expect(useAppStore.getState().sideChatMessages).toHaveLength(0)
  })
})

describe('Integration — session group operations', () => {
  it('create group → assign session → rename group → remove group', () => {
    const gid = useAppStore.getState().addSessionGroup('Work')
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Task 1' })],
    })
    useAppStore.getState().setSessionGroup('s1', gid)
    expect(useAppStore.getState().sessions[0].group).toBe(gid)

    useAppStore.getState().renameSessionGroup(gid, 'Personal')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('Personal')

    useAppStore.getState().removeSessionGroup(gid)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })
})
