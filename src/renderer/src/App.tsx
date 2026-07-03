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
import { TerminalView } from '@/components/TerminalView'

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
  apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', themeId: 'red'
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

  // ── Terminal ───────────────────────────────────────────────────────────────
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalKey, setTerminalKey] = useState(0) // bump to restart shell

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

  // ── Tab helpers ────────────────────────────────────────────────────────────
  const openSessionTab = useCallback((session: Session): void => {
    setTabs((prev) => {
      if (prev.find((t) => t.type === 'session' && t.id === session.id)) return prev
      return [...prev, { type: 'session', id: session.id, title: session.title }]
    })
    setActiveTabId(session.id)
    setActiveView('chat')
  }, [])

  const openFileTab = useCallback((node: FileNode): void => {
    setTabs((prev) => {
      if (prev.find((t) => t.type === 'file' && t.path === node.path)) return prev
      return [...prev, { type: 'file', path: node.path, name: node.name, isDirty: false }]
    })
    setActiveTabId(node.path)
  }, [])

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

  // Keyboard shortcuts — after handleNewSession so it's not in TDZ
  useEffect(() => {
    const tabId = (t: Tab): string => (t.type === 'session' ? t.id : t.path)
    const handler = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'n' || e.key === 't') { e.preventDefault(); handleNewSession(); return }
      if (e.key === 'w') {
        e.preventDefault()
        if (activeTabId) handleCloseTab(activeTabId)
        return
      }
      if (e.key === '`') { e.preventDefault(); setTerminalOpen((v) => !v); return }
      if (e.key === '[') {
        e.preventDefault()
        if (tabs.length === 0) return
        const idx = tabs.findIndex((t) => tabId(t) === activeTabId)
        const prev = tabs[idx <= 0 ? tabs.length - 1 : idx - 1]
        if (prev) setActiveTabId(tabId(prev))
        return
      }
      if (e.key === ']') {
        e.preventDefault()
        if (tabs.length === 0) return
        const idx = tabs.findIndex((t) => tabId(t) === activeTabId)
        const next = tabs[idx >= tabs.length - 1 ? 0 : idx + 1]
        if (next) setActiveTabId(tabId(next))
        return
      }
      const num = parseInt(e.key, 10)
      if (!isNaN(num) && num >= 1 && num <= 9) {
        e.preventDefault()
        const tab = tabs[num - 1]
        if (tab) setActiveTabId(tabId(tab))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNewSession, activeTabId, tabs])

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

  // ── File system operations ─────────────────────────────────────────────────
  const refreshTree = useCallback(async () => {
    if (!workspacePath) return
    const nodes = await el.fs.readDir(workspacePath)
    setFileNodes(nodes)
  }, [workspacePath])

  const handleFsCreateFile = useCallback(async (parentPath: string, name: string) => {
    const fullPath = parentPath + '/' + name
    await el.fs.createFile(fullPath)
    await refreshTree()
    openFileTab({ name, path: fullPath, type: 'file' })
  }, [refreshTree, openFileTab])

  const handleFsCreateFolder = useCallback(async (parentPath: string, name: string) => {
    await el.fs.createFolder(parentPath + '/' + name)
    await refreshTree()
  }, [refreshTree])

  const handleFsRename = useCallback(async (oldPath: string, newName: string) => {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = dir + '/' + newName
    await el.fs.rename(oldPath, newPath)
    await refreshTree()
    // Update any open tabs that match oldPath or are inside a renamed folder
    setTabs((prev) => prev.map((t) => {
      if (t.type !== 'file') return t
      if (t.path === oldPath) return { ...t, path: newPath, name: newName }
      if (t.path.startsWith(oldPath + '/')) return { ...t, path: newPath + t.path.slice(oldPath.length) }
      return t
    }))
    setActiveTabId((id) => {
      if (id === oldPath) return newPath
      if (id?.startsWith(oldPath + '/')) return newPath + id.slice(oldPath.length)
      return id
    })
  }, [refreshTree])

  const handleFsDelete = useCallback(async (node: FileNode) => {
    await el.fs.delete(node.path)
    await refreshTree()
    // Close tabs for deleted file or files inside deleted folder
    setTabs((prev) => {
      const removed = prev.filter((t) =>
        t.type === 'file' && (
          t.path === node.path ||
          (node.type === 'directory' && t.path.startsWith(node.path + '/'))
        )
      )
      const next = prev.filter((t) => !removed.includes(t))
      setActiveTabId((id) => {
        if (removed.some((t) => (t.type === 'file' ? t.path : t.id) === id)) {
          const fallback = next[next.length - 1]
          return fallback ? (fallback.type === 'session' ? fallback.id : fallback.path) : null
        }
        return id
      })
      return next
    })
  }, [refreshTree])

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
      <div className="drag-region relative flex h-10 shrink-0 items-center justify-center border-b border-border">
        <span className="no-drag pointer-events-none select-none font-display text-[11px] font-black tracking-[0.5em] text-foreground/40">
          ARES
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <ActivityBar
          activeView={activeView}
          onChangeView={setActiveView}
          terminalOpen={terminalOpen}
          onToggleTerminal={() => setTerminalOpen((v) => !v)}
        />

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
            onOpenFile={openFileTab}
            onOpenFolder={handleOpenFolder}
            onFsCreateFile={handleFsCreateFile}
            onFsCreateFolder={handleFsCreateFolder}
            onFsRename={handleFsRename}
            onFsDelete={handleFsDelete}
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

          {/* Content — flex-col so ChatView/InputBar fill height; min-h-0 allows shrink when terminal opens */}
          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
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

          {/* Terminal panel */}
          {terminalOpen && (
            <div className="h-56 shrink-0 border-t border-border overflow-hidden">
              <TerminalView
                key={terminalKey}
                cwd={workspacePath}
                onClose={() => setTerminalOpen(false)}
                onNewTerminal={() => setTerminalKey((k) => k + 1)}
              />
            </div>
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
