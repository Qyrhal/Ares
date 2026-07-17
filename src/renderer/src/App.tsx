import React, { Suspense, useCallback, useEffect, useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FileNode, Tab, FileAttachment, Message, PermissionMode, EffortLevel, AgentQuestion } from '@/types'
import { ActivityBar } from '@/components/ActivityBar'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { ChatTabBar, type ChatTab } from '@/components/ChatTabBar'
import { ChatView } from '@/components/ChatView'
import { CommandPalette, type CommandEntry } from '@/components/CommandPalette'
import { TabSwitcher } from '@/components/TabSwitcher'
import { QuickFileOpen } from '@/components/QuickFileOpen'
import { InputBar } from '@/components/InputBar'
const FileEditor = React.lazy(() => import('@/components/FileEditor').then(m => ({ default: m.FileEditor })))
const SettingsPanel = React.lazy(() => import('@/components/SettingsPanel').then(m => ({ default: m.SettingsPanel })))
const ExtensionsPanel = React.lazy(() => import('@/components/ExtensionsPanel').then(m => ({ default: m.ExtensionsPanel })))
const TerminalView = React.lazy(() => import('@/components/TerminalView').then(m => ({ default: m.TerminalView })))
const CommitDetail = React.lazy(() => import('@/components/CommitDetail').then(m => ({ default: m.CommitDetail })))
import { StatusBar } from '@/components/StatusBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PermissionPrompt } from '@/components/PermissionPrompt'
import { AgentQuestionCard } from '@/components/AgentQuestionCard'
import { SessionSearchOverlay } from '@/components/SessionSearchOverlay'
import { useAI } from '@/hooks/useAI'
import { useAppStore } from '@/store/useAppStore'
import { parseSession, parseMessage, parseSettings, parseTodo } from '@/schemas'
import { applyTheme, applyColorMode } from '@/lib/theme'
import { needsCompaction, compactConversation } from '@/lib/context'
import { hasProvider, displayModel } from '@/lib/providers'
import { SideChatInput } from '@/components/SideChatInput'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/toaster'
import { toast } from 'sonner'

const el = window.electron

function PanelFallback() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
      <span className="animate-pulse">Loading…</span>
    </div>
  )
}

function tabKey(t: Tab): string {
  return t.type === 'session' ? t.id : t.path
}

