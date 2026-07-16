import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  contextWindow, estimateTokens, needsCompaction,
  splitForCompaction, compactConversation, COMPACTION_THRESHOLD,
} from '@/lib/context'
import type { AppSettings, Message } from '@/types'

const SETTINGS: AppSettings = {
  apiKey: 'sk-test',
  apiBaseUrl: 'http://localhost:11434/v1',
  providers: [],
  defaultModel: 'gpt-4',
  themeId: 'steel',
  colorMode: 'dark',
  systemPrompt: '',
  permissionMode: 'ask',
}

let counter = 0
function msg(chars: number, role: Message['role'] = 'user'): Message {
  counter += 1
  return {
    id: `m${counter}`,
    sessionId: 's1',
    role,
    content: 'x'.repeat(chars),
    createdAt: counter,
  }
}

beforeEach(() => { counter = 0 })

describe('estimateTokens / contextWindow', () => {
  it('estimates ~chars/4', () => {
    expect(estimateTokens([msg(400), msg(80)])).toBe(120)
  })

  it('knows model family windows', () => {
    expect(contextWindow('gpt-4')).toBe(8192)
    expect(contextWindow('claude-3-opus')).toBe(200000)
    expect(contextWindow('some-unknown-model')).toBe(128000)
  })
})

describe('needsCompaction', () => {
  // gpt-4 window = 8192 tokens; 90% threshold = 7373 tokens ≈ 29491 chars
  it('is false well under the threshold', () => {
    expect(needsCompaction([msg(4000)], 'gpt-4')).toBe(false)
  })

  it('is true at 90% of the window', () => {
    const chars = Math.ceil(8192 * COMPACTION_THRESHOLD * 4)
    expect(needsCompaction([msg(chars)], 'gpt-4')).toBe(true)
  })
})

describe('splitForCompaction', () => {
  it('keeps at least the last 4 messages verbatim', () => {
    const messages = Array.from({ length: 10 }, () => msg(40000))
    const { older, recent } = splitForCompaction(messages, 'gpt-4')
    expect(recent.length).toBeGreaterThanOrEqual(4)
    expect(older.length + recent.length).toBe(10)
    expect([...older, ...recent]).toEqual(messages)
  })

  it('keeps everything when history fits the keep budget', () => {
    const messages = [msg(100), msg(100), msg(100)]
    const { older, recent } = splitForCompaction(messages, 'gpt-4')
    expect(older).toHaveLength(0)
    expect(recent).toHaveLength(3)
  })

  it('summarizes the oldest messages, not the newest', () => {
    const messages = Array.from({ length: 12 }, () => msg(10000))
    const { older, recent } = splitForCompaction(messages, 'gpt-4')
    expect(older[0].id).toBe(messages[0].id)
    expect(recent[recent.length - 1].id).toBe(messages[11].id)
  })
})

describe('compactConversation', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function stubFetch(summary = 'the summary'): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: summary } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('returns unchanged when nothing is old enough to compact', async () => {
    stubFetch()
    const messages = [msg(100), msg(100)]
    const result = await compactConversation('s1', messages, SETTINGS, 'gpt-4')
    expect(result.compacted).toBe(0)
    expect(result.messages).toEqual(messages)
  })

  it('replaces older messages with a summary message', async () => {
    stubFetch('- decided X\n- fixed Y')
    const el = window.electron
    el.db.addMessage = vi.fn().mockImplementation(async (sessionId, role, content) => ({
      id: 'summary-1', session_id: sessionId, role, content, created_at: Date.now(),
    }))
    el.db.updateMessage = vi.fn().mockResolvedValue(undefined)
    el.db.deleteMessage = vi.fn().mockResolvedValue(undefined)

    const messages = Array.from({ length: 10 }, () => msg(40000))
    const result = await compactConversation('s1', messages, SETTINGS, 'gpt-4')

    expect(result.compacted).toBeGreaterThan(0)
    const summaryMsg = result.messages[0]
    expect(summaryMsg.role).toBe('system')
    expect(summaryMsg.content).toContain('Context compacted')
    expect(summaryMsg.content).toContain('- decided X')
    // Backdated to sort before the kept tail
    expect(summaryMsg.createdAt).toBe(messages[0].createdAt)
    expect(el.db.updateMessage).toHaveBeenCalledWith('summary-1', { created_at: messages[0].createdAt })
    // Old messages removed from the DB
    expect(el.db.deleteMessage).toHaveBeenCalledTimes(result.compacted)
    // Recent tail preserved verbatim at the end
    expect(result.messages[result.messages.length - 1].id).toBe(messages[9].id)
  })

  it('sends the older transcript to the summarizer with auth', async () => {
    const fetchMock = stubFetch()
    window.electron.db.addMessage = vi.fn().mockResolvedValue(null)
    window.electron.db.deleteMessage = vi.fn().mockResolvedValue(undefined)

    const messages = Array.from({ length: 10 }, () => msg(40000))
    await compactConversation('s1', messages, SETTINGS, 'gpt-4')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.stream).toBe(false)
    expect(body.messages[1].content).toContain('user: xxx')
  })

  it('throws when the summarizer fails, leaving the DB untouched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const deleteSpy = vi.fn()
    window.electron.db.deleteMessage = deleteSpy

    const messages = Array.from({ length: 10 }, () => msg(40000))
    await expect(compactConversation('s1', messages, SETTINGS, 'gpt-4')).rejects.toThrow()
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
