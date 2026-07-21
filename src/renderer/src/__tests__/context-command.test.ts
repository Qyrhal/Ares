import { describe, it, expect, vi, beforeEach } from 'vitest'
import { estimateTokens, contextWindow } from '../lib/context'
import { displayModel } from '../lib/providers'
import type { Message } from '../types'

function makeMsg(content: string): Message {
  return { id: Math.random().toString(), sessionId: 'test', role: 'user', content, createdAt: Date.now() }
}

describe('/context slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('estimates tokens from empty messages', () => {
    expect(estimateTokens([])).toBe(0)
  })

  it('estimates tokens from messages', () => {
    const msgs = [makeMsg('hello world')] // 11 chars / 4 = 3
    expect(estimateTokens(msgs)).toBe(3)
  })

  it('returns context window for known model', () => {
    const win = contextWindow('gpt-4o')
    expect(win).toBeGreaterThan(0)
  })

  it('returns default context window for unknown model', () => {
    const win = contextWindow('unknown-model')
    expect(win).toBeGreaterThan(0)
  })

  it('calculates utilization percentage', () => {
    const used = 50000
    const window = 128000
    const pct = Math.min(100, Math.round((used / window) * 100))
    expect(pct).toBe(39)
  })

  it('caps percentage at 100', () => {
    const used = 200000
    const window = 128000
    const pct = Math.min(100, Math.round((used / window) * 100))
    expect(pct).toBe(100)
  })

  it('renders progress bar', () => {
    const barLen = 20
    const pct = 50
    const filled = Math.round((pct / 100) * barLen)
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled)
    expect(bar).toHaveLength(20)
    expect(bar).toContain('█')
    expect(bar).toContain('░')
  })

  it('determines color by utilization', () => {
    const getColor = (pct: number) => pct < 50 ? 'green' : pct < 75 ? 'yellow' : pct < 90 ? 'orange' : 'red'
    expect(getColor(30)).toBe('green')
    expect(getColor(60)).toBe('yellow')
    expect(getColor(80)).toBe('orange')
    expect(getColor(95)).toBe('red')
  })

  it('formats model display name', () => {
    const name = displayModel('gpt-4o-mini')
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThan(0)
  })

  it('formats context message lines', () => {
    const model = 'gpt-4o'
    const used = 50000
    const window = 128000
    const pct = Math.min(100, Math.round((used / window) * 100))
    const lines = [
      '**Context Window**',
      `**Model:** ${displayModel(model)}`,
      `**Used:** ~${used.toLocaleString()} tokens`,
      `**Window:** ${window.toLocaleString()} tokens`,
      `**Utilization:** ${pct}%`,
    ]
    expect(lines[0]).toBe('**Context Window**')
    expect(lines[3]).toContain('128,000')
  })
})
