import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/rebase command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const rebase = BUILTIN_COMMANDS.find((c) => c.name === 'rebase')
    expect(rebase).toBeDefined()
    expect(rebase!.kind).toBe('builtin')
    expect(rebase!.description).toContain('Rebase')
  })

  it('has correct description', () => {
    const rebase = BUILTIN_COMMANDS.find((c) => c.name === 'rebase')
    expect(rebase!.description).toBe('Rebase current branch onto another branch')
  })

  it('BUILTIN_COMMANDS count matches expected', () => {
    expect(BUILTIN_COMMANDS.length).toBe(79)
  })

  it('rebase appears after pull in BUILTIN_COMMANDS order', () => {
    const pullIdx = BUILTIN_COMMANDS.findIndex((c) => c.name === 'pull')
    const rebaseIdx = BUILTIN_COMMANDS.findIndex((c) => c.name === 'rebase')
    expect(pullIdx).toBeLessThan(rebaseIdx)
  })

  it('rebase appears before merge in BUILTIN_COMMANDS order', () => {
    const rebaseIdx = BUILTIN_COMMANDS.findIndex((c) => c.name === 'rebase')
    const mergeIdx = BUILTIN_COMMANDS.findIndex((c) => c.name === 'merge')
    expect(rebaseIdx).toBeLessThan(mergeIdx)
  })
})
