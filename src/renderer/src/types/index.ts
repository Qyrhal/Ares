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

export type EffortLevel = 'low' | 'medium' | 'high'

export interface Session {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
  messageCount: number
  pinned?: boolean
  effort?: EffortLevel
  permissionMode?: PermissionMode
}

export type PermissionMode = 'ask' | 'auto' | 'yolo'

export interface AppSettings {
  apiKey: string
  apiBaseUrl: string
  defaultModel: string
  themeId: string
  systemPrompt: string
  permissionMode: PermissionMode
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

export type ActivityView = 'chat' | 'explorer' | 'git' | 'settings'

export interface GitFile {
  path: string
  originalPath?: string
  index: string
  working: string
}

export interface GitStatus {
  hasRepo: boolean
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: GitFile[]
  unstaged: GitFile[]
  untracked: GitFile[]
}

export interface GitCommit {
  hash: string
  shortHash: string
  parents: string[]
  author: string
  date: string
  message: string
}

export interface GitBranches {
  local: string[]
  current: string
}

