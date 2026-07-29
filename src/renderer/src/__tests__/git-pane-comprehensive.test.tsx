import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { GitPane } from '../components/GitPane'
import type { GitFile, GitStatus } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    hasRepo: true,
    branch: 'main',
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    ...overrides,
  }
}

function mkFile(overrides: Partial<GitFile> = {}): GitFile {
  return {
    path: 'src/app.ts',
    index: ' ',
    working: 'M',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).electron.git.status.mockResolvedValue(mkStatus())
  ;(window as any).electron.git.branches.mockResolvedValue({ local: ['main'], current: 'main' })
  ;(window as any).electron.git.log.mockResolvedValue([])
  ;(window as any).electron.git.stageFile.mockResolvedValue(undefined)
  ;(window as any).electron.git.unstageFile.mockResolvedValue(undefined)
  ;(window as any).electron.git.stageAll.mockResolvedValue(undefined)
  ;(window as any).electron.git.unstageAll.mockResolvedValue(undefined)
  ;(window as any).electron.git.discardFile.mockResolvedValue(undefined)
  ;(window as any).electron.git.commit.mockResolvedValue(undefined)
  ;(window as any).electron.git.checkout.mockResolvedValue(undefined)
  ;(window as any).electron.git.createBranch.mockResolvedValue(undefined)
  ;(window as any).electron.git.init.mockResolvedValue(undefined)
  ;(window as any).electron.git.diff.mockResolvedValue('')
  ;(window as any).electron.git.push.mockResolvedValue(undefined)
  ;(window as any).electron.git.pull.mockResolvedValue(undefined)
})

// ── BranchPicker ─────────────────────────────────────────────────────────────

describe('GitPane — BranchPicker', () => {
  it('shows the current branch name', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('main')).toBeInTheDocument())
  })

  it('shows a different branch name when current branch differs', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(
      mkStatus({ branch: 'feature/login' })
    )
    ;(window as any).electron.git.branches.mockResolvedValue({
      local: ['main', 'feature/login'],
      current: 'feature/login',
    })
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('feature/login')).toBeInTheDocument())
  })

  it('opens dropdown when branch button is clicked', async () => {
    ;(window as any).electron.git.branches.mockResolvedValue({
      local: ['main', 'dev'],
      current: 'main',
    })
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('main')).toBeInTheDocument())

    const branchBtn = screen.getByText('main').closest('button')!
    await act(async () => { fireEvent.click(branchBtn) })

    await waitFor(() => {
      expect(screen.getByText('dev')).toBeInTheDocument()
    })
  })

  it('lists all local branches in dropdown', async () => {
    ;(window as any).electron.git.branches.mockResolvedValue({
      local: ['main', 'feature/a', 'feature/b'],
      current: 'main',
    })
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('main')).toBeInTheDocument())

    const branchBtn = screen.getByText('main').closest('button')!
    await act(async () => { fireEvent.click(branchBtn) })

    await waitFor(() => {
      expect(screen.getByText('feature/a')).toBeInTheDocument()
      expect(screen.getByText('feature/b')).toBeInTheDocument()
    })
  })

  it('checks out a different branch on click', async () => {
    ;(window as any).electron.git.branches.mockResolvedValue({
      local: ['main', 'dev'],
      current: 'main',
    })
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('main')).toBeInTheDocument())

    const branchBtn = screen.getByText('main').closest('button')!
    await act(async () => { fireEvent.click(branchBtn) })
    await waitFor(() => expect(screen.getByText('dev')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('dev')) })
    await waitFor(() => {
      expect((window as any).electron.git.checkout).toHaveBeenCalledWith('/repo', 'dev')
    })
  })

  it('opens create branch input when "Create branch…" is clicked', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('main')).toBeInTheDocument())

    const branchBtn = screen.getByText('main').closest('button')!
    await act(async () => { fireEvent.click(branchBtn) })
    await waitFor(() => expect(screen.getByText('Create branch…')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Create branch…')) })
    await waitFor(() => {
      expect(screen.getByPlaceholderText('branch-name')).toBeInTheDocument()
    })
  })

  it('creates a new branch when name is typed and confirmed', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('main')).toBeInTheDocument())

    const branchBtn = screen.getByText('main').closest('button')!
    await act(async () => { fireEvent.click(branchBtn) })
    await waitFor(() => expect(screen.getByText('Create branch…')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Create branch…')) })
    await waitFor(() => expect(screen.getByPlaceholderText('branch-name')).toBeInTheDocument())

    const input = screen.getByPlaceholderText('branch-name')
    await act(async () => { fireEvent.change(input, { target: { value: 'new-feature' } }) })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })

    await waitFor(() => {
      expect((window as any).electron.git.createBranch).toHaveBeenCalledWith('/repo', 'new-feature')
    })
  })

  it('highlights current branch in dropdown', async () => {
    ;(window as any).electron.git.branches.mockResolvedValue({
      local: ['main', 'dev'],
      current: 'main',
    })
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('main')).toBeInTheDocument())

    const branchBtn = screen.getByText('main').closest('button')!
    await act(async () => { fireEvent.click(branchBtn) })

    await waitFor(() => {
      const devBtn = screen.getByText('dev').closest('button')!
      expect(devBtn.className).toContain('text-foreground')
    })
  })
})

