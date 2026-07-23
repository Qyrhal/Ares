import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the /review slash command — background (non-blocking) variant.
 *
 * The review command now fires the API call without awaiting, shows a
 * "⏳ Starting review..." message immediately, and appends the result
 * (or error) once the background fetch resolves.
 *
 * These tests exercise the command handler logic in isolation by
 * re-implementing the same branching/fetch pattern used in App.tsx.
 */

const REVIEW_SYSTEM_PROMPT =
  'You are a code reviewer. Analyze the conversation below and provide: 1) A brief summary of what was discussed/accomplished. 2) Code quality observations (patterns, potential issues). 3) 2-3 specific suggestions for improvement. Be concise and actionable.'

interface DbMsg {
  id: string
  session_id: string
  role: string
  content: string
  created_at: number
  is_streaming: number
}

/**
 * Re-implements the /review handler logic from App.tsx so tests can
 * exercise the command without mounting the full React tree.
 */
async function handleReview(opts: {
  msgs: DbMsg[]
  hasProvider: boolean
  settings: { apiBaseUrl: string; apiKey?: string; defaultModel?: string }
  sessionModel?: string
  fetchFn: typeof fetch
  addMessage: (sessionId: string, role: string, content: string) => Promise<DbMsg | null>
  appendMessage: (msg: DbMsg) => void
  sessionId: string
}): Promise<{ messages: DbMsg[]; fetchCalled: boolean }> {
  const { msgs, hasProvider, settings, sessionModel, fetchFn, addMessage, appendMessage, sessionId } = opts
  const added: DbMsg[] = []
  const push = async (role: string, content: string) => {
    const m = await addMessage(sessionId, role, content)
    if (m) {
      appendMessage(m)
      added.push(m)
    }
    return m
  }

  if (!msgs || msgs.length === 0) {
    await push('system', 'No messages to review.')
    return { messages: added, fetchCalled: false }
  }
  if (!hasProvider) {
    await push('system', 'No API endpoint configured.')
    return { messages: added, fetchCalled: false }
  }

  const reviewMessages = msgs.slice(-20).map((m) => ({
    role: m.role === 'tool' ? ('user' as const) : (m.role as 'user' | 'assistant' | 'system'),
    content: m.content,
  }))

  // Show starting message immediately
  const startMsg = await push('system', '⏳ Starting review...')
  void startMsg

  // Fire API call in background — don't await
  const baseUrl = settings.apiBaseUrl.replace(/\/$/, '')
  const modelId = sessionModel || settings.defaultModel || 'gpt-4o-mini'
  fetchFn(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: REVIEW_SYSTEM_PROMPT },
        ...reviewMessages,
      ],
      stream: false,
    }),
  }).then(async (response: Response) => {
    if (response.ok) {
      const json = await response.json()
      const reviewContent = json.choices?.[0]?.message?.content ?? 'No review generated.'
      await push('system', `**📝 Session Review**\n\n${reviewContent}`)
    } else {
      await push('system', `Review failed: ${response.status}`)
    }
  }).catch(async () => {
    await push('system', 'Review failed: network error')
  })

  return { messages: added, fetchCalled: true }
}

// ── Test helpers ────────────────────────────────────────────────────────────

let msgCounter = 0
function dbMsg(role: string, content: string): DbMsg {
  msgCounter++
  return {
    id: `msg-${msgCounter}`,
    session_id: 's1',
    role,
    content,
    created_at: Date.now(),
    is_streaming: 0,
  }
}

