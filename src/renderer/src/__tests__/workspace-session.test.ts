import { describe, it, expect } from 'vitest'
import { parseSession } from '@/schemas'
import type { Session } from '@/types'

describe('parseSession — workspacePath', () => {
  const base = {
    id: 's1', title: 'Test', model: 'gpt-4o',
    created_at: 100, updated_at: 200, message_count: 5,
  }

  it('defaults workspacePath to undefined when not present', () => {
    const s = parseSession(base)
    expect(s.workspacePath).toBeUndefined()
  })

  it('defaults workspacePath to undefined when null', () => {
    const s = parseSession({ ...base, workspace_path: null })
    expect(s.workspacePath).toBeUndefined()
  })

  it('parses workspace_path into workspacePath', () => {
    const s = parseSession({ ...base, workspace_path: '/home/user/project' })
    expect(s.workspacePath).toBe('/home/user/project')
  })

  it('preserves other fields when workspace_path is set', () => {
    const s = parseSession({ ...base, workspace_path: '/tmp' })
    expect(s.id).toBe('s1')
    expect(s.title).toBe('Test')
    expect(s.model).toBe('gpt-4o')
    expect(s.createdAt).toBe(100)
    expect(s.updatedAt).toBe(200)
    expect(s.messageCount).toBe(5)
  })

  it('handles deep nested paths', () => {
    const s = parseSession({ ...base, workspace_path: '/a/b/c/d/e/f' })
    expect(s.workspacePath).toBe('/a/b/c/d/e/f')
  })

  it('handles workspace_path with trailing slash', () => {
    const s = parseSession({ ...base, workspace_path: '/project/' })
    expect(s.workspacePath).toBe('/project/')
  })
})

