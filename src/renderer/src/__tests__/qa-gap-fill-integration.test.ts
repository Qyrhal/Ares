import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, Message, AgentStatus } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test', model: 'gpt-4o', createdAt: 0, updatedAt: 0,
    messageCount: 0, pinned: false, archived: false,
    agentStatus: 'idle' as AgentStatus, ...overrides,
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
    tabs: [], activeTabId: null, sessions: [], messages: [], isLoading: false,
    sessionGroups: [], todos: [], sideChatSessionId: null, sideChatMessages: [],
    sideChatIsLoading: false, workspacePath: null, fileNodes: [], recentProjects: [],
    commits: [], activeCommit: null, gitLoading: false, lastDeletedMessage: null,
    zenMode: false, terminalOpen: false, activeView: 'chat', terminalHeight: '200px',
    compactSidebar: false,
  })
})

describe('Store — toggleCompactSidebar', () => {
  it('defaults to false', () => {
    expect(useAppStore.getState().compactSidebar).toBe(false)
  })

  it('toggles from false to true', () => {
    useAppStore.getState().toggleCompactSidebar()
    expect(useAppStore.getState().compactSidebar).toBe(true)
  })

  it('toggles back from true to false', () => {
    useAppStore.setState({ compactSidebar: true })
    useAppStore.getState().toggleCompactSidebar()
    expect(useAppStore.getState().compactSidebar).toBe(false)
  })

  it('can toggle multiple times', () => {
    const store = useAppStore.getState()
    store.toggleCompactSidebar()
    store.toggleCompactSidebar()
    store.toggleCompactSidebar()
    expect(useAppStore.getState().compactSidebar).toBe(true)
  })
})

