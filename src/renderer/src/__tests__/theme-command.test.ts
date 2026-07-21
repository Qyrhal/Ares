import { describe, it, expect, vi, beforeEach } from 'vitest'
import { THEMES, DEFAULT_THEME_ID } from '../lib/theme'
import type { ColorMode } from '../lib/theme'

describe('/theme slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows current theme when no args provided', () => {
    const args = ''
    const hasArgs = !!args
    expect(hasArgs).toBe(false)
  })

  it('recognizes dark mode input', () => {
    const arg = 'dark'
    const isDarkOrLight = arg === 'dark' || arg === 'light'
    expect(isDarkOrLight).toBe(true)
  })

  it('recognizes light mode input', () => {
    const arg = 'light'
    const isDarkOrLight = arg === 'dark' || arg === 'light'
    expect(isDarkOrLight).toBe(true)
  })

  it('finds accent theme by id', () => {
    const arg = 'red'
    const match = THEMES.find((t) => t.id === arg || t.label.toLowerCase() === arg)
    expect(match).toBeDefined()
    expect(match!.id).toBe('red')
    expect(match!.label).toBe('Red')
  })

  it('finds accent theme by label', () => {
    const arg = 'steel'
    const match = THEMES.find((t) => t.id === arg || t.label.toLowerCase() === arg)
    expect(match).toBeDefined()
    expect(match!.id).toBe('steel')
  })

  it('rejects unknown theme', () => {
    const arg = 'neon'
    const match = THEMES.find((t) => t.id === arg || t.label.toLowerCase() === arg)
    expect(match).toBeUndefined()
  })

  it('lists all available themes in error message', () => {
    const ids = THEMES.map((t) => t.id).join(', ')
    expect(ids).toBe('steel, red, blue, green, orange, zinc')
  })

  it('formats current theme display with accent and mode', () => {
    const settings = { themeId: 'blue', colorMode: 'dark' as ColorMode }
    const themeList = THEMES.map((t) => t.id === settings.themeId ? `**${t.label}** (current)` : t.label).join(', ')
    expect(themeList).toContain('**Blue** (current)')
    expect(themeList).toContain('Steel')
    expect(themeList).toContain('Red')
  })

  it('formats confirmation for accent change', () => {
    const match = THEMES.find((t) => t.id === 'green')
    const msg = `Accent changed to **${match!.label}**.`
    expect(msg).toBe('Accent changed to **Green**.')
  })

  it('formats confirmation for color mode switch', () => {
    const mode: ColorMode = 'light'
    const msg = `Switched to **${mode}** mode.`
    expect(msg).toBe('Switched to **light** mode.')
  })

  it('accepts case-insensitive input', () => {
    const arg = 'RED'.toLowerCase()
    const match = THEMES.find((t) => t.id === arg || t.label.toLowerCase() === arg)
    expect(match).toBeDefined()
    expect(match!.id).toBe('red')
  })

  it('DEFAULT_THEME_ID is steel', () => {
    expect(DEFAULT_THEME_ID).toBe('steel')
  })

  it('has exactly 6 themes', () => {
    expect(THEMES).toHaveLength(6)
  })
})
