// Pi packages are ESM-only. Rollup rewrites literal import('...') to require() for external
// modules even with dynamicImportInCjs:false. Wrapping in new Function() makes the call
// opaque to Rollup's static analysis, so Node.js executes the real ESM import() at runtime.
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { app, BrowserWindow } from 'electron'
import * as nodeModule from 'module'
import fs from 'fs'
import path from 'path'
import { getAgentConfig, replaceTodos } from './db'
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
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    additionalSkillPaths: config.skills.length > 0 ? [skillsDir] : [],
    additionalExtensionPaths: enabledExtPaths,
    noContextFiles: true,
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

  const setTodosTool = {
    name: 'setTodos',
    description: 'Set the task plan for the current session. Call this at the start to outline your steps, then call again to mark items complete as you progress.',
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

  const { session } = await createAgentSession({
    sessionManager,
    authStorage,
    modelRegistry,
    model,
    cwd: effectiveCwd,
    tools: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'],
    resourceLoader,
    customTools: [...mcpTools, setTodosTool],
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
      win.webContents.send('pi:done', reqId, accumulated, thinkingAccumulated || undefined)
    }
  })

  try {
    // Auto-checkpoint before AI operations (snapshot the workspace)
    if (cwd) {
      try { createCheckpoint(cwd, `Before: ${message.slice(0, 60).trim()}`) } catch { /* best-effort */ }
    }
    await session.prompt(message)
  } catch (err) {
    unsub()
    if (!win.isDestroyed()) win.webContents.send('pi:error', reqId, (err as Error).message)
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
