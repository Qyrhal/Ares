import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { AppSettings, Message, PermissionMode, AgentMode } from '@/types'
import { resolveProvider, hasProvider, type ResolvedProvider } from '@/lib/providers'

export type StreamCallback = (accumulated: string) => void
export type DoneCallback = (fullText: string, thinking?: string, usage?: { promptTokens?: number; completionTokens?: number }) => void
export type ThinkingCallback = (accumulated: string) => void
export type ToolCallCallback = (name: string, input: string) => void
export type ErrorCallback = (err: Error) => void

export function useAI(settings: AppSettings) {
  const sendMessage = useCallback(async (
    model: string,
    messages: Message[],
    onStream: StreamCallback,
    onDone: DoneCallback,
    onToolCall?: ToolCallCallback,
    onToolDone?: (output: string) => void,
    onError?: ErrorCallback,
    _permissionMode?: PermissionMode,
    _onToolPermission?: unknown,
    workspacePath?: string | null,
    _effort?: string,
    onThinking?: ThinkingCallback,
    agentMode?: AgentMode,
  ): Promise<void> => {
    const sessionId = messages[0]?.sessionId
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!sessionId || !lastUser) return

    if (!hasProvider(settings)) {
      await noEndpointFallback(onStream, onDone)
      return
    }

    // "providerId::modelId" refs route to the matching provider
    const resolved = resolveProvider(model, settings)

    // Chat mode: no tools, plain streaming chat completion
    if (agentMode === 'chat') {
      await handleChatCompletion(resolved, messages, onStream, onDone, onError)
      return
    }

    // Plan mode: chat completion with planning system prompt (no tool execution)
    if (agentMode === 'plan') {
      await handlePlanCompletion(resolved, messages, onStream, onDone, onError)
      return
    }

    // Agent mode: full Pi SDK pipeline with tools (existing behavior)
    const reqId = uuidv4()
    return new Promise<void>((resolve) => {
      const cleanups = [
        window.electron.pi.onDelta((id, text) => { if (id === reqId) onStream(text) }),
        window.electron.pi.onThinkingDelta((id, text) => { if (id === reqId) onThinking?.(text) }),
        window.electron.pi.onDone((id, text, thinking) => {
          if (id !== reqId) return
          cleanups.forEach((c) => c())
          onDone(text, thinking)
          resolve()
        }),
        window.electron.pi.onToolStart((id, name, input) => { if (id === reqId) onToolCall?.(name, input) }),
        window.electron.pi.onToolEnd((id, output, isError) => {
          if (id === reqId) onToolDone?.(isError ? `Error: ${output}` : output)
        }),
        window.electron.pi.onError((id, msg) => {
          if (id !== reqId) return
          cleanups.forEach((c) => c())
          if (onError) onError(new Error(msg))
          else onDone(`**Error:** ${msg}`)
          resolve()
        }),
      ]
      window.electron.pi.send(reqId, sessionId, lastUser.content, resolved.modelId, resolved.baseUrl, resolved.apiKey, workspacePath ?? null)
    })
  }, [settings])

  const isConfigured = hasProvider(settings)

  return { sendMessage, isConfigured }
}

/**
 * Chat mode: streaming chat completion via direct fetch.
 * No tools, no agent session — just Q&A.
 */
async function handleChatCompletion(
  resolved: ResolvedProvider,
  messages: Message[],
  onStream: StreamCallback,
  onDone: DoneCallback,
  onError?: ErrorCallback,
): Promise<void> {
  const baseUrl = resolved.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`

  const chatMessages = messages.map((m) => ({
    role: m.role === 'tool' ? 'user' as const : m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: resolved.modelId,
        messages: chatMessages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`)
      throw new Error(errText)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer = ''
    let usage: { promptTokens?: number; completionTokens?: number } | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? ''
            if (content) {
              accumulated += content
              onStream(accumulated)
            }
            // Extract usage from the final chunk (OpenAI-compatible APIs include it on the last delta)
            if (json.usage) {
              usage = {
                promptTokens: json.usage.prompt_tokens ?? json.usage.promptTokens,
                completionTokens: json.usage.completion_tokens ?? json.usage.completionTokens,
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6).trim()
      if (data !== '[DONE]') {
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? ''
          if (content) accumulated += content
          if (json.usage) {
            usage = {
              promptTokens: json.usage.prompt_tokens ?? json.usage.promptTokens,
              completionTokens: json.usage.completion_tokens ?? json.usage.completionTokens,
            }
          }
        } catch { /* skip */ }
      }
    }

    onDone(accumulated, undefined, usage)
  } catch (err) {
    if (onError) {
      onError(err instanceof Error ? err : new Error(String(err)))
    } else {
      onDone(`**Error:** ${(err as Error).message}`)
    }
  }
}

const PLAN_SYSTEM_PROMPT = `You are in "plan mode" — you describe what you would do without executing anything.

Analyze the user's request and produce a plan covering:
1. **Approach** — what strategy you would take
2. **Files affected** — which files would need to be created, modified, or deleted
3. **Steps** — the sequence of changes you would make
4. **Risks** — potential pitfalls, edge cases, or breaking changes
5. **Estimated effort** — small / medium / large

Do NOT write code or make any changes. Only describe the plan.`

async function handlePlanCompletion(
  resolved: ResolvedProvider,
  messages: Message[],
  onStream: StreamCallback,
  onDone: DoneCallback,
  onError?: ErrorCallback,
): Promise<void> {
  const baseUrl = resolved.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`

  const chatMessages = messages.map((m) => ({
    role: m.role === 'tool' ? 'user' as const : m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))

  // Prepend the planning system prompt
  chatMessages.unshift({ role: 'system', content: PLAN_SYSTEM_PROMPT })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resolved.apiKey ? { Authorization: *** ${resolved.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: resolved.modelId,
        messages: chatMessages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`)
      throw new Error(errText)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer = ''
    let usage: { promptTokens?: number; completionTokens?: number } | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? ''
            if (content) {
              accumulated += content
              onStream(accumulated)
            }
            if (json.usage) {
              usage = {
                promptTokens: json.usage.prompt_tokens ?? json.usage.promptTokens,
                completionTokens: json.usage.completion_tokens ?? json.usage.completionTokens,
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6).trim()
      if (data !== '[DONE]') {
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? ''
          if (content) accumulated += content
          if (json.usage) {
            usage = {
              promptTokens: json.usage.prompt_tokens ?? json.usage.promptTokens,
              completionTokens: json.usage.completion_tokens ?? json.usage.completionTokens,
            }
          }
        } catch { /* skip */ }
      }
    }

    onDone(accumulated, undefined, usage)
  } catch (err) {
    if (onError) {
      onError(err instanceof Error ? err : new Error(String(err)))
    } else {
      onDone(`**Error:** ${(err as Error).message}`)
    }
  }
}

async function noEndpointFallback(onStream: StreamCallback, onDone: DoneCallback): Promise<void> {
  const text = `No API endpoint configured. Open **Settings** to add your OpenAI-compatible endpoint URL.

Ares uses Pi Agent as its AI backend and works with any OpenAI-compatible server:
- \`https://api.openai.com/v1\` — OpenAI
- \`http://localhost:11434/v1\` — Ollama
- \`http://localhost:1234/v1\` — LM Studio
- \`https://api.groq.com/openai/v1\` — Groq
- Any other OpenAI-compatible endpoint`

  const words = text.split(/(\s+)/)
  let acc = ''
  for (const w of words) {
    acc += w
    onStream(acc)
    await sleep(12 + Math.random() * 18)
  }
  onDone(acc)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
