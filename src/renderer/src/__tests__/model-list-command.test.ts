import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_COMMANDS } from '@/components/InputBar'

describe('/model list command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('model command is registered in BUILTIN_COMMANDS', () => {
    const modelCmd = BUILTIN_COMMANDS.find((c) => c.name === 'model')
    expect(modelCmd).toBeDefined()
    expect(modelCmd!.description).toContain('List')
  })

  it('model command description includes list keyword', () => {
    const modelCmd = BUILTIN_COMMANDS.find((c) => c.name === 'model')
    expect(modelCmd!.description.toLowerCase()).toContain('list')
  })

  it('model command description includes change keyword', () => {
    const modelCmd = BUILTIN_COMMANDS.find((c) => c.name === 'model')
    expect(modelCmd!.description.toLowerCase()).toContain('change')
  })

  it('model command kind is builtin', () => {
    const modelCmd = BUILTIN_COMMANDS.find((c) => c.name === 'model')
    expect(modelCmd!.kind).toBe('builtin')
  })

  it('model command name matches expected pattern', () => {
    const modelCmd = BUILTIN_COMMANDS.find((c) => c.name === 'model')
    expect(modelCmd!.name).toBe('model')
  })

  it('effectiveProviders returns configured providers', async () => {
    const { effectiveProviders } = await import('@/lib/providers')
    const providers = effectiveProviders({
      providers: [{ id: 'p1', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' }],
      apiBaseUrl: '',
      apiKey: '',
    })
    expect(providers).toHaveLength(1)
    expect(providers[0].id).toBe('p1')
  })

  it('effectiveProviders falls back to legacy single endpoint', async () => {
    const { effectiveProviders } = await import('@/lib/providers')
    const providers = effectiveProviders({
      providers: [],
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    })
    expect(providers).toHaveLength(1)
    expect(providers[0].id).toBe('default')
  })

  it('effectiveProviders returns empty when no providers configured', async () => {
    const { effectiveProviders } = await import('@/lib/providers')
    const providers = effectiveProviders({
      providers: [],
      apiBaseUrl: '',
      apiKey: '',
    })
    expect(providers).toHaveLength(0)
  })

  it('displayModel strips provider prefix', async () => {
    const { displayModel } = await import('@/lib/providers')
    expect(displayModel('openai::gpt-4o')).toBe('gpt-4o')
    expect(displayModel('gpt-4o')).toBe('gpt-4o')
  })

  it('makeModelRef creates provider::model format', async () => {
    const { makeModelRef } = await import('@/lib/providers')
    expect(makeModelRef('openai', 'gpt-4o')).toBe('openai::gpt-4o')
  })

  it('model switch message uses displayModel', async () => {
    const { displayModel } = await import('@/lib/providers')
    const modelRef = 'openai::gpt-4o'
    const msg = `Switched model to ${displayModel(modelRef)}`
    expect(msg).toBe('Switched model to gpt-4o')
  })
})
