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

  it('shows no-repo message when workspacePath is null', async () => {
    await act(async () => { render(<GitPane workspacePath={null} />) })
    await waitFor(() => {
      expect(screen.getByText(/open a folder/i)).toBeInTheDocument()
    })
  })

  it('shows no-repo message when workspacePath is empty string', async () => {
    await act(async () => { render(<GitPane workspacePath="" />) })
    await waitFor(() => {
      expect(screen.getByText(/open a folder/i)).toBeInTheDocument()
    })
  })

  it('renders branch information when repo is available', async () => {
    ;(window.electron.git.status as ReturnType<typeof vi.fn>).mockResolvedValue({
      hasRepo: true, branch: 'feature-branch', upstream: 'origin/feature-branch',
      ahead: 3, behind: 1, staged: [], unstaged: [], untracked: [],
    })
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText(/feature-branch/)).toBeInTheDocument()
    })
  })

  it('shows ahead/behind counts', async () => {
    ;(window.electron.git.status as ReturnType<typeof vi.fn>).mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: 'origin/main',
      ahead: 5, behind: 2, staged: [], unstaged: [], untracked: [],
    })
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    // The status fetch may take a tick; waitFor will retry
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('switches between Changes and Checkpoints tabs', async () => {
    await act(async () => { render(<GitPane workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Checkpoints' })) })
    await waitFor(() => expect(screen.getByText(/No checkpoints yet/)).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Changes' })) })
    await waitFor(() => expect(screen.getByPlaceholderText(/Commit message/)).toBeInTheDocument())
  })
})
