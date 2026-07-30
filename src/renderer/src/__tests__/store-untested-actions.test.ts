import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { AgentStatus, PermissionMode } from '@/types'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1', title: 'Test', model: '', createdAt: Date.now(),
    updatedAt: Date.now(), messageCount: 0, pinned: false,
    archived: false, agentStatus: 'idle' as AgentStatus,
    ...overrides,
  }
}

// ─── togglePreview ────────────────────────────────────────────────────────

describe('store — togglePreview', () => {
  beforeEach(() => {
    useAppStore.setState({ previewOpen: false, previewUrl: null })
  })

  it('toggles from false to true', () => {
    expect(useAppStore.getState().previewOpen).toBe(false)
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('toggles from true to false', () => {
    useAppStore.setState({ previewOpen: true })
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(false)
  })

  it('toggles multiple times', () => {
    useAppStore.getState().togglePreview()
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(false)
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(true)
  })
})

// ─── setPreviewUrl ────────────────────────────────────────────────────────

describe('store — setPreviewUrl', () => {
  beforeEach(() => {
    useAppStore.setState({ previewOpen: false, previewUrl: null })
  })

  it('sets URL and opens preview', () => {
    useAppStore.getState().setPreviewUrl('http://localhost:3000')
    expect(useAppStore.getState().previewUrl).toBe('http://localhost:3000')
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('sets URL to null and opens preview', () => {
    useAppStore.getState().setPreviewUrl(null)
    expect(useAppStore.getState().previewUrl).toBe(null)
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('overwrites previous URL', () => {
    useAppStore.getState().setPreviewUrl('http://localhost:3000')
    useAppStore.getState().setPreviewUrl('http://localhost:4000')
    expect(useAppStore.getState().previewUrl).toBe('http://localhost:4000')
  })
})

// ─── addPromptToHistory ──────────────────────────────────────────────────

describe('store — addPromptToHistory', () => {
  beforeEach(() => {
    useAppStore.setState({ promptHistory: [], promptHistoryIdx: -1 })
  })

  it('adds prompt to history', () => {
    useAppStore.getState().addPromptToHistory('hello world')
    expect(useAppStore.getState().promptHistory).toEqual(['hello world'])
  })

  it('prepends new prompts (most recent first)', () => {
    useAppStore.getState().addPromptToHistory('first')
    useAppStore.getState().addPromptToHistory('second')
    expect(useAppStore.getState().promptHistory).toEqual(['second', 'first'])
  })

  it('ignores empty prompts', () => {
    useAppStore.getState().addPromptToHistory('')
    useAppStore.getState().addPromptToHistory('   ')
    expect(useAppStore.getState().promptHistory).toEqual([])
  })

  it('deduplicates consecutive identical prompts', () => {
    useAppStore.getState().addPromptToHistory('hello')
    useAppStore.getState().addPromptToHistory('hello')
    expect(useAppStore.getState().promptHistory).toEqual(['hello'])
  })

  it('allows non-consecutive duplicates', () => {
    useAppStore.getState().addPromptToHistory('hello')
    useAppStore.getState().addPromptToHistory('world')
    useAppStore.getState().addPromptToHistory('hello')
    expect(useAppStore.getState().promptHistory).toEqual(['hello', 'world', 'hello'])
  })

  it('caps at 100 entries', () => {
    for (let i = 0; i < 120; i++) {
      useAppStore.getState().addPromptToHistory(`prompt-${i}`)
    }
    expect(useAppStore.getState().promptHistory.length).toBe(100)
    expect(useAppStore.getState().promptHistory[0]).toBe('prompt-119')
    expect(useAppStore.getState().promptHistory[99]).toBe('prompt-20')
  })

  it('resets promptHistoryIdx to -1 on add', () => {
    useAppStore.setState({ promptHistoryIdx: 3 })
    useAppStore.getState().addPromptToHistory('new prompt')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })
})

// ─── navigatePromptHistory ───────────────────────────────────────────────

describe('store — navigatePromptHistory', () => {
  beforeEach(() => {
    useAppStore.setState({
      promptHistory: ['third', 'second', 'first'],
      promptHistoryIdx: -1,
    })
  })

  it('returns null when history is empty', () => {
    useAppStore.setState({ promptHistory: [], promptHistoryIdx: -1 })
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBe(null)
  })

  it('navigates up from start (idx -1 → 0)', () => {
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBe('third')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
  })

  it('navigates up through history', () => {
    useAppStore.getState().navigatePromptHistory('up')
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBe('second')
    expect(useAppStore.getState().promptHistoryIdx).toBe(1)
  })

  it('clamps at the end of history (most recent)', () => {
    useAppStore.setState({ promptHistoryIdx: 2 })
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBe('first')
    expect(useAppStore.getState().promptHistoryIdx).toBe(2)
  })

  it('navigates down from middle', () => {
    useAppStore.setState({ promptHistoryIdx: 1 })
    const result = useAppStore.getState().navigatePromptHistory('down')
    expect(result).toBe('third')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
  })

  it('navigates down to start (idx 0 → -1), returns empty string', () => {
    useAppStore.setState({ promptHistoryIdx: 0 })
    const result = useAppStore.getState().navigatePromptHistory('down')
    expect(result).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('clamps at -1 (already at start)', () => {
    useAppStore.setState({ promptHistoryIdx: -1 })
    const result = useAppStore.getState().navigatePromptHistory('down')
    expect(result).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })
})

// ─── resetPromptHistoryIdx ──────────────────────────────────────────────

describe('store — resetPromptHistoryIdx', () => {
  it('resets idx from positive to -1', () => {
    useAppStore.setState({ promptHistoryIdx: 5 })
    useAppStore.getState().resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('no-op when already -1', () => {
    useAppStore.setState({ promptHistoryIdx: -1 })
    useAppStore.getState().resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })
})

// ─── setSessionFilter ────────────────────────────────────────────────────

describe('store — setSessionFilter', () => {
  beforeEach(() => {
    useAppStore.setState({ sessionFilter: null })
  })

  it('sets a model filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt-4o' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'model', value: 'gpt-4o' })
  })

  it('sets a status filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'status', value: 'running' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'status', value: 'running' })
  })

  it('sets a keyword filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'keyword', value: 'debug' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'keyword', value: 'debug' })
  })

  it('sets a tag filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'tag', value: 'important' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'tag', value: 'important' })
  })

  it('clears filter with null', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt-4o' })
    useAppStore.getState().setSessionFilter(null)
    expect(useAppStore.getState().sessionFilter).toBe(null)
  })
})

// ─── setSessionSort ──────────────────────────────────────────────────────

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

  it('overrides previous sort', () => {
    useAppStore.getState().setSessionSort({ by: 'recent', asc: true })
    useAppStore.getState().setSessionSort({ by: 'name', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'name', asc: false })
  })
})

// ─── setLastExecCommand ─────────────────────────────────────────────────

describe('store — setLastExecCommand', () => {
  beforeEach(() => {
    useAppStore.setState({ lastExecCommand: null })
  })

  it('sets the last exec command', () => {
    useAppStore.getState().setLastExecCommand('npm test')
    expect(useAppStore.getState().lastExecCommand).toBe('npm test')
  })

  it('overwrites previous command', () => {
    useAppStore.getState().setLastExecCommand('npm test')
    useAppStore.getState().setLastExecCommand('npm run build')
    expect(useAppStore.getState().lastExecCommand).toBe('npm run build')
  })
})

// ─── clearAllMessages ────────────────────────────────────────────────────

describe('store — clearAllMessages', () => {
  it('clears messages and resets loading', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', role: 'user', content: 'hi', createdAt: Date.now() },
        { id: 'm2', role: 'assistant', content: 'hello', createdAt: Date.now() },
      ] as any,
      isLoading: true,
    })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toEqual([])
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

// ─── toggleArchiveSession ───────────────────────────────────────────────

describe('store — toggleArchiveSession', () => {
  beforeEach(() => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: false })] })
  })

  it('archives a session', () => {
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
  })

  it('unarchives a session', () => {
    useAppStore.setState({ sessions: [mkSession({ id: 's1', archived: true })] })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(false)
  })

  it('does not affect other sessions', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', archived: false }),
        mkSession({ id: 's2', archived: false }),
      ],
    })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
    expect(useAppStore.getState().sessions[1].archived).toBe(false)
  })
})

