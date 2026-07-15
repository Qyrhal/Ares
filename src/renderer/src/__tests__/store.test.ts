import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, SessionGroup, Message, Todo, Tab, FileNode } from '@/types'

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

function mkTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 't1', sessionId: 's1', text: 'Do something',
    completed: false, createdAt: 0, ...overrides,
  }
}

function mkFileNode(overrides: Partial<FileNode> = {}): FileNode {
  return {
    name: 'test.ts', path: '/test.ts', type: 'file', ...overrides,
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
  })
})

// ── Todo actions ──────────────────────────────────────────────────────────────

describe('store — setTodos', () => {
  it('replaces todos array', () => {
    const todos = [mkTodo({ id: 't1' }), mkTodo({ id: 't2' })]
    useAppStore.getState().setTodos(todos)
    expect(useAppStore.getState().todos).toHaveLength(2)
  })

  it('clears todos when set to empty', () => {
    useAppStore.getState().setTodos([mkTodo()])
    useAppStore.getState().setTodos([])
    expect(useAppStore.getState().todos).toHaveLength(0)
  })
})

describe('store — addTodo', () => {
  it('appends a todo to the list', () => {
    useAppStore.getState().addTodo(mkTodo({ id: 't1' }))
    useAppStore.getState().addTodo(mkTodo({ id: 't2' }))
    expect(useAppStore.getState().todos).toHaveLength(2)
  })

  it('preserves existing todos', () => {
    useAppStore.getState().setTodos([mkTodo({ id: 't1', text: 'first' })])
    useAppStore.getState().addTodo(mkTodo({ id: 't2', text: 'second' }))
    const { todos } = useAppStore.getState()
    expect(todos[0].text).toBe('first')
    expect(todos[1].text).toBe('second')
  })
})

describe('store — updateTodo', () => {
  it('toggles completed flag', () => {
    useAppStore.getState().setTodos([mkTodo({ id: 't1', completed: false })])
    useAppStore.getState().updateTodo('t1', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(true)
  })

  it('updates text', () => {
    useAppStore.getState().setTodos([mkTodo({ id: 't1', text: 'old text' })])
    useAppStore.getState().updateTodo('t1', { text: 'new text' })
    expect(useAppStore.getState().todos[0].text).toBe('new text')
  })

  it('only updates matching todo', () => {
    useAppStore.getState().setTodos([
      mkTodo({ id: 't1', completed: false }),
      mkTodo({ id: 't2', completed: false }),
    ])
    useAppStore.getState().updateTodo('t1', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(true)
    expect(useAppStore.getState().todos[1].completed).toBe(false)
  })

  it('ignores unknown id', () => {
    useAppStore.getState().setTodos([mkTodo({ id: 't1' })])
    useAppStore.getState().updateTodo('unknown', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(false)
  })
})

describe('store — removeTodo', () => {
  it('removes a todo by id', () => {
    useAppStore.getState().setTodos([mkTodo({ id: 't1' }), mkTodo({ id: 't2' })])
    useAppStore.getState().removeTodo('t1')
    const { todos } = useAppStore.getState()
    expect(todos).toHaveLength(1)
    expect(todos[0].id).toBe('t2')
  })

  it('no-ops when id not found', () => {
    useAppStore.getState().setTodos([mkTodo({ id: 't1' })])
    useAppStore.getState().removeTodo('ghost')
    expect(useAppStore.getState().todos).toHaveLength(1)
  })
})

// ── Session actions ───────────────────────────────────────────────────────────

describe('store — setSessions', () => {
  it('replaces sessions array', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1' }), mkSession({ id: 's2' })])
    expect(useAppStore.getState().sessions).toHaveLength(2)
  })

  it('clears sessions when set to empty', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    useAppStore.getState().setSessions([])
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })
})

describe('store — removeSession', () => {
  it('removes a session by id', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1' }), mkSession({ id: 's2' })])
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(1)
    expect(useAppStore.getState().sessions[0].id).toBe('s2')
  })

  it('no-ops when id not found', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    useAppStore.getState().removeSession('ghost')
    expect(useAppStore.getState().sessions).toHaveLength(1)
  })
})

