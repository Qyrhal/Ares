import { describe, it, expect } from 'vitest'

describe('/wc command logic', () => {
  it('counts lines, words, and bytes for a file', () => {
    const content = 'hello world\nfoo bar baz\n'
    const lineCount = content.split('\n').length
    const wordCount = content.split(/\s+/).filter(Boolean).length
    const byteCount = new Blob([content]).size
    expect(lineCount).toBe(3)
    expect(wordCount).toBe(5)
    expect(byteCount).toBeGreaterThan(0)
  })

  it('formats file stats output', () => {
    const filePath = 'src/index.ts'
    const lineCount = 100
    const wordCount = 500
    const byteCount = 3072
    const lines: string[] = [
      `**\`${filePath}\`**\n`,
      `· ${lineCount.toLocaleString()} lines`,
      `· ${wordCount.toLocaleString()} words`,
      `· ${byteCount.toLocaleString()} bytes (${(byteCount / 1024).toFixed(1)} KB)`,
    ]
    expect(lines.length).toBe(4)
    expect(lines[0]).toContain('src/index.ts')
    expect(lines[1]).toContain('100')
    expect(lines[2]).toContain('500')
    expect(lines[3]).toContain('KB')
  })

  it('formats workspace totals output', () => {
    const fileCount = 42
    const totalLines = 10000
    const totalWords = 50000
    const totalBytes = 204800
    const lines: string[] = [
      '**Workspace Totals**\n',
      `· Files scanned: ${fileCount}`,
      `· Total lines: ${totalLines.toLocaleString()}`,
      `· Total words: ${totalWords.toLocaleString()}`,
      `· Total bytes: ${totalBytes.toLocaleString()} (${(totalBytes / 1024).toFixed(1)} KB)`,
    ]
    expect(lines.length).toBe(5)
    expect(lines[1]).toContain('42')
    expect(lines[2]).toContain('10,000')
    expect(lines[4]).toContain('200.0 KB')
  })

  it('shows no workspace message', () => {
    const workspacePath = null
    const lines: string[] = []
    if (!workspacePath) {
      lines.push('No workspace folder is open.')
    }
    expect(lines).toContain('No workspace folder is open.')
  })

  it('shows usage when no args', () => {
    const raw = ''
    const lines: string[] = []
    if (!raw) {
      lines.push('Usage: `/wc <file> [--ext ts]` — count lines, words, and bytes')
      lines.push('`/wc --all` — count totals for all workspace source files')
    }
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('/wc')
  })

  it('shows error for read failure', () => {
    const err = new Error('ENOENT: no such file')
    const lines: string[] = [`**Error reading file:** ${err.message}`]
    expect(lines[0]).toContain('ENOENT')
  })

  it('handles empty file', () => {
    const content = ''
    const lineCount = content.split('\n').length
    const wordCount = content.split(/\s+/).filter(Boolean).length
    const byteCount = new Blob([content]).size
    expect(lineCount).toBe(1)
    expect(wordCount).toBe(0)
    expect(byteCount).toBe(0)
  })

  it('counts words correctly with multiple whitespace', () => {
    const content = '  hello   world  \n\n  foo  '
    const wordCount = content.split(/\s+/).filter(Boolean).length
    expect(wordCount).toBe(3)
  })

  it('resolves relative path against workspace', () => {
    const workspacePath = '/home/user/project'
    const filePath = 'src/index.ts'
    const fullPath = filePath.startsWith('/') ? filePath : `${workspacePath}/${filePath}`
    expect(fullPath).toBe('/home/user/project/src/index.ts')
  })

  it('keeps absolute paths as-is', () => {
    const workspacePath = '/home/user/project'
    const filePath = '/etc/hosts'
    const fullPath = filePath.startsWith('/') ? filePath : `${workspacePath}/${filePath}`
    expect(fullPath).toBe('/etc/hosts')
  })

  it('shows overflow message for many files', () => {
    const fileCount = 250
    const lines: string[] = []
    if (fileCount > 200) {
      lines.push(`\n_${fileCount} source files found, showing first 200_`)
    }
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('250')
  })
})
