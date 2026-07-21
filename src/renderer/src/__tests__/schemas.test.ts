import { describe, it, expect } from 'vitest'
import { parseSession, parseTodo, parseMessage } from '@/schemas'

// ── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_SESSION = {
  id: 's1',
  title: 'My Session',
  model: 'gpt-4o',
  created_at: 1000,
  updated_at: 2000,
  message_count: 3,
}

const BASE_MESSAGE = {
  id: 'm1',
  session_id: 's1',
  role: 'user' as const,
  content: 'Hello',
  created_at: 1500,
}

const BASE_TODO = {
  id: 't1',
  session_id: 's1',
  text: 'Write tests',
  completed: 0 as const,
  created_at: 1200,
}

function rawMsg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    session_id: 's1',
    role: 'user',
    content: 'Hello',
    attachments: null,
    tool_name: null,
    tool_status: null,
    tool_input: null,
    tool_output: null,
    thinking: null,
    reply_to: null,
    reactions: null,
    created_at: 1500,
    ...overrides,
  }
}

// ── parseSession ─────────────────────────────────────────────────────────────

describe('parseSession — core fields', () => {
  it('maps snake_case to camelCase', () => {
    const s = parseSession(BASE_SESSION)
    expect(s.id).toBe('s1')
    expect(s.title).toBe('My Session')
    expect(s.model).toBe('gpt-4o')
    expect(s.createdAt).toBe(1000)
    expect(s.updatedAt).toBe(2000)
    expect(s.messageCount).toBe(3)
  })

  it('defaults messageCount to 0 when absent', () => {
    const { message_count: _, ...noCount } = BASE_SESSION
    const s = parseSession(noCount)
    expect(s.messageCount).toBe(0)
  })

  it('defaults model to empty string when absent', () => {
    const { model: _, ...noModel } = BASE_SESSION
    const s = parseSession(noModel)
    expect(s.model).toBe('')
  })

  it('defaults pinned to false when absent', () => {
    expect(parseSession(BASE_SESSION).pinned).toBe(false)
  })

  it('preserves pinned: true', () => {
    const s = parseSession({ ...BASE_SESSION, pinned: true })
    expect(s.pinned).toBe(true)
  })

  it('parses effort levels', () => {
    for (const effort of ['low', 'medium', 'high'] as const) {
      expect(parseSession({ ...BASE_SESSION, effort }).effort).toBe(effort)
    }
  })

  it('parses permissionMode values', () => {
    for (const mode of ['ask', 'auto', 'yolo'] as const) {
      expect(parseSession({ ...BASE_SESSION, permissionMode: mode }).permissionMode).toBe(mode)
    }
  })

  it('throws on missing required fields', () => {
    expect(() => parseSession({ title: 'x' })).toThrow()
  })
})

describe('parseSession — archived', () => {
  it('defaults archived to false when absent', () => {
    expect(parseSession(BASE_SESSION).archived).toBe(false)
  })

  it('parses archived: true', () => {
    const s = parseSession({ ...BASE_SESSION, archived: true })
    expect(s.archived).toBe(true)
  })

  it('defaults archived to false when not provided in schema', () => {
    const { pinned: _, ...noPinned } = BASE_SESSION
    const s = parseSession(noPinned)
    expect(s.archived).toBe(false)
  })
})

describe('parseSession — workspacePath', () => {
  it('maps workspace_path to workspacePath', () => {
    const s = parseSession({ ...BASE_SESSION, workspace_path: '/home/user/project' })
    expect(s.workspacePath).toBe('/home/user/project')
  })

  it('defaults to undefined when workspace_path is null', () => {
    expect(parseSession({ ...BASE_SESSION, workspace_path: null }).workspacePath).toBeUndefined()
  })

  it('defaults to undefined when workspace_path is absent', () => {
    expect(parseSession(BASE_SESSION).workspacePath).toBeUndefined()
  })
})

