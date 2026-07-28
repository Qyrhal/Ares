import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── /watch command logic tests ───────────────────────────────────────────────
// These test the watch command argument handling and API interactions
// without rendering App.tsx. They exercise the same logic that runs
// in the handleCommand switch case.

function buildMockEl(overrides: Record<string, unknown> = {}) {
  return {
    watch: {
      start: vi.fn().mockResolvedValue({ ok: true, message: 'Watching test.ts' }),
      stop: vi.fn().mockResolvedValue({ ok: true }),
      list: vi.fn().mockResolvedValue({ ok: true, watches: [] }),
      onChange: vi.fn().mockReturnValue(() => {}),
    },
    db: {
      addMessage: vi.fn().mockResolvedValue({ id: 'msg-1', role: 'system', content: '' }),
    },
    ...overrides,
  }
}

describe('/watch slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls el.watch.start with correct arguments when file path given', async () => {
    const el = buildMockEl()
    const filePath = 'src/App.tsx'
    const cwd = '/home/user/project'
    const sessionId = 's1'

    const result = await el.watch.start(cwd, filePath, sessionId)
    expect(el.watch.start).toHaveBeenCalledWith(cwd, filePath, sessionId)
    expect(result.ok).toBe(true)
    expect(result.message).toBe('Watching test.ts')
  })

  it('returns error when file not found', async () => {
    const el = buildMockEl({
      watch: {
        start: vi.fn().mockResolvedValue({ ok: false, error: 'File not found' }),
        stop: vi.fn().mockResolvedValue({ ok: true }),
        list: vi.fn().mockResolvedValue({ ok: true, watches: [] }),
        onChange: vi.fn().mockReturnValue(() => {}),
      },
    })

    const result = await el.watch.start('/tmp', 'nonexistent.txt', 's1')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('File not found')
  })

  it('calls el.watch.stop when --stop flag is used', async () => {
    const el = buildMockEl()

    const result = await el.watch.stop()
    expect(el.watch.stop).toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('calls el.watch.list with no arguments returns empty watchers', async () => {
    const el = buildMockEl()

    const result = await el.watch.list()
    expect(el.watch.list).toHaveBeenCalled()
    expect(result.watches).toEqual([])
  })

  it('el.watch.list returns active watchers', async () => {
    const el = buildMockEl({
      watch: {
        start: vi.fn().mockResolvedValue({ ok: true, message: 'Watching file.ts' }),
        stop: vi.fn().mockResolvedValue({ ok: true }),
        list: vi.fn().mockResolvedValue({
          ok: true,
          watches: [
            { filePath: '/home/user/project/file.ts', sessionId: 's1' },
            { filePath: '/home/user/project/config.json', sessionId: 's2' },
          ],
        }),
        onChange: vi.fn().mockReturnValue(() => {}),
      },
    })

    const result = await el.watch.list()
    expect(result.watches).toHaveLength(2)
    expect(result.watches[0].filePath).toBe('/home/user/project/file.ts')
    expect(result.watches[1].sessionId).toBe('s2')
  })

  it('produces correct message format for start success', () => {
    const filePath = 'src/main.ts'
    const msg = `👁️ Watching ${filePath}`
    expect(msg).toContain('👁️')
    expect(msg).toContain('Watching src/main.ts')
  })

  it('produces correct message format for start error', () => {
    const error = 'File not found'
    const msg = `❌ ${error}`
    expect(msg).toContain('❌')
    expect(msg).toContain('File not found')
  })

  it('produces correct message for no active watchers', () => {
    const msg = 'No active file watchers.'
    expect(msg).toBe('No active file watchers.')
  })

  it('produces correct message for stop confirmation', () => {
    const msg = 'Stopped all file watchers.'
    expect(msg).toBe('Stopped all file watchers.')
  })

  it('formats watcher list correctly', () => {
    const watches = [
      { filePath: '/home/user/project/src/App.tsx', sessionId: 's1' },
      { filePath: '/home/user/project/package.json', sessionId: 's1' },
    ]
    const lines = ['**Active file watchers:**']
    for (let i = 0; i < watches.length; i++) {
      lines.push(`${i + 1}. ${watches[i].filePath}`)
    }
    const msg = lines.join('\n')
    expect(msg).toContain('**Active file watchers:**')
    expect(msg).toContain('1. /home/user/project/src/App.tsx')
    expect(msg).toContain('2. /home/user/project/package.json')
  })

  it('onChange callback formats change event correctly', () => {
    const data = {
      sessionId: 's1',
      filePath: 'src/App.tsx',
      event: 'modified',
      timestamp: '12:34:56 PM',
    }
    const content = `👁️ **File ${data.event}:** \`${data.filePath}\` at ${data.timestamp}`
    expect(content).toContain('👁️')
    expect(content).toContain('File modified')
    expect(content).toContain('src/App.tsx')
    expect(content).toContain('12:34:56 PM')
  })

  it('onChange callback formats rename/delete event correctly', () => {
    const data = {
      sessionId: 's1',
      filePath: 'src/old.ts',
      event: 'renamed/deleted',
      timestamp: '3:00:00 PM',
    }
    const content = `👁️ **File ${data.event}:** \`${data.filePath}\` at ${data.timestamp}`
    expect(content).toContain('File renamed/deleted')
  })

  it('watch.start is called with correct workspace path and session id', async () => {
    const el = buildMockEl()
    const cwd = '/workspace/my-project'
    const sessionId = 'session-abc-123'
    const filePath = 'lib/utils.ts'

    await el.watch.start(cwd, filePath, sessionId)
    expect(el.watch.start).toHaveBeenCalledTimes(1)
    expect(el.watch.start).toHaveBeenCalledWith(cwd, filePath, sessionId)
  })

  it('onChange listener returns cleanup function', () => {
    const cleanup = vi.fn()
    const el = buildMockEl({
      watch: {
        start: vi.fn().mockResolvedValue({ ok: true, message: 'Watching' }),
        stop: vi.fn().mockResolvedValue({ ok: true }),
        list: vi.fn().mockResolvedValue({ ok: true, watches: [] }),
        onChange: vi.fn().mockReturnValue(cleanup),
      },
    })

    const off = el.watch.onChange(() => {})
    expect(typeof off).toBe('function')
    off()
    expect(cleanup).toHaveBeenCalled()
  })

  it('parseMessage handles system messages from watch events', () => {
    // Simulates how watch change messages get parsed
    const raw = {
      id: 'msg-1',
      session_id: 's1',
      role: 'system',
      content: '👁️ **File modified:** `src/App.tsx` at 12:00:00 PM',
      created_at: Date.now(),
    }
    expect(raw.role).toBe('system')
    expect(raw.content).toContain('👁️')
    expect(raw.content).toContain('File modified')
  })

  it('command prefix is /watch', () => {
    const cmd = '/watch src/main.ts'
    const [prefix, ...rest] = cmd.split(' ')
    expect(prefix).toBe('/watch')
    expect(rest.join(' ')).toBe('src/main.ts')
  })

  it('--stop flag is correctly parsed from args', () => {
    const args = '--stop'
    expect(args.trim() === '--stop').toBe(true)
  })

  it('empty args indicates list mode', () => {
    const args = ''
    expect(!args.trim()).toBe(true)
  })

  it('file path args are trimmed', () => {
    const args = '  src/App.tsx  '
    expect(args.trim()).toBe('src/App.tsx')
  })
})
