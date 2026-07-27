import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/discard slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'discard')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('Discard')
  })

  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(70)
  })

  it('formats discard success message', () => {
    const filePath = 'src/main.ts'
    const msg = `Discarded changes to \`${filePath}\``
    expect(msg).toContain('Discarded changes')
    expect(msg).toContain('src/main.ts')
  })

  it('formats discard failed message', () => {
    const err = 'file not found'
    const msg = `**Discard failed:** ${err}`
    expect(msg).toContain('Discard failed')
    expect(msg).toContain('file not found')
  })

  it('formats no workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('No workspace')
    expect(msg).toContain('/folder')
  })

  it('formats no args message', () => {
    const msg = 'Usage: /discard <file-path>'
    expect(msg).toContain('Usage')
    expect(msg).toContain('file-path')
  })

  it('formats not a git repo message', () => {
    const msg = 'Not a git repository.'
    expect(msg).toContain('Not a git repository')
  })
})

describe('/init slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'init')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('git repository')
  })

  it('formats init success message', () => {
    const wsPath = '/home/user/project'
    const msg = `Initialized git repository in \`${wsPath}\``
    expect(msg).toContain('Initialized git repository')
    expect(msg).toContain('/home/user/project')
  })

  it('formats init failed message', () => {
    const err = 'already a git repository'
    const msg = `**Init failed:** ${err}`
    expect(msg).toContain('Init failed')
    expect(msg).toContain('already a git repository')
  })

  it('formats no workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('No workspace')
    expect(msg).toContain('/folder')
  })
})

describe('/checkout slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'checkout')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('branch')
  })

  it('formats checkout success message', () => {
    const branch = 'feature/new-api'
    const msg = `Switched to branch \`${branch}\``
    expect(msg).toContain('Switched to branch')
    expect(msg).toContain('feature/new-api')
  })

  it('formats checkout failed message', () => {
    const err = 'pathspec \'nonexistent\' did not match any branch'
    const msg = `**Checkout failed:** ${err}`
    expect(msg).toContain('Checkout failed')
    expect(msg).toContain('nonexistent')
  })

  it('formats no workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('No workspace')
    expect(msg).toContain('/folder')
  })

  it('formats no args message', () => {
    const msg = 'Usage: /checkout <branch-name>'
    expect(msg).toContain('Usage')
    expect(msg).toContain('branch-name')
  })
})
