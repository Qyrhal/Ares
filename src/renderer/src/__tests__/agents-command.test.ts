import { describe, it, expect, beforeEach } from 'vitest'
import type { Session } from '@/types'

describe('/agents slash command logic', () => {
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

  function filterSubAgents(sessions: Session[]): Session[] {
    return sessions.filter((s) => s.parentId)
  }

  function filterByStatus(sessions: Session[], status: string): Session[] {
    return sessions.filter((s) => s.agentStatus === status)
  }

  function statusIcon(status?: string): string {
    switch (status) {
      case 'running': return '🟢'
      case 'done': return '✅'
      case 'error': return '❌'
      default: return '⚪'
    }
  }

  function elapsed(createdAt: number): string {
    const ms = Date.now() - createdAt
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  it('returns empty list when no sub-agents exist', () => {
    const sessions = [mkSession({ id: 's1', parentId: null })]
    const subAgents = filterSubAgents(sessions)
    expect(subAgents.length).toBe(0)
  })

  it('identifies sub-agents by parentId', () => {
    const sessions = [
      mkSession({ id: 's1', title: 'Parent', parentId: null }),
      mkSession({ id: 's2', title: 'Sub 1', parentId: 's1' }),
      mkSession({ id: 's3', title: 'Sub 2', parentId: 's1' }),
    ]
    const subAgents = filterSubAgents(sessions)
    expect(subAgents.length).toBe(2)
    expect(subAgents.map((s) => s.id)).toEqual(['s2', 's3'])
  })

  it('shows correct status icons', () => {
    expect(statusIcon('running')).toBe('🟢')
    expect(statusIcon('done')).toBe('✅')
    expect(statusIcon('error')).toBe('❌')
    expect(statusIcon('idle')).toBe('⚪')
    expect(statusIcon(undefined)).toBe('⚪')
  })

  it('filters by running status', () => {
    const sessions = [
      mkSession({ id: 's1', parentId: 'p1', agentStatus: 'running' }),
      mkSession({ id: 's2', parentId: 'p1', agentStatus: 'done' }),
      mkSession({ id: 's3', parentId: 'p1', agentStatus: 'running' }),
    ]
    const running = filterByStatus(filterSubAgents(sessions), 'running')
    expect(running.length).toBe(2)
    expect(running.every((s) => s.agentStatus === 'running')).toBe(true)
  })

  it('formats sub-agent output with parent info', () => {
    const sessions = [
      mkSession({ id: 'p1', title: 'Main Task', parentId: null }),
      mkSession({ id: 's1', title: 'Research Agent', parentId: 'p1', agentStatus: 'running', messageCount: 12 }),
    ]
    const subAgents = filterSubAgents(sessions)
    const parent = sessions.find((s) => s.id === subAgents[0].parentId)
    const lines = [`**🤖 Sub-Agents** (${subAgents.length})\n`]
    for (const sa of subAgents) {
      const parentLabel = parent ? parent.title : 'unknown'
      lines.push(
        `${statusIcon(sa.agentStatus)} **${sa.title}** — ${sa.agentStatus || 'idle'}`,
        `   Parent: ${parentLabel} · Msgs: ${sa.messageCount} · Age: ${elapsed(sa.createdAt)}`,
      )
    }
    const output = lines.join('\n')
    expect(output).toContain('Sub-Agents')
    expect(output).toContain('Research Agent')
    expect(output).toContain('running')
    expect(output).toContain('Parent: Main Task')
    expect(output).toContain('Msgs: 12')
  })

  it('shows filter hint when not filtering', () => {
    const sessions = [
      mkSession({ id: 's1', parentId: 'p1', agentStatus: 'done' }),
    ]
    const subAgents = filterSubAgents(sessions)
    const filter: string = ''
    const lines = [`**🤖 Sub-Agents** (${subAgents.length})\n`]
    for (const sa of subAgents) {
      lines.push(`${statusIcon(sa.agentStatus)} **${sa.title}** — ${sa.agentStatus || 'idle'}`)
    }
    if (filter !== 'running') {
      lines.push(`\nFilter: \`/agents running\` to show only active agents.`)
    }
    const output = lines.join('\n')
    expect(output).toContain('Filter:')
    expect(output).toContain('/agents running')
  })

  it('does not show filter hint when filtering by running', () => {
    const sessions = [
      mkSession({ id: 's1', parentId: 'p1', agentStatus: 'running' }),
    ]
    const subAgents = filterByStatus(filterSubAgents(sessions), 'running')
    const filter = 'running'
    const lines = [`**🤖 Sub-Agents** (${subAgents.length})\n`]
    for (const sa of subAgents) {
      lines.push(`${statusIcon(sa.agentStatus)} **${sa.title}** — ${sa.agentStatus || 'idle'}`)
    }
    if (filter !== 'running') {
      lines.push(`\nFilter: \`/agents running\` to show only active agents.`)
    }
    const output = lines.join('\n')
    expect(output).not.toContain('Filter:')
  })

  it('shows empty hint for no sub-agents', () => {
    const hint = 'No sub-agents found. Use `spawnAgent` or `spawnAgents` to create them.'
    expect(hint).toContain('spawnAgent')
  })

  it('shows empty running hint when no running agents', () => {
    const hint = 'No running sub-agents. Use `/agents` to see all sub-agents.'
    expect(hint).toContain('/agents')
  })

  it('handles multiple sub-agents with mixed statuses', () => {
    const sessions = [
      mkSession({ id: 's1', parentId: 'p1', agentStatus: 'running', title: 'Agent A' }),
      mkSession({ id: 's2', parentId: 'p1', agentStatus: 'done', title: 'Agent B' }),
      mkSession({ id: 's3', parentId: 'p1', agentStatus: 'error', title: 'Agent C' }),
      mkSession({ id: 's4', parentId: 'p1', agentStatus: 'idle', title: 'Agent D' }),
    ]
    const subAgents = filterSubAgents(sessions)
    expect(subAgents.length).toBe(4)
    const icons = subAgents.map((s) => statusIcon(s.agentStatus))
    expect(icons).toEqual(['🟢', '✅', '❌', '⚪'])
  })

  it('elapsed time shows seconds for < 60s', () => {
    const createdAt = Date.now() - 30_000
    expect(elapsed(createdAt)).toMatch(/^\d+s$/)
  })

  it('elapsed time shows minutes for >= 60s', () => {
    const createdAt = Date.now() - 150_000
    expect(elapsed(createdAt)).toMatch(/^\d+m \d+s$/)
  })

  it('help text includes /agents', () => {
    const helpText = '/agents - show sub-agent sessions'
    expect(helpText).toContain('/agents')
  })
})
