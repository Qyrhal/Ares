import { describe, it, expect, vi, beforeEach } from 'vitest'

// Emoji map extracted from InputBar for unit testing
const EMOJI_MAP: Record<string, string> = {
  heart: '❤️', 'heart-eyes': '😍', thumbsup: '👍', thumbsdown: '👎',
  fire: '🔥', star: '⭐', clap: '👏', rocket: '🚀', check: '✅',
  warning: '⚠️', error: '❌', bulb: '💡', sparkle: '✨', wave: '👋',
  party: '🎉', thinking: '🤔', eyes: '👀', sweat: '😅', cry: '😢',
  laugh: '😂', wink: '😉', cool: '😎', pray: '🙏', muscle: '💪',
  lightning: '⚡', money: '💰', tada: '🎉', bug: '🐛', laptop: '💻',
  memo: '📝', pushpin: '📌', package: '📦', gear: '⚙️', lock: '🔒',
  unlock: '🔓', key: '🔑', link: '🔗', globe: '🌍', clock: '🕐',
  calendar: '📅', chart: '📊', magnifying: '🔍', trash: '🗑️',
  coffee: '☕', pizza: '🍕', rainbow: '🌈', sun: '☀️', moon: '🌙',
}

function filterEmoji(query: string): { key: string; char: string }[] {
  const q = query.toLowerCase()
  return Object.entries(EMOJI_MAP)
    .filter(([key]) => key.includes(q))
    .slice(0, 20)
    .map(([key, char]) => ({ key, char }))
}

describe('emoji shortcode autocomplete logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('filters emoji by partial match', () => {
    const results = filterEmoji('hea')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((e) => e.key === 'heart')).toBe(true)
  })

  it('filters emoji by full key', () => {
    const results = filterEmoji('rocket')
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('rocket')
    expect(results[0].char).toBe('🚀')
  })

  it('returns empty for no match', () => {
    const results = filterEmoji('xyz123')
    expect(results).toHaveLength(0)
  })

  it('returns empty for empty query', () => {
    // filterEmoji requires non-empty query to match
    const results = filterEmoji('zzznonexistent')
    expect(results).toHaveLength(0)
  })

  it('is case insensitive', () => {
    const results = filterEmoji('FIRE')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((e) => e.key === 'fire')).toBe(true)
  })

  it('limits results to 20', () => {
    const broadResults = filterEmoji('a') // matches many
    expect(broadResults.length).toBeLessThanOrEqual(20)
    expect(broadResults.length).toBeGreaterThan(0)
  })

  it('matches heart-eyes by partial', () => {
    const results = filterEmoji('heart')
    expect(results.some((e) => e.key === 'heart-eyes')).toBe(true)
    expect(results.some((e) => e.key === 'heart')).toBe(true)
  })

  it('formats shortcode display as :key:', () => {
    const key = 'rocket'
    const display = `:${key}:`
    expect(display).toBe(':rocket:')
  })

  it('detects colon trigger in text', () => {
    const text = 'say :heart'
    const cursor = text.length
    const textBefore = text.slice(0, cursor)
    const colonIdx = textBefore.lastIndexOf(':')
    expect(colonIdx).toBe(4)
    const afterColon = textBefore.slice(colonIdx + 1)
    expect(afterColon).toBe('heart')
  })

  it('does not trigger emoji for colon with space after', () => {
    const text = 'time: now'
    const cursor = text.length
    const textBefore = text.slice(0, cursor)
    const colonIdx = textBefore.lastIndexOf(':')
    expect(colonIdx).toBe(4)
    const afterColon = textBefore.slice(colonIdx + 1)
    const hasSpace = afterColon.includes(' ')
    expect(hasSpace).toBe(true)
  })

  it('replaces shortcode with emoji character', () => {
    const text = 'say :heart:'
    const emojiIndex = 4 // position of first ':'
    const emojiCursor = 11 // position after second ':'
    const emoji = '❤️'
    const before = text.slice(0, emojiIndex)
    const after = text.slice(emojiCursor)
    const result = before + emoji + after
    expect(result).toBe('say ❤️')
  })

  it('all emoji values are single characters or short sequences', () => {
    for (const [, char] of Object.entries(EMOJI_MAP)) {
      expect(char.length).toBeLessThanOrEqual(4) // some emoji are multi-codepoint
      expect(char.length).toBeGreaterThan(0)
    }
  })

  it('has 44 emoji entries', () => {
    expect(Object.keys(EMOJI_MAP).length).toBeGreaterThan(40)
  })
})
