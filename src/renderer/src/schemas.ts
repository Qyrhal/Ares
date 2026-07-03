import { z } from 'zod'
import type { Session, Message, AppSettings } from '@/types'

// ── IPC wire types ─────────────────────────────────────────────────────────────

export const RawSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string().default(''),
  created_at: z.number(),
  updated_at: z.number(),
  message_count: z.number().optional().default(0),
  pinned: z.boolean().optional().default(false),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  permissionMode: z.enum(['ask', 'auto', 'yolo']).optional(),
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
  created_at: z.number(),
})

export const AppSettingsSchema = z.object({
  apiKey: z.string().default(''),
  apiBaseUrl: z.string().default(''),
  defaultModel: z.string().default(''),
  themeId: z.string().default('red'),
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
    effort: r.effort,
    permissionMode: r.permissionMode,
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
    createdAt: r.created_at,
  }
}

export function parseSettings(raw: unknown): AppSettings {
  return AppSettingsSchema.parse(raw)
}
