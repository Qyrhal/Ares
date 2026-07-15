import { create } from 'zustand'
import type { Session, SessionGroup, Message, AppSettings, FileNode, Tab, ActivityView, GitCommit, Todo } from '@/types'

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4o-mini',
  themeId: 'red',
  colorMode: 'dark',
  systemPrompt: '',
  permissionMode: 'ask',
}

function tabKey(t: Tab): string {
  return t.type === 'session' ? t.id : t.path
}

interface AppStore {
  // ── UI ──────────────────────────────────────────────────────────────────────
  activeView: ActivityView
  terminalOpen: boolean
  zenMode: boolean
  terminalHeight: string

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabs: Tab[]
  activeTabId: string | null

  // ── Sessions ────────────────────────────────────────────────────────────────
  sessions: Session[]
  messages: Message[]
  isLoading: boolean
  sessionGroups: SessionGroup[]

  // ── Side Chat ──────────────────────────────────────────────────────────────
  sideChatSessionId: string | null
  sideChatMessages: Message[]
  sideChatIsLoading: boolean

  // ── Git ─────────────────────────────────────────────────────────────────────
  commits: GitCommit[]
  activeCommit: string | null
  gitLoading: boolean

  // ── Workspace ───────────────────────────────────────────────────────────────
  workspacePath: string | null
  fileNodes: FileNode[]
  recentProjects: string[]

  // ── Todos ────────────────────────────────────────────────────────────────────
  todos: Todo[]

  // ── Deleted messages (for undo) ─────────────────────────────────────────────
  lastDeletedMessage: Message | null

  // ── Settings ────────────────────────────────────────────────────────────────
  settings: AppSettings

  // ── Actions ─────────────────────────────────────────────────────────────────

  setActiveView: (v: ActivityView) => void
  toggleTerminal: () => void
  toggleZenMode: () => void
  setTerminalHeight: (h: string) => void

