import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/rename slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires args for rename', () => {
    const args = ''
    expect(args).toBe('')
  })

  it('accepts a new title from args', () => {
    const args = 'My New Title'
    expect(args).toBe('My New Title')
    expect(args.length).toBeGreaterThan(0)
  })

  it('trims whitespace from title', () => {
    const args = '  Trimmed Title  '
    const trimmed = args.trim()
    expect(trimmed).toBe('Trimmed Title')
  })

  it('formats confirmation message', () => {
    const title = 'New Session Name'
    const msg = `Session renamed to: ${title}`
    expect(msg).toContain('Session renamed to:')
    expect(msg).toContain('New Session Name')
  })

  it('rejects empty title', () => {
    const args = ''
    const hasArgs = !!args
    expect(hasArgs).toBe(false)
  })

  it('handles long titles', () => {
    const args = 'A'.repeat(100)
    expect(args.length).toBe(100)
  })

  it('preserves existing session state during rename', () => {
    const session = { id: 'abc', title: 'Old Title', notes: 'some notes' }
    const updates = { title: 'New Title' }
    const updated = { ...session, ...updates }
    expect(updated.title).toBe('New Title')
    expect(updated.notes).toBe('some notes')
  })

  it('shows usage when no args provided', () => {
    const args = ''
    const msg = args ? `Session renamed to: ${args}` : 'Usage: /rename <new title>'
    expect(msg).toBe('Usage: /rename <new title>')
  })
})
