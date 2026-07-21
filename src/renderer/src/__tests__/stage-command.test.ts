import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers extracted from App.tsx command handler logic ─────────────────

interface GitFile {
  path: string
  status: string
}

interface GitStatus {
  hasRepo: boolean
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: GitFile[]
  unstaged: GitFile[]
  untracked: GitFile[]
}

/**
 * Parses /stage command arguments.
 * Returns the parsed action with file path when applicable.
 */
function parseStageArgs(args: string):
  | { action: 'status' }
  | { action: 'stageAll' }
  | { action: 'unstageAll' }
  | { action: 'unstageFile'; file: string }
  | { action: 'stageFile'; file: string } {
  const trimmed = args.trim()
  if (!trimmed) return { action: 'status' }
  if (trimmed === '--all') return { action: 'stageAll' }
  if (trimmed.startsWith('--unstage')) {
    const rest = trimmed.slice(9).trim()
    if (!rest) return { action: 'status' }
    if (rest === '--all') return { action: 'unstageAll' }
    return { action: 'unstageFile', file: rest }
  }
  return { action: 'stageFile', file: trimmed }
}

/**
 * Formats a staging status object into a markdown message.
 * Pure function — no React, no DOM.
 */
function formatStagingStatus(status: GitStatus): string {
  const lines: string[] = ['**Staging Status**\n']
  if (status.staged.length > 0) {
    lines.push(`**Staged** (${status.staged.length} files)`)
    for (const f of status.staged) {
      lines.push(`  \`${f.path}\` — ${f.status}`)
    }
    lines.push('')
  }
  if (status.unstaged.length > 0) {
    lines.push(`**Unstaged changes** (${status.unstaged.length} files)`)
    for (const f of status.unstaged) {
      lines.push(`  \`${f.path}\` — ${f.status}`)
    }
    lines.push('')
  }
  if (status.untracked.length > 0) {
    lines.push(`**Untracked** (${status.untracked.length} files)`)
    for (const f of status.untracked) {
      lines.push(`  \`${f.path}\``)
    }
    lines.push('')
  }
  if (status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0) {
    lines.push('Working tree clean — nothing to stage.')
  }
  return lines.join('\n')
}

/**
 * Simulates the /stage command dispatch logic from App.tsx.
 * Pure function — no React, no DOM.
 */
async function handleStage(
  workspacePath: string | null,
  args: string,
  gitFns: {
    status: (cwd: string) => Promise<GitStatus>
    stageFile: (cwd: string, path: string) => Promise<void>
    stageAll: (cwd: string) => Promise<void>
    unstageFile: (cwd: string, path: string) => Promise<void>
    unstageAll: (cwd: string) => Promise<void>
  },
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (!workspacePath) {
    pushMsg('No workspace open. Use /folder to open a project first.')
    return results
  }

  try {
    const status = await gitFns.status(workspacePath)
    if (!status.hasRepo) {
      pushMsg('Not a git repository.')
      return results
    }

    const parsed = parseStageArgs(args)

    switch (parsed.action) {
      case 'status':
        pushMsg(formatStagingStatus(status))
        break
      case 'stageAll':
        await gitFns.stageAll(workspacePath)
        pushMsg('Staged all files.')
        break
      case 'unstageAll':
        await gitFns.unstageAll(workspacePath)
        pushMsg('Unstaged all files.')
        break
      case 'unstageFile':
        await gitFns.unstageFile(workspacePath, parsed.file)
        pushMsg(`Unstaged \`${parsed.file}\``)
        break
      case 'stageFile':
        await gitFns.stageFile(workspacePath, parsed.file)
        pushMsg(`Staged \`${parsed.file}\``)
        break
    }
  } catch (err) {
    pushMsg(`**Error:** ${(err as Error).message}`)
  }

  return results
}

// ── tests ──────────────────────────────────────────────────────────────

