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
      apiKey: 'test',
      apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      themeId: 'red',
      systemPrompt: '',
      permissionMode: 'ask',
    },
  })
  vi.clearAllMocks()
})

describe('Keyboard shortcuts — ctrlKey modal overlays', () => {
  it('Ctrl+Shift+P opens command palette', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'P' }) })
    await waitFor(() => expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument())
  })

  it('Ctrl+Shift+O opens tab switcher', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'O' }) })
    await waitFor(() => expect(screen.getByPlaceholderText('Search open tabs…')).toBeInTheDocument())
  })

  it('Ctrl+Shift+F opens session search', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'F' }) })
    await waitFor(() => expect(screen.getByPlaceholderText('Search across all sessions…')).toBeInTheDocument())
  })

  it('Ctrl+P opens quick file open', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 'p' }) })
    // workspacePath is null in default state, so placeholder shows "No folder open"
    await waitFor(() => expect(screen.getByPlaceholderText('No folder open')).toBeInTheDocument())
  })
})

describe('Keyboard shortcuts — ctrlKey settings and navigation', () => {
  it('Ctrl+, opens settings view', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: ',' }) })
    expect(useAppStore.getState().activeView).toBe('settings')
  })

  it('Ctrl+Shift+Z toggles zen mode', async () => {
    await renderApp()
    const initial = useAppStore.getState().zenMode
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'Z' }) })
    expect(useAppStore.getState().zenMode).toBe(!initial)
  })
})

describe('Keyboard shortcuts — ctrlKey tab cycling', () => {
  it('Ctrl+[ cycles to previous tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
        { type: 'session' as const, id: 's3', title: 'Tab 3' },
      ],
      activeTabId: 's2',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: '[' }) })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Ctrl+] cycles to next tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: ']' }) })
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('Ctrl+[ wraps around from first to last tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: '[' }) })
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('Ctrl+] wraps around from last to first tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'Tab 1' },
        { type: 'session' as const, id: 's2', title: 'Tab 2' },
      ],
      activeTabId: 's2',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: ']' }) })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Ctrl+[ / Ctrl+] no-ops when no tabs', async () => {
    await renderApp()
    expect(() => fireEvent.keyDown(window, { ctrlKey: true, key: '[' })).not.toThrow()
    expect(() => fireEvent.keyDown(window, { ctrlKey: true, key: ']' })).not.toThrow()
  })
})

describe('Keyboard shortcuts — ctrlKey tab number shortcuts', () => {
  it('Ctrl+1 selects first tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'First' },
        { type: 'session' as const, id: 's2', title: 'Second' },
      ],
      activeTabId: 's2',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: '1' }) })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Ctrl+2 selects second tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'First' },
        { type: 'session' as const, id: 's2', title: 'Second' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: '2' }) })
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('Ctrl+3 selects third tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'First' },
        { type: 'session' as const, id: 's2', title: 'Second' },
        { type: 'session' as const, id: 's3', title: 'Third' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: '3' }) })
    expect(useAppStore.getState().activeTabId).toBe('s3')
  })
})

describe('Keyboard shortcuts — ctrlKey ⌘W close tab', () => {
  it('Ctrl+W closes the active session tab', async () => {
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
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 'w' }) })
    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('s1'))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('Ctrl+W closes the active file tab', async () => {
    useAppStore.setState({
      tabs: [{ type: 'file' as const, path: '/test.ts', name: 'test.ts', isDirty: false }],
      activeTabId: '/test.ts',
    })
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 'w' }) })
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('Ctrl+W no-ops when no tabs open', async () => {
    await renderApp()
    expect(() => fireEvent.keyDown(window, { ctrlKey: true, key: 'w' })).not.toThrow()
  })
})

describe('Keyboard shortcuts — ctrlKey terminal toggle', () => {
  it('Ctrl+` toggles terminal from closed to open', async () => {
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(false)
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: '`' }) })
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('Ctrl+J toggles terminal from open to closed', async () => {
    useAppStore.setState({ terminalOpen: true })
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    await act(async () => { fireEvent.keyDown(window, { ctrlKey: true, key: 'j' }) })
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })

  it('Multiple rapid Ctrl+` toggles of terminal do not crash', async () => {
    await renderApp()
    expect(() => {
      act(() => { fireEvent.keyDown(window, { ctrlKey: true, key: '`' }) })
      act(() => { fireEvent.keyDown(window, { ctrlKey: true, key: '`' }) })
      act(() => { fireEvent.keyDown(window, { ctrlKey: true, key: '`' }) })
    }).not.toThrow()
    // Odd number of toggles — terminal ends open
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })
})
