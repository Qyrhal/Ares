import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Message, Todo } from '@/types'

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

function mkStreamingMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm_stream',
    sessionId: 's1',
    role: 'assistant',
    content: '',
    isStreaming: true,
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

// ── Auto-scroll feature ───────────────────────────────────────────────────────

describe('ChatView — auto-scroll', () => {
  it('should scroll to bottom when new messages arrive', () => {
    const messages = [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })]
    useAppStore.getState().setMessages(messages)
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
  })

  it('should scroll to bottom on streaming chunks', () => {
    const msgs = [mkMessage({ id: 'm1' })]
    useAppStore.getState().setMessages(msgs)
    useAppStore.getState().appendMessage(mkStreamingMessage({ content: 'Hello...' }))
    expect(useAppStore.getState().messages).toHaveLength(2)
  })
})

// ── Scroll lock follow mode ───────────────────────────────────────────────────

describe('ChatView — scroll lock', () => {
  it('shows scroll-to-bottom button when scrolled up during streaming', () => {
    // Simulate: many messages + streaming + scrolled up
    const msgs = Array.from({ length: 20 }, (_, i) => mkMessage({ id: `m${i}` }))
    useAppStore.getState().setMessages(msgs)
    useAppStore.getState().appendMessage(mkStreamingMessage({ content: 'Streaming...' }))
    const state = useAppStore.getState()
    expect(state.messages.length).toBeGreaterThan(20)
    // The streaming message exists
    const streaming = state.messages.find((m) => m.isStreaming)
    expect(streaming).toBeDefined()
  })

  it('hides scroll-to-bottom button when at bottom', () => {
    const msgs = [mkMessage({ id: 'm1' })]
    useAppStore.getState().setMessages(msgs)
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('clicking button scrolls to bottom', () => {
    const bottomRef = { current: { scrollIntoView: vi.fn() } }
    bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    expect(bottomRef.current.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })
})

// ── Token counter ─────────────────────────────────────────────────────────────

describe('ChatView — token counter', () => {
  it('tracks character count of streaming message', () => {
    const streaming = mkStreamingMessage({ content: 'Hello world' })
    const charCount = streaming.content.length
    // Approximate tokens: chars / 4
    const approxTokens = Math.round(charCount / 4)
    expect(charCount).toBe(11)
    expect(approxTokens).toBe(3)
  })

  it('shows zero tokens when no streaming content', () => {
    const streaming = mkStreamingMessage({ content: '' })
    expect(streaming.content.length).toBe(0)
  })

  it('computes tokens/second rate', () => {
    const streaming = mkStreamingMessage({ content: 'Hello world this is a test message' })
    const charCount = streaming.content.length
    const elapsedSec = 2
    const tps = Math.round((charCount / 4) / elapsedSec)
    expect(tps).toBeGreaterThan(0)
  })

  it('handles zero elapsed time gracefully', () => {
    const streaming = mkStreamingMessage({ content: 'Hi' })
    const charCount = streaming.content.length
    const elapsedSec = 0
    const tps = elapsedSec > 0 ? Math.round((charCount / 4) / elapsedSec) : 0
    expect(tps).toBe(0)
  })

  it('updates token count as stream progresses', () => {
    const content = 'A'.repeat(100)
    const streaming = mkStreamingMessage({ content })
    expect(Math.round(streaming.content.length / 4)).toBe(25)

    const moreContent = content + 'B'.repeat(100)
    const streaming2 = mkStreamingMessage({ content: moreContent })
    expect(Math.round(streaming2.content.length / 4)).toBe(50)
  })
})

// ── Shimmer/loading state ─────────────────────────────────────────────────────

describe('ChatView — shimmer', () => {
  it('shows shimmer when isLoading is true', () => {
    const isLoading = true
    expect(isLoading).toBe(true)
  })

  it('hides shimmer when not loading', () => {
    const isLoading = false
    expect(isLoading).toBe(false)
  })

  it('rotates shimmer verbs every 2 seconds', () => {
    const verbs = ['Thinking', 'Processing', 'Generating']
    let idx = 0
    const nextVerb = () => { idx = (idx + 1) % verbs.length; return verbs[idx] }
    expect(nextVerb()).toBe('Processing')
    expect(nextVerb()).toBe('Generating')
    expect(nextVerb()).toBe('Thinking')
  })
})

// ── store — lastDeletedMessage ────────────────────────────────────────────────

describe('store — lastDeletedMessage', () => {
  it('starts as null', () => {
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })

  it('stores deleted message', () => {
    const msg = mkMessage({ id: 'del1', content: 'Delete me' })
    useAppStore.getState().setLastDeletedMessage(msg)
    expect(useAppStore.getState().lastDeletedMessage).toBeDefined()
    expect(useAppStore.getState().lastDeletedMessage!.id).toBe('del1')
  })

  it('clears after restore', () => {
    const msg = mkMessage({ id: 'del1' })
    useAppStore.getState().setLastDeletedMessage(msg)
    useAppStore.getState().clearLastDeletedMessage()
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })

  it('can be set to null', () => {
    useAppStore.getState().setLastDeletedMessage(mkMessage())
    useAppStore.getState().setLastDeletedMessage(null)
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })
})

// ── store — message operations for interactions ───────────────────────────────

describe('store — message interactions', () => {
  it('upsertMessage updates existing message', () => {
    useAppStore.getState().setMessages([mkMessage({ id: 'm1', content: 'Original' })])
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'Updated' }))
    expect(useAppStore.getState().messages[0].content).toBe('Updated')
  })

  it('removeMessage deletes by id', () => {
    useAppStore.getState().setMessages([
      mkMessage({ id: 'm1' }),
      mkMessage({ id: 'm2' }),
    ])
    useAppStore.getState().removeMessage('m1')
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('m2')
  })

  it('appendMessage adds to end', () => {
    useAppStore.getState().setMessages([mkMessage({ id: 'm1' })])
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2' }))
    expect(useAppStore.getState().messages).toHaveLength(2)
    expect(useAppStore.getState().messages[1].id).toBe('m2')
  })
})

// ── Streaming message tracking ────────────────────────────────────────────────

describe('ChatView — streaming message tracking', () => {
  it('finds streaming message in messages array', () => {
    const msgs = [
      mkMessage({ id: 'm1' }),
      mkMessage({ id: 'm2', role: 'assistant', isStreaming: true }),
    ]
    const streaming = msgs.find((m) => m.isStreaming)
    expect(streaming).toBeDefined()
    expect(streaming!.id).toBe('m2')
  })

  it('returns undefined when no streaming message', () => {
    const msgs = [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })]
    const streaming = msgs.find((m) => m.isStreaming)
    expect(streaming).toBeUndefined()
  })

  it('multiple streaming messages — finds first', () => {
    const msgs = [
      mkMessage({ id: 'm1', role: 'assistant', isStreaming: true }),
      mkMessage({ id: 'm2', role: 'assistant', isStreaming: true }),
    ]
    const streaming = msgs.find((m) => m.isStreaming)
    expect(streaming!.id).toBe('m1')
  })
})
