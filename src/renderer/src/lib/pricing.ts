// Approximate pricing per 1K tokens (input / output)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-sonnet-4': { input: 0.003, output: 0.015 },
  'claude-haiku-3.5': { input: 0.0008, output: 0.004 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model]
  if (!pricing) return 0
  return (inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output)
}

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4)
}

export function getContextWindow(model: string): number {
  const windows: Record<string, number> = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-3.5-turbo': 16385,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'claude-sonnet-4': 200000,
    'claude-haiku-3.5': 200000,
  }
  return windows[model] || 128000
}
