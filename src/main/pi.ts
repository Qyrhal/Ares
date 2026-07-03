// Pi packages are ESM-only. Rollup rewrites literal import('...') to require() for external
// modules even with dynamicImportInCjs:false. Wrapping in new Function() makes the call
// opaque to Rollup's static analysis, so Node.js executes the real ESM import() at runtime.
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { BrowserWindow } from 'electron'
import * as nodeModule from 'module'

// Pi's bundled undici does `const { markAsUncloneable } = require('node:worker_threads')`.
// markAsUncloneable was added in Node.js 22; Electron 33 ships Node.js 20.
// The worker_threads exports object is frozen so we can't patch it directly.
// Instead, hook Module._load to return a Proxy that adds the missing function.
;(function patchWorkerThreads() {
  const M = nodeModule as any
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
        }
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

type SessionEntry = {
  session: AgentSession
  settingsKey: string
}

const sessions = new Map<string, SessionEntry>()

function settingsKey(apiBaseUrl: string, apiKey: string, modelId: string): string {
  return `${apiBaseUrl}|${apiKey}|${modelId}`
}

async function getOrCreate(
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
    try { existing.session.dispose() } catch { /* ignore */ }
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

  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    authStorage,
    modelRegistry,
    model,
    cwd: cwd || process.cwd(),
    tools: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'],
  })

  sessions.set(sessionId, { session, settingsKey: key })
  return session
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
    session = await getOrCreate(sessionId, apiBaseUrl, apiKey, model, cwd)
  } catch (err) {
    if (!win.isDestroyed()) win.webContents.send('pi:error', reqId, (err as Error).message)
    return
  }

  let accumulated = ''

  const unsub = session.subscribe((event) => {
    if (win.isDestroyed()) { unsub(); return }

    if (event.type === 'message_update') {
      const ae = event.assistantMessageEvent
      if (ae.type === 'text_delta') {
        accumulated += ae.delta
        win.webContents.send('pi:delta', reqId, accumulated)
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
      win.webContents.send('pi:done', reqId, accumulated)
    }
  })

  try {
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
    try { entry.session.dispose() } catch { /* ignore */ }
    sessions.delete(sessionId)
  }
}
