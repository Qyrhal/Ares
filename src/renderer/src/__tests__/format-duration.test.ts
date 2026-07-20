import { describe, it, expect } from 'vitest'
import { formatDuration } from '@/lib/utils'

describe('formatDuration', () => {
  it('formats seconds as seconds', () => {
    expect(formatDuration(0, 5000)).toBe('5s')
  })

  it('formats minutes only', () => {
    expect(formatDuration(0, 120000)).toBe('2m')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(0, 3660000)).toBe('1h 1m')
  })

  it('formats exactly one hour', () => {
    expect(formatDuration(0, 3600000)).toBe('1h 0m')
  })

  it('returns <1m for sub-second', () => {
    expect(formatDuration(0, 500)).toBe('<1m')
  })

  it('returns <1m for zero', () => {
    expect(formatDuration(0, 0)).toBe('<1m')
  })

  it('handles negative difference by clamping to 0', () => {
    expect(formatDuration(5000, 0)).toBe('<1m')
  })

  it('handles real-world timestamps', () => {
    const start = Date.now() - 30 * 60 * 1000 // 30 min ago
    expect(formatDuration(start, Date.now())).toBe('30m')
  })

  it('formats multiple hours', () => {
    expect(formatDuration(0, 7200000 + 900000)).toBe('2h 15m')
  })
})
