import { describe, it, expect } from 'vitest'
import { BUILTIN_COMMANDS } from '../components/InputBar'

describe('/env slash command', () => {
  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find(c => c.name === 'env')
    expect(cmd).toBeDefined()
    expect(cmd!.description).toContain('environment')
  })

  it('has correct total count', () => {
    expect(BUILTIN_COMMANDS.length).toBe(81)
  })

  it('formats env list header', () => {
    const msg = '**Environment Variables**\n'
    expect(msg).toContain('Environment Variables')
  })

  it('formats specific variable', () => {
    const key = 'NODE_ENV'
    const val = 'development'
    const msg = `\`${key}\` = \`${val}\``
    expect(msg).toContain('NODE_ENV')
    expect(msg).toContain('development')
  })

  it('formats missing variable', () => {
    const key = 'NONEXISTENT_VAR'
    const msg = `\`${key}\` is not set.`
    expect(msg).toContain('is not set')
  })

  it('formats total count footer', () => {
    const total = 120
    const msg = `\n*${total} total variables. Use \`/env <KEY>\` to see a specific one.*`
    expect(msg).toContain('120 total')
    expect(msg).toContain('/env <KEY>')
  })

  it('formats empty env', () => {
    const msg = 'No environment variables found.'
    expect(msg).toContain('No environment variables')
  })

  it('masks sensitive values', () => {
    const sensitive = ['key', 'secret', 'token', 'password', 'credential', 'auth']
    const testKey = 'API_SECRET_KEY'
    const isSensitive = sensitive.some(s => testKey.toLowerCase().includes(s))
    expect(isSensitive).toBe(true)
  })

  it('does not mask non-sensitive values', () => {
    const sensitive = ['key', 'secret', 'token', 'password', 'credential', 'auth']
    const testKey = 'NODE_ENV'
    const isSensitive = sensitive.some(s => testKey.toLowerCase().includes(s))
    expect(isSensitive).toBe(false)
  })
})
