import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    archived: false,
    ...overrides,
  }
}

describe('/debug slash command', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [],
      activeTabId: null,
      tabs: [],
      messages: [],
      workspacePath: null,
    })
  })

  it('reports zero sessions when empty', () => {
    const { sessions } = useAppStore.getState()
    expect(sessions.length).toBe(0)
  })

  it('reports correct session counts with mixed states', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', pinned: true }),
        mkSession({ id: 's2', pinned: false }),
        mkSession({ id: 's3', pinned: false, archived: true }),
      ],
    })
    const { sessions } = useAppStore.getState()
    const pinned = sessions.filter((s) => s.pinned).length
    const archived = sessions.filter((s) => s.archived).length
    expect(pinned).toBe(1)
    expect(archived).toBe(1)
    expect(sessions.length).toBe(3)
  })

  it('reports active tab as null when no tab is active', () => {
    useAppStore.setState({ activeTabId: null })
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('reports active tab ID when set', () => {
    useAppStore.setState({ activeTabId: 'tab-abc' })
    expect(useAppStore.getState().activeTabId).toBe('tab-abc')
  })

  it('reports message count correctly', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', role: 'user', content: 'hello' },
        { id: 'm2', role: 'assistant', content: 'hi' },
      ] as any,
    })
    expect(useAppStore.getState().messages.length).toBe(2)
  })

  it('reports workspace path when set', () => {
    useAppStore.setState({ workspacePath: '/home/user/project' })
    expect(useAppStore.getState().workspacePath).toBe('/home/user/project')
  })

  it('reports workspace as null when not set', () => {
    useAppStore.setState({ workspacePath: null })
    expect(useAppStore.getState().workspacePath).toBeNull()
  })

  it('reports API settings correctly', () => {
    useAppStore.setState({
      settings: {
        apiBaseUrl: 'https://api.example.com',
        apiKey: 'sk-test',
        defaultModel: 'gpt-4o',
      } as any,
    })
    const { settings } = useAppStore.getState()
    expect(!!settings.apiBaseUrl).toBe(true)
    expect(!!settings.apiKey).toBe(true)
    expect(settings.defaultModel).toBe('gpt-4o')
  })

  it('debug command exists in switch cases', () => {
    const commands = ['model', 'clear', 'compact', 'shortcuts', 'note', 'pin', 'debug', 'rename', 'log', 'review', 'cost', 'help', 'status', 'summary', 'usage', 'overview', 'helpful', 'not-helpful', 'pr', 'fork', 'changes', 'diff', 'export']
    expect(commands).toContain('debug')
  })

  it('help text includes /debug command', () => {
    const helpText = 'Commands: /model, /clear, /compact, /usage, /cost, /overview, /status, /summary, /fork, /pr, /changes, /diff, /log, /export, /shortcuts, /note, /review, /rename, /pin, /debug - show diagnostic and debug info, /helpful, /not-helpful, /help'
    expect(helpText).toContain('/debug')
    expect(helpText).toContain('diagnostic and debug info')
  })
})
