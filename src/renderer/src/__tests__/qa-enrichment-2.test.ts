import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import { parseMessage, parseSession, parseSettings } from '@/schemas'
import type { Session, Message } from '@/types'

// ── Schema parsing edge cases ────────────────────────────────────────────────

describe('parseSession — notes field', () => {
  it('maps notes to the Session object', () => {
    const raw = { id: 's1', title: 'T', model: 'm', created_at: 1, updated_at: 2, notes: 'my notes' }
    const s = parseSession(raw)
    expect(s.notes).toBe('my notes')
  })

  it('defaults notes to undefined when absent', () => {
    const raw = { id: 's1', title: 'T', model: 'm', created_at: 1, updated_at: 2 }
    const s = parseSession(raw)
    expect(s.notes).toBeUndefined()
  })

  it('preserves empty string notes', () => {
    const raw = { id: 's1', title: 'T', model: 'm', created_at: 1, updated_at: 2, notes: '' }
    const s = parseSession(raw)
    expect(s.notes).toBe('')
  })
})

describe('parseSession — isSideChat field', () => {
  it('defaults to false when absent', () => {
    const raw = { id: 's1', title: 'T', model: 'm', created_at: 1, updated_at: 2 }
    expect(parseSession(raw).isSideChat).toBe(false)
  })

  it('parses is_side_chat: true', () => {
    const raw = { id: 's1', title: 'T', model: 'm', created_at: 1, updated_at: 2, is_side_chat: true }
    expect(parseSession(raw).isSideChat).toBe(true)
  })
})

describe('parseMessage — all optional fields combined', () => {
  it('parses a fully-populated assistant message', () => {
    const raw = {
      id: 'm1', session_id: 's1', role: 'assistant', content: 'Hello',
      created_at: Date.now(),
      tool_name: 'web_search', tool_status: 'done', tool_input: '{"q":"test"}', tool_output: 'result',
      thinking: 'I should search...', reply_to: '{"id":"m0","content":"hi","role":"user"}',
      reactions: '{"up":true}', feedback: 'positive', attachments: '[{"path":"file.ts"}]',
    }
    const msg = parseMessage(raw)
    expect(msg.toolName).toBe('web_search')
    expect(msg.toolStatus).toBe('done')
    expect(msg.toolInput).toBe('{"q":"test"}')
    expect(msg.toolOutput).toBe('result')
    expect(msg.thinking).toBe('I should search...')
    expect(msg.replyTo).toEqual({ id: 'm0', content: 'hi', role: 'user' })
    expect(msg.reactions).toEqual({ up: true })
    expect(msg.feedback).toBe('positive')
    expect(msg.attachments).toEqual([{ path: 'file.ts' }])
  })

  it('parses a minimal message with no optional fields', () => {
    const raw = { id: 'm1', session_id: 's1', role: 'user', content: 'Hi', created_at: Date.now() }
    const msg = parseMessage(raw)
    expect(msg.toolName).toBeUndefined()
    expect(msg.toolStatus).toBeUndefined()
    expect(msg.toolInput).toBeUndefined()
    expect(msg.toolOutput).toBeUndefined()
    expect(msg.thinking).toBeUndefined()
    expect(msg.replyTo).toBeUndefined()
    expect(msg.reactions).toBeUndefined()
    expect(msg.feedback).toBeUndefined()
    expect(msg.attachments).toBeUndefined()
  })

  it('handles null optional fields (DB returns null)', () => {
    const raw = {
      id: 'm1', session_id: 's1', role: 'assistant', content: 'ok',
      created_at: Date.now(),
      tool_name: null, tool_status: null, tool_input: null, tool_output: null,
      thinking: null, reply_to: null, reactions: null, feedback: null, attachments: null,
    }
    const msg = parseMessage(raw)
    expect(msg.toolName).toBeUndefined()
    expect(msg.replyTo).toBeUndefined()
    expect(msg.reactions).toBeUndefined()
    expect(msg.attachments).toBeUndefined()
  })
})

