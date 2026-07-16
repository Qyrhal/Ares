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
  is_side_chat?: boolean
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
  reply_to: string | null
  reactions: string | null
  created_at: number
}

export interface DbTodo {
  id: string
  session_id: string
  text: string
  completed: 0 | 1
  created_at: number
}

export interface DbTeamNote {
  id: string
  root_session_id: string
  from_session_id: string
  from_title: string
  note: string
  created_at: number
}

export interface DbSettings {
  apiKey: string
  apiBaseUrl: string
  defaultModel: string
  themeId: string
  colorMode?: string
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

export interface DbMcpProfile {
  id: string
  name: string
  servers: DbMcpServer[]
  created_at: number
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
  teamNotes: DbTeamNote[]
  settings: DbSettings
  workspacePath: string | null
  recentProjects: string[]
  agentConfig: DbAgentConfig
  mcpProfiles: DbMcpProfile[]
}

const DEFAULT_SETTINGS: DbSettings = {
  apiKey: '',
  apiBaseUrl: '',
  defaultModel: '',
  themeId: 'steel',
  systemPrompt: `You are Ares, an AI coding agent with full orchestration capabilities.

## Orchestration workflow — follow this for every substantive task

1. **Clarify first** — use askUser before starting any non-trivial task. Ask 1–3 focused questions. Use chip options where the answer space is bounded. Do not ask mid-task.

2. **Plan immediately** — call setTodos right after clarifying, before doing any work. List every step. As you finish EACH item, immediately call setTodos again marking just that item completed:true before moving to the next — never batch multiple completions into one call at the end. If you start a genuinely new, unrelated plan, call setTodos with ONLY the new items — this fully replaces the old list, so don't carry stale items forward. The plan is always visible to the user.

3. **Delegate in parallel** — break the work into independent subtasks and spawn them concurrently with spawnAgents. Give each sub-agent a complete, self-contained brief — all context it needs to finish without asking back. Use shareWithTeam to broadcast anything other agents in the tree should know (conventions, blockers, findings); check getTeamNotes before starting work if you suspect a teammate already found something relevant.

4. **Recover from sub-agent failures** — if a spawned sub-agent errors, you'll get its recent activity and its agentId in the result. Use messageAgent({ agentId, message }) to send corrective instructions and resume that same sub-agent, rather than starting over from scratch. Sub-agents' own clarifying questions are answered automatically on your behalf — you won't be interrupted for them.

5. **Finish with notifyComplete** — after all work is done, write a concise recap in your message then call notifyComplete. This shows a completion toast and cleans up the Agent Tree.

## Tool reference

**setTodos({ todos: [{ text, completed }] })**
Set or update the task plan shown above the chat. Call at the very start of every task. Mark items complete one at a time, immediately after finishing each — don't wait until the end. Starting an unrelated plan? Pass only its items; this replaces the whole list.

**askUser({ questions: [{ question, header, options?, multiSelect? }] })**
Ask the user questions via an interactive chip form. Blocks until submitted. Use at the start — never mid-task. header must be ≤12 chars. (Only reaches a human for top-level sessions — a sub-agent's askUser is answered automatically by the orchestrator's context, no human involved.)

**spawnAgent({ task, title })**
Spawn one sub-agent for a sequential subtask. Blocks until finished, returns its output.

**spawnAgents({ agents: [{ task, title }] })**
Spawn multiple sub-agents in parallel. All run concurrently; blocks until all finish. Prefer this over repeated spawnAgent calls when tasks are independent.

**messageAgent({ agentId, message })**
Send a follow-up message to a sub-agent you spawned and get its response — use this to correct and resume one that errored, or to keep directing a specific sub-agent instead of spawning a new one.

**shareWithTeam({ note })** / **getTeamNotes({})**
Broadcast a finding to every agent in the current task tree (orchestrator + all sub-agents), or read what's been shared so far. New sub-agents automatically receive existing team notes in their task briefing.

**Mermaid diagrams**
Write a fenced \`\`\`mermaid code block to visualize architecture, a flow, a sequence of calls, or a data model — it renders live in the chat. Use this instead of describing in prose what a diagram would show more clearly.

**notifyComplete({ title, summary })**
Call when the entire goal is accomplished. Shows a completion toast. title is a short label; summary is 2–4 sentences of what was done. Always call this at the end.

## Rules

- Always call setTodos before starting any work, and mark each item done immediately as you finish it — not in a batch at the end.
- Always use askUser when the request is ambiguous — before spawning agents.
- Prefer spawnAgents for independent subtasks (frontend + backend + tests in parallel).
- Sub-agents should be self-contained — give them everything they need upfront; use shareWithTeam for anything siblings should also know.
- If a sub-agent errors, use messageAgent to correct and resume it before giving up on it.
- Use a mermaid diagram whenever a picture would explain a structure or flow better than prose.
- Always end a completed orchestration with notifyComplete.
- Write your recap in the assistant message, then call notifyComplete.`,
  permissionMode: 'ask',
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'ares-db.json')
}