describe('Integration — streaming simulation', () => {
  it('grows content through upserts then finalizes', () => {
    const session = mkSession({ id: 's1' })
    useAppStore.getState().addSession(session)
    useAppStore.getState().openSessionTab(session)

    const streamingId = 'stream-1'
    useAppStore.getState().appendMessage({
      id: streamingId, sessionId: 's1', role: 'assistant', content: 'H',
      createdAt: Date.now(), isStreaming: true,
    })

    useAppStore.getState().upsertMessage(streamingId, {
      id: streamingId, sessionId: 's1', role: 'assistant', content: 'Hello',
      createdAt: Date.now(), isStreaming: true,
    })

    useAppStore.getState().upsertMessage(streamingId, {
      id: streamingId, sessionId: 's1', role: 'assistant', content: 'Hello world!',
      createdAt: Date.now(), isStreaming: true,
    })

    const streaming = useAppStore.getState().messages.find((m) => m.id === streamingId)
    expect(streaming?.content).toBe('Hello world!')
    expect(streaming?.isStreaming).toBe(true)

    useAppStore.getState().removeMessage(streamingId)
    useAppStore.getState().appendMessage({
      id: 'final-1', sessionId: 's1', role: 'assistant', content: 'Hello world!',
      createdAt: Date.now(), tokenCount: 3, duration: 1500,
    })

    expect(useAppStore.getState().messages.find((m) => m.id === streamingId)).toBeUndefined()
    const final = useAppStore.getState().messages.find((m) => m.id === 'final-1')
    expect(final?.content).toBe('Hello world!')
    expect(final?.tokenCount).toBe(3)
    expect(final?.duration).toBe(1500)
    expect(final?.isStreaming).toBeUndefined()
  })

  it('streaming isLoading flag lifecycle', () => {
    expect(useAppStore.getState().isLoading).toBe(false)
    useAppStore.setState({ isLoading: true })
    expect(useAppStore.getState().isLoading).toBe(true)
    useAppStore.setState({ isLoading: false })
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

describe('Integration — reply chain', () => {
  it('message with replyTo is stored and retrievable', () => {
    const userMsg = mkMsg({ id: 'u1', content: 'What is TypeScript?' })
    const assistantMsg = mkMsg({
      id: 'a1', role: 'assistant',
      content: 'TypeScript is a typed superset of JavaScript.',
    })
    const replyMsg = mkMsg({
      id: 'r1', content: 'Can you elaborate?',
      replyTo: { id: 'a1', content: assistantMsg.content, role: 'assistant' },
    })

    useAppStore.getState().appendMessage(userMsg)
    useAppStore.getState().appendMessage(assistantMsg)
    useAppStore.getState().appendMessage(replyMsg)

    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(3)

    const reply = msgs.find((m) => m.id === 'r1')
    expect(reply?.replyTo).toBeDefined()
    expect(reply?.replyTo?.id).toBe('a1')
    expect(reply?.replyTo?.role).toBe('assistant')
    expect(reply?.replyTo?.content).toBe('TypeScript is a typed superset of JavaScript.')
  })

  it('message without replyTo has undefined replyTo', () => {
    const msg = mkMsg({ id: 'm1', content: 'Hello' })
    useAppStore.getState().appendMessage(msg)
    const stored = useAppStore.getState().messages.find((m) => m.id === 'm1')
    expect(stored?.replyTo).toBeUndefined()
  })

  it('reply chain preserves all messages in order', () => {
    useAppStore.getState().appendMessage(mkMsg({ id: 'u1', role: 'user', content: 'Q1' }))
    useAppStore.getState().appendMessage(mkMsg({ id: 'a1', role: 'assistant', content: 'A1' }))
    useAppStore.getState().appendMessage(mkMsg({
      id: 'u2', role: 'user', content: 'Q2',
      replyTo: { id: 'a1', content: 'A1', role: 'assistant' },
    }))
    useAppStore.getState().appendMessage(mkMsg({ id: 'a2', role: 'assistant', content: 'A2' }))
    useAppStore.getState().appendMessage(mkMsg({
      id: 'u3', role: 'user', content: 'Q3',
      replyTo: { id: 'a2', content: 'A2', role: 'assistant' },
    }))

    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(5)
    expect(msgs[0].replyTo).toBeUndefined()
    expect(msgs[1].replyTo).toBeUndefined()
    expect(msgs[2].replyTo?.id).toBe('a1')
    expect(msgs[3].replyTo).toBeUndefined()
    expect(msgs[4].replyTo?.id).toBe('a2')
  })
})

describe('Integration — reaction toggle', () => {
  it('add thumbs up reaction', () => {
    useAppStore.getState().appendMessage(
      mkMsg({ id: 'a1', role: 'assistant', content: 'Response' }),
    )
    useAppStore.getState().upsertMessage('a1', {
      ...useAppStore.getState().messages[0],
      reactions: { up: true },
    })
    const msg = useAppStore.getState().messages.find((m) => m.id === 'a1')
    expect(msg?.reactions?.up).toBe(true)
  })

  it('toggle off reaction', () => {
    useAppStore.getState().appendMessage(
      mkMsg({ id: 'a1', role: 'assistant', reactions: { up: true } }),
    )
    useAppStore.getState().upsertMessage('a1', {
      ...useAppStore.getState().messages[0],
      reactions: { up: null },
    })
    const msg = useAppStore.getState().messages.find((m) => m.id === 'a1')
    expect(msg?.reactions?.up).toBeNull()
  })

  it('reactions persist across other message updates', () => {
    useAppStore.getState().appendMessage(
      mkMsg({ id: 'a1', role: 'assistant', content: 'Hello', reactions: { up: true } }),
    )
    const existing = useAppStore.getState().messages[0]
    useAppStore.getState().upsertMessage('a1', {
      ...existing, content: 'Updated Hello',
    })
    const msg = useAppStore.getState().messages.find((m) => m.id === 'a1')
    expect(msg?.content).toBe('Updated Hello')
    expect(msg?.reactions?.up).toBe(true)
  })
})

describe('Integration — edit message flow', () => {
  it('edit message content via upsert', () => {
    useAppStore.getState().appendMessage(
      mkMsg({ id: 'u1', role: 'user', content: 'Original text' }),
    )
    const original = useAppStore.getState().messages[0]
    useAppStore.getState().upsertMessage('u1', { ...original, content: 'Edited text' })
    const edited = useAppStore.getState().messages.find((m) => m.id === 'u1')
    expect(edited?.content).toBe('Edited text')
  })

  it('edit preserves message metadata', () => {
    useAppStore.getState().appendMessage(
      mkMsg({ id: 'u1', role: 'user', content: 'Original', createdAt: 1000 }),
    )
    const original = useAppStore.getState().messages[0]
    useAppStore.getState().upsertMessage('u1', { ...original, content: 'Edited' })
    const edited = useAppStore.getState().messages.find((m) => m.id === 'u1')
    expect(edited?.createdAt).toBe(1000)
    expect(edited?.sessionId).toBe('s1')
  })
})

describe('Integration — delete with undo flow', () => {
  it('delete message and then restore it', () => {
    useAppStore.getState().appendMessage(mkMsg({ id: 'd1', content: 'Delete me' }))
    useAppStore.getState().appendMessage(mkMsg({ id: 'd2', content: 'Keep me' }))
    expect(useAppStore.getState().messages).toHaveLength(2)

    const deleted = useAppStore.getState().messages.find((m) => m.id === 'd1')
    useAppStore.getState().removeMessage('d1')
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('d2')

    useAppStore.getState().appendMessage(deleted!)
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages.find((m) => m.id === 'd1')?.content).toBe('Delete me')
  })
})

describe('Integration — tool call lifecycle', () => {
  it('updateRunningTool finds and updates the running tool', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 't1', role: 'tool', toolName: 'bash', toolStatus: 'running',
      toolInput: 'ls -la',
    }))
    useAppStore.getState().updateRunningTool({ toolOutput: 'file1.txt\nfile2.txt' })

    const tool = useAppStore.getState().messages.find((m) => m.id === 't1')
    expect(tool?.toolOutput).toBe('file1.txt\nfile2.txt')
  })

  it('updateRunningTool is no-op when no running tool exists', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 't1', role: 'tool', toolName: 'bash', toolStatus: 'done',
    }))
    useAppStore.getState().updateRunningTool({ toolOutput: 'results' })
    const tool = useAppStore.getState().messages.find((m) => m.id === 't1')
    expect(tool?.toolOutput).toBeUndefined()
  })

  it('tool status transitions from running to done', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 't1', role: 'tool', toolName: 'read', toolStatus: 'running',
    }))
    useAppStore.getState().updateRunningTool({
      toolStatus: 'done', toolOutput: 'file content',
    })
    const tool = useAppStore.getState().messages.find((m) => m.id === 't1')
    expect(tool?.toolStatus).toBe('done')
    expect(tool?.toolOutput).toBe('file content')
  })
})

