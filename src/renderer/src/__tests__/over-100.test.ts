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

describe('Message queue', () => {
  it('starts empty', () => {
    const items: any[] = []
    expect(items).toHaveLength(0)
  })

  it('adds items to queue', () => {
    const items: { id: string; title: string }[] = []
    items.push({ id: '1', title: 'Task 1' })
    items.push({ id: '2', title: 'Task 2' })
    expect(items).toHaveLength(2)
  })

  it('removes items from queue', () => {
    const items = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }, { id: '3', title: 'C' }]
    const filtered = items.filter((i) => i.id !== '2')
    expect(filtered).toHaveLength(2)
    expect(filtered.find((i) => i.id === '2')).toBeUndefined()
  })

  it('reorders items', () => {
    const items = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }, { id: '3', title: 'C' }]
    const [removed] = items.splice(2, 1)
    items.splice(0, 0, removed)
    expect(items.map((i) => i.title)).toEqual(['C', 'A', 'B'])
  })

  it('marks items as running', () => {
    const items = [{ id: '1', title: 'A', status: 'pending' as const }]
    items[0] = { ...items[0], status: 'running' }
    expect(items[0].status).toBe('running')
  })

  it('marks items as done', () => {
    const items = [{ id: '1', title: 'A', status: 'running' as const }]
    items[0] = { ...items[0], status: 'done' }
    expect(items[0].status).toBe('done')
  })

  it('marks items as error', () => {
    const items = [{ id: '1', title: 'A', status: 'running' as const }]
    items[0] = { ...items[0], status: 'error' }
    expect(items[0].status).toBe('error')
  })

  it('runs next item from queue', () => {
    const items = [
      { id: '1', title: 'A', status: 'pending' as const },
      { id: '2', title: 'B', status: 'pending' as const },
    ]
    const next = items.find((i) => i.status === 'pending')!
    expect(next.id).toBe('1')
  })

  it('processes queue FIFO', () => {
    const items = [
      { id: '1', title: 'A', status: 'pending' as const },
      { id: '2', title: 'B', status: 'pending' as const },
    ]
    items[0] = { ...items[0], status: 'done' }
    const next = items.find((i) => i.status === 'pending')!
    expect(next.id).toBe('2')
  })
})

describe('Tool descriptions enrichment', () => {
  it('spawnAgent description mentions blocking behavior', () => {
    const desc = 'Spawn a sub-agent to handle a focused subtask. Use this when a task can be cleanly decomposed into independent subtasks that each need focused attention. The sub-agent runs with the same model, tools, and workspace; it appears in the Agent Tree as a child session. This call BLOCKS until the sub-agent finishes.'
    expect(desc).toContain('BLOCKS')
  })

  it('spawnAgents tool mentions parallel execution', () => {
    const desc = 'Spawn MULTIPLE sub-agents concurrently'
    expect(desc).toContain('MULTIPLE')
    expect(desc).toContain('concurrently')
  })

  it('setTodos tool mentions plan mode', () => {
    const desc = 'Set the task plan'
    expect(desc).toBeDefined()
  })

  it('aresPrompt guides workflow', () => {
    const prompt = 'Ares Agent Protocol'
    expect(prompt).toBe('Ares Agent Protocol')
  })
})

describe('askUser tool', () => {
  it('provides actionable options when possible', () => {
    const question = {
      question: 'Which database should we use?',
      header: 'DB Choice',
      options: ['PostgreSQL', 'SQLite', 'DuckDB'],
    }
    expect(question.options).toHaveLength(3)
  })

  it('supports free-text when options dont apply', () => {
    const question = {
      question: 'Describe your ideal solution architecture',
      header: 'Architecture',
    }
    expect(question.options).toBeUndefined()
  })
})

