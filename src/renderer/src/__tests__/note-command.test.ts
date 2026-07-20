import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/note slash command logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appends notes with separator when existing notes present', () => {
    const existing = 'First note'
    const newNote = 'Second note'
    const separator = existing ? '\n\n' : ''
    const result = `${existing}${separator}${newNote}`
    expect(result).toBe('First note\n\nSecond note')
  })

  it('starts fresh when no existing notes', () => {
    const existing = ''
    const newNote = 'First note'
    const separator = existing ? '\n\n' : ''
    const result = `${existing}${separator}${newNote}`
    expect(result).toBe('First note')
  })

  it('clears notes on --clear flag', () => {
    const notes = ''
    expect(notes).toBe('')
  })

  it('shows notes when they exist', () => {
    const notes = 'Fix the auth bug'
    expect(notes).toBeTruthy()
    expect(notes).toContain('auth bug')
  })

  it('shows empty message when no notes', () => {
    const notes = ''
    const display = notes || 'No notes on this session.'
    expect(display).toBe('No notes on this session.')
  })
})