describe('parseSettings — legacy migration', () => {
  it('migrates legacy apiBaseUrl into providers when providers is empty', () => {
    const raw = {
      apiKey: 'sk-test', apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o', themeId: 'steel', colorMode: 'dark',
      systemPrompt: '', permissionMode: 'ask',
    }
    const settings = parseSettings(raw)
    expect(settings.providers).toHaveLength(1)
    expect(settings.providers[0].baseUrl).toBe('https://api.openai.com/v1')
    expect(settings.providers[0].label).toBe('Default')
  })

  it('does not migrate when providers already exist', () => {
    const raw = {
      apiKey: 'sk-test', apiBaseUrl: 'https://api.openai.com/v1',
      providers: [{ id: 'custom', label: 'Custom', baseUrl: 'https://custom.api/v1', apiKey: 'sk-custom' }],
      defaultModel: 'gpt-4o', themeId: 'steel', colorMode: 'dark',
      systemPrompt: '', permissionMode: 'ask',
    }
    const settings = parseSettings(raw)
    expect(settings.providers).toHaveLength(1)
    expect(settings.providers[0].id).toBe('custom')
  })

  it('does not migrate when apiBaseUrl is empty', () => {
    const raw = {
      apiKey: 'sk-test', apiBaseUrl: '',
      defaultModel: 'gpt-4o', themeId: 'steel', colorMode: 'dark',
      systemPrompt: '', permissionMode: 'ask',
    }
    const settings = parseSettings(raw)
    expect(settings.providers).toHaveLength(0)
  })
})

// ── Store edge cases ─────────────────────────────────────────────────────────

describe('Store — updateRunningTool edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] })
  })

  it('no-ops when there are no tool messages', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: 1 },
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[0].toolStatus).toBeUndefined()
  })

  it('updates the LAST running tool when multiple exist', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'tool', content: '', toolStatus: 'running', createdAt: 1 },
        { id: 'm2', sessionId: 's1', role: 'tool', content: '', toolStatus: 'running', createdAt: 2 },
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done', toolOutput: 'result' })
    const msgs = useAppStore.getState().messages
    expect(msgs[0].toolStatus).toBe('running')
    expect(msgs[1].toolStatus).toBe('done')
    expect(msgs[1].toolOutput).toBe('result')
  })
})

describe('Store — removeTabsByPath edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/project/src/index.ts', name: 'index.ts', isDirty: false },
        { type: 'file', path: '/project/src/utils.ts', name: 'utils.ts', isDirty: false },
        { type: 'file', path: '/project/README.md', name: 'README.md', isDirty: false },
        { type: 'session', id: 's1', title: 'Session', isDirty: false },
      ],
      activeTabId: 'file:/project/src/index.ts',
    })
  })

  it('does not remove tabs when path does not match', () => {
    useAppStore.getState().removeTabsByPath('/other/file.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(4)
  })

  it('removes only the matching file when isDir is false', () => {
    useAppStore.getState().removeTabsByPath('/project/README.md', false)
    expect(useAppStore.getState().tabs).toHaveLength(3)
    expect(useAppStore.getState().tabs.find((t) => t.type === 'file' && t.path === '/project/README.md')).toBeUndefined()
  })

  it('removes directory children when isDir is true', () => {
    useAppStore.getState().removeTabsByPath('/project/src', true)
    const remaining = useAppStore.getState().tabs
    expect(remaining).toHaveLength(2)
    expect(remaining.find((t) => t.type === 'file' && t.path.startsWith('/project/src/'))).toBeUndefined()
  })
})

describe('Store — renameTabPaths edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/project/old-name.ts', name: 'old-name.ts', isDirty: false },
        { type: 'file', path: '/project/src/utils.ts', name: 'utils.ts', isDirty: false },
      ],
      activeTabId: null,
    })
  })

  it('renames the tab name and path for exact match', () => {
    useAppStore.getState().renameTabPaths('/project/old-name.ts', '/project/new-name.ts', 'new-name.ts')
    const tab = useAppStore.getState().tabs[0]
    expect(tab.type).toBe('file')
    if (tab.type === 'file') {
      expect(tab.path).toBe('/project/new-name.ts')
      expect(tab.name).toBe('new-name.ts')
    }
  })

  it('does not affect tabs outside the renamed directory', () => {
    useAppStore.getState().renameTabPaths('/project/other', '/project/renamed', 'renamed')
    const tabs = useAppStore.getState().tabs
    expect(tabs[0].type).toBe('file')
    if (tabs[0].type === 'file') expect(tabs[0].path).toBe('/project/old-name.ts')
  })
})

describe('Store — selectTab with activeView', () => {
  beforeEach(() => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Session', isDirty: false },
        { type: 'file', path: '/file.ts', name: 'file.ts', isDirty: false },
      ],
      activeTabId: null,
      activeView: 'git' as any,
    })
  })

  it('switches to chat view when selecting a session tab', () => {
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeTabId).toBe('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('keeps current view when selecting a file tab', () => {
    useAppStore.getState().selectTab('file:/file.ts')
    expect(useAppStore.getState().activeTabId).toBe('file:/file.ts')
    expect(useAppStore.getState().activeView).toBe('git')
  })
})

