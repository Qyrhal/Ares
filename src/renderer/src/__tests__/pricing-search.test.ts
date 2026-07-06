import { describe, it, expect } from 'vitest'
import { estimateCost, estimateTokens, getContextWindow } from '@/lib/pricing'

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('hello world')).toBe(3)
  })
  it('returns 0 for empty', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

describe('getContextWindow', () => {
  it('returns 128K for gpt-4o', () => {
    expect(getContextWindow('gpt-4o')).toBe(128000)
  })
  it('returns 200K for claude models', () => {
    expect(getContextWindow('claude-sonnet-4')).toBe(200000)
  })
  it('returns default for unknown', () => {
    expect(getContextWindow('unknown-model')).toBe(128000)
  })
})

describe('estimateCost', () => {
  it('calculates gpt-4o cost', () => {
    const cost = estimateCost('gpt-4o', 1000, 500)
    expect(cost).toBeCloseTo(0.005 * 1 + 0.015 * 0.5, 5)
  })
  it('returns 0 for unknown model', () => {
    expect(estimateCost('unknown', 1000, 500)).toBe(0)
  })
  it('returns 0 for zero tokens', () => {
    expect(estimateCost('gpt-4o', 0, 0)).toBe(0)
  })
})

describe('fuzzyMatch', () => {
  const { fuzzyMatch } = require('@/lib/search')
  it('matches exact text', () => {
    expect(fuzzyMatch('hello', 'hello')).toBe(true)
  })
  it('matches substring', () => {
    expect(fuzzyMatch('hel', 'hello')).toBe(true)
  })
  it('matches case insensitive', () => {
    expect(fuzzyMatch('HEL', 'hello')).toBe(true)
  })
  it('fuzzy matches characters in order', () => {
    expect(fuzzyMatch('hlo', 'hello')).toBe(true)
  })
  it('rejects wrong order', () => {
    expect(fuzzyMatch('lh', 'hello')).toBe(false)
  })
  it('handles empty query', () => {
    expect(fuzzyMatch('', 'anything')).toBe(true)
  })
})
