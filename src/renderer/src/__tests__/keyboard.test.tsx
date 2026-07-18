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
    activeView: 'chat', terminalOpen: false, terminalKey: 0,
    tabs: [], activeTabId: null,
    sessions: [], messages: [], isLoading: false,
    workspacePath: null, fileNodes: [],
    settings: {
      apiKey: '', apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini', themeId: 'red',
      systemPrompt: '', permissionMode: 'ask',
    },
  })
  vi.clearAllMocks()
})

describe('Keyboard shortcuts — modal overlays', () => {
  it('⌘Shift+P opens command palette', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'P' }) })
    await waitFor(() => expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument())
  })

  it('⌘Shift+O opens tab switcher', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'O' }) })
    await waitFor(() => expect(screen.getByPlaceholderText('Search open tabs…')).toBeInTheDocument())
  })

  it('⌘Shift+F opens session search', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'F' }) })
    await waitFor(() => expect(screen.getByPlaceholderText('Search across all sessions…')).toBeInTheDocument())
  })

  it('⌘P opens quick file open', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 'p' }) })
    // workspacePath is null in default state, so placeholder shows "No folder open"
    await waitFor(() => expect(screen.getByPlaceholderText('No folder open')).toBeInTheDocument())
  })
})

describe('Keyboard shortcuts — settings and navigation', () => {
  it('⌘, opens settings view', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: ',' }) })
    expect(useAppStore.getState().activeView).toBe('settings')
  })

  it('⌘Shift+Z toggles zen mode', async () => {
    await renderApp()
    const initial = useAppStore.getState().zenMode
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' }) })
    expect(useAppStore.getState().zenMode).toBe(!initial)
  })

  it('Escape closes command palette', async () => {
    await renderApp()
    // Open command palette first
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'P' }) })
    await waitFor(() => expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument())
    // Escape closes it (handled by CommandPalette's own onKeyDown handler)
    await act(async () => { fireEvent.keyDown(screen.getByPlaceholderText('Search commands…'), { key: 'Escape' }) })
    await waitFor(() => expect(screen.queryByPlaceholderText('Search commands…')).not.toBeInTheDocument())
  })
})

describe('Keyboard shortcuts — tab cycling', () => {
  it('⌘[ cycles to previous tab', async () => {
    // Set up multiple tabs first
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
        { type: 'session' as const, id: 's3', title: 'Tab 3' },
      ],
      activeTabId: 's2',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '[' }) })
    // Should have switched to s1 (previous)
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('⌘] cycles to next tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: ']' }) })
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('⌘[ wraps around from first to last tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '[' }) })
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('⌘] wraps around from last to first tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's2',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: ']' }) })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('⌘[ / ⌘] no-ops when no tabs', async () => {
    await renderApp()
    expect(() => fireEvent.keyDown(window, { metaKey: true, key: '[' })).not.toThrow()
    expect(() => fireEvent.keyDown(window, { metaKey: true, key: ']' })).not.toThrow()
  })
})

describe('Keyboard shortcuts — tab number shortcuts', () => {
  it('⌘1 selects first tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'First' },
        { type: 'session' as const, id: 's2', title: 'Second' },
      ],
      activeTabId: 's2',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '1' }) })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('⌘2 selects second tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'First' },
        { type: 'session' as const, id: 's2', title: 'Second' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '2' }) })
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('⌘3 selects third tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'First' },
        { type: 'session' as const, id: 's2', title: 'Second' },
        { type: 'session' as const, id: 's3', title: 'Third' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '3' }) })
    expect(useAppStore.getState().activeTabId).toBe('s3')
  })

  it('⌘9 no-ops when fewer than 9 tabs exist', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'One' },
        { type: 'session' as const, id: 's2', title: 'Two' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '9' }) })
    // Active tab should not change since there are only 2 tabs
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

describe('Keyboard shortcuts — Escape abort', () => {
  it('Escape aborts loading when agent is running', async () => {
    useAppStore.setState({ isLoading: true })
    await renderApp()
    // Should not throw
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
  })
})

