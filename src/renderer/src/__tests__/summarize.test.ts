import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Simulates the /summarize command dispatch logic from App.tsx.
 * Extracted as a pure async function for isolated testing.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FetchFn = (...args: any[]) => Promise<any>

interface SummarizeDeps {
  messages: { role: string; content: string }[]
  hasProvider: boolean
  fetchFn: FetchFn
}

interface SummarizeResult {
  kind: 'msg'
  content: string
}

async function handleSummarize({
  messages,
  hasProvider,
  fetchFn,
}: SummarizeDeps): Promise<SummarizeResult[]> {
  const results: SummarizeResult[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (messages.length === 0) {
    pushMsg('No messages to summarize.')
    return results
  }

  if (!hasProvider) {
    pushMsg('No API endpoint configured.')
    return results
  }

  // Simulate the filter + slice logic from App.tsx
  const summarizeMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-30)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  pushMsg('⏳ Generating summary...')

  try {
    const response = await fetchFn('https://api.example.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: expect.stringContaining('Summarize the conversation') },
          ...summarizeMessages,
        ],
        stream: false,
      }),
    })

    if (response.ok) {
      const json = await response.json()
      const summaryContent = json.choices?.[0]?.message?.content ?? 'No summary generated.'
      pushMsg(`**📝 Session Summary**\n\n${summaryContent}`)
    } else {
      pushMsg(`Summary failed: ${response.status}`)
    }
  } catch {
    pushMsg('Summary failed: network error')
  }

  return results
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('/summarize command — conversation summary logic', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows a message when there are no messages', async () => {
    const result = await handleSummarize({
      messages: [],
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No messages to summarize.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a message when no API endpoint is configured', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]
    const result = await handleSummarize({
      messages,
      hasProvider: false,
      fetchFn: fetchMock,
    })
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No API endpoint configured.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('generates a summary on successful API response', async () => {
    const messages = [
      { role: 'user', content: 'Help me refactor the auth module' },
      { role: 'assistant', content: 'Sure, let me look at the current code.' },
      { role: 'user', content: 'Use bcrypt for password hashing' },
      { role: 'assistant', content: 'Done! I\'ve updated the auth module to use bcrypt.' },
    ]
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Key topics: Auth module refactoring with bcrypt.' } }],
      }),
    })

    const result = await handleSummarize({
      messages,
      hasProvider: true,
      fetchFn: fetchMock,
    })
    // Should have: 1 loading message + 1 summary message
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('⏳ Generating summary...')
    expect(result[1].content).toContain('**📝 Session Summary**')
    expect(result[1].content).toContain('Auth module refactoring with bcrypt')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('handles API error response gracefully', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    })

    const result = await handleSummarize({
      messages,
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('⏳ Generating summary...')
    expect(result[1].content).toBe('Summary failed: 500')
  })

  it('handles network error gracefully', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]
    fetchMock.mockRejectedValue(new Error('Network error'))

    const result = await handleSummarize({
      messages,
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('⏳ Generating summary...')
    expect(result[1].content).toBe('Summary failed: network error')
  })

  it('filters out tool and system messages, keeping only user and assistant', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'tool', content: 'tool output' },
      { role: 'system', content: 'system message' },
      { role: 'assistant', content: 'Hi there' },
    ]
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Summary text' } }],
      }),
    })

    const result = await handleSummarize({
      messages,
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(result).toHaveLength(2)
    // Verify the fetch was called with only user and assistant messages
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    const sentMessages = callBody.messages.slice(1) // skip system prompt
    expect(sentMessages).toHaveLength(2)
    expect(sentMessages[0].role).toBe('user')
    expect(sentMessages[1].role).toBe('assistant')
  })

  it('slices to last 30 messages when conversation is long', async () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }))
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Summary text' } }],
      }),
    })

    const result = await handleSummarize({
      messages,
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(result).toHaveLength(2)
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    const sentMessages = callBody.messages.slice(1) // skip system prompt
    expect(sentMessages).toHaveLength(30)
    // Should be the last 30 messages (indices 20-49)
    expect(sentMessages[0].content).toBe('Message 20')
    expect(sentMessages[29].content).toBe('Message 49')
  })

  it('handles empty choices from API', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [],
      }),
    })

    const result = await handleSummarize({
      messages,
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(result).toHaveLength(2)
    expect(result[1].content).toContain('No summary generated.')
  })

  it('returns a message for every branch (no silent failures)', async () => {
    // Empty messages
    const r1 = await handleSummarize({
      messages: [],
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(r1.length).toBeGreaterThanOrEqual(1)

    // No provider
    const r2 = await handleSummarize({
      messages: [{ role: 'user', content: 'Hi' }],
      hasProvider: false,
      fetchFn: fetchMock,
    })
    expect(r2.length).toBeGreaterThanOrEqual(1)

    // Network error
    fetchMock.mockRejectedValue(new Error('boom'))
    const r3 = await handleSummarize({
      messages: [{ role: 'user', content: 'Hi' }],
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(r3.length).toBeGreaterThanOrEqual(1)

    // API error
    fetchMock.mockResolvedValue({ ok: false, status: 429 })
    const r4 = await handleSummarize({
      messages: [{ role: 'user', content: 'Hi' }],
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(r4.length).toBeGreaterThanOrEqual(1)

    // Success
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Done' } }] }),
    })
    const r5 = await handleSummarize({
      messages: [{ role: 'user', content: 'Hi' }],
      hasProvider: true,
      fetchFn: fetchMock,
    })
    expect(r5.length).toBeGreaterThanOrEqual(1)
  })
})
