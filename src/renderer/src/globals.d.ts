import type { AppSettings, FileNode, Checkpoint, Hook } from './types'
import type { GitStatus, GitBranches } from './types'

export interface RawSession {
  id: string; title: string; model: string
  created_at: number; updated_at: number; message_count?: number; pinned?: boolean; is_side_chat?: boolean
}

export interface RawMessage {
  id: string; session_id: string; role: string; content: string
  attachments: string | null; tool_name: string | null
  tool_status: string | null; tool_input: string | null
  tool_output: string | null; created_at: number
  reply_to: string | null; reactions: string | null
}

export interface McpStatus {
  name: string
  connected: boolean
  error?: string
  toolCount: number
}

export interface SearchResult {
  sessionId: string
  sessionTitle: string
  messageId: string
  content: string
  role: string
}

declare global {
  interface Window {
    electron: {
      db: {
        getSessions(): Promise<RawSession[]>
        createSession(title: string, model?: string, parentId?: string | null, isSideChat?: boolean): Promise<RawSession>
        updateSession(id: string, updates: object): Promise<void>
        deleteSession(id: string): Promise<void>
        getMessages(sessionId: string): Promise<RawMessage[]>
        addMessage(sessionId: string, role: string, content: string, opts?: object): Promise<RawMessage>
        deleteMessage(id: string): Promise<void>
        updateMessage(id: string, updates: object): Promise<void>
        searchMessages(query: string): Promise<SearchResult[]>
      }
      settings: {
        get(): Promise<AppSettings>
        set(s: AppSettings): Promise<void>
      }
      workspace: {
        getPath(): Promise<string | null>
        setPath(p: string | null): Promise<void>
        getRecent(): Promise<string[]>
      }
      dialog: { openFolder(): Promise<string | null> }
      fs: {
        readDir(path: string): Promise<FileNode[]>
        readFile(path: string): Promise<string>
        writeFile(path: string, content: string): Promise<void>
        createFile(path: string): Promise<void>
        createFolder(path: string): Promise<void>
        rename(oldPath: string, newPath: string): Promise<void>
        delete(path: string): Promise<void>
        findFiles(dir: string): Promise<string[]>
      }
      terminal: {
        create(cwd: string): Promise<string>
        write(id: string, data: string): void
        resize(id: string, cols: number, rows: number): Promise<void>
        kill(id: string): void
        onOutput(cb: (id: string, data: string) => void): () => void
      }
      ext: { fetchModels(baseUrl: string, apiKey: string): Promise<{ data: { id: string }[] }> }
      tools: {
        readFile(path: string): Promise<string>
        writeFile(path: string, content: string): Promise<void>
        editFile(path: string, oldString: string, newString: string): Promise<void>
        createFile(path: string, content: string): Promise<void>
        listFiles(dir: string): Promise<{ name: string; path: string; isDirectory: boolean }[]>
      }
      git: {
        status(cwd: string): Promise<GitStatus>
        stageFile(cwd: string, path: string): Promise<void>
        unstageFile(cwd: string, path: string): Promise<void>
        stageAll(cwd: string): Promise<void>
        unstageAll(cwd: string): Promise<void>
        discardFile(cwd: string, path: string): Promise<void>
        commit(cwd: string, message: string): Promise<void>
        push(cwd: string): Promise<string>
        pull(cwd: string): Promise<string>
        branches(cwd: string): Promise<GitBranches>
        checkout(cwd: string, branch: string): Promise<void>
        createBranch(cwd: string, branch: string): Promise<void>
        diff(cwd: string, path: string, staged: boolean): Promise<string>
        log(cwd: string, limit?: number): Promise<{ hash: string; shortHash: string; parents: string[]; author: string; date: string; message: string }[]>
        init(cwd: string): Promise<void>
      }
      checkpoint: {
        create(cwd: string, msg: string): Promise<Checkpoint | null>
        list(cwd: string): Promise<Checkpoint[]>
        restore(cwd: string, idx: number): Promise<{ ok: boolean; error?: string }>
        drop(cwd: string, idx: number): Promise<{ ok: boolean; error?: string }>
        diff(cwd: string, idx: number): Promise<string>
      }
      lsp: {
        diagnostics(filePath: string): Promise<{ file: string; line: number; column: number; message: string; severity: string; code?: string }[]>
        hasSupport(): Promise<boolean>
      }
      hooks: { get(): Promise<Hook[]>; set(hooks: Hook[]): Promise<void> }
      session: {
        export(title: string, id: string, messages: unknown[]): Promise<string | null>
        import(): Promise<{ title: string; messages: unknown[] } | { error: string } | null>
      }
      mcp: { status(): Promise<McpStatus[]> }
      shell: { openExternal(url: string): Promise<void> }
      agentConfig: {
        get(): Promise<import('./types').AgentConfig>
        set(config: object): Promise<void>
        onScanResult(cb: (result: { skills: number; extensions: number; mcpServers: number; commands: number }) => void): () => void
      }
      pi: {
        send(reqId: string, sessionId: string, message: string, model: string, apiBaseUrl: string, apiKey: string, cwd: string | null): void
        abort(sessionId: string): void
        cleanup(sessionId: string): void
        onDelta(cb: (reqId: string, text: string) => void): () => void
        onDone(cb: (reqId: string, text: string, thinking?: string) => void): () => void
        onThinkingDelta(cb: (reqId: string, text: string) => void): () => void
        onToolStart(cb: (reqId: string, name: string, input: string) => void): () => void
        onToolEnd(cb: (reqId: string, output: string, isError: boolean) => void): () => void
        onError(cb: (reqId: string, message: string) => void): () => void
        spawnFromUi(parentSessionId: string, task: string, title: string): Promise<unknown>
      }
    }
  }
}