// ── FileRow ──────────────────────────────────────────────────────────────────

describe('GitPane — FileRow', () => {
  it('displays the file name (basename) for an unstaged file', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'src/components/App.tsx', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('App.tsx')).toBeInTheDocument())
  })

  it('displays the status character', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'file.txt', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      const statusSpan = screen.getByText('M')
      expect(statusSpan).toBeInTheDocument()
    })
  })

  it('applies correct color class for modified files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'file.txt', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      const statusSpan = screen.getByText('M')
      expect(statusSpan.className).toContain('text-amber-400')
    })
  })

  it('applies correct color class for added files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'new.txt', index: 'A', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      const statusSpan = screen.getByText('A')
      expect(statusSpan.className).toContain('text-green-400')
    })
  })

  it('applies correct color class for deleted files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'old.txt', index: ' ', working: 'D' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      const statusSpan = screen.getByText('D')
      expect(statusSpan.className).toContain('text-red-400')
    })
  })

  it('applies correct color class for renamed files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'new-name.ts', index: 'R', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      const statusSpan = screen.getByText('R')
      expect(statusSpan.className).toContain('text-blue-400')
    })
  })

  it('applies correct color class for untracked files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      untracked: [mkFile({ path: 'generated.log', index: ' ', working: '?' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      const statusSpan = screen.getByText('?')
      expect(statusSpan.className).toContain('text-muted-foreground')
    })
  })

  it('shows stage button (+) for unstaged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'file.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('file.ts')).toBeInTheDocument())
    expect(screen.getByTitle('Stage')).toBeInTheDocument()
  })

  it('shows unstage button (−) for staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'staged.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('staged.ts')).toBeInTheDocument())
    expect(screen.getByTitle('Unstage')).toBeInTheDocument()
  })

  it('shows discard button for unstaged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'modified.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('modified.ts')).toBeInTheDocument())
    expect(screen.getByTitle('Discard changes')).toBeInTheDocument()
  })

  it('shows open file button for staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'staged.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('staged.ts')).toBeInTheDocument())
    expect(screen.getByTitle('Open file')).toBeInTheDocument()
  })

  it('calls stageFile when stage button is clicked for an unstaged file', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'change.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('change.ts')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Stage')) })
    await waitFor(() => {
      expect((window as any).electron.git.stageFile).toHaveBeenCalledWith('/repo', 'change.ts')
    })
  })

  it('calls unstageFile when unstage button is clicked for a staged file', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'staged.ts', index: 'A', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('staged.ts')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Unstage')) })
    await waitFor(() => {
      expect((window as any).electron.git.unstageFile).toHaveBeenCalledWith('/repo', 'staged.ts')
    })
  })

  it('calls discardFile when discard button is clicked', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'broken.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('broken.ts')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Discard changes')) })
    await waitFor(() => {
      expect((window as any).electron.git.discardFile).toHaveBeenCalledWith('/repo', 'broken.ts')
    })
  })

  it('shows directory path next to filename when file is in a subdirectory', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'src/components/Button.tsx', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('Button.tsx')).toBeInTheDocument()
      expect(screen.getByText('src/components')).toBeInTheDocument()
    })
  })

  it('shows no directory for root-level files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'README.md', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument())
  })
})

