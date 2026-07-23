import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sanitizeEnv } from '../../../main/env-filter'

describe('sanitizeEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('preserves safe environment variables', () => {
    process.env.PATH = '/usr/bin'
    process.env.HOME = '/home/user'
    process.env.NODE_ENV = 'development'
    const env = sanitizeEnv()
    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/home/user')
    expect(env.NODE_ENV).toBe('development')
  })

  it('removes variables matching API_KEY pattern', () => {
    process.env.MY_API_KEY = 'secret123'
    process.env.OPENAI_API_KEY = 'sk-abc'
    const env = sanitizeEnv()
    expect(env.MY_API_KEY).toBeUndefined()
    expect(env.OPENAI_API_KEY).toBeUndefined()
  })

  it('removes variables matching TOKEN pattern', () => {
    process.env.GITHUB_TOKEN = 'ghp_xxx'
    process.env.GH_TOKEN = 'ghp_xxx'
    process.env.NPM_TOKEN = 'npm_xxx'
    const env = sanitizeEnv()
    expect(env.GITHUB_TOKEN).toBeUndefined()
    expect(env.GH_TOKEN).toBeUndefined()
    expect(env.NPM_TOKEN).toBeUndefined()
  })

  it('removes variables matching AWS pattern', () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA...'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret'
    const env = sanitizeEnv()
    expect(env.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined()
  })

  it('removes variables matching PASSWORD pattern', () => {
    process.env.DB_PASSWORD = 'hunter2'
    const env = sanitizeEnv()
    expect(env.DB_PASSWORD).toBeUndefined()
  })

  it('removes PRIVATE_KEY variables', () => {
    process.env.PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----'
    const env = sanitizeEnv()
    expect(env.PRIVATE_KEY).toBeUndefined()
  })

  it('merges extra env vars on top of filtered env', () => {
    process.env.PATH = '/usr/bin'
    process.env.MY_API_KEY = 'secret'
    const env = sanitizeEnv({ GIT_TERMINAL_PROMPT: '0', MY_API_KEY: 'overridden' })
    expect(env.PATH).toBe('/usr/bin')
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
    // extra overrides even filtered keys
    expect(env.MY_API_KEY).toBe('overridden')
  })

  it('handles undefined process.env values', () => {
    delete process.env.UNDEFINED_VAR
    const env = sanitizeEnv()
    expect(env.UNDEFINED_VAR).toBeUndefined()
  })
})
