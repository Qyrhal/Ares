import { describe, it, expect } from 'vitest'
import { parseSettings, parseMessage, parseSession, parseTodo } from '@/schemas'

// ── parseSettings ──────────────────────────────────────────────────────────────

describe('parseSettings', () => {
  it('parses a complete settings object', () => {
    const result = parseSettings({
      apiKey: 'sk-123',
      apiBaseUrl: 'https://api.openai.com/v1',
      providers: [{ id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-123' }],
      defaultModel: 'gpt-4o',
      themeId: 'blue',
      colorMode: 'light',
      systemPrompt: 'Be helpful',
      permissionMode: 'auto',
    })
    expect(result.apiKey).toBe('sk-123')
    expect(result.providers).toHaveLength(1)
    expect(result.providers[0].id).toBe('openai')
    expect(result.defaultModel).toBe('gpt-4o')
    expect(result.themeId).toBe('blue')
    expect(result.colorMode).toBe('light')
    expect(result.systemPrompt).toBe('Be helpful')
    expect(result.permissionMode).toBe('auto')
  })

  it('applies defaults for missing fields', () => {
    const result = parseSettings({})
    expect(result.apiKey).toBe('')
    expect(result.apiBaseUrl).toBe('')
    expect(result.providers).toEqual([])
    expect(result.defaultModel).toBe('')
    expect(result.themeId).toBe('steel')
    expect(result.colorMode).toBe('dark')
    expect(result.systemPrompt).toBe('')
    expect(result.permissionMode).toBe('ask')
  })

  it('migrates legacy single endpoint into providers list when providers is empty', () => {
    const result = parseSettings({
      apiBaseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-ant',
      providers: [],
    })
    expect(result.providers).toHaveLength(1)
    expect(result.providers[0].id).toBe('default')
    expect(result.providers[0].label).toBe('Default')
    expect(result.providers[0].baseUrl).toBe('https://api.anthropic.com/v1')
    expect(result.providers[0].apiKey).toBe('sk-ant')
  })

  it('does NOT migrate when providers already has entries', () => {
    const result = parseSettings({
      apiBaseUrl: 'https://api.example.com',
      providers: [{ id: 'my-provider', label: 'Mine', baseUrl: 'https://mine.com', apiKey: 'key' }],
    })
    expect(result.providers).toHaveLength(1)
    expect(result.providers[0].id).toBe('my-provider')
  })

  it('does NOT migrate when apiBaseUrl is empty', () => {
    const result = parseSettings({
      apiBaseUrl: '',
      providers: [],
    })
    expect(result.providers).toEqual([])
  })

  it('does NOT migrate when apiBaseUrl is whitespace only', () => {
    const result = parseSettings({
      apiBaseUrl: '   ',
      providers: [],
    })
    expect(result.providers).toEqual([])
  })

  it('rejects invalid colorMode', () => {
    expect(() => parseSettings({ colorMode: 'red' })).toThrow()
  })

  it('rejects invalid permissionMode', () => {
    expect(() => parseSettings({ permissionMode: 'forced' })).toThrow()
  })

  it('parses multiple providers', () => {
    const result = parseSettings({
      providers: [
        { id: 'p1', label: 'Provider 1', baseUrl: 'https://a.com', apiKey: 'k1' },
        { id: 'p2', label: 'Provider 2', baseUrl: 'https://b.com', apiKey: 'k2' },
      ],
    })
    expect(result.providers).toHaveLength(2)
    expect(result.providers[0].id).toBe('p1')
    expect(result.providers[1].id).toBe('p2')
  })

  it('handles extra fields gracefully (zod strips unknown keys)', () => {
    const result = parseSettings({ apiKey: 'x', extraField: 'ignored' } as any)
    expect(result.apiKey).toBe('x')
    expect((result as any).extraField).toBeUndefined()
  })
})

// ── parseMessage — JSON.parse error branches ───────────────────────────────────

describe('parseMessage — invalid JSON fields', () => {
  it('parses message with valid attachments JSON', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      attachments: '[{"name":"file.ts"}]', created_at: 1000,
    })
    expect(result.attachments).toEqual([{ name: 'file.ts' }])
  })

  it('throws on invalid attachments JSON', () => {
    expect(() => parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      attachments: 'not json', created_at: 1000,
    })).toThrow()
  })

  it('parses message with valid reply_to JSON', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      reply_to: '{"id":"m0","content":"Original","role":"user"}', created_at: 1000,
    })
    expect(result.replyTo).toEqual({ id: 'm0', content: 'Original', role: 'user' })
  })

  it('throws on invalid reply_to JSON', () => {
    expect(() => parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      reply_to: '{broken', created_at: 1000,
    })).toThrow()
  })

  it('parses message with valid reactions JSON', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      reactions: '{"up":true}', created_at: 1000,
    })
    expect(result.reactions).toEqual({ up: true })
  })

  it('throws on invalid reactions JSON', () => {
    expect(() => parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      reactions: 'not json at all', created_at: 1000,
    })).toThrow()
  })

  it('undefined attachments/reply_to/reactions are parsed as undefined', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi', created_at: 1000,
    })
    expect(result.attachments).toBeUndefined()
    expect(result.replyTo).toBeUndefined()
    expect(result.reactions).toBeUndefined()
  })

  it('null attachments/reply_to/reactions are parsed as undefined', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      attachments: null, reply_to: null, reactions: null, created_at: 1000,
    })
    expect(result.attachments).toBeUndefined()
    expect(result.replyTo).toBeUndefined()
    expect(result.reactions).toBeUndefined()
  })

  it('parses all tool-related fields', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'tool', content: '',
      tool_name: 'read', tool_status: 'done',
      tool_input: '{"path":"/test.ts"}', tool_output: 'file content',
      thinking: 'Let me think...', created_at: 1000,
    })
    expect(result.toolName).toBe('read')
    expect(result.toolStatus).toBe('done')
    expect(result.toolInput).toBe('{"path":"/test.ts"}')
    expect(result.toolOutput).toBe('file content')
    expect(result.thinking).toBe('Let me think...')
  })

  it('parses feedback field', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'assistant', content: 'Sure',
      feedback: 'helpful', created_at: 1000,
    })
    expect(result.feedback).toBe('helpful')
  })

  it('tool fields default to undefined when null', () => {
    const result = parseMessage({
      id: 'm1', session_id: 's1', role: 'user', content: 'Hi',
      tool_name: null, tool_status: null, tool_input: null,
      tool_output: null, thinking: null, feedback: null, created_at: 1000,
    })
    expect(result.toolName).toBeUndefined()
    expect(result.toolStatus).toBeUndefined()
    expect(result.toolInput).toBeUndefined()
    expect(result.toolOutput).toBeUndefined()
    expect(result.thinking).toBeUndefined()
    expect(result.feedback).toBeUndefined()
  })
})

