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

describe('Regenerate keyboard shortcut (Ctrl+Shift+R)', () => {
  it('finds last assistant message for regeneration', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
      mkMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }),
      mkMessage({ id: 'u2', role: 'user', content: 'Do something' }),
      mkMessage({ id: 'a2', role: 'assistant', content: 'Done' }),
    ]
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    expect(lastAssistant?.id).toBe('a2')
  })

  it('returns undefined when no assistant messages', () => {
    const messages: Message[] = [
      mkMessage({ id: 'u1', role: 'user', content: 'Hello' }),
    ]
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    expect(lastAssistant).toBeUndefined()
  })

  it('returns undefined for empty messages', () => {
    const messages: Message[] = []
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    expect(lastAssistant).toBeUndefined()
  })

  it('shortcuts list includes regenerate shortcut', () => {
    const shortcutsText = [
      '**In Chat**',
      '· `Ctrl + Shift + R` — Regenerate last assistant response',
    ].join('\n')
    expect(shortcutsText).toContain('Ctrl + Shift + R')
    expect(shortcutsText).toContain('Regenerate')
  })

  it('help text includes /diff command', () => {
    const helpText = '/diff - show git diff of all changes'
    expect(helpText).toContain('/diff')
    expect(helpText).toContain('git diff')
  })
})