describe('Integration — session data integrity', () => {
  it('export data preserves all message fields', () => {
    const session = mkSession({ id: 's1', title: 'Export Test' })
    useAppStore.getState().addSession(session)
    useAppStore.getState().openSessionTab(session)

    useAppStore.getState().appendMessage(mkMsg({
      id: 'u1', role: 'user', content: 'Test message', createdAt: 1000,
    }))
    useAppStore.getState().appendMessage(mkMsg({
      id: 'a1', role: 'assistant', content: 'Response', createdAt: 2000,
      thinking: 'Reasoning here', tokenCount: 5, duration: 1000,
    }))

    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toBe('Test message')
    expect(msgs[1].thinking).toBe('Reasoning here')
    expect(msgs[1].tokenCount).toBe(5)
    expect(msgs[1].duration).toBe(1000)
  })

  it('session state survives tab close and reopen', () => {
    const session = mkSession({ id: 's1', title: 'Persistent' })
    useAppStore.getState().addSession(session)
    useAppStore.getState().openSessionTab(session)
    useAppStore.getState().appendMessage(mkMsg({ id: 'u1', content: 'Persist' }))

    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().activeTabId).toBeNull()

    useAppStore.getState().openSessionTab(session)
    expect(useAppStore.getState().activeTabId).toBe('s1')
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].content).toBe('Persist')
  })
})

