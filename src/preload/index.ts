import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const db = {
  getSessions: () => ipcRenderer.invoke('db:getSessions'),
  createSession: (title: string, model?: string, parentId?: string | null, isSideChat?: boolean) => ipcRenderer.invoke('db:createSession', title, model, parentId, isSideChat),
  updateSession: (id: string, updates: object) => ipcRenderer.invoke('db:updateSession', id, updates),
  deleteSession: (id: string) => ipcRenderer.invoke('db:deleteSession', id),
  getMessages: (sessionId: string) => ipcRenderer.invoke('db:getMessages', sessionId),
  addMessage: (sessionId: string, role: string, content: string, opts?: object) =>
    ipcRenderer.invoke('db:addMessage', sessionId, role, content, opts ?? {}),
  deleteMessage: (id: string) => ipcRenderer.invoke('db:deleteMessage', id),
  updateMessage: (id: string, updates: object) => ipcRenderer.invoke('db:updateMessage', id, updates),
  getTodos: (sessionId: string) => ipcRenderer.invoke('db:getTodos', sessionId),
  addTodo: (sessionId: string, text: string) => ipcRenderer.invoke('db:addTodo', sessionId, text),
  updateTodo: (id: string, updates: object) => ipcRenderer.invoke('db:updateTodo', id, updates),
  deleteTodo: (id: string) => ipcRenderer.invoke('db:deleteTodo', id),
  searchMessages: (query: string, filters?: { startDate?: number; endDate?: number }) => ipcRenderer.invoke('db:searchMessages', query, filters),
}

const settings = {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (s: object) => ipcRenderer.invoke('settings:set', s)
}

const workspace = {
  getPath: () => ipcRenderer.invoke('workspace:getPath'),
  setPath: (p: string | null) => ipcRenderer.invoke('workspace:setPath', p),
  getRecent: () => ipcRenderer.invoke('workspace:getRecent'),
}

const nativeDialog = {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder')
}

const nativeFs = {
  readDir: (p: string) => ipcRenderer.invoke('fs:readDir', p),
  readFile: (p: string) => ipcRenderer.invoke('fs:readFile', p),
  writeFile: (p: string, content: string) => ipcRenderer.invoke('fs:writeFile', p, content),
  createFile: (p: string) => ipcRenderer.invoke('fs:createFile', p),
  createFolder: (p: string) => ipcRenderer.invoke('fs:createFolder', p),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  delete: (p: string) => ipcRenderer.invoke('fs:delete', p),
  findFiles: (dir: string) => ipcRenderer.invoke('fs:findFiles', dir),
}

