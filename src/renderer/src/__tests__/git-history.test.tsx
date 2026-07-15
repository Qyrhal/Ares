import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GitHistory } from '../components/GitHistory'
import type { GitCommit } from '@/types'

const commits: GitCommit[] = [
  { hash: 'aaa', shortHash: 'aaa', parents: [], author: 'Alice', date: '2024-01-01', message: 'Initial commit' },
  { hash: 'bbb', shortHash: 'bbb', parents: ['aaa'], author: 'Bob', date: '2024-02-01', message: 'Second commit' },
  { hash: 'ccc', shortHash: 'ccc', parents: ['bbb'], author: 'Alice', date: '2024-03-01', message: 'Third commit via PR' },
]

describe('GitHistory', () => {
  it('renders empty state when no commits', () => {
    render(
      <GitHistory commits={[]} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    expect(screen.getByText('No commits yet')).toBeInTheDocument()
  })

  it('renders all commits', () => {
    render(
      <GitHistory commits={commits} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    expect(screen.getByText('Initial commit')).toBeInTheDocument()
    expect(screen.getByText('Second commit')).toBeInTheDocument()
    expect(screen.getByText('Third commit via PR')).toBeInTheDocument()
  })

  it('shows commit short hashes', () => {
    render(
      <GitHistory commits={commits} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    // Short hashes are shown as monospace elements
    expect(screen.getByText('aaa')).toBeInTheDocument()
    expect(screen.getByText('bbb')).toBeInTheDocument()
    expect(screen.getByText('ccc')).toBeInTheDocument()
  })

  it('calls onSelectCommit when a commit row is clicked', () => {
    const onSelect = vi.fn()
    render(
      <GitHistory commits={commits} activeCommit={null} onSelectCommit={onSelect} />
    )
    fireEvent.click(screen.getByText('Initial commit'))
    expect(onSelect).toHaveBeenCalledWith('aaa')
  })

  it('shows short hashes', () => {
    render(
      <GitHistory commits={commits} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    // Short hashes are shown as code elements
    expect(screen.getByText('aaa')).toBeInTheDocument()
    expect(screen.getByText('bbb')).toBeInTheDocument()
    expect(screen.getByText('ccc')).toBeInTheDocument()
  })

  it('highlights the active commit', () => {
    render(
      <GitHistory commits={commits} activeCommit="bbb" onSelectCommit={vi.fn()} />
    )
    // Commit rows are divs with onClick, not button elements
    const rows = screen.getAllByText('Second commit').map(
      (el) => el.closest('[role="button"]') || el.closest('.cursor-pointer') || el.parentElement
    )
    // The parent element that has cursor-pointer class should include bg-primary
    const row = screen.getByText('Second commit').closest('.cursor-pointer') as HTMLElement
    expect(row.className).toContain('bg-accent')
  })

  it('renders svg graph elements for parent relationships', () => {
    const { container } = render(
      <GitHistory commits={commits} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    // SVG graph is rendered
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    // Should have line/polyline elements for edges
    const lines = svg?.querySelectorAll('line, polyline')
    expect(lines!.length).toBeGreaterThan(0)
  })

  it('handles single commit gracefully', () => {
    const single = [commits[0]]
    render(
      <GitHistory commits={single} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    expect(screen.getByText('Initial commit')).toBeInTheDocument()
    expect(screen.getByText('aaa')).toBeInTheDocument()
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('handles merge commit with two parents', () => {
    const mergeCommit: GitCommit = {
      hash: 'merge', shortHash: 'merge',
      parents: ['aaa', 'bbb'],
      author: 'Merged', date: '2024-04-01', message: 'Merge branch',
    }
    render(
      <GitHistory commits={[...commits, mergeCommit]} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    expect(screen.getByText('Merge branch')).toBeInTheDocument()
    // SVG should have polyline for the merge edge
    const svg = document.querySelector('svg')
    const polylines = svg?.querySelectorAll('polyline')
    expect(polylines!.length).toBeGreaterThan(0)
  })

  it('does not crash when commits array is null-like empty', () => {
    render(
      <GitHistory commits={[]} activeCommit={null} onSelectCommit={vi.fn()} />
    )
    expect(screen.getByText('No commits yet')).toBeInTheDocument()
  })
})
