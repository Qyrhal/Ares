import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import App from '../App'
import { useAppStore } from '../store/useAppStore'
import type { Session } from '@/types'

vi.mock('../components/TerminalView', () => ({
  TerminalView: () => <div data-testid="terminal-mock" />,
}))

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-mock" />,
  Editor: () => <div data-testid="monaco-mock" />,
}))

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test Session', model: 'gpt-4o',
    createdAt: 0, updatedAt: 0, messageCount: 0,
    parentId: null, agentStatus: 'idle', ...overrides,
  }
}

async function renderApp(sessions: Session[] = []) {
  await act(async () => { render(<App />) })
  // Bootstrap loads sessions via the mocked IPC bridge and parses them through a
  // schema expecting raw snake_case DB rows; seed the store directly post-mount instead.
  act(() => { useAppStore.getState().setSessions(sessions) })
}

function getRegisteredCallback<T extends (...args: never[]) => unknown>(mockFn: unknown): T {
  return (mockFn as ReturnType<typeof vi.fn>).mock.calls[0][0] as T
}

beforeEach(() => {
  useAppStore.setState({
    activeView: 'chat', terminalOpen: false, terminalKey: 0,
    tabs: [], activeTabId: null,
    sessions: [], messages: [], isLoading: false,
    workspacePath: null, fileNodes: [],
    settings: { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', themeId: 'red', systemPrompt: '', permissionMode: 'ask' },
  })
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sub-agent auto-delete on status change', () => {
  it('deletes a finished child session from disk after the cleanup delay', async () => {
    vi.useFakeTimers()
    await renderApp([mkSession({ id: 'child1', parentId: 'parent1', agentStatus: 'running' })])

    const onAgentStatus = getRegisteredCallback<(id: string, status: string) => void>(
      window.electron.pi.onAgentStatus
    )
    act(() => { onAgentStatus('child1', 'done') })

    expect(useAppStore.getState().sessions.find((s) => s.id === 'child1')?.agentStatus).toBe('done')

    act(() => { vi.advanceTimersByTime(3000) })

    expect(window.electron.db.deleteSession).toHaveBeenCalledWith('child1')
    expect(useAppStore.getState().sessions.find((s) => s.id === 'child1')).toBeUndefined()
  })

  it('does not delete a root (non-child) session when it finishes', async () => {
    vi.useFakeTimers()
    await renderApp([mkSession({ id: 'root1', parentId: null, agentStatus: 'running' })])

    const onAgentStatus = getRegisteredCallback<(id: string, status: string) => void>(
      window.electron.pi.onAgentStatus
    )
    act(() => { onAgentStatus('root1', 'done') })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(window.electron.db.deleteSession).not.toHaveBeenCalled()
    expect(useAppStore.getState().sessions.find((s) => s.id === 'root1')).toBeDefined()
  })

  it('does not delete a child session that resumed running before the timer fires', async () => {
    vi.useFakeTimers()
    await renderApp([mkSession({ id: 'child1', parentId: 'parent1', agentStatus: 'running' })])

    const onAgentStatus = getRegisteredCallback<(id: string, status: string) => void>(
      window.electron.pi.onAgentStatus
    )
    act(() => { onAgentStatus('child1', 'done') })
    act(() => { useAppStore.getState().updateSession('child1', { agentStatus: 'running' }) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(window.electron.db.deleteSession).not.toHaveBeenCalled()
    expect(useAppStore.getState().sessions.find((s) => s.id === 'child1')).toBeDefined()
  })

  it('deletes all child sessions immediately on session-complete, without waiting for a timer', async () => {
    await renderApp([
      mkSession({ id: 'child1', parentId: 'parent1', agentStatus: 'done' }),
      mkSession({ id: 'child2', parentId: 'parent1', agentStatus: 'done' }),
    ])

    const onSessionComplete = getRegisteredCallback<
      (parentId: string, title: string, summary: string, childIds: string[]) => void
    >(window.electron.pi.onSessionComplete)
    act(() => { onSessionComplete('parent1', 'Done', 'summary', ['child1', 'child2']) })

    expect(window.electron.db.deleteSession).toHaveBeenCalledWith('child1')
    expect(window.electron.db.deleteSession).toHaveBeenCalledWith('child2')
    expect(useAppStore.getState().sessions.find((s) => s.id === 'child1')).toBeUndefined()
    expect(useAppStore.getState().sessions.find((s) => s.id === 'child2')).toBeUndefined()
  })
})
