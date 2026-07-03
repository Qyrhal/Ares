export type MessageRole = 'user' | 'assistant' | 'tool' | 'system'
export type ToolStatus = 'running' | 'done' | 'error'

export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  path: string
}

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  attachments?: FileAttachment[]
  toolName?: string
  toolStatus?: ToolStatus
  toolInput?: string
  toolOutput?: string
  isStreaming?: boolean
  createdAt: number
}

export interface Session {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface AppSettings {
  apiKey: string
  apiBaseUrl: string
  defaultModel: string
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export type Tab =
  | { type: 'session'; id: string; title: string }
  | { type: 'file'; path: string; name: string; isDirty: boolean }

export type ActivityView = 'chat' | 'explorer' | 'settings'

export type Model = {
  id: string
  label: string
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
}

export const MODELS: Model[] = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', provider: 'anthropic' },
]
