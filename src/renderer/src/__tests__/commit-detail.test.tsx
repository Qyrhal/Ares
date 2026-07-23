import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useAppStore } from '@/store/useAppStore'
import { CommitDetail } from '../components/CommitDetail'

beforeEach(() => {
  useAppStore.setState({
    commits: [],
    activeCommit: null,
  })
})

describe('CommitDetail — null/empty states', () => {
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

  it('returns null when commits list is empty but activeCommit is set', () => {
    useAppStore.setState({
      commits: [],
      activeCommit: 'some-hash',
    })
    const { container } = render(<CommitDetail />)
    expect(container.innerHTML).toBe('')
  })
})

describe('CommitDetail — renders commit info', () => {
  it('renders commit details when activeCommit matches', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc123', shortHash: 'abc123', parents: [], author: 'Alice', date: '2024-01-01T12:00:00Z', message: 'Initial commit' }],
      activeCommit: 'abc123',
    })
    render(<CommitDetail />)

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

    expect(screen.getAllByText('Merge PR').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(screen.getByText('xyz789')).toBeInTheDocument()
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
    expect(screen.getByText(/Dec.*2024/)).toBeInTheDocument()
  })

  it('shows full commit message in a monospace block', () => {
    useAppStore.setState({
      commits: [{
        hash: 'xyz', shortHash: 'xyz', parents: [],
        author: 'Dev', date: '2024-03-15',
        message: 'Multi-line\ncommit message\nwith details',
      }],
      activeCommit: 'xyz',
    })
    render(<CommitDetail />)

    expect(screen.getAllByText(/Multi-line/).length).toBe(2)
    expect(screen.getAllByText(/with details/).length).toBeGreaterThanOrEqual(1)
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

describe('CommitDetail — interactions', () => {
  it('clears active commit when close button is clicked', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'me', date: '2024-01-01', message: 'Test' }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)

    const closeBtn = screen.getByRole('button')
    fireEvent.click(closeBtn)
    expect(useAppStore.getState().activeCommit).toBeNull()
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

    useAppStore.setState({ activeCommit: 'bbb' })
    rerender(<CommitDetail />)
    expect(screen.getAllByText('Second').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('First')).not.toBeInTheDocument()
  })
})

describe('CommitDetail — layout structure', () => {
  it('has proper header with commit message and close button', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'me', date: '2024-01-01', message: 'Test commit' }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)
    // Should have the close button
    expect(screen.getByRole('button')).toBeDefined()
    // Should have the commit message in header
    expect(screen.getAllByText('Test commit').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Author label', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'Alice', date: '2024-01-01', message: 'Test' }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)
    expect(screen.getByText('Author:')).toBeInTheDocument()
  })

  it('shows Date label', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'Alice', date: '2024-01-01', message: 'Test' }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)
    expect(screen.getByText('Date:')).toBeInTheDocument()
  })

  it('shows Commit label', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'Alice', date: '2024-01-01', message: 'Test' }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)
    expect(screen.getByText('Commit:')).toBeInTheDocument()
  })

  it('hides Parents label when no parents', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'Alice', date: '2024-01-01', message: 'Test' }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)
    expect(screen.queryByText('Parents:')).toBeNull()
  })

  it('shows Parents label when parents exist', () => {
    useAppStore.setState({
      commits: [{
        hash: 'abc', shortHash: 'abc',
        parents: ['def123'],
        author: 'Alice', date: '2024-01-01', message: 'Merge',
      }],
      activeCommit: 'abc',
    })
    render(<CommitDetail />)
    expect(screen.getByText('Parents:')).toBeInTheDocument()
  })
})
