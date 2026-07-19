import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Message } from '@/types'

// ── helpers extracted from App.tsx command handler logic ─────────────────

interface GitStatus {
  hasRepo: boolean
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: { path: string; status: string }[]
  unstaged: { path: string; status: string }[]
  untracked: { path: string }[]
}

/**
 * Simulates the /changes command dispatch logic from App.tsx.
 * Pure function — no React, no DOM.
 */
async function handleChanges(
  workspacePath: string | null,
  gitStatusFn: (cwd: string) => Promise<GitStatus>,
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  const lines: string[] = ['**Workspace Changes**\n']

  if (!workspacePath) {
    lines.push('No workspace folder is open.')
  } else {
    try {
      const status = await gitStatusFn(workspacePath)
      if (!status.hasRepo) {
        lines.push('Not a git repository (or no git history).')
      } else {
        lines.push(`**Branch:** \`${status.branch || '(detached)'}\``)
        if (status.upstream) {
          lines.push(`**Remote:** \`${status.upstream}\``)
          if (status.ahead > 0 || status.behind > 0) {
            lines.push(`**Sync:** ${status.ahead} ahead · ${status.behind} behind`)
          }
        }
        lines.push('')
        if (status.staged.length > 0) {
          lines.push(`**Staged** (${status.staged.length} files)`)
          for (const f of status.staged) {
            lines.push(`  \`${f.path}\` — ${f.status}`)
          }
          lines.push('')
        }
        if (status.unstaged.length > 0) {
          lines.push(`**Unstaged changes** (${status.unstaged.length} files)`)
          for (const f of status.unstaged) {
            lines.push(`  \`${f.path}\` — ${f.status}`)
          }
          lines.push('')
        }
        if (status.untracked.length > 0) {
          lines.push(`**Untracked** (${status.untracked.length} files)`)
          for (const f of status.untracked) {
            lines.push(`  \`${f.path}\``)
          }
        }
        if (status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0) {
          lines.push('Working tree clean — no changes.')
        }
      }
    } catch (err) {
      lines.push(`**Error:** ${(err as Error).message}`)
    }
  }
  pushMsg(lines.join('\n'))
  return results
}

/**
 * Simulates the /export command dispatch logic from App.tsx.
 * Returns the markdown content and a download filename.
 */
async function handleExport(
  title: string,
  model: string,
  msgs: Partial<Message>[],
): Promise<{ kind: 'msg'; content: string }[] | { kind: 'download'; md: string; filename: string }> {
  const results: { kind: 'msg'; content: string }[] = []

  if (msgs.length === 0) {
    results.push({ kind: 'msg', content: 'No messages in this session to export.' })
    return results
  }

  const exportLines: string[] = []
  exportLines.push(`# ${title || 'Untitled Session'}`)
  exportLines.push('')
  exportLines.push(`*Exported ${new Date().toISOString().slice(0, 10)} · ${msgs.length} messages · Model: ${model || 'default'}*`)
  exportLines.push('')
  exportLines.push('---')
  exportLines.push('')

  for (const m of msgs) {
    const role = m.role === 'assistant' ? '**Assistant**' : m.role === 'user' ? '**User**' : m.role === 'system' ? '*System*' : `*${m.role}*`
    exportLines.push(`### ${role}`)
    exportLines.push('')
    exportLines.push(m.content || '')
    if (m.toolName) {
      exportLines.push('')
      exportLines.push(`*Tool: \`${m.toolName}\`*`)
    }
    exportLines.push('')
    exportLines.push('---')
    exportLines.push('')
  }

  const md = exportLines.join('\n')
  const filename = `${(title || 'session').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60)}.md`

  return { kind: 'download', md, filename }
}

// ── Tests: /changes ──────────────────────────────────────────────────────

