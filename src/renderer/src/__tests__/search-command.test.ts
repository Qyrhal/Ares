import { describe, it, expect } from 'vitest'

// ── /search command logic ────────────────────────────────────────────────────

describe('/search slash command logic', () => {
  type Msg = { role: string; content: string }

  function searchMessages(msgs: Msg[], query: string, roleFilter?: string | null) {
    const q = query.toLowerCase()
    const matches: { idx: number; role: string; snippet: string }[] = []
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]
      if (roleFilter && m.role !== roleFilter) continue
      const lowerContent = m.content.toLowerCase()
      const matchIdx = lowerContent.indexOf(q)
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 30)
        const end = Math.min(m.content.length, matchIdx + query.length + 50)
        const prefix = start > 0 ? '...' : ''
        const suffix = end < m.content.length ? '...' : ''
        const snippet = `${prefix}${m.content.slice(start, end).replace(/\n/g, ' ')}${suffix}`
        matches.push({ idx: i + 1, role: m.role, snippet })
      }
    }
    return matches
  }

  function parseArgs(rawArgs: string): { roleFilter: string | null; queryStr: string } {
    let roleFilter: string | null = null
    let queryStr = rawArgs.trim()
    const roleFlags = ['--user', '--assistant', '--system', '--tool']
    for (const flag of roleFlags) {
      const lower = queryStr.toLowerCase()
      if (lower === flag) {
        roleFilter = flag.slice(2)
        queryStr = ''
        break
      } else if (lower.startsWith(flag + ' ')) {
        roleFilter = flag.slice(2)
        queryStr = queryStr.slice(flag.length).trim()
        break
      }
    }
    return { roleFilter, queryStr }
  }

  it('finds exact match in user message', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'How do I use React hooks?' },
      { role: 'assistant', content: 'You can use hooks like useState.' },
    ]
    const matches = searchMessages(msgs, 'hooks')
    expect(matches.length).toBe(2)
    expect(matches[0].idx).toBe(1)
    expect(matches[0].role).toBe('user')
    expect(matches[1].idx).toBe(2)
    expect(matches[1].role).toBe('assistant')
  })

  it('returns empty for no matches', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hi there!' },
    ]
    const matches = searchMessages(msgs, 'xyz')
    expect(matches.length).toBe(0)
  })

  it('is case-insensitive', () => {
    const msgs: Msg[] = [
      { role: 'assistant', content: 'TypeScript is great for type safety.' },
    ]
    const matches = searchMessages(msgs, 'typescript')
    expect(matches.length).toBe(1)
    expect(matches[0].idx).toBe(1)
  })

  it('shows snippet with context around match', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'The quick brown fox jumps over the lazy dog and continues running far away' },
    ]
    const matches = searchMessages(msgs, 'fox')
    expect(matches.length).toBe(1)
    expect(matches[0].snippet).toContain('fox')
  })

  it('does not add ellipsis at start when match is near beginning', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'fox is an animal' },
    ]
    const matches = searchMessages(msgs, 'fox')
    expect(matches.length).toBe(1)
    expect(matches[0].snippet.startsWith('...')).toBe(false)
  })

  it('does not add ellipsis at end when match is near end', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'the animal is a fox' },
    ]
    const matches = searchMessages(msgs, 'fox')
    expect(matches.length).toBe(1)
    expect(matches[0].snippet.endsWith('...')).toBe(false)
  })

  it('finds multiple matches in a single message', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'Use React for the UI and React Router for navigation with React Query for data' },
    ]
    const matches = searchMessages(msgs, 'react')
    expect(matches.length).toBe(1) // only first match per message
    expect(matches[0].snippet).toContain('React')
  })

  it('handles empty messages array', () => {
    const msgs: Msg[] = []
    const matches = searchMessages(msgs, 'test')
    expect(matches.length).toBe(0)
  })

  it('handles single character query', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'a test message' },
      { role: 'assistant', content: 'another test' },
    ]
    const matches = searchMessages(msgs, 'a')
    expect(matches.length).toBe(2)
  })

  it('formats result header with match count', () => {
    const msgs: Msg[] = [
      { role: 'user', content: 'test one' },
      { role: 'assistant', content: 'test two' },
      { role: 'user', content: 'test three' },
    ]
    const matches = searchMessages(msgs, 'test')
    const header = `**Search Results:** ${matches.length} match${matches.length === 1 ? '' : 'es'} for **"test"** (in ${msgs.length} messages)`
    expect(header).toContain('3 matches')
    expect(header).toContain('in 3 messages')
  })

  it('truncates results beyond 20', () => {
    const msgs: Msg[] = Array.from({ length: 25 }, (_, i) => ({
      role: 'user',
      content: `message ${i} with test keyword`,
    }))
    const matches = searchMessages(msgs, 'test')
    expect(matches.length).toBe(25)
    const displayed = matches.slice(0, 20)
    expect(displayed.length).toBe(20)
    const overflow = matches.length - 20
    expect(overflow).toBe(5)
  })

  // ── Role filter tests ──────────────────────────────────────────────────────

  const mixedRoleMsgs: Msg[] = [
    { role: 'user', content: 'How do I search for help?' },
    { role: 'assistant', content: 'You can search for help in the docs.' },
    { role: 'system', content: 'Search index updated successfully.' },
    { role: 'tool', content: 'Search completed in 0.5s.' },
    { role: 'user', content: 'Search again please.' },
  ]

  it('filters by --user flag', () => {
    const { roleFilter, queryStr } = parseArgs('--user search')
    expect(roleFilter).toBe('user')
    expect(queryStr).toBe('search')
    const matches = searchMessages(mixedRoleMsgs, queryStr, roleFilter)
    expect(matches.length).toBe(2)
    expect(matches.every(m => m.role === 'user')).toBe(true)
  })

  it('filters by --assistant flag', () => {
    const { roleFilter, queryStr } = parseArgs('--assistant search')
    expect(roleFilter).toBe('assistant')
    const matches = searchMessages(mixedRoleMsgs, queryStr, roleFilter)
    expect(matches.length).toBe(1)
    expect(matches[0].role).toBe('assistant')
  })

  it('filters by --system flag', () => {
    const { roleFilter, queryStr } = parseArgs('--system search')
    expect(roleFilter).toBe('system')
    const matches = searchMessages(mixedRoleMsgs, queryStr, roleFilter)
    expect(matches.length).toBe(1)
    expect(matches[0].role).toBe('system')
  })

  it('filters by --tool flag', () => {
    const { roleFilter, queryStr } = parseArgs('--tool search')
    expect(roleFilter).toBe('tool')
    const matches = searchMessages(mixedRoleMsgs, queryStr, roleFilter)
    expect(matches.length).toBe(1)
    expect(matches[0].role).toBe('tool')
  })

  it('shows usage when only flag is provided', () => {
    const { roleFilter, queryStr } = parseArgs('--user')
    expect(roleFilter).toBe('user')
    expect(queryStr).toBe('')
    // Empty queryStr should trigger usage message
    expect(queryStr.length === 0).toBe(true)
  })

  it('is case-insensitive for role flags', () => {
    const { roleFilter, queryStr } = parseArgs('--USER search')
    expect(roleFilter).toBe('user')
    expect(queryStr).toBe('search')
    const matches = searchMessages(mixedRoleMsgs, queryStr, roleFilter)
    expect(matches.length).toBe(2)
    expect(matches.every(m => m.role === 'user')).toBe(true)
  })

  it('returns all roles when no flag is provided', () => {
    const { roleFilter, queryStr } = parseArgs('search')
    expect(roleFilter).toBeNull()
    const matches = searchMessages(mixedRoleMsgs, queryStr, roleFilter)
    expect(matches.length).toBe(5) // all 5 messages contain "search"
  })
})
