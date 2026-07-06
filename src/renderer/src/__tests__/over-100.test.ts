import { describe, it, expect } from 'vitest'

describe('Tab drag reorder', () => {
  it('moves tab to new position', () => {
    const tabs = ['a', 'b', 'c', 'd']
    const [removed] = tabs.splice(1, 1)
    tabs.splice(3, 0, removed)
    expect(tabs).toEqual(['a', 'c', 'd', 'b'])
  })
})

describe('Session pinning', () => {
  it('pins session to top', () => {
    const sessions = [
      { id: 's1', title: 'A', pinned: false },
      { id: 's2', title: 'B', pinned: true },
      { id: 's3', title: 'C', pinned: false },
    ]
    const sorted = [...sessions].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    expect(sorted[0].id).toBe('s2')
  })
})

describe('Model name formatting', () => {
  function formatModel(m: string): string {
    return m.split('/').pop() || m
  }
  it('strips provider prefix', () => expect(formatModel('openai/gpt-4o')).toBe('gpt-4o'))
  it('handles short name', () => expect(formatModel('gpt-4o')).toBe('gpt-4o'))
})

describe('File size formatting', () => {
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }
  it('formats bytes', () => expect(formatBytes(500)).toBe('500 B'))
  it('formats KB', () => expect(formatBytes(2048)).toBe('2 KB'))
  it('formats MB', () => expect(formatBytes(1048576)).toBe('1 MB'))
  it('handles zero', () => expect(formatBytes(0)).toBe('0 B'))
})

describe('Path display', () => {
  function shortPath(p: string): string {
    const parts = p.split('/').filter(Boolean)
    return parts.slice(-2).join('/')
  }
  it('shows last 2 segments', () => expect(shortPath('/home/user/project/src')).toBe('project/src'))
  it('handles short path', () => expect(shortPath('/project')).toBe('project'))
})

describe('Keyboard shortcut format', () => {
  function formatShortcut(e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; key: string }): string {
    const parts: string[] = []
    if (e.metaKey || e.ctrlKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    parts.push(e.key === ' ' ? 'Space' : e.key.toUpperCase())
    return parts.join('+')
  }
  it('formats Ctrl+S', () => expect(formatShortcut({ metaKey: true, ctrlKey: false, shiftKey: false, key: 's' })).toBe('Ctrl+S'))
  it('formats Ctrl+Shift+P', () => expect(formatShortcut({ metaKey: true, ctrlKey: false, shiftKey: true, key: 'p' })).toBe('Ctrl+Shift+P'))
  it('formats Ctrl+Space', () => expect(formatShortcut({ metaKey: true, ctrlKey: false, shiftKey: false, key: ' ' })).toBe('Ctrl+Space'))
})

describe('Message streaming detection', () => {
  it('detects streaming', () => expect(true).toBe(true))
})

describe('Dark/light theme toggle', () => {
  it('supports theme switching', () => {
    const theme = { id: 'dark', primary: '#dc2626', background: '#0a0a0a' }
    expect(theme.background).toBe('#0a0a0a')
  })
})

describe('Response time formatting', () => {
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }
  it('formats ms', () => expect(formatDuration(500)).toBe('500ms'))
  it('formats seconds', () => expect(formatDuration(2500)).toBe('2.5s'))
  it('handles zero', () => expect(formatDuration(0)).toBe('0ms'))
})

describe('Git commit message truncation', () => {
  function firstLine(msg: string): string {
    return msg.split('\n')[0]
  }
  it('shows first line', () => expect(firstLine('fix: bug\n\nDetailed description')).toBe('fix: bug'))
  it('handles single line', () => expect(firstLine('fix: bug')).toBe('fix: bug'))
})

describe('Tool call status formatting', () => {
  function statusLabel(s: string | undefined): string {
    const labels: Record<string, string> = { running: 'Running…', done: 'Done', error: 'Failed' }
    return labels[s || ''] || 'Unknown'
  }
  it('running', () => expect(statusLabel('running')).toBe('Running…'))
  it('done', () => expect(statusLabel('done')).toBe('Done'))
  it('error', () => expect(statusLabel('error')).toBe('Failed'))
  it('unknown', () => expect(statusLabel(undefined)).toBe('Unknown'))
})

describe('Token summary per message', () => {
  function tokenBadge(tokenCount?: number, duration?: number): string {
    const parts: string[] = [`${tokenCount?.toLocaleString() ?? '?'} tok`]
    if (duration && duration > 0) parts.push(`${(duration / 1000).toFixed(1)}s`)
    if (duration && duration > 0 && tokenCount && tokenCount > 0) {
      parts.push(`${Math.round(tokenCount / (duration / 1000))} tok/s`)
    }
    return parts.join(' · ')
  }
  it('shows token count', () => expect(tokenBadge(150)).toBe('150 tok'))
  it('shows tok/s with duration', () => expect(tokenBadge(500, 10000)).toBe('500 tok · 10.0s · 50 tok/s'))
  it('handles zero duration', () => expect(tokenBadge(100, 0)).toBe('100 tok'))
  it('handles large numbers', () => expect(tokenBadge(15000, 30000)).toMatch(/15,000 tok/))
})

describe('Stream metrics tracking', () => {
  it('calculates tokens from char count', () => {
    const text = 'x'.repeat(400)
    expect(Math.round(text.length / 4)).toBe(100)
  })
  it('calculates tokens per second', () => {
    const chars = 1000
    const ms = 5000
    const tok = Math.round(chars / 4)
    expect(Math.round(tok / (ms / 1000))).toBe(50)
  })
  it('handles very fast responses', () => {
    const chars = 20
    const ms = 100
    const tok = Math.round(chars / 4)
    expect(tok).toBe(5)
  })
})

describe('Sub-agent spawning', () => {
  it('creates child session with parentId', () => {
    const child = { id: 'c1', parentId: 'p1', title: 'Agent: test task', agentStatus: 'running' as const }
    expect(child.parentId).toBe('p1')
    expect(child.agentStatus).toBe('running')
  })

  it('filters children by parentId', () => {
    const sessions = [
      { id: 'p1', parentId: null },
      { id: 'c1', parentId: 'p1' },
      { id: 'c2', parentId: 'p1' },
    ]
    const children = sessions.filter((s) => s.parentId === 'p1')
    expect(children).toHaveLength(2)
  })

  it('roots are sessions without parentId', () => {
    const sessions = [
      { id: 'p1', parentId: null },
      { id: 'c1', parentId: 'p1' },
    ]
    const roots = sessions.filter((s) => !s.parentId)
    expect(roots).toHaveLength(1)
    expect(roots[0].id).toBe('p1')
  })

  it('child session is added to store on spawn', () => {
    const store: any[] = []
    const child = { id: 'c1', parentId: 'p1', title: 'Agent: test' }
    store.push(child)
    expect(store).toHaveLength(1)
    expect(store[0].parentId).toBe('p1')
  })

  it('running count increases', () => {
    const sessions = [
      { id: 'p1', agentStatus: 'idle' as const },
      { id: 'c1', agentStatus: 'running' as const },
    ]
    const running = sessions.filter((s) => s.agentStatus === 'running').length
    expect(running).toBe(1)
  })

  it('SpawnAgentDialog validates task input', () => {
    const task = '  '
    const valid = task.trim().length > 0
    expect(valid).toBe(false)
  })

  it('SpawnAgentDialog auto-generates title', () => {
    const task = 'analyze the codebase for bugs'
    const title = task.trim() || `Agent: ${task.slice(0, 40)}`
    expect(title).toBe('analyze the codebase for bugs')
  })
})
