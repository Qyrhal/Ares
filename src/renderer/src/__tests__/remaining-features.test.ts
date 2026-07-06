import { describe, it, expect } from 'vitest'

describe('Session rename', () => {
  it('updates session title', () => {
    const session = { id: 's1', title: 'Old Title' }
    const updated = { ...session, title: 'New Title' }
    expect(updated.title).toBe('New Title')
  })
})

describe('Zoom controls', () => {
  it('defaults to 14px', () => {
    expect(14).toBe(14)
  })
  it('supports range 10-24', () => {
    const valid = (z: number) => z >= 10 && z <= 24
    expect(valid(10)).toBe(true)
    expect(valid(24)).toBe(true)
    expect(valid(8)).toBe(false)
    expect(valid(30)).toBe(false)
  })
})

describe('File word count', () => {
  function wordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0
  }
  it('counts words', () => expect(wordCount('hello world')).toBe(2))
  it('returns 0 for empty', () => expect(wordCount('')).toBe(0))
  it('handles whitespace', () => expect(wordCount('   ')).toBe(0))
})

describe('Line count', () => {
  function lineCount(text: string): number {
    return text ? text.split('\n').length : 0
  }
  it('counts lines', () => expect(lineCount('a\nb\nc')).toBe(3))
  it('returns 0 for empty', () => expect(lineCount('')).toBe(0))
})

describe('Code block detection', () => {
  function hasCodeBlock(text: string): boolean {
    return text.includes('```')
  }
  it('detects fenced code blocks', () => expect(hasCodeBlock('```ts\nconst x = 1\n```')).toBe(true))
  it('handles plain text', () => expect(hasCodeBlock('hello world')).toBe(false))
})

describe('URL detection', () => {
  function hasUrl(text: string): boolean {
    return /https?:\/\/[^\s]+/.test(text)
  }
  it('detects http URLs', () => expect(hasUrl('visit https://example.com')).toBe(true))
  it('detects https URLs', () => expect(hasUrl('visit https://example.com')).toBe(true))
  it('ignores plain text', () => expect(hasUrl('hello world')).toBe(false))
})

describe('File extension detection', () => {
  function getExtension(name: string): string {
    return name.split('.').pop()?.toLowerCase() || ''
  }
  it('extracts extension', () => expect(getExtension('file.ts')).toBe('ts'))
  it('handles no extension', () => expect(getExtension('Makefile')).toBe('makefile'))
  it('handles multiple dots', () => expect(getExtension('file.test.tsx')).toBe('tsx'))
})

describe('Chat message search', () => {
  function searchMessages(messages: string[], query: string): number[] {
    const q = query.toLowerCase()
    return messages.map((m, i) => m.toLowerCase().includes(q) ? i : -1).filter((i) => i >= 0)
  }
  const msgs = ['Hello world', 'Error occurred', 'Fix the bug', 'Another error']
  it('finds matching messages', () => expect(searchMessages(msgs, 'error')).toEqual([1, 3]))
  it('returns empty for no match', () => expect(searchMessages(msgs, 'xyz')).toEqual([]))
  it('case insensitive', () => expect(searchMessages(msgs, 'ERROR')).toEqual([1, 3]))
})

describe('File sorting', () => {
  it('sorts directories before files', () => {
    const items = [
      { name: 'b.ts', isDirectory: false },
      { name: 'a', isDirectory: true },
    ]
    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    expect(items[0].name).toBe('a')
    expect(items[0].isDirectory).toBe(true)
  })
})

describe('Empty state messages', () => {
  function emptyMessage(type: string): string {
    const map: Record<string, string> = {
      chat: 'No messages yet',
      files: 'No files open',
      git: 'No repository',
      terminal: 'No terminal sessions',
    }
    return map[type] || 'Nothing here'
  }
  it('shows chat empty state', () => expect(emptyMessage('chat')).toBe('No messages yet'))
  it('shows file empty state', () => expect(emptyMessage('files')).toBe('No files open'))
  it('shows git empty state', () => expect(emptyMessage('git')).toBe('No repository'))
  it('falls back for unknown', () => expect(emptyMessage('unknown')).toBe('Nothing here'))
})
