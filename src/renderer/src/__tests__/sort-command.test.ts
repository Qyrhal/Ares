import { describe, it, expect, beforeEach } from 'vitest'
import type { Session } from '@/types'
import { useAppStore } from '@/store/useAppStore'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    title: 'Test Session',
    model: 'gpt-4o',
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now(),
    messageCount: 5,
    pinned: false,
    archived: false,
    agentStatus: 'idle',
    ...overrides,
  }
}

function sortSessions(sessions: Session[], by: 'recent' | 'name' | 'duration' | 'messages', asc: boolean): Session[] {
  const comparator = (a: Session, b: Session): number => {
    switch (by) {
      case 'recent': return a.updatedAt - b.updatedAt
      case 'name': return a.title.localeCompare(b.title)
      case 'duration': return (a.updatedAt - a.createdAt) - (b.updatedAt - b.createdAt)
      case 'messages': return a.messageCount - b.messageCount
    }
  }
  const childrenOf = new Map<string, Session[]>()
  const roots: Session[] = []
  for (const s of sessions) {
    if (s.parentId && sessions.some((p) => p.id === s.parentId)) {
      const arr = childrenOf.get(s.parentId) ?? []
      arr.push(s)
      childrenOf.set(s.parentId, arr)
    } else {
      roots.push(s)
    }
  }
  roots.sort((a, b) => asc ? comparator(a, b) : comparator(b, a))
  return roots.flatMap((root) => [root, ...(childrenOf.get(root.id) ?? [])])
}

describe('/sort command logic', () => {
  beforeEach(() => {
    useAppStore.setState({ sessionSort: { by: 'recent', asc: false } })
  })

  it('defaults to recent descending', () => {
    const state = useAppStore.getState().sessionSort
    expect(state.by).toBe('recent')
    expect(state.asc).toBe(false)
  })

  it('setSessionSort updates sort state', () => {
    useAppStore.getState().setSessionSort({ by: 'name', asc: true })
    const state = useAppStore.getState().sessionSort
    expect(state.by).toBe('name')
    expect(state.asc).toBe(true)
  })

  it('sorts by recent (descending) — most recent first', () => {
    const sessions = [
      mkSession({ id: 's1', updatedAt: 100 }),
      mkSession({ id: 's2', updatedAt: 300 }),
      mkSession({ id: 's3', updatedAt: 200 }),
    ]
    const result = sortSessions(sessions, 'recent', false)
    expect(result.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })

  it('sorts by recent (ascending)', () => {
    const sessions = [
      mkSession({ id: 's1', updatedAt: 100 }),
      mkSession({ id: 's2', updatedAt: 300 }),
      mkSession({ id: 's3', updatedAt: 200 }),
    ]
    const result = sortSessions(sessions, 'recent', true)
    expect(result.map((s) => s.id)).toEqual(['s1', 's3', 's2'])
  })

  it('sorts by name (A-Z)', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Charlie' }),
      mkSession({ id: 's2', title: 'Alice' }),
      mkSession({ id: 's3', title: 'Bob' }),
    ]
    const result = sortSessions(sessions, 'name', true)
    expect(result.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })

  it('sorts by name (Z-A)', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Charlie' }),
      mkSession({ id: 's2', title: 'Alice' }),
      mkSession({ id: 's3', title: 'Bob' }),
    ]
    const result = sortSessions(sessions, 'name', false)
    expect(result.map((s) => s.id)).toEqual(['s1', 's3', 's2'])
  })

  it('sorts by duration (longest first)', () => {
    const sessions = [
      mkSession({ id: 's1', createdAt: 0, updatedAt: 100 }),   // duration 100
      mkSession({ id: 's2', createdAt: 0, updatedAt: 300 }),   // duration 300
      mkSession({ id: 's3', createdAt: 0, updatedAt: 200 }),   // duration 200
    ]
    const result = sortSessions(sessions, 'duration', false)
    expect(result.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })

  it('sorts by messages (most first)', () => {
    const sessions = [
      mkSession({ id: 's1', messageCount: 3 }),
      mkSession({ id: 's2', messageCount: 10 }),
      mkSession({ id: 's3', messageCount: 7 }),
    ]
    const result = sortSessions(sessions, 'messages', false)
    expect(result.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })

  it('keeps children with their parent after sorting', () => {
    const sessions = [
      mkSession({ id: 'p1', title: 'Parent', updatedAt: 100 }),
      mkSession({ id: 'c1', title: 'Child', parentId: 'p1', updatedAt: 200 }),
      mkSession({ id: 'p2', title: 'Other Parent', updatedAt: 300 }),
    ]
    const result = sortSessions(sessions, 'recent', false)
    expect(result.map((s) => s.id)).toEqual(['p2', 'p1', 'c1'])
  })

  it('sorts parents while keeping children grouped', () => {
    const sessions = [
      mkSession({ id: 'p1', title: 'B-Parent', updatedAt: 100 }),
      mkSession({ id: 'c1', title: 'Child1', parentId: 'p1', updatedAt: 50 }),
      mkSession({ id: 'p2', title: 'A-Parent', updatedAt: 200 }),
      mkSession({ id: 'c2', title: 'Child2', parentId: 'p2', updatedAt: 150 }),
    ]
    const result = sortSessions(sessions, 'name', true)
    expect(result.map((s) => s.id)).toEqual(['p2', 'c2', 'p1', 'c1'])
  })

  it('sorts empty list without error', () => {
    const result = sortSessions([], 'recent', false)
    expect(result).toEqual([])
  })

  it('sorts single session without error', () => {
    const result = sortSessions([mkSession({ id: 's1' })], 'name', true)
    expect(result).toHaveLength(1)
  })
})
