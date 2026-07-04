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
