import { describe, it, expect } from 'vitest'
import { parseSettings, AppSettingsSchema } from '@/schemas'

describe('parseSettings', () => {
  it('defaults apiBaseUrl to empty string when not present', () => {
    expect(parseSettings({}).apiBaseUrl).toBe('')
  })

  it('defaults defaultModel to empty string when not present', () => {
    expect(parseSettings({}).defaultModel).toBe('')
  })

  it('defaults apiKey to empty string when not present', () => {
    expect(parseSettings({}).apiKey).toBe('')
  })

  it('defaults permissionMode to ask', () => {
    expect(parseSettings({}).permissionMode).toBe('ask')
  })

  it('rejects unknown permissionMode values', () => {
    expect(() => parseSettings({ permissionMode: 'never' })).toThrow()
  })

  it('round-trips a full settings object', () => {
    const input = {
      apiKey: 'sk-test',
      apiBaseUrl: 'http://localhost:11434/v1',
      defaultModel: 'llama3',
      themeId: 'blue',
      systemPrompt: 'be concise',
      permissionMode: 'auto',
    }
    expect(parseSettings(input)).toMatchObject(input)
  })

  it('accepts empty apiKey for keyless local servers', () => {
    const result = parseSettings({ apiBaseUrl: 'http://localhost:11434/v1', apiKey: '' })
    expect(result.apiKey).toBe('')
    expect(result.apiBaseUrl).toBe('http://localhost:11434/v1')
  })

  it('strips unknown extra fields', () => {
    const result = parseSettings({ unknownField: 'should-be-gone' })
    expect((result as any).unknownField).toBeUndefined()
  })

  it('strips legacy provider/piProvider fields gracefully', () => {
    const result = parseSettings({ provider: 'openai', piProvider: 'anthropic', apiKey: 'k' })
    expect((result as any).provider).toBeUndefined()
    expect((result as any).piProvider).toBeUndefined()
    expect(result.apiKey).toBe('k')
  })
})

describe('AppSettingsSchema direct', () => {
  it('has correct defaults', () => {
    expect(AppSettingsSchema.parse({})).toMatchObject({
      apiKey: '',
      apiBaseUrl: '',
      defaultModel: '',
      permissionMode: 'ask',
    })
  })
})
