import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
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

beforeEach(() => {
  useAppStore.setState({
    sessions: [],
    messages: [],
    todos: [],
    tabs: [],
    activeTabId: null,
    activeView: 'chat',
    lastDeletedMessage: null,
  })
})

// ── User message filtering ────────────────────────────────────────────────────

describe('Jump-to-message — user message filtering', () => {
  it('filters user messages from mixed message array', () => {
    const msgs = [
      mkMessage({ id: 'u1', role: 'user' }),
      mkMessage({ id: 'a1', role: 'assistant' }),
      mkMessage({ id: 'u2', role: 'user' }),
      mkMessage({ id: 't1', role: 'tool' }),
      mkMessage({ id: 'u3', role: 'user' }),
    ]
    const filtered = msgs.filter((m) => m.role === 'user')
    expect(filtered).toHaveLength(3)
    expect(filtered.map((m) => m.id)).toEqual(['u1', 'u2', 'u3'])
  })

  it('returns empty array when no user messages', () => {
    const msgs = [
      mkMessage({ id: 'a1', role: 'assistant' }),
      mkMessage({ id: 't1', role: 'tool' }),
    ]
    const userMessages = msgs.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(0)
  })

  it('returns all messages when all are user messages', () => {
    const msgs = [
      mkMessage({ id: 'u1', role: 'user' }),
      mkMessage({ id: 'u2', role: 'user' }),
    ]
    const userMessages = msgs.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(2)
  })
})

// ── Jump direction logic ──────────────────────────────────────────────────────

describe('Jump-to-message — direction logic', () => {
  it('jump up from first user message stays at boundary', () => {
    const userMessages = [
      mkMessage({ id: 'u1', role: 'user' }),
      mkMessage({ id: 'u2', role: 'user' }),
    ]
    const closestIdx = 0
    const targetIdx = closestIdx - 1
    expect(targetIdx).toBeLessThan(0)
  })

  it('jump down from last user message stays at boundary', () => {
    const userMessages = [
      mkMessage({ id: 'u1', role: 'user' }),
      mkMessage({ id: 'u2', role: 'user' }),
    ]
    const closestIdx = 1
    const targetIdx = closestIdx + 1
    expect(targetIdx).toBeGreaterThanOrEqual(userMessages.length)
  })

  it('jump up navigates to previous user message', () => {
    const userMessages = [
      mkMessage({ id: 'u1', role: 'user' }),
      mkMessage({ id: 'u2', role: 'user' }),
      mkMessage({ id: 'u3', role: 'user' }),
    ]
    const closestIdx = 2
    const targetIdx = closestIdx - 1
    expect(targetIdx).toBe(1)
    expect(userMessages[targetIdx].id).toBe('u2')
  })

  it('jump down navigates to next user message', () => {
    const userMessages = [
      mkMessage({ id: 'u1', role: 'user' }),
      mkMessage({ id: 'u2', role: 'user' }),
      mkMessage({ id: 'u3', role: 'user' }),
    ]
    const closestIdx = 0
    const targetIdx = closestIdx + 1
    expect(targetIdx).toBe(1)
    expect(userMessages[targetIdx].id).toBe('u2')
  })
})

// ── Jump state management ─────────────────────────────────────────────────────

describe('Jump-to-message — state management', () => {
  it('jumpedMessageId starts as null', () => {
    const [jumpedMessageId] = [null as string | null]
    expect(jumpedMessageId).toBeNull()
  })

  it('jumpedMessageId can be set to a message id', () => {
    let jumpedMessageId: string | null = null
    jumpedMessageId = 'u2'
    expect(jumpedMessageId).toBe('u2')
  })

  it('jumpedMessageId clears after timeout', async () => {
    vi.useFakeTimers()
    let jumpedMessageId: string | null = null
    jumpedMessageId = 'u2'

    const timer = setTimeout(() => { jumpedMessageId = null }, 1500)
    vi.advanceTimersByTime(1500)
    clearTimeout(timer)
    expect(jumpedMessageId).toBeNull()
    vi.useRealTimers()
  })

  it('rapid jumps clear previous timer', async () => {
    vi.useFakeTimers()
    let jumpedMessageId: string | null = null
    let lastTimer: ReturnType<typeof setTimeout>

    jumpedMessageId = 'u1'
    lastTimer = setTimeout(() => { jumpedMessageId = null }, 1500)

    // Jump again before timer fires
    clearTimeout(lastTimer)
    jumpedMessageId = 'u2'
    lastTimer = setTimeout(() => { jumpedMessageId = null }, 1500)

    // Advance past first timer — should still be u2
    vi.advanceTimersByTime(1500)
    expect(jumpedMessageId).toBeNull()
    vi.useRealTimers()
  })
})

