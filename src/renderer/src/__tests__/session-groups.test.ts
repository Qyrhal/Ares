import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test', model: 'gpt-4o',
    createdAt: 0, updatedAt: 0, messageCount: 0, ...overrides,
  }
}

beforeEach(() => {
  useAppStore.setState({
    sessions: [],
    messages: [],
    todos: [],
    tabs: [],
    activeTabId: null,
    activeView: 'chat',
    sessionGroups: [],
  })
})

// ── addSessionGroup ───────────────────────────────────────────────────────────

describe('store — addSessionGroup', () => {
  it('adds a new group with the given name', () => {
    const id = useAppStore.getState().addSessionGroup('Research')
    const groups = useAppStore.getState().sessionGroups
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe(id)
    expect(groups[0].name).toBe('Research')
    expect(groups[0].createdAt).toBeGreaterThan(0)
  })

  it('returns the new group id', () => {
    const id1 = useAppStore.getState().addSessionGroup('A')
    const id2 = useAppStore.getState().addSessionGroup('B')
    expect(id1).not.toBe(id2)
  })

  it('preserves existing groups', () => {
    useAppStore.getState().addSessionGroup('A')
    useAppStore.getState().addSessionGroup('B')
    expect(useAppStore.getState().sessionGroups).toHaveLength(2)
  })
})

// ── renameSessionGroup ────────────────────────────────────────────────────────

describe('store — renameSessionGroup', () => {
  it('renames an existing group', () => {
    const id = useAppStore.getState().addSessionGroup('Old')
    useAppStore.getState().renameSessionGroup(id, 'New')
    const group = useAppStore.getState().sessionGroups.find((g) => g.id === id)
    expect(group?.name).toBe('New')
  })

  it('preserves other groups when renaming one', () => {
    const id1 = useAppStore.getState().addSessionGroup('A')
    useAppStore.getState().addSessionGroup('B')
    useAppStore.getState().renameSessionGroup(id1, 'Renamed')
    const names = useAppStore.getState().sessionGroups.map((g) => g.name)
    expect(names).toEqual(['Renamed', 'B'])
  })

  it('is a no-op for non-existent group id', () => {
    useAppStore.getState().renameSessionGroup('nonexistent', 'X')
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })
})

// ── removeSessionGroup ────────────────────────────────────────────────────────

describe('store — removeSessionGroup', () => {
  it('removes a group', () => {
    const id = useAppStore.getState().addSessionGroup('ToRemove')
    useAppStore.getState().removeSessionGroup(id)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })

  it('clears group field on sessions that belonged to it', () => {
    const id = useAppStore.getState().addSessionGroup('G')
    useAppStore.getState().setSessions([
      mkSession({ id: 's1', group: id }),
      mkSession({ id: 's2', group: id }),
      mkSession({ id: 's3' }),
    ])
    useAppStore.getState().removeSessionGroup(id)
    const sessions = useAppStore.getState().sessions
    expect(sessions.find((s) => s.id === 's1')?.group).toBeUndefined()
    expect(sessions.find((s) => s.id === 's2')?.group).toBeUndefined()
    expect(sessions.find((s) => s.id === 's3')?.group).toBeUndefined()
  })

  it('preserves other groups', () => {
    const id1 = useAppStore.getState().addSessionGroup('Keep')
    useAppStore.getState().addSessionGroup('Remove')
    const groups = useAppStore.getState().sessionGroups
    const removeId = groups.find((g) => g.name === 'Remove')!.id
    useAppStore.getState().removeSessionGroup(removeId)
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
    expect(useAppStore.getState().sessionGroups[0].id).toBe(id1)
  })

  it('is a no-op for non-existent group id', () => {
    useAppStore.getState().addSessionGroup('G')
    useAppStore.getState().removeSessionGroup('nonexistent')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
  })
})

// ── setSessionGroup ───────────────────────────────────────────────────────────

describe('store — setSessionGroup', () => {
  it('assigns a session to a group', () => {
    const gid = useAppStore.getState().addSessionGroup('Research')
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    useAppStore.getState().setSessionGroup('s1', gid)
    expect(useAppStore.getState().sessions[0].group).toBe(gid)
  })

  it('removes a session from its group when passed null', () => {
    const gid = useAppStore.getState().addSessionGroup('Research')
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid })])
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })

  it('moves a session between groups', () => {
    const gid1 = useAppStore.getState().addSessionGroup('A')
    const gid2 = useAppStore.getState().addSessionGroup('B')
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid1 })])
    useAppStore.getState().setSessionGroup('s1', gid2)
    expect(useAppStore.getState().sessions[0].group).toBe(gid2)
  })

  it('is a no-op for non-existent session', () => {
    const gid = useAppStore.getState().addSessionGroup('G')
    useAppStore.getState().setSessions([mkSession({ id: 's1' })])
    useAppStore.getState().setSessionGroup('nonexistent', gid)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })
})

// ── Groups with session lifecycle ─────────────────────────────────────────────

describe('store — groups with session lifecycle', () => {
  it('sessions retain group assignment after store reset if re-added', () => {
    const gid = useAppStore.getState().addSessionGroup('G')
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid })])
    // Simulate a re-load
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid })])
    expect(useAppStore.getState().sessions[0].group).toBe(gid)
  })

  it('allows multiple sessions in the same group', () => {
    const gid = useAppStore.getState().addSessionGroup('G')
    useAppStore.getState().setSessions([
      mkSession({ id: 's1', group: gid }),
      mkSession({ id: 's2', group: gid }),
      mkSession({ id: 's3', group: gid }),
    ])
    const inGroup = useAppStore.getState().sessions.filter((s) => s.group === gid)
    expect(inGroup).toHaveLength(3)
  })

  it('updating a session preserves its group assignment', () => {
    const gid = useAppStore.getState().addSessionGroup('G')
    useAppStore.getState().setSessions([mkSession({ id: 's1', group: gid })])
    useAppStore.getState().updateSession('s1', { title: 'Updated' })
    expect(useAppStore.getState().sessions[0].group).toBe(gid)
  })
})
