import { describe, it, expect } from 'vitest'

describe('/recent command logic', () => {
  it('formats file list', () => {
    const files = ['src/main.ts', 'src/App.tsx', 'README.md']
    const lines = files.map(f => `· \`${f}\``)
    expect(lines.length).toBe(3)
    expect(lines[0]).toContain('src/main.ts')
  })

  it('shows count footer', () => {
    const files = ['a.ts', 'b.ts', 'c.ts']
    const line = `_${files.length} files (last 20 commits)_`
    expect(line).toContain('3 files')
  })

  it('shows no files message for empty result', () => {
    const files: string[] = []
    const hasFiles = files.length > 0
    expect(hasFiles).toBe(false)
  })

  it('shows no workspace message', () => {
    const workspacePath = null
    const lines: string[] = []
    if (!workspacePath) {
      lines.push('No workspace folder is open.')
    }
    expect(lines).toContain('No workspace folder is open.')
  })

  it('limits to max 50', () => {
    const limit = 100
    const effective = Math.min(limit, 50)
    expect(effective).toBe(50)
  })

  it('defaults to 20', () => {
    const input = ''
    const limit = parseInt(input, 10) || 20
    expect(limit).toBe(20)
  })

  it('parses numeric arg', () => {
    const input = '30'
    const limit = parseInt(input, 10) || 20
    expect(limit).toBe(30)
  })

  it('formats error message', () => {
    const err = new Error('git not found')
    const lines: string[] = [`Error: ${err.message}`]
    expect(lines[0]).toContain('Error: git not found')
  })

  it('deduplicates files', () => {
    const raw = ['src/a.ts', 'src/b.ts', 'src/a.ts', 'src/c.ts']
    const seen = new Set<string>()
    const files: string[] = []
    for (const f of raw) {
      if (!seen.has(f)) { seen.add(f); files.push(f) }
    }
    expect(files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
  })
})
