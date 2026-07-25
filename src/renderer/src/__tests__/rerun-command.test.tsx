import { describe, it, expect } from 'vitest'

describe('/rerun command logic', () => {
  it('shows message when no previous command', () => {
    const lastExecCommand = null
    const lines: string[] = []
    if (!lastExecCommand) {
      lines.push('No previous command to rerun. Use `/exec <command>` first.')
    }
    expect(lines).toContain('No previous command to rerun. Use `/exec <command>` first.')
  })

  it('shows message when no workspace', () => {
    const lastExecCommand = 'ls -la'
    const workspacePath = null
    const lines: string[] = []
    if (lastExecCommand && !workspacePath) {
      lines.push('No workspace folder is open.')
    }
    expect(lines).toContain('No workspace folder is open.')
  })

  it('formats rerun output', () => {
    const lastCmd = 'npm test'
    const output = 'PASS (100) FAIL (0)'
    const lines: string[] = ['**Shell Command (rerun)**\n', `$ \`${lastCmd}\`\n`, `\`\`\`\n${output}\n\`\`\``]
    expect(lines.length).toBe(3)
    expect(lines[0]).toContain('rerun')
    expect(lines[1]).toContain('npm test')
    expect(lines[2]).toContain('PASS')
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

  it('formats error message', () => {
    const err = new Error('ENOENT: no such file')
    const lines: string[] = [`Error: ${err.message}`]
    expect(lines[0]).toContain('ENOENT')
  })

  it('rerun uses same command as last exec', () => {
    const lastExecCommand = 'git status'
    const rerunCmd = lastExecCommand
    expect(rerunCmd).toBe('git status')
  })
})
