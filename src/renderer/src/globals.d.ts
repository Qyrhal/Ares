import type { AppSettings, FileNode } from './types'

export interface RawSession {
  id: string; title: string; model: string
  created_at: number; updated_at: number; message_count?: number; pinned?: boolean
}

export interface RawMessage {
  id: string; session_id: string; role: string; content: string
  attachments: string | null; tool_name: string | null
  tool_status: string | null; tool_input: string | null
  tool_output: string | null; created_at: number
}

import type { GitStatus, GitBranches } from './types'

declare global {
  interface Window {
    electron: {
      db: {
        getSessions(): Promise<RawSession[]>
        createSession(title: string, model?: string): Promise<RawSession>
        updateSession(id: string, updates: object): Promise<void>
        deleteSession(id: string): Promise<void>
        getMessages(sessionId: string): Promise<RawMessage[]>
        addMessage(sessionId: string, role: string, content: string, opts?: object): Promise<RawMessage>
        deleteMessage(id: string): Promise<void>
      }
      settings: {
        get(): Promise<AppSettings>
        set(s: AppSettings): Promise<void>
      }
      workspace: {
        getPath(): Promise<string | null>
        setPath(p: string | null): Promise<void>
      }
      dialog: {
        openFolder(): Promise<string | null>
      }
      fs: {
        readDir(path: string): Promise<FileNode[]>
        readFile(path: string): Promise<string>
        writeFile(path: string, content: string): Promise<void>
        createFile(path: string): Promise<void>
        createFolder(path: string): Promise<void>
        rename(oldPath: string, newPath: string): Promise<void>
        delete(path: string): Promise<void>
      }
      terminal: {
        create(cwd: string): Promise<string>
        write(id: string, data: string): void
        resize(id: string, cols: number, rows: number): Promise<void>
        kill(id: string): void
        onOutput(cb: (id: string, data: string) => void): () => void
      }
      ext: {
        fetchModels(baseUrl: string, apiKey: string): Promise<{ data: { id: string }[] }>
      }
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
        init(cwd: string): Promise<void>
      }
    }
  }
}
