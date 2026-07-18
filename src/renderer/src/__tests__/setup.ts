// NOTE: vi.mock() calls must be at file top — vitest hoists them before imports
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock xterm for TerminalView tests — use plain constructor functions
// (vi.fn() is not available in hoisted vi.mock factory context)
vi.mock('@xterm/xterm', () => {
  function MockTerminal() {
    this.loadAddon = function() {}
    this.open = function() {}
    this.focus = function() {}
    this.write = function() {}
    this.clear = function() {}
    this.onData = function() { return function() {} }
    this.onResize = function() { return function() {} }
    this.dispose = function() {}
    this.cols = 80
    this.rows = 24
  }
  return { Terminal: MockTerminal as unknown as typeof import('@xterm/xterm').Terminal }
})

vi.mock('@xterm/addon-fit', () => {
  function MockFitAddon() {
    this.fit = function() {}
    this.dispose = function() {}
  }
  return { FitAddon: MockFitAddon as unknown as typeof import('@xterm/addon-fit').FitAddon }
})

const electronMock = {
  db: {
    getSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({ id: 's1', title: 'New session', model: 'gpt-4o-mini', created_at: Date.now(), updated_at: Date.now(), message_count: 0, is_side_chat: false }),
    updateSession: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    addMessage: vi.fn().mockResolvedValue(null),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    getTodos: vi.fn().mockResolvedValue([]),
    addTodo: vi.fn().mockResolvedValue({ id: 't1', session_id: 's1', text: 'todo', completed: 0, created_at: Date.now() }),
    updateTodo: vi.fn().mockResolvedValue(undefined),
    deleteTodo: vi.fn().mockResolvedValue(undefined),
    searchMessages: vi.fn().mockResolvedValue([]),
  },
  settings: {
    get: vi.fn().mockResolvedValue({ apiKey: '', apiBaseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3', themeId: 'red', systemPrompt: '', permissionMode: 'ask', maxSubagentSpawns: 200, maxWebSearches: 200 }),
    set: vi.fn().mockResolvedValue(undefined),
  },
  workspace: {
    getPath: vi.fn().mockResolvedValue(null),
    setPath: vi.fn().mockResolvedValue(undefined),
    getRecent: vi.fn().mockResolvedValue([]),
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
    findFiles: vi.fn().mockResolvedValue([]),
  },
  git: {
    status: vi.fn().mockResolvedValue({ hasRepo: false, branch: '', upstream: null, ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] }),
    stageFile: vi.fn(), unstageFile: vi.fn(), stageAll: vi.fn(), unstageAll: vi.fn(),
    discardFile: vi.fn(), commit: vi.fn(), push: vi.fn(), pull: vi.fn(),
    branches: vi.fn().mockResolvedValue({ local: [], current: '' }),
    checkout: vi.fn(), createBranch: vi.fn(), diff: vi.fn().mockResolvedValue(''), init: vi.fn(),
    log: vi.fn().mockResolvedValue([]),
  },
  terminal: {
    create: vi.fn().mockResolvedValue('term-1'),
    write: vi.fn(),
    resize: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn(),
    onOutput: vi.fn().mockReturnValue(() => {}),
  },
  ext: {
    fetchModels: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4o' }] }),
  },
  pi: {
    send: vi.fn(),
    abort: vi.fn(),
    cleanup: vi.fn(),
    onDelta: vi.fn().mockReturnValue(() => {}),
    onDone: vi.fn().mockReturnValue(() => {}),
    onToolStart: vi.fn().mockReturnValue(() => {}),
    onToolEnd: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue(() => {}),
    onThinkingDelta: vi.fn().mockReturnValue(() => {}),
    onTodosUpdate: vi.fn().mockReturnValue(() => {}),
    onAskUser: vi.fn().mockReturnValue(() => {}),
    onAgentSpawned: vi.fn().mockReturnValue(() => {}),
    onAgentStatus: vi.fn().mockReturnValue(() => {}),
    onCompaction: vi.fn().mockReturnValue(() => {}),
    onMcpAutoBackground: vi.fn().mockReturnValue(() => {}),
    onMcpToolBackgroundResult: vi.fn().mockReturnValue(() => {}),
    onSessionComplete: vi.fn().mockReturnValue(() => {}),
    sendUserAnswer: vi.fn(),
  },
  tools: {
    readFile: vi.fn().mockResolvedValue('file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    editFile: vi.fn().mockResolvedValue(undefined),
    createFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([{ name: 'test.ts', path: '/test.ts', isDirectory: false }]),
  },
  agentConfig: {
    get: vi.fn().mockResolvedValue({ skills: [], extensions: [], mcpServers: [], commands: [] }),
    set: vi.fn().mockResolvedValue(undefined),
    onScanResult: vi.fn().mockReturnValue(() => {}),
  },
  mcpProfiles: {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  checkpoint: {
    create: vi.fn().mockResolvedValue({ id: 'stash@{0}', index: 0, message: 'test', date: '', branch: 'main' }),
    list: vi.fn().mockResolvedValue([]),
    restore: vi.fn().mockResolvedValue({ ok: true }),
    drop: vi.fn().mockResolvedValue({ ok: true }),
    diff: vi.fn().mockResolvedValue('diff --git a/test.ts b/test.ts\n+new code'),
  },
  lsp: {
    diagnostics: vi.fn().mockResolvedValue([]),
    hasSupport: vi.fn().mockResolvedValue(true),
  },
  hooks: {
    get: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue(undefined),
  },
  session: {
    export: vi.fn().mockResolvedValue('/tmp/export.json'),
    import: vi.fn().mockResolvedValue(null),
  },
  mcp: {
    status: vi.fn().mockResolvedValue([]),
  },
}

Object.defineProperty(window, 'electron', { value: electronMock, writable: true })
;(globalThis as Record<string, unknown>).__electronMock = electronMock

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock ResizeObserver — plain constructor, NOT vi.fn (needs new)
globalThis.ResizeObserver = class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
