import React, { useCallback, useEffect, useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FileNode, Tab, FileAttachment, Message } from '@/types'
import { ActivityBar } from '@/components/ActivityBar'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { ChatView } from '@/components/ChatView'
import { InputBar } from '@/components/InputBar'
import { FileEditor } from '@/components/FileEditor'
import { SettingsPanel } from '@/components/SettingsPanel'
import { TerminalView } from '@/components/TerminalView'
import { CommitDetail } from '@/components/CommitDetail'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PermissionPrompt } from '@/components/PermissionPrompt'
import { useAI } from '@/hooks/useAI'
import { useAppStore } from '@/store/useAppStore'
import { parseSession, parseMessage, parseSettings } from '@/schemas'
import { applyTheme } from '@/lib/theme'

const el = window.electron

function tabKey(t: Tab): string {
  return t.type === 'session' ? t.id : t.path
}

export default function App(): React.ReactElement {
  const store = useAppStore()
  const { sendMessage } = useAI(store.settings)
  const [gitBadge, setGitBadge] = useState(0)

  // ── Permission prompt ───────────────────────────────────────────────────────
  const [pendingPerm, setPendingPerm] = useState<{ toolName: string; toolArgs: string } | null>(null)
  const permResolver = useRef<((allow: boolean) => void) | null>(null)

  const handlePermApprove = useCallback(() => {
    permResolver.current?.(true)
    permResolver.current = null
    setPendingPerm(null)
  }, [])

  const handlePermDeny = useCallback(() => {
    permResolver.current?.(false)
    permResolver.current = null
    setPendingPerm(null)
  }, [])

  const onToolPermission = useCallback(async (name: string, args: string): Promise<boolean> => {
    return new Promise((resolve) => {
      permResolver.current = resolve
      setPendingPerm({ toolName: name, toolArgs: args })
    })
  }, [])

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
    Promise.all([el.settings.get(), el.db.getSessions(), el.workspace.getPath(), el.workspace.getRecent().catch(() => [])])
      .then(([rawSettings, rawSessions, wp, recents]) => {
        const settings = parseSettings(rawSettings)
        store.setSettings(settings)
        applyTheme(settings.themeId)

        const sessions = rawSessions.map(parseSession)
        store.setSessions(sessions)
        store.setRecentProjects(Array.isArray(recents) ? recents : [])

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

  // Git badge — poll status every 30s to show pending changes/ahead count
  useEffect(() => {
    const wp = store.workspacePath
    if (!wp) { setGitBadge(0); return }
    const poll = (): void => {
      el.git.status(wp).then((s) => {
        if (!s.hasRepo) { setGitBadge(0); return }
        setGitBadge(s.ahead + s.staged.length + s.unstaged.length + s.untracked.length)
      }).catch(() => setGitBadge(0))
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [store.workspacePath])

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

  const handleTogglePinSession = useCallback(async (id: string) => {
    const s = useAppStore.getState().sessions.find((s) => s.id === id)
    if (!s) return
    await el.db.updateSession(id, { pinned: !s.pinned })
    store.togglePinSession(id)
  }, [])

  // Close a tab: session tabs also remove from sidebar + delete from DB.
  const handleCloseTab = useCallback(async (id: string) => {
    const { tabs } = useAppStore.getState()
    const tab = tabs.find((t) => tabKey(t) === id)
    if (tab?.type === 'session') {
      await handleDeleteSession(tab.id)
    } else {
      useAppStore.getState().closeTab(id)
    }
  }, [handleDeleteSession])

  // Keyboard shortcuts — reads store state directly to avoid stale closures
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      const { tabs, activeTabId } = useAppStore.getState()

      if (e.key === 'n' || e.key === 't') { e.preventDefault(); handleNewSession(); return }
      if (e.key === 'w') {
        e.preventDefault()
        if (activeTabId) handleCloseTab(activeTabId)
        return
      }
      if (e.key === '`' || e.key === 'j') { e.preventDefault(); useAppStore.getState().toggleTerminal(); return }
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
  }, [handleCloseTab])

  // ── @mention expansion ───────────────────────────────────────────────────────
  const expandMentions = useCallback(async (msgs: Message[], wp: string | null): Promise<Message[]> => {
    if (!wp) return msgs
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'user') return msgs

    const mentionRegex = /@([^\s\n]+)/g
    const mentions = [...last.content.matchAll(mentionRegex)]
    if (mentions.length === 0) return msgs

    const fileContexts: string[] = []
    for (const m of mentions) {
      const relPath = m[1]
      const absPath = wp + '/' + relPath
      try {
        const content = await el.tools.readFile(absPath)
        fileContexts.push(`\`${relPath}\`:\n\`\`\`\n${content}\n\`\`\``)
      } catch {
        // file doesn't exist or can't be read — skip
      }
    }
    if (fileContexts.length === 0) return msgs

    const prefix = fileContexts.join('\n\n')
    const expanded = { ...last, content: `${prefix}\n\n${last.content}` }
    return [...msgs.slice(0, -1), expanded]
  }, [])

  // ── Slash commands ────────────────────────────────────────────────────────────
  const handleCommand = useCallback(async (cmd: string, args: string) => {
    const sess = activeSession
    if (!sess) return

    switch (cmd) {
      case 'model': {
        if (!args) {
          const cur = sess.model || store.settings.defaultModel
          const msg = await el.db.addMessage(sess.id, 'system', `Current model: ${cur}. Use /model <name> to switch.`)
          if (msg) store.appendMessage(parseMessage(msg))
          return
        }
        await el.db.updateSession(sess.id, { model: args })
        store.updateSession(sess.id, { model: args })
        const msg = await el.db.addMessage(sess.id, 'system', `Switched model to ${args}`)
        if (msg) store.appendMessage(parseMessage(msg))
        break
      }
      case 'clear': {
        const msgs = useAppStore.getState().messages
        for (const m of msgs) {
          await el.db.deleteMessage(m.id)
        }
        store.setMessages([])
        break
      }
      case 'help': {
        const helpText = 'Commands: /model <name> - change model, /clear - clear messages, /help - this help'
        const msg = await el.db.addMessage(sess.id, 'system', helpText)
        if (msg) store.appendMessage(parseMessage(msg))
        break
      }
    }
  }, [activeSession, store])

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string, attachments: FileAttachment[]) => {
    const { isLoading, messages, workspacePath } = useAppStore.getState()
    const sess = activeSession
    if (!sess || isLoading) return

    const rawUser = await el.db.addMessage(sess.id, 'user', text, { attachments })
    if (!rawUser) return
    const userMsg = parseMessage(rawUser)
    store.appendMessage(userMsg)

    if (messages.length === 0 && text.trim()) {
      const title = text.slice(0, 100).replace(/@\S+\s*/g, '').trim() || text.slice(0, 40)
      await el.db.updateSession(sess.id, { title })
      store.updateSession(sess.id, { title })
    }

    const expandedMessages = await expandMentions([...messages, userMsg], workspacePath)

    store.setLoading(true)
    const streamingId = uuidv4()
    let streamingMsg = {
      id: streamingId, sessionId: sess.id, role: 'assistant' as const,
      content: '', isStreaming: true, createdAt: Date.now(),
    }

    await sendMessage(
      sess.model || store.settings.defaultModel || 'gpt-4o-mini',
      expandedMessages,
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
      },
      store.settings.permissionMode,
      onToolPermission,
      workspacePath,
    )
  }, [activeSession, sendMessage, expandMentions, onToolPermission])

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
    el.workspace.getRecent().then((r) => store.setRecentProjects(r as string[]))
  }, [])

  const handleSelectProject = useCallback(async (path: string) => {
    await el.workspace.setPath(path)
    const nodes = await el.fs.readDir(path)
    store.setWorkspace(path, nodes)
    store.setActiveView('explorer')
    el.workspace.getRecent().then((r) => store.setRecentProjects(r as string[]))
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
          gitBadge={gitBadge}
        />

        {store.activeView !== 'settings' && (
          <Sidebar
            mode={store.activeView}
            sessions={store.sessions}
            activeSessionId={activeSessionTab?.id ?? null}
            onNewSession={handleNewSession}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onTogglePinSession={handleTogglePinSession}
            fileNodes={store.fileNodes}
            workspacePath={store.workspacePath}
            selectedFilePath={store.activeTabId}
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
              onCloseTab={handleCloseTab}
              onNewSession={handleNewSession}
            />
          )}

          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            {store.activeView === 'settings' ? (
              <SettingsPanel settings={store.settings} onSave={handleSaveSettings} />
            ) : store.activeView === 'git' && store.activeCommit && !activeTab ? (
              <ErrorBoundary key="commit-detail"><CommitDetail /></ErrorBoundary>
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
                  onSuggestion={(text) => handleSend(text, [])}
                />
                {pendingPerm && (
                  <PermissionPrompt
                    toolName={pendingPerm.toolName}
                    toolArgs={pendingPerm.toolArgs}
                    onApprove={handlePermApprove}
                    onDeny={handlePermDeny}
                  />
                )}
                <InputBar
                  onSend={handleSend}
                  onCommand={handleCommand}
                  onRevealInExplorer={() => {
                    if (store.workspacePath) {
                      store.setActiveView('explorer')
                    } else {
                      handleOpenFolder()
                    }
                  }}
                  disabled={store.isLoading}
                  placeholder={`Ask ${activeSession.model || store.settings.defaultModel}…`}
                  workspacePath={store.workspacePath}
                  fileNodes={store.fileNodes}
                  apiBaseUrl={store.settings.apiBaseUrl}
                  apiKey={store.settings.apiKey}
                  recentProjects={store.recentProjects}
                  onSelectProject={handleSelectProject}
                  onOpenFinder={handleOpenFolder}
                />
              </>
            ) : (
              <EmptyMain onNewSession={handleNewSession} onOpenFolder={handleOpenFolder} />
            )}
          </div>

          {store.terminalOpen && (
            <div className="h-56 shrink-0 border-t border-border">
              <TerminalView
                cwd={store.workspacePath}
                onClose={store.toggleTerminal}
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
