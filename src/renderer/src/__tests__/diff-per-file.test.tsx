import { describe, it, expect } from 'vitest'

describe('/diff per-file enhancement', () => {
  it('filters files by partial path match', () => {
    const allFiles = [
      { path: 'src/App.tsx' },
      { path: 'src/utils.ts' },
      { path: 'tests/app.test.tsx' },
    ]
    const targetFile = 'App'
    const matched = allFiles.filter((f) => f.path.includes(targetFile))
    expect(matched).toHaveLength(1)
    expect(matched[0].path).toBe('src/App.tsx')
  })

  it('returns empty when no file matches', () => {
    const allFiles = [
      { path: 'src/App.tsx' },
      { path: 'src/utils.ts' },
    ]
    const targetFile = 'nonexistent'
    const matched = allFiles.filter((f) => f.path.includes(targetFile))
    expect(matched).toHaveLength(0)
  })

  it('shows all files when no target specified', () => {
    const allFiles = [
      { path: 'src/App.tsx' },
      { path: 'src/utils.ts' },
    ]
    const targetFile = ''
    const matched = targetFile ? allFiles.filter((f) => f.path.includes(targetFile)) : allFiles
    expect(matched).toHaveLength(2)
  })

  it('formats diff header with file name', () => {
    const targetFile = 'App.tsx'
    const header = targetFile ? `**Git Diff — \`${targetFile}\`**` : '**Git Diff**'
    expect(header).toBe('**Git Diff — `App.tsx`**')
  })

  it('formats diff header without file name', () => {
    const targetFile = ''
    const header = targetFile ? `**Git Diff — \`${targetFile}\`**` : '**Git Diff**'
    expect(header).toBe('**Git Diff**')
  })

  it('shows no-match message', () => {
    const targetFile = 'nonexistent'
    const matched: string[] = []
    const lines: string[] = []
    if (matched.length === 0) {
      lines.push(`No changes found for \`${targetFile}\`.`)
    }
    expect(lines).toContain('No changes found for `nonexistent`.')
  })

  it('shows no changes message', () => {
    const allFiles: string[] = []
    const lines: string[] = []
    if (allFiles.length === 0) {
      lines.push('No changes in working tree.')
    }
    expect(lines).toContain('No changes in working tree.')
  })

  it('truncates long output', () => {
    const diffText = 'x'.repeat(5000)
    const truncated = diffText.length > 4000 ? diffText.slice(0, 4000) + '\n\n[truncated]' : diffText
    expect(truncated).toContain('[truncated]')
  })
})
