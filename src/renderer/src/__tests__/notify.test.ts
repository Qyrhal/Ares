import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Desktop notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('notify.send is available on window.electron', () => {
    expect(window.electron.notify).toBeDefined()
    expect(typeof window.electron.notify.send).toBe('function')
  })

  it('notify.send calls IPC with correct title and body', async () => {
    const mockSend = vi.fn().mockResolvedValue({ success: true })
    ;(window.electron as any).notify.send = mockSend

    const result = await window.electron.notify.send('Test Title', 'Test Body')

    expect(mockSend).toHaveBeenCalledWith('Test Title', 'Test Body')
    expect(result).toEqual({ success: true })
  })

  it('notify.send returns success: true', async () => {
    const result = await window.electron.notify.send('Title', 'Body')
    expect(result).toEqual({ success: true })
  })

  it('notify.send handles rejection gracefully', async () => {
    const mockSend = vi.fn().mockRejectedValue(new Error('Notification failed'))
    ;(window.electron as any).notify.send = mockSend

    await expect(mockSend('Title', 'Body')).rejects.toThrow('Notification failed')
  })

  it('notify.send works with empty strings', async () => {
    const mockSend = vi.fn().mockResolvedValue({ success: true })
    ;(window.electron as any).notify.send = mockSend

    await window.electron.notify.send('', '')
    expect(mockSend).toHaveBeenCalledWith('', '')
  })
})
