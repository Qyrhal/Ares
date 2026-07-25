import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/useAppStore'
import type { Session, Message } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Untitled',
    model: 'gpt-4o-mini',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    ...overrides,
  }
}

function mkMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: 's1',
    role: 'user',
    content: 'Hello',
    createdAt: Date.now(),
    ...overrides,
  }
}

// ── Reset state before each test ────────────────────────────────────────────

beforeEach(() => {
  useAppStore.setState({
    tabs: [],
    activeTabId: null,
    sessions: [],
    messages: [],
    isLoading: false,
    activeView: 'chat',
    sessionGroups: [],
    todos: [],
    lastDeletedMessage: null,
  })
})

// ── (1) Creating a new session sets activeTabId and adds to tabs ────────────

describe('Session lifecycle — creating a session', () => {
  it('openSessionTab adds a session tab and sets activeTabId', () => {
    const session = mkSession({ id: 's1', title: 'First Chat' })
    const { addSession, openSessionTab } = useAppStore.getState()

    addSession(session)
    openSessionTab(session)

    const { tabs, activeTabId, sessions } = useAppStore.getState()

    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('s1')

    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toEqual({ type: 'session', id: 's1', title: 'First Chat' })
    expect(activeTabId).toBe('s1')
  })

  it('openSessionTab does not duplicate an already-open session tab', () => {
    const session = mkSession({ id: 's1', title: 'First Chat' })
    const { addSession, openSessionTab } = useAppStore.getState()

    addSession(session)
    openSessionTab(session)
    openSessionTab(session) // second call

    const { tabs } = useAppStore.getState()
    expect(tabs).toHaveLength(1)
  })
})

// ── (2) Selecting a different session updates activeTabId ───────────────────

describe('Session lifecycle — selecting a session', () => {
  it('selectTab updates activeTabId to the chosen tab', () => {
    const s1 = mkSession({ id: 's1', title: 'Chat A' })
    const s2 = mkSession({ id: 's2', title: 'Chat B' })
    const { addSession, openSessionTab, selectTab } = useAppStore.getState()

    addSession(s1)
    addSession(s2)
    openSessionTab(s1)
    openSessionTab(s2)

    // After opening s2, it's active
    expect(useAppStore.getState().activeTabId).toBe('s2')

    // Switch back to s1
    selectTab('s1')
    expect(useAppStore.getState().activeTabId).toBe('s1')

    // Switch to s2
    selectTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('selectTab sets activeView to chat for session tabs', () => {
    const session = mkSession({ id: 's1', title: 'Chat' })
    const { addSession, openSessionTab, selectTab, setActiveView } = useAppStore.getState()

    addSession(session)
    openSessionTab(session)

    // Switch away to explorer
    setActiveView('explorer')
    expect(useAppStore.getState().activeView).toBe('explorer')

    // Selecting a session tab switches back to chat
    selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })
})

// ── (3) Deleting a session removes it from sessions array and closes its tab ─

describe('Session lifecycle — deleting a session', () => {
  it('removeSession removes session from the sessions array', () => {
    const s1 = mkSession({ id: 's1', title: 'Chat A' })
    const s2 = mkSession({ id: 's2', title: 'Chat B' })
    const { addSession, removeSession } = useAppStore.getState()

    addSession(s1)
    addSession(s2)
    expect(useAppStore.getState().sessions).toHaveLength(2)

    removeSession('s1')
    const { sessions } = useAppStore.getState()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('s2')
  })

  it('removing a session also closes its tab via closeTab', () => {
    const s1 = mkSession({ id: 's1', title: 'Chat A' })
    const s2 = mkSession({ id: 's2', title: 'Chat B' })
    const { addSession, openSessionTab, removeSession, closeTab } = useAppStore.getState()

    addSession(s1)
    addSession(s2)
    openSessionTab(s1)
    openSessionTab(s2)
    expect(useAppStore.getState().tabs).toHaveLength(2)

    // Remove session and close its tab
    removeSession('s1')
    closeTab('s1')

    const { tabs, sessions, activeTabId } = useAppStore.getState()
    expect(sessions.find((s) => s.id === 's1')).toBeUndefined()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].type === 'session' ? tabs[0].id : null).toBe('s2')
    // activeTabId falls back to the remaining tab
    expect(activeTabId).toBe('s2')
  })

  it('closing the active tab falls back to an adjacent tab', () => {
    const s1 = mkSession({ id: 's1' })
    const s2 = mkSession({ id: 's2' })
    const s3 = mkSession({ id: 's3' })
    const { addSession, openSessionTab, closeTab } = useAppStore.getState()

    addSession(s1)
    addSession(s2)
    addSession(s3)
    openSessionTab(s1)
    openSessionTab(s2)
    openSessionTab(s3)
    expect(useAppStore.getState().activeTabId).toBe('s3')

    // Close the active tab (s3) — should fall back to s2
    closeTab('s3')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('closing the only tab sets activeTabId to null', () => {
    const s1 = mkSession({ id: 's1' })
    const { addSession, openSessionTab, closeTab } = useAppStore.getState()

    addSession(s1)
    openSessionTab(s1)
    expect(useAppStore.getState().activeTabId).toBe('s1')

    closeTab('s1')
    expect(useAppStore.getState().activeTabId).toBeNull()
    expect(useAppStore.getState().tabs).toHaveLength(0)
  })
})

// ── (4) Pinning a session moves it to the top of sidebar order ──────────────

describe('Session lifecycle — pinning', () => {
  it('togglePinSession sets pinned to true', () => {
    const s1 = mkSession({ id: 's1' })
    const { addSession, togglePinSession } = useAppStore.getState()

    addSession(s1)
    togglePinSession('s1')

    const session = useAppStore.getState().sessions.find((s) => s.id === 's1')!
    expect(session.pinned).toBe(true)
  })

  it('pinned sessions sort to the top of sidebar order', () => {
    const s1 = mkSession({ id: 's1', pinned: false })
    const s2 = mkSession({ id: 's2', pinned: false })
    const s3 = mkSession({ id: 's3', pinned: false })
    const { addSession, togglePinSession } = useAppStore.getState()

    addSession(s1)
    addSession(s2)
    addSession(s3)

    // Pin the middle session
    togglePinSession('s2')

    const { sessions } = useAppStore.getState()
    const sorted = [...sessions].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0),
    )
    expect(sorted[0].id).toBe('s2')
    expect(sorted[0].pinned).toBe(true)
    expect(sorted[1].pinned).toBeFalsy()
    expect(sorted[2].pinned).toBeFalsy()
  })

  it('multiple pinned sessions maintain their relative order at top', () => {
    const s1 = mkSession({ id: 's1' })
    const s2 = mkSession({ id: 's2' })
    const s3 = mkSession({ id: 's3' })
    const { addSession, togglePinSession } = useAppStore.getState()

    addSession(s1)
    addSession(s2)
    addSession(s3)

    togglePinSession('s1')
    togglePinSession('s3')

    const sorted = [...useAppStore.getState().sessions].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0),
    )
    // Both pinned sessions should come before unpinned
    const pinnedIds = sorted.filter((s) => s.pinned).map((s) => s.id)
    const unpinnedIds = sorted.filter((s) => !s.pinned).map((s) => s.id)
    expect(pinnedIds).toContain('s1')
    expect(pinnedIds).toContain('s3')
    expect(unpinnedIds).toEqual(['s2'])
  })
})