describe('parseSession — parentId', () => {
  it('maps parent_id to parentId', () => {
    const s = parseSession({ ...BASE_SESSION, parent_id: 'parent-session' })
    expect(s.parentId).toBe('parent-session')
  })

  it('defaults parentId to null when parent_id is null', () => {
    const s = parseSession({ ...BASE_SESSION, parent_id: null })
    expect(s.parentId).toBeNull()
  })

  it('defaults parentId to null when parent_id is absent', () => {
    const s = parseSession(BASE_SESSION)
    expect(s.parentId).toBeNull()
  })

  it('parentId is null for root sessions', () => {
    const root = parseSession(BASE_SESSION)
    expect(root.parentId).toBeNull()
  })

  it('parentId is set for child sessions', () => {
    const child = parseSession({ ...BASE_SESSION, id: 'child', parent_id: 's1' })
    expect(child.parentId).toBe('s1')
  })
})

describe('parseSession — agentStatus', () => {
  it('defaults agentStatus to idle when absent', () => {
    const s = parseSession(BASE_SESSION)
    expect(s.agentStatus).toBe('idle')
  })

  it('parses running status', () => {
    const s = parseSession({ ...BASE_SESSION, agent_status: 'running' })
    expect(s.agentStatus).toBe('running')
  })

  it('parses done status', () => {
    const s = parseSession({ ...BASE_SESSION, agent_status: 'done' })
    expect(s.agentStatus).toBe('done')
  })

  it('parses error status', () => {
    const s = parseSession({ ...BASE_SESSION, agent_status: 'error' })
    expect(s.agentStatus).toBe('error')
  })

  it('parses idle status', () => {
    const s = parseSession({ ...BASE_SESSION, agent_status: 'idle' })
    expect(s.agentStatus).toBe('idle')
  })

  it('throws on invalid agent_status value', () => {
    expect(() => parseSession({ ...BASE_SESSION, agent_status: 'unknown' })).toThrow()
  })
})

// ── parseTodo ─────────────────────────────────────────────────────────────────

describe('parseTodo — field mapping', () => {
  it('maps session_id to sessionId', () => {
    const t = parseTodo(BASE_TODO)
    expect(t.sessionId).toBe('s1')
  })

  it('maps created_at to createdAt', () => {
    const t = parseTodo(BASE_TODO)
    expect(t.createdAt).toBe(1200)
  })

  it('preserves id and text', () => {
    const t = parseTodo(BASE_TODO)
    expect(t.id).toBe('t1')
    expect(t.text).toBe('Write tests')
  })
})

describe('parseTodo — completed conversion', () => {
  it('converts completed: 0 to false', () => {
    const t = parseTodo({ ...BASE_TODO, completed: 0 })
    expect(t.completed).toBe(false)
  })

  it('converts completed: 1 to true', () => {
    const t = parseTodo({ ...BASE_TODO, completed: 1 })
    expect(t.completed).toBe(true)
  })

  it('throws on invalid completed value', () => {
    expect(() => parseTodo({ ...BASE_TODO, completed: 2 })).toThrow()
    expect(() => parseTodo({ ...BASE_TODO, completed: true })).toThrow()
  })

  it('round-trips correctly for complete and incomplete todos', () => {
    const open = parseTodo({ ...BASE_TODO, completed: 0 })
    const done = parseTodo({ ...BASE_TODO, completed: 1 })
    expect(open.completed).toBe(false)
    expect(done.completed).toBe(true)
  })
})

describe('parseTodo — validation', () => {
  it('throws when required fields are missing', () => {
    expect(() => parseTodo({ id: 't1' })).toThrow()
    expect(() => parseTodo({})).toThrow()
  })

  it('throws when text is missing', () => {
    const { text: _, ...noText } = BASE_TODO
    expect(() => parseTodo(noText)).toThrow()
  })
})

// ── parseMessage ──────────────────────────────────────────────────────────────

describe('parseMessage — core fields', () => {
  it('maps session_id to sessionId', () => {
    const m = parseMessage(BASE_MESSAGE)
    expect(m.sessionId).toBe('s1')
  })

  it('maps created_at to createdAt', () => {
    const m = parseMessage(BASE_MESSAGE)
    expect(m.createdAt).toBe(1500)
  })

  it('preserves id, role, and content', () => {
    const m = parseMessage(BASE_MESSAGE)
    expect(m.id).toBe('m1')
    expect(m.role).toBe('user')
    expect(m.content).toBe('Hello')
  })

  it('parses all valid roles', () => {
    for (const role of ['user', 'assistant', 'tool', 'system'] as const) {
      const m = parseMessage({ ...BASE_MESSAGE, role })
      expect(m.role).toBe(role)
    }
  })

  it('throws on invalid role', () => {
    expect(() => parseMessage({ ...BASE_MESSAGE, role: 'admin' })).toThrow()
  })
})

