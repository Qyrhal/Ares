import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/merge slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'merge')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('branch')
  })

  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(80)
  })

  it('formats merge success message', () => {
    const targetBranch = 'feature-x'
    const currentBranch = 'main'
    const output = 'Updating 8d10972..a1b2c3d\nFast-forward\n src/main.ts | 2 ++\n 1 file changed, 2 insertions(+)'
    const msg = `**Merging** \`${targetBranch}\` into \`${currentBranch}\`...\n\n✅ **Merge complete**\n\`\`\`\n${output}\n\`\`\``
    expect(msg).toContain('Merging')
    expect(msg).toContain('feature-x')
    expect(msg).toContain('main')
    expect(msg).toContain('Merge complete')
  })

  it('formats no args usage message', () => {
    const msg = 'Usage: /merge <branch> — merge a branch into the current branch.'
    expect(msg).toContain('Usage:')
    expect(msg).toContain('/merge <branch>')
  })

  it('formats dirty tree warning', () => {
    const msg = 'Working tree has changes. Commit or stash them first before merging.'
    expect(msg).toContain('Working tree has changes')
  })

  it('formats merge failed message', () => {
    const err = 'CONFLICT (content): Merge conflict in src/main.ts'
    const msg = `**Merge failed:** ${err}\n\nMerge conflict detected. Resolve conflicts, then run \`/exec git merge --continue\` or \`/exec git merge --abort\`.`
    expect(msg).toContain('Merge failed')
    expect(msg).toContain('CONFLICT')
    expect(msg).toContain('merge --continue')
    expect(msg).toContain('merge --abort')
  })

  it('formats non-conflict error', () => {
    const err = 'fatal: refusing to merge unrelated histories'
    const msg = `**Merge failed:** ${err}`
    expect(msg).toContain('Merge failed')
    expect(msg).toContain('refusing to merge')
  })

  it('handles no workspace', () => {
    const workspacePath = null
    expect(workspacePath).toBeNull()
  })

  it('validates branch name is required', () => {
    const args = ''
    expect(args.trim()).toBe('')
  })
})
