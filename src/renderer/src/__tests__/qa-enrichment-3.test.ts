import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, Message, Tab, FileNode, Todo, SessionGroup } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', title: 'Test', model: 'gpt-4o',
    createdAt: 0, updatedAt: 0, messageCount: 0, ...overrides,
  }
}

function mkMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1', sessionId: 's1', role: 'user', content: 'Hello',
    createdAt: 0, ...overrides,
  }
}

function mkTab(overrides: Partial<Tab> = {}): Tab {
  return {
    type: 'session', id: 's1', title: 'Tab', ...overrides,
  }
}

function mkGroup(overrides: Partial<SessionGroup> = {}): SessionGroup {
  return {
    id: 'g1', name: 'Group', createdAt: 0, ...overrides,
  }
}

beforeEach(() => {
  useAppStore.setState({
    sessions: [],
    messages: [],
    todos: [],
    tabs: [],
    activeTabId: null,
    activeView: 'chat',
    sessionGroups: [],
    sideChatMessages: [],
    sideChatSessionId: null,
    sideChatIsLoading: false,
    commits: [],
    activeCommit: null,
    gitLoading: false,
    workspacePath: null,
    fileNodes: [],
    recentProjects: [],
    lastDeletedMessage: null,
    isLoading: false,
    settings: {
      apiKey: '',
      apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      themeId: 'steel',
      colorMode: 'dark',
      systemPrompt: '',
      permissionMode: 'ask',
      planPreviewEnabled: true,
    },
  })
})

// ── renameTabPaths: activeTabId tracking ─────────────────────────────────────

describe('store — renameTabPaths: activeTabId tracking', () => {
  it('updates activeTabId when renaming a file tab that is active', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/old.ts', name: 'old.ts', isDirty: false }],
      activeTabId: '/old.ts',
    })
    useAppStore.getState().renameTabPaths('/old.ts', '/new.ts', 'new.ts')
    expect(useAppStore.getState().activeTabId).toBe('/new.ts')
  })

  it('updates activeTabId for a directory child that is active', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/src/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/src/b.ts',
    })
    useAppStore.getState().renameTabPaths('/src', '/lib', 'lib')
    expect(useAppStore.getState().activeTabId).toBe('/lib/b.ts')
  })

  it('does not change activeTabId when renaming a non-active tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().renameTabPaths('/b.ts', '/c.ts', 'c.ts')
    expect(useAppStore.getState().activeTabId).toBe('/a.ts')
  })

  it('renames directory children and updates their paths', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false },
        { type: 'file', path: '/src/utils.ts', name: 'utils.ts', isDirty: false },
      ],
    })
    useAppStore.getState().renameTabPaths('/src', '/lib', 'lib')
    const paths = useAppStore.getState().tabs.map((t) => t.type === 'file' ? t.path : null)
    expect(paths).toEqual(['/lib/index.ts', '/lib/utils.ts'])
  })

  it('renames directory children names are updated', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false },
      ],
    })
    useAppStore.getState().renameTabPaths('/src', '/lib', 'lib')
    const tab = useAppStore.getState().tabs[0]
    if (tab.type === 'file') expect(tab.name).toBe('index.ts')
  })
})

// ── removeTabsByPath: directory children and activeTabId ─────────────────────

describe('store — removeTabsByPath: directory children and activeTabId', () => {
  it('removes all tabs under a directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/src/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file', path: '/other.ts', name: 'other.ts', isDirty: false },
      ],
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].type === 'file' && useAppStore.getState().tabs[0].path).toBe('/other.ts')
  })

  it('falls back to last tab when activeTabId is a child of removed directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/other.ts', name: 'other.ts', isDirty: false },
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/src/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/src/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    expect(useAppStore.getState().activeTabId).toBe('/other.ts')
  })

  it('sets activeTabId to null when all tabs are under removed directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/src/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/src/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('no-ops when isDir is false and path does not match exactly', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
      ],
    })
    useAppStore.getState().removeTabsByPath('/src', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })
})

// ── openSessionTab deduplication ─────────────────────────────────────────────

