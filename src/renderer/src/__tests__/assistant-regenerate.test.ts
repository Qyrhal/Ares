import { describe, it, expect } from 'vitest'
import type { Message } from '@/types'

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

// ── Regenerate logic ─────────────────────────────────────────────────────────

describe('Assistant regenerate', () => {
  it('finds the preceding user message for regeneration', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
      mkMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }),
      mkMessage({ id: 'u2', role: 'user', content: 'Do something' }),
      mkMessage({ id: 'a2', role: 'assistant', content: 'Done' }),
    ]
    const assistantIdx = messages.findIndex((m) => m.id === 'a2')
    expect(assistantIdx).toBe(3)
    const userMsg = messages.slice(0, assistantIdx).reverse().find((m) => m.role === 'user')
    expect(userMsg?.id).toBe('u2')
    expect(userMsg?.content).toBe('Do something')
  })

  it('removes all messages from the assistant onward', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
      mkMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }),
      mkMessage({ id: 'u2', role: 'user', content: 'Do something' }),
      mkMessage({ id: 'a2', role: 'assistant', content: 'Done' }),
    ]
    const assistantIdx = messages.findIndex((m) => m.id === 'a1')
    const remaining = messages.slice(0, assistantIdx)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('u1')
  })

  it('returns early when assistant message not found', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
    ]
    const assistantIdx = messages.findIndex((m) => m.id === 'nonexistent')
    expect(assistantIdx).toBe(-1)
  })

  it('returns early when no preceding user message', () => {
    const messages: Message[] = [
      mkMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }),
    ]
    const assistantIdx = 0
    const userMsg = messages.slice(0, assistantIdx).reverse().find((m) => m.role === 'user')
    expect(userMsg).toBeUndefined()
  })

  it('preserves user message with attachments for re-send', () => {
    const attachments = [{ id: 'att1', name: 'screenshot.png', size: 1024, type: 'image/png', path: '/tmp/screenshot.png' }]
    const userMsg = mkMessage({ id: 'u1', role: 'user', content: 'Analyze this', attachments })
    expect(userMsg.attachments).toHaveLength(1)
    expect(userMsg.attachments![0].name).toBe('screenshot.png')
  })

  it('re-sends with original user content', () => {
    const userMsg = mkMessage({ id: 'u1', role: 'user', content: 'Fix the bug in auth.ts' })
    const reSent = { content: userMsg.content, attachments: userMsg.attachments ?? [] }
    expect(reSent.content).toBe('Fix the bug in auth.ts')
    expect(reSent.attachments).toHaveLength(0)
  })

  it('button should not appear for user messages', () => {
    const msg = mkMessage({ role: 'user' })
    expect(msg.role).toBe('user')
    // isAssistant check: msg.role === 'assistant'
    expect(msg.role === 'assistant').toBe(false)
  })

  it('button should appear for assistant messages', () => {
    const msg = mkMessage({ role: 'assistant' })
    expect(msg.role === 'assistant').toBe(true)
  })
})
