import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { GitPane } from '../components/GitPane'

beforeEach(() => {
  vi.clearAllMocks()
  ;(window.electron.git.status as ReturnType<typeof vi.fn>).mockResolvedValue({
    hasRepo: true, branch: 'main', upstream: null, ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [],
  })
})

describe('GitPane — Checkpoints sub-tab', () => {
  it('shows the Changes tab by default', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Changes' })).toHaveAttribute('aria-selected', 'true')
  })

  it('mounts CheckpointPanel content when the Checkpoints sub-tab is clicked', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Checkpoints' })) })

    await waitFor(() => expect(screen.getByText(/No checkpoints yet/)).toBeInTheDocument())
    expect(screen.queryByPlaceholderText(/Commit message/)).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Checkpoints' })).toHaveAttribute('aria-selected', 'true')
  })
})
