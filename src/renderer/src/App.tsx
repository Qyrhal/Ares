import React, { useCallback, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Session, Message, AppSettings, FileNode, Tab, ActivityView } from '@/types'
import { ActivityBar } from '@/components/ActivityBar'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { ChatView } from '@/components/ChatView'
import { InputBar } from '@/components/InputBar'
import { FileEditor } from '@/components/FileEditor'
import { SettingsPanel } from '@/components/SettingsPanel'
import { useAI } from '@/hooks/useAI'
import { FileAttachment } from '@/types'
import type { RawSession, RawMessage } from './globals'
import { applyTheme } from '@/lib/theme'

const el = window.electron

function toSession(r: RawSession): Session {
  return {
    id: r.id, title: r.title, model: r.model,
    createdAt: r.created_at, updatedAt: r.updated_at,
    messageCount: r.message_count ?? 0
  }
}

function toMessage(r: RawMessage): Message {
  return {
    id: r.id, sessionId: r.session_id, role: r.role as Message['role'],
    content: r.content,
    attachments: r.attachments ? JSON.parse(r.attachments) : undefined,
    toolName: r.tool_name ?? undefined,
    toolStatus: (r.tool_status as Message['toolStatus']) ?? undefined,
    toolInput: r.tool_input ?? undefined,
    toolOutput: r.tool_output ?? undefined,
    createdAt: r.created_at
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini'
}

export default function App(): React.ReactElement {
  // ── App-level state ────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActivityView>('chat')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  // ── Sessions ───────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // ── File explorer ──────────────────────────────────────────────────────────
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)
  const [fileNodes, setFileNodes] = useState<FileNode[]>([])

  const { sendMessage } = useAI(settings)

  const activeSessionTab = tabs.find(
    (t): t is Tab & { type: 'session' } => t.type === 'session' && t.id === activeTabId
  )
  const activeSession = sessions.find((s) => s.id === activeSessionTab?.id) ?? null

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      el.settings.get(),
      el.db.getSessions(),
      el.workspace.getPath()
    ]).then(([s, rawSessions, wp]) => {
      setSettings(s)
      applyTheme(s.themeId || 'red')
      const loaded = rawSessions.map(toSession)
      setSessions(loaded)
      if (wp) {
        setWorkspacePath(wp)
        el.fs.readDir(wp).then(setFileNodes)
      }
      // Auto-open most recent session
      if (loaded.length > 0) openSessionTab(loaded[0])
    })
  }, [])

  // Load messages when active session tab changes
  useEffect(() => {
    if (!activeSessionTab) { setMessages([]); return }
    el.db.getMessages(activeSessionTab.id).then((raw) => setMessages(raw.map(toMessage)))
  }, [activeSessionTab?.id])

  // Keyboard shortcut Cmd+N
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); handleNewSession() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Tab helpers ────────────────────────────────────────────────────────────
  function openSessionTab(session: Session): void {
    setTabs((prev) => {
      if (prev.find((t) => t.type === 'session' && t.id === session.id)) return prev
      return [...prev, { type: 'session', id: session.id, title: session.title }]
    })
    setActiveTabId(session.id)
    setActiveView('chat')
  }

  function openFileTab(node: FileNode): void {
    const existingTab = tabs.find((t) => t.type === 'file' && t.path === node.path)
    if (existingTab) {
      setActiveTabId(node.path)
    } else {
      setTabs((prev) => [...prev, { type: 'file', path: node.path, name: node.name, isDirty: false }])
      setActiveTabId(node.path)
    }
  }

  function handleCloseTab(id: string): void {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => (t.type === 'session' ? t.id : t.path) === id)
      const next = prev.filter((_, i) => i !== idx)
      if (activeTabId === id) {
        const newActive = next[Math.min(idx, next.length - 1)]
        setActiveTabId(newActive ? (newActive.type === 'session' ? newActive.id : newActive.path) : null)
      }
      return next
    })
  }

  function handleTabDirtyChange(path: string, isDirty: boolean): void {
    setTabs((prev) =>
      prev.map((t) => t.type === 'file' && t.path === path ? { ...t, isDirty } : t)
    )
  }

  // ── Session operations ─────────────────────────────────────────────────────
  const handleNewSession = useCallback(async () => {
    const raw = await el.db.createSession('New session', settings.defaultModel)
    const session = toSession(raw)
    setSessions((prev) => [session, ...prev])
    openSessionTab(session)
    setMessages([])
  }, [settings.defaultModel])

  const handleSelectSession = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id)
    if (session) openSessionTab(session)
  }, [sessions])

  const handleDeleteSession = useCallback(async (id: string) => {
    await el.db.deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    handleCloseTab(id)
  }, [])

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string, attachments: FileAttachment[]) => {
    if (!activeSession || isLoading) return

    const rawUser = await el.db.addMessage(activeSession.id, 'user', text, { attachments })
    if (!rawUser) return
    const userMsg = toMessage(rawUser)
    setMessages((prev) => [...prev, userMsg])

    if (messages.length === 0 && text.trim()) {
      const title = text.slice(0, 40)
      await el.db.updateSession(activeSession.id, { title })
      setSessions((prev) => prev.map((s) => s.id === activeSession.id ? { ...s, title } : s))
      setTabs((prev) => prev.map((t) =>
        t.type === 'session' && t.id === activeSession.id ? { ...t, title } : t
      ))
    }

    setIsLoading(true)
    const streamingId = uuidv4()
    let streamingMsg: Message = {
      id: streamingId, sessionId: activeSession.id, role: 'assistant',
      content: '', isStreaming: true, createdAt: Date.now()
    }

    await sendMessage(
      [...messages, userMsg],
      (chunk) => {
        streamingMsg = { ...streamingMsg, content: chunk }
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === streamingId)
          return exists
            ? prev.map((m) => m.id === streamingId ? streamingMsg : m)
            : [...prev, streamingMsg]
        })
      },
      async (fullText) => {
        const rawA = await el.db.addMessage(activeSession.id, 'assistant', fullText)
        const aMsg = rawA ? toMessage(rawA) : { ...streamingMsg, id: uuidv4(), isStreaming: false }
        setMessages((prev) => prev.map((m) => m.id === streamingId ? aMsg : m))
        setSessions((prev) => prev.map((s) =>
          s.id === activeSession.id ? { ...s, messageCount: s.messageCount + 1 } : s
        ))
        setIsLoading(false)
      },
      async (toolName, toolInput) => {
        const rawT = await el.db.addMessage(activeSession.id, 'tool', '', {
          toolName, toolStatus: 'running', toolInput
        })
        if (rawT) setMessages((prev) => [...prev, toMessage(rawT)])
      },
      async (toolOutput) => {
        setMessages((prev) => {
          const last = [...prev].reverse().find((m) => m.role === 'tool' && m.toolStatus === 'running')
          if (!last) return prev
          return prev.map((m) => m.id === last.id
            ? { ...last, toolStatus: 'done' as const, toolOutput }
            : m
          )
        })
      },
      (err) => {
        setMessages((prev) => prev.map((m) =>
          m.id === streamingId ? { ...m, content: `**Error:** ${err.message}`, isStreaming: false } : m
        ))
        setIsLoading(false)
      }
    )
  }, [activeSession, isLoading, messages, sendMessage])

  // ── Settings save ──────────────────────────────────────────────────────────
  const handleSaveSettings = useCallback(async (s: AppSettings) => {
    await el.settings.set(s)
    setSettings(s)
  }, [])

  // ── Workspace open ─────────────────────────────────────────────────────────
  const handleOpenFolder = useCallback(async () => {
    const p = await el.dialog.openFolder()
    if (!p) return
    setWorkspacePath(p)
    await el.workspace.setPath(p)
    const nodes = await el.fs.readDir(p)
    setFileNodes(nodes)
    setActiveView('explorer')
  }, [])

  // ── Active tab content ─────────────────────────────────────────────────────
  const activeTab = tabs.find((t) =>
    t.type === 'session' ? t.id === activeTabId : t.path === activeTabId
  )

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* macOS title bar / drag region */}
      <div className="drag-region h-10 shrink-0 border-b border-border" />

      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <ActivityBar activeView={activeView} onChangeView={setActiveView} />

        {/* Sidebar — hidden in settings view */}
        {activeView !== 'settings' && (
          <Sidebar
            mode={activeView}
            sessions={sessions}
            activeSessionId={activeSessionTab?.id ?? null}
            onNewSession={handleNewSession}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            fileNodes={fileNodes}
            workspacePath={workspacePath}
            onOpenFile={(node) => { openFileTab(node); }}
            onOpenFolder={handleOpenFolder}
          />
        )}

        {/* Main panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          {activeView !== 'settings' && (
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              onCloseTab={handleCloseTab}
            />
          )}

          {/* Content */}
          {activeView === 'settings' ? (
            <SettingsPanel settings={settings} onSave={handleSaveSettings} />
          ) : activeTab?.type === 'file' ? (
            <FileEditor
              path={activeTab.path}
              onDirtyChange={(dirty) => handleTabDirtyChange(activeTab.path, dirty)}
            />
          ) : activeTab?.type === 'session' && activeSession ? (
            <>
              <ChatView
                messages={messages}
                sessionTitle={activeSession.title}
                isLoading={isLoading}
              />
              <InputBar
                onSend={handleSend}
                disabled={isLoading}
                placeholder={`Ask ${activeSession.model || settings.defaultModel}…`}
              />
            </>
          ) : (
            <EmptyMain onNewSession={handleNewSession} onOpenFolder={handleOpenFolder} />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyMain({
  onNewSession, onOpenFolder
}: {
  onNewSession: () => void
  onOpenFolder: () => void
}): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
      <p className="text-sm text-muted-foreground">Nothing open yet.</p>
      <div className="flex gap-2">
        <button
          onClick={onNewSession}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
        >
          New session
        </button>
        <button
          onClick={onOpenFolder}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
        >
          Open folder
        </button>
      </div>
    </div>
  )
}
