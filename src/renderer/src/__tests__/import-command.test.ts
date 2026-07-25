import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * Simulates the /import command dispatch logic from App.tsx.
 * Pure function — no React, no DOM.
 */
async function handleImport(
  importFn: () => Promise<{ title: string; messages: unknown[] } | { error: string } | null>,
  createSessionFn: (title: string, model: string) => Promise<{ id: string; title: string; model: string }>,
  addMessageFn: (sessionId: string, role: string, content: string, opts?: object) => Promise<unknown>,
  currentModel: string,
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  try {
    const result = await importFn()
    if (!result) {
      pushMsg('Import cancelled.')
      return results
    }
    if ('error' in result) {
      pushMsg(`**Import failed:** ${result.error}`)
      return results
    }
    const newSession = await createSessionFn(`${result.title} (imported)`, currentModel)
    for (const m of result.messages) {
      const msg = m as { role: string; content: string; toolName?: string; toolInput?: string; toolOutput?: string; thinking?: string }
      await addMessageFn(newSession.id, msg.role, msg.content, {
        toolName: msg.toolName ?? undefined,
        toolInput: msg.toolInput ?? undefined,
        toolOutput: msg.toolOutput ?? undefined,
        thinking: msg.thinking ?? undefined,
      })
    }
    pushMsg(`**Imported** ${result.messages.length} messages from "${result.title}".`)
  } catch (e) {
    pushMsg(`**Import failed:** ${(e as Error).message}`)
  }

  return results
}

describe('/import command — session import from JSON', () => {
  const mockSession = { id: 'new-1', title: 'Test (imported)', model: 'gpt-4o' }
  const defaultCreateSession = vi.fn().mockResolvedValue(mockSession)
  const defaultAddMessage = vi.fn().mockResolvedValue({})

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('imports a session with messages', async () => {
    const importFn = vi.fn().mockResolvedValue({
      title: 'My Session',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
    })

    const result = await handleImport(importFn, defaultCreateSession, defaultAddMessage, 'gpt-4o')

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('Imported')
    expect(result[0].content).toContain('2 messages')
    expect(result[0].content).toContain('My Session')
    expect(defaultCreateSession).toHaveBeenCalledWith('My Session (imported)', 'gpt-4o')
    expect(defaultAddMessage).toHaveBeenCalledTimes(2)
  })

  it('handles cancelled import', async () => {
    const importFn = vi.fn().mockResolvedValue(null)

    const result = await handleImport(importFn, defaultCreateSession, defaultAddMessage, 'gpt-4o')

    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('Import cancelled.')
    expect(defaultCreateSession).not.toHaveBeenCalled()
  })

  it('handles import error from dialog', async () => {
    const importFn = vi.fn().mockResolvedValue({ error: 'Invalid session file format' })

    const result = await handleImport(importFn, defaultCreateSession, defaultAddMessage, 'gpt-4o')

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('Import failed')
    expect(result[0].content).toContain('Invalid session file format')
    expect(defaultCreateSession).not.toHaveBeenCalled()
  })

  it('handles thrown exceptions', async () => {
    const importFn = vi.fn().mockRejectedValue(new Error('File read error'))

    const result = await handleImport(importFn, defaultCreateSession, defaultAddMessage, 'gpt-4o')

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('Import failed')
    expect(result[0].content).toContain('File read error')
  })

  it('preserves message metadata (toolName, thinking)', async () => {
    const importFn = vi.fn().mockResolvedValue({
      title: 'Tool Session',
      messages: [
        { role: 'user', content: 'Run test' },
        { role: 'assistant', content: '', toolName: 'test:run', toolInput: '{"cwd":"/tmp"}', toolOutput: '3 passed' },
        { role: 'assistant', content: 'All tests passed.', thinking: 'The tests look good.' },
      ],
    })

    const result = await handleImport(importFn, defaultCreateSession, defaultAddMessage, 'claude-3')

    expect(result[0].content).toContain('3 messages')
    expect(defaultAddMessage).toHaveBeenCalledTimes(3)
    // Check metadata was passed through
    expect(defaultAddMessage).toHaveBeenCalledWith(
      'new-1', 'assistant', '',
      expect.objectContaining({ toolName: 'test:run' })
    )
    expect(defaultAddMessage).toHaveBeenCalledWith(
      'new-1', 'assistant', 'All tests passed.',
      expect.objectContaining({ thinking: 'The tests look good.' })
    )
  })

  it('imports session with empty messages', async () => {
    const importFn = vi.fn().mockResolvedValue({
      title: 'Empty Session',
      messages: [],
    })

    const result = await handleImport(importFn, defaultCreateSession, defaultAddMessage, 'gpt-4o')

    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('0 messages')
    expect(defaultCreateSession).toHaveBeenCalled()
    expect(defaultAddMessage).not.toHaveBeenCalled()
  })
})
