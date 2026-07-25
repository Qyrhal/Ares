import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import App from '../App'
import { useAppStore } from '../store/useAppStore'

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

async function renderApp() {
  let result: ReturnType<typeof render>
  await act(async () => { result = render(<App />) })
  return result!
}

beforeEach(() => {
  useAppStore.setState({
    activeView: 'chat', terminalOpen: false,
    tabs: [], activeTabId: null,
    sessions: [], messages: [], isLoading: false,
    zenMode: false,
    workspacePath: null, fileNodes: [],
    settings: {
      apiKey: '',
      apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      themeId: 'red',
      systemPrompt: '',
      permissionMode: 'ask',
      providers: [],
      colorMode: 'dark' as const,
    },
  })
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cmd+Shift+Z zen mode toggle — on→off and off→on
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge: Cmd+Shift+Z zen mode toggle — bidirectional', () => {
  it('toggles zenMode from false → true', async () => {
    useAppStore.setState({ zenMode: false })
    await renderApp()
    expect(useAppStore.getState().zenMode).toBe(false)
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(true)
  })

  it('toggles zenMode from true → false', async () => {
    useAppStore.setState({ zenMode: true })
    await renderApp()
    expect(useAppStore.getState().zenMode).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(false)
  })

  it('double-toggle returns to original state', async () => {
    useAppStore.setState({ zenMode: false })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(false)
  })

  it('triple-toggle ends in toggled state', async () => {
    useAppStore.setState({ zenMode: false })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(true)
  })

  it('Ctrl+Shift+Z also toggles zenMode (cross-platform)', async () => {
    useAppStore.setState({ zenMode: false })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cmd+P quick file open — with and without workspace
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge: Cmd+P quick file open — workspace variants', () => {
  it('opens quick file open without workspace (placeholder: No folder open)', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'p' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('No folder open')).toBeInTheDocument()
    )
  })

  it('opens quick file open with workspace set (placeholder: Search files by name…)', async () => {
    useAppStore.setState({
      workspacePath: '/home/user/project',
      fileNodes: [
        { name: 'index.ts', path: '/home/user/project/index.ts', type: 'file' },
      ],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'p' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search files by name…')).toBeInTheDocument()
    )
  })

  it('quick file open input is disabled when no workspace', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'p' })
    })
    await waitFor(() => {
      const input = screen.getByPlaceholderText('No folder open')
      expect(input).toBeDisabled()
    })
  })

  it('quick file open input is enabled when workspace is set', async () => {
    useAppStore.setState({
      workspacePath: '/home/user/project',
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'p' })
    })
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search files by name…')
      expect(input).not.toBeDisabled()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cmd+Shift+F session search overlay — open/close
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge: Cmd+Shift+F session search overlay', () => {
  it('opens session search overlay', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'F' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search across all sessions…')).toBeInTheDocument()
    )
  })

  it('closes session search overlay when Escape is pressed on its input', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'F' })
    })
    const input = await waitFor(() =>
      screen.getByPlaceholderText('Search across all sessions…')
    )
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search across all sessions…')).not.toBeInTheDocument()
    )
  })

  it('toggle: open → close → open again', async () => {
    await renderApp()
    // Open
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'F' })
    })
    const input1 = await waitFor(() =>
      screen.getByPlaceholderText('Search across all sessions…')
    )
    // Close
    await act(async () => {
      fireEvent.keyDown(input1, { key: 'Escape' })
    })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search across all sessions…')).not.toBeInTheDocument()
    )
    // Re-open
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'F' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search across all sessions…')).toBeInTheDocument()
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Escape closing each modal independently when multiple are stacked
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge: Escape closing modals independently (stacked)', () => {
  it('opening quick file open while command palette is open shows both', async () => {
    await renderApp()
    // Open command palette
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'P' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument()
    )
    // Without closing, open quick file open via keyboard on window
    // (dispatching on window bypasses the input-focus guard)
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'p' })
    })
    // Both should be visible (the app doesn't auto-close one when opening another)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('No folder open')).toBeInTheDocument()
    })
  })

  it('Escape on quick file open input closes it but command palette remains', async () => {
    await renderApp()
    // Open command palette
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'P' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument()
    )
    // Also open quick file open
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'p' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('No folder open')).toBeInTheDocument()
    )
    // Escape on quick file open input
    const qfoInput = screen.getByPlaceholderText('No folder open')
    await act(async () => {
      fireEvent.keyDown(qfoInput, { key: 'Escape' })
    })
    // Quick file open should be gone, command palette should remain
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('No folder open')).not.toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument()
    })
  })

  it('Escape on command palette input closes it', async () => {
    await renderApp()
    // Open command palette
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'P' })
    })
    const input = await waitFor(() =>
      screen.getByPlaceholderText('Search commands…')
    )
    // Escape on command palette input
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search commands…')).not.toBeInTheDocument()
    )
  })

  it('tab switcher and session search can be stacked then closed one by one', async () => {
    await renderApp()
    // Open tab switcher
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'O' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search open tabs…')).toBeInTheDocument()
    )
    // Open session search on top
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'F' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search across all sessions…')).toBeInTheDocument()
    )
    // Escape session search
    const ssInput = screen.getByPlaceholderText('Search across all sessions…')
    await act(async () => {
      fireEvent.keyDown(ssInput, { key: 'Escape' })
    })
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search across all sessions…')).not.toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search open tabs…')).toBeInTheDocument()
    })
    // Escape tab switcher
    const tsStill = screen.getByPlaceholderText('Search open tabs…')
    await act(async () => {
      fireEvent.keyDown(tsStill, { key: 'Escape' })
    })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search open tabs…')).not.toBeInTheDocument()
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cmd+T and Cmd+N creating sessions and adding to tabs
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge: Cmd+T / Cmd+N session creation and tab integration', () => {
  it('Cmd+T creates a session and opens it as a new tab', async () => {
    const createSession = vi.mocked(window.electron.db.createSession)
    await renderApp()
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().sessions).toHaveLength(0)

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 't' })
    })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
      // Session should be added to sessions list
      expect(useAppStore.getState().sessions.length).toBeGreaterThan(0)
      // Tab should be created
      expect(useAppStore.getState().tabs.length).toBeGreaterThan(0)
      // New tab should be active
      expect(useAppStore.getState().activeTabId).toBe(
        useAppStore.getState().sessions[0].id
      )
    })
  })

  it('Cmd+N creates a session and opens it as a new tab', async () => {
    const createSession = vi.mocked(window.electron.db.createSession)
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
      expect(useAppStore.getState().sessions.length).toBeGreaterThan(0)
      expect(useAppStore.getState().tabs.length).toBeGreaterThan(0)
      expect(useAppStore.getState().activeTabId).toBe(
        useAppStore.getState().sessions[0].id
      )
    })
  })

  it('Cmd+T then Cmd+N creates two separate sessions and tabs', async () => {
    const createSession = vi.mocked(window.electron.db.createSession)
    // Mock to return different sessions
    createSession
      .mockResolvedValueOnce({
        id: 'session-1', title: 'New session', model: 'gpt-4o-mini',
        created_at: Date.now(), updated_at: Date.now(), message_count: 0,
        is_side_chat: false,
      })
      .mockResolvedValueOnce({
        id: 'session-2', title: 'New session', model: 'gpt-4o-mini',
        created_at: Date.now(), updated_at: Date.now(), message_count: 0,
        is_side_chat: false,
      })
    await renderApp()

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 't' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().sessions).toHaveLength(1)
      expect(useAppStore.getState().tabs).toHaveLength(1)
    })

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().sessions).toHaveLength(2)
      expect(useAppStore.getState().tabs).toHaveLength(2)
      // Second session should be active
      expect(useAppStore.getState().activeTabId).toBe('session-2')
    })
  })

  it('Cmd+T sets activeView to chat for new session tab', async () => {
    useAppStore.setState({ activeView: 'settings' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 't' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().activeView).toBe('chat')
    })
  })

  it('Ctrl+T creates session (cross-platform Linux/Windows)', async () => {
    const createSession = vi.mocked(window.electron.db.createSession)
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 't' })
    })
    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
      expect(useAppStore.getState().tabs.length).toBeGreaterThan(0)
    })
  })

  it('Ctrl+N creates session (cross-platform Linux/Windows)', async () => {
    const createSession = vi.mocked(window.electron.db.createSession)
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
      expect(useAppStore.getState().tabs.length).toBeGreaterThan(0)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cmd+W closing last tab vs middle tab
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge: Cmd+W close tab — last tab vs middle tab', () => {
  it('Cmd+W closes the last remaining tab (only tab)', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Only Tab' },
      ],
      activeTabId: 's1',
      sessions: [{ id: 's1', title: 'Only Tab', model: 'm', created_at: 0, updated_at: 0, message_count: 0, is_side_chat: false } as any],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().tabs).toHaveLength(0)
      expect(useAppStore.getState().activeTabId).toBeNull()
      expect(deleteSession).toHaveBeenCalledWith('s1')
    })
  })

  it('Cmd+W closes the middle tab and activates adjacent tab', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2 (active, middle)' },
        { type: 'session' as const, id: 's3', title: 'Tab 3' },
      ],
      activeTabId: 's2',
      sessions: [
        { id: 's1', title: 'Tab 1' },
        { id: 's2', title: 'Tab 2 (active, middle)' },
        { id: 's3', title: 'Tab 3' },
      ] as any[],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('s2')
      expect(useAppStore.getState().tabs).toHaveLength(2)
      // closeTab uses Math.min(idx, next.length - 1) for fallback
      // idx was 1, next.length is 2, so min(1, 2-1) = 1 → s3
      expect(useAppStore.getState().activeTabId).toBe('s3')
    })
  })

  it('Cmd+W closes the first tab and activates the next tab', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1 (active, first)' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
        { type: 'session' as const, id: 's3', title: 'Tab 3' },
      ],
      activeTabId: 's1',
      sessions: [
        { id: 's1', title: 'Tab 1 (active, first)' },
        { id: 's2', title: 'Tab 2' },
        { id: 's3', title: 'Tab 3' },
      ] as any[],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('s1')
      expect(useAppStore.getState().tabs).toHaveLength(2)
      // closeTab: idx=0, fallback = min(0, 1) = 0 → s2
      expect(useAppStore.getState().activeTabId).toBe('s2')
    })
  })

  it('Cmd+W closes the last tab in a list and falls back to previous', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
        { type: 'session' as const, id: 's3', title: 'Tab 3 (active, last)' },
      ],
      activeTabId: 's3',
      sessions: [
        { id: 's1', title: 'Tab 1' },
        { id: 's2', title: 'Tab 2' },
        { id: 's3', title: 'Tab 3 (active, last)' },
      ] as any[],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('s3')
      expect(useAppStore.getState().tabs).toHaveLength(2)
      // closeTab: idx=2, fallback = min(2, 1) = 1 → s2
      expect(useAppStore.getState().activeTabId).toBe('s2')
    })
  })

  it('Cmd+W on a file tab removes only that tab, no DB delete', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'file' as const, path: '/a.ts', name: 'a.ts', isDirty: false },
        { type: 'session' as const, id: 's1', title: 'Session' },
        { type: 'file' as const, path: '/b.ts', name: 'b.ts', isDirty: false },
      ],
      activeTabId: '/a.ts',
    })
    await renderApp()
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    // File tab is closed via closeTab (not deleteSession)
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(deleteSession).not.toHaveBeenCalled()
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Cmd+W does nothing when no tabs are open', async () => {
    await renderApp()
    expect(useAppStore.getState().tabs).toHaveLength(0)
    // Should not throw
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('Cmd+W closing second of two tabs activates the first', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2 (active)' },
      ],
      activeTabId: 's2',
      sessions: [
        { id: 's1', title: 'Tab 1' },
        { id: 's2', title: 'Tab 2 (active)' },
      ] as any[],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('s2')
      expect(useAppStore.getState().tabs).toHaveLength(1)
      expect(useAppStore.getState().activeTabId).toBe('s1')
    })
  })

  it('Cmd+W closing first of two tabs activates the second', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1 (active)' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
      sessions: [
        { id: 's1', title: 'Tab 1 (active)' },
        { id: 's2', title: 'Tab 2' },
      ] as any[],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    })
    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('s1')
      expect(useAppStore.getState().tabs).toHaveLength(1)
      expect(useAppStore.getState().activeTabId).toBe('s2')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Cmd+1–9 tab number shortcuts — edge cases