describe('Store — closeTab fallback behavior', () => {
  it('sets activeTabId to the right neighbor when closing the first tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().closeTab('/a.ts')
    expect(useAppStore.getState().activeTabId).toBe('/b.ts')
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('sets activeTabId to null when closing the only tab', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/only.ts', name: 'only.ts', isDirty: false }],
      activeTabId: '/only.ts',
    })
    useAppStore.getState().closeTab('/only.ts')
    expect(useAppStore.getState().activeTabId).toBeNull()
    expect(useAppStore.getState().tabs).toHaveLength(0)
  })
})

// ── Session group edge cases ─────────────────────────────────────────────────

describe('Store — sessionGroup cascade on remove', () => {
  it('removes all sessions in the deleted group', () => {
    const gid = useAppStore.getState().addSessionGroup('My Group')
    useAppStore.setState({
      sessions: [
        { id: 's1', title: 'S1', model: 'm', createdAt: 1, updatedAt: 2, messageCount: 0, group: gid },
        { id: 's2', title: 'S2', model: 'm', createdAt: 1, updatedAt: 2, messageCount: 0, group: gid },
        { id: 's3', title: 'S3', model: 'm', createdAt: 1, updatedAt: 2, messageCount: 0, group: undefined },
      ],
    })
    useAppStore.getState().removeSessionGroup(gid)
    const sessions = useAppStore.getState().sessions
    expect(sessions.find((s) => s.id === 's1')?.group).toBeUndefined()
    expect(sessions.find((s) => s.id === 's2')?.group).toBeUndefined()
    expect(sessions.find((s) => s.id === 's3')?.group).toBeUndefined()
    expect(useAppStore.getState().sessionGroups.find((g) => g.id === gid)).toBeUndefined()
  })
})

// ── Todo edge cases ──────────────────────────────────────────────────────────

describe('Store — todo operations edge cases', () => {
  beforeEach(() => {
    useAppStore.setState({ todos: [] })
  })

  it('addTodo appends with the provided id', () => {
    useAppStore.getState().addTodo({ id: 't1', sessionId: 's1', text: 'A', completed: false, createdAt: 1 })
    useAppStore.getState().addTodo({ id: 't2', sessionId: 's1', text: 'B', completed: false, createdAt: 2 })
    expect(useAppStore.getState().todos).toHaveLength(2)
    expect(useAppStore.getState().todos[0].id).toBe('t1')
    expect(useAppStore.getState().todos[1].id).toBe('t2')
  })

  it('updateTodo no-ops for non-existent id', () => {
    useAppStore.getState().addTodo({ id: 'existing', sessionId: 's1', text: 'A', completed: false, createdAt: 1 })
    useAppStore.getState().updateTodo('nonexistent', { completed: true })
    expect(useAppStore.getState().todos[0].completed).toBe(false)
  })

  it('removeTodo no-ops for non-existent id', () => {
    useAppStore.getState().addTodo({ id: 'existing', sessionId: 's1', text: 'A', completed: false, createdAt: 1 })
    useAppStore.getState().removeTodo('nonexistent')
    expect(useAppStore.getState().todos).toHaveLength(1)
  })
})

// ── Side chat edge cases ─────────────────────────────────────────────────────

