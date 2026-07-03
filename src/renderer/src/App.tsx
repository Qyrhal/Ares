import React, { useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FileNode, Tab, FileAttachment } from '@/types'
import { ActivityBar } from '@/components/ActivityBar'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { ChatView } from '@/components/ChatView'
import { InputBar } from '@/components/InputBar'
import { FileEditor } from '@/components/FileEditor'
import { SettingsPanel } from '@/components/SettingsPanel'
import { TerminalView } from '@/components/TerminalView'
import { useAI } from '@/hooks/useAI'
import { useAppStore } from '@/store/useAppStore'
import { parseSession, parseMessage, parseSettings } from '@/schemas'
import { applyTheme } from '@/lib/theme'

const el = window.electron

export default function App(): React.ReactElement {
  const store = useAppStore()
  const { sendMessage } = useAI(store.settings)

  // ── Derived selectors ────────────────────────────────────────────────────────
  const activeSessionTab = store.tabs.find(
    (t): t is Tab & { type: 'session' } => t.type === 'session' && t.id === store.activeTabId
  )
  const activeTab = store.tabs.find((t) =>
    t.type === 'session' ? t.id === store.activeTabId : t.path === store.activeTabId
  )
  const activeSession = store.sessions.find((s) => s.id === activeSessionTab?.id) ?? null

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([el.settings.get(), el.db.getSessions(), el.workspace.getPath()])
      .then(([rawSettings, rawSessions, wp]) => {
        const settings = parseSettings(rawSettings)
        store.setSettings(settings)
        applyTheme(settings.themeId)

        const sessions = rawSessions.map(parseSession)
        store.setSessions(sessions)

        if (wp) {
          el.fs.readDir(wp).then((nodes) => store.setWorkspace(wp, nodes))
        }

        if (sessions.length > 0) store.openSessionTab(sessions[0])
      })
  }, [])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionTab) { store.setMessages([]); return }
    el.db.getMessages(activeSessionTab.id).then((raw) => store.setMessages(raw.map(parseMessage)))
  }, [activeSessionTab?.id])

  // Keyboard shortcuts — reads store state directly to avoid stale closures
  useEffect(() => {
    const tabKey = (t: Tab): string => (t.type === 'session' ? t.id : t.path)
    const handler = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      const { tabs, activeTabId } = useAppStore.getState()

      if (e.key === 'n' || e.key === 't') { e.preventDefault(); handleNewSession(); return }
      if (e.key === 'w') {
        e.preventDefault()
        if (activeTabId) useAppStore.getState().closeTab(activeTabId)
        return
      }
      if (e.key === '`') { e.preventDefault(); useAppStore.getState().toggleTerminal(); return }
      if (e.key === '[') {
        e.preventDefault()
        if (!tabs.length) return
        const idx = tabs.findIndex((t) => tabKey(t) === activeTabId)
        const prev = tabs[idx <= 0 ? tabs.length - 1 : idx - 1]
        if (prev) useAppStore.getState().selectTab(tabKey(prev))
        return
      }
      if (e.key === ']') {
        e.preventDefault()
        if (!tabs.length) return
        const idx = tabs.findIndex((t) => tabKey(t) === activeTabId)
        const next = tabs[idx >= tabs.length - 1 ? 0 : idx + 1]
        if (next) useAppStore.getState().selectTab(tabKey(next))
        return
      }
      const num = parseInt(e.key, 10)
      if (!isNaN(num) && num >= 1 && num <= 9) {
        e.preventDefault()
        const tab = tabs[num - 1]
        if (tab) useAppStore.getState().selectTab(tabKey(tab))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Session operations ───────────────────────────────────────────────────────
  const handleNewSession = useCallback(async () => {
    const raw = await el.db.createSession('New session', useAppStore.getState().settings.defaultModel)
    const session = parseSession(raw)
    store.addSession(session)
    store.openSessionTab(session)
    store.setMessages([])
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    const session = useAppStore.getState().sessions.find((s) => s.id === id)
    if (session) store.openSessionTab(session)
  }, [])

  const handleDeleteSession = useCallback(async (id: string) => {
    await el.db.deleteSession(id)
    store.removeSession(id)
    store.closeTab(id)
  }, [])

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string, attachments: FileAttachment[]) => {
    const { isLoading, messages } = useAppStore.getState()
    const sess = activeSession
    if (!sess || isLoading) return

    const rawUser = await el.db.addMessage(sess.id, 'user', text, { attachments })
    if (!rawUser) return
    const userMsg = parseMessage(rawUser)
    store.appendMessage(userMsg)

    if (messages.length === 0 && text.trim()) {
      const title = text.slice(0, 40)
      await el.db.updateSession(sess.id, { title })
      store.updateSession(sess.id, { title })
    }

    store.setLoading(true)
    const streamingId = uuidv4()
    let streamingMsg = {
      id: streamingId, sessionId: sess.id, role: 'assistant' as const,
      content: '', isStreaming: true, createdAt: Date.now(),
    }

    await sendMessage(
      [...messages, userMsg],
      (chunk) => {
        streamingMsg = { ...streamingMsg, content: chunk }
        store.upsertMessage(streamingId, streamingMsg)
      },
      async (fullText) => {
        const rawA = await el.db.addMessage(sess.id, 'assistant', fullText)
        const aMsg = rawA
          ? parseMessage(rawA)
          : { ...streamingMsg, id: uuidv4(), isStreaming: false }
        store.upsertMessage(streamingId, aMsg)
        const current = useAppStore.getState().sessions.find((s) => s.id === sess.id)
        store.updateSession(sess.id, { messageCount: (current?.messageCount ?? 0) + 1 })
        store.setLoading(false)
      },
      async (toolName, toolInput) => {
        const rawT = await el.db.addMessage(sess.id, 'tool', '', { toolName, toolStatus: 'running', toolInput })
        if (rawT) store.appendMessage(parseMessage(rawT))
      },
      async (toolOutput) => {
        store.updateRunningTool({ toolStatus: 'done', toolOutput })
      },
      (err) => {
        store.upsertMessage(streamingId, { ...streamingMsg, content: `**Error:** ${err.message}`, isStreaming: false })
        store.setLoading(false)
      }
    )
  }, [activeSession, sendMessage])

  // ── File system ──────────────────────────────────────────────────────────────
  const refreshTree = useCallback(async () => {
    const { workspacePath } = useAppStore.getState()
    if (!workspacePath) return
    const nodes = await el.fs.readDir(workspacePath)
    store.setFileNodes(nodes)
  }, [])

  const handleFsCreateFile = useCallback(async (parentPath: string, name: string) => {
    const fullPath = parentPath + '/' + name
    await el.fs.createFile(fullPath)
    await refreshTree()
    store.openFileTab({ name, path: fullPath, type: 'file' })
  }, [refreshTree])

  const handleFsCreateFolder = useCallback(async (parentPath: string, name: string) => {
    await el.fs.createFolder(parentPath + '/' + name)
    await refreshTree()
  }, [refreshTree])

  const handleFsRename = useCallback(async (oldPath: string, newName: string) => {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = dir + '/' + newName
    await el.fs.rename(oldPath, newPath)
    await refreshTree()
    store.renameTabPaths(oldPath, newPath, newName)
  }, [refreshTree])

  const handleFsDelete = useCallback(async (node: FileNode) => {
    await el.fs.delete(node.path)
    await refreshTree()
    store.removeTabsByPath(node.path, node.type === 'directory')
  }, [refreshTree])

  const handleSaveSettings = useCallback(async (s: typeof store.settings) => {
    await el.settings.set(s)
    store.setSettings(s)
    applyTheme(s.themeId)
  }, [])

  const handleOpenFolder = useCallback(async () => {
    const p = await el.dialog.openFolder()
    if (!p) return
    await el.workspace.setPath(p)
    const nodes = await el.fs.readDir(p)
    store.setWorkspace(p, nodes)
    store.setActiveView('explorer')
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <div className="drag-region relative flex h-10 shrink-0 items-center justify-center border-b border-border">
        <span className="no-drag pointer-events-none select-none font-display text-[11px] font-black tracking-[0.5em] text-foreground/40">
          ARES
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          activeView={store.activeView}
          onChangeView={store.setActiveView}
          terminalOpen={store.terminalOpen}
          onToggleTerminal={store.toggleTerminal}
        />

        {store.activeView !== 'settings' && (
          <Sidebar
            mode={store.activeView}
            sessions={store.sessions}
            activeSessionId={activeSessionTab?.id ?? null}
            onNewSession={handleNewSession}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            fileNodes={store.fileNodes}
            workspacePath={store.workspacePath}
            onOpenFile={store.openFileTab}
            onOpenFolder={handleOpenFolder}
            onFsCreateFile={handleFsCreateFile}
            onFsCreateFolder={handleFsCreateFolder}
            onFsRename={handleFsRename}
            onFsDelete={handleFsDelete}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {store.activeView !== 'settings' && (
            <TabBar
              tabs={store.tabs}
              activeTabId={store.activeTabId}
              onSelectTab={store.selectTab}
              onCloseTab={store.closeTab}
            />
          )}

          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            {store.activeView === 'settings' ? (
              <SettingsPanel settings={store.settings} onSave={handleSaveSettings} />
            ) : activeTab?.type === 'file' ? (
              <FileEditor
                path={activeTab.path}
                onDirtyChange={(dirty) => store.setTabDirty(activeTab.path, dirty)}
              />
            ) : activeTab?.type === 'session' && activeSession ? (
              <>
                <ChatView
                  messages={store.messages}
                  sessionTitle={activeSession.title}
                  isLoading={store.isLoading}
                />
                <InputBar
                  onSend={handleSend}
                  disabled={store.isLoading}
                  placeholder={`Ask ${activeSession.model || store.settings.defaultModel}…`}
                />
              </>
            ) : (
              <EmptyMain onNewSession={handleNewSession} onOpenFolder={handleOpenFolder} />
            )}
          </div>

          {store.terminalOpen && (
            <div className="h-56 shrink-0 border-t border-border overflow-hidden">
              <TerminalView
                key={store.terminalKey}
                cwd={store.workspacePath}
                onClose={store.toggleTerminal}
                onNewTerminal={store.bumpTerminal}
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
