import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import nodePath from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  getSessions, createSession, updateSession, deleteSession,
  getMessages, addMessage, deleteMessage,
  getSettings, setSettings, getWorkspacePath, setWorkspacePath
} from './db'
import {
  getStatus, stageFile, unstageFile, stageAll, unstageAll,
  discardFile, commit, push, pull,
  getBranches, checkoutBranch, createBranch, getFileDiff, initRepo
} from './git'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

const EXCLUDED = new Set([
  '.git', 'node_modules', '.DS_Store', 'dist', 'out', '.next',
  '__pycache__', '.cache', '.venv', 'venv', 'build', 'coverage'
])

function readDir(dirPath: string, depth = 0): FileNode[] {
  if (depth > 5) return []
  try {
    return fs.readdirSync(dirPath)
      .filter((name) => !EXCLUDED.has(name) && !name.startsWith('.'))
      .map((name): FileNode | null => {
        const fullPath = nodePath.join(dirPath, name)
        try {
          const stat = fs.statSync(fullPath)
          if (stat.isDirectory()) {
            return { name, path: fullPath, type: 'directory', children: readDir(fullPath, depth + 1) }
          }
          return { name, path: fullPath, type: 'file' }
        } catch { return null }
      })
      .filter((n): n is FileNode => n !== null)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch { return [] }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ares.app')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpcHandlers(): void {
  // DB – sessions
  ipcMain.handle('db:getSessions', () => getSessions())
  ipcMain.handle('db:createSession', (_, title: string, model?: string) => createSession(title, model))
  ipcMain.handle('db:updateSession', (_, id: string, updates: object) =>
    updateSession(id, updates as Parameters<typeof updateSession>[1]))
  ipcMain.handle('db:deleteSession', (_, id: string) => deleteSession(id))

  // DB – messages
  ipcMain.handle('db:getMessages', (_, sessionId: string) => getMessages(sessionId))
  ipcMain.handle('db:addMessage', (_, sessionId: string, role: string, content: string, opts: object) =>
    addMessage(sessionId, role, content, opts as Parameters<typeof addMessage>[3]))
  ipcMain.handle('db:deleteMessage', (_, id: string) => deleteMessage(id))

  // Settings
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_, s: object) => setSettings(s as Parameters<typeof setSettings>[0]))

  // Workspace
  ipcMain.handle('workspace:getPath', () => getWorkspacePath())
  ipcMain.handle('workspace:setPath', (_, p: string | null) => setWorkspacePath(p))

  // Dialog
  ipcMain.handle('dialog:openFolder', async (_event) => {
    const [win] = BrowserWindow.getAllWindows()
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // File system
  ipcMain.handle('fs:readDir', (_, p: string) => readDir(p))
  ipcMain.handle('fs:readFile', (_, p: string) => fs.readFileSync(p, 'utf-8'))
  ipcMain.handle('fs:writeFile', (_, p: string, content: string) => {
    fs.writeFileSync(p, content, 'utf-8')
  })
  ipcMain.handle('fs:createFile', (_, p: string) => {
    fs.writeFileSync(p, '', { flag: 'wx' })
  })
  ipcMain.handle('fs:createFolder', (_, p: string) => {
    fs.mkdirSync(p)
  })
  ipcMain.handle('fs:rename', (_, oldPath: string, newPath: string) => {
    fs.renameSync(oldPath, newPath)
  })
  ipcMain.handle('fs:delete', (_, p: string) => {
    fs.rmSync(p, { recursive: true, force: true })
  })

  // Git
  ipcMain.handle('git:status',         (_, cwd: string) => getStatus(cwd))
  ipcMain.handle('git:stageFile',      (_, cwd: string, p: string) => stageFile(cwd, p))
  ipcMain.handle('git:unstageFile',    (_, cwd: string, p: string) => unstageFile(cwd, p))
  ipcMain.handle('git:stageAll',       (_, cwd: string) => stageAll(cwd))
  ipcMain.handle('git:unstageAll',     (_, cwd: string) => unstageAll(cwd))
  ipcMain.handle('git:discardFile',    (_, cwd: string, p: string) => discardFile(cwd, p))
  ipcMain.handle('git:commit',         (_, cwd: string, msg: string) => commit(cwd, msg))
  ipcMain.handle('git:push',           (_, cwd: string) => push(cwd))
  ipcMain.handle('git:pull',           (_, cwd: string) => pull(cwd))
  ipcMain.handle('git:branches',       (_, cwd: string) => getBranches(cwd))
  ipcMain.handle('git:checkout',       (_, cwd: string, branch: string) => checkoutBranch(cwd, branch))
  ipcMain.handle('git:createBranch',   (_, cwd: string, branch: string) => createBranch(cwd, branch))
  ipcMain.handle('git:diff',           (_, cwd: string, p: string, staged: boolean) => getFileDiff(cwd, p, staged))
  ipcMain.handle('git:init',           (_, cwd: string) => initRepo(cwd))
}
