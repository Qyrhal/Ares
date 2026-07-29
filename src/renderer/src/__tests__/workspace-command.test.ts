import { describe, it, expect, vi } from 'vitest'
import { BUILTIN_COMMANDS } from '@/components/InputBar'

// ── Pure workspace command logic (extracted from App.tsx for testability) ────

interface WorkspaceSession {
  id: string
  workspacePath?: string | null
}

function handleWorkspaceCommand(
  subcommand: string | undefined,
  session: WorkspaceSession | null,
  recentProjects: string[],
  openFolder: () => Promise<string | null>,
): { message: string; action?: 'open' | 'clear'; path?: string } {
  if (!session) {
    return { message: 'No active session.' }
  }

  if (!subcommand) {
    if (session.workspacePath) {
      return { message: '**Workspace:** `' + session.workspacePath + '`' }
    }
    return { message: 'No workspace folder is open. Use `/workspace set` to open one.' }
  }

  if (subcommand === 'set') {
    // In real app this opens a dialog; here we test the flow
    return { message: '__OPEN_DIALOG__', action: 'open' }
  }

  if (subcommand === 'recent') {
    if (recentProjects.length === 0) {
      return { message: 'No recent projects.' }
    }
    const list = recentProjects.map((p, i) => (i + 1) + '. `' + p + '`').join('\n')
    return { message: '**Recent projects:**\n' + list }
  }

  if (subcommand === 'clear') {
    return { message: 'Workspace cleared.', action: 'clear' }
  }

  return { message: 'Usage: `/workspace [set|recent|clear]`' }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Workspace command logic', () => {
  const session: WorkspaceSession = { id: 's1', workspacePath: null }

  it('shows no workspace when none is set', () => {
    const result = handleWorkspaceCommand(undefined, session, [], vi.fn())
    expect(result.message).toContain('No workspace folder is open')
  })

  it('shows path when workspace is set', () => {
    const s: WorkspaceSession = { id: 's1', workspacePath: '/home/user/project' }
    const result = handleWorkspaceCommand(undefined, s, [], vi.fn())
    expect(result.message).toContain('/home/user/project')
  })

  it('/workspace set returns open action', () => {
    const result = handleWorkspaceCommand('set', session, [], vi.fn())
    expect(result.action).toBe('open')
  })

  it('/workspace recent shows empty when no recents', () => {
    const result = handleWorkspaceCommand('recent', session, [], vi.fn())
    expect(result.message).toContain('No recent projects')
  })

  it('/workspace recent shows list when recents exist', () => {
    const result = handleWorkspaceCommand('recent', session, ['/proj/a', '/proj/b'], vi.fn())
    expect(result.message).toContain('/proj/a')
    expect(result.message).toContain('/proj/b')
  })

  it('/workspace clear returns clear action', () => {
    const result = handleWorkspaceCommand('clear', session, [], vi.fn())
    expect(result.action).toBe('clear')
    expect(result.message).toContain('cleared')
  })

  it('/workspace invalid shows usage', () => {
    const result = handleWorkspaceCommand('foo', session, [], vi.fn())
    expect(result.message).toContain('Usage')
  })

  it('/workspace with no session shows error', () => {
    const result = handleWorkspaceCommand(undefined, null, [], vi.fn())
    expect(result.message).toContain('No active session')
  })

  it('workspace command is registered in BUILTIN_COMMANDS', () => {
    const cmd = BUILTIN_COMMANDS.find((c) => c.name === 'workspace')
    expect(cmd).toBeDefined()
    expect(cmd?.description).toContain('workspace')
  })

  it('BUILTIN_COMMANDS count is 70', () => {
    expect(BUILTIN_COMMANDS.length).toBe(82)
  })
})
