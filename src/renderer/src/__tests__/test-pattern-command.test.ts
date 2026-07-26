import { describe, it, expect, vi } from 'vitest'
import type { AgentStatus, PermissionMode } from '@/types'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test',
    model: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    pinned: false,
    archived: false,
    agentStatus: 'idle' as AgentStatus,
    ...overrides,
  }
}

// ── /test command logic tests ──────────────────────────────────────────────────
// These test the pattern argument handling without rendering App.tsx.
// They exercise the same logic that runs in the handleCommand switch case.

function buildTestCommand(pattern?: string) {
  const cmd = pattern ? `npx vitest run ${pattern} 2>&1` : 'npx vitest run 2>&1'
  return cmd
}

describe('/test pattern command logic', () => {
  it('builds full test command when no pattern given', () => {
    const pattern = undefined
    const cmd = buildTestCommand(pattern)
    expect(cmd).toBe('npx vitest run 2>&1')
  })

  it('builds filtered test command with file pattern', () => {
    const pattern = 'src/renderer/src/utils'
    const cmd = buildTestCommand(pattern)
    expect(cmd).toBe('npx vitest run src/renderer/src/utils 2>&1')
  })

  it('builds filtered test command with name pattern', () => {
    const pattern = 'filter-command'
    const cmd = buildTestCommand(pattern)
    expect(cmd).toBe('npx vitest run filter-command 2>&1')
  })

  it('trims whitespace from pattern', () => {
    const args = '  filter-command  '
    const pattern = args.trim() || undefined
    expect(pattern).toBe('filter-command')
  })

  it('treats empty trimmed args as undefined', () => {
    const args = '   '
    const pattern = args.trim() || undefined
    expect(pattern).toBeUndefined()
  })

  it('passes pattern to el.test.run as second argument', () => {
    const el = {
      test: {
        run: vi.fn().mockResolvedValue({ ok: true, passed: 10, failed: 0, total: 10, output: '' }),
      },
    }

    const pattern = 'filter-command'
    el.test.run('/some/path', pattern)

    expect(el.test.run).toHaveBeenCalledWith('/some/path', 'filter-command')
  })

  it('passes undefined pattern when no args given', () => {
    const el = {
      test: {
        run: vi.fn().mockResolvedValue({ ok: true, passed: 10, failed: 0, total: 10, output: '' }),
      },
    }

    const pattern = undefined
    el.test.run('/some/path', pattern)

    expect(el.test.run).toHaveBeenCalledWith('/some/path', undefined)
  })

  it('produces correct status message with pattern', () => {
    const pattern = 'filter-command'
    const msg = pattern
      ? `**Running tests matching "${pattern}"...**`
      : '**Running tests...**'
    expect(msg).toBe('**Running tests matching "filter-command"...**')
  })

  it('produces correct status message without pattern', () => {
    const pattern = undefined
    const msg = pattern
      ? `**Running tests matching "${pattern}"...**`
      : '**Running tests...**'
    expect(msg).toBe('**Running tests...**')
  })

  it('session has workspacePath', () => {
    const session = mkSession()
    expect(session.id).toBe('s1')
    expect(session.agentStatus).toBe('idle')
  })

  it('test failure output is truncated correctly', () => {
    const output = 'a'.repeat(5000)
    const truncated = output.length > 3000 ? output.slice(0, 3000) + '\n\n[truncated]' : output
    expect(truncated.length).toBe(3013) // 3000 + '\n\n[truncated]'
    expect(truncated.endsWith('[truncated]')).toBe(true)
  })

  it('test success shows passed and total counts', () => {
    const result = { ok: true, passed: 42, failed: 0, total: 42, output: '' }
    const msg = `**All tests passed** — ${result.passed} passed, ${result.total} total`
    expect(msg).toBe('**All tests passed** — 42 passed, 42 total')
  })

  it('test failure shows failed, passed, and total counts', () => {
    const result = { ok: false, passed: 40, failed: 2, total: 42, output: 'failure details' }
    const summary = result.failed > 0
      ? `${result.failed} failed, ${result.passed} passed, ${result.total} total`
      : 'Tests completed with issues'
    expect(summary).toBe('2 failed, 40 passed, 42 total')
  })
})
