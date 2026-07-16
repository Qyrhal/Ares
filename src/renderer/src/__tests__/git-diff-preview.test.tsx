import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GitPane } from '@/components/GitPane'

const STATUS_RESPONSE = {
  hasRepo: true,
  branch: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  staged: [
    { path: 'src/index.ts', index: 'M', working: ' ' },
    { path: 'src/utils.ts', index: 'A', working: ' ' },
  ],
  unstaged: [
    { path: 'README.md', index: ' ', working: 'M' },
    { path: 'src/app.tsx', index: ' ', working: 'M' },
  ],
  untracked: [
    { path: 'new-file.ts', index: '?', working: '?' },
  ],
}

const DIFF_STAGED = `diff --git a/src/index.ts b/src/index.ts
index abc..def 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
-const x = 1
+let x = 2
+const y = 3
 class Foo {}`

const DIFF_UNSTAGED = `diff --git a/README.md b/README.md
index 123..456 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
-# Project
+# Ares Project
+New description`

describe('GitPane — Diff Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset git mocks to default returns for each test
    const git = window.electron.git as any
    git.status.mockResolvedValue(STATUS_RESPONSE)
    git.branches.mockResolvedValue({ local: ['main'], current: 'main' })
    git.log.mockResolvedValue([])
    git.diff.mockReset()
  })

  it('shows staged and unstaged sections with diff stats after clicking a file', async () => {
    const git = window.electron.git as any
    git.diff.mockResolvedValue(DIFF_STAGED)

    render(<GitPane workspacePath="/test/project" />)

    // Wait for status to load
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument()
    })

    // Click the staged file to see its diff
    fireEvent.click(screen.getByText('index.ts'))

    await waitFor(() => {
      // Should show diff stats after click — use getAllByText since AgentDiffView also renders +2
      const stats = screen.getAllByText('+2')
      expect(stats.length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('-1').length).toBeGreaterThanOrEqual(1)
    })

    // Should have called diff for staged file
    expect(git.diff).toHaveBeenCalledWith('/test/project', 'src/index.ts', true)
  })

  it('shows unstaged diff when clicking unstaged file', async () => {
    const git = window.electron.git as any
    git.diff.mockResolvedValue(DIFF_UNSTAGED)

    render(<GitPane workspacePath="/test/project" />)

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('README.md'))

    await waitFor(() => {
      expect(screen.getAllByText('+2').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('-1').length).toBeGreaterThanOrEqual(1)
    })

    expect(git.diff).toHaveBeenCalledWith('/test/project', 'README.md', false)
  })

  it('shows untracked message when clicking untracked file', async () => {
    render(<GitPane workspacePath="/test/project" />)

    await waitFor(() => {
      expect(screen.getByText('new-file.ts')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('new-file.ts'))

    await waitFor(() => {
      expect(screen.getByText('Untracked file — no diff available')).toBeInTheDocument()
    })
  })

  it('toggles diff off when clicking the same file again', async () => {
    const git = window.electron.git as any
    git.diff.mockResolvedValue(DIFF_STAGED)

    render(<GitPane workspacePath="/test/project" />)

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument()
    })

    // Click to open diff
    fireEvent.click(screen.getByText('index.ts'))
    await waitFor(() => {
      expect(screen.getAllByText('+2').length).toBeGreaterThanOrEqual(1)
    })

    // Click again to close
    fireEvent.click(screen.getByText('index.ts'))
    await waitFor(() => {
      expect(screen.queryAllByText('+2').length).toBe(0)
    })
  })

  it('shows loading state while diff is being fetched', async () => {
    const git = window.electron.git as any
    let resolveDiff: (v: string) => void
    git.diff.mockImplementation(() => new Promise((resolve) => { resolveDiff = resolve }))

    render(<GitPane workspacePath="/test/project" />)

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('index.ts'))

    await waitFor(() => {
      expect(screen.getByText('Loading diff…')).toBeInTheDocument()
    })

    // Resolve the diff
    resolveDiff!('')
  })

  it('shows open file button on file rows', async () => {
    render(<GitPane workspacePath="/test/project" />)

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument()
    })

    // There should be an "Open file" action button
    const fileButtons = screen.getAllByTitle('Open file')
    expect(fileButtons.length).toBeGreaterThanOrEqual(1)
  })
})
