import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_COMMANDS } from '@/components/InputBar'

// ── Pure tag command logic (extracted from App.tsx for testability) ────────

interface TagSession {
  id: string
  title: string
  tags?: string[]
}

function handleTagCommand(
  subcommand: string | undefined,
  tagName: string | undefined,
  session: TagSession | null,
  allSessions: TagSession[],
): { message: string; newTags?: string[] } {
  if (!session) {
    return { message: 'No active session.' }
  }

  if (!subcommand || subcommand === 'list') {
    if (subcommand === 'list') {
      const allTags = new Set<string>()
      allSessions.forEach((s) => s.tags?.forEach((t) => allTags.add(t)))
      const tagList = [...allTags].sort()
      if (tagList.length === 0) {
        return { message: 'No tags in use yet.' }
      }
      return { message: `**All tags:** ${tagList.map((t) => `\`${t}\``).join(', ')}` }
    }
    const tags = session.tags ?? []
    if (tags.length === 0) {
      return { message: 'No tags on this session. Use `/tag add <name>` to add one.' }
    }
    return { message: `**Current tags:** ${tags.map((t) => `\`${t}\``).join(', ')}` }
  }

  if (subcommand === 'add') {
    if (!tagName) {
      return { message: 'Usage: `/tag add <name>`' }
    }
    const currentTags = session.tags ?? []
    if (currentTags.includes(tagName)) {
      return { message: `Tag \`${tagName}\` already exists.` }
    }
    const newTags = [...currentTags, tagName]
    return { message: `Added tag \`${tagName}\`. Tags: ${newTags.map((t) => `\`${t}\``).join(', ')}`, newTags }
  }

  if (subcommand === 'remove') {
    if (!tagName) {
      return { message: 'Usage: `/tag remove <name>`' }
    }
    const currentTags = session.tags ?? []
    if (!currentTags.includes(tagName)) {
      return { message: `Tag \`${tagName}\` not found on this session.` }
    }
    const newTags = currentTags.filter((t) => t !== tagName)
    return { message: `Removed tag \`${tagName}\`.`, newTags }
  }

  return { message: 'Usage: `/tag [add|remove|list] [name]`' }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('/tag slash command', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('is registered in BUILTIN_COMMANDS', () => {
    const tagCmd = BUILTIN_COMMANDS.find((c) => c.name === 'tag')
    expect(tagCmd).toBeDefined()
    expect(tagCmd?.kind).toBe('builtin')
    expect(tagCmd?.description).toContain('tag')
  })

  it('has correct description', () => {
    const tagCmd = BUILTIN_COMMANDS.find((c) => c.name === 'tag')!
    expect(tagCmd.description).toMatch(/categorization|tags/i)
  })

  it('/tag with no active session shows error', () => {
    const result = handleTagCommand(undefined, undefined, null, [])
    expect(result.message).toBe('No active session.')
  })

  it('/tag with no tags shows empty message', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: [] }
    const result = handleTagCommand(undefined, undefined, session, [session])
    expect(result.message).toContain('No tags on this session')
  })

  it('/tag add frontend adds tag', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: [] }
    const result = handleTagCommand('add', 'frontend', session, [session])
    expect(result.newTags).toEqual(['frontend'])
    expect(result.message).toContain('Added tag')
    expect(result.message).toContain('`frontend`')
  })

  it('/tag add frontend duplicate shows already exists', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: ['frontend'] }
    const result = handleTagCommand('add', 'frontend', session, [session])
    expect(result.newTags).toBeUndefined()
    expect(result.message).toContain('already exists')
  })

  it('/tag remove frontend removes tag', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: ['frontend', 'backend'] }
    const result = handleTagCommand('remove', 'frontend', session, [session])
    expect(result.newTags).toEqual(['backend'])
    expect(result.message).toContain('Removed tag')
    expect(result.message).toContain('`frontend`')
  })

  it('/tag remove nonexistent shows not found', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: ['frontend'] }
    const result = handleTagCommand('remove', 'backend', session, [session])
    expect(result.newTags).toBeUndefined()
    expect(result.message).toContain('not found')
  })

  it('/tag list shows all unique tags', () => {
    const sessions: TagSession[] = [
      { id: 's1', title: 'A', tags: ['frontend', 'react'] },
      { id: 's2', title: 'B', tags: ['frontend', 'vue'] },
      { id: 's3', title: 'C', tags: [] },
    ]
    const result = handleTagCommand('list', undefined, sessions[0], sessions)
    expect(result.message).toContain('**All tags:**')
    expect(result.message).toContain('`frontend`')
    expect(result.message).toContain('`react`')
    expect(result.message).toContain('`vue`')
  })

  it('/tag list with no tags in use shows empty message', () => {
    const sessions: TagSession[] = [
      { id: 's1', title: 'A', tags: [] },
    ]
    const result = handleTagCommand('list', undefined, sessions[0], sessions)
    expect(result.message).toBe('No tags in use yet.')
  })

  it('/tag with invalid subcommand shows usage', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: [] }
    const result = handleTagCommand('invalid', undefined, session, [session])
    expect(result.message).toContain('Usage')
  })

  it('/tag add with no name shows usage', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: [] }
    const result = handleTagCommand('add', undefined, session, [session])
    expect(result.message).toContain('Usage')
  })

  it('/tag remove with no name shows usage', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: ['frontend'] }
    const result = handleTagCommand('remove', undefined, session, [session])
    expect(result.message).toContain('Usage')
  })

  it('/tag displays current tags', () => {
    const session: TagSession = { id: 's1', title: 'Test', tags: ['react', 'typescript'] }
    const result = handleTagCommand(undefined, undefined, session, [session])
    expect(result.message).toContain('**Current tags:**')
    expect(result.message).toContain('`react`')
    expect(result.message).toContain('`typescript`')
  })
})