describe('Store — side chat message operations', () => {
  beforeEach(() => {
    useAppStore.setState({ sideChatMessages: [] })
  })

  it('appendSideChatMessage adds messages in order', () => {
    const msg1: Message = { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: 1 }
    const msg2: Message = { id: 'm2', sessionId: 's1', role: 'assistant', content: 'B', createdAt: 2 }
    useAppStore.getState().appendSideChatMessage(msg1)
    useAppStore.getState().appendSideChatMessage(msg2)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(2)
    expect(useAppStore.getState().sideChatMessages[0].id).toBe('m1')
    expect(useAppStore.getState().sideChatMessages[1].id).toBe('m2')
  })

  it('upsertSideChatMessage replaces existing message', () => {
    const msg: Message = { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: 1 }
    useAppStore.getState().appendSideChatMessage(msg)
    useAppStore.getState().upsertSideChatMessage('m1', { ...msg, content: 'Updated' })
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('Updated')
  })

  it('upsertSideChatMessage appends new message when not found', () => {
    const msg: Message = { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: 1 }
    useAppStore.getState().upsertSideChatMessage('m1', msg)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('removeSideChatMessage removes by id', () => {
    const msg1: Message = { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: 1 }
    const msg2: Message = { id: 'm2', sessionId: 's1', role: 'assistant', content: 'B', createdAt: 2 }
    useAppStore.getState().appendSideChatMessage(msg1)
    useAppStore.getState().appendSideChatMessage(msg2)
    useAppStore.getState().removeSideChatMessage('m1')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
    expect(useAppStore.getState().sideChatMessages[0].id).toBe('m2')
  })

  it('removeSideChatMessage no-ops for non-existent id', () => {
    useAppStore.getState().removeSideChatMessage('nonexistent')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(0)
  })
})

// ── Session toggle archive with tab updates ──────────────────────────────────

describe('Store — toggleArchiveSession preserves tab link', () => {
  it('archives a session that has an open tab', () => {
    useAppStore.setState({
      sessions: [{ id: 's1', title: 'S', model: 'm', createdAt: 1, updatedAt: 2, messageCount: 0, archived: false }],
      tabs: [{ type: 'session', id: 's1', title: 'S', isDirty: false }],
      activeTabId: 'session:s1',
    })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
    expect(useAppStore.getState().tabs[0].type).toBe('session')
  })
})

// ── Settings edge cases ──────────────────────────────────────────────────────

describe('Store — setSettings deep merges', () => {
  it('replaces settings entirely', () => {
    useAppStore.setState({
      settings: { apiKey: '', apiBaseUrl: '', providers: [], defaultModel: 'old', themeId: 'old', colorMode: 'dark', systemPrompt: '', permissionMode: 'ask' },
    })
    useAppStore.getState().setSettings({
      apiKey: 'new', apiBaseUrl: 'http://new', providers: [],
      defaultModel: 'new', themeId: 'new', colorMode: 'light', systemPrompt: 'hello', permissionMode: 'yolo',
    })
    const s = useAppStore.getState().settings
    expect(s.defaultModel).toBe('new')
    expect(s.themeId).toBe('new')
    expect(s.colorMode).toBe('light')
    expect(s.systemPrompt).toBe('hello')
    expect(s.permissionMode).toBe('yolo')
  })
})

// ── Prompt history dedup logic ───────────────────────────────────────────────

describe('Store — prompt history dedup and cap', () => {
  beforeEach(() => {
    useAppStore.setState({ promptHistory: [], promptHistoryIdx: -1 })
  })

  it('does not dedup non-consecutive identical prompts', () => {
    const { addPromptToHistory } = useAppStore.getState()
    addPromptToHistory('A')
    addPromptToHistory('B')
    addPromptToHistory('A')
    expect(useAppStore.getState().promptHistory).toEqual(['A', 'B', 'A'])
  })

  it('caps at 100 and evicts oldest', () => {
    const { addPromptToHistory } = useAppStore.getState()
    for (let i = 0; i < 150; i++) addPromptToHistory(`p-${i}`)
    const h = useAppStore.getState().promptHistory
    expect(h.length).toBe(100)
    expect(h[0]).toBe('p-149')
    expect(h[99]).toBe('p-50')
  })

  it('resetPromptHistoryIdx resets to -1', () => {
    const { addPromptToHistory, navigatePromptHistory, resetPromptHistoryIdx } = useAppStore.getState()
    addPromptToHistory('x')
    navigatePromptHistory('up')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
    resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })
})

// ── Message interactions ─────────────────────────────────────────────────────

describe('Store — message ordering after multiple operations', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] })
  })

  it('append → upsert middle → remove last → verify order', () => {
    const m1: Message = { id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: 1 }
    const m2: Message = { id: 'm2', sessionId: 's1', role: 'assistant', content: 'B', createdAt: 2 }
    const m3: Message = { id: 'm3', sessionId: 's1', role: 'user', content: 'C', createdAt: 3 }

    useAppStore.getState().appendMessage(m1)
    useAppStore.getState().appendMessage(m2)
    useAppStore.getState().appendMessage(m3)

    // Upsert m2 with updated content
    useAppStore.getState().upsertMessage('m2', { ...m2, content: 'B-updated' })

    // Remove last
    useAppStore.getState().removeMessage('m3')

    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toBe('A')
    expect(msgs[1].content).toBe('B-updated')
  })
})

describe('Store — clearAllMessages also resets isLoading', () => {
  it('clears loading state when clearing messages', () => {
    useAppStore.setState({
      messages: [{ id: 'm1', sessionId: 's1', role: 'user', content: 'A', createdAt: 1 }],
      isLoading: true,
    })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})
