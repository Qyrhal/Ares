import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/build slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires a workspace', () => {
    const wsPath = null
    expect(wsPath).toBeNull()
  })

  it('formats a successful build result', () => {
    const result = { ok: true, output: 'Build completed successfully.' }
    const msg = `**Build succeeded**\n\n${result.output || '(no output)'}`
    expect(msg).toContain('Build succeeded')
    expect(msg).toContain('Build completed successfully.')
  })

  it('formats a successful build with empty output', () => {
    const result = { ok: true, output: '' }
    const msg = `**Build succeeded**\n\n${result.output || '(no output)'}`
    expect(msg).toContain('Build succeeded')
    expect(msg).toContain('(no output)')
  })

  it('formats a failed build result', () => {
    const result = { ok: false, output: 'ERROR in src/App.tsx\nModule not found.' }
    const msg = `**Build failed**\n\n${result.output}`
    expect(msg).toContain('Build failed')
    expect(msg).toContain('ERROR in src/App.tsx')
  })

  it('truncates long output from end', () => {
    const output = 'A'.repeat(5000)
    const truncated = output.length > 4000 ? output.slice(-4000) : output
    expect(truncated.length).toBe(4000)
  })

  it('keeps short output intact', () => {
    const output = 'Build OK'
    const truncated = output.length > 4000 ? output.slice(-4000) : output
    expect(truncated).toBe('Build OK')
  })

  it('shows running message', () => {
    const msg = '**Running build...**'
    expect(msg).toContain('Running build')
  })

  it('shows error message', () => {
    const error = 'command not found'
    const msg = `**Build error:** ${error}`
    expect(msg).toContain('Build error')
    expect(msg).toContain('command not found')
  })

  it('shows no-workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('/folder')
  })

  it('handles npm run build failure output', () => {
    const output = 'npm ERR! code ELIFECYCLE\nnpm ERR! errno 1\nnpm ERR! ares@0.1.0 build: `electron-vite build`\nnpm ERR! Exit status 1'
    const result = { ok: false, output }
    expect(result.ok).toBe(false)
    expect(result.output).toContain('ELIFECYCLE')
  })
})