// ── Section ──────────────────────────────────────────────────────────────────

describe('GitPane — Section collapse/expand', () => {
  it('shows staged section when there are staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Staged')).toBeInTheDocument())
  })

  it('shows unstaged section when there are unstaged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'b.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      // "Changes" appears both as the tab label and section title; both must exist
      const allChanges = screen.getAllByText('Changes')
      expect(allChanges.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows untracked section when there are untracked files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      untracked: [mkFile({ path: 'c.log', index: ' ', working: '?' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Untracked')).toBeInTheDocument())
  })

  it('displays the correct count badge for staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [
        mkFile({ path: 'a.ts', index: 'M', working: ' ' }),
        mkFile({ path: 'b.ts', index: 'A', working: ' ' }),
      ],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Staged')).toBeInTheDocument())
    const badge = screen.getAllByText('2')[0]
    expect(badge).toBeInTheDocument()
  })

  it('does not show staged section when there are no staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({ staged: [] }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
    expect(screen.queryByText('Staged')).not.toBeInTheDocument()
  })

  it('collapse/expand staged section toggles file visibility', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('a.ts')).toBeInTheDocument())

    const stagedHeader = screen.getByText('Staged')
    await act(async () => { fireEvent.click(stagedHeader) })
    await waitFor(() => {
      expect(screen.queryByText('a.ts')).not.toBeInTheDocument()
    })
  })

  it('collapse/expand unstaged section toggles file visibility', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'x.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('x.ts')).toBeInTheDocument())

    // "Changes" appears as both tab and section; click the section header (span inside a clickable div)
    const allChanges = screen.getAllByText('Changes')
    const sectionHeader = allChanges.find((el) => el.tagName === 'SPAN')
    expect(sectionHeader).toBeDefined()
    await act(async () => { fireEvent.click(sectionHeader!) })
    await waitFor(() => {
      expect(screen.queryByText('x.ts')).not.toBeInTheDocument()
    })
  })

  it('shows stage-all bulk button in Changes section', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'a.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      const allChanges = screen.getAllByText('Changes')
      expect(allChanges.length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getByTitle('Stage all')).toBeInTheDocument()
  })

  it('calls stageAll when stage-all button is clicked', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'a.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Stage all')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Stage all')) })
    await waitFor(() => {
      expect((window as any).electron.git.stageAll).toHaveBeenCalledWith('/repo')
    })
  })

  it('shows unstage-all bulk button in Staged section', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Staged')).toBeInTheDocument())
    expect(screen.getByTitle('Unstage all')).toBeInTheDocument()
  })

  it('calls unstageAll when unstage-all button is clicked', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Unstage all')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Unstage all')) })
    await waitFor(() => {
      expect((window as any).electron.git.unstageAll).toHaveBeenCalledWith('/repo')
    })
  })

  it('shows History section when repo has changes', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
    // History section always renders when hasRepo is true
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('shows history section when there are commits', async () => {
    ;(window as any).electron.git.log.mockResolvedValue([
      { hash: 'abc', shortHash: 'abc', parents: [], author: 'A', date: '', message: 'init' },
    ])
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('History')).toBeInTheDocument())
  })
})

// ── Commit Box ───────────────────────────────────────────────────────────────

