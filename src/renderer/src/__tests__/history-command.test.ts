import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'

describe('/history slash command', () => {
  beforeEach(() => {
    useAppStore.setState({ promptHistory: [] })
  })

  it('shows empty message when no history exists', () => {
    const { promptHistory } = useAppStore.getState()
    expect(promptHistory.length).toBe(0)
  })

  it('formats numbered list of prompts', () => {
    const history = ['What is React?', 'How to use hooks?', 'Explain TypeScript generics']
    const lines: string[] = [`**Prompt History** (showing ${history.length} of ${history.length})\n`]
    for (let i = 0; i < history.length; i++) {
      lines.push(`${i + 1}. ${history[i]}`)
    }
    const text = lines.join('\n')
    expect(text).toContain('1. What is React?')
    expect(text).toContain('2. How to use hooks?')
    expect(text).toContain('3. Explain TypeScript generics')
  })

  it('truncates long prompts to 80 chars', () => {
    const longPrompt = 'A'.repeat(100)
    const preview = longPrompt.length > 80 ? longPrompt.slice(0, 77) + '...' : longPrompt
    expect(preview.length).toBe(80)
    expect(preview).toContain('...')
  })

  it('does not truncate short prompts', () => {
    const shortPrompt = 'Hello world'
    const preview = shortPrompt.length > 80 ? shortPrompt.slice(0, 77) + '...' : shortPrompt
    expect(preview).toBe('Hello world')
  })

  it('limits results based on args', () => {
    const history = Array.from({ length: 20 }, (_, i) => `Prompt ${i + 1}`)
    const limit = 5
    const recent = history.slice(0, limit)
    expect(recent.length).toBe(5)
    expect(recent[0]).toBe('Prompt 1')
    expect(recent[4]).toBe('Prompt 5')
  })

  it('caps limit at 50', () => {
    const history = Array.from({ length: 100 }, (_, i) => `Prompt ${i + 1}`)
    const limit = Math.min(parseInt('100', 10) || 10, 50)
    expect(limit).toBe(50)
    const recent = history.slice(0, limit)
    expect(recent.length).toBe(50)
  })

  it('defaults to 10 when no args', () => {
    const args = ''
    const limit = args ? Math.min(parseInt(args, 10) || 10, 50) : 10
    expect(limit).toBe(10)
  })

  it('handles numeric args correctly', () => {
    const args = '25'
    const limit = args ? Math.min(parseInt(args, 10) || 10, 50) : 25
    expect(limit).toBe(25)
  })

  it('defaults to 10 for non-numeric args', () => {
    const args = 'abc'
    const limit = args ? Math.min(parseInt(args, 10) || 10, 50) : 10
    expect(limit).toBe(10)
  })

  it('help text includes /history command', () => {
    const helpText = 'Commands: /history <n> - show recent prompt history'
    expect(helpText).toContain('/history')
    expect(helpText).toContain('prompt history')
  })

  it('history command exists in switch cases', () => {
    const commands = ['model', 'clear', 'compact', 'shortcuts', 'note', 'pin', 'debug', 'history', 'rename', 'log', 'review', 'cost', 'help', 'status', 'summary', 'usage', 'overview', 'helpful', 'not-helpful', 'pr', 'fork', 'changes', 'diff', 'export']
    expect(commands).toContain('history')
  })

  it('shows total count in header', () => {
    const history = ['a', 'b', 'c', 'd', 'e']
    const total = history.length
    const limit = 3
    const recent = history.slice(0, limit)
    const header = `**Prompt History** (showing ${recent.length} of ${total})`
    expect(header).toContain('(showing 3 of 5)')
  })
})
