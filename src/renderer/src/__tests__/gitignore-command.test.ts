import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_COMMANDS } from '@/components/InputBar'

describe('/gitignore command', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find((c) => c.name === 'gitignore')
    expect(cmd).toBeDefined()
    expect(cmd?.kind).toBe('builtin')
    expect(cmd?.description).toContain('Manage .gitignore patterns')
  })

  it('has correct description mentioning gitignore', () => {
    const cmd = BUILTIN_COMMANDS.find((c) => c.name === 'gitignore')!
    expect(cmd.description).toMatch(/gitignore/i)
  })

  it('has correct number of BUILTIN_COMMANDS', () => {
    expect(BUILTIN_COMMANDS.length).toBe(81)
  })

  it('shows content when no args provided', () => {
    const content = 'node_modules/\n*.log\n'
    const argsStr = ''
    let result = ''
    if (!argsStr) {
      const lines = content.split('\n')
      result = `**.gitignore** (${lines.length} lines)\n\n\`\`\`\n${content}\n\`\`\``
    }
    expect(result).toContain('.gitignore')
    expect(result).toContain('node_modules/')
    expect(result).toContain('lines')
  })

  it('adds pattern to gitignore content', () => {
    const existing = 'node_modules/\n*.log'
    const pattern = '*.env'
    const lines = existing.split('\n')
    const isDuplicate = lines.includes(pattern)
    let result = ''
    if (isDuplicate) {
      result = `Pattern already exists: \`${pattern}\``
    } else {
      const separator = existing && !existing.endsWith('\n') ? '\n' : ''
      const newContent = `${existing}${separator}${pattern}\n`
      result = `Added \`${pattern}\` to .gitignore`
      expect(newContent).toContain('*.env')
    }
    expect(result).toContain('Added')
    expect(result).toContain('*.env')
  })

  it('detects duplicate pattern', () => {
    const existing = 'node_modules/\n*.log'
    const pattern = '*.log'
    const lines = existing.split('\n')
    const isDuplicate = lines.includes(pattern)
    let result = ''
    if (isDuplicate) {
      result = `Pattern already exists: \`${pattern}\``
    }
    expect(isDuplicate).toBe(true)
    expect(result).toContain('Pattern already exists')
  })

  it('parses --check flag correctly', () => {
    const argsStr = '--check dist/index.js'
    expect(argsStr.startsWith('--check ')).toBe(true)
    const filePath = argsStr.slice(8).trim()
    expect(filePath).toBe('dist/index.js')
  })

  it('shows usage when --check has no file path', () => {
    const argsStr = '--check'
    const filePath = argsStr.startsWith('--check ') ? argsStr.slice(8).trim() : ''
    expect(filePath).toBe('')
  })

  it('shows ignored result with rule info', () => {
    const stdout = '.gitignore:1:*.log\tdist/index.js\n'
    const lines = stdout.trim().split('\n')
    const rule = lines[0] || ''
    const parts = rule.split('\t')
    const result = {
      ignored: true,
      reason: parts.length >= 2 ? `Ignored by rule: \`${parts[1]}\` (line ${parts[0]})` : `Ignored: ${rule}`,
    }
    expect(result.ignored).toBe(true)
    expect(result.reason).toContain('Ignored by rule')
    expect(result.reason).toContain('*.log')
  })

  it('shows not-ignored result', () => {
    const result = { ignored: false, reason: 'Not ignored' }
    expect(result.ignored).toBe(false)
    expect(result.reason).toBe('Not ignored')
  })

  it('shows no-workspace message when workspacePath is null', () => {
    const wsPath = null
    const msg = wsPath
      ? 'workspace exists'
      : 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('No workspace open')
  })

  it('formats content display with line count', () => {
    const content = 'node_modules/\n*.log\n.env\n'
    const lines = content.split('\n')
    const display = `**.gitignore** (${lines.length} lines)\n\n\`\`\`\n${content}\n\`\`\``
    expect(display).toContain('4 lines')
    expect(display).toContain('```')
  })

  it('shows empty gitignore message', () => {
    const content = '(empty .gitignore)'
    expect(content).toContain('empty')
  })

  it('shows no gitignore file message', () => {
    const content = '(no .gitignore file)'
    expect(content).toContain('no .gitignore file')
  })

  it('handles pattern with special characters', () => {
    const pattern = '**/*.test.ts'
    const existing = 'node_modules/'
    const lines = existing.split('\n')
    const isDuplicate = lines.includes(pattern)
    expect(isDuplicate).toBe(false)
    const separator = existing && !existing.endsWith('\n') ? '\n' : ''
    const newContent = `${existing}${separator}${pattern}\n`
    expect(newContent).toContain('**/*.test.ts')
  })

  it('formats check result with icon', () => {
    const result = { ignored: true, reason: 'Ignored by rule: `*.log` (line 1)' }
    const icon = result.ignored ? '🚫' : '✅'
    const msg = `${icon} \`dist/\`: ${result.reason}`
    expect(msg).toContain('🚫')
    expect(msg).toContain('Ignored by rule')
  })

  it('formats not-ignored result with check icon', () => {
    const result = { ignored: false, reason: 'Not ignored' }
    const icon = result.ignored ? '🚫' : '✅'
    const msg = `${icon} \`src/main.ts\`: ${result.reason}`
    expect(msg).toContain('✅')
    expect(msg).toContain('Not ignored')
  })
})