// ─── Session group actions ───────────────────────────────────────────────

describe('store — session groups', () => {
  beforeEach(() => {
    useAppStore.setState({ sessionGroups: [], sessions: [] })
  })

  it('addSessionGroup returns an ID and adds group', () => {
    const id = useAppStore.getState().addSessionGroup('My Group')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
    expect(useAppStore.getState().sessionGroups[0].name).toBe('My Group')
  })

  it('renameSessionGroup updates name', () => {
    const id = useAppStore.getState().addSessionGroup('Old Name')
    useAppStore.getState().renameSessionGroup(id, 'New Name')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('New Name')
  })

  it('removeSessionGroup removes group and clears session group assignments', () => {
    const id = useAppStore.getState().addSessionGroup('To Delete')
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', group: id })],
    })
    useAppStore.getState().removeSessionGroup(id)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })

  it('setSessionGroup assigns session to group', () => {
    const id = useAppStore.getState().addSessionGroup('Group A')
    useAppStore.setState({ sessions: [mkSession({ id: 's1' })] })
    useAppStore.getState().setSessionGroup('s1', id)
    expect(useAppStore.getState().sessions[0].group).toBe(id)
  })

  it('setSessionGroup with null removes assignment', () => {
    const id = useAppStore.getState().addSessionGroup('Group A')
    useAppStore.setState({ sessions: [mkSession({ id: 's1', group: id })] })
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })
})

