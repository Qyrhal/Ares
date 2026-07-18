import { app, BrowserWindow, ipcMain, shell, dialog, session } from 'electron'
import type NodePty from 'node-pty'
import { join } from 'path'
import fs from 'fs'
import nodePath from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  getSessions, createSession, updateSession, deleteSession,
  getMessages, addMessage, deleteMessage, updateMessage,
  searchMessages,
  getTodos, addTodo, updateTodo, deleteTodo,
  getSettings, setSettings, getWorkspacePath, setWorkspacePath, getRecentProjects,
  getAgentConfig, setAgentConfig,
  getMcpProfiles, saveMcpProfile, deleteMcpProfile,
} from './db'
import { handlePiSend, handlePiAbort, cleanupPiSession, clearAllPiSessions, getMcpStatus, resolveUserQuestion } from './pi'
import { runBackgroundScan } from './scanner'
import {
  getStatus, stageFile, unstageFile, stageAll, unstageAll,
  discardFile, commit, push, pull,
  getBranches, checkoutBranch, createBranch, getFileDiff,
  getLog, initRepo,
} from './git'
import {
  createCheckpoint, listCheckpoints, restoreCheckpoint,
  dropCheckpoint, diffCheckpoint,
} from './checkpoints'
import { getDiagnostics, hasLspSupport } from './lsp'
import { getHooks, setHooks } from './hooks'
import { exportSession, importSession } from './session-store'

// E2E tests point this at a temp dir so runs never touch real app data
if (process.env.ARES_USER_DATA) {
  app.setPath('userData', process.env.ARES_USER_DATA)
}

