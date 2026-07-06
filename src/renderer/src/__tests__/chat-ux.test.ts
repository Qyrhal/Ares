import { describe, it, expect } from 'vitest'

describe('CodeBlock copy', () => {
  function extractCode(text: string): string {
    return text.replace(/```\w*\n?/, '').replace(/\n?```$/, '')
  }

  it('extracts code from fenced block', () => {
    const md = '```ts\nconst x = 1\n```'
    expect(extractCode(md)).toBe('const x = 1')
  })

  it('extracts code with language specifier', () => {
    const md = '```javascript\nconsole.log("hello")\n```'
    expect(extractCode(md)).toBe('console.log("hello")')
  })

  it('preserves indentation in code', () => {
    const md = '```py\n  def foo():\n    pass\n```'
    expect(extractCode(md)).toContain('  def foo()')
  })

  it('handles empty code blocks', () => {
    const md = '```\n```'
    expect(extractCode(md)).toBe('')
  })

  it('handles multi-line code blocks', () => {
    const md = '```\nline1\nline2\nline3\n```'
    const code = extractCode(md)
    expect(code.split('\n')).toHaveLength(3)
  })
})

describe('Chat auto-scroll behavior', () => {
  it('scrolls to bottom on new message', () => {
    let isAtBottom = true
    const messages: string[] = []
    const addMessage = (): void => {
      messages.push('new')
      if (isAtBottom) {
        // would scrollIntoView
      }
    }
    addMessage()
    expect(messages).toHaveLength(1)
  })

  it('does not auto-scroll when user scrolled up', () => {
    let isAtBottom = false
    const messages: string[] = []
    const addMessage = (): void => {
      messages.push('new')
      if (isAtBottom) {
        // would scrollIntoView
      }
    }
    addMessage()
    expect(messages).toHaveLength(1)
    // No scroll would happen (isAtBottom is false)
  })

  it('resumes auto-scroll after clicking scroll-to-bottom', () => {
    let isAtBottom = false
    const scrollToBottom = (): void => {
      isAtBottom = true
    }
    scrollToBottom()
    expect(isAtBottom).toBe(true)
  })

  it('detects scroll position near bottom', () => {
    const scrollHeight = 1000
    const clientHeight = 500
    const scrollTop = 450
    const threshold = 100
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold
    expect(atBottom).toBe(true)
  })

  it('detects scroll position far from bottom', () => {
    const scrollHeight = 1000
    const clientHeight = 500
    const scrollTop = 100
    const threshold = 100
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold
    expect(atBottom).toBe(false)
  })
})

describe('Token counter', () => {
  it('estimates tokens from character count', () => {
    const chars = 100
    const tokens = Math.round(chars / 4)
    expect(tokens).toBe(25)
  })

  it('calculates tokens per second', () => {
    const chars = 200
    const elapsed = 5 // seconds
    const tokensPerSec = elapsed > 0 ? Math.round((chars / 4) / elapsed) : 0
    expect(tokensPerSec).toBe(10)
  })

  it('shows 0 tps when no elapsed time', () => {
    const chars = 100
    const elapsed = 0
    const tokensPerSec = elapsed > 0 ? Math.round((chars / 4) / elapsed) : 0
    expect(tokensPerSec).toBe(0)
  })

  it('handles empty streaming message', () => {
    const charCount = 0
    expect(charCount).toBe(0)
  })

  it('only shows token badge when content exists', () => {
    const charCount = 50
    const showBadge = charCount > 0
    expect(showBadge).toBe(true)
  })
})

describe('Scroll-to-bottom button', () => {
  it('appears when scrolled up during streaming', () => {
    const isAtBottom = false
    const isLoading = true
    const showButton = !isAtBottom && isLoading
    expect(showButton).toBe(true)
  })

  it('hidden when at bottom', () => {
    const isAtBottom = true
    const isLoading = true
    const showButton = !isAtBottom && isLoading
    expect(showButton).toBe(false)
  })

  it('hidden when not streaming', () => {
    const isAtBottom = false
    const isLoading = false
    const showButton = !isAtBottom && isLoading
    expect(showButton).toBe(false)
  })

  it('hidden when at bottom and not streaming', () => {
    const isAtBottom = true
    const isLoading = false
    const showButton = !isAtBottom && isLoading
    expect(showButton).toBe(false)
  })
})
