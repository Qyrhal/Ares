import { describe, it, expect } from 'vitest'
import { parseSettings } from '../schemas'

describe('compactionModel setting', () => {
  it('is included in parsed settings as undefined when absent', () => {
    const settings = parseSettings({
      apiKey: '',
      apiBaseUrl: '',
      providers: [],
      defaultModel: 'gpt-4o',
      themeId: 'steel',
      colorMode: 'dark',
      systemPrompt: '',
      permissionMode: 'ask',
      safeMode: false,
    })
    expect(settings.compactionModel).toBeUndefined()
  })

  it('parses compactionModel from settings object', () => {
    const settings = parseSettings({
      apiKey: '',
      apiBaseUrl: '',
      providers: [],
      defaultModel: 'gpt-4o',
      compactionModel: 'gpt-4o-mini',
      themeId: 'steel',
      colorMode: 'dark',
      systemPrompt: '',
      permissionMode: 'ask',
      safeMode: false,
    })
    expect(settings.compactionModel).toBe('gpt-4o-mini')
  })

  it('treats null compactionModel as falsy (falls through in model selection)', () => {
    const settings = parseSettings({
      apiKey: '',
      apiBaseUrl: '',
      providers: [],
      defaultModel: 'gpt-4o',
      compactionModel: null,
      themeId: 'steel',
      colorMode: 'dark',
      systemPrompt: '',
      permissionMode: 'ask',
      safeMode: false,
    })
    // null is falsy — the || chain will fall through to defaultModel
    expect(settings.compactionModel).toBeFalsy()
  })

  it('preserves non-empty compactionModel string', () => {
    const settings = parseSettings({
      apiKey: '',
      apiBaseUrl: '',
      providers: [],
      defaultModel: 'claude-3-opus',
      compactionModel: 'gpt-4o-mini',
      themeId: 'steel',
      colorMode: 'dark',
      systemPrompt: '',
      permissionMode: 'ask',
      safeMode: false,
    })
    expect(settings.compactionModel).toBe('gpt-4o-mini')
    expect(settings.defaultModel).toBe('claude-3-opus')
  })
})

describe('compaction model selection logic', () => {
  function resolveCompactionModel(
    compactionModel: string | undefined,
    sessionModel: string | undefined,
    defaultModel: string | undefined,
  ): string {
    return compactionModel || sessionModel || defaultModel || 'gpt-4o-mini'
  }

  it('uses compactionModel when set', () => {
    expect(resolveCompactionModel('gpt-4o-mini', 'gpt-4o', 'claude-3-opus')).toBe('gpt-4o-mini')
  })

  it('falls back to session model when compactionModel is undefined', () => {
    expect(resolveCompactionModel(undefined, 'gpt-4o', 'claude-3-opus')).toBe('gpt-4o')
  })

  it('falls back to default model when compactionModel and sessionModel are empty', () => {
    expect(resolveCompactionModel(undefined, undefined, 'claude-3-opus')).toBe('claude-3-opus')
  })

  it('falls back to gpt-4o-mini when all models are empty', () => {
    expect(resolveCompactionModel(undefined, undefined, undefined)).toBe('gpt-4o-mini')
  })

  it('falls back to default model when compactionModel is empty string', () => {
    expect(resolveCompactionModel('', 'gpt-4o', 'claude-3-opus')).toBe('gpt-4o')
  })
})