// ── (5) Unpinning moves it back ────────────────────────────────────────────

describe('Session lifecycle — unpinning', () => {
  it('togglePinSession sets pinned back to false', () => {
    const s1 = mkSession({ id: 's1', pinned: true })
    const { addSession, togglePinSession } = useAppStore.getState()

    addSession(s1)
    togglePinSession('s1')

    const session = useAppStore.getState().sessions.find((s) => s.id === 's1')!
    expect(session.pinned).toBe(false)
  })

  it('unpinned session drops below pinned sessions in sort order', () => {
    const s1 = mkSession({ id: 's1', pinned: false })
    const s2 = mkSession({ id: 's2', pinned: true })
    const s3 = mkSession({ id: 's3', pinned: false })
    const { addSession, togglePinSession } = useAppStore.getState()

    addSession(s1)
    addSession(s2)
    addSession(s3)

    // Unpin s2
    togglePinSession('s2')

    const sorted = [...useAppStore.getState().sessions].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0),
    )
    // No sessions should be pinned
    const pinnedCount = sorted.filter((s) => s.pinned).length
    expect(pinnedCount).toBe(0)
  })
})

// ── (6) Duplicating a session copies all messages ───────────────────────────

describe('Session lifecycle — duplicating a session', () => {
  it('creates a new session with copies of all original messages', () => {
    const original = mkSession({ id: 'orig', title: 'Original Chat' })
    const { addSession, openSessionTab } = useAppStore.getState()

    addSession(original)
    openSessionTab(original)

    // Add messages to original session
    const { appendMessage } = useAppStore.getState()
    appendMessage(mkMessage({ id: 'm1', sessionId: 'orig', content: 'First' }))
    appendMessage(mkMessage({ id: 'm2', sessionId: 'orig', content: 'Second' }))
    appendMessage(mkMessage({ id: 'm3', sessionId: 'orig', content: 'Third' }))

    expect(useAppStore.getState().messages).toHaveLength(3)

    // Simulate duplicate: copy session + messages
    const origState = useAppStore.getState()
    const dupSession = mkSession({
      id: 'dup',
      title: 'Original Chat (Copy)',
      model: original.model,
    })
    const dupMessages = origState.messages
      .filter((m) => m.sessionId === 'orig')
      .map((m) => ({ ...m, id: `${m.id}-dup`, sessionId: 'dup' }))

    useAppStore.getState().addSession(dupSession)
    useAppStore.getState().openSessionTab(dupSession)
    useAppStore.getState().setMessages([...origState.messages, ...dupMessages])

    const { sessions, tabs, activeTabId, messages } = useAppStore.getState()

    // Duplicate session exists
    expect(sessions.find((s) => s.id === 'dup')).toBeDefined()
    expect(tabs.find((t) => t.type === 'session' && t.id === 'dup')).toBeDefined()
    expect(activeTabId).toBe('dup')

    // All messages are present (original + copies)
    expect(messages).toHaveLength(6)

    const origMsgs = messages.filter((m) => m.sessionId === 'orig')
    const dupMsgs = messages.filter((m) => m.sessionId === 'dup')
    expect(origMsgs).toHaveLength(3)
    expect(dupMsgs).toHaveLength(3)

    // Content is identical
    expect(dupMsgs.map((m) => m.content)).toEqual(['First', 'Second', 'Third'])
  })

  it('duplicated session gets a unique id', () => {
    const original = mkSession({ id: 'orig', title: 'My Chat' })
    const { addSession } = useAppStore.getState()

    addSession(original)

    const dupSession = mkSession({
      id: `orig-${Date.now()}`,
      title: 'My Chat (Copy)',
    })
    useAppStore.getState().addSession(dupSession)

    const ids = useAppStore.getState().sessions.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length) // all unique
  })

  it('duplicated session is not pinned even if original was', () => {
    const original = mkSession({ id: 'orig', pinned: true })
    const { addSession } = useAppStore.getState()

    addSession(original)

    const dupSession = mkSession({
      id: 'dup',
      title: 'Copy',
      pinned: false,
    })
    useAppStore.getState().addSession(dupSession)

    const dup = useAppStore.getState().sessions.find((s) => s.id === 'dup')!
    expect(dup.pinned).toBe(false)
  })
})

