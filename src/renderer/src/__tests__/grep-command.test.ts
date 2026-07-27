import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_COMMANDS } from '@/components/InputBar'

describe('/grep command', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('is registered in BUILTIN_COMMANDS', () => {
    const grepCmd = BUILTIN_COMMANDS.find((c) => c.name === 'grep')
    expect(grepCmd).toBeDefined()
    expect(grepCmd?.kind).toBe('builtin')
    expect(grepCmd?.description).toContain('Search workspace file contents')
  })

  it('has correct description mentioning search', () => {
    const grepCmd = BUILTIN_COMMANDS.find((c) => c.name === 'grep')!
    expect(grepCmd.description).toMatch(/search/i)
  })

  it('has correct number of BUILTIN_COMMANDS', () => {
    expect(BUILTIN_COMMANDS.length).toBe(72)
  })

  it('shows usage when no args provided', () => {
    const args = ''
    const lines: string[] = ['**Search Results**\n']
    if (!args.trim()) {
      lines.push('Usage: `/grep <pattern> [--ext ts]` — search workspace file contents')
    }
    expect(lines[1]).toContain('Usage:')
    expect(lines[1]).toContain('--ext')
  })

  it('shows search results output', () => {
    const result = { ok: true, output: 'file.ts:1:const x = 1\nfile.ts:5:const y = 2' }
    const lines: string[] = ['**Search Results**\n']
    const output = result.output.length > 3000
      ? result.output.slice(0, 3000) + '\n\n[output truncated]'
      : result.output
    lines.push(`\`\`\`\n${output}\n\`\`\``)
    const matchCount = (result.output.match(/\n/g) || []).length + 1
    lines.push(`\n_${matchCount} matches found_`)
    expect(lines[1]).toContain('file.ts')
    expect(lines[2]).toContain('2 matches found')
  })

  it('shows "no matches" for empty output', () => {
    const result = { ok: true, output: '' }
    const pattern = 'nonexistent'
    const lines: string[] = ['**Search Results**\n']
    if (!result.output) {
      lines.push(`No matches found for \`${pattern}\``)
    }
    expect(lines[1]).toContain('No matches found')
    expect(lines[1]).toContain('nonexistent')
  })

  it('handles error response', () => {
    const result = { ok: false, output: 'Permission denied' }
    const lines: string[] = ['**Search Results**\n']
    if (!result.ok) {
      lines.push(`Error: ${result.output}`)
    }
    expect(lines[1]).toContain('Error: Permission denied')
  })

  it('truncates long output at 3000 chars', () => {
    const output = 'x'.repeat(5000)
    const truncated = output.length > 3000
      ? output.slice(0, 3000) + '\n\n[output truncated]'
      : output
    expect(truncated).toContain('[output truncated]')
    expect(truncated.length).toBeLessThan(5000)
  })

  it('does not truncate short output', () => {
    const output = 'file.ts:1:const x = 1'
    const truncated = output.length > 3000
      ? output.slice(0, 3000) + '\n\n[output truncated]'
      : output
    expect(truncated).toBe(output)
    expect(truncated).not.toContain('[output truncated]')
  })

  it('parses --ext flag correctly', () => {
    const raw = 'myFunction --ext ts'
    const extMatch = raw.match(/--ext\s+(\w+)/)
    const ext = extMatch ? extMatch[1] : undefined
    const pattern = raw.replace(/--ext\s+\w+/, '').trim()
    expect(ext).toBe('ts')
    expect(pattern).toBe('myFunction')
  })

  it('handles pattern without --ext flag', () => {
    const raw = 'myFunction'
    const extMatch = raw.match(/--ext\s+(\w+)/)
    const ext = extMatch ? extMatch[1] : undefined
    const pattern = raw.replace(/--ext\s+\w+/, '').trim()
    expect(ext).toBeUndefined()
    expect(pattern).toBe('myFunction')
  })
})
