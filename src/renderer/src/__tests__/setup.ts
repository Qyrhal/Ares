import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── Electron context bridge mock ──────────────────────────────────────────────
const electronMock = {
  db: {
    getSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({ id: 's1', title: 'New session', model: 'gpt-4o-mini', created_at: Date.now(), updated_at: Date.now(), message_count: 0 }),
    updateSession: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    addMessage: vi.fn().mockResolvedValue(null),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
  },
  settings: {
    get: vi.fn().mockResolvedValue({ apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', themeId: 'red' }),
    set: vi.fn().mockResolvedValue(undefined),
  },
  workspace: {
    getPath: vi.fn().mockResolvedValue(null),
    setPath: vi.fn().mockResolvedValue(undefined),
  },
  dialog: {
    openFolder: vi.fn().mockResolvedValue(null),
  },
  fs: {
    readDir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    createFile: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  git: {
    status: vi.fn().mockResolvedValue({ hasRepo: false, branch: '', upstream: null, ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] }),
    stageFile: vi.fn(), unstageFile: vi.fn(), stageAll: vi.fn(), unstageAll: vi.fn(),
    discardFile: vi.fn(), commit: vi.fn(), push: vi.fn(), pull: vi.fn(),
    branches: vi.fn().mockResolvedValue({ local: [], current: '' }),
    checkout: vi.fn(), createBranch: vi.fn(), diff: vi.fn().mockResolvedValue(''), init: vi.fn(),
  },
  terminal: {
    create: vi.fn().mockResolvedValue('term-1'),
    write: vi.fn(),
    resize: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn(),
    onOutput: vi.fn().mockReturnValue(() => {}),
  },
}

Object.defineProperty(window, 'electron', { value: electronMock, writable: true })

// Expose for tests that need to reset/inspect mocks
;(globalThis as Record<string, unknown>).__electronMock = electronMock

// Silence console.error in tests (e.g. React prop type warnings)
vi.spyOn(console, 'error').mockImplementation(() => {})