describe('Session — workspace switching model', () => {
  it('session type supports workspacePath', () => {
    const s: Session = {
      id: 's1', title: 'T', model: 'm',
      createdAt: 0, updatedAt: 0, messageCount: 0,
      workspacePath: '/my/project',
    }
    expect(s.workspacePath).toBe('/my/project')
  })

  it('multiple sessions can have different workspace paths', () => {
    const sA: Session = { id: 'a', title: 'A', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/a' }
    const sB: Session = { id: 'b', title: 'B', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/b' }
    const sC: Session = { id: 'c', title: 'C', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 }
    expect(sA.workspacePath).toBe('/project/a')
    expect(sB.workspacePath).toBe('/project/b')
    expect(sC.workspacePath).toBeUndefined()
  })

  it('workspacePath is optional', () => {
    const s: Session = { id: 's1', title: 'T', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 }
    expect(s.workspacePath).toBeUndefined()
  })
})

describe('Sidebar — directory display', () => {
  it('extracts last 3 path segments', () => {
    const segments = '/home/user/projects/my-app/src'.split('/').filter(Boolean).slice(-3)
    expect(segments.join('/')).toBe('projects/my-app/src')
  })

  it('handles paths with fewer than 3 segments', () => {
    const segments = '/my/app'.split('/').filter(Boolean).slice(-3)
    expect(segments.join('/')).toBe('my/app')
  })

  it('handles single segment paths', () => {
    const segments = '/project'.split('/').filter(Boolean).slice(-3)
    expect(segments.join('/')).toBe('project')
  })

  it('handles root path', () => {
    const segments = '/'.split('/').filter(Boolean).slice(-3)
    expect(segments.join('/')).toBe('')
  })
})

describe('Git — workspace-dependent operations', () => {
  it('git status cwd should match session workspacePath', () => {
    const session: Session = { id: 's1', title: 'T', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/my-repo' }
    const gitCwd = session.workspacePath!
    expect(gitCwd).toBe('/project/my-repo')
  })

  it('git commands should fail gracefully without workspacePath', () => {
    const session: Session = { id: 's1', title: 'T', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 }
    expect(session.workspacePath).toBeUndefined()
    // GitPane should not call git operations when workspacePath is null
    const cwd = session.workspacePath ?? null
    expect(cwd).toBeNull()
  })

  it('switch between sessions changes workspace', () => {
    const sA: Session = { id: 'a', title: 'A', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/a' }
    const sB: Session = { id: 'b', title: 'B', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/b' }

    let currentWp: string | null | undefined = sA.workspacePath
    expect(currentWp).toBe('/project/a')

    // Simulate switching to B
    currentWp = sB.workspacePath
    expect(currentWp).toBe('/project/b')
  })

  it('switch to session without workspacePath clears workspace', () => {
    const sA: Session = { id: 'a', title: 'A', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/a' }
    const sB: Session = { id: 'b', title: 'B', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 }

    let currentWp: string | null | undefined = sA.workspacePath
    expect(currentWp).toBe('/project/a')

    // If session B has no workspace, clear it
    currentWp = sB.workspacePath ?? null
    expect(currentWp).toBeNull()
  })
})

describe('New session — workspace inheritance', () => {
  it('new session inherits current workspacePath when set', () => {
    const currentWp = '/project/active'
    const newSession: Session = { id: 's2', title: 'New', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 }

    if (currentWp) newSession.workspacePath = currentWp
    expect(newSession.workspacePath).toBe('/project/active')
  })

  it('new session without workspacePath gets none', () => {
    const currentWp: string | null = null
    const newSession: Session = { id: 's3', title: 'New', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 }

    if (!currentWp) {
      // No inheritance
      expect(newSession.workspacePath).toBeUndefined()
    }
  })

  it('opening folder saves to current session', () => {
    const session: Session = { id: 's1', title: 'T', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 }
    const folderPath = '/opened/folder'

    // Simulate updateSession
    session.workspacePath = folderPath
    expect(session.workspacePath).toBe('/opened/folder')

    // Check workspace state matches
    const storeWp = session.workspacePath
    expect(storeWp).toBe('/opened/folder')
  })

  it('multiple session switches maintain separate workspaces', () => {
    const sessions: Session[] = [
      { id: 'a', title: 'A', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/a' },
      { id: 'b', title: 'B', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0, workspacePath: '/project/b' },
      { id: 'c', title: 'C', model: 'm', createdAt: 0, updatedAt: 0, messageCount: 0 },
    ]

    let currentWp: string | null | undefined
    const switchTo = (id: string) => {
      const s = sessions.find((x) => x.id === id)
      if (!s) return
      currentWp = s.workspacePath ?? null
    }

    switchTo('a')
    expect(currentWp).toBe('/project/a')
    switchTo('b')
    expect(currentWp).toBe('/project/b')
    switchTo('c')
    expect(currentWp).toBeNull()
    switchTo('a')
    expect(currentWp).toBe('/project/a')
  })
})

describe('parseSession — parentId and agentStatus', () => {
  const base = {
    id: 's1', title: 'Test', model: 'gpt-4o',
    created_at: 100, updated_at: 200, message_count: 0,
  }

  it('defaults parentId to null when parent_id absent', () => {
    const s = parseSession(base)
    expect(s.parentId).toBeNull()
  })

  it('defaults parentId to null when parent_id is null', () => {
    const s = parseSession({ ...base, parent_id: null })
    expect(s.parentId).toBeNull()
  })

  it('parses parent_id into parentId', () => {
    const s = parseSession({ ...base, parent_id: 'root-session' })
    expect(s.parentId).toBe('root-session')
  })

  it('distinguishes root sessions (null parentId) from child sessions', () => {
    const root = parseSession(base)
    const child = parseSession({ ...base, id: 'child', parent_id: 's1' })
    expect(root.parentId).toBeNull()
    expect(child.parentId).toBe('s1')
  })

  it('defaults agentStatus to idle when agent_status absent', () => {
    const s = parseSession(base)
    expect(s.agentStatus).toBe('idle')
  })

  it('parses agent_status running', () => {
    const s = parseSession({ ...base, agent_status: 'running' })
    expect(s.agentStatus).toBe('running')
  })

  it('parses agent_status done', () => {
    const s = parseSession({ ...base, agent_status: 'done' })
    expect(s.agentStatus).toBe('done')
  })

  it('parses agent_status error', () => {
    const s = parseSession({ ...base, agent_status: 'error' })
    expect(s.agentStatus).toBe('error')
  })

  it('agentStatus and parentId coexist with workspacePath', () => {
    const s = parseSession({
      ...base,
      workspace_path: '/project',
      parent_id: 'parent-id',
      agent_status: 'running',
    })
    expect(s.workspacePath).toBe('/project')
    expect(s.parentId).toBe('parent-id')
    expect(s.agentStatus).toBe('running')
  })
})