  // Adds the tab if not already open, activates it, and syncs sidebar view.
  openSessionTab: (session: Session) => void
  openFileTab: (node: FileNode) => void
  // Activates a tab by its key; switches sidebar to 'chat' for session tabs.
  // This is the fix for the "random rerender to session page" bug: previously
  // TabBar called setActiveTabId directly without updating activeView.
  selectTab: (id: string) => void
  closeTab: (id: string) => void
  setTabDirty: (path: string, isDirty: boolean) => void
  renameTabPaths: (oldPath: string, newPath: string, newName: string) => void
  removeTabsByPath: (path: string, isDir: boolean) => void

  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, patch: Partial<Session>) => void
  removeSession: (id: string) => void
  togglePinSession: (id: string) => void

  // ── Session group actions ───────────────────────────────────────────────────
  addSessionGroup: (name: string) => string
  renameSessionGroup: (id: string, name: string) => void
  removeSessionGroup: (id: string) => void
  setSessionGroup: (sessionId: string, groupId: string | null) => void

  setMessages: (msgs: Message[]) => void
  appendMessage: (msg: Message) => void
  removeMessage: (id: string) => void
  upsertMessage: (id: string, msg: Message) => void
  updateRunningTool: (patch: Partial<Message>) => void
  setLoading: (v: boolean) => void
  clearAllMessages: () => void

  setCommits: (commits: GitCommit[]) => void
  setActiveCommit: (hash: string | null) => void
  setGitLoading: (v: boolean) => void

  setWorkspace: (path: string | null, nodes: FileNode[]) => void
  setFileNodes: (nodes: FileNode[]) => void
  setRecentProjects: (paths: string[]) => void

  setSettings: (s: AppSettings) => void

  setTodos: (todos: Todo[]) => void
  addTodo: (todo: Todo) => void
  updateTodo: (id: string, patch: Partial<Todo>) => void
  removeTodo: (id: string) => void

  // ── Side Chat actions ──────────────────────────────────────────────────────
  setSideChat: (id: string | null) => void
  setSideChatMessages: (msgs: Message[]) => void
  setSideChatLoading: (v: boolean) => void
  appendSideChatMessage: (msg: Message) => void
  upsertSideChatMessage: (id: string, msg: Message) => void
  removeSideChatMessage: (id: string) => void

  // ── Deleted message (for undo) ──────────────────────────────────────────────
  setLastDeletedMessage: (msg: Message | null) => void
  clearLastDeletedMessage: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────────
  activeView: 'chat',
  terminalOpen: false,
  zenMode: false,
  terminalHeight: '224px',

  tabs: [],
  activeTabId: null,

  sessions: [],
  messages: [],
  isLoading: false,
  sessionGroups: [],

  commits: [],
  activeCommit: null,
  gitLoading: false,

  workspacePath: null,
  fileNodes: [],
  recentProjects: [],

  settings: DEFAULT_SETTINGS,
  todos: [],
  lastDeletedMessage: null,

  // ── Side Chat initial state ─────────────────────────────────────────────────
  sideChatSessionId: null,
  sideChatMessages: [],
  sideChatIsLoading: false,

  // ── UI actions ───────────────────────────────────────────────────────────────
  setActiveView: (v) => set({ activeView: v }),

  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),

  toggleZenMode: () => set((s) => ({ zenMode: !s.zenMode })),

  setTerminalHeight: (h) => set({ terminalHeight: h }),

  // ── Tab actions ──────────────────────────────────────────────────────────────
  openSessionTab: (session) => set((s) => {
    const exists = s.tabs.some((t) => t.type === 'session' && t.id === session.id)
    return {
      tabs: exists ? s.tabs : [...s.tabs, { type: 'session', id: session.id, title: session.title }],
      activeTabId: session.id,
      activeView: 'chat',
    }
  }),

  openFileTab: (node) => set((s) => {
    const exists = s.tabs.some((t) => t.type === 'file' && t.path === node.path)
    return {
      tabs: exists ? s.tabs : [...s.tabs, { type: 'file', path: node.path, name: node.name, isDirty: false }],
      activeTabId: node.path,
    }
  }),

  selectTab: (id) => set((s) => {
    const tab = s.tabs.find((t) => tabKey(t) === id)
    return {
      activeTabId: id,
      ...(tab?.type === 'session' ? { activeView: 'chat' as ActivityView } : {}),
    }
  }),

  closeTab: (id) => set((s) => {
    const idx = s.tabs.findIndex((t) => tabKey(t) === id)
    if (idx === -1) return s
    const next = s.tabs.filter((_, i) => i !== idx)
    let activeTabId = s.activeTabId
    if (activeTabId === id) {
      const fallback = next[Math.min(idx, next.length - 1)]
      activeTabId = fallback ? tabKey(fallback) : null
    }
    return { tabs: next, activeTabId }
  }),

  setTabDirty: (path, isDirty) => set((s) => ({
    tabs: s.tabs.map((t) => t.type === 'file' && t.path === path ? { ...t, isDirty } : t),
  })),

  renameTabPaths: (oldPath, newPath, newName) => set((s) => {
    let activeTabId = s.activeTabId
    const tabs = s.tabs.map((t) => {
      if (t.type !== 'file') return t
      if (t.path === oldPath) {
        if (activeTabId === oldPath) activeTabId = newPath
        return { ...t, path: newPath, name: newName }
      }
      if (t.path.startsWith(oldPath + '/')) {
        const repath = newPath + t.path.slice(oldPath.length)
        if (activeTabId === t.path) activeTabId = repath
        return { ...t, path: repath }
      }
      return t
    })
    return { tabs, activeTabId }
  }),

  removeTabsByPath: (path, isDir) => set((s) => {
    const removed = s.tabs.filter(
      (t) => t.type === 'file' && (t.path === path || (isDir && t.path.startsWith(path + '/')))
    )
    if (removed.length === 0) return s
    const next = s.tabs.filter((t) => !removed.includes(t))
    let activeTabId = s.activeTabId
    if (removed.some((t) => tabKey(t) === activeTabId)) {
      const fallback = next[next.length - 1]
      activeTabId = fallback ? tabKey(fallback) : null
    }
    return { tabs: next, activeTabId }
  }),

  // ── Session actions ──────────────────────────────────────────────────────────
  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),

  updateSession: (id, patch) => set((s) => ({
    sessions: s.sessions.map((s) => s.id === id ? { ...s, ...patch } : s),
    tabs: s.tabs.map((t) =>
      t.type === 'session' && t.id === id && patch.title ? { ...t, title: patch.title } : t
    ),
  })),

  clearAllMessages: () => set({ messages: [], isLoading: false }),

  removeSession: (id) => set((s) => ({
    sessions: s.sessions.filter((s) => s.id !== id),
  })),

  togglePinSession: (id) => set((s) => ({
    sessions: s.sessions.map((s) =>
      s.id === id ? { ...s, pinned: !s.pinned } : s
    ),
  })),

  // ── Session group actions ───────────────────────────────────────────────────
  addSessionGroup: (name) => {
    const id = crypto.randomUUID()
    set((s) => ({
      sessionGroups: [...s.sessionGroups, { id, name, createdAt: Date.now() }],
    }))
    return id
  },

  renameSessionGroup: (id, name) => set((s) => ({
    sessionGroups: s.sessionGroups.map((g) =>
      g.id === id ? { ...g, name } : g
    ),
  })),

  removeSessionGroup: (id) => set((s) => ({
    sessionGroups: s.sessionGroups.filter((g) => g.id !== id),
    sessions: s.sessions.map((s) =>
      s.group === id ? { ...s, group: undefined } : s
    ),
  })),

  setSessionGroup: (sessionId, groupId) => set((s) => ({
    sessions: s.sessions.map((s) =>
      s.id === sessionId ? { ...s, group: groupId ?? undefined } : s
    ),
  })),

  // ── Message actions ──────────────────────────────────────────────────────────
  setMessages: (msgs) => set({ messages: msgs }),

  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),

  upsertMessage: (id, msg) => set((s) => {
    const exists = s.messages.some((m) => m.id === id)
    return {
      messages: exists
        ? s.messages.map((m) => m.id === id ? msg : m)
        : [...s.messages, msg],
    }
  }),

  updateRunningTool: (patch) => set((s) => {
    const last = [...s.messages].reverse().find((m) => m.role === 'tool' && m.toolStatus === 'running')
    if (!last) return s
    return { messages: s.messages.map((m) => m.id === last.id ? { ...last, ...patch } : m) }
  }),

  setLoading: (v) => set({ isLoading: v }),

  // ── Git actions ────────────────────────────────────────────────────────────────
  setCommits: (commits) => set({ commits }),
  setActiveCommit: (hash) => set({ activeCommit: hash }),
  setGitLoading: (v) => set({ gitLoading: v }),

  // ── Workspace actions ────────────────────────────────────────────────────────
  setWorkspace: (path, nodes) => set({ workspacePath: path, fileNodes: nodes }),
  setRecentProjects: (paths) => set({ recentProjects: paths }),

  setFileNodes: (nodes) => set({ fileNodes: nodes }),

  // ── Settings actions ─────────────────────────────────────────────────────────
  setSettings: (s) => set({ settings: s }),

  // ── Todo actions ─────────────────────────────────────────────────────────────
  setTodos: (todos) => set({ todos }),
  addTodo: (todo) => set((s) => ({ todos: [...s.todos, todo] })),
  updateTodo: (id, patch) => set((s) => ({ todos: s.todos.map((t) => t.id === id ? { ...t, ...patch } : t) })),
  removeTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),

  // ── Deleted message actions ─────────────────────────────────────────────────
  setLastDeletedMessage: (msg) => set({ lastDeletedMessage: msg }),
  clearLastDeletedMessage: () => set({ lastDeletedMessage: null }),

  // ── Side Chat actions ──────────────────────────────────────────────────────
  setSideChat: (id) => set({ sideChatSessionId: id }),
  setSideChatMessages: (msgs) => set({ sideChatMessages: msgs }),
  setSideChatLoading: (v) => set({ sideChatIsLoading: v }),
  appendSideChatMessage: (msg) => set((s) => ({ sideChatMessages: [...s.sideChatMessages, msg] })),
  upsertSideChatMessage: (id, msg) => set((s) => {
    const exists = s.sideChatMessages.some((m) => m.id === id)
    return {
      sideChatMessages: exists
        ? s.sideChatMessages.map((m) => m.id === id ? msg : m)
        : [...s.sideChatMessages, msg],
    }
  }),
  removeSideChatMessage: (id) => set((s) => ({
    sideChatMessages: s.sideChatMessages.filter((m) => m.id !== id),
  })),
}))
