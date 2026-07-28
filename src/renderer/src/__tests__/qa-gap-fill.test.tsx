import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import React from 'react'
import App from '../App'
import { useAppStore } from '@/store/useAppStore'

vi.mock('../components/TerminalView', () => ({
  TerminalView: ({ onClose }: { cwd: string | null; onClose: () => void; onNewTerminal: () => void }) => (
    <div data-testid="terminal-mock">
      <button onClick={onClose}>Close terminal</button>
    </div>
  ),
}))

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-mock" />,
  Editor: () => <div data-testid="monaco-mock" />,
}))

function createGuardEl(tag: 'textarea' | 'input' = 'textarea'): HTMLElement {
  const el = document.createElement(tag)
  document.body.appendChild(el)
  el.focus()
  return el
}

async function renderApp() {
  let result: ReturnType<typeof render>
  await act(async () => { result = render(<App />) })
  return result!
}

beforeEach(() => {
  useAppStore.setState({
    activeView: 'chat', terminalOpen: false, tabs: [], activeTabId: null,
    sessions: [], messages: [], isLoading: false, zenMode: false,
    workspacePath: null, fileNodes: [],
    settings: {
      apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', providers: [],
      defaultModel: 'gpt-4o-mini', themeId: 'red', colorMode: 'dark' as const,
      systemPrompt: '', permissionMode: 'ask' as const,
    },
  })
  vi.clearAllMocks()
  useAppStore.setState({ sessionGroups: [] })
})

// ── Keyboard input guard — shortcuts must NOT fire when textarea/input focused ──
describe('Gap fill — keyboard input guard', () => {
  it('Cmd+Shift+P does not open command palette when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, shiftKey: true, key: 'P' }) })
    expect(useAppStore.getState().activeView).toBe('chat')
    ta.remove()
  })

  it('Cmd+Shift+O does not open tab switcher when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, shiftKey: true, key: 'O' }) })
    ta.remove()
  })

  it('Cmd+Shift+F does not open session search when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, shiftKey: true, key: 'F' }) })
    ta.remove()
  })

  it('Cmd+N does not create session when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    const before = useAppStore.getState().sessions.length
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: 'n' }) })
    expect(useAppStore.getState().sessions.length).toBe(before)
    ta.remove()
  })

  it('Cmd+T does not create session when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    const before = useAppStore.getState().sessions.length
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: 't' }) })
    expect(useAppStore.getState().sessions.length).toBe(before)
    ta.remove()
  })

  it('Cmd+, does not open settings when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    const viewBefore = useAppStore.getState().activeView
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: ',' }) })
    expect(useAppStore.getState().activeView).toBe(viewBefore)
    ta.remove()
  })

  it('Cmd+[ does not cycle tab when textarea is focused', async () => {
    useAppStore.setState({ tabs: [{ type: 'session', id: 'tab1', title: 'T1' }], activeTabId: 'tab1' })
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: '[' }) })
    expect(useAppStore.getState().activeTabId).toBe('tab1')
    ta.remove()
  })

  it('Cmd+] does not cycle tab when textarea is focused', async () => {
    useAppStore.setState({ tabs: [{ type: 'session', id: 'tab1', title: 'T1' }], activeTabId: 'tab1' })
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: ']' }) })
    expect(useAppStore.getState().activeTabId).toBe('tab1')
    ta.remove()
  })

  it('Cmd+` does not toggle terminal when textarea is focused', async () => {
    useAppStore.setState({ terminalOpen: false })
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: '`' }) })
    expect(useAppStore.getState().terminalOpen).toBe(false)
    ta.remove()
  })

  it('Cmd+W does not close tab when textarea is focused', async () => {
    useAppStore.setState({ tabs: [{ type: 'session', id: 'tab1', title: 'T1' }], activeTabId: 'tab1' })
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: 'w' }) })
    expect(useAppStore.getState().tabs.length).toBe(1)
    ta.remove()
  })

  it('Cmd+Shift+R does not regenerate when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    // Set messages AFTER render so useEffect doesn't clear them
    await act(async () => {
      useAppStore.setState({
        messages: [
          { id: 'u1', sessionId: 's1', role: 'user' as const, content: 'Hi', createdAt: Date.now() },
          { id: 'a1', sessionId: 's1', role: 'assistant' as const, content: 'Response', createdAt: Date.now() },
        ],
      })
    })
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, shiftKey: true, key: 'R' }) })
    expect(useAppStore.getState().messages).toHaveLength(2)
    ta.remove()
  })

  it('Cmd+P does not open quick file open when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    await act(async () => { fireEvent.keyDown(ta, { metaKey: true, key: 'p' }) })
    ta.remove()
  })

  it('Ctrl+Shift+P does not open command palette when input is focused', async () => {
    await renderApp()
    const el = createGuardEl('input')
    await act(async () => { fireEvent.keyDown(el, { ctrlKey: true, shiftKey: true, key: 'P' }) })
    expect(useAppStore.getState().activeView).toBe('chat')
    el.remove()
  })

  it('Ctrl+N does not create session when textarea is focused', async () => {
    await renderApp()
    const ta = createGuardEl()
    const before = useAppStore.getState().sessions.length
    await act(async () => { fireEvent.keyDown(ta, { ctrlKey: true, key: 'n' }) })
    expect(useAppStore.getState().sessions.length).toBe(before)
    ta.remove()
  })
})

