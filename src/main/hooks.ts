import { execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * Lifecycle hooks system (inspired by Claude Code Desktop).
 *
 * Hooks fire on key events during the agent's lifecycle:
 *   - preTool  : before a tool executes
 *   - postTool : after a tool executes
 *   - preSend  : before a message is sent to the AI
 *   - postSend : after a response is received
 *   - onError  : when an error occurs
 *
 * Each hook can run a shell script, send a webhook, or execute a prompt.
 */

export type HookEvent = 'preTool' | 'postTool' | 'preSend' | 'postSend' | 'onError'
export type HookAction = 'script' | 'prompt' | 'webhook'

export interface HookConfig {
  id: string
  event: HookEvent
  action: HookAction
  target: string
  enabled: boolean
  description?: string
}

const HOOKS_FILE = 'ares-hooks.json'

interface HookResult {
  hookId: string
  event: HookEvent
  success: boolean
  output?: string
  error?: string
}

function getHooksPath(): string {
  return path.join(app.getPath('userData'), HOOKS_FILE)
}

export function getHooks(): HookConfig[] {
  try {
    return JSON.parse(fs.readFileSync(getHooksPath(), 'utf-8'))
  } catch {
    return []
  }
}

export function setHooks(hooks: HookConfig[]): void {
  fs.writeFileSync(getHooksPath(), JSON.stringify(hooks, null, 2), 'utf-8')
}

function getEnabledHooks(event: HookEvent): HookConfig[] {
  return getHooks().filter((h) => h.enabled && h.event === event)
}

/**
 * Fire hooks for a given event. All hooks run concurrently.
 * Returns an array of results.
 */
export async function fireHooks(
  event: HookEvent,
  context: Record<string, string>
): Promise<HookResult[]> {
  const hooks = getEnabledHooks(event)
  if (hooks.length === 0) return []

  const results = await Promise.allSettled(
    hooks.map(async (hook) => {
      try {
        switch (hook.action) {
          case 'script':
            return await executeScriptHook(hook, context)
          case 'webhook':
            return await executeWebhookHook(hook, context)
          case 'prompt':
            return { hookId: hook.id, event, success: true, output: `[hook:prompt] ${hook.target}` }
          default:
            return { hookId: hook.id, event, success: false, error: `Unknown hook action: ${hook.action}` }
        }
      } catch (e) {
        return { hookId: hook.id, event, success: false, error: (e as Error).message }
      }
    })
  )

  return results.map((r) =>
    r.status === 'fulfilled' ? r.value : { hookId: 'unknown', event, success: false, error: r.reason?.message }
  ) as HookResult[]
}

function executeScriptHook(hook: HookConfig, context: Record<string, string>): HookResult {
  const scriptPath = hook.target.replace('${HOME}', process.env.HOME || '~')
    .replace('${userData}', app.getPath('userData'))

  if (!fs.existsSync(scriptPath)) {
    return { hookId: hook.id, event: hook.event, success: false, error: `Script not found: ${scriptPath}` }
  }

  // Build env with context vars
  const env: Record<string, string> = { ...process.env as Record<string, string>, ...context }
  const result = execSync(scriptPath, { env, encoding: 'utf-8', timeout: 30_000, maxBuffer: 1024 * 1024 })
  return { hookId: hook.id, event: hook.event, success: true, output: result.trim() }
}

async function executeWebhookHook(hook: HookConfig, context: Record<string, string>): Promise<HookResult> {
  try {
    const rawUrl = hook.target.replace(/\$\{(\w+)\}/g, (_, k) => context[k] ?? '')
    // Validate protocol — only http/https allowed
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked: only http/https URLs allowed (got ${parsed.protocol}//...)`)
    }
    const res = await fetch(parsed.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(10_000),
    })
    const text = await res.text()
    return { hookId: hook.id, event: hook.event, success: res.ok, output: text.slice(0, 1000) }
  } catch (e) {
    return { hookId: hook.id, event: hook.event, success: false, error: (e as Error).message }
  }
}

/**
 * Quick inline test: simulate firing hooks without setting up the full event loop.
 */
export function testHook(hook: HookConfig): HookResult {
  return executeScriptHook(hook, { TEST: '1' })
}