describe('store — openSessionTab deduplication', () => {
  it('does not duplicate session tab when already open', () => {
    const s = mkSession({ id: 's1' })
    useAppStore.getState().openSessionTab(s)
    useAppStore.getState().openSessionTab(s)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('opens different session tabs', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'A' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's2', title: 'B' }))
    expect(useAppStore.getState().tabs).toHaveLength(2)
  })

  it('activates the existing tab when opened again', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.setState({ activeTabId: 'other' })
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

// ── openFileTab deduplication ────────────────────────────────────────────────

describe('store — openFileTab deduplication', () => {
  it('does not duplicate file tab when already open', () => {
    const node: FileNode = { name: 'a.ts', path: '/a.ts', type: 'file' }
    useAppStore.getState().openFileTab(node)
    useAppStore.getState().openFileTab(node)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('opens different file tabs', () => {
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', type: 'file' })
    useAppStore.getState().openFileTab({ name: 'b.ts', path: '/b.ts', type: 'file' })
    expect(useAppStore.getState().tabs).toHaveLength(2)
  })

  it('activates existing file tab when opened again', () => {
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', type: 'file' })
    useAppStore.setState({ activeTabId: 'other' })
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', type: 'file' })
    expect(useAppStore.getState().activeTabId).toBe('/a.ts')
  })
})

// ── selectTab view switching ─────────────────────────────────────────────────

describe('store — selectTab view switching', () => {
  it('switches to chat view when selecting a session tab', () => {
    useAppStore.setState({
      tabs: [mkTab({ type: 'session', id: 's1' })],
      activeView: 'git',
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('does not change activeView when selecting a file tab', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false }],
      activeView: 'git',
    })
    useAppStore.getState().selectTab('/a.ts')
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('selecting a tab that does not exist still sets activeTabId', () => {
    useAppStore.getState().selectTab('nonexistent')
    expect(useAppStore.getState().activeTabId).toBe('nonexistent')
  })
})

// ── updateSession: title syncs to tab ────────────────────────────────────────

describe('store — updateSession: title syncs to tab', () => {
  it('syncs title to session tab when title is patched', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Old' })],
      tabs: [mkTab({ type: 'session', id: 's1', title: 'Old' })],
    })
    useAppStore.getState().updateSession('s1', { title: 'New' })
    const tab = useAppStore.getState().tabs.find((t) => t.type === 'session' && t.id === 's1')
    expect(tab?.title).toBe('New')
  })

  it('does not sync non-title patches to tab', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Keep' })],
      tabs: [mkTab({ type: 'session', id: 's1', title: 'Keep' })],
    })
    useAppStore.getState().updateSession('s1', { model: 'gpt-4' })
    const tab = useAppStore.getState().tabs.find((t) => t.type === 'session' && t.id === 's1')
    expect(tab?.title).toBe('Keep')
  })

  it('no-ops for non-existent session', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'A' })],
    })
    useAppStore.getState().updateSession('nonexistent', { title: 'B' })
    expect(useAppStore.getState().sessions[0].title).toBe('A')
  })
})

// ── removeSession does not affect tabs ───────────────────────────────────────

describe('store — removeSession does not affect tabs', () => {
  it('removing a session does not auto-close its tab', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' })],
      tabs: [mkTab({ type: 'session', id: 's1' })],
      activeTabId: 's1',
    })
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })
})

// ── togglePinSession: order effects ──────────────────────────────────────────

describe('store — togglePinSession: order effects', () => {
  it('pins multiple sessions independently', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', title: 'A' }),
        mkSession({ id: 's2', title: 'B' }),
        mkSession({ id: 's3', title: 'C' }),
      ],
    })
    useAppStore.getState().togglePinSession('s1')
    useAppStore.getState().togglePinSession('s3')
    const pinned = useAppStore.getState().sessions.filter((s) => s.pinned)
    expect(pinned.map((s) => s.id)).toEqual(['s1', 's3'])
  })

  it('unpinning a session removes it from pinned', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', pinned: true })],
    })
    useAppStore.getState().togglePinSession('s1')
    expect(useAppStore.getState().sessions[0].pinned).toBe(false)
  })
})

// ── toggleArchiveSession: edge cases ─────────────────────────────────────────

describe('store — toggleArchiveSession: edge cases', () => {
  it('archives and unarchives independently per session', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', title: 'A' }),
        mkSession({ id: 's2', title: 'B' }),
      ],
    })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
    expect(useAppStore.getState().sessions[1].archived).toBeUndefined()
  })

  it('no-ops for non-existent session', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' })],
    })
    useAppStore.getState().toggleArchiveSession('nonexistent')
    expect(useAppStore.getState().sessions[0].archived).toBeUndefined()
  })
})

