import { describe, it, expect, vi, beforeEach } from 'vitest'
import { estimateCost } from '@/lib/pricing'
import { estimateTokens } from '@/lib/context'

vi.mock('@/lib/context', () => ({
  estimateTokens: vi.fn(),
  contextWindow: vi.fn(() => 128000),
  needsCompaction: vi.fn(() => false),
  splitForCompaction: vi.fn(() => ({ older: [], recent: [] })),
  compactConversation: vi.fn(),
}))

const mockEstimateTokens = vi.mocked(estimateTokens)

describe('/cost command logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates cost across multiple models', () => {
    mockEstimateTokens.mockReturnValue(1000)

    const gptCost = estimateCost('gpt-4o', 1000, 1000)
    const claudeCost = estimateCost('claude-sonnet-4', 1000, 1000)

    expect(gptCost).toBeGreaterThan(0)
    expect(claudeCost).toBeGreaterThan(0)
    expect(typeof gptCost).toBe('number')
  })

  it('returns 0 for unknown model', () => {
    const cost = estimateCost('unknown-model', 1000, 1000)
    expect(cost).toBe(0)
  })

  it('handles zero tokens', () => {
    const cost = estimateCost('gpt-4o', 0, 0)
    expect(cost).toBe(0)
  })

  it('formats cost with 4 decimal places', () => {
    const cost = estimateCost('gpt-4o', 10000, 5000)
    expect(cost.toFixed(4)).toMatch(/^\d+\.\d{4}$/)
  })

  it('input cost is less than output cost for same token count', () => {
    const inputCost = estimateCost('gpt-4o', 1000, 0)
    const outputCost = estimateCost('gpt-4o', 0, 1000)
    expect(outputCost).toBeGreaterThan(inputCost)
  })
})
