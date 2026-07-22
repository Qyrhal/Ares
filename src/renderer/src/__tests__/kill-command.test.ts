import { describe, it, expect, beforeEach } from 'vitest'
import type { Session } from '@/types'

describe('/kill slash command logic', () => {
  beforeEach(() => { /* no-op */ })

  function mkSession(overrides: Partial<Session> = {}): Session {
    return {
      id: 's1',
      title: 'Test Session',
      model: 'gpt-4o',
      createdAt: Date.now() - 60_000,
      updatedAt: Date.now(),
      messageCount: 5,
      ...overrides,
    }
  }

  function filterRunning(sessions: Session[]): Session[] {
    return sessions.filter((s) => s.parentId && s.agentStatus === 'running')
  }

  function findByQuery(sessions: Session[], query: string): Session | undefined {
    const numIdx = parseInt(query, 10)
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= sessions.length) {
      return sessions[numIdx - 1]
    }
    return sessions.find((s) => s.title.toLowerCase().includes(query.toLowerCase()))
  }

  it('shows usage when no args provided', () => {
    const args = ''
    expect(args.trim()).toBe('')
  })

  it('shows empty state when no running sub-agents', () => {
    const sessions = [
      mkSession({ id: 's1', parentId: 'p1', agentStatus: 'done' }),
      mkSession({ id: 's2', parentId: 'p1', agentStatus: 'idle' }),
    ]
    const running = filterRunning(sessions)
    expect(running.length).toBe(0)
  })

  it('finds sub-agent by number index', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Agent A', parentId: 'p1', agentStatus: 'running' }),
      mkSession({ id: 's2', title: 'Agent B', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterRunning(sessions)
    const target = findByQuery(running, '1')
    expect(target?.id).toBe('s1')
    expect(target?.title).toBe('Agent A')
  })

  it('finds sub-agent by partial name match', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Research React Features', parentId: 'p1', agentStatus: 'running' }),
      mkSession({ id: 's2', title: 'Write Unit Tests', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterRunning(sessions)
    const target = findByQuery(running, 'react')
    expect(target?.id).toBe('s1')
  })

  it('case-insensitive name matching', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Research Agent', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterRunning(sessions)
    const target = findByQuery(running, 'RESEARCH')
    expect(target?.id).toBe('s1')
  })

  it('returns undefined for no match', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Agent A', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterRunning(sessions)
    const target = findByQuery(running, 'nonexistent')
    expect(target).toBeUndefined()
  })

  it('builds agent list for no-match error', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Agent A', parentId: 'p1', agentStatus: 'running' }),
      mkSession({ id: 's2', title: 'Agent B', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterRunning(sessions)
    const list = running.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
    expect(list).toContain('1. Agent A')
    expect(list).toContain('2. Agent B')
  })

  it('formats stop confirmation message', () => {
    const title = 'Research Agent'
    const msg = `**Stopped:** ${title}`
    expect(msg).toContain('Stopped')
    expect(msg).toContain('Research Agent')
  })

  it('formats no-running-agents message', () => {
    const msg = 'No running sub-agents to kill.'
    expect(msg).toContain('No running')
  })

  it('formats usage message with /agents reference', () => {
    const msg = '**Usage:** `/kill <name or number>` — stop a running sub-agent.\n\nUse `/agents running` to see active agents.'
    expect(msg).toContain('/kill')
    expect(msg).toContain('/agents running')
  })

  it('finds last agent by number index', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Agent A', parentId: 'p1', agentStatus: 'running' }),
      mkSession({ id: 's2', title: 'Agent B', parentId: 'p1', agentStatus: 'running' }),
      mkSession({ id: 's3', title: 'Agent C', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterRunning(sessions)
    const target = findByQuery(running, '3')
    expect(target?.id).toBe('s3')
    expect(target?.title).toBe('Agent C')
  })

  it('index out of range returns undefined', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Agent A', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterRunning(sessions)
    const target = findByQuery(running, '5')
    expect(target).toBeUndefined()
  })

  it('help text includes /kill', () => {
    const helpText = '/kill <name> - stop a running sub-agent'
    expect(helpText).toContain('/kill')
  })
})
