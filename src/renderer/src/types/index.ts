export type MessageRole = 'user' | 'assistant' | 'tool' | 'system'
export type ToolStatus = 'running' | 'done' | 'error'

export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  path: string
}

export interface ReplyTo {
  id: string
  content: string
  role: MessageRole
}

export interface MessageReactions {
  up: boolean | null
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
  thinking?: string
  isStreaming?: boolean
  createdAt: number
  replyTo?: ReplyTo
  reactions?: MessageReactions
}

export type EffortLevel = 'low' | 'medium' | 'high'
export type AgentStatus = 'idle' | 'running' | 'done' | 'error'

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
  workspacePath?: string
  parentId?: string | null
  agentStatus?: AgentStatus
}

export interface Todo {
  id: string
  sessionId: string
  text: string
  completed: boolean
  createdAt: number
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

export type ActivityView = 'chat' | 'explorer' | 'git' | 'skills' | 'plugins' | 'settings' | 'hooks' | 'checkpoints' | 'agents'

export interface PiSkill {
  id: string
  name: string
  description: string
  content: string
}

export interface PiExtension {
  id: string
  name: string
  path: string
  enabled: boolean
}

export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
}

export interface SlashCommand {
  id: string
  name: string
  description: string
  prompt: string
  argumentHint?: string
  source: string
}

export interface AgentConfig {
  skills: PiSkill[]
  extensions: PiExtension[]
  mcpServers: McpServer[]
  commands: SlashCommand[]
}

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

// ── Checkpoint ──────────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string
  index: number
  message: string
  date: string
  branch: string
}

// ── LSP (Language Server Protocol) ──────────────────────────────────────────

export interface LspDiagnostic {
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
  code?: string
}

export interface LspConfig {
  servers: LspServerConfig[]
  enabled: boolean
}

export interface LspServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  languages: string[]
  enabled: boolean
}

// ── Custom theme ────────────────────────────────────────────────────────────

export interface CustomTheme {
  id: string
  label: string
  primary: string
  background: string
  foreground: string
  muted: string
  border: string
  accent: string
  card: string
  input: string
  destructive: string
}

// ── Keybind ─────────────────────────────────────────────────────────────────

export interface Keybind {
  id: string
  key: string
  command: string
  description: string
  when?: string // optional scope constraint, e.g. 'chat' | 'editor' | 'terminal'
}

// ── Agent question ──────────────────────────────────────────────────────────

export interface AgentQuestion {
  question: string
  header: string
  options?: string[]
  multiSelect?: boolean
}

// ── Hook ────────────────────────────────────────────────────────────────────

export type HookEvent = 'preTool' | 'postTool' | 'preSend' | 'postSend' | 'onError'
export type HookAction = 'script' | 'prompt' | 'webhook'

export interface Hook {
  id: string
  event: HookEvent
  action: HookAction
  target: string
  enabled: boolean
  description?: string
}

// ── ActivityView extension ─────────────────────────────────────────────────

export interface TokenUsage {\n  input: number\n  output: number\n  total: number\n  cost: number\n  duration: number\n  tokensPerSecond: number\n}\n\nexport type ExtendedActivityView = ActivityView | 'checkpoints'

