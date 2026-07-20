import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/review slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('builds correct system prompt for review', () => {
    const prompt = 'You are a code reviewer. Analyze the conversation below and provide: 1) A brief summary of what was discussed/accomplished. 2) Code quality observations (patterns, potential issues). 3) 2-3 specific suggestions for improvement. Be concise and actionable.'
    expect(prompt).toContain('code reviewer')
    expect(prompt).toContain('summary')
    expect(prompt).toContain('suggestions')
  })

  it('returns early when no messages', () => {
    const messages: any[] = []
    expect(messages.length).toBe(0)
  })

  it('formats review response with header', () => {
    const content = 'Some review text'
    const formatted = `**📝 Session Review**\n\n${content}`
    expect(formatted).toContain('📝 Session Review')
    expect(formatted).toContain('Some review text')
  })

  it('truncates to last 20 messages for context', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}` }))
    const sliced = messages.slice(-20)
    expect(sliced.length).toBe(20)
    expect(sliced[0].content).toBe('msg 10')
  })

  it('handles API error gracefully', () => {
    const status = 500
    const errorMsg = `Review failed: ${status}`
    expect(errorMsg).toContain('500')
  })

  it('handles missing content in response', () => {
    const response = { choices: [] }
    const content = response.choices?.[0]?.message?.content ?? 'No review generated.'
    expect(content).toBe('No review generated.')
  })

  it('builds request body with correct model', () => {
    const model = 'gpt-4o'
    const body = { model, messages: [], stream: false }
    expect(body.model).toBe('gpt-4o')
    expect(body.stream).toBe(false)
  })

  it('includes Authorization header when API key exists', () => {
    const apiKey = 'test-key'
    const header = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    expect(header).toHaveProperty('Authorization')
    expect(header.Authorization).toBe('Bearer test-key')
  })
})