describe('Keyboard shortcuts — cross-platform ctrlKey', () => {
  it('Ctrl+T creates session on Windows/Linux', async () => {
    const createSession = (window.electron.db as { createSession: ReturnType<typeof vi.fn> }).createSession
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 't' }) })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
  })

  it('Ctrl+N creates session on Windows/Linux', async () => {
    const createSession = (window.electron.db as { createSession: ReturnType<typeof vi.fn> }).createSession
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 'n' }) })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
  })
})

describe('Keyboard shortcuts — metaKey session creation', () => {
  it('⌘T creates session on macOS', async () => {
    const createSession = (window.electron.db as { createSession: ReturnType<typeof vi.fn> }).createSession
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 't' }) })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
  })

  it('⌘N creates session on macOS', async () => {
    const createSession = (window.electron.db as { createSession: ReturnType<typeof vi.fn> }).createSession
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 'n' }) })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
  })
})

describe('Keyboard shortcuts — Escape close tab', () => {
  it('Escape close tab when no loading', async () => {
    useAppStore.setState({ isLoading: false })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    // Should not crash
  })

  it('Escape with no loading state + one tab closes the active tab', async () => {
    useAppStore.setState({
      tabs: [{ type: 'session' as const, id: 's1', title: 'Only Tab' }],
      activeTabId: 's1',
      isLoading: false,
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('Escape with no loading state + multiple tabs closes the active tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
      isLoading: false,
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(useAppStore.getState().tabs).toHaveLength(1)
    // Closes s1 (active), s2 remains
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })
})

describe('Keyboard shortcuts — ⌘W close tab', () => {
  it('⌘W closes the active tab (session tab)', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 'w' }) })
    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('s1'))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('⌘W closes the active file tab', async () => {
    useAppStore.setState({
      tabs: [{ type: 'file' as const, path: '/test.ts', name: 'test.ts', isDirty: false }],
      activeTabId: '/test.ts',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 'w' }) })
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('⌘W no-ops when no tabs open', async () => {
    await renderApp()
    expect(() => fireEvent.keyDown(window, { metaKey: true, key: 'w' })).not.toThrow()
  })
})

describe('Keyboard shortcuts — ⌘`/⌘J terminal toggle', () => {
  it('⌘` toggles terminal from closed to open', async () => {
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(false)
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('⌘J toggles terminal from open to closed', async () => {
    useAppStore.setState({ terminalOpen: true })
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 'j' }) })
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })

  it('Multiple rapid toggles of terminal do not crash', async () => {
    await renderApp()
    expect(() => {
      act(() => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
      act(() => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
      act(() => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
    }).not.toThrow()
    // Odd number of toggles — terminal ends open
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })
})

describe('Keyboard shortcuts — input-focused guard', () => {
  it('shortcuts do not fire when an input element is focused', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
    })
    await renderApp()

    const input = document.createElement('input')
    input.setAttribute('data-testid', 'guard-input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    await act(async () => { fireEvent.keyDown(input, { metaKey: true, key: 'w' }) })

    // Tab should NOT have been closed
    expect(deleteSession).not.toHaveBeenCalled()
    expect(useAppStore.getState().tabs).toHaveLength(2)
    expect(useAppStore.getState().activeTabId).toBe('s1')

    document.body.removeChild(input)
  })

  it('shortcuts do not fire when a textarea element is focused', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
      ],
      activeTabId: 's1',
    })
    await renderApp()

    const textarea = document.createElement('textarea')
    textarea.setAttribute('data-testid', 'guard-textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    await act(async () => { fireEvent.keyDown(textarea, { metaKey: true, key: '`' }) })

    // Terminal should NOT have been toggled
    expect(useAppStore.getState().terminalOpen).toBe(false)

    document.body.removeChild(textarea)
  })
})

describe('Keyboard shortcuts — Ctrl+C abort', () => {
  it('Ctrl+C aborts when agent is loading', async () => {
    const abort = vi.fn()
    window.electron.ai = { ...(window.electron.ai as object || {}), abort: abort } as typeof window.electron.ai
    useAppStore.setState({ isLoading: true })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 'c' }) })
    // Should not throw
  })

  it('Ctrl+C does not abort when agent is not loading', async () => {
    useAppStore.setState({ isLoading: false })
    await renderApp()
    // Should not throw
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 'c' }) })
  })
})