describe('parseMessage — optional fields default to undefined', () => {
  it('toolName is undefined when absent', () => {
    expect(parseMessage(BASE_MESSAGE).toolName).toBeUndefined()
  })

  it('toolStatus is undefined when absent', () => {
    expect(parseMessage(BASE_MESSAGE).toolStatus).toBeUndefined()
  })

  it('toolInput is undefined when absent', () => {
    expect(parseMessage(BASE_MESSAGE).toolInput).toBeUndefined()
  })

  it('toolOutput is undefined when absent', () => {
    expect(parseMessage(BASE_MESSAGE).toolOutput).toBeUndefined()
  })

  it('thinking is undefined when absent', () => {
    expect(parseMessage(BASE_MESSAGE).thinking).toBeUndefined()
  })

  it('attachments is undefined when absent', () => {
    expect(parseMessage(BASE_MESSAGE).attachments).toBeUndefined()
  })

  it('null optional fields become undefined', () => {
    const m = parseMessage({
      ...BASE_MESSAGE,
      tool_name: null,
      tool_status: null,
      tool_input: null,
      tool_output: null,
      thinking: null,
      attachments: null,
    })
    expect(m.toolName).toBeUndefined()
    expect(m.toolStatus).toBeUndefined()
    expect(m.toolInput).toBeUndefined()
    expect(m.toolOutput).toBeUndefined()
    expect(m.thinking).toBeUndefined()
    expect(m.attachments).toBeUndefined()
  })
})

describe('parseMessage — tool message fields', () => {
  const toolMsg = {
    ...BASE_MESSAGE,
    role: 'tool' as const,
    tool_name: 'readFile',
    tool_status: 'running',
    tool_input: JSON.stringify({ path: '/foo.ts' }),
    tool_output: 'const x = 1',
  }

  it('maps tool_name to toolName', () => {
    expect(parseMessage(toolMsg).toolName).toBe('readFile')
  })

  it('maps tool_status to toolStatus', () => {
    expect(parseMessage(toolMsg).toolStatus).toBe('running')
  })

  it('maps tool_input to toolInput', () => {
    expect(parseMessage(toolMsg).toolInput).toBe(JSON.stringify({ path: '/foo.ts' }))
  })

  it('maps tool_output to toolOutput', () => {
    expect(parseMessage(toolMsg).toolOutput).toBe('const x = 1')
  })

  it('parses done and error tool statuses', () => {
    expect(parseMessage({ ...toolMsg, tool_status: 'done' }).toolStatus).toBe('done')
    expect(parseMessage({ ...toolMsg, tool_status: 'error' }).toolStatus).toBe('error')
  })
})

describe('parseMessage — attachments', () => {
  it('parses JSON-encoded attachments array', () => {
    const att = [{ id: 'a1', name: 'file.ts', size: 100, type: 'text/plain', path: '/file.ts' }]
    const m = parseMessage({ ...BASE_MESSAGE, attachments: JSON.stringify(att) })
    expect(m.attachments).toEqual(att)
  })

  it('handles empty attachments array', () => {
    const m = parseMessage({ ...BASE_MESSAGE, attachments: JSON.stringify([]) })
    expect(m.attachments).toEqual([])
  })
})

describe('parseMessage — thinking field', () => {
  it('maps thinking string correctly', () => {
    const m = parseMessage({ ...BASE_MESSAGE, thinking: 'Let me reason about this...' })
    expect(m.thinking).toBe('Let me reason about this...')
  })
})

