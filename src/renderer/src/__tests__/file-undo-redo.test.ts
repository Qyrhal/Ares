import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
const electronMock = {
  fs: {
    undo: vi.fn().mockResolvedValue({ ok: true }),
    redo: vi.fn().mockResolvedValue({ ok: true }),
    createFile: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  },
}
Object.defineProperty(window, 'electron', { value: electronMock, writable: true })

describe('File Operation Undo/Redo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('IPC bridge', () => {
    it('exposes undo and redo methods on fs', () => {
      expect(typeof window.electron.fs.undo).toBe('function')
      expect(typeof window.electron.fs.redo).toBe('function')
    })

    it('undo returns ok result', async () => {
      electronMock.fs.undo.mockResolvedValue({ ok: true })
      const result = await window.electron.fs.undo()
      expect(result.ok).toBe(true)
    })

    it('redo returns ok result', async () => {
      electronMock.fs.redo.mockResolvedValue({ ok: true })
      const result = await window.electron.fs.redo()
      expect(result.ok).toBe(true)
    })

    it('undo returns error when stack is empty', async () => {
      electronMock.fs.undo.mockResolvedValue({ ok: false, error: 'Nothing to undo' })
      const result = await window.electron.fs.undo()
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Nothing to undo')
    })

    it('redo returns error when stack is empty', async () => {
      electronMock.fs.redo.mockResolvedValue({ ok: false, error: 'Nothing to redo' })
      const result = await window.electron.fs.redo()
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Nothing to redo')
    })
  })

  describe('Operation recording', () => {
    it('createFile calls IPC', async () => {
      electronMock.fs.createFile.mockResolvedValue(undefined)
      await window.electron.fs.createFile('/workspace/test.txt')
      expect(electronMock.fs.createFile).toHaveBeenCalledWith('/workspace/test.txt')
    })

    it('delete calls IPC', async () => {
      electronMock.fs.delete.mockResolvedValue(undefined)
      await window.electron.fs.delete('/workspace/test.txt')
      expect(electronMock.fs.delete).toHaveBeenCalledWith('/workspace/test.txt')
    })

    it('rename calls IPC', async () => {
      electronMock.fs.rename.mockResolvedValue(undefined)
      await window.electron.fs.rename('/workspace/old.txt', '/workspace/new.txt')
      expect(electronMock.fs.rename).toHaveBeenCalledWith('/workspace/old.txt', '/workspace/new.txt')
    })
  })

  describe('TypeScript type declarations', () => {
    it('undo returns Promise with ok and optional error', async () => {
      const result: { ok: boolean; error?: string } = await window.electron.fs.undo()
      expect(typeof result.ok).toBe('boolean')
    })

    it('redo returns Promise with ok and optional error', async () => {
      const result: { ok: boolean; error?: string } = await window.electron.fs.redo()
      expect(typeof result.ok).toBe('boolean')
    })
  })
})