describe('store — appendMessage', () => {
  it('appends a message to the list', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2' }))
    expect(useAppStore.getState().messages).toHaveLength(2)
  })

  it('preserves existing messages', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1', content: 'first' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2', content: 'second' }))
    expect(useAppStore.getState().messages[0].content).toBe('first')
    expect(useAppStore.getState().messages[1].content).toBe('second')
  })
})

describe('store — removeMessage', () => {
  it('removes first message', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' }), mkMessage({ id: 'm3' })] })
    useAppStore.getState().removeMessage('m1')
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[0].id).toBe('m2')
  })

  it('removes middle message', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' }), mkMessage({ id: 'm3' })] })
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[0].id).toBe('m1')
    expect(useAppStore.getState().messages[1].id).toBe('m3')
  })

  it('removes last message', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })] })
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('no-ops when id not found', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' })] })
    useAppStore.getState().removeMessage('ghost')
    expect(useAppStore.getState().messages).toHaveLength(1)
  })
})

describe('store — setMessages', () => {
  it('replaces messages array', () => {
    useAppStore.getState().setMessages([mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })])
    expect(useAppStore.getState().messages).toHaveLength(2)
  })
})

describe('store — updateSession agentStatus', () => {
  it('sets agentStatus to running', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1', agentStatus: 'idle' })])
    useAppStore.getState().updateSession('s1', { agentStatus: 'running' })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('running')
  })

  it('sets agentStatus to done', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1', agentStatus: 'running' })])
    useAppStore.getState().updateSession('s1', { agentStatus: 'done' })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('done')
  })

  it('sets agentStatus to error', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    useAppStore.getState().updateSession('s1', { agentStatus: 'error' })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('error')
  })

  it('syncs tab title when title is patched', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Old' })],
      tabs: [{ type: 'session', id: 's1', title: 'Old' }],
    })
    useAppStore.getState().updateSession('s1', { title: 'New Title' })
    expect(useAppStore.getState().tabs[0]).toMatchObject({ type: 'session', title: 'New Title' })
  })

  it('does not affect other sessions', () => {
    useAppStore.getState().setSessions([
      mkSession({ id: 's1', agentStatus: 'idle' }),
      mkSession({ id: 's2', agentStatus: 'idle' }),
    ])
    useAppStore.getState().updateSession('s1', { agentStatus: 'running' })
    expect(useAppStore.getState().sessions[1].agentStatus).toBe('idle')
  })
})

describe('store — togglePinSession', () => {
  it('pins an unpinned session', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1', pinned: false })])
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions[0].pinned).toBe(true)
  })

  it('unpins a pinned session', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1', pinned: true })])
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions[0].pinned).toBe(false)
  })
})

// ── Tab actions ───────────────────────────────────────────────────────────────

describe('store — openSessionTab', () => {
  it('adds session tab and sets activeTabId', () => {
    const session = mkSession({ id: 's1', title: 'Chat' })
    useAppStore.getState().openSessionTab(session)
    const { tabs, activeTabId } = useAppStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ type: 'session', id: 's1', title: 'Chat' })
    expect(activeTabId).toBe('s1')
  })

  it('does not duplicate when session tab already exists', () => {
    const session = mkSession({ id: 's1' })
    useAppStore.getState().openSessionTab(session)
    useAppStore.getState().openSessionTab(session)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('switches activeView to chat', () => {
    useAppStore.setState({ activeView: 'settings' })
    useAppStore.getState().openSessionTab(mkSession())
    expect(useAppStore.getState().activeView).toBe('chat')
  })
})

