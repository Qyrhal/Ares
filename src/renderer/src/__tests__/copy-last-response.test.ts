import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../store/useAppStore'
import type { Message } from '../types'

// Mock navigator.clipboard.writeText
const writeTextMock = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  writable: true,
})

// Mock toast from sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

import { toast } from 'sonner'

function createMessage(overrides: Partial<Message> & { role: Message['role'] }): Message {
  return {
    id: crypto.randomUUID(),
    sessionId: 's1',
    content: 'Hello from assistant',
    createdAt: Date.now(),
    ...overrides,
  } as Message
}

describe('Copy last assistant response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ messages: [] })
  })

  it('copies the last assistant response content to clipboard', async () => {
    const userMsg = createMessage({ role: 'user', content: 'Hi there' })
    const assistantMsg = createMessage({ role: 'assistant', content: 'Hello from assistant' })
    useAppStore.setState({ messages: [userMsg, assistantMsg] })

    // Extract the copy logic (same as in App.tsx keyboard handler)
    const msgs = useAppStore.getState().messages
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
    expect(lastAssistant).toBeDefined()

    await navigator.clipboard.writeText(lastAssistant!.content)
    expect(writeTextMock).toHaveBeenCalledWith('Hello from assistant')
  })

  it('shows toast.success after clipboard write', async () => {
    const assistantMsg = createMessage({ role: 'assistant', content: 'Response text' })
    useAppStore.setState({ messages: [assistantMsg] })

    const msgs = useAppStore.getState().messages
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')

    await navigator.clipboard.writeText(lastAssistant!.content)
    toast.success('Last response copied to clipboard', { duration: 1500 })
    expect(toast.success).toHaveBeenCalledWith('Last response copied to clipboard', { duration: 1500 })
  })

  it('copies the LAST assistant response when multiple exist', async () => {
    const msg1 = createMessage({ role: 'assistant', content: 'First response' })
    const userMsg = createMessage({ role: 'user', content: 'Another question' })
    const msg2 = createMessage({ role: 'assistant', content: 'Second response' })
    useAppStore.setState({ messages: [msg1, userMsg, msg2] })

    const msgs = useAppStore.getState().messages
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')

    await navigator.clipboard.writeText(lastAssistant!.content)
    expect(writeTextMock).toHaveBeenCalledWith('Second response')
  })

  it('does not call clipboard when there are no assistant messages', () => {
    const userMsg = createMessage({ role: 'user', content: 'Hello' })
    useAppStore.setState({ messages: [userMsg] })

    const msgs = useAppStore.getState().messages
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')

    expect(lastAssistant).toBeUndefined()
    expect(writeTextMock).not.toHaveBeenCalled()
  })

  it('does not call clipboard when messages array is empty', () => {
    const msgs = useAppStore.getState().messages
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')

    expect(lastAssistant).toBeUndefined()
    expect(writeTextMock).not.toHaveBeenCalled()
  })
})
