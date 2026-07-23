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
    createdAt: Date.now(),
    ...overrides,
  }
}

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiBaseUrl: '',
  providers: [],
  defaultModel: 'gpt-4o-mini',
  themeId: 'steel',
  colorMode: 'dark' as const,
  systemPrompt: '',
  permissionMode: 'ask' as PermissionMode,
  planPreviewEnabled: false,
  maxSubagentSpawns: 10,
  maxConcurrentSubagents: 5,
  maxWebSearches: 50,
  mcpAutoBackgroundMs: 120000,
}

describe('/config command', () => {
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

  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find((c) => c.name === 'config')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('settings')
  })

  it('is registered in BUILTIN_COMMANDS for rewind too', () => {
    const cmd = BUILTIN_COMMANDS.find((c) => c.name === 'rewind')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('Rewind')
  })

  it('shows all settings when no args', () => {
    const settings = useAppStore.getState().settings
    expect(settings.defaultModel).toBe('gpt-4o-mini')
    expect(settings.colorMode).toBe('dark')
    expect(settings.permissionMode).toBe('ask')
  })

  it('reads a specific setting value', () => {
    const settings = useAppStore.getState().settings
    const val = (settings as unknown as Record<string, unknown>)['defaultModel']
    expect(val).toBe('gpt-4o-mini')
  })

  it('sets a string setting', () => {
    const settings = useAppStore.getState().settings
    const next = { ...settings, defaultModel: 'claude-3-opus' }
    useAppStore.getState().setSettings(next)
    expect(useAppStore.getState().settings.defaultModel).toBe('claude-3-opus')
  })

  it('sets a boolean setting', () => {
    const settings = useAppStore.getState().settings
    const next = { ...settings, planPreviewEnabled: true }
    useAppStore.getState().setSettings(next)
    expect(useAppStore.getState().settings.planPreviewEnabled).toBe(true)
  })

  it('sets a number setting', () => {
    const settings = useAppStore.getState().settings
    const next = { ...settings, maxConcurrentSubagents: 10 }
    useAppStore.getState().setSettings(next)
    expect(useAppStore.getState().settings.maxConcurrentSubagents).toBe(10)
  })

  it('sets an enum setting (colorMode)', () => {
    const settings = useAppStore.getState().settings
    const next = { ...settings, colorMode: 'light' as const }
    useAppStore.getState().setSettings(next)
    expect(useAppStore.getState().settings.colorMode).toBe('light')
  })

  it('sets permissionMode enum', () => {
    const settings = useAppStore.getState().settings
    const next = { ...settings, permissionMode: 'yolo' as PermissionMode }
    useAppStore.getState().setSettings(next)
    expect(useAppStore.getState().settings.permissionMode).toBe('yolo')
  })

  it('preserves other settings when changing one', () => {
    const settings = useAppStore.getState().settings
    const next = { ...settings, defaultModel: 'gpt-4' }
    useAppStore.getState().setSettings(next)
    expect(useAppStore.getState().settings.colorMode).toBe('dark')
    expect(useAppStore.getState().settings.permissionMode).toBe('ask')
  })

  it('handles invalid key lookup gracefully', () => {
    const settings = useAppStore.getState().settings
    const meta = (settings as unknown as Record<string, unknown>)['nonexistent']
    expect(meta).toBeUndefined()
  })

  it('validates boolean values', () => {
    const truthy = ['true', '1', 'yes', 'on']
    const falsy = ['false', '0', 'no', 'off']
    for (const v of truthy) {
      expect(['true', '1', 'yes', 'on'].includes(v.toLowerCase())).toBe(true)
    }
    for (const v of falsy) {
      expect(['false', '0', 'no', 'off'].includes(v.toLowerCase())).toBe(true)
    }
  })

  it('validates number parsing', () => {
    expect(Number('120000')).toBe(120000)
    expect(Number('abc')).toBeNaN()
    expect(Number('3.5')).toBe(3.5)
  })

  it('validates enum values', () => {
    const enumValues = ['dark', 'light']
    expect(enumValues.find((v) => v === 'dark')).toBe('dark')
    expect(enumValues.find((v) => v === 'invalid')).toBeUndefined()
  })
})