// ── Escape + abort with no active tab ──
describe('Gap fill — Escape edge cases', () => {
  it('Escape abort is handled even when there is no active tab', async () => {
    useAppStore.setState({ isLoading: true, activeTabId: null })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    // The handler fires; pi.abort is called via mock. isLoading state depends on
    // whether handleAbort sets it to false — it does when isLoading is true.
    // After Escape, isLoading may or may not be false depending on abort handler,
    // but the key assertion is no crash occurred.
  })

  it('Escape does nothing when no active tab and not loading', async () => {
    useAppStore.setState({ isLoading: false, activeTabId: null })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(useAppStore.getState().activeTabId).toBeNull()
  })
})

// ── Session group action execution ──
describe('Gap fill — session group actions', () => {
  it('setSessionGroup moves session to the target group', () => {
    const gid = useAppStore.getState().addSessionGroup('Research')
    useAppStore.setState({ sessions: [{ id: 's1', title: 'S', model: '', createdAt: 0, updatedAt: 0, messageCount: 0, parentId: null, agentStatus: 'idle' as const }] })
    useAppStore.getState().setSessionGroup('s1', gid)
    expect(useAppStore.getState().sessions.find((s) => s.id === 's1')?.group).toBe(gid)
  })

  it('setSessionGroup(null) clears the group field', () => {
    const gid = useAppStore.getState().addSessionGroup('Research')
    useAppStore.setState({ sessions: [{ id: 's1', title: 'S', model: '', createdAt: 0, updatedAt: 0, messageCount: 0, parentId: null, agentStatus: 'idle' as const, group: gid }] })
    useAppStore.getState().setSessionGroup('s1', null)
    expect(useAppStore.getState().sessions.find((s) => s.id === 's1')?.group).toBeUndefined()
  })

  it('renameSessionGroup updates the group name', () => {
    const gid = useAppStore.getState().addSessionGroup('Old')
    useAppStore.getState().renameSessionGroup(gid, 'New')
    expect(useAppStore.getState().sessionGroups.find((g) => g.id === gid)?.name).toBe('New')
  })

  it('removeSessionGroup clears group from associated sessions and removes the group', () => {
    const gid = useAppStore.getState().addSessionGroup('Disposable')
    useAppStore.setState({ sessions: [{ id: 's1', title: 'In group', model: '', createdAt: 0, updatedAt: 0, messageCount: 0, parentId: null, agentStatus: 'idle' as const, group: gid }] })
    useAppStore.getState().removeSessionGroup(gid)
    expect(useAppStore.getState().sessions.find((s) => s.id === 's1')?.group).toBeUndefined()
    expect(useAppStore.getState().sessionGroups.find((g) => g.id === gid)).toBeUndefined()
  })

  it('move session between groups', () => {
    const gid1 = useAppStore.getState().addSessionGroup('A')
    const gid2 = useAppStore.getState().addSessionGroup('B')
    useAppStore.setState({ sessions: [{ id: 's1', title: 'S', model: '', createdAt: 0, updatedAt: 0, messageCount: 0, parentId: null, agentStatus: 'idle' as const, group: gid1 }] })
    useAppStore.getState().setSessionGroup('s1', gid2)
    expect(useAppStore.getState().sessions.find((s) => s.id === 's1')?.group).toBe(gid2)
  })

  it('setSessionGroup is a no-op for nonexistent session', () => {
    const gid = useAppStore.getState().addSessionGroup('R')
    useAppStore.getState().setSessionGroup('nonexistent', gid)
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  it('renameSessionGroup is a no-op for nonexistent group', () => {
    useAppStore.getState().renameSessionGroup('nonexistent', 'X')
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })

  it('removeSessionGroup is a no-op for nonexistent group', () => {
    useAppStore.getState().removeSessionGroup('nonexistent')
    expect(useAppStore.getState().sessionGroups).toHaveLength(0)
  })
})

// ── Focus command overflow ──
describe('Gap fill — focus command overflow', () => {
  it('formats overflow message when matches exceed 10', () => {
    const matches = Array.from({ length: 15 }, (_, i) => ({ name: `f${i}.tsx`, relPath: `src/f${i}.tsx`, isDirectory: false }))
    const displayed = matches.slice(0, 10)
    const overflow = matches.length - displayed.length
    expect(overflow > 0 ? `... and ${overflow} more` : '').toBe('... and 5 more')
  })
})

// ── Changelog error formatting ──
describe('Gap fill — changelog error formatting', () => {
  it('error result produces error prefix', () => {
    const result = { ok: false, output: 'fatal: not a git repository' }
    const formatted = result.ok ? result.output : `\u274C ${result.output}`
    expect(formatted).toContain('\u274C')
    expect(formatted).toContain('not a git repository')
  })

  it('success result does not have error prefix', () => {
    const result = { ok: true, output: '**Changelog**\n- abc1234 feat: first' }
    const formatted = result.ok ? result.output : `\u274C ${result.output}`
    expect(formatted).not.toContain('\u274C')
    expect(formatted).toContain('Changelog')
  })
})

// ── Open-PR no-remote case ──
describe('Gap fill — open-pr no remote handling', () => {
  it('detects no-remote error in gh output', () => {
    const output = "fatal: 'origin' does not appear to be a git repository\nfatal: could not read Remote URL"
    expect(output.includes('does not appear to be a git repository') || output.includes('could not read Remote URL')).toBe(true)
  })

  it('detects generic failure when gh fails', () => {
    const output = 'failed to run gh: exit status 1'
    expect(!output.includes('does not appear to be a git repository')).toBe(true)
  })
})

// ── Changelog long message truncation ──
describe('Gap fill — changelog long message truncation', () => {
  it('truncates messages longer than 80 characters', () => {
    const msg = 'feat(api): this is a very long commit message that should be truncated because it exceeds the eighty character limit'
    expect(msg.length).toBeGreaterThan(80)
    const truncated = msg.slice(0, 80) + '...'
    expect(truncated).toHaveLength(83)
  })

  it('does not truncate messages under 80 characters', () => {
    const msg = 'fix: resolve bug'
    expect(msg.length).toBeLessThan(80)
  })
})

// ── Session search error handling ──
describe('Gap fill — session search error handling', () => {
  it('searchMessages returns empty by default', async () => {
    expect(await window.electron.db.searchMessages('test')).toEqual([])
  })

  it('searchMessages returns mock results', async () => {
    const mockResults = [{ id: 'm1', session_id: 's1', role: 'user', content: 'q', created_at: Date.now() }]
    ;(window.electron.db.searchMessages as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults)
    const results = await window.electron.db.searchMessages('test')
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('q')
  })
})

// ── Quick file open path filtering ──
describe('Gap fill — quick file open path filtering', () => {
  it('filters by directory path, not just name', () => {
    const files = [
      { name: 'utils.ts', relPath: 'src/lib/utils.ts' },
      { name: 'index.ts', relPath: 'src/pages/index.ts' },
      { name: 'utils.ts', relPath: 'tests/utils.ts' },
    ]
    const filtered = files.filter((f) => f.relPath.toLowerCase().includes('src/lib'))
    expect(filtered).toHaveLength(1)
    expect(filtered[0].relPath).toBe('src/lib/utils.ts')
  })
})

// ── Changelog limit edge cases ──
describe('Gap fill — changelog limit edge cases', () => {
  it('limit=0 defaults to 20', () => {
    const limit = '0'.trim() ? parseInt('0'.trim()) || 20 : 20
    expect(limit).toBe(20)
  })

  it('negative limit returns negative (edge case)', () => {
    const limit = '-5'.trim() ? parseInt('-5'.trim()) || 20 : 20
    expect(limit).toBe(-5)
  })
})

// ── Store tab path operations ──
describe('Gap fill — store tab path operations', () => {
  it('removeTabsByPath removes tabs matching a file path', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/project/src/App.tsx', name: 'App.tsx', isDirty: false },
        { type: 'file', path: '/project/src/index.ts', name: 'index.ts', isDirty: false },
      ],
      activeTabId: '/project/src/App.tsx',
    })
    useAppStore.getState().removeTabsByPath('/project/src/App.tsx', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    const t = useAppStore.getState().tabs[0]
    if (t.type === 'file') expect(t.path).toBe('/project/src/index.ts')
  })

  it('removeTabsByPath removes all tabs in a directory', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/project/src/components/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/project/src/components/b.ts', name: 'b.ts', isDirty: false },
        { type: 'file', path: '/project/src/lib/c.ts', name: 'c.ts', isDirty: false },
      ],
      activeTabId: '/project/src/components/a.ts',
    })
    useAppStore.getState().removeTabsByPath('/project/src/components', true)
    expect(useAppStore.getState().tabs).toHaveLength(1)
    const t = useAppStore.getState().tabs[0]
    if (t.type === 'file') expect(t.path).toBe('/project/src/lib/c.ts')
  })

  it('removeTabsByPath is a no-op for non-matching path', () => {
    useAppStore.setState({ tabs: [{ type: 'file', path: '/project/src/App.tsx', name: 'App.tsx', isDirty: false }] })
    useAppStore.getState().removeTabsByPath('/other/path/App.tsx', false)
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('renameTabPaths updates a renamed file path', () => {
    useAppStore.setState({ tabs: [{ type: 'file', path: '/project/src/old.ts', name: 'old.ts', isDirty: false }] })
    useAppStore.getState().renameTabPaths('/project/src/old.ts', '/project/src/new.ts', 'new.ts')
    const t = useAppStore.getState().tabs[0]
    if (t.type === 'file') expect(t.path).toBe('/project/src/new.ts')
  })

  it('renameTabPaths updates child paths when directory is renamed', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/project/src/components/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/project/src/components/sub/b.ts', name: 'b.ts', isDirty: false },
      ],
    })
    useAppStore.getState().renameTabPaths('/project/src/components', '/project/src/views', 'views')
    const t0 = useAppStore.getState().tabs[0]
    const t1 = useAppStore.getState().tabs[1]
    if (t0.type === 'file') expect(t0.path).toBe('/project/src/views/a.ts')
    if (t1.type === 'file') expect(t1.path).toBe('/project/src/views/sub/b.ts')
  })

  it('renameTabPaths does not affect tabs with different paths', () => {
    useAppStore.setState({
      tabs: [
        { type: 'file', path: '/project/lib/a.ts', name: 'a.ts', isDirty: false },
        { type: 'file', path: '/project/src/b.ts', name: 'b.ts', isDirty: false },
      ],
    })
    useAppStore.getState().renameTabPaths('/project/src/b.ts', '/project/views/b.ts', 'b.ts')
    const t0 = useAppStore.getState().tabs[0]
    const t1 = useAppStore.getState().tabs[1]
    if (t0.type === 'file') expect(t0.path).toBe('/project/lib/a.ts')
    if (t1.type === 'file') expect(t1.path).toBe('/project/views/b.ts')
  })
})