const nativeGit = {
  status:        (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  stageFile:     (cwd: string, p: string) => ipcRenderer.invoke('git:stageFile', cwd, p),
  unstageFile:   (cwd: string, p: string) => ipcRenderer.invoke('git:unstageFile', cwd, p),
  stageAll:      (cwd: string) => ipcRenderer.invoke('git:stageAll', cwd),
  unstageAll:    (cwd: string) => ipcRenderer.invoke('git:unstageAll', cwd),
  discardFile:   (cwd: string, p: string) => ipcRenderer.invoke('git:discardFile', cwd, p),
  commit:        (cwd: string, msg: string) => ipcRenderer.invoke('git:commit', cwd, msg),
  push:          (cwd: string) => ipcRenderer.invoke('git:push', cwd),
  pull:          (cwd: string) => ipcRenderer.invoke('git:pull', cwd),
  branches:      (cwd: string) => ipcRenderer.invoke('git:branches', cwd),
  checkout:      (cwd: string, branch: string) => ipcRenderer.invoke('git:checkout', cwd, branch),
  createBranch:  (cwd: string, branch: string) => ipcRenderer.invoke('git:createBranch', cwd, branch),
  diff:          (cwd: string, p: string, staged: boolean) => ipcRenderer.invoke('git:diff', cwd, p, staged),
  log:           (cwd: string, limit?: number) => ipcRenderer.invoke('git:log', cwd, limit),
  init:          (cwd: string) => ipcRenderer.invoke('git:init', cwd),
}

const checkpoint = {
  create: (cwd: string, msg: string) => ipcRenderer.invoke('checkpoint:create', cwd, msg),
  list:   (cwd: string) => ipcRenderer.invoke('checkpoint:list', cwd),
  restore:(cwd: string, idx: number) => ipcRenderer.invoke('checkpoint:restore', cwd, idx),
  drop:   (cwd: string, idx: number) => ipcRenderer.invoke('checkpoint:drop', cwd, idx),
  diff:   (cwd: string, idx: number) => ipcRenderer.invoke('checkpoint:diff', cwd, idx),
}

const nativeTerminal = {
  create: (cwd: string) => ipcRenderer.invoke('terminal:create', cwd),
  write:  (id: string, data: string) => ipcRenderer.send('terminal:input', id, data),
  resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  kill:   (id: string) => ipcRenderer.send('terminal:kill', id),
  onOutput: (cb: (id: string, data: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, id: string, data: string): void => cb(id, data)
    ipcRenderer.on('terminal:output', listener)
    return () => ipcRenderer.off('terminal:output', listener)
  }
}

const extApi = {
  fetchModels: (baseUrl: string, apiKey: string) => ipcRenderer.invoke('api:fetchModels', baseUrl, apiKey),
}

const piApi = {
  send: (reqId: string, sessionId: string, message: string, model: string, apiBaseUrl: string, apiKey: string, cwd: string | null) =>
    ipcRenderer.send('pi:send', reqId, sessionId, message, model, apiBaseUrl, apiKey, cwd),
  abort: (sessionId: string) => ipcRenderer.send('pi:abort', sessionId),
  cleanup: (sessionId: string) => ipcRenderer.send('pi:cleanup', sessionId),
  onDelta: (cb: (reqId: string, text: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, reqId: string, text: string): void => cb(reqId, text)
    ipcRenderer.on('pi:delta', listener)
    return () => ipcRenderer.off('pi:delta', listener)
  },
  onDone: (cb: (reqId: string, text: string, thinking?: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, reqId: string, text: string, thinking?: string): void => cb(reqId, text, thinking)
    ipcRenderer.on('pi:done', listener)
    return () => ipcRenderer.off('pi:done', listener)
  },
  onThinkingDelta: (cb: (reqId: string, text: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, reqId: string, text: string): void => cb(reqId, text)
    ipcRenderer.on('pi:thinking-delta', listener)
    return () => ipcRenderer.off('pi:thinking-delta', listener)
  },
  onToolStart: (cb: (reqId: string, name: string, input: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, reqId: string, name: string, input: string): void => cb(reqId, name, input)
    ipcRenderer.on('pi:tool-start', listener)
    return () => ipcRenderer.off('pi:tool-start', listener)
  },
  onToolEnd: (cb: (reqId: string, output: string, isError: boolean) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, reqId: string, output: string, isError: boolean): void => cb(reqId, output, isError)
    ipcRenderer.on('pi:tool-end', listener)
    return () => ipcRenderer.off('pi:tool-end', listener)
  },
  onError: (cb: (reqId: string, message: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, reqId: string, message: string): void => cb(reqId, message)
    ipcRenderer.on('pi:error', listener)
    return () => ipcRenderer.off('pi:error', listener)
  },
  onTodosUpdate: (cb: (sessionId: string, todos: unknown[]) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, sessionId: string, todos: unknown[]): void => cb(sessionId, todos)
    ipcRenderer.on('pi:todos-update', listener)
    return () => ipcRenderer.off('pi:todos-update', listener)
  },
  onAskUser: (cb: (sessionId: string, questionId: string, questionsJson: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, sessionId: string, questionId: string, questionsJson: string): void =>
      cb(sessionId, questionId, questionsJson)
    ipcRenderer.on('pi:ask-user', listener)
    return () => ipcRenderer.off('pi:ask-user', listener)
  },
  sendUserAnswer: (questionId: string, answers: Record<string, string>): void => {
    ipcRenderer.send('pi:user-response', questionId, JSON.stringify(answers))
  },
  onAgentSpawned: (cb: (session: unknown) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, session: unknown): void => cb(session)
    ipcRenderer.on('pi:agent-spawned', listener)
    return () => ipcRenderer.off('pi:agent-spawned', listener)
  },
  onCompaction: (cb: (sessionId: string, phase: 'start' | 'end') => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, sessionId: string, phase: 'start' | 'end'): void => cb(sessionId, phase)
    ipcRenderer.on('pi:compaction', listener)
    return () => ipcRenderer.off('pi:compaction', listener)
  },
  onAgentStatus: (cb: (sessionId: string, status: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, sessionId: string, status: string): void => cb(sessionId, status)
    ipcRenderer.on('pi:agent-status', listener)
    return () => ipcRenderer.off('pi:agent-status', listener)
  },
  onSessionComplete: (cb: (sessionId: string, title: string, summary: string, childIds: string[]) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, sessionId: string, title: string, summary: string, childIds: string[]): void =>
      cb(sessionId, title, summary, childIds)
    ipcRenderer.on('pi:session-complete', listener)
    return () => ipcRenderer.off('pi:session-complete', listener)
  },
  spawnFromUi: (parentSessionId: string, task: string, title: string) =>
    ipcRenderer.invoke('pi:spawn-from-ui', parentSessionId, task, title),
}