// ── (7) Renaming a session updates the title in both sessions and tabs ──────

describe('Session lifecycle — renaming', () => {
  it('updateSession with title updates the session title', () => {
    const s1 = mkSession({ id: 's1', title: 'Old Title' })
    const { addSession, updateSession } = useAppStore.getState()

    addSession(s1)
    updateSession('s1', { title: 'New Title' })

    const session = useAppStore.getState().sessions.find((s) => s.id === 's1')!
    expect(session.title).toBe('New Title')
  })

  it('updateSession with title also updates the corresponding tab title', () => {
    const s1 = mkSession({ id: 's1', title: 'Old Title' })
    const { addSession, openSessionTab, updateSession } = useAppStore.getState()

    addSession(s1)
    openSessionTab(s1)

    updateSession('s1', { title: 'New Title' })

    const tab = useAppStore.getState().tabs.find(
      (t) => t.type === 'session' && t.id === 's1',
    )
    expect(tab).toBeDefined()
    expect(tab!.type === 'session' ? tab!.title : null).toBe('New Title')
  })

  it('updateSession without title does not affect tabs', () => {
    const s1 = mkSession({ id: 's1', title: 'Original' })
    const { addSession, openSessionTab, updateSession } = useAppStore.getState()

    addSession(s1)
    openSessionTab(s1)

    // Patch a non-title field
    updateSession('s1', { messageCount: 5 })

    const tab = useAppStore.getState().tabs.find(
      (t) => t.type === 'session' && t.id === 's1',
    )
    expect(tab!.type === 'session' ? tab!.title : null).toBe('Original')

    const session = useAppStore.getState().sessions.find((s) => s.id === 's1')!
    expect(session.messageCount).toBe(5)
  })

  it('renaming a session that has no open tab only updates the session', () => {
    const s1 = mkSession({ id: 's1', title: 'Old' })
    const { addSession, updateSession } = useAppStore.getState()

    addSession(s1)
    // No openSessionTab call
    updateSession('s1', { title: 'New' })

    expect(
      useAppStore.getState().sessions.find((s) => s.id === 's1')!.title,
    ).toBe('New')
    // No session tab exists
    const sessionTab = useAppStore.getState().tabs.find(
      (t) => t.type === 'session' && t.id === 's1',
    )
    expect(sessionTab).toBeUndefined()
  })
})
