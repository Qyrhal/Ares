import { describe, it, expect, vi } from 'vitest'

// ── helpers extracted from App.tsx command handler logic ─────────────────

interface Checkpoint {
  id: string
  index: number
  message: string
  date: string
  branch: string
}

/** Simulates the /checkpoint command dispatch logic from App.tsx. */
async function handleCheckpoint(
  workspacePath: string | null,
  args: string,
  checkpointFns: {
    create: (cwd: string, msg: string) => Promise<Checkpoint | null>
    list: (cwd: string) => Promise<Checkpoint[]>
    restore: (cwd: string, idx: number) => Promise<{ ok: boolean; error?: string }>
    drop: (cwd: string, idx: number) => Promise<{ ok: boolean; error?: string }>
    diff: (cwd: string, idx: number) => Promise<string>
  },
): Promise<{ kind: 'msg'; content: string }[]> {
  const results: { kind: 'msg'; content: string }[] = []
  const pushMsg = (content: string) => results.push({ kind: 'msg', content })

  if (!workspacePath) {
    pushMsg('**Checkpoints**\n\nNo workspace folder is open.')
    return results
  }

  pushMsg('**Checkpoints**\n')
  const sub = args.trim().toLowerCase()
  try {
    if (sub.startsWith('save ') || sub.startsWith('create ')) {
      const msg = args.trim().slice(sub.startsWith('save') ? 5 : 7).trim()
      if (!msg) {
        pushMsg('Usage: `/checkpoint save <message>` — save a checkpoint')
      } else {
        const result = await checkpointFns.create(workspacePath, msg)
        if (result) {
          pushMsg(`✅ Checkpoint saved: \`${result.id}\` — ${result.message}`)
        } else {
          pushMsg('No changes to checkpoint (working tree clean or not a git repo).')
        }
      }
    } else if (sub.startsWith('restore ')) {
      const idx = parseInt(sub.split(' ')[1], 10)
      if (isNaN(idx)) {
        pushMsg('Usage: `/checkpoint restore <n>` — restore checkpoint by index')
      } else {
        const result = await checkpointFns.restore(workspacePath, idx)
        pushMsg(result.ok ? `✅ Checkpoint ${idx} restored.` : `❌ ${result.error}`)
      }
    } else if (sub.startsWith('diff ')) {
      const idx = parseInt(sub.split(' ')[1], 10)
      if (isNaN(idx)) {
        pushMsg('Usage: `/checkpoint diff <n>` — show diff for checkpoint')
      } else {
        const diff = await checkpointFns.diff(workspacePath, idx)
        if (diff) {
          pushMsg(`**Checkpoint ${idx} diff:**\n\`\`\`diff\n${diff}\n\`\`\``)
        } else {
          pushMsg(`No diff available for checkpoint ${idx}.`)
        }
      }
    } else if (sub.startsWith('drop ')) {
      const idx = parseInt(sub.split(' ')[1], 10)
      if (isNaN(idx)) {
        pushMsg('Usage: `/checkpoint drop <n>` — drop checkpoint by index')
      } else {
        const result = await checkpointFns.drop(workspacePath, idx)
        pushMsg(result.ok ? `✅ Checkpoint ${idx} dropped.` : `❌ ${result.error}`)
      }
    } else {
      const checkpoints = await checkpointFns.list(workspacePath)
      if (checkpoints.length === 0) {
        pushMsg('No checkpoints saved.')
      } else {
        for (const cp of checkpoints) {
          const msg = cp.message.length > 60 ? cp.message.slice(0, 57) + '...' : cp.message
          pushMsg(`· \`stash@{${cp.index}}\` — ${msg}`)
        }
        pushMsg('\nUsage: `/checkpoint save <msg>`, `/checkpoint restore <n>`, `/checkpoint diff <n>`, `/checkpoint drop <n>`')
      }
    }
  } catch (err) {
    pushMsg(`Error: ${(err as Error).message}`)
  }

  return results
}

// ── tests ───────────────────────────────────────────────────────────────

const mkCheckpoint = (index: number, message: string): Checkpoint => ({
  id: `stash@{${index}}`,
  index,
  message,
  date: '',
  branch: 'main',
})

const has = (msgs: { content: string }[], text: string) => msgs.some((m) => m.content.includes(text))