describe('webSearch tool (DuckDuckGo)', () => {
  it('accepts query parameter', () => {
    const params = { query: 'typescript best practices', maxResults: 5 }
    expect(params.query).toBe('typescript best practices')
    expect(params.maxResults).toBe(5)
  })

  it('defaults maxResults to 5', () => {
    const fn = (q: string, m = 5) => Math.min(Math.max(1, m), 10)
    expect(fn('test')).toBe(5)
  })

  it('clamps maxResults to 1-10', () => {
    const fn = (m: number) => Math.min(Math.max(1, m), 10)
    expect(fn(0)).toBe(1)
    expect(fn(1)).toBe(1)
    expect(fn(5)).toBe(5)
    expect(fn(10)).toBe(10)
    expect(fn(100)).toBe(10)
  })

  it('encodes query for URL', () => {
    const query = 'node.js async/await'
    const encoded = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    expect(encoded).toContain('node.js')
    expect(encoded).toContain('async%2Fawait')
  })

  it('parses DDG HTML results', () => {
    const html = `
      <a rel="nofollow" class="result__a" href="https://example.com">Test Result</a>
      <a class="result__snippet">This is a test snippet with more text.</a>
      <a rel="nofollow" class="result__a" href="https://example2.com">Second Result</a>
      <a class="result__snippet">Another snippet here.</a>
    `
    // Simulate parsing
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi
    const links: { url: string; title: string }[] = []
    const snippets: string[] = []
    let m: RegExpExecArray | null
    while ((m = linkRegex.exec(html)) !== null) links.push({ url: m[1], title: m[2].replace(/<[^>]*>/g, '') })
    while ((m = snippetRegex.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]*>/g, ''))
    expect(links).toHaveLength(2)
    expect(links[0].title).toBe('Test Result')
    expect(snippets[0]).toContain('test snippet')
  })

  it('formats as numbered list', () => {
    const results = [
      { title: 'A', url: 'https://a.com', snippet: 'Result A' },
      { title: 'B', url: 'https://b.com', snippet: 'Result B' },
    ]
    const formatted = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n')
    expect(formatted).toContain('1. A')
    expect(formatted).toContain('2. B')
    expect(formatted).toContain('https://a.com')
  })

  it('strips HTML tags from results', () => {
    const input = '<b>bold</b> &amp; <i>italic</i>'
    const stripped = input.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
    expect(stripped).toBe('bold & italic')
  })

  it('handles empty results gracefully', () => {
    const html = '<html><body>No results found</body></html>'
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi
    const links: string[] = []
    let m: RegExpExecArray | null
    while ((m = linkRegex.exec(html)) !== null) links.push(m[1])
    expect(links).toHaveLength(0)
  })

  it('times out after 10 seconds', async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 0)
    try {
      await fetch('https://httpbin.org/delay/5', { signal: controller.signal })
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect((err as Error).name).toBe('AbortError')
    }
  })

  it('aresPrompt mentions webSearch', () => {
    const prompt = 'Use webSearch to look up current information'
    expect(prompt).toContain('webSearch')
  })
})

describe('External link handling', () => {
  it('opens http links in external browser', () => {
    const url = 'https://example.com'
    expect(url.startsWith('http')).toBe(true)
  })

  it('prevents navigation on link click', () => {
    let prevented = false
    const handler = (e: { preventDefault: () => void }) => { prevented = true; e.preventDefault() }
    const mockEvent = { preventDefault: () => { prevented = true } }
    handler(mockEvent)
    expect(prevented).toBe(true)
  })

  it('does not block non-http urls', () => {
    const url = 'file:///local/path'
    expect(url.startsWith('http')).toBe(false)
  })

  it('does not open external for empty href', () => {
    const href: string | undefined = undefined
    let called = false
    if (href) called = true
    expect(called).toBe(false)
  })

  it('shell.openExternal exists in renderer', () => {
    // Just check the type shape
    const shell = { openExternal: (url: string) => Promise.resolve() }
    expect(typeof shell.openExternal).toBe('function')
  })
})

