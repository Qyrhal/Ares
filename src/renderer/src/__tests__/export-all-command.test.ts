import { describe, it, expect } from 'vitest'

// ── /export-all command logic ────────────────────────────────────────────────

describe('/export-all slash command logic', () => {
  type Session = { id: string; title: string; createdAt: number; model: string; notes: string }
  type Msg = { role: string; content: string; toolName?: string }

  function buildExport(sessions: Session[], allMsgs: Record<string, Msg[]>) {
    const exportLines: string[] = []
    exportLines.push('# Ares — All Sessions Export')
    exportLines.push('')
    exportLines.push(`*Exported ${new Date().toISOString().slice(0, 10)} · ${sessions.length} sessions*`)
    exportLines.push('')
    exportLines.push('---')
    exportLines.push('')

    let totalMessages = 0
    for (const s of sessions) {
      const msgs = allMsgs[s.id] || []
      totalMessages += msgs.length
      exportLines.push(`## ${s.title || 'Untitled Session'}`)
      exportLines.push('')
      exportLines.push(`*Created: ${new Date(s.createdAt).toLocaleString()} · Messages: ${msgs.length} · Model: ${s.model || 'default'}${s.notes ? ' · Notes: ' + s.notes : ''}*`)
      exportLines.push('')
      for (const m of msgs) {
        const role = m.role === 'assistant' ? '**Assistant**' : m.role === 'user' ? '**User**' : m.role === 'system' ? '*System*' : `*${m.role}*`
        exportLines.push(`### ${role}`)
        exportLines.push('')
        exportLines.push(m.content)
        if (m.toolName) {
          exportLines.push('')
          exportLines.push(`*Tool: \`${m.toolName}\`*`)
        }
        exportLines.push('')
        exportLines.push('---')
        exportLines.push('')
      }
    }
    return { md: exportLines.join('\n'), totalMessages }
  }

  it('exports single session with messages', () => {
    const sessions: Session[] = [
      { id: '1', title: 'Test Session', createdAt: Date.now(), model: 'gpt-4o', notes: '' },
    ]
    const allMsgs: Record<string, Msg[]> = {
      '1': [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
    }
    const { md, totalMessages } = buildExport(sessions, allMsgs)
    expect(md).toContain('# Ares — All Sessions Export')
    expect(md).toContain('## Test Session')
    expect(md).toContain('**User**')
    expect(md).toContain('**Assistant**')
    expect(totalMessages).toBe(2)
  })

  it('exports multiple sessions', () => {
    const sessions: Session[] = [
      { id: '1', title: 'Session A', createdAt: Date.now(), model: 'gpt-4o', notes: '' },
      { id: '2', title: 'Session B', createdAt: Date.now(), model: 'claude', notes: '' },
    ]
    const allMsgs: Record<string, Msg[]> = {
      '1': [{ role: 'user', content: 'Q1' }],
      '2': [{ role: 'user', content: 'Q2' }, { role: 'assistant', content: 'A2' }],
    }
    const { md, totalMessages } = buildExport(sessions, allMsgs)
    expect(md).toContain('## Session A')
    expect(md).toContain('## Session B')
    expect(totalMessages).toBe(3)
  })

  it('handles empty sessions list', () => {
    const { md, totalMessages } = buildExport([], {})
    expect(md).toContain('0 sessions')
    expect(totalMessages).toBe(0)
  })

  it('includes session notes when present', () => {
    const sessions: Session[] = [
      { id: '1', title: 'Noted', createdAt: Date.now(), model: 'gpt-4o', notes: 'Important session' },
    ]
    const allMsgs: Record<string, Msg[]> = { '1': [] }
    const { md } = buildExport(sessions, allMsgs)
    expect(md).toContain('Notes: Important session')
  })

  it('includes tool names in export', () => {
    const sessions: Session[] = [
      { id: '1', title: 'Tools', createdAt: Date.now(), model: 'gpt-4o', notes: '' },
    ]
    const allMsgs: Record<string, Msg[]> = {
      '1': [{ role: 'tool', content: 'result', toolName: 'read_file' }],
    }
    const { md } = buildExport(sessions, allMsgs)
    expect(md).toContain('Tool: `read_file`')
  })

  it('shows session count in header', () => {
    const sessions: Session[] = [
      { id: '1', title: 'A', createdAt: Date.now(), model: '', notes: '' },
      { id: '2', title: 'B', createdAt: Date.now(), model: '', notes: '' },
      { id: '3', title: 'C', createdAt: Date.now(), model: '', notes: '' },
    ]
    const { md } = buildExport(sessions, {})
    expect(md).toContain('3 sessions')
  })

  it('handles sessions with no messages', () => {
    const sessions: Session[] = [
      { id: '1', title: 'Empty', createdAt: Date.now(), model: 'gpt-4o', notes: '' },
    ]
    const { md, totalMessages } = buildExport(sessions, { '1': [] })
    expect(md).toContain('Messages: 0')
    expect(totalMessages).toBe(0)
  })

  it('uses default title for untitled sessions', () => {
    const sessions: Session[] = [
      { id: '1', title: '', createdAt: Date.now(), model: '', notes: '' },
    ]
    const { md } = buildExport(sessions, { '1': [] })
    expect(md).toContain('## Untitled Session')
  })
})
