import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pure-function test for /clear and /clear --hard dispatch logic
interface ClearResult {
  kind: 'cleared' | 'reset'
  message?: string
}

async function handleClear(
  args: string | undefined,
  messages: { id: string }[],
  deleteMessage: (id: string) => Promise<void>,
  updateSession: (id: string, updates: object) => Promise<void>,
  addMessage: (sessionId: string, role: string, content: string) => Promise<{ id: string } | null>,
  sessionId: string,
  defaultModel: string,
): Promise<ClearResult> {
  // Clear all messages
  for (const m of messages) {
    await deleteMessage(m.id)
  }

  if (args === '--hard') {
    await updateSession(sessionId, { model: defaultModel, pinned: false, workspace_path: null })
    const msg = await addMessage(sessionId, 'system', '**Session reset.** Messages cleared, model restored to default, workspace cleared, session unpinned.')
    return { kind: 'reset', message: msg?.id ? 'ok' : undefined }
  }

  return { kind: 'cleared' }
}

describe('/clear command', () => {
  const mockDeleteMessage = vi.fn().mockResolvedValue(undefined)
  const mockUpdateSession = vi.fn().mockResolvedValue(undefined)
  const mockAddMessage = vi.fn().mockResolvedValue({ id: 'msg-1' })

  beforeEach(() => {
    mockDeleteMessage.mockClear()
    mockUpdateSession.mockClear()
    mockAddMessage.mockClear()
    mockDeleteMessage.mockResolvedValue(undefined)
    mockUpdateSession.mockResolvedValue(undefined)
    mockAddMessage.mockResolvedValue({ id: 'msg-1' })
  })

  it('clears messages without --hard flag', async () => {
    const messages = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
    const result = await handleClear(undefined, messages, mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'gpt-4o')
    expect(result.kind).toBe('cleared')
    expect(mockDeleteMessage).toHaveBeenCalledTimes(3)
    expect(mockDeleteMessage).toHaveBeenCalledWith('m1')
    expect(mockDeleteMessage).toHaveBeenCalledWith('m2')
    expect(mockDeleteMessage).toHaveBeenCalledWith('m3')
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('clears messages with empty args', async () => {
    const messages = [{ id: 'm1' }]
    const result = await handleClear('', messages, mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'gpt-4o')
    expect(result.kind).toBe('cleared')
    expect(mockDeleteMessage).toHaveBeenCalledTimes(1)
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('performs full reset with --hard flag', async () => {
    const messages = [{ id: 'm1' }, { id: 'm2' }]
    const result = await handleClear('--hard', messages, mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'deepseek-v4')
    expect(result.kind).toBe('reset')
    expect(mockDeleteMessage).toHaveBeenCalledTimes(2)
    expect(mockUpdateSession).toHaveBeenCalledWith('s1', {
      model: 'deepseek-v4',
      pinned: false,
      workspace_path: null,
    })
    expect(mockAddMessage).toHaveBeenCalledWith(
      's1',
      'system',
      expect.stringContaining('Session reset'),
    )
  })

  it('handles --hard with no messages', async () => {
    const result = await handleClear('--hard', [], mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'gpt-4o')
    expect(result.kind).toBe('reset')
    expect(mockDeleteMessage).not.toHaveBeenCalled()
    expect(mockUpdateSession).toHaveBeenCalled()
  })

  it('handles clear with no messages', async () => {
    const result = await handleClear(undefined, [], mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'gpt-4o')
    expect(result.kind).toBe('cleared')
    expect(mockDeleteMessage).not.toHaveBeenCalled()
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('reset message confirms all actions taken', async () => {
    await handleClear('--hard', [{ id: 'm1' }], mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'gpt-4o')
    const content = mockAddMessage.mock.calls[0][2]
    expect(content).toContain('Messages cleared')
    expect(content).toContain('model restored')
    expect(content).toContain('workspace cleared')
    expect(content).toContain('unpinned')
  })

  it('returns a result for every branch', async () => {
    const cleared = await handleClear(undefined, [], mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'gpt-4o')
    expect(cleared.kind).toBe('cleared')

    const reset = await handleClear('--hard', [], mockDeleteMessage, mockUpdateSession, mockAddMessage, 's1', 'gpt-4o')
    expect(reset.kind).toBe('reset')
  })
})
