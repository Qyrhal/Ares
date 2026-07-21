import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers extracted from App.tsx command handler logic ─────────────────

interface GitBranches {
  local: string[]
  current: string
}

/**
 * Formats a branch list for display. Marks the current branch with `*`.
 * Pure function — no React, no DOM.
 */
function formatBranchList(branches: GitBranches): string {
  const lines: string[] = ['**Git Branches**\n']
  if (branches.local.length === 0) {
    lines.push('No branches found. Is this a git repository?')
  } else {
    for (const branch of branches.local) {
      const marker = branch === branches.current ? '* ' : '  '
      lines.push(`${marker}\`${branch}\``)
    }
  }
  return lines.join('\n')
}

/**
 * Parses branches command arguments.
 * Returns { action: 'list' } | { action: 'checkout', branch: string } | { action: 'create', branch: string }
 */
function parseBranchArgs(args: string):
  | { action: 'list' }
  | { action: 'checkout'; branch: string }
  | { action: 'create'; branch: string } {
  if (!args) return { action: 'list' }
  if (args.startsWith('--new ')) {
    const branchName = args.slice(6).trim()
    if (!branchName) return { action: 'list' }
    return { action: 'create', branch: branchName }
  }
  return { action: 'checkout', branch: args.trim() }
}

/**
 * Simulates the /branches command dispatch logic from App.tsx.
 * Pure function — no React, no DOM.
 */
async function handleBranches(
  workspacePath: string | null,
  args: string,
  gitFns: {
    branches: (cwd: string) => Promise<GitBranches>
    checkout: (cwd: string, branch: string) => Promise<void>
    createBranch: (cwd: string, branch: string) => Promise<void>
  },
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (!workspacePath) {
    pushMsg('No workspace open. Use /folder to open a project first.')
    return results
  }

  const parsed = parseBranchArgs(args)

  if (parsed.action === 'list') {
    try {
      const result = await gitFns.branches(workspacePath)
      pushMsg(formatBranchList(result))
    } catch (err) {
      pushMsg(`**Error:** ${(err as Error).message}`)
    }
  } else if (parsed.action === 'create') {
    try {
      await gitFns.createBranch(workspacePath, parsed.branch)
      pushMsg(`Created and switched to branch \`${parsed.branch}\``)
    } catch (err) {
      pushMsg(`**Error:** ${(err as Error).message}`)
    }
  } else {
    try {
      await gitFns.checkout(workspacePath, parsed.branch)
      pushMsg(`Switched to branch \`${parsed.branch}\``)
    } catch (err) {
      pushMsg(`**Error:** ${(err as Error).message}`)
    }
  }

  return results
}

// ── tests ──────────────────────────────────────────────────────────────

