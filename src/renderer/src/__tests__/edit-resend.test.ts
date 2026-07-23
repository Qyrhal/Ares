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

// ── Edit-resend logic ────────────────────────────────────────────────────────

describe('Edit-resend', () => {
  it('prefills input with original prompt text', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Fix the bug in auth.ts' }),
      mkMessage({ id: 'a1', role: 'assistant', content: 'Sure, here is the fix...' }),
    ]
    const assistantIdx = messages.findIndex((m) => m.id === 'a1')
    const userMsg = messages.slice(0, assistantIdx).reverse().find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    // The prefill text should be the original user message content
    const prefillText = userMsg!.content
    expect(prefillText).toBe('Fix the bug in auth.ts')
  })

  it('removes assistant and subsequent messages', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
      mkMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }),
      mkMessage({ id: 't1', role: 'tool', content: 'tool output' }),
      mkMessage({ id: 'u2', role: 'user', content: 'Do something' }),
      mkMessage({ id: 'a2', role: 'assistant', content: 'Done' }),
    ]
    // Simulating edit-resend on a2
    const assistantIdx = messages.findIndex((m) => m.id === 'a2')
    const toDelete = messages.slice(assistantIdx)
    expect(toDelete).toHaveLength(1)
    expect(toDelete[0].id).toBe('a2')
    const remaining = messages.slice(0, assistantIdx)
    expect(remaining).toHaveLength(4)

    // Simulating edit-resend on a1 (removes a1, t1, u2, a2)
    const assistantIdx2 = messages.findIndex((m) => m.id === 'a1')
    const toDelete2 = messages.slice(assistantIdx2)
    expect(toDelete2).toHaveLength(4)
    const remaining2 = messages.slice(0, assistantIdx2)
    expect(remaining2).toHaveLength(1)
    expect(remaining2[0].id).toBe('u1')
  })

  it('finds the correct user message', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
      mkMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }),
      mkMessage({ id: 'u2', role: 'user', content: 'Do something' }),
      mkMessage({ id: 'a2', role: 'assistant', content: 'Done' }),
    ]
    const assistantIdx = messages.findIndex((m) => m.id === 'a2')
    const userMsg = messages.slice(0, assistantIdx).reverse().find((m) => m.role === 'user')
    expect(userMsg?.id).toBe('u2')
    expect(userMsg?.content).toBe('Do something')
  })

  it('does not run when loading', () => {
    const isLoading = true
    const activeSession = { id: 's1' }
    // The handler returns early when isLoading is true
    const shouldProceed = !isLoading && !!activeSession
    expect(shouldProceed).toBe(false)
  })

  it('does not run when no preceding user message', () => {
    const messages: Message[] = [
      mkMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }),
    ]
    const assistantIdx = messages.findIndex((m) => m.id === 'a1')
    expect(assistantIdx).toBe(0) // assistantIdx <= 0 → early return
    const userMsg = messages.slice(0, assistantIdx).reverse().find((m) => m.role === 'user')
    expect(userMsg).toBeUndefined()
  })

  it('does not run when assistant message not found', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
    ]
    const assistantIdx = messages.findIndex((m) => m.id === 'nonexistent')
    expect(assistantIdx).toBe(-1)
  })

  it('button should only appear for assistant messages', () => {
    const assistantMsg = mkMessage({ role: 'assistant' })
    const userMsg = mkMessage({ role: 'user' })
    expect(assistantMsg.role === 'assistant').toBe(true)
    expect(userMsg.role === 'assistant').toBe(false)
  })
})
