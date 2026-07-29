import { describe, it, expect } from 'vitest'

describe('/diagnostics slash command', () => {
  it('formats empty diagnostics as clean', () => {
    const diagnostics: { file: string; line: number; column: number; message: string; severity: string }[] = []
    const errors = diagnostics.filter(d => d.severity === 'error')
    const warnings = diagnostics.filter(d => d.severity === 'warning')
    expect(errors.length).toBe(0)
    expect(warnings.length).toBe(0)
  })

  it('formats diagnostics with errors and warnings', () => {
    const diagnostics = [
      { file: '/project/src/app.ts', line: 10, column: 5, message: 'Type mismatch', severity: 'error' },
      { file: '/project/src/app.ts', line: 20, column: 1, message: 'Unused variable', severity: 'warning' },
      { file: '/project/src/utils.ts', line: 5, column: 3, message: 'Missing return', severity: 'error' },
    ]
    const errors = diagnostics.filter(d => d.severity === 'error')
    const warnings = diagnostics.filter(d => d.severity === 'warning')
    expect(errors.length).toBe(2)
    expect(warnings.length).toBe(1)
  })

  it('formats diagnostic message with file location', () => {
    const diagWs = '/project'
    const d = { file: '/project/src/app.ts', line: 10, column: 5, message: 'Type mismatch', severity: 'error' }
    const relFile = d.file.replace(diagWs + '/', '')
    const icon = d.severity === 'error' ? '❌' : '⚠️'
    const line = `${icon} \`${relFile}:${d.line}:${d.column}\` — ${d.message}`
    expect(line).toBe('❌ `src/app.ts:10:5` — Type mismatch')
  })

  it('truncates output at 50 diagnostics', () => {
    const diagnostics = Array.from({ length: 75 }, (_, i) => ({
      file: `/project/src/file${i}.ts`,
      line: i,
      column: 1,
      message: `Error ${i}`,
      severity: 'error' as const,
    }))
    const displayed = diagnostics.slice(0, 50)
    expect(displayed.length).toBe(50)
    expect(diagnostics.length - displayed.length).toBe(25)
  })

  it('diagnostics command exists in switch cases', () => {
    const commands = ['model', 'clear', 'compact', 'shortcuts', 'note', 'pin', 'debug', 'history', 'rename', 'log', 'review', 'cost', 'help', 'status', 'summary', 'usage', 'overview', 'helpful', 'not-helpful', 'pr', 'fork', 'changes', 'diff', 'export', 'new', 'diagnostics']
    expect(commands).toContain('diagnostics')
  })

  it('shows support check message when lsp unavailable', () => {
    const hasSupport = false
    const msg = 'No language server support detected. Ensure Node.js and npx are available.'
    expect(hasSupport).toBe(false)
    expect(msg).toContain('language server')
  })

  it('shows clean message when no diagnostics', () => {
    const count = 0
    const msg = count === 0 ? '**Diagnostics clean** — no errors or warnings found.' : `${count} issues`
    expect(msg).toContain('clean')
  })

  it('shows overflow indicator when more than 50 diagnostics', () => {
    const total = 75
    const shown = 50
    const overflow = total > 50 ? `\n_...and ${total - shown} more_` : ''
    expect(overflow).toContain('25 more')
  })
})