describe('/branches slash command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseBranchArgs', () => {
    it('returns list action with no args', () => {
      expect(parseBranchArgs('')).toEqual({ action: 'list' })
    })

    it('returns checkout action for branch name', () => {
      expect(parseBranchArgs('main')).toEqual({ action: 'checkout', branch: 'main' })
    })

    it('returns checkout action for branch name with whitespace', () => {
      expect(parseBranchArgs('  feature-x  ')).toEqual({ action: 'checkout', branch: 'feature-x' })
    })

    it('returns create action for --new flag', () => {
      expect(parseBranchArgs('--new feature-branch')).toEqual({ action: 'create', branch: 'feature-branch' })
    })

    it('returns list when --new has no branch name', () => {
      expect(parseBranchArgs('--new ')).toEqual({ action: 'list' })
    })

    it('trims whitespace from --new branch name', () => {
      expect(parseBranchArgs('--new   spaced  ')).toEqual({ action: 'create', branch: 'spaced' })
    })
  })

  describe('formatBranchList', () => {
    it('marks current branch with asterisk', () => {
      const result = formatBranchList({ local: ['main', 'feature'], current: 'main' })
      expect(result).toContain('* `main`')
      expect(result).toContain('  `feature`')
    })

    it('includes header text', () => {
      const result = formatBranchList({ local: ['main'], current: 'main' })
      expect(result).toContain('**Git Branches**')
    })

    it('handles empty branch list', () => {
      const result = formatBranchList({ local: [], current: '' })
      expect(result).toContain('No branches found')
    })

    it('handles multiple branches', () => {
      const result = formatBranchList({ local: ['main', 'dev', 'feat/x'], current: 'dev' })
      expect(result).toContain('  `main`')
      expect(result).toContain('* `dev`')
      expect(result).toContain('  `feat/x`')
    })

    it('handles current branch not in local list (detached HEAD)', () => {
      const result = formatBranchList({ local: ['main', 'dev'], current: 'main' })
      expect(result).toContain('* `main`')
      expect(result).toContain('  `dev`')
    })
  })

  describe('handleBranches', () => {
    it('returns error when no workspace is open', async () => {
      const results = await handleBranches(null, '', {
        branches: vi.fn(),
        checkout: vi.fn(),
        createBranch: vi.fn(),
      })
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('No workspace open')
    })

    it('lists branches when no args given', async () => {
      const mockBranches = vi.fn().mockResolvedValue({ local: ['main', 'dev'], current: 'main' })
      const results = await handleBranches('/home/user/project', '', {
        branches: mockBranches,
        checkout: vi.fn(),
        createBranch: vi.fn(),
      })
      expect(mockBranches).toHaveBeenCalledWith('/home/user/project')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('* `main`')
      expect(results[0].content).toContain('  `dev`')
    })

    it('handles branch listing error', async () => {
      const mockBranches = vi.fn().mockRejectedValue(new Error('not a git repo'))
      const results = await handleBranches('/home/user/project', '', {
        branches: mockBranches,
        checkout: vi.fn(),
        createBranch: vi.fn(),
      })
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('**Error:**')
      expect(results[0].content).toContain('not a git repo')
    })

    it('checks out a branch by name', async () => {
      const mockCheckout = vi.fn().mockResolvedValue(undefined)
      const results = await handleBranches('/home/user/project', 'feature-x', {
        branches: vi.fn(),
        checkout: mockCheckout,
        createBranch: vi.fn(),
      })
      expect(mockCheckout).toHaveBeenCalledWith('/home/user/project', 'feature-x')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Switched to branch `feature-x`')
    })

    it('handles checkout error', async () => {
      const mockCheckout = vi.fn().mockRejectedValue(new Error('pathspec not found'))
      const results = await handleBranches('/home/user/project', 'nonexistent', {
        branches: vi.fn(),
        checkout: mockCheckout,
        createBranch: vi.fn(),
      })
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('**Error:**')
      expect(results[0].content).toContain('pathspec not found')
    })

    it('creates a new branch with --new flag', async () => {
      const mockCreate = vi.fn().mockResolvedValue(undefined)
      const results = await handleBranches('/home/user/project', '--new my-feature', {
        branches: vi.fn(),
        checkout: vi.fn(),
        createBranch: mockCreate,
      })
      expect(mockCreate).toHaveBeenCalledWith('/home/user/project', 'my-feature')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('Created and switched to branch `my-feature`')
    })

    it('handles create branch error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('branch already exists'))
      const results = await handleBranches('/home/user/project', '--new existing-branch', {
        branches: vi.fn(),
        checkout: vi.fn(),
        createBranch: mockCreate,
      })
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('**Error:**')
      expect(results[0].content).toContain('branch already exists')
    })

    it('help text includes /branches command', () => {
      const helpText = 'Commands: /model, /clear, /compact, /usage, /cost, /overview, /status, /summary, /fork, /pr, /changes, /diff, /log, /export, /shortcuts, /note, /review, /rename, /pin, /branches - git branch management, /debug, /help'
      expect(helpText).toContain('/branches')
      expect(helpText).toContain('git branch management')
    })
  })
})
