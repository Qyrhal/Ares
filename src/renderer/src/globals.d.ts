import type { AppSettings, FileNode } from './types'

export interface RawSession {
  id: string; title: string; model: string
  created_at: number; updated_at: number; message_count?: number
}

export interface RawMessage {
  id: string; session_id: string; role: string; content: string
  attachments: string | null; tool_name: string | null
  tool_status: string | null; tool_input: string | null
  tool_output: string | null; created_at: number
}

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
      }
    }
  }
}