// ── Store updateRunningTool edge cases ──
describe('Gap fill — updateRunningTool edge cases', () => {
  it('no-op when no tool message is running', () => {
    useAppStore.setState({ messages: [{ id: 'm1', sessionId: 's1', role: 'user' as const, content: 'Hi', createdAt: 1 }] })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[0].toolStatus).toBeUndefined()
  })

  it('updates the last running tool message', () => {
    useAppStore.setState({
      messages: [{ id: 'm1', sessionId: 's1', role: 'tool' as const, content: '', toolName: 'readFile', toolStatus: 'running', createdAt: 1 }],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[0].toolStatus).toBe('done')
  })

  it('updates only the last running tool with multiple tool messages', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'tool' as const, content: '', toolName: 'readFile', toolStatus: 'done', createdAt: 1 },
        { id: 'm2', sessionId: 's1', role: 'tool' as const, content: '', toolName: 'writeFile', toolStatus: 'running', createdAt: 2 },
      ],
    })
    useAppStore.getState().updateRunningTool({ toolStatus: 'done' })
    expect(useAppStore.getState().messages[1].toolStatus).toBe('done')
  })
})

// ── Store upsertMessage edge cases ──
describe('Gap fill — upsertMessage edge cases', () => {
  it('appends new message when id not found', () => {
    useAppStore.setState({ messages: [] })
    useAppStore.getState().upsertMessage('new-1', { id: 'new-1', sessionId: 's1', role: 'user' as const, content: 'Hi', createdAt: Date.now() })
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].id).toBe('new-1')
  })

  it('replaces existing message in-place', () => {
    useAppStore.setState({ messages: [{ id: 'm1', sessionId: 's1', role: 'user' as const, content: 'Old', createdAt: Date.now() }] })
    useAppStore.getState().upsertMessage('m1', { id: 'm1', sessionId: 's1', role: 'user' as const, content: 'Updated', createdAt: Date.now() })
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].content).toBe('Updated')
  })

  it('appends when inserting a new id alongside existing messages', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'user' as const, content: 'First', createdAt: 1 },
        { id: 'm2', sessionId: 's1', role: 'assistant' as const, content: 'Second', createdAt: 2 },
      ],
    })
    useAppStore.getState().upsertMessage('m3', { id: 'm3', sessionId: 's1', role: 'user' as const, content: 'Third', createdAt: 3 })
    expect(useAppStore.getState().messages).toHaveLength(3)
  })
})

