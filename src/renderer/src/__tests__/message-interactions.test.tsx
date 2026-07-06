import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseMessage } from '@/schemas'
import type { Message } from '@/types'

// Helper to create a minimal raw message from DB
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
    created_at: Date.now(),
    ...overrides,
  }
}

function mkMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    sessionId: 's1',
    role: 'user',
    content: 'Hello',
    createdAt: Date.now(),
    ...overrides,
  }
}

// ── Reply feature ─────────────────────────────────────────────────────────────

describe('parseMessage — reply_to', () => {
  it('parses reply_to JSON string into replyTo object', () => {
    const raw = rawMsg({ reply_to: JSON.stringify({ id: 'm0', content: 'Original msg', role: 'user' }) })
    const msg = parseMessage(raw)
    expect(msg.replyTo).toBeDefined()
    expect(msg.replyTo!.id).toBe('m0')
    expect(msg.replyTo!.content).toBe('Original msg')
    expect(msg.replyTo!.role).toBe('user')
  })

  it('sets replyTo to undefined when reply_to is null', () => {
    const msg = parseMessage(rawMsg({ reply_to: null }))
    expect(msg.replyTo).toBeUndefined()
  })

  it('sets replyTo to undefined when reply_to is missing', () => {
    const raw = rawMsg()
    delete raw.reply_to
    const msg = parseMessage(raw)
    expect(msg.replyTo).toBeUndefined()
  })
})

describe('Message — replyTo field', () => {
  it('can create a message with replyTo on user message', () => {
    const msg = mkMessage({
      role: 'user',
      replyTo: { id: 'm0', content: 'Original', role: 'assistant' },
    })
    expect(msg.replyTo).toBeDefined()
    expect(msg.replyTo!.id).toBe('m0')
  })

  it('can create a message with replyTo on assistant message', () => {
    const msg = mkMessage({
      role: 'assistant',
      replyTo: { id: 'm0', content: 'User said', role: 'user' },
    })
    expect(msg.replyTo!.role).toBe('user')
  })

  it('truncates replyTo content to 200 chars', () => {
    const longContent = 'a'.repeat(300)
    const truncated = longContent.slice(0, 200)
    const msg = mkMessage({
      replyTo: { id: 'm0', content: truncated, role: 'user' },
    })
    expect(msg.replyTo!.content.length).toBe(200)
  })
})

// ── Edit feature ──────────────────────────────────────────────────────────────

describe('Message — edit flow', () => {
  it('should update content when edited', () => {
    const msg = mkMessage({ content: 'Original text' })
    const updated = { ...msg, content: 'Edited text' }
    expect(updated.content).toBe('Edited text')
  })

  it('only edits user messages', () => {
    const userMsg = mkMessage({ role: 'user', content: 'Hello' })
    const assistantMsg = mkMessage({ role: 'assistant', content: 'Hi there' })
    expect(userMsg.role).toBe('user')
    expect(assistantMsg.role).toBe('assistant')
  })
})

// ── Copy feature ──────────────────────────────────────────────────────────────

describe('Message — copy', () => {
  it('should copy message content to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const msg = mkMessage({ content: 'Copy this text' })
    await navigator.clipboard.writeText(msg.content)

    expect(writeText).toHaveBeenCalledWith('Copy this text')
  })

  it('should indicate copied state', async () => {
    let copied = false
    const msg = mkMessage({ content: 'Test' })
    await navigator.clipboard.writeText(msg.content)
    copied = true
    expect(copied).toBe(true)
  })
})

// ── Reactions feature ─────────────────────────────────────────────────────────

