import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { Session, FileNode } from '@/types'

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    title: 'Test',
    model: 'gpt-4o',
    createdAt: 0,
    updatedAt: 0,
    messageCount: 0,
    ...overrides,
  }
}

function mkFileNode(overrides: Partial<FileNode> = {}): FileNode {
  return { name: 'test.ts', path: '/test.ts', type: 'file', ...overrides }
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
    promptHistory: [],
    promptHistoryIdx: -1,
    sessionFilter: null,
    sessionSort: { by: 'recent', asc: false },
    lastExecCommand: null,
    isLoading: false,
    previewOpen: false,
    previewUrl: null,
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  togglePreview
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — togglePreview', () => {
  it('toggles previewOpen from false to true', () => {
    expect(useAppStore.getState().previewOpen).toBe(false)
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('toggles previewOpen from true to false', () => {
    useAppStore.setState({ previewOpen: true })
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(false)
  })

  it('toggles multiple times back to original state', () => {
    useAppStore.getState().togglePreview()
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(false)
  })

  it('does not affect previewUrl', () => {
    useAppStore.setState({ previewUrl: 'http://example.com' })
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewUrl).toBe('http://example.com')
  })

  it('can be toggled rapidly in succession', () => {
    useAppStore.getState().togglePreview()
    useAppStore.getState().togglePreview()
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  setPreviewUrl
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — setPreviewUrl', () => {
  it('sets a URL and opens the preview panel', () => {
    useAppStore.getState().setPreviewUrl('http://localhost:3000')
    expect(useAppStore.getState().previewUrl).toBe('http://localhost:3000')
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('sets URL even when preview is already open', () => {
    useAppStore.setState({ previewOpen: true })
    useAppStore.getState().setPreviewUrl('http://example.com')
    expect(useAppStore.getState().previewUrl).toBe('http://example.com')
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('clears URL with null and keeps panel open', () => {
    useAppStore.getState().setPreviewUrl('http://example.com')
    expect(useAppStore.getState().previewOpen).toBe(true)
    useAppStore.getState().setPreviewUrl(null)
    expect(useAppStore.getState().previewUrl).toBeNull()
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('overwrites previous URL', () => {
    useAppStore.getState().setPreviewUrl('http://first.com')
    useAppStore.getState().setPreviewUrl('http://second.com')
    expect(useAppStore.getState().previewUrl).toBe('http://second.com')
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('sets an empty string URL', () => {
    useAppStore.getState().setPreviewUrl('')
    expect(useAppStore.getState().previewUrl).toBe('')
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('opening panel via setPreviewUrl also opens panel when it was closed', () => {
    useAppStore.setState({ previewOpen: false, previewUrl: 'old' })
    useAppStore.getState().setPreviewUrl('new')
    expect(useAppStore.getState().previewOpen).toBe(true)
    expect(useAppStore.getState().previewUrl).toBe('new')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  setSessionFilter
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — setSessionFilter', () => {
  it('sets a model filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'claude-3' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'model', value: 'claude-3' })
  })

  it('sets a status filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'status', value: 'completed' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'status', value: 'completed' })
  })

  it('sets a keyword filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'keyword', value: 'refactor' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'keyword', value: 'refactor' })
  })

  it('sets a tag filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'tag', value: 'bugfix' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'tag', value: 'bugfix' })
  })

  it('clears filter by setting null', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt-4o' })
    useAppStore.getState().setSessionFilter(null)
    expect(useAppStore.getState().sessionFilter).toBeNull()
  })

  it('replaces an existing filter with a different type', () => {
    useAppStore.getState().setSessionFilter({ type: 'model', value: 'gpt-4o' })
    useAppStore.getState().setSessionFilter({ type: 'status', value: 'idle' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'status', value: 'idle' })
  })

  it('replaces a tag filter with another tag filter', () => {
    useAppStore.getState().setSessionFilter({ type: 'tag', value: 'alpha' })
    useAppStore.getState().setSessionFilter({ type: 'tag', value: 'beta' })
    expect(useAppStore.getState().sessionFilter).toEqual({ type: 'tag', value: 'beta' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  setSessionSort
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — setSessionSort', () => {
  it('sorts by recent ascending', () => {
    useAppStore.getState().setSessionSort({ by: 'recent', asc: true })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'recent', asc: true })
  })

  it('sorts by recent descending (default)', () => {
    useAppStore.getState().setSessionSort({ by: 'recent', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'recent', asc: false })
  })

  it('sorts by name ascending', () => {
    useAppStore.getState().setSessionSort({ by: 'name', asc: true })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'name', asc: true })
  })

  it('sorts by name descending', () => {
    useAppStore.getState().setSessionSort({ by: 'name', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'name', asc: false })
  })

  it('sorts by duration ascending', () => {
    useAppStore.getState().setSessionSort({ by: 'duration', asc: true })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'duration', asc: true })
  })

  it('sorts by duration descending', () => {
    useAppStore.getState().setSessionSort({ by: 'duration', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'duration', asc: false })
  })

  it('sorts by messages ascending', () => {
    useAppStore.getState().setSessionSort({ by: 'messages', asc: true })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'messages', asc: true })
  })

  it('sorts by messages descending', () => {
    useAppStore.getState().setSessionSort({ by: 'messages', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'messages', asc: false })
  })

  it('toggles asc flag between successive calls', () => {
    useAppStore.getState().setSessionSort({ by: 'name', asc: true })
    useAppStore.getState().setSessionSort({ by: 'name', asc: false })
    expect(useAppStore.getState().sessionSort).toEqual({ by: 'name', asc: false })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  setLastExecCommand
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — setLastExecCommand', () => {
  it('stores a command', () => {
    useAppStore.getState().setLastExecCommand('ls -la')
    expect(useAppStore.getState().lastExecCommand).toBe('ls -la')
  })

  it('overwrites a previous command', () => {
    useAppStore.getState().setLastExecCommand('git status')
    useAppStore.getState().setLastExecCommand('npm run build')
    expect(useAppStore.getState().lastExecCommand).toBe('npm run build')
  })

  it('stores an empty string', () => {
    useAppStore.getState().setLastExecCommand('test')
    useAppStore.getState().setLastExecCommand('')
    expect(useAppStore.getState().lastExecCommand).toBe('')
  })

  it('stores a multi-line command string', () => {
    const cmd = 'echo "line1"\necho "line2"'
    useAppStore.getState().setLastExecCommand(cmd)
    expect(useAppStore.getState().lastExecCommand).toBe(cmd)
  })

  it('initial state is null', () => {
    expect(useAppStore.getState().lastExecCommand).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  openSessionTab
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — openSessionTab', () => {
  it('adds a session tab and sets activeTabId', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'My Session' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual(
      expect.objectContaining({ type: 'session', id: 's1', title: 'My Session' })
    )
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('sets activeView to chat when opening session tab', () => {
    useAppStore.setState({ activeView: 'git' })
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('does not duplicate existing session tab', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'V1' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'V2' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual(
      expect.objectContaining({ id: 's1', title: 'V1' })
    )
  })

  it('still sets activeTabId to the same id when opening duplicate', () => {
    useAppStore.setState({ tabs: [{ type: 'session', id: 's2', title: 'Other' }], activeTabId: 's2' })
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().activeTabId).toBe('s1')
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('can open multiple different session tabs in order', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1', title: 'First' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's2', title: 'Second' }))
    useAppStore.getState().openSessionTab(mkSession({ id: 's3', title: 'Third' }))
    expect(useAppStore.getState().tabs).toHaveLength(3)
    expect(useAppStore.getState().tabs.map((t) => t.type === 'session' ? t.id : null)).toEqual(['s1', 's2', 's3'])
  })

  it('activeTabId is always set to the newly opened session', () => {
    useAppStore.getState().openSessionTab(mkSession({ id: 's1' }))
    expect(useAppStore.getState().activeTabId).toBe('s1')
    useAppStore.getState().openSessionTab(mkSession({ id: 's2' }))
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  openFileTab
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — openFileTab', () => {
  it('adds a file tab with correct properties', () => {
    useAppStore.getState().openFileTab(mkFileNode({ name: 'app.tsx', path: '/src/app.tsx' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual({
      type: 'file',
      path: '/src/app.tsx',
      name: 'app.tsx',
      isDirty: false,
    })
    expect(useAppStore.getState().activeTabId).toBe('/src/app.tsx')
  })

  it('does not deduplicate when paths are different', () => {
    useAppStore.getState().openFileTab(mkFileNode({ name: 'a.ts', path: '/a.ts' }))
    useAppStore.getState().openFileTab(mkFileNode({ name: 'b.ts', path: '/b.ts' }))
    expect(useAppStore.getState().tabs).toHaveLength(2)
  })

  it('deduplicates by exact path match', () => {
    useAppStore.getState().openFileTab(mkFileNode({ name: 'first.ts', path: '/lib/file.ts' }))
    useAppStore.getState().openFileTab(mkFileNode({ name: 'second.ts', path: '/lib/file.ts' }))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    // First open wins the name
    expect(useAppStore.getState().tabs[0]).toEqual(
      expect.objectContaining({ name: 'first.ts', path: '/lib/file.ts' })
    )
  })

  it('sets activeTabId to the file path', () => {
    useAppStore.getState().openFileTab(mkFileNode({ path: '/deep/nested/file.ts' }))
    expect(useAppStore.getState().activeTabId).toBe('/deep/nested/file.ts')
  })

  it('does not switch activeView for file tabs', () => {
    useAppStore.setState({ activeView: 'git' })
    useAppStore.getState().openFileTab(mkFileNode({ path: '/file.ts' }))
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('initially sets isDirty to false', () => {
    useAppStore.getState().openFileTab(mkFileNode({ path: '/file.ts' }))
    const tab = useAppStore.getState().tabs[0]
    expect(tab.type).toBe('file')
    if (tab.type === 'file') expect(tab.isDirty).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  selectTab
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — selectTab', () => {
  it('switches activeTabId to session tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'A' },
        { type: 'session', id: 's2', title: 'B' },
      ],
      activeTabId: 's1',
    })
    useAppStore.getState().selectTab('s2')
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('switches activeTabId to file tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().selectTab('/b.ts')
    expect(useAppStore.getState().activeTabId).toBe('/b.ts')
  })

  it('sets activeView to chat for session tab', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'A' }],
      activeView: 'settings',
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('does not change activeView for file tab', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/f.ts', name: 'f.ts', isDirty: false }],
      activeView: 'git',
    })
    useAppStore.getState().selectTab('/f.ts')
    expect(useAppStore.getState().activeView).toBe('git')
  })

  it('selecting a non-existent tab does not crash', () => {
    expect(() => useAppStore.getState().selectTab('nonexistent')).not.toThrow()
  })

  it('selecting a non-existent tab still sets activeTabId', () => {
    useAppStore.getState().selectTab('ghost')
    expect(useAppStore.getState().activeTabId).toBe('ghost')
  })

  it('switches between session and file tabs updates view appropriately', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Session' },
        { type: 'file', path: '/f.ts', name: 'f.ts', isDirty: false },
      ],
      activeView: 'extensions',
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
    useAppStore.getState().selectTab('/f.ts')
    expect(useAppStore.getState().activeView).toBe('chat') // doesn't change, only session tabs set it
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  setTabDirty
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — setTabDirty', () => {
  it('marks a file tab dirty', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/src/main.ts', name: 'main.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/src/main.ts', true)
    const tab = useAppStore.getState().tabs[0]
    if (tab.type === 'file') expect(tab.isDirty).toBe(true)
  })

  it('marks a file tab clean', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/src/main.ts', name: 'main.ts', isDirty: true }],
    })
    useAppStore.getState().setTabDirty('/src/main.ts', false)
    const tab = useAppStore.getState().tabs[0]
    if (tab.type === 'file') expect(tab.isDirty).toBe(false)
  })

  it('only affects the matching path among multiple file tabs', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file', path: '/c.ts', name: 'c.ts', isDirty: false },
      ],
    })
    useAppStore.getState().setTabDirty('/b.ts', true)
    const tabs = useAppStore.getState().tabs
    expect((tabs[0] as any).isDirty).toBe(false)
    expect((tabs[1] as any).isDirty).toBe(true)
    expect((tabs[2] as any).isDirty).toBe(false)
  })

  it('no-ops for non-existent path', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/existing.ts', name: 'existing.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/missing.ts', true)
    expect((useAppStore.getState().tabs[0] as any).isDirty).toBe(false)
  })

  it('does not affect session tabs', () => {
    useAppStore.setState({
      tabs: [{ type: 'session', id: 's1', title: 'Session' } as any],
    })
    useAppStore.getState().setTabDirty('s1', true)
    expect(useAppStore.getState().tabs[0]).not.toHaveProperty('isDirty')
  })

  it('toggling dirty state multiple times works correctly', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/f.ts', name: 'f.ts', isDirty: false }],
    })
    useAppStore.getState().setTabDirty('/f.ts', true)
    useAppStore.getState().setTabDirty('/f.ts', false)
    useAppStore.getState().setTabDirty('/f.ts', true)
    const tab = useAppStore.getState().tabs[0]
    if (tab.type === 'file') expect(tab.isDirty).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  renameTabPaths
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — renameTabPaths', () => {
  it('renames a single file tab path and name', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/src/old.ts', name: 'old.ts', isDirty: false }],
      activeTabId: '/src/old.ts',
    })
    useAppStore.getState().renameTabPaths('/src/old.ts', '/src/renamed.ts', 'renamed.ts')
    const tab = useAppStore.getState().tabs[0]
    if (tab.type === 'file') {
      expect(tab.path).toBe('/src/renamed.ts')
      expect(tab.name).toBe('renamed.ts')
    }
    expect(useAppStore.getState().activeTabId).toBe('/src/renamed.ts')
  })

  it('renames directory children recursively', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/old/index.ts', name: 'index.ts', isDirty: false },
        { type: 'file', path: '/old/lib/util.ts', name: 'util.ts', isDirty: false },
        { type: 'file', path: '/other/stay.ts', name: 'stay.ts', isDirty: false },
      ],
      activeTabId: '/old/index.ts',
    })
    useAppStore.getState().renameTabPaths('/old', '/new', 'new')
    const tabs = useAppStore.getState().tabs
    if (tabs[0].type === 'file') expect(tabs[0].path).toBe('/new/index.ts')
    if (tabs[1].type === 'file') expect(tabs[1].path).toBe('/new/lib/util.ts')
    if (tabs[2].type === 'file') expect(tabs[2].path).toBe('/other/stay.ts')
    expect(useAppStore.getState().activeTabId).toBe('/new/index.ts')
  })

  it('updates activeTabId when a child tab is active', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/dir/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/dir/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/dir/b.ts',
    })
    useAppStore.getState().renameTabPaths('/dir', '/renamed', 'renamed')
    expect(useAppStore.getState().activeTabId).toBe('/renamed/b.ts')
  })

  it('no-ops when path does not match any tab', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/keep.ts', name: 'keep.ts', isDirty: false }],
    })
    useAppStore.getState().renameTabPaths('/nope.ts', '/nah.ts', 'nah.ts')
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/keep.ts')
  })

  it('preserves isDirty flag during rename', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/old.ts', name: 'old.ts', isDirty: true }],
    })
    useAppStore.getState().renameTabPaths('/old.ts', '/new.ts', 'new.ts')
    const tab = useAppStore.getState().tabs[0]
    if (tab.type === 'file') expect(tab.isDirty).toBe(true)
  })

  it('does not affect session tabs during rename', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Session' },
        { type: 'file', path: '/dir/file.ts', name: 'file.ts', isDirty: false },
      ],
    })
    useAppStore.getState().renameTabPaths('/dir', '/newdir', 'newdir')
    const sessionTab = useAppStore.getState().tabs[0]
    expect(sessionTab).toEqual(expect.objectContaining({ type: 'session', id: 's1' }))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  removeTabsByPath
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — removeTabsByPath', () => {
  it('removes a single file tab by exact path', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/src/main.ts', name: 'main.ts', isDirty: false },
        { type: 'file', path: '/src/util.ts', name: 'util.ts', isDirty: false },
      ],
      activeTabId: '/src/main.ts',
    })
    useAppStore.getState().removeTabsByPath('/src/main.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/src/util.ts')
  })

  it('removes directory tabs recursively', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/proj/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/proj/src/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file', path: '/proj/test.ts', name: 'test.ts', isDirty: false },
      ],
      activeTabId: '/proj/src/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/proj/src', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/proj/test.ts')
  })

  it('falls back to last remaining tab when active is removed', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/a.ts', false)
    expect(useAppStore.getState().activeTabId).toBe('/b.ts')
  })

  it('sets activeTabId to null when all tabs removed', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/only.ts', name: 'only.ts', isDirty: false }],
      activeTabId: '/only.ts',
    })
    useAppStore.getState().removeTabsByPath('/only.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('no-ops when path matches no tabs', () => {
    useAppStore.setState({
      tabs: [{ type: 'file', path: '/existing.ts', name: 'existing.ts', isDirty: false }],
      activeTabId: '/existing.ts',
    })
    useAppStore.getState().removeTabsByPath('/ghost.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('/existing.ts')
  })

  it('does not remove session tabs when removing by file path', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 's1', title: 'Session' },
        { type: 'file', path: '/remove.ts', name: 'remove.ts', isDirty: false },
      ],
      activeTabId: '/remove.ts',
    })
    useAppStore.getState().removeTabsByPath('/remove.ts', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().tabs[0]).toEqual(expect.objectContaining({ type: 'session', id: 's1' }))
  })

  it('does not remove tabs outside the directory when isDir is true', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/proj/src/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/proj/lib/b.ts', name: 'b.ts', isDirty: false },
      ],
    })
    useAppStore.getState().removeTabsByPath('/proj/src', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect((useAppStore.getState().tabs[0] as any).path).toBe('/proj/lib/b.ts')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  navigatePromptHistory
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — navigatePromptHistory', () => {
  it('returns null for empty history', () => {
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBeNull()
  })

  it('navigates up from initial -1 to most recent entry', () => {
    useAppStore.getState().addPromptToHistory('first')
    useAppStore.getState().addPromptToHistory('second')
    // promptHistory = ['second', 'first'], idx = -1
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBe('second')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
  })

  it('navigates up through all entries', () => {
    useAppStore.getState().addPromptToHistory('a')
    useAppStore.getState().addPromptToHistory('b')
    useAppStore.getState().addPromptToHistory('c')
    // promptHistory = ['c', 'b', 'a']

    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('c') // idx 0
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('b') // idx 1
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('a') // idx 2
  })

  it('caps at the last entry when navigating up', () => {
    useAppStore.getState().addPromptToHistory('only')
    useAppStore.getState().navigatePromptHistory('up') // idx 0
    useAppStore.getState().navigatePromptHistory('up') // capped at 0
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
  })

  it('navigates down back to empty string', () => {
    useAppStore.getState().addPromptToHistory('first')
    useAppStore.getState().addPromptToHistory('second')
    useAppStore.getState().navigatePromptHistory('up') // idx 0 → 'second'
    useAppStore.getState().navigatePromptHistory('up') // idx 1 → 'first'
    const result = useAppStore.getState().navigatePromptHistory('down') // idx 0 → 'second'
    expect(result).toBe('second')
  })

  it('navigates down to empty string at -1', () => {
    useAppStore.getState().addPromptToHistory('hello')
    useAppStore.getState().navigatePromptHistory('up') // idx 0
    const result = useAppStore.getState().navigatePromptHistory('down') // idx -1
    expect(result).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('down from -1 stays at -1 and returns empty', () => {
    useAppStore.getState().addPromptToHistory('item')
    // idx is already -1
    const result = useAppStore.getState().navigatePromptHistory('down')
    expect(result).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('wraps correctly through full up-down cycle', () => {
    useAppStore.getState().addPromptToHistory('p1')
    useAppStore.getState().addPromptToHistory('p2')
    // promptHistory = ['p2', 'p1']

    // Up through everything
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('p2')
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('p1')
    // Capped at end
    expect(useAppStore.getState().navigatePromptHistory('up')).toBe('p1')

    // Down through everything
    expect(useAppStore.getState().navigatePromptHistory('down')).toBe('p2')
    expect(useAppStore.getState().navigatePromptHistory('down')).toBe('')
    // Stays at -1
    expect(useAppStore.getState().navigatePromptHistory('down')).toBe('')
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('returns null on both up and down for empty history', () => {
    expect(useAppStore.getState().navigatePromptHistory('up')).toBeNull()
    expect(useAppStore.getState().navigatePromptHistory('down')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  resetPromptHistoryIdx
// ═══════════════════════════════════════════════════════════════════════════════

describe('store — resetPromptHistoryIdx', () => {
  it('resets idx to -1 from a positive value', () => {
    useAppStore.getState().addPromptToHistory('item1')
    useAppStore.getState().navigatePromptHistory('up')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
    useAppStore.getState().resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('resets idx to -1 from the last entry', () => {
    useAppStore.getState().addPromptToHistory('a')
    useAppStore.getState().addPromptToHistory('b')
    useAppStore.getState().navigatePromptHistory('up')
    useAppStore.getState().navigatePromptHistory('up')
    expect(useAppStore.getState().promptHistoryIdx).toBe(1)
    useAppStore.getState().resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('is a no-op when already -1', () => {
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
    useAppStore.getState().resetPromptHistoryIdx()
    expect(useAppStore.getState().promptHistoryIdx).toBe(-1)
  })

  it('after reset, up navigation starts from the beginning again', () => {
    useAppStore.getState().addPromptToHistory('first')
    useAppStore.getState().addPromptToHistory('second')
    useAppStore.getState().navigatePromptHistory('up')
    useAppStore.getState().navigatePromptHistory('up')
    useAppStore.getState().resetPromptHistoryIdx()
    // Should start fresh at most recent
    const result = useAppStore.getState().navigatePromptHistory('up')
    expect(result).toBe('second')
    expect(useAppStore.getState().promptHistoryIdx).toBe(0)
  })
})
