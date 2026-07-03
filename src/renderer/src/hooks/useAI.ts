import { useMemo, useCallback } from 'react'
import OpenAI from 'openai'
import { AppSettings, Message, PermissionMode } from '@/types'

export type StreamCallback = (accumulated: string) => void
export type DoneCallback = (fullText: string) => void
export type ToolCallCallback = (name: string, input: string) => void
export type ToolPermissionCallback = (name: string, input: string) => Promise<boolean>
export type ErrorCallback = (err: Error) => void

const READ_TOOLS = new Set(['readFile', 'listFiles'])

// exported for testing
export function needsPermission(mode: PermissionMode, toolName: string): boolean {
  if (mode === 'yolo') return false
  if (mode === 'auto') return !READ_TOOLS.has(toolName)
  return true
}

// exported for testing
export const SKILL_PROMPT = `You are an AI coding assistant with full read/write access to the user's workspace. You can perform the following operations:

1. readFile(path) — Read the full contents of any file.
2. writeFile(path, content) — Write new content to a file (creates directories, overwrites existing).
3. editFile(path, oldString, newString) — Find-and-replace text in an existing file. Use this for targeted changes.
4. createFile(path, content) — Create a brand new file (fails if it already exists).
5. listFiles(dir) — List files and directories (excludes hidden files and node_modules).

ALWAYS prefer editFile over writeFile for making changes to existing files — it preserves surrounding context. Use writeFile only when replacing an entire file or creating a file that already needs to exist.`

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: 'Read the full contents of a file at the given absolute path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute path to the file' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'writeFile',
      description: 'Write new content to a file at the given absolute path. Creates parent directories if needed. Overwrites existing files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'Full new content for the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editFile',
      description: 'Find and replace text in an existing file. This is the preferred way to make targeted changes. If oldString is not found exactly once, the operation fails.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          oldString: { type: 'string', description: 'Text to search for (must match exactly)' },
          newString: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'oldString', 'newString'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createFile',
      description: 'Create a new file at the given absolute path. Creates parent directories if needed. Fails if the file already exists.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path for the new file' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listFiles',
      description: 'List files and directories in a given directory. Excludes hidden files and node_modules.',
      parameters: {
        type: 'object',
        properties: { dir: { type: 'string', description: 'Absolute path to the directory' } },
        required: ['dir'],
      },
    },
  },
]

// exported for testing
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const el = window.electron
  switch (name) {
    case 'readFile':
      return el.tools.readFile(args.path as string)
    case 'writeFile':
      await el.tools.writeFile(args.path as string, args.content as string)
      return `File written to ${args.path}`
    case 'editFile':
      await el.tools.editFile(args.path as string, args.oldString as string, args.newString as string)
      return `File edited at ${args.path}`
    case 'createFile':
      await el.tools.createFile(args.path as string, args.content as string)
      return `File created at ${args.path}`
    case 'listFiles':
      return JSON.stringify(await el.tools.listFiles(args.dir as string), null, 2)
    default:
      return `Unknown tool: ${name}`
  }
}

// exported for testing
export function toApiMessage(m: Message): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  if (m.role === 'tool') {
    return { role: 'tool', content: m.toolOutput ?? '', tool_call_id: m.toolName ?? '' }
  }
  if (m.role === 'assistant' && m.toolName) {
    return {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: m.toolName, function: { name: m.toolName, arguments: m.toolInput ?? '{}' }, type: 'function' }],
    }
  }
  return { role: m.role as 'user' | 'assistant', content: m.content }
}

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
    model: string,
    messages: Message[],
    onStream: StreamCallback,
    onDone: DoneCallback,
    onToolCall?: ToolCallCallback,
    onToolDone?: (output: string) => void,
    onError?: ErrorCallback,
    permissionMode?: PermissionMode,
    onToolPermission?: ToolPermissionCallback,
    workspacePath?: string | null,
    effort?: string,
  ): Promise<void> => {
    if (!client) {
      await noKeyFallback(onStream, onDone)
      return
    }

    const apiMessages = messages.map(toApiMessage)
    const systemParts = [SKILL_PROMPT]
    if (workspacePath) systemParts.push(`Current workspace: \`${workspacePath}\``)
    if (effort === 'low') systemParts.push('Be concise. Keep responses short and direct.')
    if (effort === 'high') systemParts.push('Be thorough and detailed. Think step by step and cover edge cases.')
    if (settings.systemPrompt?.trim()) systemParts.push(settings.systemPrompt.trim())
    const sysMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: 'system',
      content: systemParts.join('\n\n---\n\n'),
    }
    let currentMessages = [sysMsg, ...apiMessages]

    try {
      for (let round = 0; round < 20; round++) {
        const response = await client.chat.completions.create({
          model: model || settings.defaultModel || 'gpt-4o-mini',
          messages: currentMessages,
          tools: TOOLS,
          stream: true
        })

        let text = ''
        let hadToolCalls = false
        const toolCalls = new Map<number, { id: string; name: string; args: string }>()

        for await (const chunk of response) {
          const choice = chunk.choices[0]
          if (!choice) continue

          const delta = choice.delta
          const finishReason = choice.finish_reason

          if (delta?.content) {
            text += delta.content
            onStream(text)
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                toolCalls.set(tc.index, {
                  id: tc.id,
                  name: tc.function?.name ?? '',
                  args: tc.function?.arguments ?? '',
                })
              } else {
                const existing = toolCalls.get(tc.index)
                if (existing && tc.function?.arguments) {
                  existing.args += tc.function.arguments
                }
              }
            }
          }

          if (finishReason === 'tool_calls') {
            hadToolCalls = true
            currentMessages.push({ role: 'assistant', content: text || null } as OpenAI.Chat.Completions.ChatCompletionMessageParam)

            for (const [, tc] of toolCalls) {
              onToolCall?.(tc.name, tc.args)
              let result: string
              const allowed = needsPermission(permissionMode ?? 'ask', tc.name)
                ? (onToolPermission ? await onToolPermission(tc.name, tc.args) : true)
                : true
              if (!allowed) {
                result = `User denied permission for ${tc.name}`
              } else {
                try {
                  const parsed = JSON.parse(tc.args)
                  result = await executeTool(tc.name, parsed)
                } catch (err) {
                  result = `Error executing ${tc.name}: ${(err as Error).message}`
                }
              }
              onToolDone?.(result)
              currentMessages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{
                  id: tc.id,
                  function: { name: tc.name, arguments: tc.args },
                  type: 'function',
                }],
              } as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam)
              currentMessages.push({
                role: 'tool',
                content: result,
                tool_call_id: tc.id,
              } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
            }
            text = ''
            break
          }
        }

        if (!hadToolCalls) {
          onDone(text)
          return
        }
      }
      onDone('[Max tool call rounds reached]')
    } catch (err) {
      const e = err as Error
      if (onError) onError(e)
      else onDone(`**Error:** ${e.message}`)
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
- \`Any other OpenAI-compatible server\``

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
