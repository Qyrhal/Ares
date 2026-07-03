import { create } from 'zustand'
import type { Session, Message, AppSettings, FileNode, Tab, ActivityView } from '@/types'

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4o-mini',
  themeId: 'red',
}

function tabKey(t: Tab): string {
  return t.type === 'session' ? t.id : t.path
}

interface AppStore {
  // ── UI ──────────────────────────────────────────────────────────────────────
  activeView: ActivityView
  terminalOpen: boolean
  terminalKey: number

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabs: Tab[]
  activeTabId: string | null

  // ── Sessions ────────────────────────────────────────────────────────────────
  sessions: Session[]
  messages: Message[]
  isLoading: boolean

  // ── Workspace ───────────────────────────────────────────────────────────────
  workspacePath: string | null
  fileNodes: FileNode[]

  // ── Settings ────────────────────────────────────────────────────────────────
  settings: AppSettings

  // ── Actions ─────────────────────────────────────────────────────────────────

  setActiveView: (v: ActivityView) => void
  toggleTerminal: () => void
  bumpTerminal: () => void

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

  setMessages: (msgs: Message[]) => void
  appendMessage: (msg: Message) => void
  upsertMessage: (id: string, msg: Message) => void
  updateRunningTool: (patch: Partial<Message>) => void
  setLoading: (v: boolean) => void

  setWorkspace: (path: string | null, nodes: FileNode[]) => void
  setFileNodes: (nodes: FileNode[]) => void

  setSettings: (s: AppSettings) => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────────
  activeView: 'chat',
  terminalOpen: false,
  terminalKey: 0,

  tabs: [],
  activeTabId: null,

  sessions: [],
  messages: [],
  isLoading: false,

  workspacePath: null,
  fileNodes: [],

  settings: DEFAULT_SETTINGS,

  // ── UI actions ───────────────────────────────────────────────────────────────
  setActiveView: (v) => set({ activeView: v }),

  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),

  bumpTerminal: () => set((s) => ({ terminalKey: s.terminalKey + 1 })),

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

  removeSession: (id) => set((s) => ({
    sessions: s.sessions.filter((s) => s.id !== id),
  })),

  // ── Message actions ──────────────────────────────────────────────────────────
  setMessages: (msgs) => set({ messages: msgs }),

  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

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

  // ── Workspace actions ────────────────────────────────────────────────────────
  setWorkspace: (path, nodes) => set({ workspacePath: path, fileNodes: nodes }),

  setFileNodes: (nodes) => set({ fileNodes: nodes }),

  // ── Settings actions ─────────────────────────────────────────────────────────
  setSettings: (s) => set({ settings: s }),
}))
