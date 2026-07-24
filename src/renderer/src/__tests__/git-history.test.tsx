import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { GitHistory } from '../components/GitHistory'
import type { GitCommit } from '@/types'

function mkCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    hash: 'abc123',
    shortHash: 'abc123',
    parents: [],
    author: 'Test',
    date: new Date().toISOString(),
    message: 'Initial commit',
    ...overrides,
  }
}

describe('GitHistory', () => {
  it('renders empty state when no commits', () => {
    render(<GitHistory commits={[]} activeCommit={null} onSelectCommit={vi.fn()} />)
    expect(screen.getByText('No commits yet')).toBeInTheDocument()
  })

  it('renders a single commit with message', () => {
    render(
      <GitHistory
        commits={[mkCommit({ shortHash: 'abc123', message: 'Add feature' })]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    expect(screen.getByText('Add feature')).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
  })

  it('renders multiple commits', () => {
    render(
      <GitHistory
        commits={[
          mkCommit({ hash: 'a', shortHash: 'aaa', message: 'First' }),
          mkCommit({ hash: 'b', shortHash: 'bbb', message: 'Second', parents: ['a'] }),
        ]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('calls onSelectCommit when commit is clicked', () => {
    const onSelect = vi.fn()
    render(
      <GitHistory
        commits={[mkCommit({ hash: 'abc', message: 'Click me' })]}
        activeCommit={null}
        onSelectCommit={onSelect}
      />
    )
    fireEvent.click(screen.getByText('Click me'))
    expect(onSelect).toHaveBeenCalledWith('abc')
  })

  it('highlights the active commit', () => {
    render(
      <GitHistory
        commits={[mkCommit({ hash: 'abc', message: 'Active' })]}
        activeCommit="abc"
        onSelectCommit={vi.fn()}
      />
    )
    const row = screen.getByText('Active').closest('div[class*="cursor-pointer"]')!
    expect(row.className).toContain('bg-accent/60')
  })

  it('does not highlight non-active commits', () => {
    render(
      <GitHistory
        commits={[mkCommit({ hash: 'abc', message: 'Inactive' })]}
        activeCommit="xyz"
        onSelectCommit={vi.fn()}
      />
    )
    const row = screen.getByText('Inactive').closest('div[class*="cursor-pointer"]')!
    expect(row.className).not.toContain('bg-accent/60')
  })

  it('renders SVG graph layer', () => {
    const { container } = render(
      <GitHistory
        commits={[mkCommit()]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders SVG circles for commits', () => {
    const { container } = render(
      <GitHistory
        commits={[mkCommit()]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(1)
  })

  it('renders SVG connections for parent relationships', () => {
    const { container } = render(
      <GitHistory
        commits={[
          mkCommit({ hash: 'parent', shortHash: 'parent' }),
          mkCommit({ hash: 'child', shortHash: 'child', parents: ['parent'] }),
        ]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    const lines = container.querySelectorAll('line')
    const polylines = container.querySelectorAll('polyline')
    expect(lines.length + polylines.length).toBeGreaterThanOrEqual(1)
  })

  it('renders polyline for cross-column parent connections', () => {
    const { container } = render(
      <GitHistory
        commits={[
          mkCommit({ hash: 'a', shortHash: 'aaa' }),
          mkCommit({ hash: 'b', shortHash: 'bbb', parents: [] }),
          mkCommit({ hash: 'merge', shortHash: 'mmm', parents: ['a', 'b'] }),
        ]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    const polylines = container.querySelectorAll('polyline')
    expect(polylines.length).toBeGreaterThanOrEqual(1)
  })

  it('renders commit short hashes as monospace', () => {
    render(
      <GitHistory
        commits={[mkCommit({ shortHash: 'd3adbeef' })]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    const hashEl = screen.getByText('d3adbeef')
    expect(hashEl.className).toContain('font-mono')
  })

  it('sets commit message as title attribute', () => {
    render(
      <GitHistory
        commits={[mkCommit({ message: 'Fix the bug' })]}
        activeCommit={null}
        onSelectCommit={vi.fn()}
      />
    )
    const row = screen.getByText('Fix the bug').closest('[title="Fix the bug"]')!
    expect(row).toBeInTheDocument()
  })
})
