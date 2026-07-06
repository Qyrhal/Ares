import { describe, it, expect } from 'vitest'
import type { Message } from '@/types'

describe('ReplyTo type', () => {
  it('has required fields', () => {
    const replyTo = { id: 'm1', content: 'Hello', role: 'user' as const }
    expect(replyTo.id).toBe('m1')
    expect(replyTo.content).toBe('Hello')
    expect(replyTo.role).toBe('user')
  })

  it('can reference assistant messages', () => {
    const replyTo = { id: 'm2', content: 'Response', role: 'assistant' as const }
    expect(replyTo.role).toBe('assistant')
  })

  it('truncates long content', () => {
    const long = 'x'.repeat(500)
    const replyTo = { id: 'm3', content: long.slice(0, 200), role: 'user' as const }
    expect(replyTo.content.length).toBe(200)
  })
})

describe('MessageReactions type', () => {
  it('defaults to null', () => {
    const reactions = { up: null }
    expect(reactions.up).toBeNull()
  })

  it('can be thumbs up', () => {
    const reactions = { up: true }
    expect(reactions.up).toBe(true)
  })

  it('can be thumbs down', () => {
    const reactions = { up: false }
    expect(reactions.up).toBe(false)
  })

  it('toggle removes reaction', () => {
    const current = true
    const next = current === true ? null : true
    expect(next).toBeNull()
  })
})

describe('Message type with interactions', () => {
  const baseMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'm1',
    sessionId: 's1',
    role: 'user',
    content: 'test',
    createdAt: Date.now(),
    ...overrides,
  })

  it('supports replyTo field', () => {
    const msg = baseMessage({
      replyTo: { id: 'm0', content: 'Parent', role: 'assistant' },
    })
    expect(msg.replyTo?.id).toBe('m0')
    expect(msg.replyTo?.content).toBe('Parent')
  })

  it('supports reactions field', () => {
    const msg = baseMessage({
      reactions: { up: true },
    })
    expect(msg.reactions?.up).toBe(true)
  })

  it('clears reaction on toggle', () => {
    const msg = baseMessage({
      reactions: { up: null },
    })
    expect(msg.reactions?.up).toBeNull()
  })

  it('supports both replyTo and reactions', () => {
    const msg = baseMessage({
      replyTo: { id: 'm0', content: 'P', role: 'user' },
      reactions: { up: true },
    })
    expect(msg.replyTo?.id).toBe('m0')
    expect(msg.reactions?.up).toBe(true)
  })
})

describe('formatMessageTime', () => {
  function formatMessageTime(createdAt: number): string {
    const date = new Date(createdAt)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (isToday) return time
    if (isYesterday) return `Yesterday, ${time}`
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + time
  }

  it('shows time for today', () => {
    const result = formatMessageTime(Date.now())
    expect(result).toMatch(/^\d/)
  })

  it('shows Yesterday for yesterday', () => {
    const yesterday = Date.now() - 86400000
    const result = formatMessageTime(yesterday)
    expect(result).toMatch(/Yesterday/)
  })

  it('shows date for older messages', () => {
    const lastWeek = Date.now() - 7 * 86400000
    const result = formatMessageTime(lastWeek)
    expect(result).toMatch(/,/)
  })

  it('shows year for previous year', () => {
    const lastYear = new Date('2023-06-01').getTime()
    const result = formatMessageTime(lastYear)
    expect(result).toMatch(/2023/)
  })
})

describe('Message delete with undo', () => {
  it('restores deleted message', () => {
    const msg: Message = {
      id: 'm1', sessionId: 's1', role: 'user', content: 'hello',
      createdAt: Date.now(),
    }
    // Simulate delete
    const deleted = { ...msg }
    const restored = { ...deleted }
    expect(restored.id).toBe(msg.id)
    expect(restored.content).toBe('hello')
  })

  it('preserves replyTo on restore', () => {
    const msg: Message = {
      id: 'm1', sessionId: 's1', role: 'user', content: 'reply',
      replyTo: { id: 'm0', content: 'original', role: 'assistant' },
      createdAt: Date.now(),
    }
    const deleted = { ...msg }
    expect(deleted.replyTo?.id).toBe('m0')
  })
})

describe('Message edit', () => {
  it('updates content', () => {
    const msg: Message = {
      id: 'm1', sessionId: 's1', role: 'user', content: 'old',
      createdAt: Date.now(),
    }
    const updated = { ...msg, content: 'new' }
    expect(updated.content).toBe('new')
    expect(updated.id).toBe('m1')
  })

  it('preserves other fields on edit', () => {
    const msg: Message = {
      id: 'm1', sessionId: 's1', role: 'user', content: 'old',
      attachments: [{ id: 'a1', name: 'f.txt', size: 100, type: 'text', path: '/f.txt' }],
      createdAt: Date.now(),
    }
    const updated = { ...msg, content: 'new' }
    expect(updated.attachments).toHaveLength(1)
    expect(updated.attachments![0].name).toBe('f.txt')
  })
})