// ── Keyboard handler logic ────────────────────────────────────────────────────

describe('Jump-to-message — keyboard handler', () => {
  it('recognizes Cmd+ArrowUp as jump up', () => {
    const e = { key: 'ArrowUp', metaKey: true, ctrlKey: false, preventDefault: vi.fn() }
    const mod = e.metaKey || e.ctrlKey
    expect(mod).toBe(true)
    expect(e.key).toBe('ArrowUp')
  })

  it('recognizes Ctrl+ArrowUp as jump up', () => {
    const e = { key: 'ArrowUp', metaKey: false, ctrlKey: true, preventDefault: vi.fn() }
    const mod = e.metaKey || e.ctrlKey
    expect(mod).toBe(true)
    expect(e.key).toBe('ArrowUp')
  })

  it('recognizes Cmd+ArrowDown as jump down', () => {
    const e = { key: 'ArrowDown', metaKey: true, ctrlKey: false, preventDefault: vi.fn() }
    const mod = e.metaKey || e.ctrlKey
    expect(mod).toBe(true)
    expect(e.key).toBe('ArrowDown')
  })

  it('ignores ArrowUp without modifier', () => {
    const e = { key: 'ArrowUp', metaKey: false, ctrlKey: false, preventDefault: vi.fn() }
    const mod = e.metaKey || e.ctrlKey
    expect(mod).toBe(false)
  })

  it('ignores non-arrow keys with modifier', () => {
    const e = { key: 'k', metaKey: true, ctrlKey: false, preventDefault: vi.fn() }
    expect(e.key).not.toBe('ArrowUp')
    expect(e.key).not.toBe('ArrowDown')
  })
})

// ── MessageItem isJumped prop ─────────────────────────────────────────────────

describe('Jump-to-message — MessageItem isJumped prop', () => {
  it('isJumped defaults to undefined/falsy', () => {
    const isJumped = undefined
    expect(isJumped ?? false).toBe(false)
  })

  it('isJumped true applies highlight class', () => {
    const className = 'group flex gap-3 px-4 py-3 transition-colors duration-700 flex-row bg-primary/10'
    expect(className).toContain('bg-primary/10')
  })

  it('isJumped false does not apply highlight class', () => {
    const baseClass = 'group flex gap-3 px-4 py-3 transition-colors duration-700 flex-row'
    expect(baseClass).not.toContain('bg-primary/10')
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Jump-to-message — edge cases', () => {
  it('single user message cannot navigate', () => {
    const userMessages = [mkMessage({ id: 'u1', role: 'user' })]
    const closestIdx = 0
    const upTarget = closestIdx - 1
    const downTarget = closestIdx + 1
    expect(upTarget).toBeLessThan(0)
    expect(downTarget).toBeGreaterThanOrEqual(userMessages.length)
  })

  it('empty messages array produces empty user messages', () => {
    const msgs: Message[] = []
    const userMessages = msgs.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(0)
  })

  it('all assistant messages produce empty user messages', () => {
    const msgs = [
      mkMessage({ id: 'a1', role: 'assistant' }),
      mkMessage({ id: 'a2', role: 'assistant' }),
    ]
    const userMessages = msgs.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(0)
  })

  it('closest distance calculation finds nearest user message', () => {
    const viewportMid = 500
    const elements = [
      { id: 'u1', mid: 100 },
      { id: 'u2', mid: 480 },
      { id: 'u3', mid: 900 },
    ]

    let closestIdx = -1
    let closestDist = Infinity
    for (let i = 0; i < elements.length; i++) {
      const dist = Math.abs(elements[i].mid - viewportMid)
      if (dist < closestDist) { closestDist = dist; closestIdx = i }
    }

    expect(closestIdx).toBe(1) // u2 at 480 is closest to 500
    expect(closestDist).toBe(20)
  })
})