function readStore(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(getStorePath(), 'utf-8'))
    return { todos: [], teamNotes: [], ...raw }
  } catch {
    return { sessions: [], messages: [], todos: [], teamNotes: [], mcpProfiles: [], settings: DEFAULT_SETTINGS, workspacePath: null, recentProjects: [], agentConfig: DEFAULT_AGENT_CONFIG }
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

export function createSession(title: string, model = 'gpt-4o-mini', parentId?: string | null, isSideChat = false): DbSession {
  const store = readStore()
  const id = uuidv4()
  const now = Date.now()
  const session: DbSession = {
    id, title, model, created_at: now, updated_at: now,
    parent_id: parentId ?? null,
    agent_status: 'idle',
    is_side_chat: isSideChat,
  }
  store.sessions.unshift(session)
  writeStore(store)
  return session
}

export function updateSession(
  id: string,
  updates: Partial<Pick<DbSession, 'title' | 'model' | 'pinned' | 'workspace_path' | 'effort' | 'permissionMode' | 'agent_status' | 'is_side_chat'>>
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
  store.teamNotes = (store.teamNotes ?? []).filter((n) => n.root_session_id !== id && n.from_session_id !== id)
  writeStore(store)
}

// ── Messages ─────────────────────────────────────────────────────────────────

export interface SearchResult {
  sessionId: string
  sessionTitle: string
  messageId: string
  content: string
  role: string
}

export function searchMessages(query: string, filters?: { startDate?: number; endDate?: number }): SearchResult[] {
  const q = query.toLowerCase()
  const results: SearchResult[] = []
  const store = readStore()

  const startMs = filters?.startDate ?? 0
  const endMs = filters?.endDate ?? Infinity

  for (const s of store.sessions) {
    // Date filter: check session createdAt falls within the range
    const sessionTime = s.created_at ?? 0
    if (sessionTime < startMs || sessionTime > endMs) continue

    if (q && s.title.toLowerCase().includes(q)) {
      results.push({ sessionId: s.id, sessionTitle: s.title, messageId: '', content: '(session title match)', role: '' })
    }
    if (!q) continue // when no query, don't search messages
    const sessionMessages = store.messages.filter((m) => m.session_id === s.id)
    for (const m of sessionMessages) {
      if (m.content?.toLowerCase().includes(q)) {
        results.push({ sessionId: s.id, sessionTitle: s.title, messageId: m.id, content: m.content.slice(0, 200), role: m.role })
      }
    }
  }
  return results.slice(0, 100)
}

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
    replyTo?: { id: string; content: string; role: string }
    reactions?: { up: boolean | null }
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
    reply_to: opts.replyTo ? JSON.stringify(opts.replyTo) : null,
    reactions: opts.reactions ? JSON.stringify(opts.reactions) : null,
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
  updates: Partial<Pick<DbMessage, 'tool_status' | 'tool_output' | 'content' | 'reactions' | 'reply_to' | 'created_at'>>
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

export function replaceTodos(sessionId: string, items: { text: string; completed?: boolean }[]): DbTodo[] {
  const store = readStore()
  store.todos = (store.todos ?? []).filter((t) => t.session_id !== sessionId)
  const now = Date.now()
  const newTodos: DbTodo[] = items.map((item, i) => ({
    id: uuidv4(),
    session_id: sessionId,
    text: item.text,
    completed: item.completed ? 1 : 0,
    created_at: now + i,
  }))
  store.todos = [...store.todos, ...newTodos]
  writeStore(store)
  return newTodos
}

// ── Team notes ────────────────────────────────────────────────────────────────
// Shared scratchpad for an orchestration tree (root session + all its
// descendants), so sub-agents can pass information to each other and back
// to the orchestrator without needing a live connection between them.

export function addTeamNote(rootSessionId: string, fromSessionId: string, fromTitle: string, note: string): DbTeamNote {
  const store = readStore()
  const entry: DbTeamNote = {
    id: uuidv4(),
    root_session_id: rootSessionId,
    from_session_id: fromSessionId,
    from_title: fromTitle,
    note,
    created_at: Date.now(),
  }
  store.teamNotes = [...(store.teamNotes ?? []), entry]
  writeStore(store)
  return entry
}

export function getTeamNotes(rootSessionId: string): DbTeamNote[] {
  return (readStore().teamNotes ?? [])
    .filter((n) => n.root_session_id === rootSessionId)
    .sort((a, b) => a.created_at - b.created_at)
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

// ── MCP Profiles ──────────────────────────────────────────────────────────────

export function getMcpProfiles(): DbMcpProfile[] {
  return readStore().mcpProfiles ?? []
}

export function saveMcpProfile(profile: DbMcpProfile): void {
  const store = readStore()
  const idx = store.mcpProfiles.findIndex((p) => p.id === profile.id)
  if (idx >= 0) {
    store.mcpProfiles[idx] = profile
  } else {
    store.mcpProfiles.push(profile)
  }
  writeStore(store)
}

export function deleteMcpProfile(id: string): void {
  const store = readStore()
  store.mcpProfiles = store.mcpProfiles.filter((p) => p.id !== id)
  writeStore(store)
}