describe('/stage slash command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseStageArgs', () => {
    it('returns status action with no args', () => {
      expect(parseStageArgs('')).toEqual({ action: 'status' })
    })

    it('returns stageAll for --all flag', () => {
      expect(parseStageArgs('--all')).toEqual({ action: 'stageAll' })
    })

    it('returns unstageAll for --unstage --all', () => {
      expect(parseStageArgs('--unstage --all')).toEqual({ action: 'unstageAll' })
    })

    it('returns unstageFile for --unstage <file>', () => {
      expect(parseStageArgs('--unstage src/app.ts')).toEqual({ action: 'unstageFile', file: 'src/app.ts' })
    })

    it('returns status when --unstage has no file', () => {
      expect(parseStageArgs('--unstage ')).toEqual({ action: 'status' })
    })

    it('trims whitespace from unstage file', () => {
      expect(parseStageArgs('--unstage   src/app.ts  ')).toEqual({ action: 'unstageFile', file: 'src/app.ts' })
    })

    it('returns stageFile for a file path', () => {
      expect(parseStageArgs('src/index.ts')).toEqual({ action: 'stageFile', file: 'src/index.ts' })
    })

    it('trims whitespace from stage file', () => {
      expect(parseStageArgs('  src/index.ts  ')).toEqual({ action: 'stageFile', file: 'src/index.ts' })
    })

    it('handles --all with whitespace', () => {
      expect(parseStageArgs('  --all  ')).toEqual({ action: 'stageAll' })
    })
  })

  describe('formatStagingStatus', () => {
    const cleanStatus: GitStatus = {
      hasRepo: true, branch: 'main', upstream: 'origin/main',
      ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [],
    }

    it('shows clean tree message when no changes', () => {
      const result = formatStagingStatus(cleanStatus)
      expect(result).toContain('Working tree clean')
    })

    it('includes header text', () => {
      const result = formatStagingStatus(cleanStatus)
      expect(result).toContain('**Staging Status**')
    })

    it('shows staged files with status', () => {
      const status: GitStatus = {
        ...cleanStatus,
        staged: [{ path: 'src/app.ts', status: 'modified' }],
      }
      const result = formatStagingStatus(status)
      expect(result).toContain('**Staged** (1 files)')
      expect(result).toContain('`src/app.ts` — modified')
    })

    it('shows unstaged files with status', () => {
      const status: GitStatus = {
        ...cleanStatus,
        unstaged: [{ path: 'src/util.ts', status: 'modified' }],
      }
      const result = formatStagingStatus(status)
      expect(result).toContain('**Unstaged changes** (1 files)')
      expect(result).toContain('`src/util.ts` — modified')
    })

    it('shows untracked files', () => {
      const status: GitStatus = {
        ...cleanStatus,
        untracked: [{ path: 'new-file.ts', status: 'untracked' }],
      }
      const result = formatStagingStatus(status)
      expect(result).toContain('**Untracked** (1 files)')
      expect(result).toContain('`new-file.ts`')
    })

    it('shows all categories when all are present', () => {
      const status: GitStatus = {
        ...cleanStatus,
        staged: [{ path: 'a.ts', status: 'added' }],
        unstaged: [{ path: 'b.ts', status: 'modified' }],
        untracked: [{ path: 'c.ts', status: 'untracked' }],
      }
      const result = formatStagingStatus(status)
      expect(result).toContain('**Staged**')
      expect(result).toContain('**Unstaged changes**')
      expect(result).toContain('**Untracked**')
    })

    it('handles multiple files in same category', () => {
      const status: GitStatus = {
        ...cleanStatus,
        staged: [
          { path: 'a.ts', status: 'added' },
          { path: 'b.ts', status: 'modified' },
        ],
      }
      const result = formatStagingStatus(status)
      expect(result).toContain('**Staged** (2 files)')
      expect(result).toContain('`a.ts` — added')
      expect(result).toContain('`b.ts` — modified')
    })

    it('does not show clean message when files exist', () => {
      const status: GitStatus = {
        ...cleanStatus,
        unstaged: [{ path: 'x.ts', status: 'modified' }],
      }
      const result = formatStagingStatus(status)
      expect(result).not.toContain('Working tree clean')
    })
  })

  describe('handleStage', () => {
    const mockGitFns = () => ({
      status: vi.fn().mockResolvedValue({
        hasRepo: true, branch: 'main', upstream: 'origin/main',
        ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [],
      }),
      stageFile: vi.fn().mockResolvedValue(undefined),
      stageAll: vi.fn().mockResolvedValue(undefined),
      unstageFile: vi.fn().mockResolvedValue(undefined),
      unstageAll: vi.fn().mockResolvedValue(undefined),
    })

    it('returns error when no workspace is open', async () => {
      const fns = mockGitFns()
      const results = await handleStage(null, '', fns)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('No workspace open')
    })

    it('returns error when not a git repo', async () => {
      const fns = mockGitFns()
      fns.status.mockResolvedValue({
        hasRepo: false, branch: '', upstream: null,
        ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [],
      })
      const results = await handleStage('/home/user/project', '', fns)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Not a git repository')
    })

    it('shows staging status with no args', async () => {
      const fns = mockGitFns()
      fns.status.mockResolvedValue({
        hasRepo: true, branch: 'main', upstream: 'origin/main',
        ahead: 0, behind: 0,
        staged: [{ path: 'a.ts', status: 'modified' }],
        unstaged: [], untracked: [],
      })
      const results = await handleStage('/home/user/project', '', fns)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('**Staging Status**')
      expect(results[0].content).toContain('`a.ts` — modified')
    })

    it('shows clean tree when no changes', async () => {
      const fns = mockGitFns()
      const results = await handleStage('/home/user/project', '', fns)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Working tree clean')
    })

    it('stages a specific file', async () => {
      const fns = mockGitFns()
      const results = await handleStage('/home/user/project', 'src/app.ts', fns)
      expect(fns.stageFile).toHaveBeenCalledWith('/home/user/project', 'src/app.ts')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Staged `src/app.ts`')
    })

    it('stages all files with --all', async () => {
      const fns = mockGitFns()
      const results = await handleStage('/home/user/project', '--all', fns)
      expect(fns.stageAll).toHaveBeenCalledWith('/home/user/project')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Staged all files')
    })

    it('unstages a specific file', async () => {
      const fns = mockGitFns()
      const results = await handleStage('/home/user/project', '--unstage src/app.ts', fns)
      expect(fns.unstageFile).toHaveBeenCalledWith('/home/user/project', 'src/app.ts')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Unstaged `src/app.ts`')
    })

    it('unstages all files with --unstage --all', async () => {
      const fns = mockGitFns()
      const results = await handleStage('/home/user/project', '--unstage --all', fns)
      expect(fns.unstageAll).toHaveBeenCalledWith('/home/user/project')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Unstaged all files')
    })

    it('handles stageFile error', async () => {
      const fns = mockGitFns()
      fns.stageFile.mockRejectedValue(new Error('file not found'))
      const results = await handleStage('/home/user/project', 'missing.ts', fns)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('**Error:**')
      expect(results[0].content).toContain('file not found')
    })

    it('handles stageAll error', async () => {
      const fns = mockGitFns()
      fns.stageAll.mockRejectedValue(new Error('permission denied'))
      const results = await handleStage('/home/user/project', '--all', fns)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('**Error:**')
      expect(results[0].content).toContain('permission denied')
    })

    it('handles unstageFile error', async () => {
      const fns = mockGitFns()
      fns.unstageFile.mockRejectedValue(new Error('pathspec did not match'))
      const results = await handleStage('/home/user/project', '--unstage nope.ts', fns)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('**Error:**')
    })

    it('help text includes /stage command', () => {
      const helpText = 'Commands: /model, /clear, /compact, /usage, /cost, /overview, /status, /summary, /fork, /pr, /changes, /diff, /log, /export, /shortcuts, /note, /review, /rename, /pin, /branches - git branch management, /stage - stage or unstage files, /debug, /help'
      expect(helpText).toContain('/stage')
      expect(helpText).toContain('stage or unstage files')
    })
  })
})
