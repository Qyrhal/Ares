import { describe, it, expect } from 'vitest'

// ── helpers extracted from App.tsx /ci command handler logic ─────────

interface GitStatus {
  hasRepo: boolean
  branch: string
}

interface ExecResult {
  ok: boolean
  output: string
}

/**
 * Simulates the /ci command dispatch logic from App.tsx.
 * Pure function — no React, no DOM.
 */
async function handleCi(
  workspacePath: string | null,
  gitStatusFn: (cwd: string) => Promise<GitStatus>,
  execFn: (cwd: string, cmd: string) => Promise<ExecResult>,
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (!workspacePath) {
    pushMsg('No workspace open. Use /folder to open a project first.')
    return results
  }
  pushMsg('**Checking CI status...**')
  try {
    const status = await gitStatusFn(workspacePath)
    if (!status.hasRepo) {
      pushMsg('Not a git repository.')
      return results
    }
    const prResult = await execFn(workspacePath, 'gh pr view --json number,title,state,statusCheckRollup,url 2>/dev/null')
    if (!prResult.ok) {
      const authCheck = await execFn(workspacePath, 'gh auth status 2>&1')
      if (!authCheck.ok && authCheck.output.includes('not logged in')) {
        pushMsg('**CI Status**\n\nNot authenticated with GitHub CLI. Run `gh auth login` to set up.')
      } else {
        pushMsg('**CI Status**\n\nNo pull request found for the current branch (`' + (status.branch || 'detached') + '`). Push the branch and open a PR to see CI checks.')
      }
      return results
    }
    try {
      const pr = JSON.parse(prResult.output)
      const lines: string[] = ['**CI Status**\n']
      lines.push(`**PR:** #${pr.number} — ${pr.title}`)
      lines.push(`**State:** ${pr.state}`)
      lines.push(`**URL:** ${pr.url}`)
      lines.push('')
      if (pr.statusCheckRollup && pr.statusCheckRollup.length > 0) {
        lines.push('**Checks:**')
        for (const check of pr.statusCheckRollup) {
          const icon = check.conclusion === 'SUCCESS' ? '✅'
            : check.conclusion === 'FAILURE' ? '❌'
            : check.conclusion === 'PENDING' || check.status === 'IN_PROGRESS' ? '⏳'
            : check.conclusion === 'CANCELLED' ? '⚪'
            : '❓'
          const name = check.name || check.workflowName || 'unknown'
          const duration = check.completedAt && check.startedAt
            ? ` (${Math.round((new Date(check.completedAt).getTime() - new Date(check.startedAt).getTime()) / 1000)}s)`
            : ''
          lines.push(`  ${icon} ${name}${duration}`)
        }
      } else {
        lines.push('No checks found.')
      }
      pushMsg(lines.join('\n'))
    } catch {
      const output = prResult.output.length > 3000 ? prResult.output.slice(0, 3000) + '\n\n[truncated]' : prResult.output
      pushMsg(`**CI Status**\n\n${output}`)
    }
  } catch (err) {
    pushMsg(`**CI error:** ${(err as Error).message}`)
  }
  return results
}

// ── tests ───────────────────────────────────────────────────────────