function msgs(n: number): DbMsg[] {
  return Array.from({ length: n }, (_, i) =>
    dbMsg(i % 2 === 0 ? 'user' : 'assistant', `message ${i}`)
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('/review background execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    msgCounter = 0
  })

  it('shows "Starting review..." message immediately', async () => {
    const addMessage = vi.fn().mockImplementation((_sid: string, role: string, content: string) =>
      Promise.resolve(dbMsg(role, content))
    )
    const appendMessage = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'review text' } }] }),
    })

    const result = await handleReview({
      msgs: msgs(5),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost:11434/v1', apiKey: 'k' },
      fetchFn,
      addMessage,
      appendMessage,
      sessionId: 's1',
    })

    expect(result.fetchCalled).toBe(true)
    // First message appended should be the starting indicator
    expect(appendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      content: '⏳ Starting review...',
    }))
  })

  it('sends API request with correct model and messages', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })

    await handleReview({
      msgs: msgs(5),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost:8080/v1', apiKey: 'test-key', defaultModel: 'claude-3' },
      fetchFn,
      addMessage: vi.fn().mockImplementation((_s, r, c) => Promise.resolve(dbMsg(r, c))),
      appendMessage: vi.fn(),
      sessionId: 's1',
    })

    // Wait for background fetch to resolve
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())

    const [url, opts] = fetchFn.mock.calls[0]
    expect(url).toBe('http://localhost:8080/v1/chat/completions')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers['Authorization']).toBe('Bearer test-key')

    const body = JSON.parse(opts.body)
    expect(body.model).toBe('claude-3')
    expect(body.stream).toBe(false)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toBe(REVIEW_SYSTEM_PROMPT)
    // 5 messages in context + 1 system prompt
    expect(body.messages.length).toBe(6)
  })

  it('appends result on success', async () => {
    const addMessage = vi.fn().mockImplementation((_s, r, c) => Promise.resolve(dbMsg(r, c)))
    const appendMessage = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Looks good!' } }] }),
    })

    await handleReview({
      msgs: msgs(3),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost/v1', apiKey: 'k' },
      fetchFn,
      addMessage,
      appendMessage,
      sessionId: 's1',
    })

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
    // Allow microtask queue to flush
    await new Promise((r) => setTimeout(r, 10))

    expect(addMessage).toHaveBeenCalledWith(
      's1',
      'system',
      '**📝 Session Review**\n\nLooks good!'
    )
  })

  it('appends error on HTTP failure', async () => {
    const addMessage = vi.fn().mockImplementation((_s, r, c) => Promise.resolve(dbMsg(r, c)))
    const appendMessage = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })

    await handleReview({
      msgs: msgs(3),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost/v1', apiKey: 'k' },
      fetchFn,
      addMessage,
      appendMessage,
      sessionId: 's1',
    })

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 10))

    expect(addMessage).toHaveBeenCalledWith(
      's1',
      'system',
      'Review failed: 503'
    )
  })

  it('appends error on network failure', async () => {
    const addMessage = vi.fn().mockImplementation((_s, r, c) => Promise.resolve(dbMsg(r, c)))
    const appendMessage = vi.fn()
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await handleReview({
      msgs: msgs(3),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost/v1', apiKey: 'k' },
      fetchFn,
      addMessage,
      appendMessage,
      sessionId: 's1',
    })

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 10))

    expect(addMessage).toHaveBeenCalledWith(
      's1',
      'system',
      'Review failed: network error'
    )
  })

  it('handles missing content in response', async () => {
    const addMessage = vi.fn().mockImplementation((_s, r, c) => Promise.resolve(dbMsg(r, c)))
    const appendMessage = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    })

    await handleReview({
      msgs: msgs(3),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost/v1', apiKey: 'k' },
      fetchFn,
      addMessage,
      appendMessage,
      sessionId: 's1',
    })

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 10))

    expect(addMessage).toHaveBeenCalledWith(
      's1',
      'system',
      '**📝 Session Review**\n\nNo review generated.'
    )
  })

  it('uses correct system prompt', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })

    await handleReview({
      msgs: msgs(2),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost/v1', apiKey: 'k' },
      fetchFn,
      addMessage: vi.fn().mockImplementation((_s, r, c) => Promise.resolve(dbMsg(r, c))),
      appendMessage: vi.fn(),
      sessionId: 's1',
    })

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toContain('code reviewer')
    expect(body.messages[0].content).toContain('summary')
    expect(body.messages[0].content).toContain('suggestions')
  })

  it('truncates to last 20 messages', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })

    await handleReview({
      msgs: msgs(30),
      hasProvider: true,
      settings: { apiBaseUrl: 'http://localhost/v1', apiKey: 'k' },
      fetchFn,
      addMessage: vi.fn().mockImplementation((_s, r, c) => Promise.resolve(dbMsg(r, c))),
      appendMessage: vi.fn(),
      sessionId: 's1',
    })

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const body = JSON.parse(fetchFn.mock.calls[0][1].body)
    // 1 system prompt + 20 messages = 21
    expect(body.messages.length).toBe(21)
    // First user message should be message 10 (0-indexed from the 30)
    expect(body.messages[1].content).toBe('message 10')
  })
})
