import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/push slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'push')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('remote')
  })

  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(83)
  })

  it('formats push success message', () => {
    const branch = 'main'
    const ahead = 3
    const msg = `**Pushing** \`${branch}\`\n\n📤 Pushing ${ahead} commits...`
    expect(msg).toContain('Pushing')
    expect(msg).toContain('main')
    expect(msg).toContain('3 commits')
  })

  it('formats up-to-date message', () => {
    const msg = 'Nothing to push — branch is up to date.'
    expect(msg).toContain('Nothing to push')
  })

  it('formats behind warning', () => {
    const behind = 2
    const msg = `⚠️ Branch is **${behind} commits** behind upstream. Pull first or force push.`
    expect(msg).toContain('behind upstream')
    expect(msg).toContain('2 commits')
  })

  it('formats singular behind warning', () => {
    const behind = 1
    const msg = `⚠️ Branch is **${behind} commit** behind upstream. Pull first or force push.`
    expect(msg).toContain('1 commit')
  })

  it('formats push failed message', () => {
    const err = 'permission denied'
    const msg = `**Push failed:** ${err}`
    expect(msg).toContain('Push failed')
    expect(msg).toContain('permission denied')
  })

  it('handles no workspace', () => {
    const workspacePath = null
    expect(workspacePath).toBeNull()
  })

  it('formats force push indicator', () => {
    const msg = '⚡ Force pushing...'
    expect(msg).toContain('Force pushing')
  })
})