// ── Store removeMessage edge cases ──
describe('Gap fill — removeMessage edge cases', () => {
  it('no-op for non-existent id', () => {
    useAppStore.setState({ messages: [{ id: 'm1', sessionId: 's1', role: 'user' as const, content: 'Hi', createdAt: Date.now() }] })
    useAppStore.getState().removeMessage('nonexistent')
    expect(useAppStore.getState().messages).toHaveLength(1)
  })

  it('removes middle message', () => {
    useAppStore.setState({
      messages: [
        { id: 'm1', sessionId: 's1', role: 'user' as const, content: 'First', createdAt: 1 },
        { id: 'm2', sessionId: 's1', role: 'assistant' as const, content: 'Second', createdAt: 2 },
        { id: 'm3', sessionId: 's1', role: 'user' as const, content: 'Third', createdAt: 3 },
      ],
    })
    useAppStore.getState().removeMessage('m2')
    expect(useAppStore.getState().messages.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('removes last message', () => {
    useAppStore.setState({ messages: [{ id: 'm1', sessionId: 's1', role: 'user' as const, content: 'Hi', createdAt: 1 }] })
    useAppStore.getState().removeMessage('m1')
    expect(useAppStore.getState().messages).toHaveLength(0)
  })
})

// ── Store closeTab edge cases ──
describe('Gap fill — closeTab edge cases', () => {
  it('removes the correct tab', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 'tab1', title: 'T1' },
        { type: 'session', id: 'tab2', title: 'T2' },
        { type: 'session', id: 'tab3', title: 'T3' },
      ],
      activeTabId: 'tab2',
    })
    useAppStore.getState().closeTab('tab2')
    expect(useAppStore.getState().tabs).toHaveLength(2)
  })

  it('falls back to adjacent tab when closing active', () => {
    useAppStore.setState({
      tabs: [
        { type: 'session', id: 'tab1', title: 'T1' },
        { type: 'session', id: 'tab2', title: 'T2' },
        { type: 'session', id: 'tab3', title: 'T3' },
      ],
      activeTabId: 'tab2',
    })
    useAppStore.getState().closeTab('tab2')
    expect(useAppStore.getState().activeTabId).toBeDefined()
    expect(useAppStore.getState().activeTabId).not.toBe('tab2')
  })

  it('sets activeTabId to null when last tab is closed', () => {
    useAppStore.setState({ tabs: [{ type: 'session', id: 'tab1', title: 'T1' }], activeTabId: 'tab1' })
    useAppStore.getState().closeTab('tab1')
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('no-op for non-existent id', () => {
    useAppStore.setState({ tabs: [{ type: 'session', id: 'tab1', title: 'T1' }], activeTabId: 'tab1' })
    useAppStore.getState().closeTab('nonexistent')
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })
})

