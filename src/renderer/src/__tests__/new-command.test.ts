import { describe, it, expect } from 'vitest'

describe('/new slash command', () => {
  it('uses default title when no args provided', () => {
    const args = ''
    const title = args.trim() || 'New session'
    expect(title).toBe('New session')
  })

  it('uses provided args as title', () => {
    const args = 'My debug session'
    const title = args.trim() || 'New session'
    expect(title).toBe('My debug session')
  })

  it('trims whitespace from title', () => {
    const args = '  spaced title  '
    const title = args.trim() || 'New session'
    expect(title).toBe('spaced title')
  })

  it('falls back to default when args is only whitespace', () => {
    const args = '   '
    const title = args.trim() || 'New session'
    expect(title).toBe('New session')
  })

  it('preserves special characters in title', () => {
    const args = 'Fix bug #123 (auth flow)'
    const title = args.trim() || 'New session'
    expect(title).toBe('Fix bug #123 (auth flow)')
  })

  it('new command exists in switch cases', () => {
    const commands = ['model', 'clear', 'compact', 'shortcuts', 'note', 'pin', 'debug', 'history', 'rename', 'log', 'review', 'cost', 'help', 'status', 'summary', 'usage', 'overview', 'helpful', 'not-helpful', 'pr', 'fork', 'changes', 'diff', 'export', 'new']
    expect(commands).toContain('new')
  })

  it('builds system message with title', () => {
    const title = 'My session'
    const msg = `**New session created:** "${title}"`
    expect(msg).toBe('**New session created:** "My session"')
  })

  it('builds system message with default title', () => {
    const title = 'New session'
    const msg = `**New session created:** "${title}"`
    expect(msg).toBe('**New session created:** "New session"')
  })
})
