import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const db = {
  getSessions: () => ipcRenderer.invoke('db:getSessions'),
  createSession: (title: string, model?: string) => ipcRenderer.invoke('db:createSession', title, model),
  updateSession: (id: string, updates: object) => ipcRenderer.invoke('db:updateSession', id, updates),
  deleteSession: (id: string) => ipcRenderer.invoke('db:deleteSession', id),
  getMessages: (sessionId: string) => ipcRenderer.invoke('db:getMessages', sessionId),
  addMessage: (sessionId: string, role: string, content: string, opts?: object) =>
    ipcRenderer.invoke('db:addMessage', sessionId, role, content, opts ?? {}),
  deleteMessage: (id: string) => ipcRenderer.invoke('db:deleteMessage', id)
}

const settings = {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (s: object) => ipcRenderer.invoke('settings:set', s)
}

const workspace = {
  getPath: () => ipcRenderer.invoke('workspace:getPath'),
  setPath: (p: string | null) => ipcRenderer.invoke('workspace:setPath', p)
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

const api = { db, settings, workspace, dialog: nativeDialog, fs: nativeFs, git: nativeGit, terminal: nativeTerminal }

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', api)
} else {
  // @ts-ignore
  window.electron = api
}
