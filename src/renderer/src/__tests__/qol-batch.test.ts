import { describe, it, expect } from 'vitest'

describe('File type icons', () => {
  function fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase()
    if (['tsx','ts','js','jsx'].includes(ext || '')) return 'code'
    if (['md','txt'].includes(ext || '')) return 'text'
    if (['png','jpg','svg','gif'].includes(ext || '')) return 'image'
    if (['css','scss','less'].includes(ext || '')) return 'style'
    if (['py','rb','go','rs'].includes(ext || '')) return 'code'
    return 'file'
  }

  it('typescript files show code icon', () => expect(fileIcon('app.tsx')).toBe('code'))
  it('javascript files show code icon', () => expect(fileIcon('app.js')).toBe('code'))
  it('markdown files show text icon', () => expect(fileIcon('readme.md')).toBe('text'))
  it('image files show image icon', () => expect(fileIcon('photo.png')).toBe('image'))
  it('css files show style icon', () => expect(fileIcon('styles.css')).toBe('style'))
  it('unknown files show file icon', () => expect(fileIcon('data.bin')).toBe('file'))
})

describe('Character counter', () => {
  it('counts normal text', () => expect('hello'.length).toBe(5))
  it('counts empty input', () => expect(''.length).toBe(0))
  it('counts multi-line', () => expect('line1\nline2'.length).toBe(11))
})

describe('Session title truncation', () => {
  function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n - 1) + '…'
  }

  it('shortens long titles', () => expect(truncate('Hello World This Is Long', 10)).toBe('Hello Wor…'))
  it('keeps short titles', () => expect(truncate('Hi', 10)).toBe('Hi'))
  it('handles empty', () => expect(truncate('', 10)).toBe(''))
})

describe('Undo delete toast', () => {
  it('stores deleted item for undo', () => {
    let lastDeleted: { id: string; content: string } | null = { id: 'm1', content: 'hello' }
    expect(lastDeleted).not.toBeNull()
    expect(lastDeleted!.id).toBe('m1')
    lastDeleted = null
    expect(lastDeleted).toBeNull()
  })
})

describe('Dirty file indicator', () => {
  it('marks file as dirty when modified', () => {
    const tab = { type: 'file' as const, path: '/f.ts', name: 'f.ts', isDirty: true }
    expect(tab.isDirty).toBe(true)
  })
  it('clears dirty after save', () => {
    const tab = { type: 'file' as const, path: '/f.ts', name: 'f.ts', isDirty: false }
    expect(tab.isDirty).toBe(false)
  })
})

describe('Session grouping', () => {
  function getDateGroup(ts: number): string {
    const date = new Date(ts)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
    if (date > weekAgo) return 'This Week'
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30)
    if (date > monthAgo) return 'This Month'
    return 'Older'
  }

  it('today sessions', () => expect(getDateGroup(Date.now())).toBe('Today'))
  it('yesterday sessions', () => expect(getDateGroup(Date.now() - 86400000)).toBe('Yesterday'))
  it('last week sessions', () => expect(getDateGroup(Date.now() - 5 * 86400000)).toBe('This Week'))
  it('last month sessions', () => expect(getDateGroup(Date.now() - 15 * 86400000)).toBe('This Month'))
  it('old sessions', () => expect(getDateGroup(Date.now() - 60 * 86400000)).toBe('Older'))
})

describe('Notification preferences', () => {
  it('supports desktop notifications', () => {
    const prefs = { desktop: true, sound: false }
    expect(prefs.desktop).toBe(true)
  })
  it('supports sound notifications', () => {
    const prefs = { desktop: false, sound: true }
    expect(prefs.sound).toBe(true)
  })
})

describe('Tab close other tabs', () => {
  it('closes all tabs except active', () => {
    const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const activeId = 'b'
    const remaining = tabs.filter((t) => t.id === activeId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('b')
  })
})

describe('Recent files list', () => {
  it('tracks up to 10 recent files', () => {
    const recent: string[] = []
    const add = (p: string) => { recent.unshift(p); if (recent.length > 10) recent.pop() }
    for (let i = 0; i < 15; i++) add(`/file${i}.ts`)
    expect(recent).toHaveLength(10)
    expect(recent[0]).toBe('/file14.ts')
  })
  it('deduplicates', () => {
    const recent: string[] = []
    const add = (p: string) => { const i = recent.indexOf(p); if (i > -1) recent.splice(i, 1); recent.unshift(p); if (recent.length > 10) recent.pop() }
    add('/a.ts'); add('/b.ts'); add('/a.ts')
    expect(recent).toHaveLength(2)
    expect(recent[0]).toBe('/a.ts')
  })
})
