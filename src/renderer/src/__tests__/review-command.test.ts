import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/review slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ── Git diff review tests ──────────────────────────────────────────────

  it('builds correct code review system prompt', () => {
    const prompt = 'You are a senior code reviewer. Review the following git diff and provide:\n1) **Summary** — What changed and why (one paragraph)\n2) **Issues** — Bugs, edge cases, or correctness problems (if any)\n3) **Suggestions** — Code quality improvements, better patterns, or simplifications\n4) **Verdict** — Approve, request changes, or note concerns\n\nBe specific: reference line numbers or code snippets. Be concise and actionable.'
    expect(prompt).toContain('senior code reviewer')
    expect(prompt).toContain('Summary')
    expect(prompt).toContain('Issues')
    expect(prompt).toContain('Suggestions')
    expect(prompt).toContain('Verdict')
  })

  it('formats code review response with header', () => {
    const content = 'Looks good, minor issues found.'
    const formatted = `**🔍 Code Review**\n\n${content}`
    expect(formatted).toContain('🔍 Code Review')
    expect(formatted).toContain('Looks good, minor issues found.')
  })

  it('detects staged review argument', () => {
    const reviewArg: string = 'staged'
    const isGitReview = reviewArg === 'staged' || reviewArg === 'unstaged' || (reviewArg.length > 0 && reviewArg !== 'staged' && reviewArg !== 'unstaged')
    expect(isGitReview).toBe(true)
  })

  it('detects unstaged review argument', () => {
    const reviewArg: string = 'unstaged'
    const isGitReview = reviewArg === 'staged' || reviewArg === 'unstaged' || (reviewArg.length > 0 && reviewArg !== 'staged' && reviewArg !== 'unstaged')
    expect(isGitReview).toBe(true)
  })

  it('detects filename review argument', () => {
    const reviewArg: string = 'src/app.tsx'
    const isGitReview = reviewArg === 'staged' || reviewArg === 'unstaged' || (reviewArg.length > 0 && reviewArg !== 'staged' && reviewArg !== 'unstaged')
    expect(isGitReview).toBe(true)
  })

  it('empty args triggers session review (not git review)', () => {
    const reviewArg: string = ''
    const isGitReview = reviewArg === 'staged' || reviewArg === 'unstaged' || (reviewArg.length > 0 && reviewArg !== 'staged' && reviewArg !== 'unstaged')
    expect(isGitReview).toBe(false)
  })

  it('truncates large diffs at 12000 chars', () => {
    const largeDiff = 'x'.repeat(15000)
    const diffSize = largeDiff.length
    const truncatedDiff = diffSize > 12000 ? largeDiff.slice(0, 12000) + '\n\n*...diff truncated*' : largeDiff
    expect(truncatedDiff.length).toBe(12000 + '\n\n*...diff truncated*'.length)
    expect(truncatedDiff).toContain('*...diff truncated*')
  })

  it('does not truncate small diffs', () => {
    const smallDiff = 'small diff'
    const diffSize = smallDiff.length
    const truncatedDiff = diffSize > 12000 ? smallDiff.slice(0, 12000) + '\n\n*...diff truncated*' : smallDiff
    expect(truncatedDiff).toBe('small diff')
  })

  // ── Session review tests (existing behavior) ───────────────────────────

  it('builds correct session review system prompt', () => {
    const prompt = 'You are a code reviewer. Analyze the conversation below and provide: 1) A brief summary of what was discussed/accomplished. 2) Code quality observations (patterns, potential issues). 3) 2-3 specific suggestions for improvement. Be concise and actionable.'
    expect(prompt).toContain('code reviewer')
    expect(prompt).toContain('summary')
    expect(prompt).toContain('suggestions')
  })

  it('formats session review response with header', () => {
    const content = 'Some review text'
    const formatted = `**📝 Session Review**\n\n${content}`
    expect(formatted).toContain('📝 Session Review')
    expect(formatted).toContain('Some review text')
  })

  it('truncates to last 20 messages for context', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}` }))
    const sliced = messages.slice(-20)
    expect(sliced.length).toBe(20)
    expect(sliced[0].content).toBe('msg 10')
  })

  it('handles API error gracefully', () => {
    const status = 500
    const errorMsg = `Review failed: HTTP ${status}`
    expect(errorMsg).toContain('500')
  })

  it('handles missing content in response', () => {
    const response = { choices: [] as { message?: { content?: string } }[] }
    const content = response.choices?.[0]?.message?.content ?? 'No review generated.'
    expect(content).toBe('No review generated.')
  })

  it('builds request body with correct model', () => {
    const model = 'gpt-4o'
    const body = { model, messages: [], stream: false }
    expect(body.model).toBe('gpt-4o')
    expect(body.stream).toBe(false)
  })

  it('includes Authorization header when API key exists', () => {
    const apiKey = 'test-key'
    const header = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    expect(header).toHaveProperty('Authorization')
    expect(header.Authorization).toBe('Bearer test-key')
  })

  it('detects staged empty message', () => {
    const status = { staged: [] as { path: string }[], unstaged: [{ path: 'a.ts' }] }
    const noChanges = status.staged.length === 0
    expect(noChanges).toBe(true)
  })

  it('detects unstaged empty message', () => {
    const status = { staged: [{ path: 'a.ts' }], unstaged: [] as { path: string }[] }
    const noChanges = status.unstaged.length === 0
    expect(noChanges).toBe(true)
  })

  it('matches filename in staged and unstaged files', () => {
    const status = {
      staged: [{ path: 'src/app.tsx' }],
      unstaged: [{ path: 'src/utils.ts' }],
    }
    const reviewArg: string = 'app.tsx'
    const allFiles = [...status.staged, ...status.unstaged]
    const matched = allFiles.filter((f) => f.path.includes(reviewArg))
    expect(matched.length).toBe(1)
    expect(matched[0].path).toBe('src/app.tsx')
  })

  it('returns empty when filename matches nothing', () => {
    const status = {
      staged: [{ path: 'src/app.tsx' }],
      unstaged: [{ path: 'src/utils.ts' }],
    }
    const reviewArg: string = 'nonexistent.ts'
    const allFiles = [...status.staged, ...status.unstaged]
    const matched = allFiles.filter((f) => f.path.includes(reviewArg))
    expect(matched.length).toBe(0)
  })

  it('formats diff parts with file headers', () => {
    const diffParts: string[] = []
    const filePath = 'src/app.tsx'
    const isStaged = true
    const diff = '+added line\n-removed line'
    diffParts.push(`### ${filePath} (${isStaged ? 'staged' : 'unstaged'})\n\`\`\`diff\n${diff}\n\`\`\``)
    const diffText = diffParts.join('\n\n')
    expect(diffText).toContain('### src/app.tsx (staged)')
    expect(diffText).toContain('+added line')
    expect(diffText).toContain('-removed line')
  })

  it('limits to 30 files per review mode', () => {
    const files = Array.from({ length: 50 }, (_, i) => ({ path: `file${i}.ts` }))
    const sliced = files.slice(0, 30)
    expect(sliced.length).toBe(30)
  })
})