export default function App(): React.ReactElement {
  const store = useAppStore()
  const { sendMessage } = useAI(store.settings)
  const [gitBadge, setGitBadge] = useState(0)
  const [agentSkills, setAgentSkills] = useState<import('@/types').PiSkill[]>([])
  const [agentCommands, setAgentCommands] = useState<import('@/types').SlashCommand[]>([])

  // ── Agent mode (chat vs agent) ──────────────────────────────────────────────
  const [agentMode, setAgentMode] = useState<import('@/types').AgentMode>('agent')

  // ── Reply-to state ───────────────────────────────────────────────────────────
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // ── Modal overlays ────────────────────────────────────────────────────────────
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quickFileOpenOpen, setQuickFileOpenOpen] = useState(false)
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false)
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)

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
    Promise.all([el.settings.get(), el.db.getSessions(true), el.workspace.getPath(), el.workspace.getRecent().catch(() => [])])
      .then(([rawSettings, rawSessions, wp, recents]) => {
        const settings = parseSettings(rawSettings)
        store.setSettings(settings)
        applyTheme(settings.themeId)
        applyColorMode(settings.colorMode)

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
              el.db.deleteSession(sessionId).catch(() => {})
              useAppStore.getState().removeSession(sessionId)
            }
          }, 3000)
        }
      }
    })

    const offCompaction = el.pi.onCompaction((_sessionId, phase) => {
      if (phase === 'end') {
        toast('Context compacted', {
          description: 'Older agent conversation was summarized to stay within the context window',
        })
      }
    })

    const offSessionComplete = el.pi.onSessionComplete((_, title, summary, childIds) => {
      for (const id of childIds) {
        el.db.deleteSession(id).catch(() => {})
        useAppStore.getState().removeSession(id)
      }
      toast.success(title, { description: summary, duration: 10_000 })
    })

    return () => { offScan(); offTodos(); offAskUser(); offAgentSpawned(); offAgentStatus(); offCompaction(); offSessionComplete() }
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

  // Load side chat messages when side chat session changes
  useEffect(() => {
    const scId = store.sideChatSessionId
    if (!scId) { store.setSideChatMessages([]); return }
    el.db.getMessages(scId).then((raw) => {
      const msgs = raw.map(parseMessage)
      const stale = msgs.filter((m) => m.role === 'tool' && m.toolStatus === 'running')
      for (const m of stale) el.db.updateMessage(m.id, { tool_status: 'done' })
      store.setSideChatMessages(msgs.map((m) =>
        m.role === 'tool' && m.toolStatus === 'running' ? { ...m, toolStatus: 'done' } : m
      ))
    })
  }, [store.sideChatSessionId])

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

  const handleArchiveSession = useCallback(async (id: string) => {
    const s = useAppStore.getState().sessions.find((s) => s.id === id)
    if (!s) return
    await el.db.updateSession(id, { archived: !s.archived })
    store.toggleArchiveSession(id)
  }, [])

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    await el.db.updateSession(id, { title })
    store.updateSession(id, { title })
  }, [])

  const handleDuplicateSession = useCallback(async (session: Session) => {
    const msgs = await el.db.getMessages(session.id)
    const raw = await el.db.createSession(`${session.title} (copy)`, session.model)
    const newSession = parseSession(raw)
    for (const m of msgs) {
      await el.db.addMessage(newSession.id, m.role, m.content, {
        toolName: m.tool_name ?? undefined,
        toolInput: m.tool_input ?? undefined,
        toolOutput: m.tool_output ?? undefined,
        thinking: m.thinking ?? undefined,
      })
    }
    store.addSession(newSession)
    store.openSessionTab(newSession)
  }, [])

  const handleExportSession = useCallback(async (session: Session) => {
    const msgs = await el.db.getMessages(session.id)
    const result = await el.session.export(session.title, session.id, msgs)
    if (result) toast.success(`Session exported to ${result}`)
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
      // Don't fire shortcuts when the user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Abort: Escape or Ctrl+C when agent is running
      if (e.key === 'Escape' && useAppStore.getState().isLoading) { e.preventDefault(); handleAbort(); return }
      // Close tab on Escape when not loading
      if (e.key === 'Escape') {
        const { activeTabId } = useAppStore.getState()
        if (activeTabId) { e.preventDefault(); handleCloseTab(activeTabId); return }
      }
      if (e.ctrlKey && e.key === 'c' && useAppStore.getState().isLoading) { e.preventDefault(); handleAbort(); return }

      if (!(e.metaKey || e.ctrlKey)) return
      const { tabs, activeTabId } = useAppStore.getState()

      if (e.shiftKey && e.key === 'P') { e.preventDefault(); setCommandPaletteOpen(true); return }
      if (e.shiftKey && e.key === 'O') { e.preventDefault(); setTabSwitcherOpen(true); return }
      if (e.shiftKey && e.key === 'F') { e.preventDefault(); setSearchOverlayOpen(true); return }
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

    cmd = cmd.toLowerCase()
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
        const helpText = 'Commands: /model <name> - change model, /clear - clear messages, /overview - project summary, /status - system health check, /summary - session summary, /fork - duplicate this session as a new session, /pr - generate a PR from session context, /helpful - mark last response helpful, /not-helpful - mark last response not helpful, /help - this help'
        const msg = await el.db.addMessage(sess.id, 'system', helpText)
        if (msg) store.appendMessage(parseMessage(msg))
        break
      }
      case 'status': {
        const lines: string[] = ['**Ares Status Report**\n']
        const { sessions, workspacePath } = useAppStore.getState()
        const settings = store.settings

        // App version
        const appVersion = '__VERSION__'  // replaced at build time
        lines.push(`**App:** Ares ${appVersion}`)

        // Session count
        const running = sessions.filter((s: Session) => s.agentStatus === 'running').length
        const done = sessions.filter((s: Session) => s.agentStatus === 'done').length
        lines.push(`**Sessions:** ${sessions.length} total (${running} running, ${done} completed)`)

        // Workspace
        if (workspacePath) {
          lines.push(`**Workspace:** \`${workspacePath}\``)
        } else {
          lines.push('**Workspace:** None — use /folder to open one')
        }

        // API connectivity
        const baseUrl = (settings.apiBaseUrl || '').replace(/\/$/, '')
        if (baseUrl) {
          lines.push(`**API endpoint:** \`${baseUrl}\``)
          lines.push(`**Default model:** ${settings.defaultModel || 'not set'}`)
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            const resp = await fetch(`${baseUrl}/models`, {
              signal: controller.signal,
              headers: settings.apiKey
                ? { Authorization: `Bearer ${settings.apiKey}` }
                : {},
            })
            clearTimeout(timeout)
            if (resp.ok) {
              lines.push('**API status:** ✅ Connected')
            } else if (resp.status === 401 || resp.status === 403) {
              lines.push('**API status:** ⚠️ Reached endpoint but auth failed — check your API key')
            } else {
              lines.push(`**API status:** ⚠️ HTTP ${resp.status} — endpoint may not support /models`)
            }
          } catch {
            lines.push('**API status:** ❌ Unreachable — check your API URL and network')
          }
        } else {
          lines.push('**API:** Not configured — set apiBaseUrl in settings')
        }

        lines.push('\nRun `/help` for all available commands.')
        const msg = await el.db.addMessage(sess.id, 'system', lines.join('\n'))
        if (msg) store.appendMessage(parseMessage(msg))
        break
      }
      case 'summary': {
        const msgs = useAppStore.getState().messages
        if (msgs.length === 0) {
          const em = await el.db.addMessage(sess.id, 'system', 'No messages in this session to summarize.')
          if (em) store.appendMessage(parseMessage(em))
          break
        }

        store.appendMessage({
          id: crypto.randomUUID(), sessionId: sess.id, role: 'user',
          content: 'Generating session summary...', isStreaming: false, createdAt: Date.now(),
        })

        const userAndAssistant = msgs.filter((m: Message) => m.role === 'user' || m.role === 'assistant')
        const conversation = userAndAssistant.map((m: Message) =>
          `**${m.role === 'user' ? 'User' : 'Assistant'}**: ${m.content.slice(0, 2000)}`
        ).join('\n\n')

        const apiBaseUrl = store.settings.apiBaseUrl.replace(/\/$/, '')
        if (apiBaseUrl.trim().length > 0) {
          try {
            const prompt = [
              'Summarize this coding assistant conversation concisely. Cover:',
              '1) What the user wanted to accomplish',
              '2) Key decisions or approaches discussed',
              '3) What was built or changed',
              '4) Any open questions or next steps',
              '',
              conversation.slice(0, 12000),
              '',
              'Provide a brief markdown summary (3-5 bullet points).',
            ].filter(Boolean).join('\n')

            const response = await fetch(`${apiBaseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(store.settings.apiKey ? { Authorization: `Bearer ${store.settings.apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: sess.model || store.settings.defaultModel || 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                stream: false,
              }),
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`)
            }

            const json = await response.json()
            const content = json.choices?.[0]?.message?.content ?? 'No summary generated.'
            const finalMsg = await el.db.addMessage(sess.id, 'system', `**Session Summary**\n\n${content}`)
            if (finalMsg) store.appendMessage(parseMessage(finalMsg))
          } catch (err) {
            const errorMsg = `**Error generating summary:** ${(err as Error).message}`
            const finalMsg = await el.db.addMessage(sess.id, 'system', errorMsg)
            if (finalMsg) store.appendMessage(parseMessage(finalMsg))
          }
        } else {
          // Fallback: basic stats without AI
          const userCount = userAndAssistant.filter((m: Message) => m.role === 'user').length
          const assistantCount = userAndAssistant.filter((m: Message) => m.role === 'assistant').length
          const totalChars = msgs.reduce((sum: number, m: Message) => sum + (m.content?.length ?? 0), 0)
          const stats = [
            '**Session Summary (offline)**\n',
            `- ${msgs.length} total messages (${userCount} user, ${assistantCount} assistant)`,
            `- ~${Math.round(totalChars / 4)} estimated tokens`,
            `- Session started ${new Date(sess.createdAt).toLocaleString()}`,
            '\nConfigure an API endpoint to get AI-powered summaries.',
          ].filter(Boolean).join('\n')
          const finalMsg = await el.db.addMessage(sess.id, 'system', stats)
          if (finalMsg) store.appendMessage(parseMessage(finalMsg))
        }
        break
      }
      case 'overview': {
        const wsPath = store.workspacePath
        if (!wsPath) {
          const msg = await el.db.addMessage(sess.id, 'system', 'No workspace open. Use /folder to open a project first.')
          if (msg) store.appendMessage(parseMessage(msg))
          return
        }
        store.appendMessage({
          id: uuidv4(), sessionId: sess.id, role: 'user',
          content: 'Generating project overview...', isStreaming: false, createdAt: Date.now(),
        })
        try {
          // Read key project files
          let readmeContent = ''
          try { readmeContent = await el.fs.readFile(`${wsPath}/README.md`) } catch { /* no README */ }
          let packageJson = ''
          try { packageJson = await el.fs.readFile(`${wsPath}/package.json`) } catch { /* no package.json */ }

          // Read file tree (top 2 levels)
          const rootNodes = await el.fs.readDir(wsPath)
          const formatTree = (nodes: import('@/types').FileNode[], depth = 0): string => {
            let result = ''
            for (const n of nodes) {
              result += '  '.repeat(depth) + (n.type === 'folder' ? '📁' : '📄') + ' ' + n.name + '\n'
              if (n.children && depth < 2) result += formatTree(n.children, depth + 1)
            }
            return result
          }
          const tree = formatTree(rootNodes)

          const baseUrl = store.settings.apiBaseUrl.replace(/\/$/, '')
          const hasAi = baseUrl.trim().length > 0

          if (!hasAi) {
            // Fallback: show structure without AI
            const overview = [
              `**Project Overview**\n`,
              tree ? `**File Structure:**\n\`\`\`\n${tree}\`\`\`\n` : '',
              packageJson ? `**package.json:**\n\`\`\`json\n${packageJson.slice(0, 2000)}\n\`\`\`\n` : '',
              readmeContent ? `**README:**\n${readmeContent.slice(0, 1500)}\n` : '',
            ].filter(Boolean).join('\n')
            const msg = await el.db.addMessage(sess.id, 'system', overview)
            if (msg) store.appendMessage(parseMessage(msg))
          } else {
            // Build AI prompt
            const promptParts = [
              'You are looking at a software project. Give a concise, friendly overview.',
              '',
              readmeContent ? `README:\n${readmeContent.slice(0, 3000)}\n` : '',
              packageJson ? `package.json (key fields):\n${packageJson.slice(0, 2000)}\n` : '',
              tree ? `Project structure:\n${tree}\n` : '',
              'Provide: 1) What this project does, 2) Tech stack, 3) Main directories and their purpose.',
              'Keep it under 300 words. Use plain Markdown.',
            ].filter(Boolean).join('\n')

            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(store.settings.apiKey ? { Authorization: `Bearer ${store.settings.apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: sess.model || store.settings.defaultModel || 'gpt-4o-mini',
                messages: [{ role: 'user', content: promptParts }],
                stream: false,
              }),
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`)
            }

            const json = await response.json()
            const content = json.choices?.[0]?.message?.content ?? 'No overview generated.'

            const msg = await el.db.addMessage(sess.id, 'system', content)
            if (msg) store.appendMessage(parseMessage(msg))
          }
        } catch (err) {
          const errorMsg = `**Error generating overview:** ${(err as Error).message}`
          const msg = await el.db.addMessage(sess.id, 'system', errorMsg)
          if (msg) store.appendMessage(parseMessage(msg))
        }
        break
      }
      case 'helpful':
      case 'not-helpful': {
        const feedbackType = cmd === 'helpful' ? 'helpful' : 'not-helpful'
        const msgs = useAppStore.getState().messages
        // Find the last assistant message (skip system messages)
        const lastAssistant = msgs.filter((m) => m.role === 'assistant').at(-1)
        if (!lastAssistant) {
          const msg = await el.db.addMessage(sess.id, 'system', 'No assistant response found to rate.')
          if (msg) store.appendMessage(parseMessage(msg))
          break
        }
        await el.db.updateMessage(lastAssistant.id, { feedback: feedbackType })
        store.upsertMessage(lastAssistant.id, { ...lastAssistant, feedback: feedbackType })
        const emoji = feedbackType === 'helpful' ? '👍' : '👎'
        const msg = await el.db.addMessage(sess.id, 'system', `Feedback recorded — marked as ${feedbackType} ${emoji}`)
        if (msg) store.appendMessage(parseMessage(msg))
        break
      }
      case 'pr': {
        const wsPath = store.workspacePath
        if (!wsPath) {
          const msg = await el.db.addMessage(sess.id, 'system', 'No workspace open. Use /folder to open a project first.')
          if (msg) store.appendMessage(parseMessage(msg))
          return
        }
        store.appendMessage({
          id: uuidv4(), sessionId: sess.id, role: 'user',
          content: 'Generating pull request from session context...', isStreaming: false, createdAt: Date.now(),
        })
        try {
          // Gather git context
          const status = await el.git.status(wsPath)
          const log = await el.git.log(wsPath, 5)
          const branch = status.branch || '(detached)'

          // Gather changed files
          const changedFiles: string[] = []
          for (const f of status.staged) changedFiles.push(f.path)
          for (const f of status.unstaged) changedFiles.push(f.path)
          for (const f of status.untracked) changedFiles.push(f.path)

          // Gather session messages for context
          const msgs = useAppStore.getState().messages
          const userAndAssistant = msgs.filter((m: Message) => m.role === 'user' || m.role === 'assistant')
          const conversationSummary = userAndAssistant.slice(-10).map((m: Message) =>
            `**${m.role === 'user' ? 'User' : 'Assistant'}**: ${m.content.slice(0, 1000)}`
          ).join('\n\n')
          const userCount = userAndAssistant.filter((m: Message) => m.role === 'user').length
          const assistantCount = userAndAssistant.filter((m: Message) => m.role === 'assistant').length

          // Build git context string
          const commitsStr = log.length > 0
            ? log.map((c: import('@/types').GitCommit) => `- ${c.shortHash} - ${c.message}`).join('\n')
            : 'No recent commits found.'
          const changesStr = changedFiles.length > 0
            ? changedFiles.map((p) => {
                const staged = status.staged.some((f) => f.path === p)
                const untracked = status.untracked.some((f) => f.path === p)
                const prefix = untracked ? 'Added' : staged ? 'Modified' : 'Modified'
                return `- ${prefix}: ${p}`
              }).join('\n')
            : 'No uncommitted changes.'

          const baseUrl = store.settings.apiBaseUrl.replace(/\/$/, '')
          const hasAi = baseUrl.trim().length > 0

          if (hasAi) {
            // AI-powered PR generation
            const prompt = [
              'You are generating a pull request title and body based on git context and session conversation.',
              '',
              `**Branch:** ${branch}`,
              `**Upstream:** ${status.upstream || 'none'}`,
              status.ahead > 0 ? `**Ahead by:** ${status.ahead} commit(s)` : '',
              status.behind > 0 ? `**Behind by:** ${status.behind} commit(s)` : '',
              '',
              '**Recent commits:**',
              commitsStr,
              '',
              '**Changed files:**',
              changesStr,
              '',
              '**Session conversation (last messages):**',
              conversationSummary || 'No conversation messages.',
              '',
              `Session stats: ${msgs.length} total messages (${userCount} user, ${assistantCount} assistant)`,
              '',
              'Generate a concise pull request title and a well-structured markdown body. Include:',
              '1) A clear one-line PR title starting with the conventional commit type (feat:, fix:, chore:, docs:, refactor:, etc.)',
              '2) **What changed** — bullet list of key changes',
              '3) **Why** — brief motivation or context',
              '4) **How to test** — verification instructions',
              'Use plain Markdown. Start with the title on the first line, then a blank line, then the body.',
            ].filter(Boolean).join('\n')

            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(store.settings.apiKey ? { Authorization: `Bearer ${store.settings.apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: sess.model || store.settings.defaultModel || 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                stream: false,
              }),
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`)
            }

            const json = await response.json()
            const content = json.choices?.[0]?.message?.content ?? 'No PR generated.'
            const finalMsg = await el.db.addMessage(sess.id, 'system', `**Pull Request from Session**\n\n${content}`)
            if (finalMsg) store.appendMessage(parseMessage(finalMsg))
          } else {
            // Structured PR from git data without AI
            const sessionStart = msgs.length > 0
              ? new Date(Math.min(...msgs.map((m: Message) => m.createdAt))).toLocaleString()
              : new Date(sess.createdAt).toLocaleString()

            const prBody = [
              '**Pull Request from Session**',
              '',
              `**Branch:** \`${branch}\``,
              `**Upstream:** ${status.upstream || 'none'}`,
              '',
              '**Changes:**',
              changesStr,
              '',
              '**Recent Commits:**',
              commitsStr,
              '',
              '**Session Context:**',
              `- ${msgs.length} total messages (${userCount} user, ${assistantCount} assistant)`,
              `- Started: ${sessionStart}`,
              '',
              '> Generated by Ares /pr command. Configure an API endpoint for AI-powered PR descriptions.',
            ].join('\n')
            const finalMsg = await el.db.addMessage(sess.id, 'system', prBody)
            if (finalMsg) store.appendMessage(parseMessage(finalMsg))
          }
        } catch (err) {
          const errorMsg = `**Error generating pull request:** ${(err as Error).message}`
          const msg = await el.db.addMessage(sess.id, 'system', errorMsg)
          if (msg) store.appendMessage(parseMessage(msg))
        }
        break
      }
      case 'fork': {
        const msgs = useAppStore.getState().messages
        const title = sess.title.replace(/\s*\(fork \d+\)$/, '')
        // Find next fork number
        const forks = useAppStore.getState().sessions.filter((s: Session) =>
          s.id !== sess.id && s.title.startsWith(title)
        )
        const forkN = forks.length + 1
        const forkTitle = `${title} (fork ${forkN})`

        store.appendMessage({
          id: uuidv4(), sessionId: sess.id, role: 'user',
          content: `Forking session as "${forkTitle}"...`,
          isStreaming: false, createdAt: Date.now(),
        })

        try {
          const raw = await el.db.createSession(forkTitle, sess.model, sess.id)
          const newSession = parseSession(raw)
          // Inherit workspace from parent
          if (sess.workspacePath) {
            await el.db.updateSession(newSession.id, { workspace_path: sess.workspacePath })
            newSession.workspacePath = sess.workspacePath
          }
          // Copy all messages to the new session
          for (const m of msgs) {
            await el.db.addMessage(newSession.id, m.role, m.content, {
              attachments: m.attachments,
              toolName: m.toolName,
              toolStatus: m.toolStatus,
              toolInput: m.toolInput,
              toolOutput: m.toolOutput,
              thinking: m.thinking,
              replyTo: m.replyTo ? { id: m.replyTo.id, content: m.replyTo.content, role: m.replyTo.role } : undefined,
              reactions: m.reactions ? { up: m.reactions.up } : undefined,
            })
          }
          store.addSession(newSession)
          store.openSessionTab(newSession)
          // Load messages for the new session
          const rawMsgs = await el.db.getMessages(newSession.id)
          store.setMessages(rawMsgs.map((r: import('@/types').RawMessage) => parseMessage(r)))
        } catch (err) {
          const errorMsg = `**Error forking session:** ${(err as Error).message}`
          const msg = await el.db.addMessage(sess.id, 'system', errorMsg)
          if (msg) store.appendMessage(parseMessage(msg))
        }
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

    const model = sess.model || store.settings.defaultModel || 'gpt-4o-mini'

    // Compact when the conversation nears the model's context limit
    let history = [...messages, userMsg]
    if (needsCompaction(history, model) && hasProvider(store.settings)) {
      try {
        const result = await compactConversation(sess.id, history, store.settings, model)
        if (result.compacted > 0) {
          history = result.messages
          store.setMessages(history)
          toast('Context compacted', {
            description: `${result.compacted} earlier messages summarized to stay within the context window`,
          })
        }
      } catch {
        // Summarization failed — send uncompacted and let the provider complain if it must
      }
    }

    const expandedMessages = await expandMentions(history, workspacePath)

    store.setLoading(true)
    const streamingId = uuidv4()
    const streamStartTime = Date.now()
    let streamTotalChars = 0
    let streamingMsg = {
      id: streamingId, sessionId: sess.id, role: 'assistant' as const,
      content: '', thinking: undefined as string | undefined, isStreaming: true, createdAt: Date.now(),
    }

    await sendMessage(
      model,
      expandedMessages,
      (chunk) => {
        streamingMsg = { ...streamingMsg, content: chunk }
        streamTotalChars = chunk.length
        store.upsertMessage(streamingId, streamingMsg)
      },
      async (fullText, thinking, usage) => {
        const duration = Date.now() - streamStartTime
        const tokenCount = usage?.completionTokens ?? Math.round(fullText.length / 4)
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
      agentMode,
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
    applyColorMode(s.colorMode)
  }, [])

  const handleToggleColorMode = useCallback(async () => {
    const settings = useAppStore.getState().settings
    const next = { ...settings, colorMode: settings.colorMode === 'dark' ? 'light' as const : 'dark' as const }
    await el.settings.set(next)
    useAppStore.getState().setSettings(next)
    applyColorMode(next.colorMode)
  }, [])

  const handleDeleteAllSessions = useCallback(async () => {
    const sessions = useAppStore.getState().sessions
    await Promise.all(sessions.map((s) => handleDeleteSession(s.id)))
  }, [handleDeleteSession])

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

  // ── Side Chat operations ──────────────────────────────────────────────────────
  const handleOpenSideChat = useCallback(async () => {
    const currentSess = useAppStore.getState().sessions.find(
      (s) => s.id === useAppStore.getState().activeTabId
    )
    if (!currentSess) return

    const currentWp = useAppStore.getState().workspacePath
    const raw = await el.db.createSession(
      'Side chat',
      currentSess.model || store.settings.defaultModel,
      null,
      true
    )
    const session = parseSession(raw)
    if (currentWp) {
      await el.db.updateSession(session.id, { workspace_path: currentWp })
      session.workspacePath = currentWp
    }
    store.addSession(session)
    store.setSideChat(session.id)
    store.setSideChatMessages([])
    store.setSideChatLoading(false)
    // Load side chat messages (empty for new session)
    el.db.getMessages(session.id).then((raw) => {
      store.setSideChatMessages(raw.map(parseMessage))
    })
  }, [store])

  const handleCloseSideChat = useCallback(() => {
    store.setSideChat(null)
    store.setSideChatMessages([])
    store.setSideChatLoading(false)
  }, [store])

  // Side chat runs in plain chat mode — no tools, just streaming Q&A next to the main session.
  const handleSendSideChat = useCallback(async (text: string) => {
    const { sideChatSessionId, sideChatIsLoading, sideChatMessages, settings } = useAppStore.getState()
    if (!sideChatSessionId || sideChatIsLoading || !text.trim()) return

    const sess = useAppStore.getState().sessions.find((s) => s.id === sideChatSessionId)
    const rawUser = await el.db.addMessage(sideChatSessionId, 'user', text)
    if (!rawUser) return
    const userMsg = parseMessage(rawUser)
    store.appendSideChatMessage(userMsg)

    if (sideChatMessages.length === 0 && text.trim()) {
      const title = text.slice(0, 60).trim()
      await el.db.updateSession(sideChatSessionId, { title })
      store.updateSession(sideChatSessionId, { title })
    }

    const sideModel = sess?.model || settings.defaultModel || 'gpt-4o-mini'
    let sideHistory = [...sideChatMessages, userMsg]
    if (needsCompaction(sideHistory, sideModel) && hasProvider(settings)) {
      try {
        const result = await compactConversation(sideChatSessionId, sideHistory, settings, sideModel)
        if (result.compacted > 0) {
          sideHistory = result.messages
          store.setSideChatMessages(sideHistory)
        }
      } catch { /* send uncompacted */ }
    }

    store.setSideChatLoading(true)
    const streamingId = uuidv4()
    let streamingMsg: Message = {
      id: streamingId, sessionId: sideChatSessionId, role: 'assistant',
      content: '', isStreaming: true, createdAt: Date.now(),
    }

    await sendMessage(
      sideModel,
      sideHistory,
      (chunk) => {
        streamingMsg = { ...streamingMsg, content: chunk }
        store.upsertSideChatMessage(streamingId, streamingMsg)
      },
      async (_fullText, _thinking, usage) => {
        const duration = Date.now() - streamStartTime
        const tokenCount = usage?.completionTokens ?? Math.round(_fullText.length / 4)
        const rawA = await el.db.addMessage(sideChatSessionId, 'assistant', _fullText)
        store.removeSideChatMessage(streamingId)
        const aMsg = rawA
          ? { ...parseMessage(rawA), tokenCount, duration }
          : { ...streamingMsg, id: uuidv4(), isStreaming: false, tokenCount, duration }
        store.appendSideChatMessage(aMsg)
        store.setSideChatLoading(false)
      },
      undefined,
      undefined,
      (err) => {
        store.removeSideChatMessage(streamingId)
        store.appendSideChatMessage({ ...streamingMsg, id: uuidv4(), content: `**Error:** ${err.message}`, isStreaming: false })
        store.setSideChatLoading(false)
      },
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      'chat',
    )
  }, [sendMessage, store])

  const handleAbortSideChat = useCallback(() => {
    const id = useAppStore.getState().sideChatSessionId
    if (id) el.pi.abort(id)
    useAppStore.getState().setSideChatLoading(false)
  }, [])

  const handlePromoteSideChat = useCallback(async () => {
    const sideChatId = useAppStore.getState().sideChatSessionId
    if (!sideChatId) return

    const session = useAppStore.getState().sessions.find((s) => s.id === sideChatId)
    if (!session) return

    await el.db.updateSession(sideChatId, { is_side_chat: false })
    store.updateSession(sideChatId, { isSideChat: false })
    store.openSessionTab(session)
    await el.db.getMessages(sideChatId).then((raw) => {
      store.setMessages(raw.map(parseMessage))
    })
    store.setSideChat(null)
    store.setSideChatMessages([])
    store.setSideChatLoading(false)
  }, [store])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={cn('flex flex-col h-screen w-screen overflow-hidden bg-background', store.zenMode && 'zen-mode')}>
      {!store.zenMode && (
        <div className="drag-region relative flex h-10 shrink-0 items-center justify-center border-b border-border">
          {/* HUD readouts — left offset clears the macOS traffic lights */}
          <span className="pointer-events-none absolute left-20 flex select-none items-center gap-2 font-mono text-[9px] tracking-[0.2em] text-muted-foreground/60">
            <span className="size-1 bg-primary" />
            SYS // ARES 0.1.0
          </span>
          <span className="no-drag pointer-events-none select-none font-display text-[11px] font-black tracking-[0.5em] text-foreground/40">
            ARES
          </span>
          <span className="pointer-events-none absolute right-4 select-none">
            <HudClock />
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

          {store.activeView !== 'settings' && store.activeView !== 'extensions' && (
            <Sidebar
              mode={store.activeView}
              sessions={store.sessions}
              activeSessionId={activeSessionTab?.id ?? null}
              onNewSession={handleNewSession}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onTogglePinSession={handleTogglePinSession}
              onArchiveSession={handleArchiveSession}
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
        </>)}

        <div className="flex flex-1 flex-col overflow-hidden">
          {store.activeView !== 'settings' && store.activeView !== 'extensions' && (
            <TabBar
              tabs={store.tabs}
              activeTabId={store.activeTabId}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onNewSession={handleNewSession}
            />
          )}

          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          <Suspense fallback={<PanelFallback />}>
           {store.activeView === 'settings' ? (
              <SettingsPanel
                settings={store.settings}
                onSave={handleSaveSettings}
                sessionCount={store.sessions.length}
                onDeleteAllSessions={handleDeleteAllSessions}
              />
            ) : store.activeView === 'extensions' ? (
              <ExtensionsPanel />
            ) : store.activeView === 'git' && store.activeCommit && !activeTab ? (
              <ErrorBoundary key="commit-detail"><CommitDetail /></ErrorBoundary>
            ) : activeTab?.type === 'file' ? (
              <FileEditor
                path={activeTab.path}
                onDirtyChange={(dirty) => store.setTabDirty(activeTab.path, dirty)}
                onClose={(p) => { store.closeTab(p); store.removeTabsByPath(p, false) }}
              />
            ) : activeTab?.type === 'session' && activeSession ? (
              <div className="flex flex-1 flex-col min-h-0">
                <ChatTabBar
                  tabs={[
                    { id: activeSession.id, title: activeSession.title, isSideChat: false },
                    ...(store.sideChatSessionId
                      ? [{
                          id: store.sideChatSessionId,
                          title: store.sessions.find((s) => s.id === store.sideChatSessionId)?.title ?? 'Side chat',
                          isSideChat: true,
                        }]
                      : []),
                  ]}
                  activeTabId={store.activeTabId}
                  sideChatSessionId={store.sideChatSessionId}
                  onSelectTab={(id) => {
                    if (id === store.sideChatSessionId) {
                      // Activating side chat tab - promote to main
                      handlePromoteSideChat()
                    } else {
                      handleSelectTab(id)
                    }
                  }}
                  onCloseTab={(id) => {
                    if (id === store.sideChatSessionId) {
                      handleCloseSideChat()
                    }
                  }}
                  onNewSideChat={handleOpenSideChat}
                />
                <div className={cn('flex flex-1 overflow-hidden min-h-0', store.sideChatSessionId && 'divide-x divide-border')}>
                  <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                    <ChatView
                      messages={store.messages}
                      sessionTitle={activeSession.title}
                      modelName={activeSession.model}
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
                      placeholder={`Ask ${displayModel(activeSession.model || store.settings.defaultModel)}…`}
                      workspacePath={store.workspacePath}
                      fileNodes={store.fileNodes}
                      apiBaseUrl={store.settings.apiBaseUrl}
                      apiKey={store.settings.apiKey}
                      providers={store.settings.providers}
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
                      agentMode={agentMode}
                      onAgentModeChange={setAgentMode}
                      colorMode={store.settings.colorMode}
                      onToggleColorMode={handleToggleColorMode}
                      pluginSkills={agentSkills}
                      pluginCommands={agentCommands}
                      replyTo={replyTo ? { id: replyTo.id, content: replyTo.content.slice(0, 200), role: replyTo.role } : null}
                      onCancelReply={handleCancelReply}
                    />
                  </div>

                  {/* ── Side Chat Pane ──────────────────────────────────────────── */}
                  {store.sideChatSessionId && (() => {
                    const sideSession = store.sessions.find((s) => s.id === store.sideChatSessionId)
                    if (!sideSession) return null
                    return (
                      <div className="flex flex-1 flex-col min-w-0 overflow-hidden border-l border-border bg-background/50">
                        <div className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-muted-foreground border-b border-border bg-card/30">
                          <span className="font-medium text-primary/80">Side Chat</span>
                          <button
                            onClick={handleCloseSideChat}
                            className="ml-auto flex size-4 items-center justify-center rounded hover:bg-accent"
                            aria-label="Close side chat"
                            title="Close side chat"
                          >
                            <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                          </button>
                        </div>
                        <ChatView
                          messages={store.sideChatMessages}
                          sessionTitle={sideSession.title}
                          modelName={sideSession.model}
                          isLoading={store.sideChatIsLoading}
                          onSuggestion={handleSendSideChat}
                        />
                        <SideChatInput
                          onSend={handleSendSideChat}
                          disabled={store.sideChatIsLoading}
                          onCancel={handleAbortSideChat}
                          placeholder={`Ask ${displayModel(sideSession.model || store.settings.defaultModel)}…`}
                        />
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <EmptyMain onNewSession={handleNewSession} onOpenFolder={handleOpenFolder} />
            )}
          </Suspense>
          </div>

          {store.terminalOpen && (
            <div
              className="shrink-0 border-t border-border"
              style={{ height: store.terminalHeight }}
            >
              <Suspense fallback={<PanelFallback />}>
              <TerminalView
                cwd={store.workspacePath}
                onClose={store.toggleTerminal}
                onHeightChange={(h) => store.setTerminalHeight(h)}
              />
              </Suspense>
            </div>
          )}
        </div>
      </div>
      <StatusBar
        workspacePath={store.workspacePath}
        currentModel={displayModel(activeSession?.model ?? store.settings.defaultModel)}
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
      <SessionSearchOverlay
        open={searchOverlayOpen}
        onClose={() => setSearchOverlayOpen(false)}
        onSelectSession={handleSelectSession}
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
    { id: 'git', label: 'Open git panel', description: 'View git status, history, and checkpoints', category: 'View', action: () => store.setActiveView('git') },
    { id: 'extensions', label: 'Open extensions panel', description: 'View and manage skills, plugins, and hooks', category: 'View', action: () => store.setActiveView('extensions') },
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

function HudClock(): React.ReactElement {
  const [now, setNow] = useState(() => new Date().toISOString().slice(11, 19))
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString().slice(11, 19)), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/60">
      {now} UTC
    </span>
  )
}

function EmptyMain({
  onNewSession, onOpenFolder
}: {
  onNewSession: () => void
  onOpenFolder: () => void
}): React.ReactElement {
  return (
    <div className="hud-grid flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
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
