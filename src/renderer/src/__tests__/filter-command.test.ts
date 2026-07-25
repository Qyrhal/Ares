import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { AgentStatus } from '@/types'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test',
    model: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    pinned: false,
    archived: false,
    agentStatus: 'idle' as AgentStatus,
    ...overrides,
  }
}

describe('sessionFilter', () => {
  beforeEach(() => {
    useAppStore.setState({ sessionFilter: null })
  })

  it('starts as null', () => {
    expect(useAppStore.getState().sessionFilter).toBeNull()
  })

  it('setSessionFilter sets model filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'claude' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'model', value: 'claude' })
  })

  it('setSessionFilter sets status filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'status', value: 'running' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'status', value: 'running' })
  })

  it('setSessionFilter sets keyword filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'keyword', value: 'deploy' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'keyword', value: 'deploy' })
  })

  it('setSessionFilter(null) clears filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt' })
    useAppStore.getState().setSessionFilter(null)
    expect(useAppStore.getState().sessionFilter).toBeNull()
  })
})

describe('filter matching logic', () => {
  function matchesFilter(
    session: { model: string; agentStatus?: AgentStatus; title: string },
    filter: { type: 'model' | 'status' | 'keyword'; value: string } | null,
  ): boolean {
    if (!filter) return true
    if (filter.type === 'model') return session.model.toLowerCase().includes(filter.value.toLowerCase())
    if (filter.type === 'status') return session.agentStatus === filter.value
    return session.title.toLowerCase().includes(filter.value.toLowerCase())
  }

  it('model filter matches partial case-insensitive', () => {
    const s = mkSession({ model: 'claude-3-opus' })
    expect(matchesFilter(s, { type: 'model', value: 'claude' })).toBe(true)
    expect(matchesFilter(s, { type: 'model', value: 'CLAUDE' })).toBe(true)
    expect(matchesFilter(s, { type: 'model', value: 'gpt' })).toBe(false)
  })

  it('status filter matches exact agent status', () => {
    const running = mkSession({ agentStatus: 'running' })
    const done = mkSession({ agentStatus: 'done' })
    const filter = { type: 'status' as const, value: 'running' }
    expect(matchesFilter(running, filter)).toBe(true)
    expect(matchesFilter(done, filter)).toBe(false)
  })

  it('keyword filter matches title case-insensitive', () => {
    const s = mkSession({ title: 'Deploy Feature' })
    expect(matchesFilter(s, { type: 'keyword', value: 'deploy' })).toBe(true)
    expect(matchesFilter(s, { type: 'keyword', value: 'DEPLOY' })).toBe(true)
    expect(matchesFilter(s, { type: 'keyword', value: 'test' })).toBe(false)
  })

  it('null filter matches everything', () => {
    const s = mkSession()
    expect(matchesFilter(s, null)).toBe(true)
  })
})