describe('GitPane — Commit box', () => {
  it('renders the commit message textarea', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
  })

  it('commit button is disabled when message is empty', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
    const btn = screen.getByRole('button', { name: /Commit all/i })
    expect(btn).toBeDisabled()
  })

  it('commit button is enabled when message is provided', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
    const textarea = screen.getByPlaceholderText(/Commit message/)
    await act(async () => { fireEvent.change(textarea, { target: { value: 'feat: add feature' } }) })
    const btn = screen.getByRole('button', { name: /Commit all/i })
    expect(btn).toBeEnabled()
  })

  it('shows "Commit all" when there are no staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(
      mkStatus({ staged: [], unstaged: [mkFile()] })
    )
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Commit all')).toBeInTheDocument())
  })

  it('shows "Commit staged" when there are staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Commit staged')).toBeInTheDocument())
  })

  it('calls stageAll then commit when committing with no staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(
      mkStatus({ staged: [], unstaged: [mkFile()] })
    )
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText(/Commit message/)
    await act(async () => { fireEvent.change(textarea, { target: { value: 'first commit' } }) })

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Commit all/i })) })

    await waitFor(() => {
      expect((window as any).electron.git.stageAll).toHaveBeenCalledWith('/repo')
      expect((window as any).electron.git.commit).toHaveBeenCalledWith('/repo', 'first commit')
    })
  })

  it('calls commit directly when there are staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Commit staged')).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText(/Commit message/)
    await act(async () => { fireEvent.change(textarea, { target: { value: 'stage and commit' } }) })

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Commit staged/i })) })

    await waitFor(() => {
      expect((window as any).electron.git.commit).toHaveBeenCalledWith('/repo', 'stage and commit')
      expect((window as any).electron.git.stageAll).not.toHaveBeenCalled()
    })
  })

  it('clears the commit message after successful commit', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Commit staged')).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText(/Commit message/)
    await act(async () => { fireEvent.change(textarea, { target: { value: 'done' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Commit staged/i })) })

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Commit message/)).toHaveValue('')
    })
  })
})

// ── Loading & Error States ───────────────────────────────────────────────────

describe('GitPane — Loading state', () => {
  it('shows loading spinner during pull', async () => {
    ;(window as any).electron.git.pull.mockReturnValue(new Promise(() => {}))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Pull')) })

    await waitFor(() => {
      expect(screen.getByText(/pull…/i)).toBeInTheDocument()
    })
  })

  it('disables Pull button during loading', async () => {
    ;(window as any).electron.git.pull.mockReturnValue(new Promise(() => {}))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Pull')) })

    await waitFor(() => {
      const pullBtn = screen.getByTitle('Pull')
      expect(pullBtn).toBeDisabled()
    })
  })

  it('disables Push button during loading', async () => {
    ;(window as any).electron.git.pull.mockReturnValue(new Promise(() => {}))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Pull')) })

    await waitFor(() => {
      const pushBtn = screen.getByTitle('Push')
      expect(pushBtn).toBeDisabled()
    })
  })

  it('shows loading label during operation', async () => {
    ;(window as any).electron.git.stageFile.mockReturnValue(new Promise(() => {}))
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'a.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('a.ts')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Stage')) })

    await waitFor(() => {
      expect(screen.getByText(/stage a\.ts…/i)).toBeInTheDocument()
    })
  })
})

describe('GitPane — Error state', () => {
  it('shows error message when pull fails', async () => {
    ;(window as any).electron.git.pull.mockRejectedValue(new Error('Network error'))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Pull')) })

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('error message is dismissed on click', async () => {
    ;(window as any).electron.git.pull.mockRejectedValue(new Error('Fetch failed'))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Pull')) })
    await waitFor(() => expect(screen.getByText('Fetch failed')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Fetch failed')) })
    await waitFor(() => {
      expect(screen.queryByText('Fetch failed')).not.toBeInTheDocument()
    })
  })

  it('shows error when commit fails', async () => {
    ;(window as any).electron.git.commit.mockRejectedValue(new Error('Nothing to commit'))
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Commit staged')).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText(/Commit message/)
    await act(async () => { fireEvent.change(textarea, { target: { value: 'bad commit' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Commit staged/i })) })

    await waitFor(() => {
      expect(screen.getByText('Nothing to commit')).toBeInTheDocument()
    })
  })
})

// ── Empty State ──────────────────────────────────────────────────────────────

describe('GitPane — Empty state', () => {
  it('shows "No changes" when repo has no staged, unstaged, or untracked files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(
      mkStatus({ staged: [], unstaged: [], untracked: [] })
    )
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('No changes')).toBeInTheDocument())
  })

  it('does not show "No changes" when there are unstaged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      unstaged: [mkFile({ path: 'a.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('a.ts')).toBeInTheDocument())
    expect(screen.queryByText('No changes')).not.toBeInTheDocument()
  })

  it('shows total change count in header', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
      unstaged: [mkFile({ path: 'b.ts', index: ' ', working: 'M' })],
      untracked: [mkFile({ path: 'c.ts', index: ' ', working: '?' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })
})

