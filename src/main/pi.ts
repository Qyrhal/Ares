// Pi packages are ESM-only. Rollup rewrites literal import('...') to require() for external
// modules even with dynamicImportInCjs:false. Wrapping in new Function() makes the call
// opaque to Rollup's static analysis, so Node.js executes the real ESM import() at runtime.
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { app, BrowserWindow } from 'electron'
import * as nodeModule from 'module'
import fs from 'fs'
import path from 'path'
import { getAgentConfig, getSettings, replaceTodos, createSession, updateSession, addMessage, getSessions, getMessages, addTeamNote, getTeamNotes } from './db'
import { createCheckpoint } from './checkpoints'
import { buildAutoAnswerMessages, parseAutoAnswerResponse, findRootSessionId, briefWithTeamNotes } from './orchestration'
import { ARES_PROMPT } from '../shared/ares-prompt'
import { contextWindow } from '../shared/context-window'

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

// Concurrency limiter — prevents resource exhaustion from too many parallel sub-agents
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIdx = 0

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++
      results[idx] = await tasks[idx]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

// One-shot completion (no tools, no full agent session) used to answer a sub-agent's
// askUser question on the orchestrator's behalf, so it never needs a human mid-task.
async function autoAnswerQuestion(
  apiBaseUrl: string,
  apiKey: string,
  modelId: string,
  parentTask: string,
  childTitle: string,
  questions: Array<{ question: string; header: string; options?: string[]; multiSelect?: boolean }>,
): Promise<Record<string, string>> {
  const { system, user } = buildAutoAnswerMessages(parentTask, childTitle, questions)
  const res = await fetch(apiBaseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const json = await res.json()
  const raw = json.choices?.[0]?.message?.content ?? ''
  return parseAutoAnswerResponse(raw, questions)
}

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
  const fullSystemPrompt = systemPrompt.trim()
    ? `${systemPrompt.trim()}\n\n${ARES_PROMPT}`
    : ARES_PROMPT
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

async function buildMcpTools(win?: BrowserWindow): Promise<{ tools: any[]; clients: McpClientType[] }> {
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
            const settings = getSettings()
            const thresholdMs = settings.mcpAutoBackgroundMs ?? 120_000

            // No threshold or zero means never background
            if (thresholdMs <= 0) {
              const result = await client.callTool({ name: t.name, arguments: params as Record<string, unknown> })
              const text = (result.content as any[])
                .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                .join('\n')
              return { content: [{ type: 'text', text }], details: result }
            }

            // Start the tool call — keep a reference to the original promise so we
            // can continue waiting on it in background if the threshold fires first.
            const toolPromise = client.callTool({ name: t.name, arguments: params as Record<string, unknown> })

            // Race: first to resolve wins
            const winner = await Promise.race([
              toolPromise.then((r) => ({ source: 'tool' as const, result: r })),
              new Promise<{ source: 'background'; result: null }>((resolve) => {
                setTimeout(() => resolve({ source: 'background', result: null }), thresholdMs)
              }),
            ])

            if (winner.source === 'tool') {
              // Completed within threshold
              const text = (winner.result.content as any[])
                .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                .join('\n')
              return { content: [{ type: 'text', text }], details: winner.result }
            }

            // Threshold exceeded — move to background, return placeholder
            const [bw] = BrowserWindow.getAllWindows()
            if (bw && !bw.isDestroyed()) {
              bw.webContents.send('pi:mcp-auto-background', t.name, JSON.stringify(params))
            }

            // Continue waiting on the ORIGINAL promise in background
            toolPromise
              .then((actualResult) => {
                const text = (actualResult.content as any[])
                  .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                  .join('\n')
                if (bw && !bw.isDestroyed()) {
                  bw.webContents.send('pi:mcp-tool-background-result', t.name, text)
                }
              })
              .catch((bgErr) => {
                console.error(`[ares] MCP background tool "${t.name}" failed:`, (bgErr as Error).message)
              })

            return { content: [{ type: 'text', text: `[MCP tool "${t.name}" is running in background]` }], details: null }
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
      // Drives the SDK's auto-compaction threshold — a wrong (too large) value
      // means Pi never compacts and small-window models overflow instead.
      contextWindow: contextWindow(modelId),
      maxTokens: Math.min(16_384, Math.floor(contextWindow(modelId) / 2)),
    }],
  })

  const model = modelRegistry.find(providerId, modelId)!
  const effectiveCwd = cwd || process.cwd()

  const [resourceLoader, { tools: mcpTools, clients: mcpClients }] = await Promise.all([
    buildResourceLoader(effectiveCwd),
    buildMcpTools(win),
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
  // Guardrail counters for this Pi session
  let webSearchCount = 0
  let subagentSpawnCount = 0

  const askUserTool = {
    name: 'askUser',
    description: 'Ask the user one or more questions with optional multiple-choice chips. Use this when you need clarification before proceeding. For a top-level session, the user sees an interactive form and the call blocks until they submit. For a sub-agent session, this is answered automatically by the orchestrator\'s context instead — no human is involved.',
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

      const mine = getSessions().find((s) => s.id === sessionId)
      if (mine?.parent_id) {
        try {
          const parentTask = getMessages(mine.parent_id).find((m) => m.role === 'user')?.content ?? ''
          const answers = await autoAnswerQuestion(apiBaseUrl, apiKey, modelId, parentTask, mine.title, questions)
          const formatted = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')
          addMessage(sessionId, 'assistant', `🤖 **Orchestrator auto-answered:**\n\n${formatted}`)
          return { content: [{ type: 'text' as const, text: formatted }] }
        } catch (err) {
          console.error('[ares] auto-answer failed, falling back to human ask:', (err as Error).message)
          // fall through to the human-ask path below
        }
      }

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
    description: 'Spawn a sub-agent to handle a focused subtask. Use this when a task can be cleanly decomposed into independent subtasks that each need focused attention. The sub-agent runs with the same model, tools, and workspace; it appears in the Agent Tree as a child session, and receives any existing shareWithTeam notes in its briefing. This call BLOCKS until the sub-agent finishes. If it fails, use messageAgent with its id to send corrective instructions and retry, rather than spawning a fresh one. Good candidates: research a specific API, write a self-contained function, analyze one file, draft a section. AVOID: tasks needing ongoing coordination with the parent or access to parent-only context.',
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

      // Guardrail: enforce per-session subagent spawn limit
      const settings = getSettings()
      const maxSpawns = settings.maxSubagentSpawns ?? 200
      if (subagentSpawnCount >= maxSpawns) {
        const msg = `Sub-agent spawn limit reached (${maxSpawns} per session). Use /clear to reset, or increase maxSubagentSpawns in settings.`
        return { content: [{ type: 'text' as const, text: msg }], isError: true }
      }
      subagentSpawnCount++

      const childDb = createSession(title, modelId, sessionId)
      childSessionIds.push(childDb.id)
      const rootId = findRootSessionId(getSessions(), sessionId)
      const briefing = briefWithTeamNotes(task, getTeamNotes(rootId))
      addMessage(childDb.id, 'user', briefing)
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
          await childPiSession.prompt(briefing)
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
        const recent = getMessages(childDb.id).slice(-3).map((m) => `[${m.role}] ${(m.content ?? '').slice(0, 300)}`).join('\n')
        return { content: [{ type: 'text' as const, text: `Sub-agent "${title}" (id: ${childDb.id}) failed: ${(err as Error).message}\n\nRecent activity:\n${recent}\n\nUse messageAgent with agentId "${childDb.id}" to send corrective instructions and retry, or spawnAgent again for a fresh attempt.` }] }
      }
    },
  }

  const spawnAgentsTool = {
    name: 'spawnAgents',
    description: 'Spawn MULTIPLE sub-agents concurrently — ALL run in parallel. Blocks until ALL finish. Use for truly independent subtasks with zero coupling: e.g., research API A while writing function B while drafting doc C. Each gets its own agent session and receives any existing shareWithTeam notes in its briefing. Returns results from all, including an agentId for any that failed so you can use messageAgent to correct and resume it. WARNING: do NOT use when subtasks share state or depend on each other — use spawnAgent sequentially instead.',
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

      // Guardrail: enforce per-session subagent spawn limit
      const settings = getSettings()
      const maxSpawns = settings.maxSubagentSpawns ?? 200
      if (subagentSpawnCount + agents.length > maxSpawns) {
        const remaining = maxSpawns - subagentSpawnCount
        const msg = `Sub-agent spawn limit reached (${maxSpawns} per session, ${remaining} remaining). Requested ${agents.length} but only ${remaining > 0 ? remaining : 0} slots left. Use /clear to reset, or increase maxSubagentSpawns in settings.`
        return { content: [{ type: 'text' as const, text: msg }], isError: true }
      }
      subagentSpawnCount += agents.length

      const rootId = findRootSessionId(getSessions(), sessionId)
      const teamNotes = getTeamNotes(rootId)

      // Create all child sessions upfront so they appear immediately in the Agent Tree
      const children = agents.map(({ task, title }) => {
        const childDb = createSession(title, modelId, sessionId)
        childSessionIds.push(childDb.id)
        const briefing = briefWithTeamNotes(task, teamNotes)
        addMessage(childDb.id, 'user', briefing)
        updateSession(childDb.id, { agent_status: 'running' })
        if (!win.isDestroyed()) {
          win.webContents.send('pi:agent-spawned', childDb)
          win.webContents.send('pi:agent-status', childDb.id, 'running')
        }
        return { childDb, briefing }
      })

      // Run with concurrency limit to prevent resource exhaustion
      const maxConcurrent = settings.maxConcurrentSubagents ?? 5
      const results = await runWithConcurrency(
        children.map(({ childDb, briefing }) => async () => {
          let accumulated = ''
          try {
            const childPiSession = await getOrCreate(win, childDb.id, apiBaseUrl, apiKey, modelId, cwd)
            const unsub = childPiSession.subscribe((event: any) => {
              if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
                accumulated += event.assistantMessageEvent.delta
              }
            })
            try {
              await childPiSession.prompt(briefing)
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
            const recent = getMessages(childDb.id).slice(-3).map((m) => `[${m.role}] ${(m.content ?? '').slice(0, 300)}`).join('\n')
            return { title: childDb.title, result: `${(err as Error).message}\n\nRecent activity:\n${recent}\n\nUse messageAgent with agentId "${childDb.id}" to correct and resume.`, ok: false }
          }
        }),
        maxConcurrent,
      )

      const text = results.map((r) => `[${r.ok ? '✓' : '✗'} ${r.title}]\n${r.result}`).join('\n\n')
      return { content: [{ type: 'text' as const, text }] }
    },
  }

  const messageAgentTool = {
    name: 'messageAgent',
    description: 'Send a follow-up message to a sub-agent you previously spawned, and get its response. Use this after a sub-agent errors (to give corrective instructions and retry) or to continue directing a specific sub-agent instead of spawning a new one. Blocks until the sub-agent responds.',
    parameters: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string' as const, description: 'The sub-agent session id (from a prior spawnAgent/spawnAgents call, or from an error report)' },
        message: { type: 'string' as const, description: 'The message/instructions to send' },
      },
      required: ['agentId', 'message'],
    },
    async execute(_id: string, params: unknown) {
      const { agentId, message } = params as { agentId: string; message: string }
      if (!childSessionIds.includes(agentId)) {
        return { content: [{ type: 'text' as const, text: `Error: "${agentId}" is not a sub-agent you spawned in this session.` }] }
      }

      addMessage(agentId, 'user', message)
      updateSession(agentId, { agent_status: 'running' })
      if (!win.isDestroyed()) win.webContents.send('pi:agent-status', agentId, 'running')

      let accumulated = ''
      try {
        const childPiSession = await getOrCreate(win, agentId, apiBaseUrl, apiKey, modelId, cwd)
        const unsub = childPiSession.subscribe((event: any) => {
          if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
            accumulated += event.assistantMessageEvent.delta
          }
        })
        try {
          await childPiSession.prompt(message)
        } finally {
          unsub()
        }
        if (accumulated) addMessage(agentId, 'assistant', accumulated)
        updateSession(agentId, { agent_status: 'done' })
        if (!win.isDestroyed()) win.webContents.send('pi:agent-status', agentId, 'done')
        return { content: [{ type: 'text' as const, text: accumulated || 'Sub-agent responded with no output.' }] }
      } catch (err) {
        updateSession(agentId, { agent_status: 'error' })
        if (!win.isDestroyed()) win.webContents.send('pi:agent-status', agentId, 'error')
        return { content: [{ type: 'text' as const, text: `Sub-agent failed again: ${(err as Error).message}` }] }
      }
    },
  }

  const shareWithTeamTool = {
    name: 'shareWithTeam',
    description: 'Share a finding, decision, or piece of information with your entire agent team (the orchestrator and all its sub-agents, including siblings). Use this when you discover something other agents in the same task tree should know — a shared convention, a blocker, an API you found. Visible to teammates via getTeamNotes, and automatically included in the task briefing of any sub-agent spawned after you share it.',
    parameters: {
      type: 'object' as const,
      properties: {
        note: { type: 'string' as const, description: 'The information to share with the team' },
      },
      required: ['note'],
    },
    async execute(_id: string, params: unknown) {
      const { note } = params as { note: string }
      const rootId = findRootSessionId(getSessions(), sessionId)
      const me = getSessions().find((s) => s.id === sessionId)
      addTeamNote(rootId, sessionId, me?.title ?? 'Agent', note)
      return { content: [{ type: 'text' as const, text: 'Shared with team.' }] }
    },
  }

  const getTeamNotesTool = {
    name: 'getTeamNotes',
    description: 'Read everything your agent team (the orchestrator and sibling sub-agents in the same task tree) has shared so far via shareWithTeam. Use this to check for relevant context before starting work, or if you suspect another agent found something useful.',
    parameters: { type: 'object' as const, properties: {} },
    async execute() {
      const rootId = findRootSessionId(getSessions(), sessionId)
      const notes = getTeamNotes(rootId)
      if (notes.length === 0) return { content: [{ type: 'text' as const, text: 'No team notes yet.' }] }
      const text = notes.map((n) => `[${n.from_title}] ${n.note}`).join('\n')
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
    description: 'Set the task plan (TODO list) for the current session. Call this at the START of any multi-step task to outline your plan. The user sees these as a live checklist. Mark items complete ONE AT A TIME, immediately after finishing each — call setTodos again right then with just that item flipped to completed:true, before starting the next item. Never batch multiple completions into one call at the end. This replaces the ENTIRE list each call — always pass ALL current items (not just the changed one). If you start a genuinely new, unrelated plan, call setTodos with ONLY the new plan\'s items — this clears the old list, don\'t carry stale items forward. This is your plan mode: before starting complex work, call setTodos first to show the user your intended approach, then work through the list item by item.',
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

      // Guardrail: enforce per-session web search limit
      const settings = getSettings()
      const maxSearches = settings.maxWebSearches ?? 200
      if (webSearchCount >= maxSearches) {
        const msg = `Web search limit reached (${maxSearches} per session). Use /clear to reset, or increase maxWebSearches in settings.`
        return { content: [{ type: 'text' as const, text: msg }], isError: true }
      }
      webSearchCount++

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
    tools: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls',
            'spawnAgent', 'spawnAgents', 'askUser', 'setTodos', 'notifyComplete', 'webSearch',
            'messageAgent', 'shareWithTeam', 'getTeamNotes'],
    resourceLoader,
    customTools: [...mcpTools, askUserTool, spawnAgentTool, spawnAgentsTool, notifyCompleteTool, setTodosTool, webSearchTool, messageAgentTool, shareWithTeamTool, getTeamNotesTool],
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

    if (event.type === 'compaction_start' || event.type === 'compaction_end') {
      win.webContents.send('pi:compaction', sessionId, event.type === 'compaction_start' ? 'start' : 'end')
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
