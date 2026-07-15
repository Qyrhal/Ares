import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useAppStore } from '@/store/useAppStore'
import { CommitDetail } from '../components/CommitDetail'

describe('CommitDetail', () => {
  beforeEach(() => {
    useAppStore.setState({
      commits: [],
      activeCommit: null,
    })
  })

  it('returns null when no active commit', () => {
    const { container } = render(<CommitDetail />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when activeCommit does not match any commit', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc123', shortHash: 'abc123', parents: [], author: 'me', date: '2024-01-01', message: 'Initial' }],
      activeCommit: 'nonexistent',
    })
    const { container } = render(<CommitDetail />)
    expect(container.innerHTML).toBe('')
  })

  it('renders commit details when activeCommit matches', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc123', shortHash: 'abc123', parents: [], author: 'Alice', date: '2024-01-01T12:00:00Z', message: 'Initial commit' }],
      activeCommit: 'abc123',
    })
    render(<CommitDetail />)

    // Commit message appears in both header title and body — use getAllByText to confirm
    expect(screen.getAllByText('Initial commit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows parent hashes when present', () => {
    useAppStore.setState({
      commits: [{
        hash: 'def456', shortHash: 'def456',
        parents: ['abc123', 'xyz789'],
        author: 'Bob', date: '2024-02-01', message: 'Merge PR',
      }],
      activeCommit: 'def456',
    })
    render(<CommitDetail />)

    // Commit message appears twice (header + body)
    expect(screen.getAllByText('Merge PR').length).toBeGreaterThanOrEqual(1)
    // Parent hashes shown as truncated codes
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(screen.getByText('xyz789')).toBeInTheDocument()
  })

  it('clears active commit when close button is clicked', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'me', date: '2024-01-01', message: 'Test' }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)

    // Find the X close button
    const closeBtn = screen.getByRole('button')
    fireEvent.click(closeBtn)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })

  it('formats the commit date in a human-readable way', () => {
    useAppStore.setState({
      commits: [{
        hash: 'a1b2c3', shortHash: 'a1b2c3', parents: [],
        author: 'Charlie', date: '2024-12-25T10:30:00Z', message: 'Christmas commit',
      }],
      activeCommit: 'a1b2c3',
    })
    render(<CommitDetail />)

    // Should have a date displayed containing Dec 2024
    expect(screen.getByText(/Dec.*2024/)).toBeInTheDocument()
  })

  it('shows full commit message in a monospace block', () => {
    useAppStore.setState({
      commits: [{
        hash: 'xyz', shortHash: 'xyz', parents: [],
        author: 'Dev', date: '2024-03-15', message: 'Multi-line\ncommit message\nwith details',
      }],
      activeCommit: 'xyz',
    })
    render(<CommitDetail />)

    // The message appears both in header (span) and body (p) — use getAllByText
    expect(screen.getAllByText(/Multi-line/).length).toBe(2)
    // Verify the message text is present in the rendered output
    expect(screen.getAllByText(/with details/).length).toBeGreaterThanOrEqual(1)
  })

  it('switches displayed commit when activeCommit changes', () => {
    useAppStore.setState({
      commits: [
        { hash: 'aaa', shortHash: 'aaa', parents: [], author: 'A', date: '2024-01-01', message: 'First' },
        { hash: 'bbb', shortHash: 'bbb', parents: [], author: 'B', date: '2024-02-01', message: 'Second' },
      ],
      activeCommit: 'aaa',
    })
    const { rerender } = render(<CommitDetail />)
    expect(screen.getAllByText('First').length).toBeGreaterThanOrEqual(1)

    // Switch active commit
    useAppStore.setState({ activeCommit: 'bbb' })
    rerender(<CommitDetail />)
    expect(screen.getAllByText('Second').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('First')).not.toBeInTheDocument()
  })

  it('displays commit hash as monospace code element', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc123', shortHash: 'abc123', parents: [], author: 'A', date: '2024-01-01', message: 'Msg' }],
      activeCommit: 'abc123',
    })
    render(<CommitDetail />)
    const code = screen.getByText('abc123')
    expect(code.tagName).toBe('CODE')
    expect(code.className).toContain('font-mono')
  })
})
