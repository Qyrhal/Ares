import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Message } from '@/types'

// ── helpers used by the /usage command handler ──────────────────────────

/**
 * Simulates the /usage command dispatch logic from App.tsx.
 * We test it as an isolated pure-ish function so we don't need to mount the
 * full React component.
 */
async function handleUsage(
  msgs: Partial<Message>[],
  hasApi: boolean,
  estimateTokens: (messages: Partial<Message>[]) => number,
  contextWindow: (model: string) => number,
  estimateCost: (model: string, inputTokens: number, outputTokens: number) => number,
  createdAt: number,
  model = 'gpt-4o-mini',
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (msgs.length === 0) {
    pushMsg('No messages in this session to analyze.')
    return results
  }

  const userCount = msgs.filter((m) => m.role === 'user').length
  const assistantCount = msgs.filter((m) => m.role === 'assistant').length
  const systemCount = msgs.filter((m) => m.role === 'system').length
  const toolCount = msgs.filter((m) => m.role === 'tool').length

  const totalTokens = estimateTokens(msgs)
  const inputTokens = estimateTokens(msgs.filter((m) => m.role === 'user'))
  const outputTokens = estimateTokens(msgs.filter((m) => m.role === 'assistant'))

  const windowSize = contextWindow(model)
  const utilization = Math.round((totalTokens / windowSize) * 100)

  const cost = estimateCost(model, inputTokens, outputTokens)

  const durationMs = Date.now() - createdAt
  const durHours = Math.floor(durationMs / 3600000)
  const durMinutes = Math.floor((durationMs % 3600000) / 60000)
  const durationStr = durHours > 0 ? `${durHours}h ${durMinutes}m` : `${durMinutes}m`

  if (hasApi) {
    // In online mode we'd call the API, but for this test we just verify
    // that we would attempt to do so — the actual fetch is tested in e2e.
    // The presence of the loading message and the stats in the prompt are
    // the real indicators.
    pushMsg(`[online] would call API with model=${model} tokens=${totalTokens} cost=$${cost.toFixed(6)}`)
  } else {
    const stats = [
      '**Session Usage (offline)**\n',
      `**Total messages:** ${msgs.length} (${userCount} user, ${assistantCount} assistant, ${systemCount} system, ${toolCount} tool)`,
      `**Estimated tokens:** ~${totalTokens.toLocaleString()} total (${inputTokens.toLocaleString()} input, ${outputTokens.toLocaleString()} output)`,
      `**Context window:** ${windowSize.toLocaleString()} tokens`,
      `**Context utilization:** ${utilization}%`,
      `**Estimated cost:** $${cost.toFixed(6)}`,
      `**Session duration:** ${durationStr}`,
      `**Model:** ${model}`,
      '\nConfigure an API endpoint to get AI-powered usage analysis.',
    ].filter(Boolean).join('\n')
    pushMsg(stats)
  }

  return results
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('/usage command — session usage summary logic', () => {
  let estimateTokensMock: ReturnType<typeof vi.fn>
  let contextWindowMock: ReturnType<typeof vi.fn>
  let estimateCostMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    estimateTokensMock = vi.fn()
    contextWindowMock = vi.fn()
    estimateCostMock = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows a message when there are no messages to analyze', async () => {
    const result = await handleUsage([], true, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now())
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No messages in this session to analyze.')
    expect(estimateTokensMock).not.toHaveBeenCalled()
    expect(contextWindowMock).not.toHaveBeenCalled()
    expect(estimateCostMock).not.toHaveBeenCalled()
  })

  it('shows offline stats when no API endpoint is configured', async () => {
    const messages: Partial<Message>[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'What is the weather?' },
      { role: 'assistant', content: 'It is sunny today.' },
      { role: 'tool', content: 'some tool output' },
    ]

    estimateTokensMock
      .mockReturnValueOnce(50)   // total tokens
      .mockReturnValueOnce(20)   // input tokens
      .mockReturnValueOnce(20)   // output tokens
    contextWindowMock.mockReturnValue(128000)
    estimateCostMock.mockReturnValue(0.00025)

    const result = await handleUsage(messages, false, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now() - 1800000)

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('**Session Usage (offline)**')
    expect(result[0].content).toContain('**Total messages:** 5')
    expect(result[0].content).toContain('2 user')
    expect(result[0].content).toContain('2 assistant')
    expect(result[0].content).toContain('0 system')
    expect(result[0].content).toContain('1 tool')
    expect(result[0].content).toContain('50 total')
    expect(result[0].content).toContain('**Context window:**')
    expect(result[0].content).toContain('128,000')
    expect(result[0].content).toContain('**Context utilization:**')
    expect(result[0].content).toContain('0%')
    expect(result[0].content).toContain('**Estimated cost:**')
    expect(result[0].content).toContain('$0.000250')
    expect(result[0].content).toContain('**Session duration:**')
    expect(result[0].content).toContain('30m')
    expect(result[0].content).toContain('**Model:**')
    expect(result[0].content).toContain('Configure an API endpoint')
    expect(estimateTokensMock).toHaveBeenCalledTimes(3)
    expect(contextWindowMock).toHaveBeenCalledWith('gpt-4o-mini')
    expect(estimateCostMock).toHaveBeenCalledWith('gpt-4o-mini', 20, 20)
  })

  it('uses online mode when API endpoint is configured', async () => {
    const messages: Partial<Message>[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]

    estimateTokensMock
      .mockReturnValueOnce(10)   // total
      .mockReturnValueOnce(5)    // input
      .mockReturnValueOnce(5)    // output
    contextWindowMock.mockReturnValue(128000)
    estimateCostMock.mockReturnValue(0.00001)

    const result = await handleUsage(messages, true, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now())

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('[online]')
    expect(result[0].content).toContain('model=gpt-4o-mini')
    expect(result[0].content).toContain('tokens=10')
    expect(estimateTokensMock).toHaveBeenCalledTimes(3)
    expect(contextWindowMock).toHaveBeenCalledWith('gpt-4o-mini')
    expect(estimateCostMock).toHaveBeenCalledWith('gpt-4o-mini', 5, 5)
  })

  it('handles a single message', async () => {
    const messages: Partial<Message>[] = [
      { role: 'user', content: 'Just one message' },
    ]

    estimateTokensMock
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(5)   // input tokens = total for single user msg
      .mockReturnValueOnce(0)   // output tokens = 0 (no assistant msgs)
    contextWindowMock.mockReturnValue(128000)
    estimateCostMock.mockReturnValue(0.000001)

    const result = await handleUsage(messages, false, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now())

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('**Total messages:** 1')
    expect(result[0].content).toContain('1 user')
    expect(result[0].content).toContain('0 assistant')
    expect(result[0].content).toContain('0 tool')
    expect(estimateCostMock).toHaveBeenCalledWith('gpt-4o-mini', 5, 0)
  })

  it('handles zero-token messages (empty content)', async () => {
    const messages: Partial<Message>[] = [
      { role: 'user', content: '' },
      { role: 'assistant', content: '' },
    ]

    estimateTokensMock
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
    contextWindowMock.mockReturnValue(128000)
    estimateCostMock.mockReturnValue(0)

    const result = await handleUsage(messages, false, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now())

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('0 total')
    expect(result[0].content).toContain('**Context utilization:**')
    expect(result[0].content).toContain('0%')
    expect(result[0].content).toContain('**Estimated cost:**')
    expect(result[0].content).toContain('$0.000000')
    expect(estimateCostMock).toHaveBeenCalledWith('gpt-4o-mini', 0, 0)
  })

  it('handles a very long session duration', async () => {
    const messages: Partial<Message>[] = [
      { role: 'user', content: 'Start' },
      { role: 'assistant', content: 'Response' },
    ]

    estimateTokensMock
      .mockReturnValueOnce(8)
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(4)
    contextWindowMock.mockReturnValue(128000)
    estimateCostMock.mockReturnValue(0.000001)

    // Session created 5 hours ago
    const createdAt = Date.now() - 5 * 3600000

    const result = await handleUsage(messages, false, estimateTokensMock, contextWindowMock, estimateCostMock, createdAt)

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('5h 0m')
  })

  it('passes model to contextWindow and estimateCost', async () => {
    const messages: Partial<Message>[] = [
      { role: 'user', content: 'Test' },
    ]

    estimateTokensMock.mockReturnValue(2)
    contextWindowMock.mockReturnValue(64000)
    estimateCostMock.mockReturnValue(0.00005)

    const result = await handleUsage(messages, false, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now(), 'deepseek-v4')

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('**Model:** deepseek-v4')
    expect(contextWindowMock).toHaveBeenCalledWith('deepseek-v4')
    expect(estimateCostMock).toHaveBeenCalledWith('deepseek-v4', 2, 2)
  })

  it('returns a message for every branch (no silent failures)', async () => {
    // Empty
    const r1 = await handleUsage([], true, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now())
    expect(r1.length).toBeGreaterThanOrEqual(1)

    // Offline
    const msgs: Partial<Message>[] = [{ role: 'user', content: 'hi' }]
    estimateTokensMock.mockReturnValue(2)
    contextWindowMock.mockReturnValue(128000)
    estimateCostMock.mockReturnValue(0.00001)
    const r2 = await handleUsage(msgs, false, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now())
    expect(r2.length).toBeGreaterThanOrEqual(1)

    // Online
    estimateTokensMock.mockReturnValue(2)
    const r3 = await handleUsage(msgs, true, estimateTokensMock, contextWindowMock, estimateCostMock, Date.now())
    expect(r3.length).toBeGreaterThanOrEqual(1)
  })
})