describe('parseMessage — replyTo field', () => {
  it('parses JSON-encoded reply_to into replyTo object', () => {
    const reply = { id: 'm2', content: 'What do you think?', role: 'user' as const }
    const m = parseMessage({ ...BASE_MESSAGE, reply_to: JSON.stringify(reply) })
    expect(m.replyTo).toEqual(reply)
  })

  it('handles assistant role in replyTo', () => {
    const reply = { id: 'm3', content: 'Here is the code', role: 'assistant' as const }
    const m = parseMessage({ ...BASE_MESSAGE, reply_to: JSON.stringify(reply) })
    expect(m.replyTo!.role).toBe('assistant')
  })

  it('defaults replyTo to undefined when reply_to is absent', () => {
    const m = parseMessage(BASE_MESSAGE)
    expect(m.replyTo).toBeUndefined()
  })

  it('defaults replyTo to undefined when reply_to is null', () => {
    const m = parseMessage({ ...BASE_MESSAGE, reply_to: null })
    expect(m.replyTo).toBeUndefined()
  })

  it('defaults replyTo to undefined when reply_to is empty string', () => {
    const m = parseMessage({ ...BASE_MESSAGE, reply_to: '' })
    expect(m.replyTo).toBeUndefined()
  })

  it('handles replyTo with long content (200+ chars)', () => {
    const longContent = 'x'.repeat(300)
    const reply = { id: 'm4', content: longContent, role: 'user' as const }
    const m = parseMessage({ ...BASE_MESSAGE, reply_to: JSON.stringify(reply) })
    expect(m.replyTo!.content.length).toBe(300)
  })
})

describe('parseMessage — reactions field', () => {
  it('parses JSON-encoded reactions with up: true', () => {
    const m = parseMessage({ ...BASE_MESSAGE, reactions: JSON.stringify({ up: true }) })
    expect(m.reactions).toEqual({ up: true })
  })

  it('parses JSON-encoded reactions with up: false', () => {
    const m = parseMessage({ ...BASE_MESSAGE, reactions: JSON.stringify({ up: false }) })
    expect(m.reactions).toEqual({ up: false })
  })

  it('parses JSON-encoded reactions with up: null (cleared)', () => {
    const m = parseMessage({ ...BASE_MESSAGE, reactions: JSON.stringify({ up: null }) })
    expect(m.reactions).toEqual({ up: null })
  })

  it('defaults reactions to undefined when reactions is absent', () => {
    const m = parseMessage(BASE_MESSAGE)
    expect(m.reactions).toBeUndefined()
  })

  it('defaults reactions to undefined when reactions is null', () => {
    const m = parseMessage({ ...BASE_MESSAGE, reactions: null })
    expect(m.reactions).toBeUndefined()
  })

  it('defaults reactions to undefined when reactions is empty string', () => {
    const m = parseMessage({ ...BASE_MESSAGE, reactions: '' })
    expect(m.reactions).toBeUndefined()
  })
})

describe('parseMessage — feedback field', () => {
  it('parses feedback value "helpful"', () => {
    const m = parseMessage({ ...BASE_MESSAGE, feedback: 'helpful' })
    expect(m.feedback).toBe('helpful')
  })

  it('parses feedback value "not-helpful"', () => {
    const m = parseMessage({ ...BASE_MESSAGE, feedback: 'not-helpful' })
    expect(m.feedback).toBe('not-helpful')
  })

  it('defaults feedback to undefined when absent', () => {
    const m = parseMessage(BASE_MESSAGE)
    expect(m.feedback).toBeUndefined()
  })

  it('defaults feedback to undefined when null', () => {
    const m = parseMessage({ ...BASE_MESSAGE, feedback: null })
    expect(m.feedback).toBeUndefined()
  })

  it('survives round-trip with replyTo + reactions + feedback all set', () => {
    const raw = {
      ...BASE_MESSAGE,
      reply_to: JSON.stringify({ id: 'm2', content: 'Why?', role: 'user' }),
      reactions: JSON.stringify({ up: true }),
      feedback: 'helpful',
    }
    const m = parseMessage(raw)
    expect(m.replyTo).toEqual({ id: 'm2', content: 'Why?', role: 'user' })
    expect(m.reactions).toEqual({ up: true })
    expect(m.feedback).toBe('helpful')
  })
})

