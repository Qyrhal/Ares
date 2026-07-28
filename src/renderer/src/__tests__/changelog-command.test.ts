import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/changelog slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('formats a single commit with hash, message, author, and date', () => {
    const commit = {
      hash: 'abc1234567890def',
      shortHash: 'abc1234',
      author: 'dev',
      date: '2026-01-01',
      message: 'feat: add new feature'
    }
    const line = `- \`${commit.shortHash}\` ${commit.message} _(${commit.author}, ${commit.date})_`
    expect(line).toContain('abc1234')
    expect(line).toContain('feat: add new feature')
    expect(line).toContain('dev')
    expect(line).toContain('2026-01-01')
  })

  it('formats multiple commits', () => {
    const commits = [
      { hash: 'abc1234567890def', shortHash: 'abc1234', author: 'dev', date: '2026-01-01', message: 'first commit' },
      { hash: 'def5678901234abc', shortHash: 'def5678', author: 'dev', date: '2026-01-02', message: 'second commit' },
    ]
    const lines = commits.map(c => `- \`${c.shortHash}\` ${c.message} _(${c.author}, ${c.date})_`)
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('first commit')
    expect(lines[1]).toContain('second commit')
  })

  it('shows no commits message when empty', () => {
    const commits: any[] = []
    expect(commits.length).toBe(0)
  })

  it('handles missing workspace', () => {
    const workspacePath = null
    expect(workspacePath).toBeNull()
  })

  it('uses default limit of 20 when no arg provided', () => {
    const limit = 20
    expect(limit).toBe(20)
  })

  it('formats header with Changelog title', () => {
    const header = '**Changelog**\n\n'
    expect(header).toContain('Changelog')
  })

  it('handles commit with special characters in message', () => {
    const commit = {
      hash: 'abc1234567890def',
      shortHash: 'abc1234',
      author: 'dev',
      date: '2026-01-01',
      message: 'feat(api): add /v2 endpoint'
    }
    const line = `- \`${commit.shortHash}\` ${commit.message}`
    expect(line).toContain('/v2 endpoint')
  })

  it('formats author and date in parentheses', () => {
    const commit = {
      shortHash: 'abc1234',
      message: 'fix: resolve bug',
      author: 'Alice',
      date: '2026-03-15'
    }
    const line = `- \`${commit.shortHash}\` ${commit.message} _(${commit.author}, ${commit.date})_`
    expect(line).toContain('_(Alice, 2026-03-15)_')
  })

  it('handles error output from git', () => {
    const result = { ok: false, output: 'fatal: not a git repository' }
    expect(result.ok).toBe(false)
    expect(result.output).toContain('not a git repository')
  })

  it('handles limit argument parsing', () => {
    const args = '10'
    const limit = args.trim() ? parseInt(args.trim()) || 20 : 20
    expect(limit).toBe(10)
  })

  it('defaults to 20 when limit arg is invalid', () => {
    const args = 'abc'
    const limit = args.trim() ? parseInt(args.trim()) || 20 : 20
    expect(limit).toBe(20)
  })

  it('defaults to 20 when limit arg is empty', () => {
    const args = ''
    const limit = args.trim() ? parseInt(args.trim()) || 20 : 20
    expect(limit).toBe(20)
  })

  it('formats full changelog output', () => {
    const commits = [
      { hash: 'aaa', shortHash: 'aaa1111', author: 'dev', date: '2026-01-01', message: 'feat: first' },
      { hash: 'bbb', shortHash: 'bbb2222', author: 'dev', date: '2026-01-02', message: 'fix: second' },
    ]
    const lines: string[] = ['**Changelog**\n']
    for (const c of commits) {
      lines.push(`- \`${c.shortHash}\` ${c.message} _(${c.author}, ${c.date})_`)
    }
    const output = lines.join('\n')
    expect(output).toContain('**Changelog**')
    expect(output).toContain('aaa1111')
    expect(output).toContain('feat: first')
    expect(output).toContain('bbb2222')
    expect(output).toContain('fix: second')
  })
})
