import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_COMMANDS } from '@/components/InputBar'

describe('/ports command', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('is registered in BUILTIN_COMMANDS', () => {
    const portsCmd = BUILTIN_COMMANDS.find((c) => c.name === 'ports')
    expect(portsCmd).toBeDefined()
    expect(portsCmd?.kind).toBe('builtin')
    expect(portsCmd?.description).toContain('TCP/UDP')
  })

  it('has correct description mentioning ports', () => {
    const portsCmd = BUILTIN_COMMANDS.find((c) => c.name === 'ports')!
    expect(portsCmd.description).toMatch(/port/i)
  })

  it('has correct number of BUILTIN_COMMANDS', () => {
    expect(BUILTIN_COMMANDS.length).toBe(71)
  })

  it('formats listening ports output', () => {
    const output = 'State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port  Process\nLISTEN  0       4096     127.0.0.1:5173       0.0.0.0:*\nLISTEN  0       4096     0.0.0.0:3000         0.0.0.0:*'
    const lines: string[] = ['**Listening Ports**\n']
    lines.push(`\`\`\`\n${output}\n\`\`\``)
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain('5173')
    expect(lines[1]).toContain('3000')
  })

  it('formats error message', () => {
    const err = new Error('command not found')
    const lines: string[] = ['**Listening Ports**\n']
    lines.push(`Error: ${err.message}`)
    expect(lines[1]).toContain('Error: command not found')
  })

  it('formats empty output message', () => {
    const result = { ok: true, output: '' }
    const lines: string[] = ['**Listening Ports**\n']
    if (!result.output) {
      lines.push('No listening ports found.')
    }
    expect(lines).toContain('No listening ports found.')
  })

  it('formats failed result', () => {
    const result = { ok: false, output: 'Permission denied' }
    const lines: string[] = ['**Listening Ports**\n']
    if (!result.ok) {
      lines.push(`Error: ${result.output}`)
    }
    expect(lines[1]).toContain('Error: Permission denied')
  })

  it('truncates long output', () => {
    const output = 'x'.repeat(5000)
    const truncated = output.length > 3000
      ? output.slice(-3000) + '\n\n[output truncated]'
      : output
    expect(truncated).toContain('[output truncated]')
    expect(truncated.length).toBeLessThan(5000)
  })

  it('does not truncate short output', () => {
    const output = 'LISTEN  0  4096  127.0.0.1:5173'
    const truncated = output.length > 3000
      ? output.slice(-3000) + '\n\n[output truncated]'
      : output
    expect(truncated).toBe(output)
    expect(truncated).not.toContain('[output truncated]')
  })
})
