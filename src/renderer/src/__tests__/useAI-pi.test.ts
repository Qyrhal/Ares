import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAI } from '@/hooks/useAI'
import type { AppSettings, Message } from '@/types'

const BASE: AppSettings = {
  apiKey: 'sk-test',
  apiBaseUrl: 'http://localhost:11434/v1',
  defaultModel: 'llama3',
  themeId: 'red',
  systemPrompt: '',
  permissionMode: 'ask',
}

const userMsg = (content: string, sessionId = 's1'): Message => ({
  id: '1', sessionId, role: 'user', content, createdAt: 0,
})

beforeEach(() => {
  vi.clearAllMocks()
  window.electron.pi.onDelta = vi.fn().mockReturnValue(() => {})
  window.electron.pi.onDone = vi.fn().mockReturnValue(() => {})
  window.electron.pi.onToolStart = vi.fn().mockReturnValue(() => {})
  window.electron.pi.onToolEnd = vi.fn().mockReturnValue(() => {})
  window.electron.pi.onError = vi.fn().mockReturnValue(() => {})
  window.electron.pi.send = vi.fn()
})

// ── isConfigured ──────────────────────────────────────────────────────────────

describe('useAI — isConfigured', () => {
  it('is true when apiBaseUrl is set (even without a key)', () => {
    const { result } = renderHook(() => useAI({ ...BASE, apiKey: '' }))
    expect(result.current.isConfigured).toBe(true)
  })

  it('is false when apiBaseUrl is empty', () => {
    const { result } = renderHook(() => useAI({ ...BASE, apiBaseUrl: '' }))
    expect(result.current.isConfigured).toBe(false)
  })

  it('is false when apiBaseUrl is whitespace only', () => {
    const { result } = renderHook(() => useAI({ ...BASE, apiBaseUrl: '   ' }))
    expect(result.current.isConfigured).toBe(false)
  })
})

// ── no-endpoint fallback ──────────────────────────────────────────────────────

describe('useAI — no-endpoint fallback', () => {
  it('calls onDone with setup instructions when apiBaseUrl is empty', async () => {
    const { result } = renderHook(() => useAI({ ...BASE, apiBaseUrl: '' }))
    const onDone = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hello')], vi.fn(), onDone)
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('No API endpoint configured'))
    expect(window.electron.pi.send).not.toHaveBeenCalled()
  })

  it('streams the fallback message token by token', async () => {
    const { result } = renderHook(() => useAI({ ...BASE, apiBaseUrl: '' }))
    const onStream = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], onStream, vi.fn())
    expect(onStream.mock.calls.length).toBeGreaterThan(1)
  })
})

// ── early exit ────────────────────────────────────────────────────────────────

describe('useAI — early exit', () => {
  it('does nothing when messages array is empty', async () => {
    const { result } = renderHook(() => useAI(BASE))
    const onDone = vi.fn()
    await result.current.sendMessage('llama3', [], vi.fn(), onDone)
    expect(window.electron.pi.send).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('does nothing when there is no user message', async () => {
    const { result } = renderHook(() => useAI(BASE))
    const sysMsg: Message = { id: '0', sessionId: 's1', role: 'system', content: 'sys', createdAt: 0 }
    const onDone = vi.fn()
    await result.current.sendMessage('llama3', [sysMsg], vi.fn(), onDone)
    expect(window.electron.pi.send).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})

// ── IPC send ──────────────────────────────────────────────────────────────────

describe('useAI — IPC send', () => {
  it('calls pi.send with apiBaseUrl, apiKey, and last user message', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => doneCb?.(sentReqId, 'response'), 0)
    })

    await result.current.sendMessage('llama3', [userMsg('write a test')], vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, undefined, '/workspace')

    expect(window.electron.pi.send).toHaveBeenCalledWith(
      expect.any(String),
      's1',
      'write a test',
      'llama3',
      'http://localhost:11434/v1',
      'sk-test',
      '/workspace',
    )
  })

  it('uses last user message when conversation has multiple turns', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => doneCb?.(sentReqId, 'ok'), 0)
    })

    const msgs: Message[] = [
      { id: '1', sessionId: 's1', role: 'user', content: 'first', createdAt: 0 },
      { id: '2', sessionId: 's1', role: 'assistant', content: 'hi', createdAt: 1 },
      { id: '3', sessionId: 's1', role: 'user', content: 'second', createdAt: 2 },
    ]
    await result.current.sendMessage('llama3', msgs, vi.fn(), vi.fn())

    const sendArgs = (window.electron.pi.send as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sendArgs[2]).toBe('second')
  })

  it('passes null as cwd when no workspacePath', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => doneCb?.(sentReqId, 'ok'), 0)
    })

    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), vi.fn())

    const sendArgs = (window.electron.pi.send as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sendArgs[6]).toBeNull()
  })

  it('streams delta events into onStream', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let deltaCb: ((id: string, text: string) => void) | null = null
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onDelta = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      deltaCb = cb; return () => {}
    })
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => {
        deltaCb?.(sentReqId, 'Hello')
        deltaCb?.(sentReqId, 'Hello world')
        doneCb?.(sentReqId, 'Hello world')
      }, 0)
    })

    const onStream = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], onStream, vi.fn())
    expect(onStream).toHaveBeenCalledWith('Hello')
    expect(onStream).toHaveBeenCalledWith('Hello world')
  })

  it('ignores delta events for a different reqId', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let deltaCb: ((id: string, text: string) => void) | null = null
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onDelta = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      deltaCb = cb; return () => {}
    })
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => {
        deltaCb?.('wrong-id', 'should be ignored')
        deltaCb?.(sentReqId, 'correct')
        doneCb?.(sentReqId, 'correct')
      }, 0)
    })

    const onStream = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], onStream, vi.fn())
    expect(onStream).not.toHaveBeenCalledWith('should be ignored')
    expect(onStream).toHaveBeenCalledWith('correct')
  })
})