// ── parseSession — edge cases ──────────────────────────────────────────────────

describe('parseSession — edge cases', () => {
  it('defaults agentStatus to idle when absent', () => {
    const result = parseSession({ id: 's1', title: 'T', created_at: 0, updated_at: 0 })
    expect(result.agentStatus).toBe('idle')
  })

  it('preserves explicit agentStatus', () => {
    const result = parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0,
      agent_status: 'running',
    })
    expect(result.agentStatus).toBe('running')
  })

  it('maps workspace_path null to undefined', () => {
    const result = parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0,
      workspace_path: null,
    })
    expect(result.workspacePath).toBeUndefined()
  })

  it('maps workspace_path string to workspacePath', () => {
    const result = parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0,
      workspace_path: '/home/user/project',
    })
    expect(result.workspacePath).toBe('/home/user/project')
  })

  it('maps parent_id null to null', () => {
    const result = parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0,
      parent_id: null,
    })
    expect(result.parentId).toBeNull()
  })

  it('maps parent_id string to parentId', () => {
    const result = parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0,
      parent_id: 'parent-1',
    })
    expect(result.parentId).toBe('parent-1')
  })

  it('defaults isSideChat to false when absent', () => {
    const result = parseSession({ id: 's1', title: 'T', created_at: 0, updated_at: 0 })
    expect(result.isSideChat).toBe(false)
  })

  it('preserves notes field', () => {
    const result = parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0,
      notes: 'Some notes',
    })
    expect(result.notes).toBe('Some notes')
  })

  it('notes is undefined when absent', () => {
    const result = parseSession({ id: 's1', title: 'T', created_at: 0, updated_at: 0 })
    expect(result.notes).toBeUndefined()
  })

  it('defaults message_count to 0 when absent', () => {
    const result = parseSession({ id: 's1', title: 'T', created_at: 0, updated_at: 0 })
    expect(result.messageCount).toBe(0)
  })

  it('defaults pinned to false when absent', () => {
    const result = parseSession({ id: 's1', title: 'T', created_at: 0, updated_at: 0 })
    expect(result.pinned).toBe(false)
  })

  it('defaults archived to false when absent', () => {
    const result = parseSession({ id: 's1', title: 'T', created_at: 0, updated_at: 0 })
    expect(result.archived).toBe(false)
  })

  it('rejects invalid effort value', () => {
    expect(() => parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0, effort: 'extreme',
    })).toThrow()
  })

  it('rejects invalid permissionMode value', () => {
    expect(() => parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0, permissionMode: 'forced',
    })).toThrow()
  })

  it('rejects invalid agent_status value', () => {
    expect(() => parseSession({
      id: 's1', title: 'T', created_at: 0, updated_at: 0, agent_status: 'waiting',
    })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => parseSession({})).toThrow()
    expect(() => parseSession({ id: 's1' })).toThrow()
    expect(() => parseSession({ id: 's1', title: 'T' })).toThrow()
  })
})

// ── parseTodo — edge cases ─────────────────────────────────────────────────────

describe('parseTodo — edge cases', () => {
  it('parses completed=1 as true', () => {
    const todo = parseTodo({ id: 't1', session_id: 's1', text: 'Done', completed: 1, created_at: 0 })
    expect(todo.completed).toBe(true)
  })

  it('parses completed=0 as false', () => {
    const todo = parseTodo({ id: 't1', session_id: 's1', text: 'Open', completed: 0, created_at: 0 })
    expect(todo.completed).toBe(false)
  })

  it('rejects completed with non-literal value', () => {
    expect(() => parseTodo({ id: 't1', session_id: 's1', text: 'X', completed: 2, created_at: 0 })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => parseTodo({})).toThrow()
    expect(() => parseTodo({ id: 't1' })).toThrow()
    expect(() => parseTodo({ id: 't1', session_id: 's1' })).toThrow()
  })
})