// ─── Side chat actions ──────────────────────────────────────────────────

describe('store — side chat actions', () => {
  beforeEach(() => {
    useAppStore.setState({
      sideChatSessionId: null,
      sideChatMessages: [],
      sideChatIsLoading: false,
    })
  })

  it('setSideChat sets session ID', () => {
    useAppStore.getState().setSideChat('chat-1')
    expect(useAppStore.getState().sideChatSessionId).toBe('chat-1')
  })

  it('setSideChat to null clears session', () => {
    useAppStore.getState().setSideChat('chat-1')
    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBe(null)
  })

  it('setSideChatMessages replaces messages', () => {
    const msgs = [{ id: 'm1', role: 'user', content: 'hi', createdAt: 1 }] as any[]
    useAppStore.getState().setSideChatMessages(msgs)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('setSideChatLoading toggles loading state', () => {
    useAppStore.getState().setSideChatLoading(true)
    expect(useAppStore.getState().sideChatIsLoading).toBe(true)
    useAppStore.getState().setSideChatLoading(false)
    expect(useAppStore.getState().sideChatIsLoading).toBe(false)
  })

  it('appendSideChatMessage adds message', () => {
    useAppStore.getState().appendSideChatMessage({ id: 'm1', role: 'user', content: 'hi', createdAt: 1 } as any)
    useAppStore.getState().appendSideChatMessage({ id: 'm2', role: 'assistant', content: 'hello', createdAt: 2 } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(2)
    expect(useAppStore.getState().sideChatMessages[0].id).toBe('m1')
    expect(useAppStore.getState().sideChatMessages[1].id).toBe('m2')
  })

  it('upsertSideChatMessage replaces existing message', () => {
    useAppStore.getState().appendSideChatMessage({ id: 'm1', role: 'assistant', content: 'hi', createdAt: 1 } as any)
    useAppStore.getState().upsertSideChatMessage('m1', { id: 'm1', role: 'assistant', content: 'updated', createdAt: 1 } as any)
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('updated')
  })

  it('upsertSideChatMessage appends if new', () => {
    useAppStore.getState().upsertSideChatMessage('m1', { id: 'm1', role: 'assistant', content: 'new', createdAt: 1 } as any)
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('removeSideChatMessage removes message', () => {
    useAppStore.getState().appendSideChatMessage({ id: 'm1', role: 'user', content: 'hi', createdAt: 1 } as any)
    useAppStore.getState().removeSideChatMessage('m1')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(0)
  })
})

// ─── Workspace and settings actions ──────────────────────────────────────

describe('store — setRecentProjects', () => {
  it('replaces recent projects list', () => {
    useAppStore.getState().setRecentProjects(['/a', '/b', '/c'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b', '/c'])
  })
})

describe('store — setFileNodes', () => {
  it('replaces file nodes', () => {
    const nodes = [{ name: 'test.ts', path: '/test.ts', type: 'file', children: [] }] as any[]
    useAppStore.getState().setFileNodes(nodes)
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })
})

describe('store — setSettings', () => {
  it('replaces settings', () => {
    const settings = {
      apiKey: 'test', apiBaseUrl: 'http://test', providers: [],
      defaultModel: 'test', themeId: 'dark', colorMode: 'dark' as const,
      systemPrompt: '', permissionMode: 'ask' as PermissionMode,
      planPreviewEnabled: true,
    }
    useAppStore.getState().setSettings(settings)
    expect(useAppStore.getState().settings.apiKey).toBe('test')
  })
})
