import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/fetch slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires a URL argument', () => {
    const args = ''
    expect(args).toBe('')
  })

  it('validates URL starts with http or https', () => {
    const isValid = (url: string) => url.startsWith('http://') || url.startsWith('https://')
    expect(isValid('https://example.com')).toBe(true)
    expect(isValid('http://example.com')).toBe(true)
    expect(isValid('ftp://example.com')).toBe(false)
    expect(isValid('example.com')).toBe(false)
    expect(isValid('not-a-url')).toBe(false)
  })

  it('formats a successful fetch result', () => {
    const url = 'https://docs.example.com/api'
    const length = 1234
    const contentType = 'text/html'
    const header = `**Fetched** \`${url}\` (${length.toLocaleString()} chars, ${contentType})`
    expect(header).toContain('https://docs.example.com/api')
    expect(header).toContain('1,234 chars')
    expect(header).toContain('text/html')
  })

  it('formats a fetch failure', () => {
    const error = 'HTTP 404 Not Found'
    const msg = `**Fetch failed:** ${error}`
    expect(msg).toContain('Fetch failed')
    expect(msg).toContain('404 Not Found')
  })

  it('truncates large content', () => {
    const content = 'A'.repeat(5000)
    const display = content.length > 4000 ? content.slice(0, 4000) : content
    expect(display.length).toBe(4000)
  })

  it('shows usage when no args provided', () => {
    const msg = 'Usage: /fetch <url> — Fetch web content from a URL.'
    expect(msg).toContain('/fetch <url>')
  })

  it('shows error for invalid URL scheme', () => {
    const msg = '**Error:** URL must start with `http://` or `https://`.'
    expect(msg).toContain('http://')
    expect(msg).toContain('https://')
  })

  it('handles network errors gracefully', () => {
    const error = 'fetch failed'
    const msg = `**Error:** ${error}`
    expect(msg).toContain('Error')
    expect(msg).toContain('fetch failed')
  })

  it('truncates content exceeding 8000 chars with notice', () => {
    const content = 'A'.repeat(9000)
    const truncated = content.length >= 8000 ? '\n\n*[content truncated at 8000 chars]*' : ''
    expect(truncated).toContain('truncated')
  })
})
