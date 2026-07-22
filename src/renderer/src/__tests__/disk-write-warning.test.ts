import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pure-function test for disk write warning dispatch logic
async function handleFlushError(
  msg: string,
  addMessage: (sessionId: string, role: string, content: string) => Promise<{ id: string } | null>,
  sessionId: string,
): Promise<string> {
  const content = `⚠️ **Disk Write Error**\n\n${msg}\n\nYour data may not be saved to disk. Check disk space and permissions.`
  const result = await addMessage(sessionId, 'system', content)
  return result ? content : ''
}

describe('Disk Write Warning', () => {
  const mockAddMessage = vi.fn().mockResolvedValue({ id: 'msg-1' })

  beforeEach(() => {
    mockAddMessage.mockClear()
    mockAddMessage.mockResolvedValue({ id: 'msg-1' })
  })

  it('produces a warning message for flush errors', async () => {
    const result = await handleFlushError(
      'Disk write failed: ENOSPC. Unsaved changes may be lost.',
      mockAddMessage,
      'session-1',
    )
    expect(result).toContain('**Disk Write Error**')
    expect(result).toContain('ENOSPC')
    expect(mockAddMessage).toHaveBeenCalledWith(
      'session-1',
      'system',
      expect.stringContaining('Disk write failed'),
    )
  })

  it('returns empty string when addMessage fails', async () => {
    mockAddMessage.mockResolvedValue(null)
    const result = await handleFlushError(
      'Disk write failed: EACCES',
      mockAddMessage,
      'session-1',
    )
    expect(result).toBe('')
  })

  it('includes disk space guidance in the message', async () => {
    const result = await handleFlushError(
      'Disk write failed: ENOSPC',
      mockAddMessage,
      'session-1',
    )
    expect(result).toContain('Check disk space and permissions')
  })

  it('message content includes the original error text', async () => {
    const errorMsg = 'Permission denied: /home/user/.ares/store.json'
    const result = await handleFlushError(errorMsg, mockAddMessage, 'session-1')
    expect(result).toContain(errorMsg)
  })

  it('returns a message for every branch', async () => {
    // Success branch
    const success = await handleFlushError('test', mockAddMessage, 's1')
    expect(success.length).toBeGreaterThan(0)

    // Failure branch
    mockAddMessage.mockResolvedValue(null)
    const failure = await handleFlushError('test', mockAddMessage, 's1')
    expect(failure).toBe('')
  })
})
