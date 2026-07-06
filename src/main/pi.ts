// Pi packages are ESM-only. Rollup rewrites literal import('...') to require() for external
// modules even with dynamicImportInCjs:false. Wrapping in new Function() makes the call
// opaque to Rollup's static analysis, so Node.js executes the real ESM import() at runtime.
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { app, BrowserWindow } from 'electron'
import * as nodeModule from 'module'
import fs from 'fs'
import path from 'path'
import { getAgentConfig, getSettings, replaceTodos, createSession, updateSession, addMessage } from './db'
import { createCheckpoint } from './checkpoints'

// Pi's bundled undici does `const { markAsUncloneable } = require('node:worker_threads')`.
// markAsUncloneable was added in Node.js 22; Electron 33 ships Node.js 20.
// The worker_threads exports object is frozen so we can't patch it directly.
// Instead, hook Module._load to return a Proxy that adds the missing function.
;(function patchWorkerThreads() {
  // nodeModule is a frozen ESM namespace wrapper — use .default to get the raw CJS Module object
  const M = (nodeModule as any).default as any
  const orig = M._load?.bind(M)
  if (!orig) return
  M._load = function (request: string, parent: unknown, isMain: boolean) {
    const mod = orig(request, parent, isMain)
    if (
      (request === 'worker_threads' || request === 'node:worker_threads') &&
      mod && typeof mod.markAsUncloneable !== 'function'
    ) {
      return new Proxy(mod, {
        get(target, prop) {
          if (prop === 'markAsUncloneable') return () => {}
          const v = (target as any)[prop]
          return typeof v === 'function' ? v.bind(target) : v
        },
        // Silently ignore writes to the non-extensible worker_threads module
        set() { return true },
      })
    }
    return mod
  }
}())

const esmImport = new Function('spec', 'return import(spec)') as (spec: string) => Promise<any>

let _sdk: typeof import('@earendil-works/pi-coding-agent') | undefined

async function sdk() {
  return (_sdk ??= await esmImport('@earendil-works/pi-coding-agent'))
}

type McpClientType = { close(): Promise<void> }

type SessionEntry = {
  session: AgentSession
  settingsKey: string
  mcpClients: McpClientType[]
}

const sessions = new Map<string, SessionEntry>()

// ── askUser pending resolvers ─────────────────────────────────────────────────

const pendingQuestions = new Map<string, (answers: Record<string, string>) => void>()

export function resolveUserQuestion(questionId: string, answers: Record<string, string>): void {
  const resolver = pendingQuestions.get(questionId)
  if (resolver) {
    resolver(answers)
    pendingQuestions.delete(questionId)
  }
}

// ── MCP connection status ─────────────────────────────────────────────────────

export interface McpConnectionStatus {
  name: string
  connected: boolean
  error?: string
  toolCount: number
}

// Tracks the most recent MCP connection results across all sessions
let lastMcpResults: McpConnectionStatus[] = []

export function getMcpStatus(): McpConnectionStatus[] {
  return lastMcpResults
}

function updateMcpStatus(results: McpConnectionStatus[]): void {
  lastMcpResults = results
}

// ── Pi session file persistence ────────────────────────────────────────────────
// We keep a JSON map from Ares sessionId → Pi session file path so that
// conversation history survives app restarts.

let _piSessionDir: string | undefined
function piSessionDir(): string {
  if (!_piSessionDir) {
    _piSessionDir = path.join(app.getPath('userData'), 'pi-sessions')
    fs.mkdirSync(_piSessionDir, { recursive: true })
  }
  return _piSessionDir
}

const piSessionMapFile = (): string => path.join(app.getPath('userData'), 'pi-session-map.json')

function readPiSessionMap(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(piSessionMapFile(), 'utf-8')) }
  catch { return {} }
}

function recordPiSessionFile(aresId: string, filePath: string): void {
  const map = readPiSessionMap()
  map[aresId] = filePath
  fs.writeFileSync(piSessionMapFile(), JSON.stringify(map), 'utf-8')
}

function getStoredPiFile(aresId: string): string | undefined {
  return readPiSessionMap()[aresId]
}

function settingsKey(apiBaseUrl: string, apiKey: string, modelId: string): string {
  return `${apiBaseUrl}|${apiKey}|${modelId}`
}