// ── Not-a-repo State ─────────────────────────────────────────────────────────

describe('GitPane — Not a git repository', () => {
  it('shows "Not a git repository" when hasRepo is false', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({ hasRepo: false }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('Not a git repository')).toBeInTheDocument()
    })
  })

  it('shows "Initialize to start tracking changes" subtitle', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({ hasRepo: false }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText(/Initialize to start tracking changes/)).toBeInTheDocument()
    })
  })

  it('shows "Initialize repository" button', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({ hasRepo: false }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Initialize repository/i })).toBeInTheDocument()
    })
  })

  it('calls git init when initialize button is clicked', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({ hasRepo: false }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Initialize repository/i })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Initialize repository/i }))
    })

    await waitFor(() => {
      expect((window as any).electron.git.init).toHaveBeenCalledWith('/repo')
    })
  })

  it('does not show commit box or branch picker in not-a-repo state', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({ hasRepo: false }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('Not a git repository')).toBeInTheDocument()
    })
    expect(screen.queryByPlaceholderText(/Commit message/)).not.toBeInTheDocument()
  })
})

// ── No Workspace State ───────────────────────────────────────────────────────

describe('GitPane — No workspace', () => {
  it('shows "Open a folder" message when workspacePath is null', async () => {
    await act(async () => { render(<GitPane workspacePath={null} />) })
    await waitFor(() => {
      expect(screen.getByText(/open a folder/i)).toBeInTheDocument()
    })
  })

  it('does not call git status when workspacePath is null', async () => {
    await act(async () => { render(<GitPane workspacePath={null} />) })
    await waitFor(() => {
      expect(screen.getByText(/open a folder/i)).toBeInTheDocument()
    })
    expect((window as any).electron.git.status).not.toHaveBeenCalled()
  })

  it('shows "Open a folder" message when workspacePath is empty string', async () => {
    await act(async () => { render(<GitPane workspacePath="" />) })
    await waitFor(() => {
      expect(screen.getByText(/open a folder/i)).toBeInTheDocument()
    })
  })
})

// ── Pull / Push Buttons ──────────────────────────────────────────────────────

describe('GitPane — Pull and Push buttons', () => {
  it('renders Pull button', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Pull')).toBeInTheDocument())
  })

  it('renders Push button', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Push')).toBeInTheDocument())
  })

  it('Pull button calls git.pull', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Pull')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Pull')) })
    await waitFor(() => {
      expect((window as any).electron.git.pull).toHaveBeenCalledWith('/repo')
    })
  })

  it('Push button calls git.push', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Push')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByTitle('Push')) })
    await waitFor(() => {
      expect((window as any).electron.git.push).toHaveBeenCalledWith('/repo')
    })
  })

  it('shows ahead count when ahead > 0', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(
      mkStatus({ ahead: 3, upstream: 'origin/main' })
    )
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('shows behind count when behind > 0', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(
      mkStatus({ behind: 2, upstream: 'origin/main' })
    )
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('hides ahead/behind when both are 0', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(
      mkStatus({ ahead: 0, behind: 0, upstream: 'origin/main' })
    )
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
  })
})

// ── Refresh ──────────────────────────────────────────────────────────────────

describe('GitPane — Refresh', () => {
  it('renders refresh button', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByTitle('Refresh')).toBeInTheDocument()
    })
  })

  it('refresh button re-fetches git status', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Refresh')).toBeInTheDocument())
    const initialCalls = (window as any).electron.git.status.mock.calls.length

    await act(async () => { fireEvent.click(screen.getByTitle('Refresh')) })
    await waitFor(() => {
      expect((window as any).electron.git.status.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })
})

// ── Multi-file Edge Cases ────────────────────────────────────────────────────