const nativeTools = {
  readFile:    (p: string) => ipcRenderer.invoke('tools:readFile', p),
  writeFile:   (p: string, content: string) => ipcRenderer.invoke('tools:writeFile', p, content),
  editFile:    (p: string, oldString: string, newString: string) => ipcRenderer.invoke('tools:editFile', p, oldString, newString),
  createFile:  (p: string, content: string) => ipcRenderer.invoke('tools:createFile', p, content),
  listFiles:   (dir: string) => ipcRenderer.invoke('tools:listFiles', dir),
}

const agentConfigApi = {
  get: () => ipcRenderer.invoke('agentConfig:get'),
  set: (config: object) => ipcRenderer.invoke('agentConfig:set', config),
  onScanResult: (cb: (result: { skills: number; extensions: number; mcpServers: number; commands: number }) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, result: { skills: number; extensions: number; mcpServers: number; commands: number }): void => cb(result)
    ipcRenderer.on('agentConfig:scanResult', listener)
    return () => ipcRenderer.off('agentConfig:scanResult', listener)
  },
}

const mcpProfilesApi = {
  list: () => ipcRenderer.invoke('mcpProfiles:list'),
  save: (profile: object) => ipcRenderer.invoke('mcpProfiles:save', profile),
  delete: (id: string) => ipcRenderer.invoke('mcpProfiles:delete', id),
}

// ── LSP ────────────────────────────────────────────────────────────────────

const lspApi = {
  diagnostics: (filePath: string) => ipcRenderer.invoke('lsp:diagnostics', filePath),
  hasSupport:  () => ipcRenderer.invoke('lsp:hasSupport'),
}

// ── Hooks ──────────────────────────────────────────────────────────────────

const hooksApi = {
  get: () => ipcRenderer.invoke('hooks:get'),
  set: (hooks: unknown[]) => ipcRenderer.invoke('hooks:set', hooks),
}

// ── Session export/import ──────────────────────────────────────────────────

const sessionApi = {
  export: (title: string, id: string, messages: unknown[]) => ipcRenderer.invoke('session:export', title, id, messages),
  import: () => ipcRenderer.invoke('session:import'),
}

// ── MCP ────────────────────────────────────────────────────────────────────

const mcpApi = {
  status: () => ipcRenderer.invoke('mcp:status'),
}

const shellApi = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
}

const inlineEditApi = {
  apply: (code: string, instruction: string, model: string, apiBaseUrl: string, apiKey: string) =>
    ipcRenderer.invoke('inlineEdit:apply', code, instruction, model, apiBaseUrl, apiKey),
}

const api = { db, settings, workspace, dialog: nativeDialog, fs: nativeFs, git: nativeGit, terminal: nativeTerminal, ext: extApi, tools: nativeTools, pi: piApi, agentConfig: agentConfigApi, mcpProfiles: mcpProfilesApi, checkpoint, lsp: lspApi, hooks: hooksApi, session: sessionApi, mcp: mcpApi, shell: shellApi, inlineEdit: inlineEditApi }

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', api)
} else {
  // @ts-ignore
  window.electron = api
}