async function buildResourceLoader(cwd: string) {
  const { DefaultResourceLoader, getAgentDir, SettingsManager } = await sdk()
  const config = getAgentConfig()
  const agentDir = getAgentDir()

  const skillsDir = path.join(app.getPath('userData'), 'ares-skills')
  fs.mkdirSync(skillsDir, { recursive: true })

  // Sync skill files: write current skills, remove stale ones
  const expectedFiles = new Set(config.skills.map((s) => `${s.id}.md`))
  for (const f of fs.readdirSync(skillsDir)) {
    if (!expectedFiles.has(f)) fs.rmSync(path.join(skillsDir, f), { force: true })
  }
  for (const skill of config.skills) {
    const header = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n`
    fs.writeFileSync(path.join(skillsDir, `${skill.id}.md`), header + skill.content, 'utf-8')
  }

  const enabledExtPaths = config.extensions.filter((e) => e.enabled).map((e) => e.path)

  const settingsManager = SettingsManager.create(cwd, agentDir)
  const { systemPrompt } = getSettings()
  const aresPrompt = [
    '## Ares Agent Protocol',
    '',
    'You have access to several custom tools. Use them appropriately:',
    '',
    '### setTodos — Plan Mode',
    'ALWAYS call setTodos at the start of any multi-step task. Show your plan as a checklist. Update it as you progress (mark items completed: true). The user sees this as a live progress tracker.',
    '',
    '### webSearch — Web Search',
    'Use webSearch to look up current information, docs, APIs, news, or anything outside your training data. Results come from DuckDuckGo. Always cite sources.',
    '',
    '### spawnAgent / spawnAgents — Sub-agents',
    'Decompose complex work into independent subtasks and use spawnAgent (sequential) or spawnAgents (parallel) to delegate. Each sub-agent gets its own session and appears in the Agent Tree. Use spawnAgents only for truly independent subtasks.',
    '',
    '### askUser — Questions',
    'Ask the user when you need clarification, preferences, or decisions. Provide concrete options when possible. Do NOT ask yes/no questions that the user could infer from context.',
    '',
    '### notifyComplete — Done Signal',
    'Call this ONLY when the ENTIRE goal is satisfied. Not for milestones.',
    '',
    '### Workflow',
    '1. Understand the request',
    '2. Call setTodos to show your plan',
    '3. Work through items — use spawnAgent/spawnAgents for subtasks, askUser for clarification',
    '4. When ALL items are done, call notifyComplete',
  ].join('\n')
  const fullSystemPrompt = systemPrompt.trim()
    ? `${systemPrompt.trim()}\n\n${aresPrompt}`
    : aresPrompt
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    additionalSkillPaths: config.skills.length > 0 ? [skillsDir] : [],
    additionalExtensionPaths: enabledExtPaths,
    noContextFiles: true,
    ...(fullSystemPrompt.trim() ? { appendSystemPrompt: [fullSystemPrompt.trim()] } : {}),
  })
  await loader.reload()
  return loader
}

async function buildMcpTools(): Promise<{ tools: any[]; clients: McpClientType[] }> {
  const config = getAgentConfig()
  const enabled = config.mcpServers.filter((s) => s.enabled)
  if (enabled.length === 0) {
    updateMcpStatus([])
    return { tools: [], clients: [] }
  }

  // CJS require works for MCP SDK
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')

  const tools: any[] = []
  const clients: McpClientType[] = []
  const statuses: McpConnectionStatus[] = []

  for (const server of enabled) {
    try {
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: { ...process.env, ...server.env },
        stderr: 'pipe',
      })
      const client = new Client({ name: 'ares', version: '1.0.0' }, { capabilities: {} })
      await client.connect(transport)
      clients.push(client)

      const { tools: mcpTools } = await client.listTools()
      for (const t of mcpTools) {
        tools.push({
          name: t.name,
          description: t.description ?? '',
          parameters: t.inputSchema ?? { type: 'object', properties: {} },
          async execute(_id: string, params: unknown, _signal: unknown) {
            const result = await client.callTool({ name: t.name, arguments: params as Record<string, unknown> })
            const text = (result.content as any[])
              .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
              .join('\n')
            return { content: [{ type: 'text', text }], details: result }
          },
        })
      }
      statuses.push({ name: server.name, connected: true, toolCount: mcpTools.length })
    } catch (err) {
      console.error(`[ares] MCP server "${server.name}" failed to connect:`, (err as Error).message)
      statuses.push({ name: server.name, connected: false, error: (err as Error).message, toolCount: 0 })
    }
  }

  updateMcpStatus(statuses)
  return { tools, clients }
}

async function getOrCreate(
  win: BrowserWindow,
  sessionId: string,
  apiBaseUrl: string,
  apiKey: string,
  modelId: string,
  cwd: string | null,
): Promise<AgentSession> {
  const { createAgentSession, AuthStorage, ModelRegistry, SessionManager } = await sdk()

  const key = settingsKey(apiBaseUrl, apiKey, modelId)
  const existing = sessions.get(sessionId)
  if (existing?.settingsKey === key) return existing.session

  // Settings changed (or first call) — dispose old session and create fresh one
  if (existing) {
    disposeEntry(existing)
    sessions.delete(sessionId)
  }

  const authStorage = AuthStorage.inMemory()
  const modelRegistry = ModelRegistry.inMemory(authStorage)

  // Register the user's OpenAI-compatible endpoint as a custom provider
  const providerId = 'openai-compat'
  modelRegistry.registerProvider(providerId, {
    baseUrl: apiBaseUrl.replace(/\/$/, ''),
    apiKey: apiKey || undefined,
    api: 'openai-completions' as any,
    models: [{
      id: modelId,
      name: modelId,
      api: 'openai-completions' as any,
      reasoning: false,
      input: ['text' as const],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 16_384,
    }],
  })

  const model = modelRegistry.find(providerId, modelId)!
  const effectiveCwd = cwd || process.cwd()

  const [resourceLoader, { tools: mcpTools, clients: mcpClients }] = await Promise.all([
    buildResourceLoader(effectiveCwd),
    buildMcpTools(),
  ])

  // Restore Pi session from disk if it exists so conversation history survives restarts
  let sessionManager: InstanceType<typeof SessionManager>
  const savedPiFile = getStoredPiFile(sessionId)
  if (savedPiFile && fs.existsSync(savedPiFile)) {
    sessionManager = SessionManager.open(savedPiFile, piSessionDir(), effectiveCwd)
  } else {
    sessionManager = SessionManager.create(effectiveCwd, piSessionDir())
    const sessionFile = sessionManager.getSessionFile()
    if (sessionFile) recordPiSessionFile(sessionId, sessionFile)
  }

  // Tracks child session IDs so notifyComplete can clean them up
  const childSessionIds: string[] = []

  const askUserTool = {
    name: 'askUser',
    description: 'Ask the user one or more questions with optional multiple-choice chips. Use this when you need clarification before proceeding. The user sees an interactive form; the call blocks until they submit.',
    parameters: {
      type: 'object' as const,
      properties: {
        questions: {
          type: 'array' as const,
          description: 'The questions to ask (1-4)',
          items: {
            type: 'object' as const,
            properties: {
              question:    { type: 'string' as const, description: 'Full question text' },
              header:      { type: 'string' as const, description: 'Short chip label (≤12 chars)' },
              options:     { type: 'array' as const, items: { type: 'string' as const }, description: '2-4 choice options (omit for free-text only)' },
              multiSelect: { type: 'boolean' as const, description: 'Allow selecting multiple options', default: false },
            },
            required: ['question', 'header'],
          },
        },
      },
      required: ['questions'],
    },
    async execute(_id: string, params: unknown) {
      const { questions } = params as { questions: Array<{ question: string; header: string; options?: string[]; multiSelect?: boolean }> }
      const questionId = crypto.randomUUID()

      return new Promise<{ content: [{ type: 'text'; text: string }] }>((resolve) => {
        pendingQuestions.set(questionId, (answers) => {
          const formatted = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')
          resolve({ content: [{ type: 'text', text: formatted }] })
        })
        if (!win.isDestroyed()) {
          win.webContents.send('pi:ask-user', sessionId, questionId, JSON.stringify(questions))
        }
      })
    },
  }

  const spawnAgentTool = {
    name: 'spawnAgent',
    description: 'Spawn a sub-agent to handle a focused subtask. Use this when a task can be cleanly decomposed into independent subtasks that each need focused attention. The sub-agent runs with the same model, tools, and workspace; it appears in the Agent Tree as a child session. This call BLOCKS until the sub-agent finishes. Good candidates: research a specific API, write a self-contained function, analyze one file, draft a section. AVOID: tasks needing ongoing coordination with the parent or access to parent-only context.',
    parameters: {
      type: 'object' as const,
      properties: {
        task:  { type: 'string' as const, description: 'Full task description for the sub-agent' },
        title: { type: 'string' as const, description: 'Short title shown in the Agent Tree (≤40 chars)' },
      },
      required: ['task', 'title'],
    },
    async execute(_id: string, params: unknown) {
      const { task, title } = params as { task: string; title: string }

      const childDb = createSession(title, modelId, sessionId)
      childSessionIds.push(childDb.id)
      addMessage(childDb.id, 'user', task)
      updateSession(childDb.id, { agent_status: 'running' })

      if (!win.isDestroyed()) {
        win.webContents.send('pi:agent-spawned', childDb)
        win.webContents.send('pi:agent-status', childDb.id, 'running')
      }

      let accumulated = ''
      try {
        const childPiSession = await getOrCreate(win, childDb.id, apiBaseUrl, apiKey, modelId, cwd)
        const unsub = childPiSession.subscribe((event: any) => {
          if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
            accumulated += event.assistantMessageEvent.delta
          }
        })
        try {
          await childPiSession.prompt(task)
        } finally {
          unsub()
        }
        if (accumulated) addMessage(childDb.id, 'assistant', accumulated)
        updateSession(childDb.id, { agent_status: 'done' })
        if (!win.isDestroyed()) win.webContents.send('pi:agent-status', childDb.id, 'done')
        return { content: [{ type: 'text' as const, text: accumulated || 'Sub-agent completed with no output.' }] }
      } catch (err) {
        updateSession(childDb.id, { agent_status: 'error' })
        if (!win.isDestroyed()) win.webContents.send('pi:agent-status', childDb.id, 'error')
        return { content: [{ type: 'text' as const, text: `Sub-agent failed: ${(err as Error).message}` }] }
      }
    },
  }

  const spawnAgentsTool = {
    name: 'spawnAgents',
    description: 'Spawn MULTIPLE sub-agents concurrently — ALL run in parallel. Blocks until ALL finish. Use for truly independent subtasks with zero coupling: e.g., research API A while writing function B while drafting doc C. Each gets its own agent session. Returns results from all. WARNING: do NOT use when subtasks share state or depend on each other — use spawnAgent sequentially instead.',
    parameters: {
      type: 'object' as const,
      properties: {
        agents: {
          type: 'array' as const,
          description: 'Sub-agents to spawn in parallel',
          items: {
            type: 'object' as const,
            properties: {
              task:  { type: 'string' as const, description: 'Full task description for this sub-agent' },
              title: { type: 'string' as const, description: 'Short title shown in the Agent Tree (≤40 chars)' },
            },
            required: ['task', 'title'],
          },
        },
      },
      required: ['agents'],
    },
    async execute(_id: string, params: unknown) {
      const { agents } = params as { agents: Array<{ task: string; title: string }> }

      // Create all child sessions upfront so they appear immediately in the Agent Tree
      const children = agents.map(({ task, title }) => {
        const childDb = createSession(title, modelId, sessionId)
        childSessionIds.push(childDb.id)
        addMessage(childDb.id, 'user', task)
        updateSession(childDb.id, { agent_status: 'running' })
        if (!win.isDestroyed()) {
          win.webContents.send('pi:agent-spawned', childDb)
          win.webContents.send('pi:agent-status', childDb.id, 'running')
        }
        return { childDb, task }
      })

      // Run all in parallel
      const results = await Promise.all(
        children.map(async ({ childDb, task }) => {
          let accumulated = ''
          try {
            const childPiSession = await getOrCreate(win, childDb.id, apiBaseUrl, apiKey, modelId, cwd)
            const unsub = childPiSession.subscribe((event: any) => {
              if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
                accumulated += event.assistantMessageEvent.delta
              }
            })
            try {
              await childPiSession.prompt(task)
            } finally {
              unsub()
            }
            if (accumulated) addMessage(childDb.id, 'assistant', accumulated)
            updateSession(childDb.id, { agent_status: 'done' })
            if (!win.isDestroyed()) win.webContents.send('pi:agent-status', childDb.id, 'done')
            return { title: childDb.title, result: accumulated || 'Completed.', ok: true }
          } catch (err) {
            updateSession(childDb.id, { agent_status: 'error' })
            if (!win.isDestroyed()) win.webContents.send('pi:agent-status', childDb.id, 'error')
            return { title: childDb.title, result: (err as Error).message, ok: false }
          }
        })
      )

      const text = results.map((r) => `[${r.ok ? '✓' : '✗'} ${r.title}]\n${r.result}`).join('\n\n')
      return { content: [{ type: 'text' as const, text }] }
    },
  }

  const notifyCompleteTool = {
    name: 'notifyComplete',
    description: 'Call when the entire goal is fully accomplished. Shows a completion toast to the user and removes sub-agent sessions from the Agent Tree.',
    parameters: {
      type: 'object' as const,
      properties: {
        title:   { type: 'string' as const, description: 'Short completion label (e.g. "Website built", "Refactor done")' },
        summary: { type: 'string' as const, description: '2–4 sentence overview of what was accomplished' },
      },
      required: ['title', 'summary'],
    },
    async execute(_id: string, params: unknown) {
      const { title, summary } = params as { title: string; summary: string }
      if (!win.isDestroyed()) {
        win.webContents.send('pi:session-complete', sessionId, title, summary, [...childSessionIds])
      }
      childSessionIds.length = 0
      return { content: [{ type: 'text' as const, text: `Completion notified: ${title}` }] }
    },
  }

  const setTodosTool = {
    name: 'setTodos',
    description: 'Set the task plan (TODO list) for the current session. Call this at the START of any multi-step task to outline your plan. The user sees these as a live checklist. Call AGAIN to mark items complete as you progress. This replaces the ENTIRE list each call — always pass ALL current items. This is your plan mode: before starting complex work, call setTodos first to show the user your intended approach, then work through the list item by item.',
    parameters: {
      type: 'object' as const,
      properties: {
        todos: {
          type: 'array' as const,
          description: 'The complete list of tasks',
          items: {
            type: 'object' as const,
            properties: {
              text: { type: 'string' as const, description: 'Task description' },
              completed: { type: 'boolean' as const, description: 'Whether the task is done', default: false },
            },
            required: ['text'],
          },
        },
      },
      required: ['todos'],
    },
    async execute(_id: string, params: unknown) {
      const { todos } = params as { todos: { text: string; completed?: boolean }[] }
      const saved = replaceTodos(sessionId, todos)
      if (!win.isDestroyed()) {
        win.webContents.send('pi:todos-update', sessionId, saved)
      }
      return { content: [{ type: 'text', text: `Plan updated: ${todos.length} task${todos.length !== 1 ? 's' : ''}.` }] }
    },
  }

  // ── Web Search via DuckDuckGo ──────────────────────────────────────────────

  const webSearchTool = {
    name: 'webSearch',
    description: 'Search the web using DuckDuckGo. Use this when you need current information, documentation, news, or anything outside your training data. Returns up to 10 results with title, URL, and snippet. Results are not guaranteed to be accurate — always cite sources and verify critical information.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' as const, description: 'The search query. Be specific — use site:domain to restrict to a domain, "exact phrase" for precise matches.' },
        maxResults: { type: 'number' as const, description: 'Max results to return (1-10, default 5).', default: 5 },
      },
      required: ['query'],
    },
    async execute(_id: string, params: unknown) {
      const { query, maxResults = 5 } = params as { query: string; maxResults?: number }
      const count = Math.min(Math.max(1, maxResults), 10)
      try {
        const results = await searchDuckDuckGo(query, count)
        return { content: [{ type: 'text' as const, text: results }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Web search failed: ${(err as Error).message}` }] }
      }
    },
  }

  const { session } = await createAgentSession({
    sessionManager,
    authStorage,
    modelRegistry,
    model,
    cwd: effectiveCwd,
    tools: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'],
    resourceLoader,
    customTools: [...mcpTools, askUserTool, spawnAgentTool, spawnAgentsTool, notifyCompleteTool, setTodosTool, webSearchTool],
  })

  sessions.set(sessionId, { session, settingsKey: key, mcpClients })
  return session
}