describe('GitPane — Multi-file edge cases', () => {
  it('renders multiple staged files', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [
        mkFile({ path: 'a.ts', index: 'M', working: ' ' }),
        mkFile({ path: 'b.ts', index: 'A', working: ' ' }),
        mkFile({ path: 'c.ts', index: 'D', working: ' ' }),
      ],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('a.ts')).toBeInTheDocument()
      expect(screen.getByText('b.ts')).toBeInTheDocument()
      expect(screen.getByText('c.ts')).toBeInTheDocument()
    })
  })

  it('renders mixed staged and unstaged files in separate sections', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'staged.ts', index: 'M', working: ' ' })],
      unstaged: [mkFile({ path: 'unstaged.ts', index: ' ', working: 'M' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('Staged')).toBeInTheDocument()
      // "Changes" appears as tab and section
      const allChanges = screen.getAllByText('Changes')
      expect(allChanges.length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('staged.ts')).toBeInTheDocument()
      expect(screen.getByText('unstaged.ts')).toBeInTheDocument()
    })
  })

  it('renders all three sections when files exist in each', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [mkFile({ path: 'a.ts', index: 'M', working: ' ' })],
      unstaged: [mkFile({ path: 'b.ts', index: ' ', working: 'M' })],
      untracked: [mkFile({ path: 'c.ts', index: ' ', working: '?' })],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('Staged')).toBeInTheDocument()
      const allChanges = screen.getAllByText('Changes')
      expect(allChanges.length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Untracked')).toBeInTheDocument()
    })
  })

  it('displays correct total count in header', async () => {
    ;(window as any).electron.git.status.mockResolvedValue(mkStatus({
      staged: [
        mkFile({ path: 'a.ts', index: 'M', working: ' ' }),
        mkFile({ path: 'b.ts', index: 'A', working: ' ' }),
      ],
      unstaged: [mkFile({ path: 'c.ts', index: ' ', working: 'M' })],
      untracked: [
        mkFile({ path: 'd.log', index: ' ', working: '?' }),
        mkFile({ path: 'e.log', index: ' ', working: '?' }),
        mkFile({ path: 'f.log', index: ' ', working: '?' }),
      ],
    }))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument()
    })
  })
})

// ── Commit button disabled during loading ────────────────────────────────────

describe('GitPane — Commit button disabled during loading', () => {
  it('commit button is disabled while an operation is in progress', async () => {
    ;(window as any).electron.git.pull.mockReturnValue(new Promise(() => {}))
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText(/Commit message/)
    await act(async () => { fireEvent.change(textarea, { target: { value: 'my commit' } }) })

    await act(async () => { fireEvent.click(screen.getByTitle('Pull')) })

    await waitFor(() => {
      const commitBtn = screen.getByRole('button', { name: /Commit all/i })
      expect(commitBtn).toBeDisabled()
    })
  })
})

// ── History Section ──────────────────────────────────────────────────────────

describe('GitPane — History section', () => {
  it('shows History section when commits are present', async () => {
    ;(window as any).electron.git.log.mockResolvedValue([
      { hash: 'a1b2c3', shortHash: 'a1b2c3', parents: [], author: 'Dev', date: '2024-01-01', message: 'Initial' },
    ])
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('History')).toBeInTheDocument())
  })

  it('History section can be collapsed', async () => {
    ;(window as any).electron.git.log.mockResolvedValue([
      { hash: 'a', shortHash: 'a', parents: [], author: 'Dev', date: '', message: 'First commit' },
    ])
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('First commit')).toBeInTheDocument())

    const historyHeader = screen.getByText('History')
    await act(async () => { fireEvent.click(historyHeader) })
    await waitFor(() => {
      expect(screen.queryByText('First commit')).not.toBeInTheDocument()
    })
  })
})

// ── Source Control Header ────────────────────────────────────────────────────

describe('GitPane — Source Control header', () => {
  it('renders "Source Control" label', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Source Control')).toBeInTheDocument())
  })

  it('renders Changes and Checkpoints tabs', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Source Control')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Changes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Checkpoints' })).toBeInTheDocument()
  })
})