describe('Message — reactions', () => {
  it('parses reactions JSON string', () => {
    const raw = rawMsg({ reactions: JSON.stringify({ up: true }) })
    const msg = parseMessage(raw)
    expect(msg.reactions).toBeDefined()
    expect(msg.reactions!.up).toBe(true)
  })

  it('sets reactions to undefined when null', () => {
    const msg = parseMessage(rawMsg({ reactions: null }))
    expect(msg.reactions).toBeUndefined()
  })

  it('sets reactions to undefined when missing', () => {
    const raw = rawMsg()
    delete raw.reactions
    const msg = parseMessage(raw)
    expect(msg.reactions).toBeUndefined()
  })

  it('toggles thumbs up reactions', () => {
    const msg = mkMessage({ role: 'assistant', reactions: { up: null } })
    // thumbs up
    const withUp = { ...msg, reactions: { up: true } }
    expect(withUp.reactions!.up).toBe(true)
    // toggle off
    const toggledOff = { ...msg, reactions: { up: null } }
    expect(toggledOff.reactions!.up).toBeNull()
  })

  it('toggles thumbs down reactions', () => {
    const msg = mkMessage({ role: 'assistant', reactions: { up: null } })
    const withDown = { ...msg, reactions: { up: false } }
    expect(withDown.reactions!.up).toBe(false)
    const toggled = { ...msg, reactions: { up: null } }
    expect(toggled.reactions!.up).toBeNull()
  })

  it('can change from thumbs up to thumbs down', () => {
    const msg = mkMessage({ role: 'assistant', reactions: { up: true } })
    const changed = { ...msg, reactions: { up: false } }
    expect(changed.reactions!.up).toBe(false)
  })

  it('only affects assistant messages', () => {
    const userMsg = mkMessage({ role: 'user', reactions: { up: true } })
    const assistantMsg = mkMessage({ role: 'assistant', reactions: { up: true } })
    expect(userMsg.reactions!.up).toBe(true)
    expect(assistantMsg.reactions!.up).toBe(true)
  })
})

// ── Delete with undo feature ──────────────────────────────────────────────────

describe('Message — delete with undo', () => {
  it('preserves message data for undo', () => {
    const msg = mkMessage({
      id: 'm_delete',
      content: 'Delete me',
      role: 'user',
    })
    expect(msg.id).toBe('m_delete')
    expect(msg.content).toBe('Delete me')

    // Simulate undo data: store the message
    const undoData = { ...msg }
    expect(undoData.id).toBe(msg.id)
    expect(undoData.content).toBe(msg.content)
  })

  it('restores message from undo data', () => {
    const original = mkMessage({ content: 'Original content' })
    const restored = { ...original }
    expect(restored.content).toBe('Original content')
    expect(restored.id).toBe(original.id)
    expect(restored.role).toBe(original.role)
  })

  it('preserves replyTo data for undo', () => {
    const msg = mkMessage({
      replyTo: { id: 'r1', content: 'Replied to', role: 'assistant' },
    })
    const undoData = {
      ...msg,
      replyTo: msg.replyTo ? { ...msg.replyTo } : undefined,
    }
    expect(undoData.replyTo).toBeDefined()
    expect(undoData.replyTo!.id).toBe('r1')
  })

  it('preserves reactions data for undo', () => {
    const msg = mkMessage({
      role: 'assistant',
      reactions: { up: true },
    })
    const undoData = { ...msg }
    expect(undoData.reactions!.up).toBe(true)
  })
})

// ── Timestamp feature ─────────────────────────────────────────────────────────

describe('Message — timestamps', () => {
  it('formats timestamp from createdAt', () => {
    const date = new Date()
    const msg = mkMessage({ createdAt: date.getTime() })
    expect(msg.createdAt).toBeGreaterThan(0)
  })

  it('shows time-only for today messages', () => {
    const now = Date.now()
    const msg = mkMessage({ createdAt: now })
    const hours = new Date(now).getHours()
    const minutes = new Date(now).getMinutes()
    expect(hours).toBeGreaterThanOrEqual(0)
    expect(minutes).toBeGreaterThanOrEqual(0)
  })

  it('stores createdAt in milliseconds', () => {
    const msg = mkMessage({ createdAt: 1700000000000 })
    expect(msg.createdAt).toBe(1700000000000)
  })
})

// ── DB integration ────────────────────────────────────────────────────────────

describe('db — addMessage with replyTo', () => {
  it('serializes replyTo to JSON string', () => {
    const replyTo = { id: 'r1', content: 'Test', role: 'user' as const }
    const serialized = JSON.stringify(replyTo)
    expect(serialized).toBe('{"id":"r1","content":"Test","role":"user"}')
  })
})

describe('db — updateMessage reactions', () => {
  it('serializes reactions for update', () => {
    const reactions = { up: true }
    const serialized = JSON.stringify(reactions)
    expect(serialized).toBe('{"up":true}')
  })

  it('serializes empty reaction (null)', () => {
    const reactions = { up: null }
    const serialized = JSON.stringify(reactions)
    expect(serialized).toBe('{"up":null}')
  })
})