function disposeEntry(entry: SessionEntry): void {
  try { entry.session.dispose() } catch { /* ignore */ }
  for (const c of entry.mcpClients) {
    c.close().catch(() => { /* ignore */ })
  }
}

export function clearAllPiSessions(): void {
  for (const entry of sessions.values()) disposeEntry(entry)
  sessions.clear()
}

export async function handlePiSend(
  win: BrowserWindow,
  reqId: string,
  sessionId: string,
  message: string,
  model: string,
  apiBaseUrl: string,
  apiKey: string,
  cwd: string | null,
): Promise<void> {
  let session: AgentSession
  try {
    session = await getOrCreate(win, sessionId, apiBaseUrl, apiKey, model, cwd)
  } catch (err) {
    if (!win.isDestroyed()) win.webContents.send('pi:error', reqId, (err as Error).message)
    return
  }

  let accumulated = ''
  let thinkingAccumulated = ''

  const unsub = session.subscribe((event) => {
    if (win.isDestroyed()) { unsub(); return }

    if (event.type === 'message_update') {
      const ae = event.assistantMessageEvent
      if (ae.type === 'text_delta') {
        accumulated += ae.delta
        win.webContents.send('pi:delta', reqId, accumulated)
      }
      if (ae.type === 'thinking_delta') {
        thinkingAccumulated += ae.delta
        win.webContents.send('pi:thinking-delta', reqId, thinkingAccumulated)
      }
    }

    if (event.type === 'tool_execution_start') {
      win.webContents.send('pi:tool-start', reqId, event.toolName, JSON.stringify(event.args ?? {}))
    }

    if (event.type === 'tool_execution_end') {
      const r = event.result
      let output = ''
      if (typeof r === 'string') output = r
      else if (Array.isArray(r?.content) && r.content[0]?.text) output = r.content[0].text
      else if (r != null) output = JSON.stringify(r)
      win.webContents.send('pi:tool-end', reqId, output, event.isError)
    }

    if (event.type === 'agent_end' && !event.willRetry) {
      unsub()
      updateSession(sessionId, { agent_status: 'done' })
      if (!win.isDestroyed()) win.webContents.send('pi:agent-status', sessionId, 'done')
      win.webContents.send('pi:done', reqId, accumulated, thinkingAccumulated || undefined)
    }
  })

  try {
    updateSession(sessionId, { agent_status: 'running' })
    if (!win.isDestroyed()) win.webContents.send('pi:agent-status', sessionId, 'running')
    // Auto-checkpoint before AI operations (snapshot the workspace)
    if (cwd) {
      try { createCheckpoint(cwd, `Before: ${message.slice(0, 60).trim()}`) } catch { /* best-effort */ }
    }
    await session.prompt(message)
  } catch (err) {
    unsub()
    updateSession(sessionId, { agent_status: 'error' })
    if (!win.isDestroyed()) {
      win.webContents.send('pi:agent-status', sessionId, 'error')
      win.webContents.send('pi:error', reqId, (err as Error).message)
    }
  }
}

