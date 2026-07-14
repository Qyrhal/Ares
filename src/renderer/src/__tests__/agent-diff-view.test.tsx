import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentDiffView } from '../components/AgentDiffView'

describe('AgentDiffView', () => {
  // ── Empty / null states ────────────────────────────────────────────────────

  it('renders nothing when diff is empty string', () => {
    const { container } = render(<AgentDiffView diff="" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when diff is whitespace only', () => {
    const { container } = render(<AgentDiffView diff="   \n  " />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when diff is null-like (not passed)', () => {
    const { container } = render(<AgentDiffView diff={undefined as unknown as string} />)
    expect(container.innerHTML).toBe('')
  })

  // ── Basic rendering ────────────────────────────────────────────────────────

  it('renders diff content with +/- lines', () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
-const x = 1
+const x = 2
 const y = 3
+const z = 4`
    render(<AgentDiffView diff={diff} />)
    expect(screen.getByText('Changes')).toBeInTheDocument()
  })

  it('shows file path in header when provided', () => {
    render(<AgentDiffView diff="+line" filePath="src/file.ts" />)
    expect(screen.getByText('src/file.ts')).toBeInTheDocument()
  })

  it('shows addition count label', () => {
    const diff = '+line1\n+line2\n-line3'
    render(<AgentDiffView diff={diff} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('shows deletion count label', () => {
    const diff = '+line1\n-line2\n-line3'
    render(<AgentDiffView diff={diff} />)
    expect(screen.getByText('-2')).toBeInTheDocument()
  })

  // ── Collapse / Expand ──────────────────────────────────────────────────────

  it('expands diff by default', () => {
    const diff = '+const x = 1'
    render(<AgentDiffView diff={diff} />)
    expect(screen.getByText('+const x = 1')).toBeInTheDocument()
  })

  it('collapses diff when header is clicked', () => {
    const diff = '+visible when expanded'
    render(<AgentDiffView diff={diff} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('+visible when expanded')).not.toBeInTheDocument()
  })

  it('re-expands diff when header is clicked again', () => {
    const diff = '+back again'
    render(<AgentDiffView diff={diff} />)
    fireEvent.click(screen.getByRole('button')) // collapse
    fireEvent.click(screen.getByRole('button')) // expand
    expect(screen.getByText('+back again')).toBeInTheDocument()
  })

  // ── Diff content parsing ───────────────────────────────────────────────────

  it('highlights addition lines with green', () => {
    const diff = '+newCode()'
    render(<AgentDiffView diff={diff} />)
    const addition = screen.getByText('+newCode()')
    expect(addition.className).toContain('green')
  })

  it('highlights deletion lines with red', () => {
    const diff = '-oldCode()'
    render(<AgentDiffView diff={diff} />)
    const deletion = screen.getByText('-oldCode()')
    expect(deletion.className).toContain('red')
  })

  it('handles multiple hunks', () => {
    const diff = `@@ -1,5 +1,5 @@
  header
-foo
+bar
@@ -10,15 +10,15 @@
-old
+new`
    render(<AgentDiffView diff={diff} />)
    expect(screen.getByText('+bar')).toBeInTheDocument()
    expect(screen.getByText('+new')).toBeInTheDocument()
  })

  // ── Integration with MessageItem ──────────────────────────────────────────

  it('renders without crashing for various diff formats', () => {
    const diffs = [
      'diff --git a/file.ts b/file.ts\nindex abc..def 100644\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new',
      '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new',
      '+single addition',
    ]
    for (const d of diffs) {
      const { container } = render(<AgentDiffView diff={d} />)
      expect(container.innerHTML.length).toBeGreaterThan(0)
    }
  })
})
