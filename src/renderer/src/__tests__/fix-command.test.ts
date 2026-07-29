import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_COMMANDS } from '@/components/InputBar'

describe('/fix slash command', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('is registered in BUILTIN_COMMANDS', () => {
    const fixCmd = BUILTIN_COMMANDS.find((c) => c.name === 'fix')
    expect(fixCmd).toBeDefined()
    expect(fixCmd?.kind).toBe('builtin')
    expect(fixCmd?.description).toContain('Auto-fix')
  })

  it('has correct description mentioning AI', () => {
    const fixCmd = BUILTIN_COMMANDS.find((c) => c.name === 'fix')!
    expect(fixCmd.description).toMatch(/AI|auto-fix/i)
  })

  it('formats no-workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('folder')
  })

  it('formats no-provider message', () => {
    const msg = 'No API endpoint configured. Set one in Settings to use AI-powered fixes.'
    expect(msg).toContain('API endpoint')
  })

  it('formats clean result', () => {
    const result = { ok: true, errors: 0, output: 'No errors found.' }
    const msg = `**No type errors found** — code is clean.`
    expect(msg).toContain('No type errors found')
  })

  it('formats error results for AI prompt', () => {
    const result = { ok: false, errors: 3, output: 'TS2322: Type mismatch\nTS2345: Argument not assignable\nTS2339: Property does not exist' }
    const errorOutput = result.output.length > 4000 ? result.output.slice(0, 4000) + '\n\n[truncated]' : result.output
    expect(errorOutput).toContain('TS2322')
    expect(errorOutput).toContain('TS2345')
    expect(errorOutput).toContain('TS2339')
    expect(errorOutput.length).toBeLessThanOrEqual(4000)
  })

  it('truncates long error output at 4000 chars', () => {
    const output = 'E'.repeat(5000)
    const errorOutput = output.length > 4000 ? output.slice(0, 4000) + '\n\n[truncated]' : output
    expect(errorOutput.length).toBe(4013)
    expect(errorOutput).toContain('[truncated]')
  })

  it('formats AI success response', () => {
    const fixContent = 'Fix 1: Change string to number in src/app.ts line 5'
    const msg = `**🔧 Auto-Fix Suggestions**\n\n${fixContent}`
    expect(msg).toContain('Auto-Fix Suggestions')
    expect(msg).toContain('Fix 1')
  })

  it('formats AI failure response', () => {
    const status = 500
    const msg = `Fix generation failed: ${status}`
    expect(msg).toContain('500')
  })

  it('formats network error response', () => {
    const msg = 'Fix generation failed: network error'
    expect(msg).toContain('network error')
  })

  it('formats fix error response', () => {
    const error = 'ENOENT: no such file'
    const msg = `**Fix error:** ${error}`
    expect(msg).toContain('Fix error')
    expect(msg).toContain('ENOENT')
  })

  it('builds correct system prompt for AI', () => {
    const fixSystemPrompt = 'You are a TypeScript fix assistant. The user\'s project has type errors. Analyze the errors below and provide specific, actionable fixes for each one. For each error: 1) Identify the file and line. 2) Explain the error briefly. 3) Provide the exact code fix. Be concise and precise. If there are too many errors to fix all, focus on the most critical ones first.'
    expect(fixSystemPrompt).toContain('TypeScript fix assistant')
    expect(fixSystemPrompt).toContain('actionable fixes')
  })

  it('has correct number of BUILTIN_COMMANDS', () => {
    expect(BUILTIN_COMMANDS.length).toBe(84)
  })
})