describe('/changes command — workspace git status', () => {
  afterEach(() => { vi.resetAllMocks() })

  it('shows message when no workspace is open', async () => {
    const result = await handleChanges(null, vi.fn())
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('No workspace folder is open.')
  })

  it('shows message when not a git repo', async () => {
    const gitStatus = vi.fn().mockResolvedValue({ hasRepo: false })
    const result = await handleChanges('/some/path', gitStatus)
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('Not a git repository')
  })

  it('shows branch and clean tree', async () => {
    const gitStatus = vi.fn().mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: 'origin/main',
      ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [],
    })
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Branch:** `main`')
    expect(result[0].content).toContain('Working tree clean')
  })

  it('shows staged files', async () => {
    const gitStatus = vi.fn().mockResolvedValue({
      hasRepo: true, branch: 'feat/x', upstream: null,
      ahead: 0, behind: 0,
      staged: [{ path: 'src/app.ts', status: 'modified' }],
      unstaged: [], untracked: [],
    })
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Staged** (1 files)')
    expect(result[0].content).toContain('`src/app.ts` — modified')
  })

  it('shows unstaged changes', async () => {
    const gitStatus = vi.fn().mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: 'origin/main',
      ahead: 0, behind: 0, staged: [],
      unstaged: [{ path: 'README.md', status: 'modified' }],
      untracked: [],
    })
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Unstaged changes** (1 files)')
    expect(result[0].content).toContain('`README.md` — modified')
  })

  it('shows untracked files', async () => {
    const gitStatus = vi.fn().mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: null,
      ahead: 0, behind: 0, staged: [], unstaged: [],
      untracked: [{ path: 'new-file.txt' }],
    })
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Untracked** (1 files)')
    expect(result[0].content).toContain('`new-file.txt`')
  })

  it('shows ahead/behind sync info', async () => {
    const gitStatus = vi.fn().mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: 'origin/main',
      ahead: 3, behind: 1, staged: [], unstaged: [], untracked: [],
    })
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Sync:** 3 ahead · 1 behind')
  })

  it('handles git status errors gracefully', async () => {
    const gitStatus = vi.fn().mockRejectedValue(new Error('git crashed'))
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Error:** git crashed')
  })

  it('shows detached HEAD state', async () => {
    const gitStatus = vi.fn().mockResolvedValue({
      hasRepo: true, branch: '', upstream: null,
      ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [],
    })
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Branch:** `(detached)`')
  })

  it('counts multiple staged and unstaged files correctly', async () => {
    const gitStatus = vi.fn().mockResolvedValue({
      hasRepo: true, branch: 'main', upstream: null,
      ahead: 0, behind: 0,
      staged: [{ path: 'a.ts', status: 'added' }, { path: 'b.ts', status: 'modified' }],
      unstaged: [{ path: 'c.ts', status: 'modified' }],
      untracked: [{ path: 'd.ts' }, { path: 'e.ts' }],
    })
    const result = await handleChanges('/project', gitStatus)
    expect(result[0].content).toContain('**Staged** (2 files)')
    expect(result[0].content).toContain('**Unstaged changes** (1 files)')
    expect(result[0].content).toContain('**Untracked** (2 files)')
  })
})

// ── Tests: /export ───────────────────────────────────────────────────────

describe('/export command — session export as Markdown', () => {
  afterEach(() => { vi.resetAllMocks() })

  it('shows message when no messages', async () => {
    const result = await handleExport('Test Session', 'gpt-4o', [])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ kind: 'msg', content: 'No messages in this session to export.' })
  })

  it('generates markdown with title and date', async () => {
    const msgs: Partial<Message>[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]
    const result = await handleExport('My Session', 'gpt-4o', msgs)
    expect(result).toHaveProperty('kind', 'download')
    if (result.kind === 'download') {
      expect(result.md).toContain('# My Session')
      expect(result.md).toContain('2 messages')
      expect(result.md).toContain('Model: gpt-4o')
      expect(result.md).toContain('**User**')
      expect(result.md).toContain('Hello')
      expect(result.md).toContain('**Assistant**')
      expect(result.md).toContain('Hi!')
    }
  })

  it('includes tool name for tool messages', async () => {
    const msgs: Partial<Message>[] = [
      { role: 'tool', content: 'read output', toolName: 'read' },
    ]
    const result = await handleExport('Tool Test', 'gpt-4o', msgs)
    if (result.kind === 'download') {
      expect(result.md).toContain('*Tool: `read`*')
      expect(result.md).toContain('*tool*')
    }
  })

  it('sanitizes filename from session title', async () => {
    const msgs: Partial<Message>[] = [{ role: 'user', content: 'test' }]
    const result = await handleExport('My Session: /with:special chars!', 'gpt-4o', msgs)
    if (result.kind === 'download') {
      expect(result.filename).toBe('My-Session---with-special-chars-.md')
      expect(result.filename.length).toBeLessThanOrEqual(63) // 60 + .md
    }
  })

  it('truncates long filenames to 60 chars', async () => {
    const msgs: Partial<Message>[] = [{ role: 'user', content: 'test' }]
    const longTitle = 'A'.repeat(100)
    const result = await handleExport(longTitle, 'gpt-4o', msgs)
    if (result.kind === 'download') {
      expect(result.filename.length).toBeLessThanOrEqual(63)
    }
  })

  it('handles session with no title', async () => {
    const msgs: Partial<Message>[] = [{ role: 'user', content: 'test' }]
    const result = await handleExport('', 'gpt-4o', msgs)
    if (result.kind === 'download') {
      expect(result.md).toContain('# Untitled Session')
      expect(result.filename).toBe('session.md')
    }
  })

  it('renders system messages with italic role', async () => {
    const msgs: Partial<Message>[] = [
      { role: 'system', content: 'Context loaded' },
    ]
    const result = await handleExport('Sys Test', 'gpt-4o', msgs)
    if (result.kind === 'download') {
      expect(result.md).toContain('*System*')
    }
  })

  it('includes separator between messages', async () => {
    const msgs: Partial<Message>[] = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    ]
    const result = await handleExport('Sep Test', 'gpt-4o', msgs)
    if (result.kind === 'download') {
      const separatorCount = (result.md.match(/^---$/gm) || []).length
      expect(separatorCount).toBeGreaterThanOrEqual(2) // header + each message
    }
  })
})
