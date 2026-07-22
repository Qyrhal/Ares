import { describe, it, expect } from 'vitest'

// ── /stats command logic ─────────────────────────────────────────────────────

describe('/stats slash command logic', () => {
  type Msg = { role: string; content: string; toolName?: string; createdAt: number }

  function computeStats(msgs: Msg[]) {
    const roleCounts: Record<string, number> = {}
    let totalChars = 0
    let toolCalls = 0
    const toolNames: Record<string, number> = {}
    const hourlyActivity: Record<number, number> = {}
    let earliest = Infinity
    let latest = 0

    for (const m of msgs) {
      roleCounts[m.role] = (roleCounts[m.role] || 0) + 1
      totalChars += m.content.length
      if (m.toolName) {
        toolCalls++
        toolNames[m.toolName] = (toolNames[m.toolName] || 0) + 1
      }
      const hour = new Date(m.createdAt).getHours()
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1
      if (m.createdAt < earliest) earliest = m.createdAt
      if (m.createdAt > latest) latest = m.createdAt
    }

    const avgMsgLength = Math.round(totalChars / msgs.length)
    const durationMs = latest - earliest
    const durationMin = Math.round(durationMs / 60000)
    const msgsPerMin = durationMin > 0 ? (msgs.length / durationMin).toFixed(1) : '∞'
    const peakHour = Object.entries(hourlyActivity).sort(([, a], [, b]) => b - a)[0]

    return {
      totalMessages: msgs.length,
      roleCounts,
      totalChars,
      avgMsgLength,
      durationMin,
      msgsPerMin,
      toolCalls,
      toolNames,
      peakHour: peakHour ? { hour: peakHour[0], count: peakHour[1] } : undefined,
    }
  }

  it('computes basic message stats', () => {
    const now = Date.now()
    const msgs: Msg[] = [
      { role: 'user', content: 'Hello', createdAt: now },
      { role: 'assistant', content: 'Hi there! How can I help?', createdAt: now + 1000 },
    ]
    const stats = computeStats(msgs)
    expect(stats.totalMessages).toBe(2)
    expect(stats.roleCounts.user).toBe(1)
    expect(stats.roleCounts.assistant).toBe(1)
    expect(stats.totalChars).toBe(30)
  })

  it('computes average message length', () => {
    const now = Date.now()
    const msgs: Msg[] = [
      { role: 'user', content: 'ab', createdAt: now },
      { role: 'assistant', content: 'abcd', createdAt: now + 1000 },
    ]
    const stats = computeStats(msgs)
    expect(stats.avgMsgLength).toBe(3) // (2 + 4) / 2 = 3
  })

  it('counts tool calls', () => {
    const now = Date.now()
    const msgs: Msg[] = [
      { role: 'user', content: 'Run it', createdAt: now },
      { role: 'tool', content: 'result', toolName: 'terminal', createdAt: now + 1000 },
      { role: 'tool', content: 'result2', toolName: 'terminal', createdAt: now + 2000 },
      { role: 'tool', content: 'result3', toolName: 'read_file', createdAt: now + 3000 },
    ]
    const stats = computeStats(msgs)
    expect(stats.toolCalls).toBe(3)
    expect(stats.toolNames.terminal).toBe(2)
    expect(stats.toolNames.read_file).toBe(1)
  })

  it('computes session duration', () => {
    const now = Date.now()
    const msgs: Msg[] = [
      { role: 'user', content: 'Start', createdAt: now },
      { role: 'assistant', content: 'End', createdAt: now + 300000 }, // 5 minutes
    ]
    const stats = computeStats(msgs)
    expect(stats.durationMin).toBe(5)
  })

  it('handles empty messages', () => {
    const msgs: Msg[] = []
    const stats = computeStats(msgs)
    expect(stats.totalMessages).toBe(0)
    expect(stats.totalChars).toBe(0)
  })

  it('finds peak activity hour', () => {
    const base = new Date(2026, 0, 1, 14, 0, 0).getTime() // 2pm
    const msgs: Msg[] = [
      { role: 'user', content: 'A', createdAt: base },
      { role: 'assistant', content: 'B', createdAt: base + 1000 },
      { role: 'user', content: 'C', createdAt: base + 2000 },
    ]
    const stats = computeStats(msgs)
    expect(stats.peakHour).toBeDefined()
    expect(stats.peakHour!.hour).toBe('14')
    expect(stats.peakHour!.count).toBe(3)
  })

  it('shows ∞ for zero-duration sessions', () => {
    const now = Date.now()
    const msgs: Msg[] = [
      { role: 'user', content: 'Test', createdAt: now },
      { role: 'assistant', content: 'Reply', createdAt: now },
    ]
    const stats = computeStats(msgs)
    expect(stats.msgsPerMin).toBe('∞')
  })

  it('formats result header correctly', () => {
    const now = Date.now()
    const msgs: Msg[] = [
      { role: 'user', content: 'Hello', createdAt: now },
      { role: 'assistant', content: 'Hi', createdAt: now + 1000 },
    ]
    const stats = computeStats(msgs)
    const lines: string[] = ['**Session Statistics**\n']
    lines.push(`**Total messages:** ${stats.totalMessages}`)
    const roleParts = Object.entries(stats.roleCounts).map(([r, c]) => `${r}: ${c}`)
    lines.push(`**By role:** ${roleParts.join(', ')}`)
    lines.push(`**Total characters:** ${stats.totalChars.toLocaleString()}`)
    lines.push(`**Avg message length:** ${stats.avgMsgLength.toLocaleString()} chars`)
    const text = lines.join('\n')
    expect(text).toContain('**Total messages:** 2')
    expect(text).toContain('**By role:** user: 1, assistant: 1')
    expect(text).toContain('**Total characters:** 7')
    expect(text).toContain('**Avg message length:** 4 chars')
  })
})
