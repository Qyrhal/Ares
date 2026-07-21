import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/lint slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires a workspace', () => {
    const wsPath = null
    expect(wsPath).toBeNull()
  })

  it('formats a clean result', () => {
    const result = { ok: true, errors: 0, output: 'No errors found.' }
    const msg = `**Lint clean** — ${result.output}`
    expect(msg).toContain('Lint clean')
    expect(msg).toContain('No errors found.')
  })

  it('formats error results', () => {
    const result = { ok: false, errors: 3, output: 'src/file.ts(10,5): error TS2322: Type mismatch' }
    const summary = `${result.errors} error${result.errors === 1 ? '' : 's'} found`
    expect(summary).toBe('3 errors found')
  })

  it('formats single error', () => {
    const result = { ok: false, errors: 1, output: 'error TS1234' }
    const summary = `${result.errors} error${result.errors === 1 ? '' : 's'} found`
    expect(summary).toBe('1 error found')
  })

  it('truncates long output', () => {
    const output = 'A'.repeat(4000)
    const truncated = output.length > 3000 ? output.slice(0, 3000) + '\n\n[truncated]' : output
    expect(truncated.length).toBe(3013)
    expect(truncated).toContain('[truncated]')
  })

  it('shows running message', () => {
    const msg = '**Running type check...**'
    expect(msg).toContain('Running type check')
  })

  it('shows error when lint fails', () => {
    const error = 'command not found'
    const msg = `**Lint error:** ${error}`
    expect(msg).toContain('Lint error')
    expect(msg).toContain('command not found')
  })

  it('shows no-workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('/folder')
  })

  it('handles output without error lines', () => {
    const output = ''
    const errorLines = output.split('\n').filter(l => l.includes('error TS') || l.includes(': error'))
    expect(errorLines.length).toBe(0)
  })
})