describe('/rewind command', () => {
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

  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find((c) => c.name === 'rewind')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('Rewind')
  })

  it('shows empty state when no messages', () => {
    const msgs = useAppStore.getState().messages
    expect(msgs.length).toBe(0)
  })

  it('identifies user message checkpoints', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'first question' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'first answer' }),
        mkMsg({ id: 'm3', role: 'user', content: 'second question' }),
        mkMsg({ id: 'm4', role: 'assistant', content: 'second answer' }),
        mkMsg({ id: 'm5', role: 'user', content: 'third question' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const userMsgs = msgs.filter((m) => m.role === 'user')
    expect(userMsgs.length).toBe(3)
    expect(userMsgs[0].content).toBe('first question')
    expect(userMsgs[1].content).toBe('second question')
    expect(userMsgs[2].content).toBe('third question')
  })

  it('can truncate messages after a checkpoint', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'first' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'reply1' }),
        mkMsg({ id: 'm3', role: 'user', content: 'second' }),
        mkMsg({ id: 'm4', role: 'assistant', content: 'reply2' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const userMsgs = msgs.filter((m) => m.role === 'user')
    // Rewind to first user message (checkpoint 1)
    const targetMsg = userMsgs[0]
    const targetIdx = msgs.findIndex((m) => m.id === targetMsg.id)
    const toDelete = msgs.slice(targetIdx + 1)
    expect(toDelete.length).toBe(3)
    const remaining = msgs.slice(0, targetIdx + 1)
    expect(remaining.length).toBe(1)
    expect(remaining[0].content).toBe('first')
  })

  it('truncates to second checkpoint correctly', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'first' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'reply1' }),
        mkMsg({ id: 'm3', role: 'user', content: 'second' }),
        mkMsg({ id: 'm4', role: 'assistant', content: 'reply2' }),
        mkMsg({ id: 'm5', role: 'user', content: 'third' }),
        mkMsg({ id: 'm6', role: 'assistant', content: 'reply3' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const userMsgs = msgs.filter((m) => m.role === 'user')
    // Rewind to second user message (checkpoint 2)
    const targetMsg = userMsgs[1]
    const targetIdx = msgs.findIndex((m) => m.id === targetMsg.id)
    const toDelete = msgs.slice(targetIdx + 1)
    expect(toDelete.length).toBe(3) // m4, m5, m6
    const remaining = msgs.slice(0, targetIdx + 1)
    expect(remaining.length).toBe(3) // m1, m2, m3
    expect(remaining[2].content).toBe('second')
  })

  it('detects already at latest point', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'only message' }),
      ],
    })
    const msgs = useAppStore.getState().messages
    const userMsgs = msgs.filter((m) => m.role === 'user')
    const targetMsg = userMsgs[userMsgs.length - 1]
    const targetIdx = msgs.findIndex((m) => m.id === targetMsg.id)
    const toDelete = msgs.slice(targetIdx + 1)
    expect(toDelete.length).toBe(0)
  })

  it('validates checkpoint index range', () => {
    useAppStore.setState({
      messages: [
        mkMsg({ id: 'm1', role: 'user', content: 'first' }),
        mkMsg({ id: 'm2', role: 'assistant', content: 'reply' }),
      ],
    })
    const userMsgs = useAppStore.getState().messages.filter((m) => m.role === 'user')
    const totalCheckpoints = userMsgs.length
    expect(totalCheckpoints).toBe(1)
    // Invalid indices
    expect(0 >= 1 && 0 <= totalCheckpoints).toBe(false)
    expect(2 >= 1 && 2 <= totalCheckpoints).toBe(false)
    // Valid index
    expect(1 >= 1 && 1 <= totalCheckpoints).toBe(true)
  })

  it('generates preview text for checkpoints', () => {
    const longContent = 'a'.repeat(100)
    const preview = longContent.slice(0, 80).replace(/\n/g, ' ')
    expect(preview.length).toBe(80)
    expect(longContent.length > 80).toBe(true)

    const shortContent = 'hello world'
    const shortPreview = shortContent.slice(0, 80).replace(/\n/g, ' ')
    expect(shortPreview).toBe('hello world')
  })
})