export async function handlePiAbort(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)?.session
  if (session) await session.abort()
}

export function cleanupPiSession(sessionId: string): void {
  const entry = sessions.get(sessionId)
  if (entry) {
    disposeEntry(entry)
    sessions.delete(sessionId)
  }
}

// ── Web Search (DuckDuckGo) ───────────────────────────────────────────────────

interface SearchResult {
  title: string
  url: string
  snippet: string
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<string> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AresBot/1.0)' },
    })
    const html = await res.text()
    const results = parseDdgHtml(html, maxResults)

    if (results.length === 0) return 'No results found.'

    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
    ).join('\n\n')
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'Search timed out after 10s.'
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function parseDdgHtml(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = []

  // Match result blocks: <a rel="nofollow" class="result__a" href="...">title</a>
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi
  // Match snippet blocks: <a class="result__snippet"[^>]*>(.*?)</a>
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi

  const links: { url: string; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(html)) !== null && links.length < maxResults) {
    links.push({ url: m[1], title: stripTags(m[2]) })
  }

  const snippets: string[] = []
  while ((m = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
    snippets.push(stripTags(m[1]))
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i]?.title ?? '',
      url: links[i]?.url ?? '',
      snippet: snippets[i] ?? '',
    })
  }

  return results
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim()
}
