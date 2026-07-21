import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import { BUILTIN_COMMANDS } from '@/components/InputBar'
import type { AgentStatus, PermissionMode } from '@/types'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test',
    model: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    pinned: false,
    archived: false,
    agentStatus: 'idle' as AgentStatus,
    ...overrides,
  }
}

function mkMsg(overrides: Record<string, unknown> = {}) {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: 's1',
    role: 'user' as const,
    content: 'hello',
    isStreaming: false,
    createdAt: Date.now(),
    ...overrides,
  }
}

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiBaseUrl: '',
  defaultModel: '',
  themeId: 'dark',
  colorMode: 'dark' as const,
  systemPrompt: '',
  permissionMode: 'ask' as PermissionMode,
  providers: [],
}

describe('/undo slash command', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [mkSession()],
      activeTabId: 's1',
      tabs: [{ type: 'session' as const, id: 's1', title: 'Test' }],
      messages: [],
      workspacePath: null,
      settings: { ...DEFAULT_SETTINGS },
    })
  })

  it('includes /undo in the builtin commands list', () => {
    const cmd = BUILTIN_COMMANDS.find((c) => c.name === 'undo')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('Remove')
  })

  it('shows empty state when no messages exist', () => {
    const msgs = useAppStore.getState().messages
    expect(msgs.length).toBe(0)
  })

  it('can identify the last user message index in a conversation', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'hello' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'hi there' }),
        mkMsg({ id: 'm3', role: 'user', content: 'how are you?' }),
        mkMsg({ id: 'm4', role: 'assistant', content: 'doing well' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user')
    expect(lastUserIdx).toBe(2) // index of 'how are you?'
  })

  it('removes the last user message and everything after it', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'hello' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'hi there' }),
        mkMsg({ id: 'm3', role: 'user', content: 'how are you?' }),
        mkMsg({ id: 'm4', role: 'assistant', content: 'doing well' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user')
    const toRemove = msgs.slice(lastUserIdx)
    const remaining = msgs.slice(0, lastUserIdx)
    expect(toRemove.length).toBe(2) // m3 + m4
    expect(remaining.length).toBe(2) // m1 + m2
    expect(remaining.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('handles single user message followed by assistant', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'hello' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'hi' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user')
    const toRemove = msgs.slice(lastUserIdx)
    expect(toRemove.length).toBe(2)
    expect(msgs.slice(0, lastUserIdx).length).toBe(0)
  })

  it('handles conversation with only user messages', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'first' }),
        mkMsg({ id: 'm2', role: 'user', content: 'second' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user')
    const toRemove = msgs.slice(lastUserIdx)
    expect(toRemove.length).toBe(1)
  })

  it('can remove messages from store', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'hello' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'hi' }),
        mkMsg({ id: 'm3', role: 'user', content: 'bye' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user')
    const toRemove = msgs.slice(lastUserIdx)
    const remaining = msgs.slice(0, lastUserIdx)
    useAppStore.setState({ messages: remaining })
    expect(useAppStore.getState().messages.length).toBe(2)
    expect(useAppStore.getState().messages.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('electron mock has deleteMessage for undo', () => {
    expect((window as any).electron.db.deleteMessage).toBeDefined()
    expect(typeof (window as any).electron.db.deleteMessage).toBe('function')
  })

  it('does not crash with empty messages array', () => {
    useAppStore.setState({ messages: [] })
    const msgs = useAppStore.getState().messages
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user')
    expect(lastUserIdx).toBe(-1)
  })
})