describe('store — closeTab', () => {
  function makeSessionTab(id: string): Tab {
    return { type: 'session', id, title: id }
  }

  it('removes the tab', () => {
    useAppStore.setState({ tabs: [makeSessionTab('s1'), makeSessionTab('s2')], activeTabId: 's2' })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('falls back to adjacent tab when closing active tab', () => {
    useAppStore.setState({
      tabs: [makeSessionTab('s1'), makeSessionTab('s2'), makeSessionTab('s3')],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    const { activeTabId, tabs } = useAppStore.getState()
    expect(tabs).toHaveLength(2)
    // Should fall back to s3 (same position) or s1 (prior)
    expect(['s1', 's3']).toContain(activeTabId)
  })

  it('sets activeTabId to null when last tab is closed', () => {
    useAppStore.setState({ tabs: [makeSessionTab('s1')], activeTabId: 's1' })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().activeTabId).toBeNull()
    expect(useAppStore.getState().tabs).toHaveLength(0)
  })

  it('no-ops when tab id does not exist', () => {
    useAppStore.setState({ tabs: [makeSessionTab('s1')], activeTabId: 's1' })
    useAppStore.getState().closeTab('unknown')
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })
})

describe('store — setTabDirty', () => {
  it('marks a file tab dirty', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/foo.ts', name: 'foo.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/foo.ts', true)
    const tab = useAppStore.getState().tabs[0] as Extract<Tab, { type: 'file' }>
    expect(tab.isDirty).toBe(true)
  })

  it('does not affect session tabs', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Chat' },
        { type: 'file', path: '/foo.ts', name: 'foo.ts', isDirty: false },
      ],
    })
    useAppStore.getState().setTabDirty('/foo.ts', true)
    const sessionTab = useAppStore.getState().tabs[0]
    expect(sessionTab.type).toBe('session')
  })
})

describe('store — renameTabPaths', () => {
  it('renames exact file path', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/src/old.ts', name: 'old.ts', isDirty: false }],
      activeTabId: '/src/old.ts',
    })
    useAppStore.getState().renameTabPaths('/src/old.ts', '/src/new.ts', 'new.ts')
    const tab = useAppStore.getState().tabs[0] as Extract<Tab, { type: 'file' }>
    expect(tab.path).toBe('/src/new.ts')
    expect(tab.name).toBe('new.ts')
    expect(useAppStore.getState().activeTabId).toBe('/src/new.ts')
  })

  it('renames tabs with paths under a renamed directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/components/Button.tsx', name: 'Button.tsx', isDirty: false },
        { type: 'file', path: '/src/components/Input.tsx', name: 'Input.tsx', isDirty: false },
      ],
      activeTabId: null,
    })
    useAppStore.getState().renameTabPaths('/src/components', '/src/ui', 'ui')
    const tabs = useAppStore.getState().tabs as Extract<Tab, { type: 'file' }>[]
    expect(tabs[0].path).toBe('/src/ui/Button.tsx')
    expect(tabs[1].path).toBe('/src/ui/Input.tsx')
  })
})

describe('store — removeTabsByPath', () => {
  it('removes exact file tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/old.ts', name: 'old.ts', isDirty: false },
        { type: 'session', id: 's1', title: 'Chat' },
      ],
      activeTabId: 's1',
    })
    useAppStore.getState().removeTabsByPath('/src/old.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].type).toBe('session')
  })

  it('removes all tabs under a directory when isDir=true', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/components/Button.tsx', name: 'Button.tsx', isDirty: false },
        { type: 'file', path: '/src/components/Input.tsx', name: 'Input.tsx', isDirty: false },
        { type: 'file', path: '/src/App.tsx', name: 'App.tsx', isDirty: false },
      ],
      activeTabId: '/src/App.tsx',
    })
    useAppStore.getState().removeTabsByPath('/src/components', true)
    const tabs = useAppStore.getState().tabs as Extract<Tab, { type: 'file' }>[]
    expect(tabs).toHaveLength(1)
    expect(tabs[0].path).toBe('/src/App.tsx')
  })

  it('no-ops when no matching tabs', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/src/keep.ts', name: 'keep.ts', isDirty: false }],
    })
    const before = useAppStore.getState().tabs.length
    useAppStore.getState().removeTabsByPath('/src/remove.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(before)
  })
})

// ── Message actions ───────────────────────────────────────────────────────────

describe('store — upsertMessage', () => {
  it('appends when id does not exist', () => {
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1' }))
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('replaces when id exists', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1', content: 'old' })] })
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'updated' }))
    const { messages } = useAppStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('updated')
  })
})