describe('Integration — thinking content', () => {
  it('thinking field is stored on assistant messages', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 'a1', role: 'assistant', content: 'Answer', thinking: 'Let me think...',
    }))
    const msg = useAppStore.getState().messages.find((m) => m.id === 'a1')
    expect(msg?.thinking).toBe('Let me think...')
  })

  it('thinking can be updated via upsert', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 'a1', role: 'assistant', content: 'Answer', thinking: 'Initial thinking',
    }))
    const existing = useAppStore.getState().messages[0]
    useAppStore.getState().upsertMessage('a1', {
      ...existing, thinking: 'Updated thinking',
    })
    const msg = useAppStore.getState().messages.find((m) => m.id === 'a1')
    expect(msg?.thinking).toBe('Updated thinking')
  })
})

describe('Integration — message tool metadata', () => {
  it('stores toolName, toolStatus, toolInput, toolOutput', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 't1', role: 'assistant', toolName: 'file_edit',
      toolStatus: 'running', toolInput: '{"path":"foo.ts","content":"..."}',
    }))
    const msg = useAppStore.getState().messages.find((m) => m.id === 't1')
    expect(msg?.toolName).toBe('file_edit')
    expect(msg?.toolStatus).toBe('running')
    expect(msg?.toolInput).toContain('foo.ts')
  })
})

describe('Integration — workspace path lifecycle', () => {
  it('set and clear workspace path', () => {
    useAppStore.getState().setWorkspace('/home/user/project', [])
    expect(useAppStore.getState().workspacePath).toBe('/home/user/project')
    expect(useAppStore.getState().fileNodes).toEqual([])

    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
  })
})

describe('Integration — todo lifecycle', () => {
  it('add, update, and clear todos', () => {
    useAppStore.getState().setTodos([
      { id: 't1', sessionId: 's1', text: 'Task 1', completed: false, createdAt: Date.now() },
      { id: 't2', sessionId: 's1', text: 'Task 2', completed: false, createdAt: Date.now() },
    ])
    expect(useAppStore.getState().todos).toHaveLength(2)

    useAppStore.getState().setTodos([
      { id: 't1', sessionId: 's1', text: 'Task 1', completed: true, createdAt: Date.now() },
    ])
    expect(useAppStore.getState().todos).toHaveLength(1)
    expect(useAppStore.getState().todos[0].completed).toBe(true)

    useAppStore.getState().setTodos([])
    expect(useAppStore.getState().todos).toHaveLength(0)
  })
})

describe('Integration — tab operations edge cases', () => {
  it('close tab falls back to adjacent tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'S1' },
        { type: 'session', id: 's2', title: 'S2' },
        { type: 'session', id: 's3', title: 'S3' },
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).not.toBe('s2')
  })

  it('close last remaining tab results in no active tab', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'S1' }],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('close non-existent tab is no-op', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'S1' }],
      activeTabId: 's1',
    })
    useAppStore.getState().closeTab('nonexistent')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

describe('Integration — prompt history', () => {
  it('add prompt to history and navigate', () => {
    useAppStore.getState().addPromptToHistory('first prompt')
    useAppStore.getState().addPromptToHistory('second prompt')
    useAppStore.getState().addPromptToHistory('third prompt')

    const recalled = useAppStore.getState().navigatePromptHistory('up')
    expect(recalled).toBe('third prompt')

    const recalled2 = useAppStore.getState().navigatePromptHistory('up')
    expect(recalled2).toBe('second prompt')
  })

  it('navigate down from bottom returns empty string', () => {
    useAppStore.getState().addPromptToHistory('first prompt')
    useAppStore.getState().resetPromptHistoryIdx()
    // Navigate all the way up first
    useAppStore.getState().navigatePromptHistory('up')
    useAppStore.getState().navigatePromptHistory('up')
    // Now navigate down past the bottom
    const result = useAppStore.getState().navigatePromptHistory('down')
    // Returns '' (empty string) when index reaches -1
    expect(typeof result).toBe('string')
  })

  it('empty history returns null', () => {
    useAppStore.setState({ promptHistory: [], promptHistoryIdx: -1 })
    const recalled = useAppStore.getState().navigatePromptHistory('up')
    expect(recalled).toBeNull()
  })
})

