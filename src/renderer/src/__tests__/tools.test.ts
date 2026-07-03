import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeTool, toApiMessage, SKILL_PROMPT, needsPermission } from '@/hooks/useAI'
import type { Message } from '@/types'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executeTool', () => {
  it('readFile reads and returns file contents', async () => {
    window.electron.tools.readFile = vi.fn().mockResolvedValue('hello world')
    const result = await executeTool('readFile', { path: '/test.txt' })
    expect(result).toBe('hello world')
    expect(window.electron.tools.readFile).toHaveBeenCalledWith('/test.txt')
  })

  it('writeFile writes content and returns confirmation', async () => {
    await executeTool('writeFile', { path: '/test.txt', content: 'new content' })
    expect(window.electron.tools.writeFile).toHaveBeenCalledWith('/test.txt', 'new content')
  })

  it('editFile performs find-and-replace and returns confirmation', async () => {
    await executeTool('editFile', { path: '/test.ts', oldString: 'foo', newString: 'bar' })
    expect(window.electron.tools.editFile).toHaveBeenCalledWith('/test.ts', 'foo', 'bar')
  })

  it('createFile creates and returns confirmation', async () => {
    await executeTool('createFile', { path: '/new.ts', content: 'code' })
    expect(window.electron.tools.createFile).toHaveBeenCalledWith('/new.ts', 'code')
  })

  it('listFiles returns directory listing as JSON', async () => {
    const files = [{ name: 'a.ts', path: '/a.ts', isDirectory: false }]
    window.electron.tools.listFiles = vi.fn().mockResolvedValue(files)
    const result = await executeTool('listFiles', { dir: '/src' })
    expect(result).toBe(JSON.stringify(files, null, 2))
    expect(window.electron.tools.listFiles).toHaveBeenCalledWith('/src')
  })

  it('unknown tool returns error message', async () => {
    const result = await executeTool('unknownTool', {})
    expect(result).toBe('Unknown tool: unknownTool')
  })

  it('readFile propagates errors', async () => {
    window.electron.tools.readFile = vi.fn().mockRejectedValue(new Error('not found'))
    await expect(executeTool('readFile', { path: '/missing.txt' })).rejects.toThrow('not found')
  })
})

describe('toApiMessage', () => {
  it('converts user message', () => {
    const msg: Message = { id: '1', sessionId: 's1', role: 'user', content: 'hello', createdAt: 0 }
    expect(toApiMessage(msg)).toEqual({ role: 'user', content: 'hello' })
  })

  it('converts assistant message', () => {
    const msg: Message = { id: '1', sessionId: 's1', role: 'assistant', content: 'hi', createdAt: 0 }
    expect(toApiMessage(msg)).toEqual({ role: 'assistant', content: 'hi' })
  })

  it('converts tool message with toolName and toolOutput', () => {
    const msg: Message = { id: '1', sessionId: 's1', role: 'tool', content: '', toolName: 'call_xxx', toolOutput: 'result', createdAt: 0 }
    expect(toApiMessage(msg)).toEqual({ role: 'tool', content: 'result', tool_call_id: 'call_xxx' })
  })

  it('converts assistant message with toolName to tool_calls format', () => {
    const msg: Message = { id: '1', sessionId: 's1', role: 'assistant', content: '', toolName: 'call_xxx', toolInput: '{"path":"/x.ts"}', createdAt: 0 }
    expect(toApiMessage(msg)).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_xxx', function: { name: 'call_xxx', arguments: '{"path":"/x.ts"}' }, type: 'function' }],
    })
  })
})

describe('SKILL_PROMPT', () => {
  it('mentions all five tools', () => {
    expect(SKILL_PROMPT).toContain('readFile')
    expect(SKILL_PROMPT).toContain('writeFile')
    expect(SKILL_PROMPT).toContain('editFile')
    expect(SKILL_PROMPT).toContain('createFile')
    expect(SKILL_PROMPT).toContain('listFiles')
  })
})

describe('needsPermission', () => {
  it('ask mode requires permission for readFile', () => {
    expect(needsPermission('ask', 'readFile')).toBe(true)
  })

  it('ask mode requires permission for writeFile', () => {
    expect(needsPermission('ask', 'writeFile')).toBe(true)
  })

  it('auto mode skips permission for readFile', () => {
    expect(needsPermission('auto', 'readFile')).toBe(false)
  })

  it('auto mode skips permission for listFiles', () => {
    expect(needsPermission('auto', 'listFiles')).toBe(false)
  })

  it('auto mode requires permission for writeFile', () => {
    expect(needsPermission('auto', 'writeFile')).toBe(true)
  })

  it('auto mode requires permission for editFile', () => {
    expect(needsPermission('auto', 'editFile')).toBe(true)
  })

  it('auto mode requires permission for createFile', () => {
    expect(needsPermission('auto', 'createFile')).toBe(true)
  })

  it('yolo mode skips permission for anything', () => {
    expect(needsPermission('yolo', 'writeFile')).toBe(false)
    expect(needsPermission('yolo', 'editFile')).toBe(false)
    expect(needsPermission('yolo', 'createFile')).toBe(false)
  })
})