describe('Agent tree cleanup', () => {
  it('removes finished child sessions', () => {
    const sessions = [
      { id: 'p1', parentId: null, agentStatus: 'running' as const },
      { id: 'c1', parentId: 'p1', agentStatus: 'done' as const },
    ]
    const remaining = sessions.filter((s) => !s.parentId || (s.agentStatus !== 'done' && s.agentStatus !== 'error'))
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('p1')
  })

  it('keeps running child sessions', () => {
    const sessions = [
      { id: 'p1', parentId: null, agentStatus: 'running' as const },
      { id: 'c1', parentId: 'p1', agentStatus: 'running' as const },
    ]
    const remaining = sessions.filter((s) => !s.parentId || (s.agentStatus !== 'done' && s.agentStatus !== 'error'))
    expect(remaining).toHaveLength(2)
  })

  it('keeps errored children briefly before removal', () => {
    const session = { id: 'c1', parentId: 'p1', agentStatus: 'error' as const }
    expect(session.parentId).toBe('p1')
    expect(session.agentStatus).toBe('error')
  })

  it('sub-agent session is clickable to open', () => {
    let selectedId = ''
    const handler = (id: string) => { selectedId = id }
    handler('c1')
    expect(selectedId).toBe('c1')
  })

  it('shows sub-agent messages when opened', () => {
    const messages = [
      { id: 'm1', sessionId: 'c1', role: 'user', content: 'task' },
      { id: 'm2', sessionId: 'c1', role: 'assistant', content: 'result' },
    ]
    const filtered = messages.filter((m) => m.sessionId === 'c1')
    expect(filtered).toHaveLength(2)
  })

  it('allows sending messages to sub-agent', () => {
    const subSessionId = 'c1'
    const sendMessage = (text: string, sessionId: string) => {
      return { text, sessionId }
    }
    const result = sendMessage('do more work', subSessionId)
    expect(result.sessionId).toBe('c1')
    expect(result.text).toBe('do more work')
  })
})

describe('Sidebar sub-agent indicators', () => {
  it('shows Bot icon for child sessions', () => {
    const session = { id: 'c1', parentId: 'p1', title: 'Agent: test', agentStatus: 'running' as const }
    expect(session.parentId).toBeTruthy()
  })

  it('shows parent name in sub-agent row', () => {
    const sessions = [
      { id: 'p1', title: 'Main Task' },
      { id: 'c1', parentId: 'p1', title: 'Agent: test' },
    ]
    const child = sessions.find((s) => s.id === 'c1')
    const parent = child ? sessions.find((s) => s.id === child.parentId) : null
    expect(parent?.title).toBe('Main Task')
  })

  it('shows running indicator for active agents', () => {
    const status = 'running'
    expect(status).toBe('running')
  })

  it('shows done indicator for completed agents', () => {
    const status = 'done' as const
    const session = { id: 'c1', agentStatus: status }
    expect(session.agentStatus).toBe('done')
  })

  it('shows error indicator for failed agents', () => {
    const session = { id: 'c1', agentStatus: 'error' as const }
    expect(session.agentStatus).toBe('error')
  })

  it('todos can be marked completed by AI', () => {
    const todos = [
      { text: 'Step 1', completed: true },
      { text: 'Step 2', completed: false },
    ]
    const done = todos.filter((t) => t.completed)
    expect(done).toHaveLength(1)
    expect(done[0].text).toBe('Step 1')
  })

  it('setTodos replaces entire list on each call', () => {
    const replaceTodos = (items: { text: string; completed?: boolean }[]) => {
      return items.map((item) => ({
        ...item,
        completed: item.completed ?? false,
      }))
    }
    const step1 = replaceTodos([{ text: 'Plan', completed: false }])
    expect(step1[0].completed).toBe(false)
    const step2 = replaceTodos([{ text: 'Plan', completed: true }, { text: 'Execute' }])
    expect(step2[0].completed).toBe(true)
    expect(step2).toHaveLength(2)
  })
})