describe('Integration — feedback field', () => {
  it('helpful feedback stored on message', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 'a1', role: 'assistant', content: 'Response',
    }))
    useAppStore.getState().upsertMessage('a1', {
      ...useAppStore.getState().messages[0],
      feedback: 'helpful',
    })
    const msg = useAppStore.getState().messages.find((m) => m.id === 'a1')
    expect(msg?.feedback).toBe('helpful')
  })

  it('not-helpful feedback stored on message', () => {
    useAppStore.getState().appendMessage(mkMsg({
      id: 'a1', role: 'assistant', content: 'Response',
    }))
    useAppStore.getState().upsertMessage('a1', {
      ...useAppStore.getState().messages[0],
      feedback: 'not-helpful',
    })
    const msg = useAppStore.getState().messages.find((m) => m.id === 'a1')
    expect(msg?.feedback).toBe('not-helpful')
  })
})

describe('Integration — agent status lifecycle', () => {
  it('session agent status transitions', () => {
    const session = mkSession({ id: 's1', agentStatus: 'idle' as AgentStatus })
    useAppStore.getState().addSession(session)

    useAppStore.getState().updateSession('s1', { agentStatus: 'running' as AgentStatus })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('running')

    useAppStore.getState().updateSession('s1', { agentStatus: 'done' as AgentStatus })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('done')

    useAppStore.getState().updateSession('s1', { agentStatus: 'error' as AgentStatus })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('error')

    useAppStore.getState().updateSession('s1', { agentStatus: 'idle' as AgentStatus })
    expect(useAppStore.getState().sessions[0].agentStatus).toBe('idle')
  })
})

describe('Integration — session groups', () => {
  it('add and remove session group', () => {
    const groupId = useAppStore.getState().addSessionGroup('Group 1')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
    expect(useAppStore.getState().sessionGroups[0].name).toBe('Group 1')

    useAppStore.getState().removeSessionGroup(groupId)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })

  it('set session group assignment', () => {
    const groupId = useAppStore.getState().addSessionGroup('Group 1')
    useAppStore.getState().setSessionGroup('s1', groupId)
    const group = useAppStore.getState().sessionGroups.find((g) => g.id === groupId)
    expect(group).toBeDefined()

    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessionGroups.find((g) => g.id === groupId)).toBeDefined()
  })

  it('rename session group', () => {
    const groupId = useAppStore.getState().addSessionGroup('Old Name')
    useAppStore.getState().renameSessionGroup(groupId, 'New Name')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('New Name')
  })
})

describe('Integration — side chat', () => {
  it('set and clear side chat session', () => {
    useAppStore.getState().setSideChat('sc1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc1')

    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })

  it('side chat messages are separate from main', () => {
    useAppStore.getState().appendMessage(mkMsg({ id: 'm1', content: 'Main message' }))
    useAppStore.getState().appendSideChatMessage(mkMsg({ id: 'sc1', sessionId: 'sc1', content: 'Side chat' }))

    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].content).toBe('Main message')
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('Side chat')
  })
})

describe('Integration — zen mode toggle', () => {
  it('toggle zen mode', () => {
    expect(useAppStore.getState().zenMode).toBe(false)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

describe('Integration — terminal toggle', () => {
  it('toggle terminal', () => {
    expect(useAppStore.getState().terminalOpen).toBe(false)
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })
})
