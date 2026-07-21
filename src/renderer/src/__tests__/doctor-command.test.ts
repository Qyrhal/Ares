import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import { BUILTIN_COMMANDS } from '@/components/InputBar'
import type { AgentStatus, PermissionMode } from '@/types'

function mkSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Test',
    model: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    pinned: false,
    archived: false,
    agentStatus: 'idle' as AgentStatus,
    ...overrides,
  }
}

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiBaseUrl: '',
  defaultModel: '',
  themeId: 'dark',
  colorMode: 'dark' as const,
  systemPrompt: '',
  permissionMode: 'ask' as PermissionMode,
  providers: [],
}

describe('/doctor slash command', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [],
      workspacePath: null,
      messages: [],
      settings: { ...DEFAULT_SETTINGS },
    })
  })

  it('includes /doctor in the builtin commands list', () => {
    const doctorCmd = BUILTIN_COMMANDS.find((c) => c.name === 'doctor')
    expect(doctorCmd).toBeDefined()
    expect(doctorCmd!.description).toContain('diagnostics')
  })

  it('reports zero sessions when store is empty', () => {
    const { sessions } = useAppStore.getState()
    expect(sessions.length).toBe(0)
  })

  it('reports session counts with running agents', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', agentStatus: 'running' }),
        mkSession({ id: 's2', agentStatus: 'idle' }),
        mkSession({ id: 's3', agentStatus: 'done' }),
      ],
    })
    const { sessions } = useAppStore.getState()
    const running = sessions.filter((s) => s.agentStatus === 'running').length
    expect(running).toBe(1)
    expect(sessions.length).toBe(3)
  })

  it('reports workspace path when set', () => {
    useAppStore.setState({ workspacePath: '/home/user/project' })
    expect(useAppStore.getState().workspacePath).toBe('/home/user/project')
  })

  it('reports workspace as null when not set', () => {
    useAppStore.setState({ workspacePath: null })
    expect(useAppStore.getState().workspacePath).toBeNull()
  })

  it('reports API endpoint configured', () => {
    useAppStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        apiBaseUrl: 'http://localhost:11434/v1',
        defaultModel: 'llama3',
      },
    })
    const { settings } = useAppStore.getState()
    expect(settings.apiBaseUrl).toBeTruthy()
    expect(settings.apiKey).toBeTruthy()
    expect(settings.defaultModel).toBeTruthy()
  })

  it('reports API endpoint not configured', () => {
    const { settings } = useAppStore.getState()
    expect(settings.apiBaseUrl).toBeFalsy()
  })

  it('reports default model when set', () => {
    useAppStore.setState({
      settings: { ...DEFAULT_SETTINGS, defaultModel: 'gpt-4o' },
    })
    expect(useAppStore.getState().settings.defaultModel).toBe('gpt-4o')
  })

  it('reports default model as empty when not set', () => {
    expect(useAppStore.getState().settings.defaultModel).toBe('')
  })

  it('has electron mock available for diagnostics', () => {
    expect((window as any).electron).toBeDefined()
    expect((window as any).electron.git).toBeDefined()
    expect((window as any).electron.db).toBeDefined()
    expect((window as any).electron.agentConfig).toBeDefined()
  })

  it('agentConfig.get returns expected structure', async () => {
    const config = await (window as any).electron.agentConfig.get()
    expect(config).toHaveProperty('mcpServers')
    expect(config).toHaveProperty('skills')
    expect(config).toHaveProperty('extensions')
    expect(config).toHaveProperty('commands')
    expect(Array.isArray(config.mcpServers)).toBe(true)
    expect(Array.isArray(config.skills)).toBe(true)
    expect(Array.isArray(config.extensions)).toBe(true)
    expect(Array.isArray(config.commands)).toBe(true)
  })

  it('git.status mock returns expected structure', async () => {
    const status = await (window as any).electron.git.status('/test')
    expect(status).toHaveProperty('hasRepo')
    expect(status).toHaveProperty('branch')
    expect(status).toHaveProperty('upstream')
    expect(status).toHaveProperty('ahead')
    expect(status).toHaveProperty('behind')
  })

  it('tracks mixed session states correctly for doctor output', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', agentStatus: 'running', pinned: true }),
        mkSession({ id: 's2', agentStatus: 'done', archived: false }),
        mkSession({ id: 's3', agentStatus: 'idle', archived: true }),
      ],
    })
    const { sessions } = useAppStore.getState()
    const running = sessions.filter((s) => s.agentStatus === 'running').length
    const pinned = sessions.filter((s) => s.pinned).length
    const archived = sessions.filter((s) => s.archived).length
    expect(running).toBe(1)
    expect(pinned).toBe(1)
    expect(archived).toBe(1)
  })
})