describe('store — updateRunningTool', () => {
  it('patches the last running tool message', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', role: 'tool', toolStatus: 'running', toolName: 'readFile' }),
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    const msg = useAppStore.getState().messages[0]
    expect(msg.toolStatus).toBe('done')
    expect(msg.toolOutput).toBe('result')
  })

  it('targets only the last running tool, not earlier ones', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', role: 'tool', toolStatus: 'running', toolName: 'first' }),
        mkMessage({ id: 'm2', role: 'tool', toolStatus: 'running', toolName: 'second' }),
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    const msgs = useAppStore.getState().messages
    expect(msgs[0].toolStatus).toBe('running')
    expect(msgs[1].toolStatus).toBe('done')
  })

  it('no-ops when no running tool exists', () => {
    useAppStore.setState({
      messages: [mkMessage({ id: 'm1', role: 'assistant', content: 'hi' })],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[0].toolStatus).toBeUndefined()
  })
})

// ── Session group actions ─────────────────────────────────────────────────────

describe('store — addSessionGroup', () => {
  it('adds a session group with generated id and createdAt', () => {
    const id = useAppStore.getState().addSessionGroup('Research')
    const groups = useAppStore.getState().sessionGroups
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe(id)
    expect(groups[0].name).toBe('Research')
    expect(groups[0].createdAt).toBeGreaterThan(0)
  })

  it('adds multiple groups', () => {
    useAppStore.getState().addSessionGroup('A')
    useAppStore.getState().addSessionGroup('B')
    expect(useAppStore.getState().sessionGroups).toHaveLength(2)
  })

  it('returns a unique id each call', () => {
    const id1 = useAppStore.getState().addSessionGroup('G1')
    const id2 = useAppStore.getState().addSessionGroup('G2')
    expect(id1).not.toBe(id2)
  })
})

describe('store — renameSessionGroup', () => {
  it('renames a group by id', () => {
    const id = useAppStore.getState().addSessionGroup('Old')
    useAppStore.getState().renameSessionGroup(id, 'New')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('New')
  })

  it('does not affect other groups', () => {
    const id1 = useAppStore.getState().addSessionGroup('G1')
    useAppStore.getState().addSessionGroup('G2')
    useAppStore.getState().renameSessionGroup(id1, 'Renamed')
    expect(useAppStore.getState().sessionGroups[1].name).toBe('G2')
  })

  it('no-ops when id is unknown', () => {
    useAppStore.getState().addSessionGroup('Existing')
    useAppStore.getState().renameSessionGroup('ghost', 'Whatever')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
    expect(useAppStore.getState().sessionGroups[0].name).toBe('Existing')
  })
})

describe('store — removeSessionGroup', () => {
  it('removes a group by id', () => {
    const id = useAppStore.getState().addSessionGroup('Research')
    useAppStore.getState().removeSessionGroup(id)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })

  it('removes only the specified group', () => {
    useAppStore.getState().addSessionGroup('A')
    const idB = useAppStore.getState().addSessionGroup('B')
    useAppStore.getState().addSessionGroup('C')
    useAppStore.getState().removeSessionGroup(idB)
    expect(useAppStore.getState().sessionGroups).toHaveLength(2)
    expect(useAppStore.getState().sessionGroups.map((g) => g.name)).toEqual(['A', 'C'])
  })

  it('ungroups sessions that belonged to the removed group', () => {
    const gid = useAppStore.getState().addSessionGroup('Research')
    useAppStore.getState().setSessions([
      mkSession({ id: 's1', group: gid }),
      mkSession({ id: 's2', group: gid }),
      mkSession({ id: 's3' }),
    ])
    useAppStore.getState().removeSessionGroup(gid)
    const sessions = useAppStore.getState().sessions
    expect(sessions[0].group).toBeUndefined()
    expect(sessions[1].group).toBeUndefined()
    expect(sessions[2].group).toBeUndefined()
  })

  it('no-ops when id is unknown', () => {
    useAppStore.getState().addSessionGroup('Existing')
    useAppStore.getState().removeSessionGroup('ghost')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
  })
})

describe('store — setSessionGroup', () => {
  it('assigns a session to a group', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    const gid = useAppStore.getState().addSessionGroup('Features')
    useAppStore.getState().setSessionGroup('s1', gid)
    expect(useAppStore.getState().sessions[0].group).toBe(gid)
  })

  it('moves a session to another group', () => {
    const gid1 = useAppStore.getState().addSessionGroup('A')
    const gid2 = useAppStore.getState().addSessionGroup('B')
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid1 })])
    useAppStore.getState().setSessionGroup('s1', gid2)
    expect(useAppStore.getState().sessions[0].group).toBe(gid2)
  })

  it('ungroups a session when groupId is null', () => {
    const gid = useAppStore.getState().addSessionGroup('Features')
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid })])
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })

  it('no-ops when session id is unknown', () => {
    const gid = useAppStore.getState().addSessionGroup('Features')
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    useAppStore.getState().setSessionGroup('ghost', gid)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })
})

