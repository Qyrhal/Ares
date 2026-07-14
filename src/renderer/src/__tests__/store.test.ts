import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, Message, Todo, Tab } from '@/types'

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

beforeEach(() => {
  useAppStore.setState({
    sessions: [],
    messages: [],
    todos: [],
    tabs: [],
    activeTabId: null,
    activeView: 'chat',
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
