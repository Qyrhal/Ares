import { describe, it, expect, beforeEach } from 'vitest'
import type { Session, AgentStatus } from '@/types'

describe('/sessions slash command logic', () => {
  beforeEach(() => { /* no-op */ })

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
      agentStatus: 'idle' as AgentStatus,
      ...overrides,
    } as Session
  }

  function filterSessions(sessions: Session[], flag: string): Session[] {
    if (flag === '--pinned' || flag === 'pinned') {
      return sessions.filter((s) => s.pinned)
    }
    if (flag === '--archived' || flag === 'archived') {
      return sessions.filter((s) => s.archived)
    }
    if (flag === '--running' || flag === 'running') {
      return sessions.filter((s) => s.agentStatus === 'running')
    }
    return [...sessions]
  }

  function sortSessions(sessions: Session[]): Session[] {
    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  function formatDuration(ms: number): string {
    const sec = Math.floor((Date.now() - ms) / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m`
    return `${Math.floor(min / 60)}h ${min % 60}m`
  }

  function formatSessionLine(s: Session): string {
    const parts = [s.model || 'no model', `${s.messageCount} msgs`, formatDuration(s.createdAt)]
    if (s.pinned) parts.push('📌')
    if (s.archived) parts.push('📦')
    return `**${s.title || 'Untitled'}** — ${parts.join(' · ')}`
  }

  it('returns all sessions when no flag is provided', () => {
    const sessions = [mkSession({ id: 's1' }), mkSession({ id: 's2' })]
    const result = filterSessions(sessions, '')
    expect(result).toHaveLength(2)
  })

  it('filters pinned sessions', () => {
    const sessions = [
      mkSession({ id: 's1', pinned: true }),
      mkSession({ id: 's2', pinned: false }),
    ]
    const result = filterSessions(sessions, '--pinned')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('filters archived sessions', () => {
    const sessions = [
      mkSession({ id: 's1', archived: true }),
      mkSession({ id: 's2', archived: false }),
    ]
    const result = filterSessions(sessions, '--archived')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('filters running sessions', () => {
    const sessions = [
      mkSession({ id: 's1', agentStatus: 'running' as AgentStatus }),
      mkSession({ id: 's2', agentStatus: 'idle' as AgentStatus }),
    ]
    const result = filterSessions(sessions, '--running')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('sorts by updatedAt descending', () => {
    const sessions = [
      mkSession({ id: 's1', updatedAt: 100 }),
      mkSession({ id: 's2', updatedAt: 300 }),
      mkSession({ id: 's3', updatedAt: 200 }),
    ]
    const sorted = sortSessions(sessions)
    expect(sorted.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })

  it('formats session line with model and message count', () => {
    const s = mkSession({ title: 'My Project', model: 'claude-3', messageCount: 12 })
    const line = formatSessionLine(s)
    expect(line).toContain('My Project')
    expect(line).toContain('claude-3')
    expect(line).toContain('12 msgs')
  })

  it('shows pinned icon for pinned sessions', () => {
    const s = mkSession({ pinned: true })
    const line = formatSessionLine(s)
    expect(line).toContain('📌')
  })

  it('shows archived icon for archived sessions', () => {
    const s = mkSession({ archived: true })
    const line = formatSessionLine(s)
    expect(line).toContain('📦')
  })

  it('formats duration in minutes', () => {
    const fiveMinAgo = Date.now() - 5 * 60_000
    const result = formatDuration(fiveMinAgo)
    expect(result).toBe('5m')
  })

  it('formats duration in hours and minutes', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000
    const result = formatDuration(twoHoursAgo)
    expect(result).toBe('2h 0m')
  })

  it('formats duration in seconds for recent sessions', () => {
    const thirtySecAgo = Date.now() - 30_000
    const result = formatDuration(thirtySecAgo)
    expect(result).toBe('30s')
  })

  it('returns empty array when filter matches nothing', () => {
    const sessions = [mkSession({ pinned: false })]
    const result = filterSessions(sessions, '--pinned')
    expect(result).toHaveLength(0)
  })
})
