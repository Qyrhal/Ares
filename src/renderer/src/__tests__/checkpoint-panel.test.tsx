import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CheckpointPanel } from '../components/CheckpointPanel'

const mockCheckpoint = window.electron.checkpoint as Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckpoint.list.mockResolvedValue([
    { id: 'stash@{0}', index: 0, message: 'ares:before tool op', date: '2024-01-01', branch: 'main' },
    { id: 'stash@{1}', index: 1, message: 'ares:before edit', date: '2024-01-02', branch: 'main' },
  ])
  mockCheckpoint.restore.mockResolvedValue({ ok: true })
  mockCheckpoint.drop.mockResolvedValue({ ok: true })
  mockCheckpoint.diff.mockResolvedValue('diff --git a/test.ts b/test.ts\n+new code\n-old code')
  mockCheckpoint.create.mockResolvedValue({ id: 'stash@{2}', index: 2, message: 'Manual', date: '', branch: 'main' })
})

describe('CheckpointPanel', () => {
  it('shows prompt to open a folder when workspacePath is null', () => {
    render(<CheckpointPanel workspacePath={null} />)
    expect(screen.getByText('Open a folder to use checkpoints.')).toBeInTheDocument()
  })

  it('renders header with Checkpoints label', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText(/Checkpoints/)).toBeInTheDocument())
  })

  it('shows checkpoint count badge', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('renders checkpoint items from the list', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText('before tool op')).toBeInTheDocument()
      expect(screen.getByText('before edit')).toBeInTheDocument()
    })
  })

  it('shows empty state when no checkpoints exist', async () => {
    mockCheckpoint.list.mockResolvedValue([])
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => {
      expect(screen.getByText(/No checkpoints yet/)).toBeInTheDocument()
    })
  })

  it('calls checkpoint.create when the create button is clicked', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Create checkpoint now')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByTitle('Create checkpoint now'))
    })

    await waitFor(() => {
      expect(mockCheckpoint.create).toHaveBeenCalledWith('/repo', expect.stringContaining('Manual checkpoint'))
    })
  })

  it('shows loading state during checkpoint creation', async () => {
    mockCheckpoint.create.mockImplementation(() => new Promise(() => {})) // never resolves
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Create checkpoint now')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByTitle('Create checkpoint now'))
    })

    // Loading indicator should appear
    await waitFor(() => {
      expect(screen.getByText(/Creating checkpoint/)).toBeInTheDocument()
    })
  })

  it('calls checkpoint.restore when restore button is clicked', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('before tool op')).toBeInTheDocument())

    const restoreButtons = screen.getAllByTitle('Restore checkpoint')
    await act(async () => {
      fireEvent.click(restoreButtons[0])
    })

    await waitFor(() => {
      expect(mockCheckpoint.restore).toHaveBeenCalledWith('/repo', 0)
    })
  })

  it('calls checkpoint.drop when delete button is clicked', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('before tool op')).toBeInTheDocument())

    const deleteButtons = screen.getAllByTitle('Delete checkpoint')
    await act(async () => {
      fireEvent.click(deleteButtons[0])
    })

    await waitFor(() => {
      expect(mockCheckpoint.drop).toHaveBeenCalledWith('/repo', 0)
    })
  })

  it('expands diff when a checkpoint is clicked', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('before tool op')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByText('before tool op'))
    })

    await waitFor(() => {
      expect(mockCheckpoint.diff).toHaveBeenCalledWith('/repo', 0)
      expect(screen.getByText(/new code/)).toBeInTheDocument()
      expect(screen.getByText(/old code/)).toBeInTheDocument()
    })
  })

  it('collapses diff when clicked again', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('before tool op')).toBeInTheDocument())

    // Open diff
    await act(async () => {
      fireEvent.click(screen.getByText('before tool op'))
    })
    await waitFor(() => expect(screen.getByText(/new code/)).toBeInTheDocument())

    // Click again to collapse
    await act(async () => {
      fireEvent.click(screen.getByText('before tool op'))
    })
    await waitFor(() => {
      expect(screen.queryByText(/new code/)).not.toBeInTheDocument()
    })
  })

  it('shows error state when restore fails', async () => {
    mockCheckpoint.restore.mockResolvedValue({ ok: false, error: 'Merge conflict' })
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('before tool op')).toBeInTheDocument())

    const restoreButtons = screen.getAllByTitle('Restore checkpoint')
    await act(async () => {
      fireEvent.click(restoreButtons[0])
    })

    await waitFor(() => {
      expect(screen.getByText('Merge conflict')).toBeInTheDocument()
    })
  })

  it('toggles auto-checkpoint setting', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByText('Auto-checkpoint before tool ops')).toBeInTheDocument())

    // Find the toggle switch (it's nested inside the label)
    const toggleBtn = screen.getByText('Auto-checkpoint before tool ops').nextElementSibling!
    expect(toggleBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(toggleBtn)
    })
    // Toggle should change state — the button's className reflects the state
    // Initial: bg-primary (on), After: bg-muted (off)
    expect(toggleBtn.className).toContain('bg-muted')
  })

  it('shows stash index and branch for checkpoint items', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => {
      // Text is split across nodes: "stash@", "0", " · ", "main"
      expect(screen.getAllByText(/stash@/).length).toBe(2)
      expect(screen.getAllByText(/main/).length).toBe(2)
    })
  })

  it('stores manual checkpoint message', async () => {
    await act(async () => { render(<CheckpointPanel workspacePath="/repo" />) })
    await waitFor(() => expect(screen.getByTitle('Create checkpoint now')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByTitle('Create checkpoint now'))
    })

    await waitFor(() => {
      expect(mockCheckpoint.create.mock.calls[0][1]).toContain('Manual checkpoint')
    })
  })
})
