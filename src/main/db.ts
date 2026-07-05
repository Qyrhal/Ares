import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface DbSession {
  id: string
  title: string
  model: string
  created_at: number
  updated_at: number
  message_count?: number
  pinned?: boolean
  effort?: string
  permissionMode?: string
  workspace_path?: string
  parent_id?: string | null
  agent_status?: string
}

export interface DbMessage {
  id: string
  session_id: string
  role: string
  content: string
  attachments: string | null
  tool_name: string | null
  tool_status: string | null
  tool_input: string | null
  tool_output: string | null
  thinking: string | null
  created_at: number
}

export interface DbTodo {
  id: string
  session_id: string
  text: string
  completed: 0 | 1
  created_at: number
}

export interface DbSettings {
  apiKey: string
  apiBaseUrl: string
  defaultModel: string
  themeId: string
  systemPrompt: string
  permissionMode: string
}

export interface DbPiSkill {
  id: string
  name: string
  description: string
  content: string
}

export interface DbPiExtension {
  id: string
  name: string
  path: string
  enabled: boolean
}

export interface DbMcpServer {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
}

export interface DbSlashCommand {
  id: string
  name: string
  description: string
  prompt: string
  argumentHint?: string
  source: string
}

export interface DbAgentConfig {
  skills: DbPiSkill[]
  extensions: DbPiExtension[]
  mcpServers: DbMcpServer[]
  commands: DbSlashCommand[]
}

const DEFAULT_AGENT_CONFIG: DbAgentConfig = {
  skills: [],
  extensions: [],
  mcpServers: [],
  commands: [],
}

interface Store {
  sessions: DbSession[]
  messages: DbMessage[]
  todos: DbTodo[]
  settings: DbSettings
  workspacePath: string | null
  recentProjects: string[]
  agentConfig: DbAgentConfig
}

const DEFAULT_SETTINGS: DbSettings = {
  apiKey: '',
  apiBaseUrl: '',
  defaultModel: '',
  themeId: 'red',
  systemPrompt: '',
  permissionMode: 'ask',
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'ares-db.json')
}

function readStore(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(getStorePath(), 'utf-8'))
    return { todos: [], ...raw }
  } catch {
    return { sessions: [], messages: [], todos: [], settings: DEFAULT_SETTINGS, workspacePath: null, recentProjects: [], agentConfig: DEFAULT_AGENT_CONFIG }
  }
}

function writeStore(data: Store): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8')
}

// ── Sessions ────────────────────────────────────────────────────────────────

export function getSessions(): DbSession[] {
  const { sessions, messages } = readStore()
  return sessions
    .map((s) => ({ ...s, message_count: messages.filter((m) => m.session_id === s.id).length }))
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.updated_at - a.updated_at
    })
}

export function createSession(title: string, model = 'gpt-4o-mini', parentId?: string | null): DbSession {
  const store = readStore()
  const id = uuidv4()
  const now = Date.now()
  const session: DbSession = {
    id, title, model, created_at: now, updated_at: now,
    parent_id: parentId ?? null,
    agent_status: 'idle',
  }
  store.sessions.unshift(session)
  writeStore(store)
  return session
}

export function updateSession(
  id: string,
  updates: Partial<Pick<DbSession, 'title' | 'model' | 'pinned' | 'workspace_path' | 'effort' | 'permissionMode' | 'agent_status'>>
): void {
  const store = readStore()
  store.sessions = store.sessions.map((s) =>
    s.id === id ? { ...s, ...updates, updated_at: Date.now() } : s
  )
  writeStore(store)
}

export function deleteSession(id: string): void {
  const store = readStore()
  store.sessions = store.sessions.filter((s) => s.id !== id)
  store.messages = store.messages.filter((m) => m.session_id !== id)
  store.todos = (store.todos ?? []).filter((t) => t.session_id !== id)
  writeStore(store)
}

// ── Messages ─────────────────────────────────────────────────────────────────

export function getMessages(sessionId: string): DbMessage[] {
  return readStore().messages
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => a.created_at - b.created_at)
}

export function addMessage(
  sessionId: string,
  role: string,
  content: string,
  opts: {
    attachments?: object[]
    toolName?: string
    toolStatus?: string
    toolInput?: string
    toolOutput?: string
    thinking?: string
  } = {}
): DbMessage {
  const store = readStore()
  const id = uuidv4()
  const now = Date.now()
  const msg: DbMessage = {
    id, session_id: sessionId, role, content,
    attachments: opts.attachments ? JSON.stringify(opts.attachments) : null,
    tool_name: opts.toolName ?? null,
    tool_status: opts.toolStatus ?? null,
    tool_input: opts.toolInput ?? null,
    tool_output: opts.toolOutput ?? null,
    thinking: opts.thinking ?? null,
    created_at: now
  }
  store.messages.push(msg)
  store.sessions = store.sessions.map((s) =>
    s.id === sessionId ? { ...s, updated_at: now } : s
  )
  writeStore(store)
  return msg
}

export function deleteMessage(id: string): void {
  const store = readStore()
  store.messages = store.messages.filter((m) => m.id !== id)
  writeStore(store)
}

export function updateMessage(
  id: string,
  updates: Partial<Pick<DbMessage, 'tool_status' | 'tool_output' | 'content'>>
): void {
  const store = readStore()
  store.messages = store.messages.map((m) => m.id === id ? { ...m, ...updates } : m)
  writeStore(store)
}

// ── Todos ─────────────────────────────────────────────────────────────────────

export function getTodos(sessionId: string): DbTodo[] {
  const store = readStore()
  return (store.todos ?? [])
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.created_at - b.created_at)
}

export function addTodo(sessionId: string, text: string): DbTodo {
  const store = readStore()
  const todo: DbTodo = {
    id: uuidv4(),
    session_id: sessionId,
    text,
    completed: 0,
    created_at: Date.now(),
  }
  store.todos = [...(store.todos ?? []), todo]
  writeStore(store)
  return todo
}

export function updateTodo(id: string, updates: { text?: string; completed?: boolean }): void {
  const store = readStore()
  store.todos = (store.todos ?? []).map((t) => {
    if (t.id !== id) return t
    return {
      ...t,
      ...(updates.text !== undefined ? { text: updates.text } : {}),
      ...(updates.completed !== undefined ? { completed: updates.completed ? 1 : 0 as 0 | 1 } : {}),
    }
  })
  writeStore(store)
}

export function deleteTodo(id: string): void {
  const store = readStore()
  store.todos = (store.todos ?? []).filter((t) => t.id !== id)
  writeStore(store)
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSettings(): DbSettings {
  return { ...DEFAULT_SETTINGS, ...(readStore().settings ?? {}) }
}

export function setSettings(settings: DbSettings): void {
  const store = readStore()
  store.settings = settings
  writeStore(store)
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export function getWorkspacePath(): string | null {
  return readStore().workspacePath ?? null
}

export function setWorkspacePath(p: string | null): void {
  const store = readStore()
  store.workspacePath = p
  if (p) {
    const recents = store.recentProjects ?? []
    store.recentProjects = [p, ...recents.filter((r) => r !== p)].slice(0, 5)
  }
  writeStore(store)
}

export function getRecentProjects(): string[] {
  return readStore().recentProjects ?? []
}

// ── Agent config ──────────────────────────────────────────────────────────────

export function getAgentConfig(): DbAgentConfig {
  return { ...DEFAULT_AGENT_CONFIG, ...readStore().agentConfig }
}

export function setAgentConfig(config: DbAgentConfig): void {
  const store = readStore()
  store.agentConfig = config
  writeStore(store)
}