describe('/ci command logic', () => {
  it('shows no workspace message when workspace is null', async () => {
    const results = await handleCi(
      null,
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: '' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('No workspace open')
  })

  it('shows not a git repo message', async () => {
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: false, branch: '' }),
      async () => ({ ok: true, output: '' }),
    )
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some(r => r.content.includes('Not a git repository'))).toBe(true)
  })

  it('shows no PR found message when gh pr view fails', async () => {
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'feat/test' }),
      async () => ({ ok: false, output: 'no pull requests found for current branch' }),
    )
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some(r => r.content.includes('No pull request found'))).toBe(true)
    expect(results.some(r => r.content.includes('feat/test'))).toBe(true)
  })

  it('shows auth required message when gh is not authenticated', async () => {
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async (_cwd, cmd) => {
        if (cmd.includes('gh pr view')) return { ok: false, output: 'not logged in' }
        if (cmd.includes('gh auth status')) return { ok: false, output: 'not logged in to any hosts' }
        return { ok: true, output: '' }
      },
    )
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some(r => r.content.includes('Not authenticated'))).toBe(true)
  })

  it('displays PR info with passing checks', async () => {
    const prJson = JSON.stringify({
      number: 42,
      title: 'Add feature X',
      state: 'OPEN',
      url: 'https://github.com/org/repo/pull/42',
      statusCheckRollup: [
        { name: 'CI / build', conclusion: 'SUCCESS', status: 'COMPLETED', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:02:00Z' },
        { name: 'CI / test', conclusion: 'SUCCESS', status: 'COMPLETED', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:03:00Z' },
      ],
    })
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: prJson }),
    )
    expect(results.length).toBeGreaterThanOrEqual(1)
    const ciMsg = results.find(r => r.content.includes('**CI Status**'))
    expect(ciMsg).toBeDefined()
    expect(ciMsg!.content).toContain('#42')
    expect(ciMsg!.content).toContain('Add feature X')
    expect(ciMsg!.content).toContain('OPEN')
    expect(ciMsg!.content).toContain('CI / build')
    expect(ciMsg!.content).toContain('CI / test')
    expect(ciMsg!.content).toContain('✅')
  })

  it('displays failing checks with ❌ icon', async () => {
    const prJson = JSON.stringify({
      number: 99,
      title: 'Bug fix',
      state: 'OPEN',
      url: 'https://github.com/org/repo/pull/99',
      statusCheckRollup: [
        { name: 'Lint', conclusion: 'FAILURE', status: 'COMPLETED', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:01:00Z' },
      ],
    })
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'fix/bug' }),
      async () => ({ ok: true, output: prJson }),
    )
    const ciMsg = results.find(r => r.content.includes('**CI Status**'))
    expect(ciMsg).toBeDefined()
    expect(ciMsg!.content).toContain('❌')
    expect(ciMsg!.content).toContain('Lint')
  })

  it('displays pending checks with ⏳ icon', async () => {
    const prJson = JSON.stringify({
      number: 10,
      title: 'WIP',
      state: 'OPEN',
      url: 'https://github.com/org/repo/pull/10',
      statusCheckRollup: [
        { name: 'Deploy', status: 'IN_PROGRESS', startedAt: '2026-07-28T10:00:00Z' },
      ],
    })
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: prJson }),
    )
    const ciMsg = results.find(r => r.content.includes('**CI Status**'))
    expect(ciMsg).toBeDefined()
    expect(ciMsg!.content).toContain('⏳')
    expect(ciMsg!.content).toContain('Deploy')
  })

  it('shows no checks found when statusCheckRollup is empty', async () => {
    const prJson = JSON.stringify({
      number: 5,
      title: 'Small fix',
      state: 'OPEN',
      url: 'https://github.com/org/repo/pull/5',
      statusCheckRollup: [],
    })
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: prJson }),
    )
    const ciMsg = results.find(r => r.content.includes('**CI Status**'))
    expect(ciMsg).toBeDefined()
    expect(ciMsg!.content).toContain('No checks found')
  })

  it('handles invalid JSON gracefully', async () => {
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: 'not valid json output' }),
    )
    const ciMsg = results.find(r => r.content.includes('**CI Status**'))
    expect(ciMsg).toBeDefined()
    expect(ciMsg!.content).toContain('not valid json output')
  })

  it('handles exec error gracefully', async () => {
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => { throw new Error('command failed') },
    )
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some(r => r.content.includes('CI error'))).toBe(true)
  })

  it('truncates long JSON output', async () => {
    const longOutput = 'x'.repeat(5000)
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: longOutput }),
    )
    const ciMsg = results.find(r => r.content.includes('**CI Status**'))
    expect(ciMsg).toBeDefined()
    expect(ciMsg!.content).toContain('[truncated]')
    expect(ciMsg!.content.length).toBeLessThan(5000)
  })

  it('includes checking status message as first result', async () => {
    const results = await handleCi(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: false, output: 'no PR' }),
    )
    expect(results[0].content).toContain('Checking CI status')
  })
})