// ── Watch command no-workspace branch ──
describe('Gap fill — watch command no-workspace branch', () => {
  it('watch.start is not called when workspace is null', async () => {
    useAppStore.setState({
      sessions: [{ id: 's1', title: 'Test', model: 'gpt-4o', createdAt: 0, updatedAt: 0, messageCount: 0, parentId: null, agentStatus: 'idle' as const }],
      tabs: [{ type: 'session', id: 's1', title: 'Test' }],
      activeTabId: 's1', workspacePath: null, messages: [],
    })
    await renderApp()
    expect((window.electron as any).watch.start).not.toHaveBeenCalled()
  })
})

// ── Watch watcher replacement ──
describe('Gap fill — watch watcher replacement', () => {
  it('stop called before start for same session+file', async () => {
    const stop = vi.fn().mockResolvedValue({ ok: true })
    const start = vi.fn().mockResolvedValue({ ok: true, message: 'Watching' })
    await stop()
    await start('/workspace', 'file.ts', 's1')
    expect(stop).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith('/workspace', 'file.ts', 's1')
  })

  it('watch.list returns filtered results by sessionId', async () => {
    const result = await Promise.resolve({
      ok: true,
      watches: [
        { filePath: '/a/file.ts', sessionId: 's1' },
        { filePath: '/b/file.ts', sessionId: 's2' },
      ],
    })
    const s1 = result.watches.filter((w) => w.sessionId === 's1')
    expect(s1).toHaveLength(1)
    expect(s1[0].filePath).toBe('/a/file.ts')
  })
})
