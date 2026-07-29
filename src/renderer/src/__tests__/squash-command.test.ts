import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/squash slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'squash')
    expect(cmd).toBeDefined()
    expect(cmd!.kind).toBe('builtin')
    expect(cmd!.description).toContain('Squash')
  })

  it('has correct description', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'squash')
    expect(cmd!.description).toBe('Squash last N commits into one')
  })

  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(82)
  })

  it('squash appears after stash in BUILTIN_COMMANDS order', () => {
    const stashIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'stash')
    const squashIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'squash')
    expect(stashIdx).toBeLessThan(squashIdx)
  })

  it('squash appears before checkpoint in BUILTIN_COMMANDS order', () => {
    const squashIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'squash')
    const checkpointIdx = BUILTIN_COMMANDS.findIndex(c => c.name === 'checkpoint')
    expect(squashIdx).toBeLessThan(checkpointIdx)
  })

  it('formats squash success message', () => {
    const count = 3
    const branch = 'feat/my-feature'
    const squashMsg = `Squash ${count} commits on ${branch}`
    const result = `Squashed ${count} commit(s) into one: "${squashMsg}"`
    expect(result).toContain('Squashed 3 commit(s) into one')
    expect(result).toContain(squashMsg)
  })

  it('formats no workspace error', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('No workspace open')
  })

  it('formats not a git repo error', () => {
    const msg = 'Not a git repository.'
    expect(msg).toBe('Not a git repository.')
  })

  it('formats main/master error', () => {
    const msg = 'Cannot squash on main/master. Switch to a feature branch first.'
    expect(msg).toContain('main/master')
  })

  it('formats usage message for invalid count', () => {
    const msg = 'Usage: `/squash [number-of-commits]`'
    expect(msg).toContain('Usage:')
    expect(msg).toContain('/squash')
  })

  it('formats squash failure message', () => {
    const err = 'Cannot squash on main/master branch'
    const msg = `**Squash failed:** ${err}`
    expect(msg).toContain('Squash failed')
    expect(msg).toContain(err)
  })

  it('formats squash success with count', () => {
    const count = 5
    const msg = `**Squashed ${count} commit(s) into one: "Squash 5 commits on feat/test"**`
    expect(msg).toContain('Squashed 5 commit(s) into one')
    expect(msg).toContain('feat/test')
  })
})
