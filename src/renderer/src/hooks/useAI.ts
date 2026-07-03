import { useMemo, useCallback } from 'react'
import OpenAI from 'openai'
import { AppSettings, Message } from '@/types'

export type StreamCallback = (accumulated: string) => void
export type DoneCallback = (fullText: string) => void
export type ErrorCallback = (err: Error) => void

export function useAI(settings: AppSettings) {
  const client = useMemo(() => {
    const hasKey = settings.apiKey.trim().length > 0
    const hasCustomBase = settings.apiBaseUrl.trim().length > 0 &&
      settings.apiBaseUrl !== 'https://api.openai.com/v1'
    if (!hasKey && !hasCustomBase) return null
    return new OpenAI({
      apiKey: settings.apiKey || 'dummy',
      baseURL: settings.apiBaseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true
    })
  }, [settings.apiKey, settings.apiBaseUrl])

  const sendMessage = useCallback(async (
    messages: Message[],
    onStream: StreamCallback,
    onDone: DoneCallback,
    onToolCall?: (name: string, input: string) => void,
    onToolDone?: (output: string) => void,
    onError?: ErrorCallback
  ): Promise<void> => {
    if (!client) {
      await noKeyFallback(onStream, onDone)
      return
    }

    try {
      const apiMessages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const stream = await client.chat.completions.create({
        model: settings.defaultModel || 'gpt-4o-mini',
        messages: apiMessages,
        stream: true
      })

      let full = ''
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          full += delta
          onStream(full)
        }
      }
      onDone(full)
    } catch (err) {
      const e = err as Error
      if (onError) {
        onError(e)
      } else {
        onDone(`**Error:** ${e.message}`)
      }
    }
  }, [client, settings.defaultModel])

  return { sendMessage, isConfigured: client !== null }
}

async function noKeyFallback(onStream: StreamCallback, onDone: DoneCallback): Promise<void> {
  const text = `No API key configured. Open **Settings** (gear icon in the activity bar) to add your OpenAI-compatible endpoint and key.

Once you add your details I'll be able to assist you properly. Supports any OpenAI-compatible endpoint:
- \`https://api.openai.com/v1\` — OpenAI
- \`http://localhost:11434/v1\` — Ollama
- \`http://localhost:1234/v1\` — LM Studio
- Any other OpenAI-compatible server`

  const words = text.split(/(\s+)/)
  let acc = ''
  for (const w of words) {
    acc += w
    onStream(acc)
    await sleep(15 + Math.random() * 20)
  }
  onDone(acc)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
