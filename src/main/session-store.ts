import { app, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'

/**
 * Session sharing — export/import conversations (inspired by OpenCode).
 *
 * Exports: saves a session + its messages as a standalone JSON file.
 * Imports: loads a session from a JSON file into the app's database.
 */

interface ExportedSession {
  formatVersion: 1
  exportedAt: string
  appVersion: string
  session: {
    title: string
    model: string
    messages: Array<{
      role: string
      content: string
      toolName?: string
      toolInput?: string
      toolOutput?: string
      thinking?: string
      createdAt: number
    }>
  }
}

/**
 * Validate an exported session structure.
 */
function isValidExported(data: unknown): data is ExportedSession {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (d.formatVersion !== 1) return false
  if (!d.session || typeof d.session !== 'object') return false
  const s = d.session as Record<string, unknown>
  if (typeof s.title !== 'string') return false
  if (!Array.isArray(s.messages)) return false
  return true
}

/**
 * Export a session to a JSON file.
 * @returns The file path if saved, null if cancelled.
 */
export async function exportSession(
  sessionTitle: string,
  sessionId: string,
  messages: Array<{
    role: string
    content: string
    toolName?: string
    toolInput?: string
    toolOutput?: string
    thinking?: string
    createdAt: number
  }>
): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return null

  const result = await dialog.showSaveDialog(win, {
    title: 'Export Session',
    defaultPath: `ares-session-${sessionTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 40)}.json`,
    filters: [
      { name: 'Ares Session', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (result.canceled || !result.filePath) return null

  const pkg = require(path.join(app.getAppPath(), 'package.json'))
  const exported: ExportedSession = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: pkg.version || '0.1.0',
    session: {
      title: sessionTitle,
      model: '',
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        toolName: m.toolName,
        toolInput: m.toolInput,
        toolOutput: m.toolOutput,
        thinking: m.thinking,
        createdAt: m.createdAt,
      })),
    },
  }

  fs.writeFileSync(result.filePath, JSON.stringify(exported, null, 2), 'utf-8')
  return result.filePath
}

/**
 * Import a session from a JSON file.
 * @returns Parsed session data, or null if cancelled/invalid.
 */
export async function importSession(): Promise<{
  title: string
  messages: ExportedSession['session']['messages']
} | null> {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return null

  const result = await dialog.showOpenDialog(win, {
    title: 'Import Session',
    filters: [
      { name: 'Ares Session', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) return null

  try {
    const raw = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'))
    if (!isValidExported(raw)) {
      throw new Error('Invalid session file format')
    }
    return {
      title: raw.session.title,
      messages: raw.session.messages,
    }
  } catch (e) {
    throw new Error(`Failed to import session: ${(e as Error).message}`)
  }
}