// ── removeSessionGroup: clears group from sessions ───────────────────────────

describe('store — removeSessionGroup: clears group from sessions', () => {
  it('removes group and ungroups all sessions in that group', () => {
    useAppStore.setState({
      sessionGroups: [mkGroup({ id: 'g1' })],
      sessions: [
        mkSession({ id: 's1', group: 'g1' }),
        mkSession({ id: 's2', group: 'g1' }),
        mkSession({ id: 's3', group: 'g2' }),
      ],
    })
    useAppStore.getState().removeSessionGroup('g1')
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
    const s1 = useAppStore.getState().sessions.find((s) => s.id === 's1')
    const s3 = useAppStore.getState().sessions.find((s) => s.id === 's3')
    expect(s1?.group).toBeUndefined()
    expect(s3?.group).toBe('g2')
  })

  it('no-ops for non-existent group', () => {
    useAppStore.setState({
      sessionGroups: [mkGroup({ id: 'g1' })],
    })
    useAppStore.getState().removeSessionGroup('nonexistent')
    expect(useAppStore.getState().sessionGroups).toHaveLength(1)
  })
})

// ── setSessionGroup: assignment edge cases ────────────────────────────────────

describe('store — setSessionGroup: assignment edge cases', () => {
  it('assigns session to group', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' })],
    })
    useAppStore.getState().setSessionGroup('s1', 'g1')
    expect(useAppStore.getState().sessions[0].group).toBe('g1')
  })

  it('moves session from one group to another', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', group: 'g1' })],
    })
    useAppStore.getState().setSessionGroup('s1', 'g2')
    expect(useAppStore.getState().sessions[0].group).toBe('g2')
  })

  it('removes session from group when groupId is null', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', group: 'g1' })],
    })
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })

  it('no-ops for non-existent session', () => {
    useAppStore.getState().setSessionGroup('nonexistent', 'g1')
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })
})

// ── addSessionGroup: returns unique ids ──────────────────────────────────────

describe('store — addSessionGroup: returns unique ids', () => {
  it('each call returns a unique id', () => {
    const id1 = useAppStore.getState().addSessionGroup('A')
    const id2 = useAppStore.getState().addSessionGroup('B')
    expect(id1).not.toBe(id2)
  })

  it('creates group with correct name', () => {
    useAppStore.getState().addSessionGroup('My Group')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('My Group')
  })
})

// ── renameSessionGroup: edge cases ───────────────────────────────────────────

describe('store — renameSessionGroup: edge cases', () => {
  it('renames group by id', () => {
    useAppStore.getState().addSessionGroup('Old')
    const id = useAppStore.getState().sessionGroups[0].id
    useAppStore.getState().renameSessionGroup(id, 'New')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('New')
  })

  it('no-ops for non-existent group', () => {
    useAppStore.getState().addSessionGroup('A')
    useAppStore.getState().renameSessionGroup('nonexistent', 'B')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('A')
  })

  it('does not affect other groups', () => {
    useAppStore.getState().addSessionGroup('A')
    useAppStore.getState().addSessionGroup('B')
    const id = useAppStore.getState().sessionGroups[0].id
    useAppStore.getState().renameSessionGroup(id, 'A2')
    expect(useAppStore.getState().sessionGroups[1].name).toBe('B')
  })
})

// ── clearAllMessages: edge cases ─────────────────────────────────────────────

describe('store — clearAllMessages: edge cases', () => {
  it('clears messages and resets isLoading', () => {
    useAppStore.setState({
      messages: [mkMessage({ id: 'm1' }), mkMessage({ id: 'm2' })],
      isLoading: true,
    })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
    expect(useAppStore.getState().isLoading).toBe(false)
  })

  it('no-ops when already empty', () => {
    useAppStore.setState({ messages: [], isLoading: false })
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
  })
})

// ── setLoading: edge cases ───────────────────────────────────────────────────

