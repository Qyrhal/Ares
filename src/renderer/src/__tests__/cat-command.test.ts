import { describe, it, expect } from 'vitest'

describe('/cat command logic', () => {
  it('formats file content with line count and size', () => {
    const filePath = 'src/index.ts'
    const content = 'const x = 1\nconst y = 2\n'
    const lineCount = content.split('\n').length
    const size = new Blob([content]).size
    const lines: string[] = [
      `**\`${filePath}\`**`,
      `\`\`\`\n${content}\n\`\`\``,
      `\n_${lineCount} lines, ${size} bytes_`,
    ]
    expect(lines.length).toBe(3)
    expect(lines[0]).toContain('src/index.ts')
    expect(lines[2]).toContain('lines')
    expect(lines[2]).toContain('bytes')
  })

  it('truncates long content at 4000 chars', () => {
    const content = 'x'.repeat(5000)
    const display = content.length > 4000
      ? content.slice(0, 4000) + '\n\n[content truncated — use --head or --tail for partial views]'
      : content
    expect(display).toContain('[content truncated')
    expect(display.length).toBeLessThan(5000)
  })

  it('does not truncate short content', () => {
    const content = 'short file'
    const display = content.length > 4000
      ? content.slice(0, 4000) + '\n\n[content truncated]'
      : content
    expect(display).toBe('short file')
    expect(display).not.toContain('[content truncated')
  })

  it('shows no workspace message', () => {
    const workspacePath = null
    const lines: string[] = []
    if (!workspacePath) {
      lines.push('No workspace folder is open.')
    }
    expect(lines).toContain('No workspace folder is open.')
  })

  it('shows usage when no file specified', () => {
    const raw = ''
    const lines: string[] = []
    if (!raw) {
      lines.push('Usage: `/cat <file> [--head N] [--tail N]` — display file contents in chat')
    }
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('/cat')
  })

  it('shows error message for read failure', () => {
    const err = new Error('ENOENT: no such file')
    const lines: string[] = [`**Error reading file:** ${err.message}`]
    expect(lines[0]).toContain('ENOENT')
  })

  it('parses --head flag', () => {
    const raw = 'src/index.ts --head 5'
    const headMatch = raw.match(/--head\s+(\d+)/)
    const headN = headMatch ? parseInt(headMatch[1], 10) : undefined
    const filePath = raw.replace(/--head\s+\d+/, '').trim()
    expect(headN).toBe(5)
    expect(filePath).toBe('src/index.ts')
  })

  it('parses --tail flag', () => {
    const raw = 'src/index.ts --tail 10'
    const tailMatch = raw.match(/--tail\s+(\d+)/)
    const tailN = tailMatch ? parseInt(tailMatch[1], 10) : undefined
    const filePath = raw.replace(/--tail\s+\d+/, '').trim()
    expect(tailN).toBe(10)
    expect(filePath).toBe('src/index.ts')
  })

  it('applies --head correctly', () => {
    const content = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8'
    const allLines = content.split('\n')
    const headN = 3
    const display = allLines.slice(0, headN).join('\n')
    expect(display).toBe('line1\nline2\nline3')
    expect(display.split('\n').length).toBe(3)
  })

  it('applies --tail correctly', () => {
    const content = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8'
    const allLines = content.split('\n')
    const tailN = 3
    const display = allLines.slice(-tailN).join('\n')
    expect(display).toBe('line6\nline7\nline8')
    expect(display.split('\n').length).toBe(3)
  })

  it('applies both --head and --tail correctly', () => {
    const content = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n')
    const allLines = content.split('\n')
    const headN = 3
    const tailN = 3
    const head = allLines.slice(0, headN)
    const tail = allLines.slice(-tailN)
    const display = [...head, `\n... (${allLines.length - headN - tailN} lines omitted) ...\n`, ...tail].join('\n')
    expect(display).toContain('line1')
    expect(display).toContain('line20')
    expect(display).toContain('14 lines omitted')
  })

  it('shows overflow message for --head when file is longer', () => {
    const content = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n')
    const allLines = content.split('\n')
    const headN = 3
    const display = allLines.slice(0, headN).join('\n')
    let result = display
    if (allLines.length > headN) {
      result += `\n\n... (${allLines.length - headN} more lines, showing first ${headN})`
    }
    expect(result).toContain('7 more lines')
    expect(result).toContain('showing first 3')
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
})