const ptyProcesses = new Map<string, NodePty.IPty>()
let nextTerminalId = 1

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
    title: 'Ares',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.once('did-finish-load', () => {
    setTimeout(() => runBackgroundScan(win), 1000)
  })

  // Bypass CORS only for configured API endpoints (OpenAI SDK, etc.)
  const corsHeaders = {
    'Access-Control-Allow-Origin': ['*'],
    'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, PATCH, OPTIONS'],
    'Access-Control-Allow-Headers': ['*'],
    'Access-Control-Max-Age': ['86400'],
  }

  /** Check if a request URL belongs to a configured API endpoint. */
  function isApiEndpoint(url: string): boolean {
    try {
      const settings = getSettings()
      const allowedBases: string[] = []

      if (settings.apiBaseUrl) allowedBases.push(settings.apiBaseUrl)
      if (settings.providers) {
        for (const p of settings.providers) {
          if (p.baseUrl) allowedBases.push(p.baseUrl)
        }
      }

      if (allowedBases.length === 0) return false

      const reqHost = new URL(url).hostname
      for (const base of allowedBases) {
        try {
          if (new URL(base).hostname === reqHost) return true
        } catch {
          // skip malformed base
        }
      }
    } catch {
      // malformed request URL
    }
    return false
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isApiEndpoint(details.url)) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        ...corsHeaders,
      },
    })
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('http')) { e.preventDefault(); shell.openExternal(url) }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ares.app')
  if (process.platform === 'darwin') {
    app.dock.setIcon(join(__dirname, '../../resources/icon.png'))
  }
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w, { zoom: true }))
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Path validation: restrict file IPC operations to safe directories
import os from 'os'
function validatePath(p: string): void {
  const resolved = nodePath.resolve(p)
  // Resolve symlinks to prevent traversal via symlinked paths
  let real: string
  try {
    real = fs.realpathSync(resolved)
  } catch {
    // Path doesn't exist yet — resolve its closest existing ancestor
    let dir = resolved
    while (!fs.existsSync(dir)) {
      const parent = nodePath.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    try {
      real = fs.existsSync(dir) ? nodePath.join(fs.realpathSync(dir), nodePath.relative(dir, resolved)) : resolved
    } catch {
      real = resolved
    }
  }
  const workspace = getWorkspacePath()
  const home = os.homedir()
  const allowed = [home]
  if (workspace) allowed.push(workspace)
  const isInAllowed = allowed.some((dir) => real.startsWith(dir + nodePath.sep) || real === dir)
  if (!isInAllowed) {
    throw new Error(`Access denied: path outside workspace (${real})`)
  }
}

function registerIpcHandlers(): void {
  // DB – sessions
  ipcMain.handle('db:getSessions', (_, includeArchived?: boolean) => getSessions(includeArchived))
  ipcMain.handle('db:createSession', (_, title: string, model?: string, parentId?: string | null, isSideChat?: boolean) => createSession(title, model, parentId, isSideChat))
  ipcMain.handle('db:updateSession', (_, id: string, updates: object) =>
    updateSession(id, updates as Parameters<typeof updateSession>[1]))
  ipcMain.handle('db:deleteSession', (_, id: string) => {
    cleanupPiSession(id)
    return deleteSession(id)
  })

  // DB – messages
  ipcMain.handle('db:getMessages', (_, sessionId: string) => getMessages(sessionId))
  ipcMain.handle('db:addMessage', (_, sessionId: string, role: string, content: string, opts: object) =>
    addMessage(sessionId, role, content, opts as Parameters<typeof addMessage>[3]))
  ipcMain.handle('db:deleteMessage', (_, id: string) => deleteMessage(id))
  ipcMain.handle('db:updateMessage', (_, id: string, updates: object) => updateMessage(id, updates as any))

  // DB – todos
  ipcMain.handle('db:getTodos', (_, sessionId: string) => getTodos(sessionId))
  ipcMain.handle('db:addTodo', (_, sessionId: string, text: string) => addTodo(sessionId, text))
  ipcMain.handle('db:updateTodo', (_, id: string, updates: object) => updateTodo(id, updates as { text?: string; completed?: boolean }))
  ipcMain.handle('db:deleteTodo', (_, id: string) => deleteTodo(id))

  // DB – search
  ipcMain.handle('db:searchMessages', (_, query: string, filters?: { startDate?: number; endDate?: number }) => searchMessages(query, filters))

  // Settings
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_, s: object) => setSettings(s as Parameters<typeof setSettings>[0]))

  ipcMain.handle('agentConfig:get', () => getAgentConfig())
  ipcMain.handle('agentConfig:set', (_, config: object) => {
    setAgentConfig(config as Parameters<typeof setAgentConfig>[0])
    clearAllPiSessions()
  })

  // MCP Profiles
  ipcMain.handle('mcpProfiles:list', () => getMcpProfiles())
  ipcMain.handle('mcpProfiles:save', (_, profile: object) => {
    saveMcpProfile(profile as Parameters<typeof saveMcpProfile>[0])
  })
  ipcMain.handle('mcpProfiles:delete', (_, id: string) => deleteMcpProfile(id))

  // Workspace
  ipcMain.handle('workspace:getPath', () => getWorkspacePath())
  ipcMain.handle('workspace:setPath', (_, p: string | null) => setWorkspacePath(p))
  ipcMain.handle('workspace:getRecent', () => getRecentProjects())

  // Dialog
  ipcMain.handle('dialog:openFolder', async (_event) => {
    const [win] = BrowserWindow.getAllWindows()
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // File system
  ipcMain.handle('fs:readDir', (_, p: string) => { validatePath(p); return readDir(p) })
  ipcMain.handle('fs:readFile', (_, p: string) => { validatePath(p); return fs.readFileSync(p, 'utf-8') })
  ipcMain.handle('fs:writeFile', (_, p: string, content: string) => {
    validatePath(p)
    fs.writeFileSync(p, content, 'utf-8')
  })
  ipcMain.handle('fs:createFile', (_, p: string) => {
    validatePath(p)
    fs.writeFileSync(p, '', { flag: 'wx' })
  })
  ipcMain.handle('fs:createFolder', (_, p: string) => {
    validatePath(p)
    fs.mkdirSync(p)
  })
  ipcMain.handle('fs:rename', (_, oldPath: string, newPath: string) => {
    validatePath(oldPath)
    validatePath(newPath)
    fs.renameSync(oldPath, newPath)
  })
  ipcMain.handle('fs:delete', (_, p: string) => {
    validatePath(p)
    fs.rmSync(p, { recursive: true, force: true })
  })
  ipcMain.handle('fs:findFiles', (_, dir: string) => {
    validatePath(dir)
    const results: string[] = []
    const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.cache', '__pycache__', '.venv'])
    function walk(d: string) {
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        if (SKIP.has(e.name)) continue
        if (e.name.startsWith('.')) continue
        const full = d + '/' + e.name
        if (e.isDirectory()) walk(full)
        else results.push(full)
      }
    }
    walk(dir)
    return results.slice(0, 500)
  })

  // Git
  ipcMain.handle('git:status',         (_, cwd: string) => { validatePath(cwd); return getStatus(cwd) })
  ipcMain.handle('git:stageFile',      (_, cwd: string, p: string) => { validatePath(cwd); return stageFile(cwd, p) })
  ipcMain.handle('git:unstageFile',    (_, cwd: string, p: string) => { validatePath(cwd); return unstageFile(cwd, p) })
  ipcMain.handle('git:stageAll',       (_, cwd: string) => { validatePath(cwd); return stageAll(cwd) })
  ipcMain.handle('git:unstageAll',     (_, cwd: string) => { validatePath(cwd); return unstageAll(cwd) })
  ipcMain.handle('git:discardFile',    (_, cwd: string, p: string) => { validatePath(cwd); return discardFile(cwd, p) })
  ipcMain.handle('git:commit',         (_, cwd: string, msg: string) => { validatePath(cwd); return commit(cwd, msg) })
  ipcMain.handle('git:push',           (_, cwd: string) => { validatePath(cwd); return push(cwd) })
  ipcMain.handle('git:pull',           (_, cwd: string) => { validatePath(cwd); return pull(cwd) })
  ipcMain.handle('git:branches',       (_, cwd: string) => { validatePath(cwd); return getBranches(cwd) })
  ipcMain.handle('git:checkout',       (_, cwd: string, branch: string) => { validatePath(cwd); return checkoutBranch(cwd, branch) })
  ipcMain.handle('git:createBranch',   (_, cwd: string, branch: string) => { validatePath(cwd); return createBranch(cwd, branch) })
  ipcMain.handle('git:diff',           (_, cwd: string, p: string, staged: boolean) => { validatePath(cwd); return getFileDiff(cwd, p, staged) })
  ipcMain.handle('git:log',            (_, cwd: string, limit?: number) => { validatePath(cwd); return getLog(cwd, limit) })
  ipcMain.handle('git:init',           (_, cwd: string) => { validatePath(cwd); return initRepo(cwd) })

  // Checkpoints — git stash-backed undo snapshots (inspired by Claude Code)
  ipcMain.handle('checkpoint:create',  (_, cwd: string, msg: string) => { validatePath(cwd); return createCheckpoint(cwd, msg) })
  ipcMain.handle('checkpoint:list',    (_, cwd: string) => { validatePath(cwd); return listCheckpoints(cwd) })
  ipcMain.handle('checkpoint:restore', (_, cwd: string, idx: number) => { validatePath(cwd); return restoreCheckpoint(cwd, idx) })
  ipcMain.handle('checkpoint:drop',    (_, cwd: string, idx: number) => { validatePath(cwd); return dropCheckpoint(cwd, idx) })
  ipcMain.handle('checkpoint:diff',    (_, cwd: string, idx: number) => { validatePath(cwd); return diffCheckpoint(cwd, idx) })

  // LSP — language server diagnostics (inspired by OpenCode + Claude Code)
  ipcMain.handle('lsp:diagnostics', async (_, filePath: string) => getDiagnostics(filePath))
  ipcMain.handle('lsp:hasSupport', () => hasLspSupport())

  // Hooks — lifecycle events (inspired by Claude Code)
  ipcMain.handle('hooks:get', () => getHooks())
  ipcMain.handle('hooks:set', (_, hooks: Parameters<typeof setHooks>[0]) => setHooks(hooks))

  // Session export/import (inspired by OpenCode)
  ipcMain.handle('session:export', async (_, title: string, id: string, messages: any[]) =>
    exportSession(title, id, messages))
  ipcMain.handle('session:import', async () => {
    try { return await importSession() }
    catch (e) { return { error: (e as Error).message } }
  })

  // MCP status
  ipcMain.handle('mcp:status', () => getMcpStatus())

  // API — proxy fetch through main process to avoid CORS
  ipcMain.handle('api:fetchModels', async (_, baseUrl: string, apiKey: string) => {
    const url = baseUrl.replace(/\/$/, '') + '/models'
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    return res.json()
  })

  // Inline AI edit — calls chat completions to transform code
  ipcMain.handle('inlineEdit:apply', async (_, code: string, instruction: string, model: string, apiBaseUrl: string, apiKey: string) => {
    const url = (apiBaseUrl.replace(/\/$/, '')) + '/chat/completions'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    const body = {
      model: model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a code editing assistant. Given a code snippet and an instruction, return ONLY the modified code with no explanation, no markdown formatting, no backticks. Preserve the original language, style, and conventions.',
        },
        {
          role: 'user',
          content: `Code:\n\`\`\`\n${code}\n\`\`\`\n\nInstruction: ${instruction}`,
        },
      ],
      temperature: 0.1,
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    const json = await res.json()
    const content: string = json.choices?.[0]?.message?.content ?? ''
    // Strip any markdown code fence wrapping the LLM might include
    return content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  })
  ipcMain.handle('tools:readFile', async (_, p: string) => {
    validatePath(p)
    return fs.readFileSync(p, 'utf-8')
  })
  ipcMain.handle('tools:writeFile', async (_, p: string, content: string) => {
    validatePath(p)
    fs.mkdirSync(nodePath.dirname(p), { recursive: true })
    fs.writeFileSync(p, content, 'utf-8')
  })
  ipcMain.handle('tools:editFile', async (_, p: string, oldString: string, newString: string) => {
    validatePath(p)
    const content = fs.readFileSync(p, 'utf-8')
    if (!content.includes(oldString)) {
      throw new Error(`Could not find "${oldString.slice(0, 50)}..." in ${p}`)
    }
    const updated = content.replace(oldString, newString)
    fs.writeFileSync(p, updated, 'utf-8')
  })
  ipcMain.handle('tools:createFile', async (_, p: string, content: string) => {
    validatePath(p)
    fs.mkdirSync(nodePath.dirname(p), { recursive: true })
    fs.writeFileSync(p, content, 'utf-8')
  })
  ipcMain.handle('tools:listFiles', async (_, dir: string) => {
    validatePath(dir)
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => ({ name: e.name, path: nodePath.join(dir, e.name), isDirectory: e.isDirectory() }))
  })

  // Terminal
  ipcMain.handle('terminal:create', (_, cwd: string) => {
    if (cwd) validatePath(cwd)
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return ''
    const id = `term-${nextTerminalId++}`
    try {
      const nodePty = require('node-pty') as typeof NodePty
      const shellBin = process.env.SHELL || '/bin/zsh'
      const pty = nodePty.spawn(shellBin, [], {
        name: 'xterm-256color',
        cwd: cwd || process.env.HOME || '/',
        env: { ...process.env } as Record<string, string>,
        cols: 80,
        rows: 24,
      })
      pty.onData((data) => {
        if (!win.isDestroyed()) win.webContents.send('terminal:output', id, data)
      })
      pty.onExit(() => { ptyProcesses.delete(id) })
      ptyProcesses.set(id, pty)
      return id
    } catch (err) {
      const msg = `\r\n\x1b[31mFailed to start terminal: ${(err as Error).message}\x1b[0m\r\n`
      if (!win.isDestroyed()) win.webContents.send('terminal:output', id, msg)
      return id
    }
  })
  ipcMain.on('terminal:input',  (_, id: string, data: string) => { ptyProcesses.get(id)?.write(data) })
  ipcMain.handle('terminal:resize', (_, id: string, cols: number, rows: number) => { ptyProcesses.get(id)?.resize(cols, rows) })
  ipcMain.on('terminal:kill',   (_, id: string) => {
    const pty = ptyProcesses.get(id)
    if (pty) { try { pty.kill() } catch (_e) {} ptyProcesses.delete(id) }
  })

  // Pi agent
  ipcMain.on('pi:send', (event, reqId: string, sessionId: string, message: string, model: string, apiBaseUrl: string, apiKey: string, cwd: string | null) => {
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return
    handlePiSend(win, reqId, sessionId, message, model, apiBaseUrl, apiKey, cwd).catch((err) => {
      if (!win.isDestroyed()) win.webContents.send('pi:error', reqId, (err as Error).message)
    })
  })
  ipcMain.on('pi:abort', (_, sessionId: string) => { handlePiAbort(sessionId).catch(() => {}) })
  ipcMain.on('pi:cleanup', (_, sessionId: string) => { cleanupPiSession(sessionId) })
  ipcMain.on('pi:user-response', (_, questionId: string, answersJson: string) => {
    try { resolveUserQuestion(questionId, JSON.parse(answersJson)) } catch { /* ignore malformed */ }
  })
  ipcMain.handle('pi:spawn-from-ui', async (_, parentSessionId: string, task: string, title: string) => {
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return null
    const { getSettings } = await import('./db')
    const { getSession } = await import('./db')
    const parent = getSession(parentSessionId)
    if (!parent) return null
    const { defaultModel, apiBaseUrl, apiKey } = getSettings()
    const { createSession, addMessage, updateSession } = await import('./db')
    const childDb = createSession(title, parent.model || defaultModel, parentSessionId)
    addMessage(childDb.id, 'user', task)
    updateSession(childDb.id, { agent_status: 'running' })
    if (!win.isDestroyed()) {
      win.webContents.send('pi:agent-spawned', childDb)
      win.webContents.send('pi:agent-status', childDb.id, 'running')
    }
    // Run via Pi SDK so it has tools, skills, etc.
    const { handlePiSend } = await import('./pi')
    // We do a lightweight version: send the task as a user message
    handlePiSend(win, childDb.id, childDb.id, task, parent.model || defaultModel, apiBaseUrl, apiKey, null).catch((err: Error) => {
      if (!win.isDestroyed()) win.webContents.send('pi:error', childDb.id, err.message)
    })
    return { ...childDb, parent_id: parentSessionId }
  })
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Blocked URL with protocol: ${parsed.protocol}`)
      }
      const { shell } = await import('electron')
      shell.openExternal(url)
    } catch (err) {
      if (!(err instanceof TypeError)) throw err
      throw new Error(`Invalid URL: ${url}`)
    }
  })
}
