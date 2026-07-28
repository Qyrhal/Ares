import { describe, it, expect } from 'vitest'

// ── helpers extracted from App.tsx /open-pr command handler logic ────

interface GitStatus {
  hasRepo: boolean
  branch: string
}

interface ExecResult {
  ok: boolean
  output: string
}

/**
 * Simulates the /open-pr command dispatch logic from App.tsx.
 * Pure function — no React, no DOM.
 */
async function handleOpenPr(
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
  try {
    const status = await gitStatusFn(workspacePath)
    if (!status.hasRepo) {
      pushMsg('Not a git repository.')
      return results
    }
    const result = await execFn(workspacePath, 'gh pr view --web 2>&1')
    if (result.ok) {
      pushMsg('**Opened PR in browser.**')
    } else {
      if (result.output.includes('no pull requests')) {
        pushMsg(`**No PR found** for the current branch (\`${status.branch || 'detached'}\`). Push and create a PR first.`)
      } else if (result.output.includes('not logged in')) {
        pushMsg('Not authenticated with GitHub CLI. Run `gh auth login` to set up.')
      } else {
        const output = result.output.length > 2000 ? result.output.slice(0, 2000) + '\n\n[truncated]' : result.output
        pushMsg(`**Failed to open PR:**\n\n${output}`)
      }
    }
  } catch (err) {
    pushMsg(`**Error:** ${(err as Error).message}`)
  }
  return results
}

// ── tests ───────────────────────────────────────────────────────────

describe('/open-pr command logic', () => {
  it('shows no workspace message when workspace is null', async () => {
    const results = await handleOpenPr(
      null,
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: '' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('No workspace open')
  })

  it('shows not a git repo message', async () => {
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: false, branch: '' }),
      async () => ({ ok: true, output: '' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Not a git repository')
  })

  it('shows success message when PR opens in browser', async () => {
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: true, output: '' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Opened PR in browser')
  })

  it('shows no PR found message', async () => {
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'feat/new' }),
      async () => ({ ok: false, output: 'no pull requests found for current branch' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('No PR found')
    expect(results[0].content).toContain('feat/new')
  })

  it('shows auth required message', async () => {
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: false, output: 'not logged in to any hosts' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Not authenticated')
  })

  it('shows generic error for other failures', async () => {
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: false, output: 'some unexpected error' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Failed to open PR')
    expect(results[0].content).toContain('some unexpected error')
  })

  it('truncates long error output', async () => {
    const longOutput = 'x'.repeat(5000)
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => ({ ok: false, output: longOutput }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('[truncated]')
    expect(results[0].content.length).toBeLessThan(5000)
  })

  it('handles exec exception gracefully', async () => {
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: true, branch: 'main' }),
      async () => { throw new Error('process failed') },
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('Error')
    expect(results[0].content).toContain('process failed')
  })

  it('handles detached HEAD branch', async () => {
    const results = await handleOpenPr(
      '/workspace',
      async () => ({ hasRepo: true, branch: '' }),
      async () => ({ ok: false, output: 'no pull requests found' }),
    )
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('detached')
  })
})