describe('store — setLoading: edge cases', () => {
  it('sets loading to true', () => {
    useAppStore.getState().setLoading(true)
    expect(useAppStore.getState().isLoading).toBe(true)
  })

  it('sets loading to false', () => {
    useAppStore.setState({ isLoading: true })
    useAppStore.getState().setLoading(false)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

// ── setCommits: edge cases ───────────────────────────────────────────────────

describe('store — setCommits: edge cases', () => {
  it('replaces commits array', () => {
    useAppStore.getState().setCommits([{ hash: 'abc', message: 'msg', author: 'me', date: '', files: [], parents: [] }])
    expect(useAppStore.getState().commits).toHaveLength(1)
  })

  it('clears commits when set to empty', () => {
    useAppStore.setState({ commits: [{ hash: 'abc', message: 'msg', author: 'me', date: '', files: [], parents: [] }] })
    useAppStore.getState().setCommits([])
    expect(useAppStore.getState().commits).toHaveLength(0)
  })
})

// ── setActiveCommit: edge cases ──────────────────────────────────────────────

describe('store — setActiveCommit: edge cases', () => {
  it('sets active commit hash', () => {
    useAppStore.getState().setActiveCommit('abc123')
    expect(useAppStore.getState().activeCommit).toBe('abc123')
  })

  it('clears active commit with null', () => {
    useAppStore.setState({ activeCommit: 'abc' })
    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })
})

// ── setGitLoading: edge cases ────────────────────────────────────────────────

describe('store — setGitLoading: edge cases', () => {
  it('sets git loading to true', () => {
    useAppStore.getState().setGitLoading(true)
    expect(useAppStore.getState().gitLoading).toBe(true)
  })

  it('sets git loading to false', () => {
    useAppStore.setState({ gitLoading: true })
    useAppStore.getState().setGitLoading(false)
    expect(useAppStore.getState().gitLoading).toBe(false)
  })
})

// ── setWorkspace: edge cases ─────────────────────────────────────────────────

describe('store — setWorkspace: edge cases', () => {
  it('sets workspace path and nodes', () => {
    useAppStore.getState().setWorkspace('/project', [{ name: 'src', path: '/src', type: 'directory' }])
    expect(useAppStore.getState().workspacePath).toBe('/project')
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })

  it('clears workspace', () => {
    useAppStore.setState({ workspacePath: '/project', fileNodes: [{ name: 'x', path: '/x', type: 'file' }] })
    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })
})

// ── setRecentProjects: edge cases ────────────────────────────────────────────

describe('store — setRecentProjects: edge cases', () => {
  it('replaces recent projects', () => {
    useAppStore.getState().setRecentProjects(['/a', '/b'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b'])
  })

  it('clears when set to empty', () => {
    useAppStore.setState({ recentProjects: ['/a'] })
    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toEqual([])
  })
})

// ── setSettings: edge cases ──────────────────────────────────────────────────

describe('store — setSettings: edge cases', () => {
  it('replaces settings object', () => {
    useAppStore.getState().setSettings({
      apiKey: 'new-key',
      apiBaseUrl: 'https://api.example.com/v1',
      defaultModel: 'gpt-4',
      themeId: 'red',
      colorMode: 'light',
      systemPrompt: 'You are helpful',
      permissionMode: 'auto',
      planPreviewEnabled: false,
    })
    expect(useAppStore.getState().settings.apiKey).toBe('new-key')
    expect(useAppStore.getState().settings.themeId).toBe('red')
  })
})

// ── setFileNodes: edge cases ─────────────────────────────────────────────────

describe('store — setFileNodes: edge cases', () => {
  it('replaces file nodes', () => {
    useAppStore.getState().setFileNodes([{ name: 'src', path: '/src', type: 'directory' }])
    expect(useAppStore.getState().fileNodes).toHaveLength(1)
  })

  it('clears when set to empty', () => {
    useAppStore.setState({ fileNodes: [{ name: 'x', path: '/x', type: 'file' }] })
    useAppStore.getState().setFileNodes([])
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })
})

// ── updateRunningTool: edge cases ────────────────────────────────────────────

describe('store — updateRunningTool: edge cases', () => {
  it('no-ops when no running tool exists', () => {
    useAppStore.setState({
      messages: [mkMessage({ id: 'm1', role: 'tool', toolStatus: 'done' })],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[0].toolStatus).toBe('done')
  })

  it('updates the last running tool when multiple running tools exist', () => {
    useAppStore.setState({
      messages: [
        mkMessage({ id: 'm1', role: 'tool', toolStatus: 'running' }),
        mkMessage({ id: 'm2', role: 'tool', toolStatus: 'running' }),
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[0].toolStatus).toBe('running')
    expect(useAppStore.getState().messages[1].toolStatus).toBe('done')
  })
})

// ── toggleTerminal / toggleZenMode: edge cases ───────────────────────────────

describe('store — toggleTerminal / toggleZenMode: edge cases', () => {
  it('toggleTerminal toggles', () => {
    expect(useAppStore.getState().terminalOpen).toBe(false)
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })

  it('toggleZenMode toggles', () => {
    expect(useAppStore.getState().zenMode).toBe(false)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

// ── setTerminalHeight: edge cases ────────────────────────────────────────────

describe('store — setTerminalHeight: edge cases', () => {
  it('sets terminal height', () => {
    useAppStore.getState().setTerminalHeight('300px')
    expect(useAppStore.getState().terminalHeight).toBe('300px')
  })

  it('can set to different values', () => {
    useAppStore.getState().setTerminalHeight('100px')
    useAppStore.getState().setTerminalHeight('500px')
    expect(useAppStore.getState().terminalHeight).toBe('500px')
  })
})

// ── setActiveView: edge cases ────────────────────────────────────────────────

describe('store — setActiveView: edge cases', () => {
  it('sets active view to chat', () => {
    useAppStore.getState().setActiveView('chat')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('sets active view to explorer', () => {
    useAppStore.getState().setActiveView('explorer')
    expect(useAppStore.getState().activeView).toBe('explorer')
  })

  it('sets active view to git', () => {
    useAppStore.getState().setActiveView('git')
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('sets active view to settings', () => {
    useAppStore.getState().setActiveView('settings')
    expect(useAppStore.getState().activeView).toBe('settings')
  })
})

// ── setLastDeletedMessage / clearLastDeletedMessage: edge cases ───────────────

describe('store — lastDeletedMessage: edge cases', () => {
  it('sets last deleted message', () => {
    const msg = mkMessage({ id: 'm1', content: 'deleted' })
    useAppStore.getState().setLastDeletedMessage(msg)
    expect(useAppStore.getState().lastDeletedMessage?.id).toBe('m1')
  })

  it('replaces previous deleted message', () => {
    useAppStore.getState().setLastDeletedMessage(mkMessage({ id: 'm1' }))
    useAppStore.getState().setLastDeletedMessage(mkMessage({ id: 'm2' }))
    expect(useAppStore.getState().lastDeletedMessage?.id).toBe('m2')
  })

  it('clears deleted message when set to null', () => {
    useAppStore.setState({ lastDeletedMessage: mkMessage() })
    useAppStore.getState().setLastDeletedMessage(null)
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })

  it('clearLastDeletedMessage clears the message', () => {
    useAppStore.setState({ lastDeletedMessage: mkMessage() })
    useAppStore.getState().clearLastDeletedMessage()
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })

  it('clearLastDeletedMessage no-ops when already null', () => {
    useAppStore.getState().clearLastDeletedMessage()
    expect(useAppStore.getState().lastDeletedMessage).toBeNull()
  })
})

// ── side chat operations: edge cases ─────────────────────────────────────────

describe('store — side chat operations: edge cases', () => {
  it('setSideChat sets the side chat session id', () => {
    useAppStore.getState().setSideChat('sc1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc1')
  })

  it('setSideChat clears when passed null', () => {
    useAppStore.setState({ sideChatSessionId: 'sc1' })
    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })

  it('setSideChatMessages replaces messages', () => {
    useAppStore.getState().setSideChatMessages([mkMessage({ id: 'sc1' })])
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('appendSideChatMessage adds to the end', () => {
    useAppStore.getState().appendSideChatMessage(mkMessage({ id: 'sc1' }))
    useAppStore.getState().appendSideChatMessage(mkMessage({ id: 'sc2' }))
    expect(useAppStore.getState().sideChatMessages).toHaveLength(2)
    expect(useAppStore.getState().sideChatMessages[1].id).toBe('sc2')
  })

  it('upsertSideChatMessage appends new message', () => {
    useAppStore.getState().upsertSideChatMessage('sc1', mkMessage({ id: 'sc1' }))
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('upsertSideChatMessage updates existing message', () => {
    useAppStore.setState({ sideChatMessages: [mkMessage({ id: 'sc1', content: 'old' })] })
    useAppStore.getState().upsertSideChatMessage('sc1', mkMessage({ id: 'sc1', content: 'new' }))
    expect(useAppStore.getState().sideChatMessages[0].content).toBe('new')
  })

  it('removeSideChatMessage removes by id', () => {
    useAppStore.setState({ sideChatMessages: [mkMessage({ id: 'sc1' }), mkMessage({ id: 'sc2' })] })
    useAppStore.getState().removeSideChatMessage('sc1')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
    expect(useAppStore.getState().sideChatMessages[0].id).toBe('sc2')
  })

  it('removeSideChatMessage no-ops for non-existent id', () => {
    useAppStore.setState({ sideChatMessages: [mkMessage({ id: 'sc1' })] })
    useAppStore.getState().removeSideChatMessage('nonexistent')
    expect(useAppStore.getState().sideChatMessages).toHaveLength(1)
  })

  it('setSideChatLoading toggles loading state', () => {
    useAppStore.getState().setSideChatLoading(true)
    expect(useAppStore.getState().sideChatIsLoading).toBe(true)
    useAppStore.getState().setSideChatLoading(false)
    expect(useAppStore.getState().sideChatIsLoading).toBe(false)
  })
})

// ── Integration: session lifecycle with groups ────────────────────────────────

describe('Integration — session lifecycle with groups', () => {
  it('create group → assign session → rename group → remove group', () => {
    const groupId = useAppStore.getState().addSessionGroup('Work')
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' }), mkSession({ id: 's2' })],
    })
    useAppStore.getState().setSessionGroup('s1', groupId)
    expect(useAppStore.getState().sessions[0].group).toBe(groupId)

    useAppStore.getState().renameSessionGroup(groupId, 'Personal')
    expect(useAppStore.getState().sessionGroups[0].name).toBe('Personal')

    useAppStore.getState().removeSessionGroup(groupId)
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
    expect(useAppStore.getState().sessions[0].group).toBeUndefined()
  })
})

// ── Integration: message flow chains ─────────────────────────────────────────

describe('Integration — message flow chains', () => {
  it('append → upsert → remove → verify', () => {
    useAppStore.getState().appendMessage(mkMessage({ id: 'm1', content: 'a' }))
    useAppStore.getState().appendMessage(mkMessage({ id: 'm2', content: 'b' }))
    useAppStore.getState().upsertMessage('m1', mkMessage({ id: 'm1', content: 'a-updated' }))
    expect(useAppStore.getState().messages[0].content).toBe('a-updated')
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('m1')
  })

  it('clearAllMessages resets isLoading', () => {
    useAppStore.setState({ isLoading: true })
    useAppStore.getState().appendMessage(mkMessage())
    useAppStore.getState().clearAllMessages()
    expect(useAppStore.getState().messages).toHaveLength(0)
    expect(useAppStore.getState().isLoading).toBe(false)
  })
})

// ── Integration: tab operations flow chains ───────────────────────────────────

describe('Integration — tab operations flow chains', () => {
  it('open session → open file → close file → session remains', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', type: 'file' })
    expect(useAppStore.getState().tabs).toHaveLength(2)
    useAppStore.getState().closeTab('/a.ts')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].type === 'session' && useAppStore.getState().tabs[0].id).toBe('s1')
  })

  it('close active tab → falls back to adjacent', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's2' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's3' }))
    useAppStore.getState().selectTab('s2')
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).not.toBe('s2')
  })

  it('close last remaining tab → no tabs', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    useAppStore.getState().closeTab('s1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('tab dirty state → set dirty → set clean', () => {
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/a.ts', type: 'file' })
    useAppStore.getState().setTabDirty('/a.ts', true)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(true)
    useAppStore.getState().setTabDirty('/a.ts', false)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(false)
  })
})

// ── Integration: settings and preferences ─────────────────────────────────────

describe('Integration — settings and preferences', () => {
  it('change settings → persists → read back', () => {
    useAppStore.getState().setSettings({
      ...useAppStore.getState().settings,
      apiKey: 'test-key',
      themeId: 'red',
    })
    expect(useAppStore.getState().settings.apiKey).toBe('test-key')
    expect(useAppStore.getState().settings.themeId).toBe('red')
  })

  it('toggle zen mode → toggle back', () => {
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    useAppStore.getState().toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
  })

  it('toggle terminal → height preserved', () => {
    useAppStore.getState().setTerminalHeight('400px')
    useAppStore.getState().toggleTerminal()
    expect(useAppStore.getState().terminalHeight).toBe('400px')
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })
})

// ── Integration: todo operations flow ─────────────────────────────────────────

describe('Integration — todo operations flow', () => {
  it('add todos → update one → remove one → verify', () => {
    useAppStore.getState().addTodo({ id: 't1', text: 'A', completed: false, sessionId: 's1', createdAt: 0 } as any)
    useAppStore.getState().addTodo({ id: 't2', text: 'B', completed: false, sessionId: 's1', createdAt: 1 } as any)
    useAppStore.getState().addTodo({ id: 't3', text: 'C', completed: false, sessionId: 's1', createdAt: 2 } as any)
    expect(useAppStore.getState().todos).toHaveLength(3)

    useAppStore.getState().updateTodo('t2', { completed: true })
    expect(useAppStore.getState().todos[1].completed).toBe(true)

    useAppStore.getState().removeTodo('t1')
    expect(useAppStore.getState().todos).toHaveLength(2)
    expect(useAppStore.getState().todos.map((t) => t.id)).toEqual(['t2', 't3'])
  })

  it('setTodos replaces all → clear → empty', () => {
    useAppStore.getState().setTodos([
      { id: 't1', text: 'A', completed: false, sessionId: 's1', createdAt: 0 },
      { id: 't2', text: 'B', completed: false, sessionId: 's1', createdAt: 1 },
    ] as any[])
    expect(useAppStore.getState().todos).toHaveLength(2)
    useAppStore.getState().setTodos([])
    expect(useAppStore.getState().todos).toHaveLength(0)
  })
})

// ── Integration: git and commit operations ────────────────────────────────────

describe('Integration — git and commit operations', () => {
  it('set commits → select commit → clear', () => {
    const commits = [
      { hash: 'abc', message: 'first', author: 'me', date: '', files: [], parents: [] },
      { hash: 'def', message: 'second', author: 'me', date: '', files: [], parents: [] },
    ]
    useAppStore.getState().setCommits(commits)
    expect(useAppStore.getState().commits).toHaveLength(2)
    useAppStore.getState().setActiveCommit('abc')
    expect(useAppStore.getState().activeCommit).toBe('abc')
    useAppStore.getState().setActiveCommit(null)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })

  it('git loading toggle', () => {
    useAppStore.getState().setGitLoading(true)
    expect(useAppStore.getState().gitLoading).toBe(true)
    useAppStore.getState().setGitLoading(false)
    expect(useAppStore.getState().gitLoading).toBe(false)
  })
})

// ── Integration: recent projects ──────────────────────────────────────────────

describe('Integration — recent projects', () => {
  it('add project → add another → clear', () => {
    useAppStore.getState().setRecentProjects(['/a'])
    useAppStore.getState().setRecentProjects(['/a', '/b'])
    expect(useAppStore.getState().recentProjects).toEqual(['/a', '/b'])
    useAppStore.getState().setRecentProjects([])
    expect(useAppStore.getState().recentProjects).toEqual([])
  })
})

// ── Integration: side chat flow ───────────────────────────────────────────────

describe('Integration — side chat flow', () => {
  it('open side chat → send messages → close side chat', () => {
    useAppStore.getState().setSideChat('sc1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc1')

    useAppStore.getState().appendSideChatMessage(mkMessage({ id: 'm1', content: 'hi' }))
    useAppStore.getState().appendSideChatMessage(mkMessage({ id: 'm2', content: 'hello' }))
    expect(useAppStore.getState().sideChatMessages).toHaveLength(2)

    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })
})

// ── Integration: workspace and file operations ────────────────────────────────

describe('Integration — workspace and file operations', () => {
  it('set workspace → set file nodes → clear workspace', () => {
    useAppStore.getState().setWorkspace('/project', [
      { name: 'src', path: '/src', type: 'directory' },
      { name: 'a.ts', path: '/a.ts', type: 'file' },
    ])
    expect(useAppStore.getState().workspacePath).toBe('/project')
    expect(useAppStore.getState().fileNodes).toHaveLength(2)

    useAppStore.getState().setWorkspace(null, [])
    expect(useAppStore.getState().workspacePath).toBeNull()
    expect(useAppStore.getState().fileNodes).toHaveLength(0)
  })

  it('open file tab with workspace → rename updates reference', () => {
    useAppStore.getState().openFileTab({ name: 'a.ts', path: '/src/a.ts', type: 'file' })
    useAppStore.getState().renameTabPaths('/src/a.ts', '/lib/a.ts', 'a.ts')
    const tab = useAppStore.getState().tabs[0]
    if (tab.type === 'file') {
      expect(tab.path).toBe('/lib/a.ts')
    }
  })
})

// ── Integration: session lifecycle CRUD ───────────────────────────────────────

describe('Integration — session lifecycle CRUD', () => {
  it('create session → appears in sidebar → select → loads', () => {
    useAppStore.getState().addSession(mkSession({ id: 's1', title: 'Test' }))
    expect(useAppStore.getState().sessions).toHaveLength(1)

    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('pin session → pinned flag set → unpin → flag cleared', () => {
    useAppStore.setState({
      sessions: [
        mkSession({ id: 's1', title: 'A' }),
        mkSession({ id: 's2', title: 'B' }),
      ],
    })
    useAppStore.getState().togglePinSession('s2')
    expect(useAppStore.getState().sessions[1].pinned).toBe(true)
    expect(useAppStore.getState().sessions[0].pinned).toBeUndefined()

    useAppStore.getState().togglePinSession('s2')
    expect(useAppStore.getState().sessions[1].pinned).toBe(false)
  })

  it('delete session → removed from list', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' }), mkSession({ id: 's2' })],
    })
    useAppStore.getState().removeSession('s1')
    expect(useAppStore.getState().sessions).toHaveLength(1)
    expect(useAppStore.getState().sessions[0].id).toBe('s2')
  })

  it('update session → partial update works', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1', title: 'Old', model: 'gpt-4' })],
    })
    useAppStore.getState().updateSession('s1', { title: 'New' })
    expect(useAppStore.getState().sessions[0].title).toBe('New')
    expect(useAppStore.getState().sessions[0].model).toBe('gpt-4')
  })

  it('archive session → toggles archived flag', () => {
    useAppStore.setState({
      sessions: [mkSession({ id: 's1' })],
    })
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(true)
    useAppStore.getState().toggleArchiveSession('s1')
    expect(useAppStore.getState().sessions[0].archived).toBe(false)
  })
})

// ── Integration: renameTabPaths scenarios ─────────────────────────────────────

describe('Integration — renameTabPaths scenarios', () => {
  it('renames file tab and updates activeTabId when it matches', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/old.ts', name: 'old.ts', isDirty: false }],
      activeTabId: '/old.ts',
    })
    useAppStore.getState().renameTabPaths('/old.ts', '/new.ts', 'new.ts')
    expect(useAppStore.getState().activeTabId).toBe('/new.ts')
    expect(useAppStore.getState().tabs[0].type === 'file' && useAppStore.getState().tabs[0].path).toBe('/new.ts')
  })

  it('renames directory children tabs', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: false },
        { type: 'file', path: '/src/utils.ts', name: 'utils.ts', isDirty: false },
        { type: 'file', path: '/other.ts', name: 'other.ts', isDirty: false },
      ],
    })
    useAppStore.getState().renameTabPaths('/src', '/lib', 'lib')
    const paths = useAppStore.getState().tabs.map((t) => t.type === 'file' ? t.path : null)
    expect(paths).toEqual(['/lib/index.ts', '/lib/utils.ts', '/other.ts'])
  })
})

// ── Integration: close tab scenarios ──────────────────────────────────────────

describe('Integration — close tab scenarios', () => {
  it('closing active session tab falls back to adjacent', () => {
    useAppStore.setState({
      tabs: [
        mkTab({ id: 's1', title: 'A' }),
        mkTab({ id: 's2', title: 'B' }),
        mkTab({ id: 's3', title: 'C' }),
      ],
      activeTabId: 's2',
    })
    useAppStore.getState().closeTab('s2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).not.toBe('s2')
  })

  it('closing active file tab falls back to session tab', () => {
    useAppStore.setState({
      tabs: [
        mkTab({ id: 's1', title: 'Session' }),
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().closeTab('/a.ts')
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

// ── Integration: removeTabsByPath scenarios ───────────────────────────────────

describe('Integration — removeTabsByPath scenarios', () => {
  it('removes exact file tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
    })
    useAppStore.getState().removeTabsByPath('/a.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0].type === 'file' && useAppStore.getState().tabs[0].path).toBe('/b.ts')
  })

  it('removes directory tabs recursively', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/src/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file', path: '/other.ts', name: 'other.ts', isDirty: false },
      ],
    })
    useAppStore.getState().removeTabsByPath('/src', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })
})
