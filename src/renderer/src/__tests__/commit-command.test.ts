import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── helpers used by the /commit command handler ─────────────────────────

/**
 * Simulates the /commit command dispatch logic from App.tsx.
 * We test it as an isolated pure function so we don't need to mount the
 * full React component.
 */
interface GitStatus {
  hasRepo: boolean
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: { path: string; status: string }[]
  unstaged: { path: string; status: string }[]
  untracked: { path: string }[]
}

async function handleCommit(
  workspacePath: string | null,
  args: string,
  gitStatus: () => Promise<GitStatus>,
  gitCommit: (message: string) => Promise<void>,
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (!workspacePath) {
    pushMsg('No workspace open. Use /folder to open a project first.')
    return results
  }

  if (!args) {
    pushMsg('Usage: /commit <message>')
    return results
  }

  try {
    const status = await gitStatus()
    if (!status.hasRepo) {
      pushMsg('Not a git repository.')
      return results
    }
    if (status.staged.length === 0) {
      pushMsg('No staged changes to commit. Use /stage to stage files first.')
      return results
    }
    const fileCount = status.staged.length
    await gitCommit(args)
    const branchName = status.branch || 'HEAD'
    pushMsg(`**Committed** ${fileCount} file${fileCount === 1 ? '' : 's'} on \`${branchName}\`: "${args}"`)
  } catch (err) {
    pushMsg(`**Commit failed:** ${(err as Error).message}`)
  }

  return results
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('/commit command — commit staged changes logic', () => {
  let gitStatusMock: ReturnType<typeof vi.fn>
  let gitCommitMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gitStatusMock = vi.fn()
    gitCommitMock = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows message when no workspace is open', async () => {
    const result = await handleCommit(null, 'my commit', gitStatusMock, gitCommitMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No workspace open. Use /folder to open a project first.')
    expect(gitStatusMock).not.toHaveBeenCalled()
    expect(gitCommitMock).not.toHaveBeenCalled()
  })

  it('shows usage hint when no message is provided', async () => {
    const result = await handleCommit('/home/user/project', '', gitStatusMock, gitCommitMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('Usage: /commit <message>')
    expect(gitStatusMock).not.toHaveBeenCalled()
    expect(gitCommitMock).not.toHaveBeenCalled()
  })

  it('shows error when not a git repository', async () => {
    gitStatusMock.mockResolvedValue({
      hasRepo: false,
      branch: '',
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
    })
    const result = await handleCommit('/home/user/project', 'my commit', gitStatusMock, gitCommitMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('Not a git repository.')
    expect(gitCommitMock).not.toHaveBeenCalled()
  })

  it('shows message when no staged files', async () => {
    gitStatusMock.mockResolvedValue({
      hasRepo: true,
      branch: 'main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [{ path: 'src/index.ts', status: 'modified' }],
      untracked: [],
    })
    const result = await handleCommit('/home/user/project', 'my commit', gitStatusMock, gitCommitMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('No staged changes to commit. Use /stage to stage files first.')
    expect(gitCommitMock).not.toHaveBeenCalled()
  })

  it('commits staged files and shows confirmation', async () => {
    gitStatusMock.mockResolvedValue({
      hasRepo: true,
      branch: 'main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
      staged: [{ path: 'src/index.ts', status: 'modified' }, { path: 'src/utils.ts', status: 'added' }],
      unstaged: [],
      untracked: [],
    })
    gitCommitMock.mockResolvedValue(undefined)
    const result = await handleCommit('/home/user/project', 'fix: update utils', gitStatusMock, gitCommitMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('**Committed**')
    expect(result[0].content).toContain('2 files')
    expect(result[0].content).toContain('`main`')
    expect(result[0].content).toContain('"fix: update utils"')
    expect(gitCommitMock).toHaveBeenCalledWith('fix: update utils')
  })

  it('uses singular "file" for single staged file', async () => {
    gitStatusMock.mockResolvedValue({
      hasRepo: true,
      branch: 'develop',
      upstream: 'origin/develop',
      ahead: 2,
      behind: 0,
      staged: [{ path: 'README.md', status: 'modified' }],
      unstaged: [],
      untracked: [],
    })
    gitCommitMock.mockResolvedValue(undefined)
    const result = await handleCommit('/home/user/project', 'docs: update readme', gitStatusMock, gitCommitMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('1 file')
    expect(result[0].content).not.toContain('1 files')
    expect(result[0].content).toContain('`develop`')
  })

  it('handles commit errors gracefully', async () => {
    gitStatusMock.mockResolvedValue({
      hasRepo: true,
      branch: 'main',
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: [{ path: 'src/app.ts', status: 'modified' }],
      unstaged: [],
      untracked: [],
    })
    gitCommitMock.mockRejectedValue(new Error('nothing to commit'))
    const result = await handleCommit('/home/user/project', 'my commit', gitStatusMock, gitCommitMock)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('**Commit failed:** nothing to commit')
  })

  it('returns a message for every branch (no silent failures)', async () => {
    // No workspace
    const r1 = await handleCommit(null, 'msg', gitStatusMock, gitCommitMock)
    expect(r1.length).toBeGreaterThanOrEqual(1)

    // No args
    const r2 = await handleCommit('/home/user/project', '', gitStatusMock, gitCommitMock)
    expect(r2.length).toBeGreaterThanOrEqual(1)

    // Not a repo
    gitStatusMock.mockResolvedValue({
      hasRepo: false, branch: '', upstream: null, ahead: 0, behind: 0,
      staged: [], unstaged: [], untracked: [],
    })
    const r3 = await handleCommit('/home/user/project', 'msg', gitStatusMock, gitCommitMock)
    expect(r3.length).toBeGreaterThanOrEqual(1)

    // No staged files
    gitStatusMock.mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: null, ahead: 0, behind: 0,
      staged: [], unstaged: [], untracked: [],
    })
    const r4 = await handleCommit('/home/user/project', 'msg', gitStatusMock, gitCommitMock)
    expect(r4.length).toBeGreaterThanOrEqual(1)

    // Error
    gitStatusMock.mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: null, ahead: 0, behind: 0,
      staged: [{ path: 'f.ts', status: 'modified' }], unstaged: [], untracked: [],
    })
    gitCommitMock.mockRejectedValue(new Error('conflict'))
    const r5 = await handleCommit('/home/user/project', 'msg', gitStatusMock, gitCommitMock)
    expect(r5.length).toBeGreaterThanOrEqual(1)

    // Success
    gitCommitMock.mockResolvedValue(undefined)
    const r6 = await handleCommit('/home/user/project', 'msg', gitStatusMock, gitCommitMock)
    expect(r6.length).toBeGreaterThanOrEqual(1)
  })
})
