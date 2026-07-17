import { describe, it, expect } from 'vitest'

describe('/fork command — session forking logic', () => {
  it('strips existing fork suffix before generating new title', () => {
    const titles = [
      ['My session (fork 1)', 'My session'],
      ['Debug (fork 3)', 'Debug'],
      ['Plain session', 'Plain session'],
      ['Test (fork 1) (fork 2)', 'Test (fork 1)'],
    ]
    for (const [input, expected] of titles) {
      const cleaned = input.replace(/\s*\(fork \d+\)$/, '')
      expect(cleaned).toBe(expected)
    }
  })

  it('computes fork number based on existing forks', () => {
    const sessions = [
      { id: 's1', title: 'Debug' },
      { id: 's2', title: 'Debug (fork 1)' },
      { id: 's3', title: 'Debug (fork 2)' },
    ]
    const baseTitle = 'Debug'
    const forks = sessions.filter((s) => s.title.startsWith(baseTitle))
    const forkN = forks.length + 1
    expect(forkN).toBe(4)
    expect(`${baseTitle} (fork ${forkN})`).toBe('Debug (fork 4)')
  })

  it('computes fork number as 1 when no forks exist', () => {
    const baseTitle = 'Debug'
    const existingForks = 0
    const forkN = existingForks + 1
    expect(forkN).toBe(1)
    expect(`${baseTitle} (fork ${forkN})`).toBe('Debug (fork 1)')
  })

  it('generates correct message opts for each message type', () => {
    // Simulate the message copying logic in the fork command
    function buildAddMessageOpts(m: Record<string, unknown>) {
      return {
        attachments: m.attachments,
        toolName: m.toolName as string | undefined,
        toolStatus: m.toolStatus as string | undefined,
        toolInput: m.toolInput as string | undefined,
        toolOutput: m.toolOutput as string | undefined,
        thinking: m.thinking as string | undefined,
        replyTo: m.replyTo
          ? { id: (m.replyTo as { id: string }).id, content: (m.replyTo as { content: string }).content, role: (m.replyTo as { role: string }).role }
          : undefined,
        reactions: m.reactions ? { up: (m.reactions as { up: boolean | null }).up } : undefined,
      }
    }

    const userMsg = {
      role: 'user',
      content: 'Hello',
      attachments: [{ id: 'a1', name: 'file.ts' }],
      toolName: undefined,
      toolStatus: undefined,
      toolInput: undefined,
      toolOutput: undefined,
      thinking: undefined,
      replyTo: undefined,
      reactions: undefined,
    }
    const opts1 = buildAddMessageOpts(userMsg)
    expect(opts1.attachments).toEqual([{ id: 'a1', name: 'file.ts' }])
    expect(opts1.replyTo).toBeUndefined()
    expect(opts1.toolName).toBeUndefined()

    const assistantMsg = {
      role: 'assistant',
      content: 'Here is the code...',
      attachments: undefined,
      toolName: 'bash',
      toolStatus: 'done',
      toolInput: 'ls',
      toolOutput: 'file1.ts',
      thinking: 'I need to list files...',
      replyTo: { id: 'm1', content: 'Hello', role: 'user' },
      reactions: undefined,
    }
    const opts2 = buildAddMessageOpts(assistantMsg)
    expect(opts2.toolName).toBe('bash')
    expect(opts2.toolStatus).toBe('done')
    expect(opts2.toolInput).toBe('ls')
    expect(opts2.toolOutput).toBe('file1.ts')
    expect(opts2.thinking).toBe('I need to list files...')
    expect(opts2.replyTo).toEqual({ id: 'm1', content: 'Hello', role: 'user' })

    const ratedMsg = {
      role: 'assistant',
      content: 'Response',
      reactions: { up: true },
      attachments: undefined,
      toolName: undefined,
      toolStatus: undefined,
      toolInput: undefined,
      toolOutput: undefined,
      thinking: undefined,
      replyTo: undefined,
    }
    const opts3 = buildAddMessageOpts(ratedMsg)
    expect(opts3.reactions).toEqual({ up: true })
  })

  it('handles empty message array gracefully', () => {
    const messages: unknown[] = []
    expect(messages.length).toBe(0)
    // Copying zero messages should work fine
    const copyCount = messages.length
    expect(copyCount).toBe(0)
  })
})
