import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { AppSettings, Message, PermissionMode } from '@/types'

export type StreamCallback = (accumulated: string) => void
export type DoneCallback = (fullText: string) => void
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
  ): Promise<void> => {
    const sessionId = messages[0]?.sessionId
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!sessionId || !lastUser) return

    if (!settings.apiBaseUrl.trim()) {
      await noEndpointFallback(onStream, onDone)
      return
    }

    const reqId = uuidv4()
    return new Promise<void>((resolve) => {
      const cleanups = [
        window.electron.pi.onDelta((id, text) => { if (id === reqId) onStream(text) }),
        window.electron.pi.onDone((id, text) => {
          if (id !== reqId) return
          cleanups.forEach((c) => c())
          onDone(text)
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
      window.electron.pi.send(reqId, sessionId, lastUser.content, model, settings.apiBaseUrl, settings.apiKey, workspacePath ?? null)
    })
  }, [settings.apiBaseUrl, settings.apiKey])

  const isConfigured = settings.apiBaseUrl.trim().length > 0

  return { sendMessage, isConfigured }
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
