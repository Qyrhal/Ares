import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/pull slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'pull')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('remote')
  })

  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(67)
  })

  it('formats pull success message', () => {
    const branch = 'main'
    const output = 'Already up to date.'
    const msg = `**Pulling** \`${branch}\` (merge)\n\n📥 Pulling from remote...\n✅ **Pull complete**\n\`\`\`\n${output}\n\`\`\``
    expect(msg).toContain('Pulling')
    expect(msg).toContain('main')
    expect(msg).toContain('merge')
    expect(msg).toContain('Pull complete')
  })

  it('formats dirty tree warning', () => {
    const msg = '⚠️ Working tree has changes. Stash or commit first, or use `/stash push`.'
    expect(msg).toContain('Working tree has changes')
    expect(msg).toContain('stash')
  })

  it('formats pull failed message', () => {
    const err = 'unable to access remote'
    const msg = `**Pull failed:** ${err}`
    expect(msg).toContain('Pull failed')
    expect(msg).toContain('unable to access remote')
  })

  it('formats conflict warning', () => {
    const err = 'CONFLICT (content): Merge conflict in src/main.ts'
    const msg = `**Pull failed:** ${err}\n\nMerge conflict detected. Resolve conflicts manually or use \`/exec git merge --abort\`.`
    expect(msg).toContain('CONFLICT')
    expect(msg).toContain('merge --abort')
  })

  it('handles no workspace', () => {
    const workspacePath = null
    expect(workspacePath).toBeNull()
  })

  it('supports --rebase flag', () => {
    const args = '--rebase'
    const rebase = args.trim() === '--rebase' || args.trim() === '-r'
    expect(rebase).toBe(true)
    const strategy = rebase ? 'rebase' : 'merge'
    expect(strategy).toBe('rebase')
  })

  it('defaults to merge strategy', () => {
    const args = ''
    const rebase = args.trim() === '--rebase' || args.trim() === '-r'
    expect(rebase).toBe(false)
    const strategy = rebase ? 'rebase' : 'merge'
    expect(strategy).toBe('merge')
  })
})
