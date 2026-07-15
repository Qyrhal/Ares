import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import App from '../App'

vi.mock('../components/TerminalView', () => ({
  TerminalView: () => <div data-testid="terminal-mock" />,
}))

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-mock" />,
  Editor: () => <div data-testid="monaco-mock" />,
}))

function getRegisteredCallback<T extends (...args: never[]) => unknown>(mockFn: unknown): T {
  return (mockFn as ReturnType<typeof vi.fn>).mock.calls[0][0] as T
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Pi compaction events', () => {
  it('subscribes to onCompaction on mount', async () => {
    await act(async () => { render(<App />) })
    expect(window.electron.pi.onCompaction).toHaveBeenCalledTimes(1)
  })

  it('shows a toast when agent-mode compaction finishes', async () => {
    await act(async () => { render(<App />) })
    const onCompaction = getRegisteredCallback<(sessionId: string, phase: 'start' | 'end') => void>(
      window.electron.pi.onCompaction
    )
    act(() => { onCompaction('s1', 'end') })
    expect(await screen.findByText('Context compacted')).toBeInTheDocument()
  })

  it('does not toast on compaction start', async () => {
    await act(async () => { render(<App />) })
    const onCompaction = getRegisteredCallback<(sessionId: string, phase: 'start' | 'end') => void>(
      window.electron.pi.onCompaction
    )
    act(() => { onCompaction('s1', 'start') })
    expect(screen.queryByText('Context compacted')).not.toBeInTheDocument()
  })

  it('unsubscribes on unmount', async () => {
    const off = vi.fn()
    ;(window.electron.pi.onCompaction as ReturnType<typeof vi.fn>).mockReturnValue(off)
    let unmount: () => void
    await act(async () => { ({ unmount } = render(<App />)) })
    act(() => { unmount() })
    expect(off).toHaveBeenCalled()
  })
})
