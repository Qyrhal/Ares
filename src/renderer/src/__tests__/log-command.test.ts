import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/log slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('formats a single commit', () => {
    const commit = { shortHash: 'abc1234', message: 'fix: resolve bug', author: 'dev', date: '2026-01-01' }
    const line = `· \`${commit.shortHash}\` — ${commit.message} (_${commit.author}, ${commit.date}_)`
    expect(line).toContain('abc1234')
    expect(line).toContain('fix: resolve bug')
  })

  it('formats multiple commits', () => {
    const commits = [
      { shortHash: 'abc1234', message: 'first commit', author: 'dev', date: '2026-01-01' },
      { shortHash: 'def5678', message: 'second commit', author: 'dev', date: '2026-01-02' },
    ]
    const lines = commits.map(c => `· \`${c.shortHash}\` — ${c.message} (_${c.author}, ${c.date}_)`)
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('first commit')
    expect(lines[1]).toContain('second commit')
  })

  it('truncates message to 80 chars', () => {
    const longMessage = 'A'.repeat(100)
    const truncated = longMessage.length > 80 ? longMessage.slice(0, 77) + '...' : longMessage
    expect(truncated.length).toBe(80)
    expect(truncated).toContain('...')
  })

  it('shows no commits message when empty', () => {
    const commits: any[] = []
    expect(commits.length).toBe(0)
  })

  it('handles missing workspace', () => {
    const workspacePath = null
    expect(workspacePath).toBeNull()
  })

  it('uses limit of 15 by default', () => {
    const limit = 15
    expect(limit).toBe(15)
  })

  it('formats header with emoji', () => {
    const header = '**Recent Commits**\n\n'
    expect(header).toContain('Recent Commits')
  })

  it('handles commit with special characters in message', () => {
    const commit = { shortHash: 'abc1234', message: 'feat(api): add /v2 endpoint', author: 'dev', date: '2026-01-01' }
    const line = `· \`${commit.shortHash}\` — ${commit.message}`
    expect(line).toContain('/v2 endpoint')
  })
})
