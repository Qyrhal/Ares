import React, { useCallback, useEffect, useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FileNode, Tab, FileAttachment, Message, PermissionMode, EffortLevel, AgentQuestion } from '@/types'
import { ActivityBar } from '@/components/ActivityBar'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { ChatView } from '@/components/ChatView'
import { CommandPalette, type CommandEntry } from '@/components/CommandPalette'
import { TabSwitcher } from '@/components/TabSwitcher'
import { QuickFileOpen } from '@/components/QuickFileOpen'
import { InputBar } from '@/components/InputBar'
import { FileEditor } from '@/components/FileEditor'
import { SettingsPanel } from '@/components/SettingsPanel'
import { SkillsPanel } from '@/components/SkillsPanel'
import { PluginsPanel } from '@/components/PluginsPanel'
import { HooksPanel } from '@/components/HooksPanel'
import { CheckpointPanel } from '@/components/CheckpointPanel'
import { StatusBar } from '@/components/StatusBar'
import { TerminalView } from '@/components/TerminalView'
import { CommitDetail } from '@/components/CommitDetail'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PermissionPrompt } from '@/components/PermissionPrompt'
import { AgentTree } from '@/components/AgentTree'
import { AgentDashboard } from '@/components/AgentDashboard'
import { AgentQuestionCard } from '@/components/AgentQuestionCard'
import { useAI } from '@/hooks/useAI'
import { useAppStore } from '@/store/useAppStore'
import { parseSession, parseMessage, parseSettings, parseTodo } from '@/schemas'
import { applyTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/toaster'
import { toast } from 'sonner'

const el = window.electron

function tabKey(t: Tab): string {
  return t.type === 'session' ? t.id : t.path
}

export default function App(): React.ReactElement {
  const store = useAppStore()
  const { sendMessage } = useAI(store.settings)
  const [gitBadge, setGitBadge] = useState(0)
  const [agentSkills, setAgentSkills] = useState<import('@/types').PiSkill[]>([])
  const [agentCommands, setAgentCommands] = useState<import('@/types').SlashCommand[]>([])

  // ── Reply-to state ───────────────────────────────────────────────────────────
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // ── Modal overlays ────────────────────────────────────────────────────────────
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quickFileOpenOpen, setQuickFileOpenOpen] = useState(false)
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false)

  const paletteCommands = React.useMemo(() => usePaletteCommands(store), [store])

  // ── Agent question prompt ───────────────────────────────────────────────────
  const [pendingQuestion, setPendingQuestion] = useState<{
    sessionId: string
    questionId: string
    questions: AgentQuestion[]
  } | null>(null)

  const handleQuestionSubmit = useCallback((answers: Record<string, string>) => {
    if (!pendingQuestion) return
    el.pi.sendUserAnswer(pendingQuestion.questionId, answers)
    setPendingQuestion(null)
  }, [pendingQuestion])

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

    const refreshAgentConfig = (cfg: import('@/types').AgentConfig | null) => {
      if (!cfg) return
      setAgentSkills(cfg.skills ?? [])
      setAgentCommands(cfg.commands ?? [])
    }

    el.agentConfig.get().then(refreshAgentConfig)

    const offScan = el.agentConfig.onScanResult(({ skills, extensions, mcpServers, commands }) => {
      const total = skills + extensions + mcpServers + commands
      if (total === 0) return
      const parts: string[] = []
      if (skills > 0) parts.push(`${skills} skill${skills !== 1 ? 's' : ''}`)
      if (commands > 0) parts.push(`${commands} slash command${commands !== 1 ? 's' : ''}`)
      if (extensions > 0) parts.push(`${extensions} extension${extensions !== 1 ? 's' : ''}`)
      if (mcpServers > 0) parts.push(`${mcpServers} MCP server${mcpServers !== 1 ? 's' : ''}`)
      toast(`${total} plugin${total !== 1 ? 's' : ''} found and loaded`, {
        description: parts.join(', '),
        duration: 5000,
      })
      el.agentConfig.get().then(refreshAgentConfig)
    })

    const offTodos = el.pi.onTodosUpdate((sessionId, raw) => {
      const activeTabId = useAppStore.getState().activeTabId
      const parsed = (raw as any[]).map(parseTodo)
      // Only auto-set todos if they match the active session, otherwise store but don't display
      if (sessionId === activeTabId) {
        useAppStore.getState().setTodos(parsed)
      }
    })

    const offAskUser = el.pi.onAskUser((sessionId, questionId, questionsJson) => {
      try {
        const questions = JSON.parse(questionsJson) as AgentQuestion[]
        setPendingQuestion({ sessionId, questionId, questions })
      } catch { /* ignore malformed */ }
    })

    const offAgentSpawned = el.pi.onAgentSpawned((rawSession) => {
      const session = parseSession(rawSession)
      useAppStore.getState().addSession(session)
    })

    const offAgentStatus = el.pi.onAgentStatus((sessionId, status) => {
      const store = useAppStore.getState()
      store.updateSession(sessionId, { agentStatus: status as import('@/types').AgentStatus })
      // Auto-remove finished child sessions after a brief delay
      if (status === 'done' || status === 'error') {
        const session = store.sessions.find((s) => s.id === sessionId)
        if (session?.parentId) {
          setTimeout(() => {
            const current = useAppStore.getState().sessions.find((s) => s.id === sessionId)
            if (current && (current.agentStatus === 'done' || current.agentStatus === 'error')) {
              useAppStore.getState().removeSession(sessionId)
            }
          }, 3000)
        }
      }
    })

    const offSessionComplete = el.pi.onSessionComplete((_, title, summary, childIds) => {
      for (const id of childIds) {
        useAppStore.getState().removeSession(id)
      }
      toast.success(title, { description: summary, duration: 10_000 })
    })

    return () => { offScan(); offTodos(); offAskUser(); offAgentSpawned(); offAgentStatus(); offSessionComplete() }
  }, [])

  // Load messages and todos when active session changes
  useEffect(() => {
    if (!activeSessionTab) { store.setMessages([]); store.setTodos([]); return }
    el.db.getMessages(activeSessionTab.id).then((raw) => {
      const msgs = raw.map(parseMessage)
      // Any tool message still 'running' is orphaned from a previous session —
      // the Pi agent is gone so they can never complete. Fix them now.
      const stale = msgs.filter((m) => m.role === 'tool' && m.toolStatus === 'running')
      for (const m of stale) el.db.updateMessage(m.id, { tool_status: 'done' })
      store.setMessages(msgs.map((m) =>
        m.role === 'tool' && m.toolStatus === 'running' ? { ...m, toolStatus: 'done' } : m
      ))
    })
    el.db.getTodos(activeSessionTab.id).then((raw) => {
      store.setTodos(raw.map(parseTodo))
    })
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
    const currentWp = useAppStore.getState().workspacePath
    const raw = await el.db.createSession('New session', useAppStore.getState().settings.defaultModel)
    const session = parseSession(raw)
    // Inherit current workspace and persist it
    if (currentWp) {
      await el.db.updateSession(session.id, { workspace_path: currentWp })
      session.workspacePath = currentWp
    }
    store.addSession(session)
    store.openSessionTab(session)
    store.setMessages([])
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    const session = useAppStore.getState().sessions.find((s) => s.id === id)
    if (!session) return
    store.openSessionTab(session)
    if (session.workspacePath) {
      el.workspace.setPath(session.workspacePath)
      el.fs.readDir(session.workspacePath).then((nodes) => store.setWorkspace(session.workspacePath!, nodes))
    } else if (useAppStore.getState().workspacePath) {
      // Session has no workspace — clear it
      el.workspace.setPath(null)
      store.setWorkspace(null, [])
    }
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
      // Abort: Escape or Ctrl+C when agent is running
      if (e.key === 'Escape' && useAppStore.getState().isLoading) { e.preventDefault(); handleAbort(); return }
      if (e.ctrlKey && e.key === 'c' && useAppStore.getState().isLoading) { e.preventDefault(); handleAbort(); return }

      if (!(e.metaKey || e.ctrlKey)) return
      const { tabs, activeTabId } = useAppStore.getState()

      if (e.shiftKey && e.key === 'P') { e.preventDefault(); setCommandPaletteOpen(true); return }
      if (e.shiftKey && e.key === 'O') { e.preventDefault(); setTabSwitcherOpen(true); return }
      if (!e.shiftKey && e.key === 'p') { e.preventDefault(); setQuickFileOpenOpen(true); return }

      if (e.key === ',') { e.preventDefault(); useAppStore.getState().setActiveView('settings'); return }
      if (e.key === 'n' || e.key === 't') { e.preventDefault(); handleNewSession(); return }
      if (e.key === 'w') {
        e.preventDefault()
        if (activeTabId) handleCloseTab(activeTabId)
        return
      }
      if (e.key === '`' || e.key === 'j') { e.preventDefault(); useAppStore.getState().toggleTerminal(); return }
      if (e.key === 'Z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); useAppStore.getState().toggleZenMode(); return }
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

  // ── File system ──────────────────────────────────────────────────────────────
  const refreshTree = useCallback(async () => {
    const { workspacePath } = useAppStore.getState()
    if (!workspacePath) return
    const nodes = await el.fs.readDir(workspacePath)
    store.setFileNodes(nodes)
  }, [])

  // ── Abort ────────────────────────────────────────────────────────────────────
  const handleAbort = useCallback(() => {
    const sess = useAppStore.getState().sessions.find(
      (s) => s.id === useAppStore.getState().activeTabId
    )
    if (!sess) return
    el.pi.abort(sess.id)
    useAppStore.getState().setLoading(false)
  }, [])

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string, attachments: FileAttachment[]) => {
    const { isLoading, messages, workspacePath } = useAppStore.getState()
    const sess = activeSession
    if (!sess || isLoading) return

    // Build replyTo data for persistence
    const replyToData = replyTo
      ? { id: replyTo.id, content: replyTo.content.slice(0, 200), role: replyTo.role }
      : undefined

    const rawUser = await el.db.addMessage(sess.id, 'user', text, {
      attachments,
      replyTo: replyToData,
    })
    if (!rawUser) return
    const userMsg = parseMessage(rawUser)
    store.appendMessage(userMsg)

    // Clear reply after sending
    setReplyTo(null)

    if (messages.length === 0 && text.trim()) {
      const title = text.slice(0, 100).replace(/@\S+\s*/g, '').trim() || text.slice(0, 40)
      await el.db.updateSession(sess.id, { title })
      store.updateSession(sess.id, { title })
    }

    const expandedMessages = await expandMentions([...messages, userMsg], workspacePath)

    store.setLoading(true)
    const streamingId = uuidv4()
    const streamStartTime = Date.now()
    let streamTotalChars = 0
    let streamingMsg = {
      id: streamingId, sessionId: sess.id, role: 'assistant' as const,
      content: '', thinking: undefined as string | undefined, isStreaming: true, createdAt: Date.now(),
    }

    await sendMessage(
      sess.model || store.settings.defaultModel || 'gpt-4o-mini',
      expandedMessages,
      (chunk) => {
        streamingMsg = { ...streamingMsg, content: chunk }
        streamTotalChars = chunk.length
        store.upsertMessage(streamingId, streamingMsg)
      },
      async (fullText, thinking) => {
        const duration = Date.now() - streamStartTime
        const tokenCount = Math.round(fullText.length / 4)
        const rawA = await el.db.addMessage(sess.id, 'assistant', fullText, { thinking })
        const aMsg = rawA
          ? { ...parseMessage(rawA), tokenCount, duration }
          : { ...streamingMsg, id: uuidv4(), thinking, isStreaming: false, tokenCount, duration }
        store.removeMessage(streamingId)
        store.appendMessage(aMsg)
        const current = useAppStore.getState().sessions.find((s) => s.id === sess.id)
        store.updateSession(sess.id, { messageCount: (current?.messageCount ?? 0) + 1 })
        store.setLoading(false)
        refreshTree()
      },
      async (toolName, toolInput) => {
        const rawT = await el.db.addMessage(sess.id, 'tool', '', { toolName, toolStatus: 'running', toolInput })
        if (rawT) store.appendMessage(parseMessage(rawT))
      },
      async (toolOutput) => {
        const runningTool = useAppStore.getState().messages.slice().reverse().find(
          (m) => m.role === 'tool' && m.toolStatus === 'running'
        )
        store.updateRunningTool({ toolStatus: 'done', toolOutput })
        if (runningTool) {
          await el.db.updateMessage(runningTool.id, { tool_status: 'done', tool_output: toolOutput })
        }
      },
      (err) => {
        store.removeMessage(streamingId)
        store.appendMessage({ ...streamingMsg, id: uuidv4(), content: `**Error:** ${err.message}`, isStreaming: false })
        store.setLoading(false)
      },
      (sess.permissionMode ?? store.settings.permissionMode) as PermissionMode,
      onToolPermission,
      workspacePath,
      sess.effort ?? 'medium',
      (thinkingChunk) => {
        streamingMsg = { ...streamingMsg, thinking: thinkingChunk }
        store.upsertMessage(streamingId, streamingMsg)
      },
    )
  }, [activeSession, replyTo, sendMessage, expandMentions, onToolPermission, refreshTree])

  // ── Edit message ─────────────────────────────────────────────────────────────
  const handleEditMessage = useCallback(async (id: string, content: string) => {
    await el.db.updateMessage(id, { content })
    store.upsertMessage(id, { ...useAppStore.getState().messages.find((m) => m.id === id)!, content })
  }, [])

  // ── Delete message with undo ────────────────────────────────────────────────
  const lastDeletedRef = useRef<Message | null>(null)

  const handleDeleteMessage = useCallback(async (msg: Message) => {
    lastDeletedRef.current = msg
    await el.db.deleteMessage(msg.id)
    store.removeMessage(msg.id)

    toast('Message deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          const deleted = lastDeletedRef.current
          if (!deleted) return
          el.db.addMessage(deleted.sessionId, deleted.role, deleted.content, {
            attachments: deleted.attachments,
            toolName: deleted.toolName,
            toolStatus: deleted.toolStatus,
            toolInput: deleted.toolInput,
            toolOutput: deleted.toolOutput,
            thinking: deleted.thinking,
            replyTo: deleted.replyTo ? { id: deleted.replyTo.id, content: deleted.replyTo.content, role: deleted.replyTo.role } : undefined,
          }).then((raw) => {
            const restored = parseMessage(raw)
            store.appendMessage(restored)
          })
          lastDeletedRef.current = null
        },
      },
      duration: 5000,
    })
  }, [])

  // ── Message reactions ────────────────────────────────────────────────────────
  const handleReact = useCallback(async (id: string, reactions: { up: boolean | null }) => {
    const msg = useAppStore.getState().messages.find((m) => m.id === id)
    if (!msg) return
    const updated = { ...msg, reactions }
    store.upsertMessage(id, updated)
    await el.db.updateMessage(id, { reactions: JSON.stringify(reactions) })
  }, [])

  // ── Reply handler ────────────────────────────────────────────────────────────
  const handleReply = useCallback((message: Message) => {
    setReplyTo(message)
  }, [])

  const handleCancelReply = useCallback(() => {
    setReplyTo(null)
  }, [])

  // ── Spawn agent from UI ───────────────────────────────────────────────────────
  const handleSpawnAgent = useCallback(async (task: string, title: string) => {
    const sess = useAppStore.getState().sessions.find((s) => s.id === activeSession?.id)
    if (!sess) return
    console.log('[spawn] spawning agent:', title, 'from session:', sess.id)
    await el.pi.spawnFromUi(sess.id, task, title)
  }, [activeSession])

  // ── File operations ──────────────────────────────────────────────────────────
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
    // Save workspace to current session
    const sess = useAppStore.getState().sessions.find((s) => s.id === activeSession?.id)
    if (sess) {
      await el.db.updateSession(sess.id, { workspace_path: p })
      store.updateSession(sess.id, { workspacePath: p })
    }
  }, [activeSession])

  const handleSelectProject = useCallback(async (path: string) => {
    await el.workspace.setPath(path)
    const nodes = await el.fs.readDir(path)
    store.setWorkspace(path, nodes)
    store.setActiveView('explorer')
    el.workspace.getRecent().then((r) => store.setRecentProjects(r as string[]))
    // Save workspace to current session
    const sess = useAppStore.getState().sessions.find((s) => s.id === activeSession?.id)
    if (sess) {
      await el.db.updateSession(sess.id, { workspace_path: path })
      store.updateSession(sess.id, { workspacePath: path })
    }
  }, [activeSession])

  // Wraps store.selectTab to also switch workspace when clicking a session tab
  const handleSelectTab = useCallback((id: string) => {
    const tab = useAppStore.getState().tabs.find((t) => tabKey(t) === id)
    store.selectTab(id)
    if (tab?.type === 'session') handleSelectSession(tab.id)
  }, [handleSelectSession])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={cn('flex flex-col h-screen w-screen overflow-hidden bg-background', store.zenMode && 'zen-mode')}>
      {!store.zenMode && (
        <div className="drag-region relative flex h-10 shrink-0 items-center justify-center border-b border-border">
          <span className="no-drag pointer-events-none select-none font-display text-[11px] font-black tracking-[0.5em] text-foreground/40">
            ARES
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {!store.zenMode && (<>
          <ActivityBar
            activeView={store.activeView}
            onChangeView={store.setActiveView}
            terminalOpen={store.terminalOpen}
            onToggleTerminal={store.toggleTerminal}
            gitBadge={gitBadge}
            agentBadge={store.sessions.filter((s) => s.agentStatus === 'running').length}
          />

          {store.activeView !== 'settings' && store.activeView !== 'skills' && store.activeView !== 'plugins' && store.activeView !== 'hooks' && store.activeView !== 'checkpoints' && (
            store.activeView === 'agents' ? (
              <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
                <AgentTree
                  sessions={store.sessions}
                  activeSessionId={activeSessionTab?.id ?? null}
                  onSelectSession={handleSelectSession}
                />
              </aside>
            ) : (
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
            )
          )}
        </>)}

        <div className="flex flex-1 flex-col overflow-hidden">
          {store.activeView !== 'settings' && store.activeView !== 'skills' && store.activeView !== 'plugins' && store.activeView !== 'hooks' && store.activeView !== 'checkpoints' && store.activeView !== 'agents' && (
            <TabBar
              tabs={store.tabs}
              activeTabId={store.activeTabId}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onNewSession={handleNewSession}
            />
          )}

          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            {store.activeView === 'settings' ? (
              <SettingsPanel settings={store.settings} onSave={handleSaveSettings} />
            ) : store.activeView === 'skills' ? (
              <SkillsPanel />
            ) : store.activeView === 'plugins' ? (
              <PluginsPanel />
            ) : store.activeView === 'hooks' ? (
              <HooksPanel />
            ) : store.activeView === 'checkpoints' ? (
              <CheckpointPanel workspacePath={store.workspacePath} />
            ) : store.activeView === 'agents' ? (
              activeTab?.type === 'session' && activeSession ? (
                <>
                  <ChatView
                    messages={store.messages}
                    sessionTitle={activeSession.title}
                    isLoading={store.isLoading}
                    onSuggestion={(text) => handleSend(text, [])}
                    todos={store.todos}
                    onReply={handleReply}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onReact={handleReact}
                  />
                  {pendingPerm && (
                    <PermissionPrompt
                      toolName={pendingPerm.toolName}
                      toolArgs={pendingPerm.toolArgs}
                      onApprove={handlePermApprove}
                      onDeny={handlePermDeny}
                    />
                  )}
                  {pendingQuestion?.sessionId === activeSession.id && (
                    <AgentQuestionCard
                      questions={pendingQuestion.questions}
                      onSubmit={handleQuestionSubmit}
                    />
                  )}
                  <InputBar
                    onSend={handleSend}
                    onCancel={handleAbort}
                    onCommand={handleCommand}
                    onRevealInExplorer={() => {
                      if (store.workspacePath) store.setActiveView('explorer')
                      else handleOpenFolder()
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
                    currentModel={activeSession.model || store.settings.defaultModel}
                    messages={store.messages}
                    effort={activeSession.effort ?? 'medium'}
                    onEffortChange={(e) => {
                      store.updateSession(activeSession.id, { effort: e as EffortLevel })
                      el.db.updateSession(activeSession.id, { effort: e })
                    }}
                    permissionMode={activeSession.permissionMode ?? store.settings.permissionMode}
                    onPermissionModeChange={(m) => {
                      store.updateSession(activeSession.id, { permissionMode: m })
                      el.db.updateSession(activeSession.id, { permissionMode: m })
                    }}
                    pluginSkills={agentSkills}
                    pluginCommands={agentCommands}
                    replyTo={replyTo ? { id: replyTo.id, content: replyTo.content.slice(0, 200), role: replyTo.role } : null}
                    onCancelReply={handleCancelReply}
                  />
                </>
              ) : (
                <AgentDashboard
                  sessions={store.sessions}
                  activeSessionId={activeSessionTab?.id ?? null}
                  onSelectSession={handleSelectSession}
                  onSpawnAgent={handleSpawnAgent}
                />
              )
            ) : store.activeView === 'git' && store.activeCommit && !activeTab ? (
              <ErrorBoundary key="commit-detail"><CommitDetail /></ErrorBoundary>
            ) : activeTab?.type === 'file' ? (
              <FileEditor
                path={activeTab.path}
                onDirtyChange={(dirty) => store.setTabDirty(activeTab.path, dirty)}
                onClose={(p) => { store.closeTab(p); store.removeTabsByPath(p, false) }}
              />
            ) : activeTab?.type === 'session' && activeSession ? (
              <>
                <ChatView
                  messages={store.messages}
                  sessionTitle={activeSession.title}
                  isLoading={store.isLoading}
                  onSuggestion={(text) => handleSend(text, [])}
                  todos={store.todos}
                  onReply={handleReply}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onReact={handleReact}
                />
                {pendingPerm && (
                  <PermissionPrompt
                    toolName={pendingPerm.toolName}
                    toolArgs={pendingPerm.toolArgs}
                    onApprove={handlePermApprove}
                    onDeny={handlePermDeny}
                  />
                )}
                {pendingQuestion?.sessionId === activeSession.id && (
                  <AgentQuestionCard
                    questions={pendingQuestion.questions}
                    onSubmit={handleQuestionSubmit}
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
                  currentModel={activeSession.model || store.settings.defaultModel}
                  messages={store.messages}
                  effort={activeSession.effort ?? 'medium'}
                  onEffortChange={(e) => {
                    store.updateSession(activeSession.id, { effort: e as EffortLevel })
                    el.db.updateSession(activeSession.id, { effort: e })
                  }}
                  permissionMode={activeSession.permissionMode ?? store.settings.permissionMode}
                  onPermissionModeChange={(m) => {
                    store.updateSession(activeSession.id, { permissionMode: m })
                    el.db.updateSession(activeSession.id, { permissionMode: m })
                  }}
                  pluginSkills={agentSkills}
                  pluginCommands={agentCommands}
                  replyTo={replyTo ? { id: replyTo.id, content: replyTo.content.slice(0, 200), role: replyTo.role } : null}
                  onCancelReply={handleCancelReply}
                />
              </>
            ) : (
              <EmptyMain onNewSession={handleNewSession} onOpenFolder={handleOpenFolder} />
            )}
          </div>

          {store.terminalOpen && (
            <div
              className="shrink-0 border-t border-border"
              style={{ height: store.terminalHeight }}
            >
              <TerminalView
                cwd={store.workspacePath}
                onClose={store.toggleTerminal}
                onHeightChange={(h) => store.setTerminalHeight(h)}
              />
            </div>
          )}
        </div>
      </div>
      <StatusBar
        workspacePath={store.workspacePath}
        currentModel={activeSession?.model ?? store.settings.defaultModel}
        sessionCount={store.sessions.length}
      />
      <Toaster />

      {/* ── Modal overlays ──────────────────────────────────────────────────────── */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={paletteCommands}
      />
      <TabSwitcher
        open={tabSwitcherOpen}
        onClose={() => setTabSwitcherOpen(false)}
        tabs={store.tabs}
        activeTabId={store.activeTabId}
        onSelectTab={handleSelectTab}
      />
      <QuickFileOpen
        open={quickFileOpenOpen}
        onClose={() => setQuickFileOpenOpen(false)}
        workspacePath={store.workspacePath}
        onOpenFile={(path) => {
          const node = findFileNode(store.fileNodes, path)
          if (node) store.openFileTab(node)
        }}
      />
    </div>
  )
}

// ── Command palette entries ───────────────────────────────────────────────────
function usePaletteCommands(store: ReturnType<typeof useAppStore.getState>): CommandEntry[] {
  return [
    { id: 'new-session', label: 'New session', description: 'Create a new chat session', category: 'General', action: () => store.openSessionTab({ id: crypto.randomUUID(), title: 'New session', model: store.settings.defaultModel, createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 }) },
    { id: 'toggle-terminal', label: 'Toggle terminal', description: 'Open or close the terminal panel', shortcut: 'Ctrl+`', category: 'View', action: () => store.toggleTerminal() },
    { id: 'toggle-zen', label: 'Toggle zen mode', description: 'Hide UI chrome for focused work', shortcut: 'Ctrl+Shift+Z', category: 'View', action: () => store.toggleZenMode() },
    { id: 'settings', label: 'Open settings', description: 'Configure app settings', shortcut: 'Ctrl+,', category: 'View', action: () => store.setActiveView('settings') },
    { id: 'explorer', label: 'Open file explorer', description: 'Browse workspace files', category: 'View', action: () => store.setActiveView('explorer') },
    { id: 'git', label: 'Open git panel', description: 'View git status and history', category: 'View', action: () => store.setActiveView('git') },
    { id: 'skills', label: 'Open skills panel', description: 'View and manage agent skills', category: 'View', action: () => store.setActiveView('skills') },
    { id: 'plugins', label: 'Open plugins panel', description: 'View and manage plugins', category: 'View', action: () => store.setActiveView('plugins') },
    { id: 'agents', label: 'Open agent dashboard', description: 'View and manage agents', category: 'View', action: () => store.setActiveView('agents') },
    { id: 'checkpoints', label: 'Open checkpoints', description: 'View and restore checkpoints', category: 'View', action: () => store.setActiveView('checkpoints') },
    { id: 'hooks', label: 'Open hooks panel', description: 'Configure lifecycle hooks', category: 'View', action: () => store.setActiveView('hooks') },
  ]
}

// ── File tree helpers ─────────────────────────────────────────────────────────
function findFileNode(nodes: import('@/types').FileNode[], path: string): import('@/types').FileNode | null {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.children) {
      const found = findFileNode(n.children, path)
      if (found) return found
    }
  }
  return null
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
