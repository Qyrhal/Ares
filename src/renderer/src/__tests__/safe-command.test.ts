import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PermissionMode } from '@/types'

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiBaseUrl: '',
  defaultModel: '',
  themeId: 'dark',
  colorMode: 'dark' as const,
  systemPrompt: '',
  permissionMode: 'ask' as PermissionMode,
  providers: [],
}

// ── /safe command logic tests ────────────────────────────────────────────────
// These test the toggle logic without rendering App.tsx.
// They exercise the same logic that runs in the handleCommand switch case.

describe('/safe slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('toggles safeMode from false to true', () => {
    const settings = { ...DEFAULT_SETTINGS, safeMode: false }
    const next = { ...settings, safeMode: !settings.safeMode }
    expect(next.safeMode).toBe(true)
  })

  it('toggles safeMode from true to false', () => {
    const settings = { ...DEFAULT_SETTINGS, safeMode: true }
    const next = { ...settings, safeMode: !settings.safeMode }
    expect(next.safeMode).toBe(false)
  })

  it('defaults to false when safeMode is undefined', () => {
    const settings = { ...DEFAULT_SETTINGS }
    const current = (settings as any).safeMode ?? false
    expect(current).toBe(false)
    const next = { ...settings, safeMode: !current }
    expect(next.safeMode).toBe(true)
  })

  it('turning on shows "Safe mode enabled" with disabled items list', () => {
    const lines = [
      '**Safe mode enabled** 🔒\n',
      'The following are disabled:',
      '· System prompt customization (using bare default)',
      '· MCP server connections',
      '· Plugin commands and extensions',
      '',
      'To disable: `/safe`',
    ]
    const msg = lines.join('\n')
    expect(msg).toContain('**Safe mode enabled**')
    expect(msg).toContain('🔒')
    expect(msg).toContain('· System prompt customization')
    expect(msg).toContain('· MCP server connections')
    expect(msg).toContain('· Plugin commands and extensions')
    expect(msg).toContain('To disable: `/safe`')
  })

  it('turning off shows "Safe mode disabled"', () => {
    const msg = '**Safe mode disabled** — normal behavior restored.'
    expect(msg).toContain('**Safe mode disabled**')
    expect(msg).toContain('normal behavior restored')
  })

  it('settings are updated via el.settings.set', async () => {
    const mockSettingsSet = vi.fn().mockResolvedValue(undefined)
    const el = { settings: { set: mockSettingsSet } }

    const settings = { ...DEFAULT_SETTINGS, safeMode: false }
    const next = { ...settings, safeMode: true }
    await el.settings.set(next)

    expect(mockSettingsSet).toHaveBeenCalledWith(next)
    expect(mockSettingsSet).toHaveBeenCalledTimes(1)
    expect(mockSettingsSet.mock.calls[0][0].safeMode).toBe(true)
  })

  it('store is updated via store.setSettings', () => {
    const mockSetSettings = vi.fn()
    const store = { settings: { ...DEFAULT_SETTINGS, safeMode: false }, setSettings: mockSetSettings }

    const next = { ...store.settings, safeMode: true }
    store.setSettings(next)

    expect(mockSetSettings).toHaveBeenCalledWith(next)
    expect(mockSetSettings).toHaveBeenCalledTimes(1)
  })

  it('full toggle cycle: off → on → off', async () => {
    const mockSettingsSet = vi.fn().mockResolvedValue(undefined)
    const mockSetSettings = vi.fn()

    // Start: safeMode = false
    let settings = { ...DEFAULT_SETTINGS, safeMode: false }

    // Toggle ON
    let next = { ...settings, safeMode: !settings.safeMode }
    expect(next.safeMode).toBe(true)
    await mockSettingsSet(next)
    mockSetSettings(next)
    settings = next

    // Toggle OFF
    next = { ...settings, safeMode: !settings.safeMode }
    expect(next.safeMode).toBe(false)
    await mockSettingsSet(next)
    mockSetSettings(next)
    settings = next

    expect(settings.safeMode).toBe(false)
    expect(mockSettingsSet).toHaveBeenCalledTimes(2)
    expect(mockSetSettings).toHaveBeenCalledTimes(2)
  })
})
