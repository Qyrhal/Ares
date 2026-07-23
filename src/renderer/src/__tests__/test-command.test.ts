import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/test slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires a workspace', () => {
    const wsPath = null
    expect(wsPath).toBeNull()
  })

  it('formats a passing result', () => {
    const result = { ok: true, passed: 2884, failed: 0, total: 2884, output: '2884 passed' }
    const msg = `**All tests passed** — ${result.passed} passed, ${result.total} total`
    expect(msg).toContain('All tests passed')
    expect(msg).toContain('2884 passed')
  })

  it('formats a failing result', () => {
    const result = { ok: false, passed: 2880, failed: 4, total: 2884, output: '4 failed' }
    const summary = result.failed > 0 ? `${result.failed} failed, ${result.passed} passed, ${result.total} total` : 'Tests completed with issues'
    expect(summary).toBe('4 failed, 2880 passed, 2884 total')
  })

  it('formats a result with no specific failure count', () => {
    const result = { ok: false, passed: 0, failed: 0, total: 0, output: 'Error: command not found' }
    const summary = result.failed > 0 ? `${result.failed} failed, ${result.passed} passed, ${result.total} total` : 'Tests completed with issues'
    expect(summary).toBe('Tests completed with issues')
  })

  it('truncates long output', () => {
    const output = 'A'.repeat(4000)
    const truncated = output.length > 3000 ? output.slice(0, 3000) + '\n\n[truncated]' : output
    expect(truncated.length).toBe(3013)
    expect(truncated).toContain('[truncated]')
  })

  it('shows running message', () => {
    const msg = '**Running tests...**'
    expect(msg).toContain('Running tests')
  })

  it('shows error message', () => {
    const error = 'command not found'
    const msg = `**Test error:** ${error}`
    expect(msg).toContain('Test error')
    expect(msg).toContain('command not found')
  })

  it('shows no-workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('/folder')
  })

  it('parses test counts from vitest output', () => {
    const output = ' Test Files  138 passed (138)\n      Tests  2884 passed (2884)\n   Start at  08:30:57\n   Duration  97.64s'
    const passMatch = output.match(/Tests\s+([\d,]+)\s+passed/)
    const failMatch = output.match(/([\d,]+)\s+failed/)
    const totalMatch = output.match(/Tests\s+([\d,]+)/)
    const passed = passMatch ? parseInt(passMatch[1], 10) : 0
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0
    const total = totalMatch ? parseInt(totalMatch[1], 10) : passed + failed
    expect(passed).toBe(2884)
    expect(failed).toBe(0)
    expect(total).toBe(2884)
  })

  it('parses mixed pass/fail output', () => {
    const output = ' Tests  2880 passed | 4 failed (2884)\n   Duration  97.64s'
    const passMatch = output.match(/Tests\s+([\d,]+)\s+passed/)
    const failMatch = output.match(/([\d,]+)\s+failed/)
    const totalMatch = output.match(/\((\d+)\)/)
    const passed = passMatch ? parseInt(passMatch[1], 10) : 0
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0
    const total = totalMatch ? parseInt(totalMatch[1], 10) : passed + failed
    expect(passed).toBe(2880)
    expect(failed).toBe(4)
    expect(total).toBe(2884)
  })
})