describe('/checkpoint command', () => {
  const cwd = '/workspace'

  const mockFns = (overrides: Record<string, unknown> = {}) => ({
    create: vi.fn().mockResolvedValue(mkCheckpoint(0, 'test save')),
    list: vi.fn().mockResolvedValue([mkCheckpoint(0, 'test save'), mkCheckpoint(1, 'wip feature')]),
    restore: vi.fn().mockResolvedValue({ ok: true }),
    drop: vi.fn().mockResolvedValue({ ok: true }),
    diff: vi.fn().mockResolvedValue('diff --git a/test.ts\n+new line'),
    ...overrides,
  })

  it('shows no workspace message when workspace is null', async () => {
    const msgs = await handleCheckpoint(null, '', mockFns())
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toContain('No workspace folder is open')
  })

  it('lists checkpoints when called without args', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, '', fns)
    expect(has(msgs, '**Checkpoints**')).toBe(true)
    expect(has(msgs, 'test save')).toBe(true)
    expect(has(msgs, 'wip feature')).toBe(true)
    expect(fns.list).toHaveBeenCalledWith(cwd)
  })

  it('shows no checkpoints message when list is empty', async () => {
    const fns = mockFns({ list: vi.fn().mockResolvedValue([]) })
    const msgs = await handleCheckpoint(cwd, '', fns)
    expect(has(msgs, 'No checkpoints saved')).toBe(true)
  })

  it('creates a checkpoint with save subcommand', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'save my checkpoint', fns)
    expect(has(msgs, '✅ Checkpoint saved')).toBe(true)
    expect(has(msgs, 'test save')).toBe(true)
    expect(fns.create).toHaveBeenCalledWith(cwd, 'my checkpoint')
  })

  it('creates a checkpoint with create subcommand', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'create another save', fns)
    expect(has(msgs, '✅ Checkpoint saved')).toBe(true)
    expect(fns.create).toHaveBeenCalledWith(cwd, 'another save')
  })

  it('shows usage when save has no message', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'save ', fns)
    expect(has(msgs, 'Usage')).toBe(true)
    expect(fns.create).not.toHaveBeenCalled()
  })

  it('shows no changes message when create returns null', async () => {
    const fns = mockFns({ create: vi.fn().mockResolvedValue(null) })
    const msgs = await handleCheckpoint(cwd, 'save test', fns)
    expect(has(msgs, 'No changes to checkpoint')).toBe(true)
  })

  it('restores a checkpoint by index', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'restore 2', fns)
    expect(has(msgs, '✅ Checkpoint 2 restored')).toBe(true)
    expect(fns.restore).toHaveBeenCalledWith(cwd, 2)
  })

  it('shows error when restore fails', async () => {
    const fns = mockFns({ restore: vi.fn().mockResolvedValue({ ok: false, error: 'stash not found' }) })
    const msgs = await handleCheckpoint(cwd, 'restore 5', fns)
    expect(has(msgs, '❌ stash not found')).toBe(true)
  })

  it('shows usage for restore with invalid index', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'restore abc', fns)
    expect(has(msgs, 'Usage')).toBe(true)
    expect(fns.restore).not.toHaveBeenCalled()
  })

  it('shows diff for a checkpoint', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'diff 0', fns)
    expect(has(msgs, 'Checkpoint 0 diff')).toBe(true)
    expect(has(msgs, 'diff --git a/test.ts')).toBe(true)
    expect(fns.diff).toHaveBeenCalledWith(cwd, 0)
  })

  it('shows no diff message when diff is empty', async () => {
    const fns = mockFns({ diff: vi.fn().mockResolvedValue('') })
    const msgs = await handleCheckpoint(cwd, 'diff 0', fns)
    expect(has(msgs, 'No diff available')).toBe(true)
  })

  it('shows usage for diff with invalid index', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'diff abc', fns)
    expect(has(msgs, 'Usage')).toBe(true)
    expect(fns.diff).not.toHaveBeenCalled()
  })

  it('drops a checkpoint by index', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'drop 1', fns)
    expect(has(msgs, '✅ Checkpoint 1 dropped')).toBe(true)
    expect(fns.drop).toHaveBeenCalledWith(cwd, 1)
  })

  it('shows error when drop fails', async () => {
    const fns = mockFns({ drop: vi.fn().mockResolvedValue({ ok: false, error: 'not found' }) })
    const msgs = await handleCheckpoint(cwd, 'drop 3', fns)
    expect(has(msgs, '❌ not found')).toBe(true)
  })

  it('shows usage for drop with invalid index', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, 'drop xyz', fns)
    expect(has(msgs, 'Usage')).toBe(true)
    expect(fns.drop).not.toHaveBeenCalled()
  })

  it('truncates long checkpoint messages in list', async () => {
    const longMsg = 'a'.repeat(80)
    const fns = mockFns({ list: vi.fn().mockResolvedValue([mkCheckpoint(0, longMsg)]) })
    const msgs = await handleCheckpoint(cwd, '', fns)
    expect(has(msgs, '...')).toBe(true)
    expect(has(msgs, longMsg)).toBe(false)
  })

  it('handles errors gracefully', async () => {
    const fns = mockFns({ list: vi.fn().mockRejectedValue(new Error('git error')) })
    const msgs = await handleCheckpoint(cwd, '', fns)
    expect(has(msgs, 'Error: git error')).toBe(true)
  })

  it('includes usage hint in list output', async () => {
    const fns = mockFns()
    const msgs = await handleCheckpoint(cwd, '', fns)
    expect(has(msgs, '/checkpoint save')).toBe(true)
    expect(has(msgs, '/checkpoint restore')).toBe(true)
    expect(has(msgs, '/checkpoint diff')).toBe(true)
    expect(has(msgs, '/checkpoint drop')).toBe(true)
  })
})
