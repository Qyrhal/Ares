import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, THEMES, DEFAULT_THEME_ID } from '../lib/theme'

describe('THEMES constant', () => {
  it('exports exactly 5 themes', () => {
    expect(THEMES).toHaveLength(5)
  })

  it('has red as the first/default theme', () => {
    expect(THEMES[0].id).toBe('red')
    expect(DEFAULT_THEME_ID).toBe('red')
  })

  it('does not include purple', () => {
    const purpleish = THEMES.filter((t) => /7c6af7|a855f7|9333ea/i.test(t.primary))
    expect(purpleish).toHaveLength(0)
  })

  it('all themes have required fields', () => {
    for (const t of THEMES) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.primary).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.primaryForeground).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('applyTheme', () => {
  const root = document.documentElement

  beforeEach(() => {
    root.style.removeProperty('--color-primary')
    root.style.removeProperty('--color-primary-foreground')
    root.style.removeProperty('--color-ring')
  })

  it('sets --color-primary for red', () => {
    applyTheme('red')
    expect(root.style.getPropertyValue('--color-primary')).toBe('#dc2626')
  })

  it('sets --color-ring to match primary', () => {
    applyTheme('blue')
    const primary = root.style.getPropertyValue('--color-primary')
    const ring = root.style.getPropertyValue('--color-ring')
    expect(ring).toBe(primary)
  })

  it('sets all three CSS variables', () => {
    applyTheme('green')
    expect(root.style.getPropertyValue('--color-primary')).not.toBe('')
    expect(root.style.getPropertyValue('--color-primary-foreground')).not.toBe('')
    expect(root.style.getPropertyValue('--color-ring')).not.toBe('')
  })

  it('falls back to red for an unknown id', () => {
    applyTheme('__unknown__')
    expect(root.style.getPropertyValue('--color-primary')).toBe('#dc2626')
  })

  it('applies each named theme without error', () => {
    for (const t of THEMES) {
      expect(() => applyTheme(t.id)).not.toThrow()
    }
  })
})