// ── UI actions ──────────────────────────────────────────────────────────────

describe('store — setActiveView', () => {
  it('sets active view to chat', () => {
    useAppStore.getState().setActiveView('chat')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('sets active view to explorer', () => {
    useAppStore.getState().setActiveView('explorer')
    expect(useAppStore.getState().activeView).toBe('explorer')
  })

  it('sets active view to git', () => {
    useAppStore.getState().setActiveView('git')
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('sets active view to settings', () => {
    useAppStore.getState().setActiveView('settings')
    expect(useAppStore.getState().activeView).toBe('settings')
  })
})

describe('store — toggleTerminal', () => {
  it('toggles terminal from false to true', () => {
    useAppStore.setState({ terminalOpen: false })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('toggles terminal from true to false', () => {
    useAppStore.setState({ terminalOpen: true })
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })
})

describe('store — toggleZenMode', () => {
  it('toggles zen mode from false to true', () => {
    useAppStore.setState({ zenMode: false })
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
  })

  it('toggles zen mode from true to false', () => {
    useAppStore.setState({ zenMode: true })
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

describe('store — setTerminalHeight', () => {
  it('sets terminal height', () => {
    useAppStore.getState().setTerminalHeight('300px')
    expect(useAppStore.getState().terminalHeight).toBe('300px')
  })

  it('updates terminal height from existing value', () => {
    useAppStore.setState({ terminalHeight: '200px' })
    useAppStore.getState().setTerminalHeight('400px')
    expect(useAppStore.getState().terminalHeight).toBe('400px')
  })
})

// ── Tab actions (continued) ────────────────────────────────────────────────

describe('store — openFileTab', () => {
  it('adds file tab and sets activeTabId', () => {
    const node = mkFileNode({ name: 'App.tsx', path: '/src/App.tsx' })
    useAppStore.getState().openFileTab(node)
    const { tabs, activeTabId } = useAppStore.getState()
    expect(tabs).toHaveLength(1)
    const tab = tabs[0] as Extract<Tab, { type: 'file' }>
    expect(tab.type).toBe('file')
    expect(tab.path).toBe('/src/App.tsx')
    expect(tab.name).toBe('App.tsx')
    expect(tab.isDirty).toBe(false)
    expect(activeTabId).toBe('/src/App.tsx')
  })

  it('does not duplicate when file tab already exists', () => {
    const node = mkFileNode({ path: '/src/App.tsx' })
    useAppStore.getState().openFileTab(node)
    useAppStore.getState().openFileTab(node)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('does not add duplicate tab with same path and different name', () => {
    useAppStore.getState().openFileTab(mkFileNode({ path: '/src/App.tsx', name: 'App.tsx' }))
    useAppStore.getState().openFileTab(mkFileNode({ path: '/src/App.tsx', name: 'App.jsx' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })
})

describe('store — selectTab', () => {
  it('activates a session tab and switches view to chat', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'Chat' }],
      activeTabId: null,
      activeView: 'explorer',
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeTabId).toBe('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('activates a file tab without changing activeView', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/test.ts', name: 'test.ts', isDirty: false }],
      activeTabId: null,
      activeView: 'explorer',
    })
    useAppStore.getState().selectTab('/test.ts')
    expect(useAppStore.getState().activeTabId).toBe('/test.ts')
    expect(useAppStore.getState().activeView).toBe('explorer')
  })

  it('sets activeTabId to unknown id when tab does not exist', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'Chat' }],
      activeTabId: 's1',
      activeView: 'chat',
    })
    useAppStore.getState().selectTab('ghost')
    // selectTab always sets activeTabId to the given id
    expect(useAppStore.getState().activeTabId).toBe('ghost')
    // but does not change activeView since no session tab was found
    expect(useAppStore.getState().activeView).toBe('chat')
  })
})

// ── Session actions (continued) ────────────────────────────────────────────

describe('store — addSession', () => {
  it('prepends a session to the list', () => {
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    useAppStore.getState().addSession(mkSession({ id: 's2' }))
    const { sessions } = useAppStore.getState()
    expect(sessions).toHaveLength(2)
    expect(sessions[0].id).toBe('s2')
  })

  it('adds session to empty list', () => {
    useAppStore.getState().addSession(mkSession({ id: 's1' }))
    expect(useAppStore.getState().sessions).toHaveLength(1)
    expect(useAppStore.getState().sessions[0].id).toBe('s1')
  })

  it('preserves existing sessions', () => {
    useAppStore.getState().addSession(mkSession({ id: 's1', title: 'first' }))
    useAppStore.getState().addSession(mkSession({ id: 's2', title: 'second' }))
    expect(useAppStore.getState().sessions[0].title).toBe('second')
    expect(useAppStore.getState().sessions[1].title).toBe('first')
  })
})

describe('store — clearAllMessages', () => {
  it('clears all messages and sets isLoading to false', () => {
    useAppStore.setState({ messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })], isLoading: true })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
    expect(useAppStore.getState().isLoading).toBe(false)
  })

  it('no-ops when already empty', () => {
    useAppStore.setState({ messages: [], isLoading: false })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

// ── Message actions (continued) ────────────────────────────────────────────

describe('store — setLoading', () => {
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

// ── Git actions ────────────────────────────────────────────────────────────

describe('store — setCommits', () => {
  it('replaces commits array', () => {
    useAppStore.getState().setCommits([
      { hash: 'abc123', shortHash: 'abc123', parents: [], author: 'me', date: '2024-01-01', message: 'Initial' },
    ])
    expect(useAppStore.getState().commits).toHaveLength(1)
    expect(useAppStore.getState().commits[0].hash).toBe('abc123')
  })

  it('clears commits when set to empty', () => {
    useAppStore.getState().setCommits([{ hash: 'abc', shortHash: 'abc', parents: [], author: '', date: '', message: '' }])
    useAppStore.getState().setCommits([])
    expect(useAppStore.getState().commits).toHaveLength(0)
  })
})

describe('store — setActiveCommit', () => {
  it('sets active commit hash', () => {
    useAppStore.getState().setActiveCommit('abc123')
    expect(useAppStore.getState().activeCommit).toBe('abc123')
  })

  it('clears active commit with null', () => {
    useAppStore.setState({ activeCommit: 'abc123' })
    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })
})

describe('store — setGitLoading', () => {
  it('sets git loading to true', () => {
    useAppStore.getState().setGitLoading(true)
    expect(useAppStore.getState().gitLoading).toBe(true)
  })

  it('sets git loading to false', () => {
    useAppStore.setState({ gitLoading: true })
    useAppStore.getState().setGitLoading(false)
    expect(useAppStore.getState().gitLoading).toBe(false)
  })
})

// ── Workspace actions ──────────────────────────────────────────────────────

describe('store — setWorkspace', () => {
  it('sets workspace path and file nodes', () => {
    const nodes = [mkFileNode({ name: 'src', path: '/project/src', type: 'directory' })]
    useAppStore.getState().setWorkspace('/project', nodes)
    expect(useAppStore.getState().workspacePath).toBe('/project')
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
    expect(useAppStore.getState().fileNodes[0].name).toBe('src')
  })

  it('sets workspace path to null with empty nodes', () => {
    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })
})

describe('store — setFileNodes', () => {
  it('replaces file nodes array', () => {
    const nodes = [mkFileNode({ name: 'App.tsx', path: '/src/App.tsx' })]
    useAppStore.getState().setFileNodes(nodes)
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
    expect(useAppStore.getState().fileNodes[0].name).toBe('App.tsx')
  })

  it('clears file nodes when set to empty', () => {
    useAppStore.getState().setFileNodes([mkFileNode()])
    useAppStore.getState().setFileNodes([])
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })
})

describe('store — setRecentProjects', () => {
  it('replaces recent projects array', () => {
    useAppStore.getState().setRecentProjects(['/project/a', '/project/b'])
    expect(useAppStore.getState().recentProjects).toHaveLength(2)
    expect(useAppStore.getState().recentProjects[0]).toBe('/project/a')
  })

  it('clears recent projects when set to empty', () => {
    useAppStore.getState().setRecentProjects(['/project/a'])
    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toHaveLength(0)
  })
})

// ── Settings actions ────────────────────────────────────────────────────────

describe('store — setSettings', () => {
  it('replaces settings object', () => {
    useAppStore.getState().setSettings({
      apiKey: 'sk-test',
      apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      themeId: 'blue',
      systemPrompt: 'Be helpful',
      permissionMode: 'auto',
    })
    expect(useAppStore.getState().settings.defaultModel).toBe('gpt-4o')
    expect(useAppStore.getState().settings.themeId).toBe('blue')
  })

  it('persists previous settings for unset fields', () => {
    // Reset to clean defaults first
    useAppStore.setState({
      settings: {
        apiKey: '',
        apiBaseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
        themeId: 'red',
        systemPrompt: '',
        permissionMode: 'ask',
      },
    })
    useAppStore.getState().setSettings({ ...useAppStore.getState().settings, defaultModel: 'gpt-4o-mini' })
    expect(useAppStore.getState().settings.defaultModel).toBe('gpt-4o-mini')
    expect(useAppStore.getState().settings.permissionMode).toBe('ask')
  })
})

// ── Deleted message actions ────────────────────────────────────────────────

describe('store — setLastDeletedMessage', () => {
  it('stores a deleted message', () => {
    const msg = mkMessage({ id: 'm1', content: 'deleted content' })
    useAppStore.getState().setLastDeletedMessage(msg)
    expect(useAppStore.getState().lastDeletedMessage).toEqual(msg)
  })

  it('replaces previous deleted message', () => {
    useAppStore.getState().setLastDeletedMessage(mkMessage({ id: 'm1' }))
    const msg2 = mkMessage({ id: 'm2', content: 'second deletion' })
    useAppStore.getState().setLastDeletedMessage(msg2)
    expect(useAppStore.getState().lastDeletedMessage?.id).toBe('m2')
  })

  it('clears deleted message when set to null', () => {
    useAppStore.getState().setLastDeletedMessage(mkMessage({ id: 'm1' }))
    useAppStore.getState().setLastDeletedMessage(null)
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })
})

describe('store — clearLastDeletedMessage', () => {
  it('clears the last deleted message', () => {
    useAppStore.getState().setLastDeletedMessage(mkMessage({ id: 'm1' }))
    useAppStore.getState().clearLastDeletedMessage()
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })

  it('no-ops when already null', () => {
    useAppStore.setState({ lastDeletedMessage: null })
    useAppStore.getState().clearLastDeletedMessage()
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })
})

// ── Side Chat actions ─────────────────────────────────────────────────────

describe('store — setSideChat', () => {
  it('sets side chat session id', () => {
    useAppStore.getState().setSideChat('sc-1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc-1')
  })

  it('clears side chat with null', () => {
    useAppStore.setState({ sideChatSessionId: 'sc-1' })
    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })
})

describe('store — setSideChatMessages', () => {
  it('replaces side chat messages array', () => {
    const msgs = [mkMessage({ id: 'sm1' }), mkMessage({ id: 'sm2' })]
    useAppStore.getState().setSideChatMessages(msgs)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(2)
    expect(useAppStore.getState().sideChatMessages[0].id).toBe('sm1')
  })

  it('clears side chat messages when set to empty', () => {
    useAppStore.setState({ sideChatMessages: [mkMessage({ id: 'sm1' })] })
    useAppStore.getState().setSideChatMessages([])
    expect(useAppStore.getState().sideChatMessages).toHaveLength(0)
  })
})

describe('store — setSideChatLoading', () => {
  it('sets side chat loading to true', () => {
    useAppStore.getState().setSideChatLoading(true)
    expect(useAppStore.getState().sideChatIsLoading).toBe(true)
  })

  it('sets side chat loading to false', () => {
    useAppStore.setState({ sideChatIsLoading: true })
    useAppStore.getState().setSideChatLoading(false)
    expect(useAppStore.getState().sideChatIsLoading).toBe(false)
  })
})
