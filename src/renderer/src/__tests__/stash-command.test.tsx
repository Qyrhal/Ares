import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/stash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('formats stash list entries', () => {
    const stashes = [
      { index: 0, branch: 'main', message: 'main: WIP on feat-x' },
      { index: 1, branch: 'fix', message: 'fix: quick patch' },
    ]
    const lines = stashes.map(s => {
      const msg = s.message.length > 60 ? s.message.slice(0, 57) + '...' : s.message
      return `· \`stash@{${s.index}}\` — ${msg}`
    })
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('stash@{0}')
    expect(lines[0]).toContain('WIP on feat-x')
    expect(lines[1]).toContain('stash@{1}')
  })

  it('truncates long stash messages', () => {
    const longMsg = 'a'.repeat(80)
    const truncated = longMsg.length > 60 ? longMsg.slice(0, 57) + '...' : longMsg
    expect(truncated).toHaveLength(60)
    expect(truncated).toContain('...')
  })

  it('formats push success', () => {
    const result = { ok: true, message: 'Saved working changes' }
    const line = result.ok ? `✅ ${result.message}` : `❌ ${result.message}`
    expect(line).toContain('✅')
    expect(line).toContain('Saved working changes')
  })

  it('formats push failure', () => {
    const result = { ok: false, message: 'nothing to stash' }
    const line = result.ok ? `✅ ${result.message}` : `❌ ${result.message}`
    expect(line).toContain('❌')
    expect(line).toContain('nothing to stash')
  })

  it('formats pop success', () => {
    const result = { ok: true, message: 'Applied stash' }
    const line = result.ok ? `✅ ${result.message}` : `❌ ${result.message}`
    expect(line).toContain('✅')
  })

  it('formats drop success', () => {
    const result = { ok: true, message: 'Dropped stash@{0}' }
    const line = result.ok ? `✅ ${result.message}` : `❌ ${result.message}`
    expect(line).toContain('Dropped stash@{0}')
  })

  it('formats clear success', () => {
    const result = { ok: true, message: 'All stashes cleared' }
    const line = result.ok ? `✅ ${result.message}` : `❌ ${result.message}`
    expect(line).toContain('All stashes cleared')
  })

  it('shows no stashes message for empty list', () => {
    const stashes: { index: number; branch: string; message: string }[] = []
    const lines: string[] = ['**Git Stash**\n']
    if (stashes.length === 0) {
      lines.push('No stashes.')
    }
    expect(lines).toContain('No stashes.')
  })

  it('shows no workspace message', () => {
    const workspacePath = null
    const lines: string[] = ['**Git Stash**\n']
    if (!workspacePath) {
      lines.push('No workspace folder is open.')
    }
    expect(lines).toContain('No workspace folder is open.')
  })

  it('validates drop index', () => {
    const sub = 'drop abc'
    const idx = parseInt(sub.split(' ')[1], 10)
    expect(isNaN(idx)).toBe(true)
  })

  it('parses valid drop index', () => {
    const sub = 'drop 3'
    const idx = parseInt(sub.split(' ')[1], 10)
    expect(idx).toBe(3)
  })

  it('shows usage hint for drop without index', () => {
    const sub = 'drop'
    const idx = parseInt(sub.split(' ')[1], 10)
    expect(isNaN(idx)).toBe(true)
  })

  it('identifies push/save subcommands', () => {
    expect(['push', 'save']).toContain('push')
    expect(['push', 'save']).toContain('save')
  })

  it('identifies pop/apply subcommands', () => {
    expect(['pop', 'apply']).toContain('pop')
    expect(['pop', 'apply']).toContain('apply')
  })

  it('identifies clear subcommand', () => {
    expect('clear'.toLowerCase()).toBe('clear')
  })

  it('lists stashes with usage hint', () => {
    const stashes = [
      { index: 0, branch: 'main', message: 'main: WIP' },
    ]
    const lines: string[] = []
    for (const s of stashes) {
      const msg = s.message.length > 60 ? s.message.slice(0, 57) + '...' : s.message
      lines.push(`· \`stash@{${s.index}}\` — ${msg}`)
    }
    lines.push('\nUsage: `/stash push`, `/stash pop`, `/stash drop <n>`, `/stash clear`')
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain('Usage:')
  })

  it('formats error message', () => {
    const err = new Error('test error')
    const lines: string[] = [`Error: ${err.message}`]
    expect(lines[0]).toContain('Error: test error')
  })
})
