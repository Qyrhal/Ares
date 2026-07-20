import { z } from 'zod'
import type { Session, Message, AppSettings, Todo } from '@/types'

// ── IPC wire types ─────────────────────────────────────────────────────────────

export const RawSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string().default(''),
  created_at: z.number(),
  updated_at: z.number(),
  message_count: z.number().optional().default(0),
  pinned: z.boolean().optional().default(false),
  archived: z.boolean().optional().default(false),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  permissionMode: z.enum(['ask', 'auto', 'yolo']).optional(),
  workspace_path: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  agent_status: z.enum(['idle', 'running', 'done', 'error']).optional(),
  is_side_chat: z.boolean().optional().default(false),
  notes: z.string().optional(),
})

export const RawTodoSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  text: z.string(),
  completed: z.union([z.literal(0), z.literal(1)]),
  created_at: z.number(),
})

export const RawMessageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(['user', 'assistant', 'tool', 'system']),
  content: z.string(),
  attachments: z.string().nullable().optional(),
  tool_name: z.string().nullable().optional(),
  tool_status: z.string().nullable().optional(),
  tool_input: z.string().nullable().optional(),
  tool_output: z.string().nullable().optional(),
  thinking: z.string().nullable().optional(),
  reply_to: z.string().nullable().optional(),
  reactions: z.string().nullable().optional(),
  feedback: z.string().nullable().optional(),
  created_at: z.number(),
})

export const ProviderConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  baseUrl: z.string(),
  apiKey: z.string().default(''),
})

export const AppSettingsSchema = z.object({
  apiKey: z.string().default(''),
  apiBaseUrl: z.string().default(''),
  providers: z.array(ProviderConfigSchema).default([]),
  defaultModel: z.string().default(''),
  themeId: z.string().default('steel'),
  colorMode: z.enum(['dark', 'light']).default('dark'),
  systemPrompt: z.string().default(''),
  permissionMode: z.enum(['ask', 'auto', 'yolo']).default('ask'),
})

// ── Parsed domain types ────────────────────────────────────────────────────────

export function parseSession(raw: unknown): Session {
  const r = RawSessionSchema.parse(raw)
  return {
    id: r.id,
    title: r.title,
    model: r.model,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messageCount: r.message_count,
    pinned: r.pinned,
    archived: r.archived,
    effort: r.effort,
    permissionMode: r.permissionMode,
    workspacePath: r.workspace_path ?? undefined,
    parentId: r.parent_id ?? null,
    agentStatus: r.agent_status ?? 'idle',
    isSideChat: r.is_side_chat ?? false,
    notes: r.notes,
  }
}

export function parseTodo(raw: unknown): Todo {
  const r = RawTodoSchema.parse(raw)
  return {
    id: r.id,
    sessionId: r.session_id,
    text: r.text,
    completed: r.completed === 1,
    createdAt: r.created_at,
  }
}

export function parseMessage(raw: unknown): Message {
  const r = RawMessageSchema.parse(raw)
  return {
    id: r.id,
    sessionId: r.session_id,
    role: r.role,
    content: r.content,
    attachments: r.attachments ? JSON.parse(r.attachments) : undefined,
    toolName: r.tool_name ?? undefined,
    toolStatus: (r.tool_status as Message['toolStatus']) ?? undefined,
    toolInput: r.tool_input ?? undefined,
    toolOutput: r.tool_output ?? undefined,
    thinking: r.thinking ?? undefined,
    replyTo: r.reply_to ? JSON.parse(r.reply_to) : undefined,
    reactions: r.reactions ? JSON.parse(r.reactions) : undefined,
    feedback: (r.feedback as Message['feedback']) ?? undefined,
    createdAt: r.created_at,
  }
}

export function parseSettings(raw: unknown): AppSettings {
  const s = AppSettingsSchema.parse(raw)
  // Migrate the legacy single endpoint into the providers list
  if (s.providers.length === 0 && s.apiBaseUrl.trim()) {
    s.providers = [{ id: 'default', label: 'Default', baseUrl: s.apiBaseUrl, apiKey: s.apiKey }]
  }
  return s
}
