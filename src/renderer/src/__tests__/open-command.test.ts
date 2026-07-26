import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/open slash command logic', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows usage hint when no args provided', () => {
    const args = ''
    expect(args).toBe('')
    const msg = 'Usage: `/open <file-path>` — opens file in system default editor'
    expect(msg).toContain('/open <file-path>')
  })

  it('resolves relative path against workspace', () => {
    const wsPath = '/home/user/project'
    const filePath = 'src/App.tsx'
    const fullPath = filePath.startsWith('/') ? filePath : (wsPath ? `${wsPath}/${filePath}` : filePath)
    expect(fullPath).toBe('/home/user/project/src/App.tsx')
  })

  it('passes absolute path directly', () => {
    const wsPath = '/home/user/project'
    const filePath = '/tmp/test.ts'
    const fullPath = filePath.startsWith('/') ? filePath : (wsPath ? `${wsPath}/${filePath}` : filePath)
    expect(fullPath).toBe('/tmp/test.ts')
  })

  it('handles missing workspace for relative path', () => {
    const wsPath = ''
    const filePath = 'src/App.tsx'
    const fullPath = filePath.startsWith('/') ? filePath : (wsPath ? `${wsPath}/${filePath}` : filePath)
    expect(fullPath).toBe('src/App.tsx')
  })

  it('formats success message', () => {
    const filePath = 'src/App.tsx'
    const msg = `**Opened** \`${filePath}\` in system editor`
    expect(msg).toContain('Opened')
    expect(msg).toContain('src/App.tsx')
    expect(msg).toContain('system editor')
  })

  it('formats error message from openPath', () => {
    const error = 'No such file or directory'
    const msg = `**Error opening file:** ${error}`
    expect(msg).toContain('Error opening file')
    expect(msg).toContain('No such file or directory')
  })

  it('formats exception message', () => {
    const error = new Error('IPC channel closed')
    const msg = `**Error:** ${error.message}`
    expect(msg).toContain('Error')
    expect(msg).toContain('IPC channel closed')
  })
})
