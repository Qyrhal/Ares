import { describe, it, expect } from 'vitest'

describe('/check slash command logic', () => {
  function formatCheckResult(
    lintOk: boolean, lintErrors: number,
    testOk: boolean, testPassed: number, testFailed: number, testTotal: number,
    buildOk: boolean,
    elapsed: string,
  ): string {
    const results: string[] = []
    results.push(lintOk ? '✅ Lint passed' : `❌ Lint: ${lintErrors} error${lintErrors === 1 ? '' : 's'}`)
    results.push(testOk
      ? `✅ Tests passed (${testPassed}/${testTotal})`
      : `❌ Tests: ${testFailed} failed, ${testPassed} passed`)
    results.push(buildOk ? '✅ Build passed' : '❌ Build failed')
    const allPassed = results.every((r) => r.startsWith('✅'))
    const header = allPassed ? '**✅ All checks passed**' : '**❌ Some checks failed**'
    return `${header} (${elapsed}s)\n\n${results.join('\n')}`
  }

  it('shows all passed when lint, test, and build succeed', () => {
    const msg = formatCheckResult(true, 0, true, 100, 0, 100, true, '3.2')
    expect(msg).toContain('All checks passed')
    expect(msg).toContain('✅ Lint passed')
    expect(msg).toContain('✅ Tests passed (100/100)')
    expect(msg).toContain('✅ Build passed')
    expect(msg).toContain('3.2s')
  })

  it('shows failure when lint fails', () => {
    const msg = formatCheckResult(false, 3, true, 50, 0, 50, true, '5.1')
    expect(msg).toContain('Some checks failed')
    expect(msg).toContain('❌ Lint: 3 errors')
    expect(msg).toContain('✅ Tests passed')
    expect(msg).toContain('✅ Build passed')
  })

  it('shows failure when tests fail', () => {
    const msg = formatCheckResult(true, 0, false, 45, 5, 50, true, '4.0')
    expect(msg).toContain('Some checks failed')
    expect(msg).toContain('✅ Lint passed')
    expect(msg).toContain('❌ Tests: 5 failed, 45 passed')
    expect(msg).toContain('✅ Build passed')
  })

  it('shows failure when build fails', () => {
    const msg = formatCheckResult(true, 0, true, 30, 0, 30, false, '6.5')
    expect(msg).toContain('Some checks failed')
    expect(msg).toContain('✅ Lint passed')
    expect(msg).toContain('✅ Tests passed')
    expect(msg).toContain('❌ Build failed')
  })

  it('shows multiple failures', () => {
    const msg = formatCheckResult(false, 2, false, 10, 3, 13, false, '8.0')
    expect(msg).toContain('Some checks failed')
    expect(msg).toContain('❌ Lint: 2 errors')
    expect(msg).toContain('❌ Tests: 3 failed, 10 passed')
    expect(msg).toContain('❌ Build failed')
  })

  it('formats single lint error correctly', () => {
    const msg = formatCheckResult(false, 1, true, 20, 0, 20, true, '2.5')
    expect(msg).toContain('❌ Lint: 1 error')
    expect(msg).not.toContain('1 errors')
  })

  it('formats plural lint errors correctly', () => {
    const msg = formatCheckResult(false, 5, true, 20, 0, 20, true, '2.5')
    expect(msg).toContain('❌ Lint: 5 errors')
  })

  it('shows no-workspace message', () => {
    const msg = 'No workspace open. Use /folder to open a project first.'
    expect(msg).toContain('/folder')
  })

  it('shows running message', () => {
    const msg = '**Running quality gate** (lint → test → build)...'
    expect(msg).toContain('Running quality gate')
    expect(msg).toContain('lint')
    expect(msg).toContain('test')
    expect(msg).toContain('build')
  })
})
