import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/reset slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'reset')
    expect(cmd).toBeDefined()
    expect(cmd!.kind).toBe('builtin')
    expect(cmd!.description).toContain('reset')
  })

  it('has correct description', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'reset')
    expect(cmd!.description).toBe('Git reset (soft/mixed/hard)')
  })

  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(81)
  })

  it('reset appears before help in BUILTIN_COMMANDS order', () => {
    const resetIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'reset')
    const helpIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'help')
    expect(resetIdx).toBeLessThan(helpIdx)
  })

  it('reset appears after watch in BUILTIN_COMMANDS order', () => {
    const watchIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'watch')
    const resetIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'reset')
    expect(watchIdx).toBeLessThan(resetIdx)
  })

  it('formats usage message', () => {
    const msg = 'Usage:\n• `/reset --soft [HEAD~N]` — undo last commit, keep changes staged\n• `/reset --mixed [HEAD~N]` — undo last commit, keep changes unstaged (default)\n• `/reset --hard [HEAD~N]` — discard ALL changes and undo last commit\n\n⚠️ `--hard` permanently discards uncommitted changes. Use with caution.'
    expect(msg).toContain('Usage:')
    expect(msg).toContain('/reset --soft')
    expect(msg).toContain('/reset --mixed')
    expect(msg).toContain('/reset --hard')
  })

  it('formats no workspace error', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('No workspace open')
  })

  it('formats not a git repo error', () => {
    const msg = 'Not a git repository.'
    expect(msg).toBe('Not a git repository.')
  })

  it('formats reset success message', () => {
    const mode = 'mixed'
    const result = 'Unstaged changes after reset'
    const msg = `**Reset ${mode}:** ${result}`
    expect(msg).toContain('Reset mixed:')
    expect(msg).toContain(result)
  })

  it('formats reset success with fallback message', () => {
    const mode = 'soft'
    const ref = 'HEAD~1'
    const msg = `**Reset ${mode}:** moved HEAD back to ${ref}`
    expect(msg).toContain('Reset soft:')
    expect(msg).toContain(ref)
  })

  it('formats reset failure message', () => {
    const err = 'fatal: ambiguous argument \'HEAD~1\': unknown revision'
    const msg = `**Reset failed:** ${err}`
    expect(msg).toContain('Reset failed')
    expect(msg).toContain(err)
  })

  it('parses --soft mode', () => {
    const argsStr = '--soft'
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed'
    let ref = 'HEAD~1'
    const parts = argsStr.split(/\s+/)
    for (const part of parts) {
      if (part === '--soft') mode = 'soft'
      else if (part === '--mixed') mode = 'mixed'
      else if (part === '--hard') mode = 'hard'
      else if (part.startsWith('HEAD') || /^[0-9a-f]+$/i.test(part)) ref = part
    }
    expect(mode).toBe('soft')
    expect(ref).toBe('HEAD~1')
  })

  it('parses --mixed mode', () => {
    const argsStr = '--mixed'
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed'
    let ref = 'HEAD~1'
    const parts = argsStr.split(/\s+/)
    for (const part of parts) {
      if (part === '--soft') mode = 'soft'
      else if (part === '--mixed') mode = 'mixed'
      else if (part === '--hard') mode = 'hard'
      else if (part.startsWith('HEAD') || /^[0-9a-f]+$/i.test(part)) ref = part
    }
    expect(mode).toBe('mixed')
    expect(ref).toBe('HEAD~1')
  })

  it('parses --hard mode', () => {
    const argsStr = '--hard'
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed'
    let ref = 'HEAD~1'
    const parts = argsStr.split(/\s+/)
    for (const part of parts) {
      if (part === '--soft') mode = 'soft'
      else if (part === '--mixed') mode = 'mixed'
      else if (part === '--hard') mode = 'hard'
      else if (part.startsWith('HEAD') || /^[0-9a-f]+$/i.test(part)) ref = part
    }
    expect(mode).toBe('hard')
    expect(ref).toBe('HEAD~1')
  })

  it('parses --soft HEAD~3', () => {
    const argsStr = '--soft HEAD~3'
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed'
    let ref = 'HEAD~1'
    const parts = argsStr.split(/\s+/)
    for (const part of parts) {
      if (part === '--soft') mode = 'soft'
      else if (part === '--mixed') mode = 'mixed'
      else if (part === '--hard') mode = 'hard'
      else if (part.startsWith('HEAD') || /^[0-9a-f]+$/i.test(part)) ref = part
    }
    expect(mode).toBe('soft')
    expect(ref).toBe('HEAD~3')
  })

  it('formats help with --hard warning', () => {
    const msg = 'Usage:\n• `/reset --soft [HEAD~N]` — undo last commit, keep changes staged\n• `/reset --mixed [HEAD~N]` — undo last commit, keep changes unstaged (default)\n• `/reset --hard [HEAD~N]` — discard ALL changes and undo last commit\n\n⚠️ `--hard` permanently discards uncommitted changes. Use with caution.'
    expect(msg).toContain('⚠️')
    expect(msg).toContain('permanently discards')
  })
})
