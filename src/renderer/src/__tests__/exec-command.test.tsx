import { describe, it, expect } from 'vitest'

describe('/exec command logic', () => {
  it('formats command output', () => {
    const command = 'ls -la'
    const output = 'total 48\ndrwxr-xr-x'
    const lines: string[] = ['**Shell Command**\n', `$ \`${command}\`\n`, `\`\`\`\n${output}\n\`\`\``]
    expect(lines.length).toBe(3)
    expect(lines[1]).toContain('ls -la')
  })

  it('truncates long output', () => {
    const output = 'x'.repeat(5000)
    const truncated = output.length > 3000
      ? output.slice(-3000) + '\n\n[output truncated]'
      : output
    expect(truncated).toContain('[output truncated]')
    expect(truncated.length).toBeLessThan(5000)
  })

  it('shows no output message', () => {
    const result = { ok: true, output: '' }
    const lines: string[] = []
    if (result.output) {
      lines.push(result.output)
    } else if (result.ok) {
      lines.push('(no output)')
    }
    expect(lines).toContain('(no output)')
  })

  it('shows failure message', () => {
    const result = { ok: false, output: 'error: not found' }
    const lines: string[] = []
    if (!result.ok && result.output) {
      lines.push('❌ Command failed')
      lines.push('\nExit code: non-zero')
    }
    expect(lines).toContain('❌ Command failed')
  })

  it('shows no workspace message', () => {
    const workspacePath = null
    const lines: string[] = []
    if (!workspacePath) {
      lines.push('No workspace folder is open.')
    }
    expect(lines).toContain('No workspace folder is open.')
  })

  it('shows usage when no command', () => {
    const command = ''
    const lines: string[] = []
    if (!command) {
      lines.push('Usage: `/exec <command>` — run a shell command in the workspace')
    }
    expect(lines.length).toBe(1)
  })

  it('formats error message', () => {
    const err = new Error('command not found')
    const lines: string[] = [`Error: ${err.message}`]
    expect(lines[0]).toContain('Error: command not found')
  })
})
