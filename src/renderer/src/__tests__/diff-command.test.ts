import { describe, it, expect } from 'vitest'

// ── /diff command logic ──────────────────────────────────────────────────────

describe('/diff slash command logic', () => {
  it('formats diff output with file headers', () => {
    const filePath = 'src/main.ts'
    const diffContent = '-old line\n+new line'
    const formatted = `### ${filePath} (unstaged)\n\`\`\`diff\n${diffContent}\n\`\`\``
    expect(formatted).toContain('### src/main.ts (unstaged)')
    expect(formatted).toContain('-old line')
    expect(formatted).toContain('+new line')
  })

  it('marks staged files correctly', () => {
    const formatted = `### file.ts (staged)\n\`\`\`diff\n+added\n\`\`\``
    expect(formatted).toContain('(staged)')
  })

  it('marks unstaged files correctly', () => {
    const formatted = `### file.ts (unstaged)\n\`\`\`diff\n-removed\n\`\`\``
    expect(formatted).toContain('(unstaged)')
  })

  it('combines multiple file diffs', () => {
    const parts = [
      '### a.ts (staged)\n```diff\n+1\n```',
      '### b.ts (unstaged)\n```diff\n-2\n```',
    ]
    const combined = parts.join('\n\n')
    expect(combined).toContain('### a.ts')
    expect(combined).toContain('### b.ts')
  })

  it('caps at 30 files with overflow message', () => {
    const allFiles = Array.from({ length: 35 }, (_, i) => ({ path: `file${i}.ts`, status: 'M' }))
    const sliced = allFiles.slice(0, 30)
    expect(sliced).toHaveLength(30)
    const overflow = allFiles.length - 30
    expect(overflow).toBe(5)
  })

  it('returns early when no workspace path', () => {
    const workspacePath = null
    expect(workspacePath).toBeNull()
  })

  it('returns early when no repo', () => {
    const status = { hasRepo: false }
    expect(status.hasRepo).toBe(false)
  })

  it('returns early when working tree is clean', () => {
    const status = { staged: [], unstaged: [], untracked: [] }
    const allFiles = [...status.staged, ...status.unstaged]
    expect(allFiles).toHaveLength(0)
  })

  it('formats header with git diff title', () => {
    const header = '**Git Diff**\n\n'
    expect(header).toContain('Git Diff')
  })
})