// ── tool events ───────────────────────────────────────────────────────────────

describe('useAI — tool events', () => {
  it('fires onToolCall on tool-start', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let toolStartCb: ((id: string, name: string, input: string) => void) | null = null
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onToolStart = vi.fn().mockImplementation((cb: (id: string, n: string, i: string) => void) => {
      toolStartCb = cb; return () => {}
    })
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => { toolStartCb?.(sentReqId, 'bash', '{"command":"ls"}'); doneCb?.(sentReqId, 'done') }, 0)
    })

    const onToolCall = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), vi.fn(), onToolCall)
    expect(onToolCall).toHaveBeenCalledWith('bash', '{"command":"ls"}')
  })

  it('fires onToolDone on tool-end success', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let toolEndCb: ((id: string, output: string, isError: boolean) => void) | null = null
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onToolEnd = vi.fn().mockImplementation((cb: (id: string, o: string, e: boolean) => void) => {
      toolEndCb = cb; return () => {}
    })
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => { toolEndCb?.(sentReqId, 'output text', false); doneCb?.(sentReqId, 'done') }, 0)
    })

    const onToolDone = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), vi.fn(), undefined, onToolDone)
    expect(onToolDone).toHaveBeenCalledWith('output text')
  })

  it('prefixes onToolDone output with Error: when isError is true', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let toolEndCb: ((id: string, output: string, isError: boolean) => void) | null = null
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onToolEnd = vi.fn().mockImplementation((cb: (id: string, o: string, e: boolean) => void) => {
      toolEndCb = cb; return () => {}
    })
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => { toolEndCb?.(sentReqId, 'command not found', true); doneCb?.(sentReqId, 'done') }, 0)
    })

    const onToolDone = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), vi.fn(), undefined, onToolDone)
    expect(onToolDone).toHaveBeenCalledWith('Error: command not found')
  })
})

// ── error handling ────────────────────────────────────────────────────────────

describe('useAI — error handling', () => {
  it('calls onError when pi:error fires', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let errorCb: ((id: string, msg: string) => void) | null = null
    window.electron.pi.onError = vi.fn().mockImplementation((cb: (id: string, msg: string) => void) => {
      errorCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => errorCb?.(sentReqId, 'API key invalid'), 0)
    })

    const onError = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), vi.fn(), undefined, undefined, onError)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'API key invalid' }))
  })

  it('falls back to onDone with error text when no onError handler', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let errorCb: ((id: string, msg: string) => void) | null = null
    window.electron.pi.onError = vi.fn().mockImplementation((cb: (id: string, msg: string) => void) => {
      errorCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => errorCb?.(sentReqId, 'model not found'), 0)
    })

    const onDone = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), onDone)
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('model not found'))
  })

  it('ignores error events for wrong reqId', async () => {
    const { result } = renderHook(() => useAI(BASE))

    let sentReqId = ''
    let errorCb: ((id: string, msg: string) => void) | null = null
    let doneCb: ((id: string, text: string) => void) | null = null
    window.electron.pi.onError = vi.fn().mockImplementation((cb: (id: string, msg: string) => void) => {
      errorCb = cb; return () => {}
    })
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return () => {}
    })
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => { errorCb?.('wrong-id', 'stray'); doneCb?.(sentReqId, 'success') }, 0)
    })

    const onError = vi.fn()
    const onDone = vi.fn()
    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), onDone, undefined, undefined, onError)
    expect(onError).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledWith('success', undefined)
  })

  it('cleans up all listeners after done fires', async () => {
    const { result } = renderHook(() => useAI(BASE))

    const unsubs = { delta: vi.fn(), done: vi.fn(), toolStart: vi.fn(), toolEnd: vi.fn(), error: vi.fn() }
    let sentReqId = ''
    let doneCb: ((id: string, text: string) => void) | null = null

    window.electron.pi.onDelta = vi.fn().mockReturnValue(unsubs.delta)
    window.electron.pi.onDone = vi.fn().mockImplementation((cb: (id: string, text: string) => void) => {
      doneCb = cb; return unsubs.done
    })
    window.electron.pi.onToolStart = vi.fn().mockReturnValue(unsubs.toolStart)
    window.electron.pi.onToolEnd = vi.fn().mockReturnValue(unsubs.toolEnd)
    window.electron.pi.onError = vi.fn().mockReturnValue(unsubs.error)
    window.electron.pi.send = vi.fn().mockImplementation((reqId: string) => {
      sentReqId = reqId
      setTimeout(() => doneCb?.(sentReqId, 'done'), 0)
    })

    await result.current.sendMessage('llama3', [userMsg('hi')], vi.fn(), vi.fn())

    Object.values(unsubs).forEach((u) => expect(u).toHaveBeenCalled())
  })
})
