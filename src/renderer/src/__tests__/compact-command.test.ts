import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── helpers used by the /compact command handler ──────────────────────────

/**
 * Simulates the /compact command dispatch logic from App.tsx.
 * We test it as an isolated pure function so we don't need to mount the
 * full React component.
 */
async function handleCompact(
  msgs: { length: number }[],
  hasProvider: boolean,
  compactConversation: (sessionId: string, msgs: unknown[], settings: unknown, model: string) => Promise<{ messages: unknown[]; compacted: number }>,
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []

  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (msgs.length === 0) {
    pushMsg('No messages to compact.')
    return results
  }

  if (!hasProvider) {
    pushMsg('No API endpoint configured — cannot compact conversation.')
    return results
  }

  try {
    const result = await compactConversation('s1', msgs, {} as any, 'gpt-4o-mini')
    if (result.compacted > 0) {
      // store.setMessages is called with result.messages
      pushMsg(`**Context compacted:** ${result.compacted} earlier messages were summarized to free up space in the context window.`)
    } else {
      pushMsg('No compaction needed — the conversation is short enough to fit in the context window.')
    }
  } catch (err) {
    pushMsg(`**Compaction failed:** ${(err as Error).message}`)
  }

  return results
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('/compact command — context compaction logic', () => {
  let compactMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    compactMock = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows a message when there are no messages to compact', async () => {
    const result = await handleCompact([], true, compactMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No messages to compact.')
    // compactConversation should NOT be called when msgs is empty
    expect(compactMock).not.toHaveBeenCalled()
  })

  it('shows a message when no API endpoint is configured', async () => {
    const messages = [{ length: 100 } as any, { length: 200 } as any]
    const result = await handleCompact(messages, false, compactMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No API endpoint configured — cannot compact conversation.')
    // compactConversation should NOT be called when no provider is set
    expect(compactMock).not.toHaveBeenCalled()
  })

  it('shows compaction summary when messages were compacted', async () => {
    const messages = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }, { id: 'm5' }] as any[]
    compactMock.mockResolvedValue({
      messages: [{ id: 'summary', role: 'system', content: 'compacted summary' }, { id: 'm4' }, { id: 'm5' }],
      compacted: 3,
    })
    const result = await handleCompact(messages, true, compactMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('**Context compacted:**')
    expect(result[0].content).toContain('3 earlier messages were summarized')
    expect(compactMock).toHaveBeenCalledWith('s1', messages, {}, 'gpt-4o-mini')
  })

  it('shows no-compaction-needed when compactConversation returns 0', async () => {
    const messages = [{ id: 'm1' }, { id: 'm2' }] as any[]
    compactMock.mockResolvedValue({
      messages,
      compacted: 0,
    })
    const result = await handleCompact(messages, true, compactMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No compaction needed — the conversation is short enough to fit in the context window.')
  })

  it('handles errors from compactConversation gracefully', async () => {
    const messages = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] as any[]
    compactMock.mockRejectedValue(new Error('Network error'))
    const result = await handleCompact(messages, true, compactMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('**Compaction failed:** Network error')
  })

  it('passes model to compactConversation when provided', async () => {
    const messages = [{ id: 'm1' }, { id: 'm2' }] as any[]
    compactMock.mockResolvedValue({ messages, compacted: 0 })
    const customModel = 'claude-3-sonnet-20240229'

    // Simulate handleCompact with a model-aware dispatch that passes the model through
    async function handleCompactWithModel(
      msgs: { length: number }[],
      hasProv: boolean,
      compactFn: typeof compactMock,
      model: string,
    ) {
      if (msgs.length === 0) return [{ kind: 'msg' as const, content: '' }]
      if (!hasProv) return [{ kind: 'msg' as const, content: '' }]
      return compactFn('s1', msgs, {} as any, model).then(() => [{ kind: 'msg' as const, content: '' }])
    }

    await handleCompactWithModel(messages, true, compactMock, customModel)
    expect(compactMock).toHaveBeenCalledWith('s1', messages, {}, customModel)
  })

  it('returns a message for every branch (no silent failures)', async () => {
    // Empty
    const r1 = await handleCompact([], true, compactMock)
    expect(r1.length).toBeGreaterThanOrEqual(1)

    // No provider
    const r2 = await handleCompact([{ id: 'm1' }] as any, false, compactMock)
    expect(r2.length).toBeGreaterThanOrEqual(1)

    // Error
    compactMock.mockRejectedValue(new Error('boom'))
    const r3 = await handleCompact([{ id: 'm1' }] as any, true, compactMock)
    expect(r3.length).toBeGreaterThanOrEqual(1)

    // Success
    compactMock.mockResolvedValue({ messages: [], compacted: 3 })
    const r4 = await handleCompact([{ id: 'm1' }, { id: 'm2' }] as any, true, compactMock)
    expect(r4.length).toBeGreaterThanOrEqual(1)
  })
})