// ─────────────────────────────────────────────────────────────────────────────
function makeTabs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    type: 'session' as const,
    id: `s${i + 1}`,
    title: `Tab ${i + 1}`,
  }))
}

describe('Edge: Cmd+1–9 tab number shortcuts', () => {
  it('Cmd+1 selects the first tab', async () => {
    useAppStore.setState({ tabs: makeTabs(3), activeTabId: 's3' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '1' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Cmd+5 selects the fifth tab', async () => {
    useAppStore.setState({ tabs: makeTabs(6), activeTabId: 's1' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '5' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s5')
  })

  it('Cmd+9 selects the ninth tab when exactly 9 tabs exist', async () => {
    useAppStore.setState({ tabs: makeTabs(9), activeTabId: 's1' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '9' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s9')
  })

  it('Cmd+9 selects the ninth tab when more than 9 tabs exist', async () => {
    useAppStore.setState({ tabs: makeTabs(12), activeTabId: 's1' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '9' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s9')
  })

  it('Cmd+9 no-ops when only 5 tabs exist (fewer than 9)', async () => {
    useAppStore.setState({ tabs: makeTabs(5), activeTabId: 's1' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '9' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Cmd+7 no-ops when only 5 tabs exist (out-of-range)', async () => {
    useAppStore.setState({ tabs: makeTabs(5), activeTabId: 's3' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '7' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s3')
  })

  it('Cmd+0 does nothing (0 is not a valid tab number)', async () => {
    useAppStore.setState({ tabs: makeTabs(3), activeTabId: 's1' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '0' })
    })
    // Should not change active tab (0 is parsed but fails num >= 1 check)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Cmd+1-9 all work for exactly 9 tabs', async () => {
    useAppStore.setState({ tabs: makeTabs(9), activeTabId: 's5' })
    await renderApp()
    for (let n = 1; n <= 9; n++) {
      useAppStore.setState({ activeTabId: 's5' })
      await act(async () => {
        fireEvent.keyDown(window, { metaKey: true, key: String(n) })
      })
      expect(useAppStore.getState().activeTabId).toBe(`s${n}`)
    }
  })

  it('Cmd+1-9 no-ops for out-of-range tabs', async () => {
    useAppStore.setState({ tabs: makeTabs(3), activeTabId: 's1' })
    await renderApp()
    for (const key of ['4', '5', '6', '7', '8', '9']) {
      const before = useAppStore.getState().activeTabId
      await act(async () => {
        fireEvent.keyDown(window, { metaKey: true, key })
      })
      expect(useAppStore.getState().activeTabId).toBe(before)
    }
  })

  it('Cmd+1-9 no-ops when zero tabs exist', async () => {
    useAppStore.setState({ tabs: [], activeTabId: null })
    await renderApp()
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      await act(async () => {
        fireEvent.keyDown(window, { metaKey: true, key })
      })
      expect(useAppStore.getState().activeTabId).toBeNull()
    }
  })

  it('Cmd+1 on single tab selects that tab', async () => {
    useAppStore.setState({ tabs: makeTabs(1), activeTabId: 's1' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '1' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Cmd+2 on single tab does nothing', async () => {
    useAppStore.setState({ tabs: makeTabs(1), activeTabId: 's1' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '2' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('selecting the same tab number twice stays on same tab', async () => {
    useAppStore.setState({ tabs: makeTabs(3), activeTabId: 's3' })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '1' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s1')
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '1' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})
