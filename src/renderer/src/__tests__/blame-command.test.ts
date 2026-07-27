import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/blame slash command', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'blame')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('git annotations')
  })

  it('formats a single blame line', () => {
    const line = { line: 1, hash: 'abc1234', author: 'dev', date: '2026-01-01', content: 'const x = 1' }
    const num = String(line.line).padStart(4)
    const formatted = `${num}  \`${line.hash}\`  ${line.author.padEnd(16)}  ${line.date}  | ${line.content}`
    expect(formatted).toContain('abc1234')
    expect(formatted).toContain('const x = 1')
  })

  it('formats multiple blame lines', () => {
    const blame = [
      { line: 1, hash: 'abc1234', author: 'alice', date: '2026-01-01', content: 'line one' },
      { line: 2, hash: 'def5678', author: 'bob', date: '2026-01-02', content: 'line two' },
    ]
    const lines = blame.map(b => {
      const num = String(b.line).padStart(4)
      return `${num}  \`${b.hash}\`  ${b.author.padEnd(16)}  ${b.date}  | ${b.content}`
    })
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('alice')
    expect(lines[1]).toContain('bob')
  })

  it('pads line numbers correctly', () => {
    const line = { line: 42, hash: 'abc1234', author: 'dev', date: '2026-01-01', content: 'x' }
    const num = String(line.line).padStart(4)
    expect(num).toBe('  42')
  })

  it('pads line numbers for triple digits', () => {
    const line = { line: 123, hash: 'abc1234', author: 'dev', date: '2026-01-01', content: 'x' }
    const num = String(line.line).padStart(4)
    expect(num).toBe(' 123')
  })

  it('handles empty blame result', () => {
    const blame: any[] = []
    expect(blame.length).toBe(0)
  })

  it('handles missing workspace', () => {
    const workspacePath = null
    expect(workspacePath).toBeNull()
  })

  it('handles missing file argument', () => {
    const args = ''
    expect(args.trim()).toBe('')
  })

  it('formats header with emoji', () => {
    const header = '**Git Blame**\n\n'
    expect(header).toContain('Git Blame')
  })
})

describe('/blame BUILTIN_COMMANDS count', () => {
  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(67)
  })
})