describe('parseSession — robustness', () => {
  it('ignores extra unknown fields', () => {
    const raw = { id: 's1', title: 'T', model: 'gpt-4', created_at: 1, updated_at: 1, message_count: 0, foobar: 'noise', nested: { random: true } }
    const s = parseSession(raw)
    expect(s.id).toBe('s1')
    // should not throw
  })
  it('handles null optional fields gracefully', () => {
    const raw = { id: 's1', title: 'T', model: 'gpt-4', created_at: 1, updated_at: 1, message_count: 0, workspace_path: null, parent_id: null }
    const s = parseSession(raw)
    expect(s.workspacePath).toBeUndefined()
    expect(s.parentId).toBeNull()
  })
  it('parses all optional fields when present', () => {
    const raw = { id: 's1', title: 'T', model: 'gpt-4', created_at: 1, updated_at: 1, message_count: 0, pinned: true, archived: true, effort: 'high', permissionMode: 'yolo', workspace_path: '/proj', parent_id: 'p1', agent_status: 'running', notes: 'my notes', is_side_chat: true }
    const s = parseSession(raw)
    expect(s.pinned).toBe(true)
    expect(s.archived).toBe(true)
    expect(s.effort).toBe('high')
    expect(s.permissionMode).toBe('yolo')
    expect(s.workspacePath).toBe('/proj')
    expect(s.parentId).toBe('p1')
    expect(s.agentStatus).toBe('running')
    expect(s.notes).toBe('my notes')
    expect(s.isSideChat).toBe(true)
  })
  it('defaults isSideChat to false when absent', () => {
    expect(parseSession(BASE_SESSION).isSideChat).toBe(false)
  })
  it('defaults effort to undefined when absent', () => {
    const s = parseSession(BASE_SESSION)
    expect(s.effort).toBeUndefined()
  })
})

describe('parseMessage — robustness', () => {
  it('ignores extra unknown fields', () => {
    const raw = rawMsg({ extraField: 'ignore', nested: { x: 1 } })
    const msg = parseMessage(raw)
    expect(msg.id).toBe('m1')
  })
  it('handles all null optional fields', () => {
    const raw = rawMsg({ attachments: null, tool_name: null, tool_status: null, tool_input: null, tool_output: null, thinking: null, reply_to: null, reactions: null, feedback: null })
    const msg = parseMessage(raw)
    expect(msg.attachments).toBeUndefined()
    expect(msg.toolName).toBeUndefined()
    expect(msg.replyTo).toBeUndefined()
  })
  it('parses all tool fields when present', () => {
    const raw = rawMsg({ tool_name: 'readFile', tool_status: 'done', tool_input: '{"path":"/test"}', tool_output: 'file content here' })
    const msg = parseMessage(raw)
    expect(msg.toolName).toBe('readFile')
    expect(msg.toolStatus).toBe('done')
    expect(msg.toolInput).toBe('{"path":"/test"}')
    expect(msg.toolOutput).toBe('file content here')
  })
  it('parses thinking field as string', () => {
    const raw = rawMsg({ thinking: 'Let me analyze this...' })
    const msg = parseMessage(raw)
    expect(msg.thinking).toBe('Let me analyze this...')
  })
  it('parses feedback field', () => {
    const raw = rawMsg({ feedback: 'thumbs_up' })
    const msg = parseMessage(raw)
    expect(msg.feedback).toBe('thumbs_up')
  })
})

describe('parseTodo — robustness', () => {
  it('ignores extra unknown fields', () => {
    const raw = { id: 't1', session_id: 's1', text: 'Task', completed: 0, created_at: 100, randomField: 'noise' }
    const todo = parseTodo(raw)
    expect(todo.id).toBe('t1')
    expect(todo.text).toBe('Task')
  })
  it('rejects completed as string "0" (expects number)', () => {
    const raw = { id: 't1', session_id: 's1', text: 'Task', completed: '0', created_at: 100 }
    expect(() => parseTodo(raw)).toThrow()
  })
  it('rejects completed as string "1" (expects number)', () => {
    const raw = { id: 't1', session_id: 's1', text: 'Task', completed: '1', created_at: 100 }
    expect(() => parseTodo(raw)).toThrow()
  })
})
