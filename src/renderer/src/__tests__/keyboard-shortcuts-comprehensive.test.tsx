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
      apiKey: 'test-key',
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
// 1. Ctrl+Shift+P opens command palette (Windows/Linux fallback)
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+Shift+P opens command palette', () => {
  it('Ctrl+Shift+P opens command palette', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'P' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search commands…')).toBeInTheDocument()
    )
  })

  it('command palette closes on Escape', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'P' })
    })
    const input = await waitFor(() =>
      screen.getByPlaceholderText('Search commands…')
    )
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search commands…')).not.toBeInTheDocument()
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ctrl+Shift+O opens tab switcher
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+Shift+O opens tab switcher', () => {
  it('Ctrl+Shift+O opens tab switcher overlay', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'O' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search open tabs…')).toBeInTheDocument()
    )
  })

  it('tab switcher closes on Escape', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'O' })
    })
    const input = await waitFor(() =>
      screen.getByPlaceholderText('Search open tabs…')
    )
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search open tabs…')).not.toBeInTheDocument()
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Ctrl+Shift+F opens session search
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+Shift+F opens session search', () => {
  it('Ctrl+Shift+F opens search overlay', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'F' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search across all sessions…')).toBeInTheDocument()
    )
  })

  it('search overlay closes on Escape', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'F' })
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
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ctrl+Shift+R regenerate last assistant message
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+Shift+R regenerate', () => {
  it('Ctrl+Shift+R with assistant message present does not crash', async () => {
    await renderApp()
    const userMsg = {
      id: 'u1', sessionId: 's1', role: 'user' as const,
      content: 'Hi', createdAt: Date.now(),
    }
    const assistantMsg = {
      id: 'a1', sessionId: 's1', role: 'assistant' as const,
      content: 'Hello back', createdAt: Date.now(),
    }
    await act(async () => {
      useAppStore.setState({ messages: [userMsg, assistantMsg] })
    })
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })
    // Messages should remain intact
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].id).toBe('a1')
  })

  it('Ctrl+Shift+R with no messages does nothing', async () => {
    await renderApp()
    expect(useAppStore.getState().messages).toHaveLength(0)
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })
    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('Ctrl+Shift+R with last message as user does nothing', async () => {
    await renderApp()
    const userMsg = {
      id: 'u1', sessionId: 's1', role: 'user' as const,
      content: 'Hello', createdAt: Date.now(),
    }
    await act(async () => {
      useAppStore.setState({ messages: [userMsg] })
    })
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })
    expect(useAppStore.getState().messages).toHaveLength(1)
    expect(useAppStore.getState().messages[0].role).toBe('user')
  })

  it('Ctrl+Shift+R picks the last assistant when multiple exist', async () => {
    await renderApp()
    const msgs = [
      { id: 'u1', sessionId: 's1', role: 'user' as const, content: 'Q1', createdAt: 1 },
      { id: 'a1', sessionId: 's1', role: 'assistant' as const, content: 'A1', createdAt: 2 },
      { id: 'u2', sessionId: 's1', role: 'user' as const, content: 'Q2', createdAt: 3 },
      { id: 'a2', sessionId: 's1', role: 'assistant' as const, content: 'A2', createdAt: 4 },
    ]
    await act(async () => {
      useAppStore.setState({ messages: msgs })
    })
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })
    const state = useAppStore.getState().messages
    expect(state).toHaveLength(4)
    const lastAssistant = [...state].reverse().find((m) => m.role === 'assistant')
    expect(lastAssistant?.id).toBe('a2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ctrl+P opens quick file open
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+P opens quick file open', () => {
  it('Ctrl+P opens quick file open without workspace', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'p' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('No folder open')).toBeInTheDocument()
    )
  })

  it('Ctrl+P opens quick file open with workspace', async () => {
    useAppStore.setState({
      workspacePath: '/home/user/project',
      fileNodes: [
        { name: 'index.ts', path: '/home/user/project/index.ts', type: 'file' },
      ],
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'p' })
    })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search files by name…')).toBeInTheDocument()
    )
  })

  it('quick file open input is disabled when no workspace', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'p' })
    })
    await waitFor(() => {
      const input = screen.getByPlaceholderText('No folder open')
      expect(input).toBeDisabled()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Ctrl+, opens settings
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+, opens settings', () => {
  it('Ctrl+, switches to settings view', async () => {
    await renderApp()
    expect(useAppStore.getState().activeView).toBe('chat')
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: ',' })
    })
    expect(useAppStore.getState().activeView).toBe('settings')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Ctrl+W closes active tab
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+W closes active tab', () => {
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
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'w' })
    })
    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('s1'))
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().activeTabId).toBe('s2')
  })

  it('Ctrl+W closes a file tab', async () => {
    useAppStore.setState({
      tabs: [{ type: 'file' as const, path: '/test.ts', name: 'test.ts', isDirty: false }],
      activeTabId: '/test.ts',
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'w' })
    })
    expect(useAppStore.getState().tabs).toHaveLength(0)
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('Ctrl+W no-ops when no tabs are open', async () => {
    await renderApp()
    expect(() =>
      fireEvent.keyDown(window, { ctrlKey: true, key: 'w' })
    ).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Ctrl+` toggles terminal
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+` toggles terminal', () => {
  it('Ctrl+` opens terminal from closed state', async () => {
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(false)
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '`' })
    })
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('Ctrl+` closes terminal from open state', async () => {
    useAppStore.setState({ terminalOpen: true })
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '`' })
    })
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Ctrl+J toggles terminal
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+J toggles terminal', () => {
  it('Ctrl+J opens terminal from closed state', async () => {
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(false)
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'j' })
    })
    expect(useAppStore.getState().terminalOpen).toBe(true)
  })

  it('Ctrl+J closes terminal from open state', async () => {
    useAppStore.setState({ terminalOpen: true })
    await renderApp()
    expect(useAppStore.getState().terminalOpen).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'j' })
    })
    expect(useAppStore.getState().terminalOpen).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. Ctrl+Shift+Z toggles zen mode
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+Shift+Z toggles zen mode', () => {
  it('Ctrl+Shift+Z toggles zenMode false → true', async () => {
    useAppStore.setState({ zenMode: false })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(true)
  })

  it('Ctrl+Shift+Z toggles zenMode true → false', async () => {
    useAppStore.setState({ zenMode: true })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(false)
  })

  it('double Ctrl+Shift+Z returns to original state', async () => {
    useAppStore.setState({ zenMode: false })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'Z' })
    })
    expect(useAppStore.getState().zenMode).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. Ctrl+[ and Ctrl+] tab navigation
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+[ and Ctrl+] tab navigation', () => {
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
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '[' })
    })
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
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: ']' })
    })
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
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '[' })
    })
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
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: ']' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })

  it('Ctrl+[ / Ctrl+] no-ops when no tabs', async () => {
    await renderApp()
    expect(() =>
      fireEvent.keyDown(window, { ctrlKey: true, key: '[' })
    ).not.toThrow()
    expect(() =>
      fireEvent.keyDown(window, { ctrlKey: true, key: ']' })
    ).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Ctrl+1 through Ctrl+9 jump to tab
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Ctrl+1 through Ctrl+9 jump to tab', () => {
  it('Ctrl+1 selects first tab', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'First' },
        { type: 'session' as const, id: 's2', title: 'Second' },
      ],
      activeTabId: 's2',
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '1' })
    })
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
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '2' })
    })
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
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '3' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s3')
  })

  it('Ctrl+4 through Ctrl+9 work for respective tab indices', async () => {
    const tabs = Array.from({ length: 9 }, (_, i) => ({
      type: 'session' as const,
      id: `s${i + 1}`,
      title: `Tab ${i + 1}`,
    }))
    useAppStore.setState({ tabs, activeTabId: 's1' })
    await renderApp()

    // Ctrl+5 → s5
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '5' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s5')

    // Ctrl+9 → s9
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '9' })
    })
    expect(useAppStore.getState().activeTabId).toBe('s9')
  })

  it('Ctrl+9 no-ops when fewer than 9 tabs exist', async () => {
    useAppStore.setState({
      tabs: [
        { type: 'session' as const, id: 's1', title: 'One' },
        { type: 'session' as const, id: 's2', title: 'Two' },
      ],
      activeTabId: 's1',
    })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: '9' })
    })
    // Active tab should not change since there are only 2 tabs
    expect(useAppStore.getState().activeTabId).toBe('s1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. Zen mode with lowercase 'z' should NOT trigger (negative test)
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — lowercase z does NOT trigger zen mode', () => {
  it('Ctrl+lowercase z does not toggle zen mode', async () => {
    useAppStore.setState({ zenMode: false })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: false, key: 'z' })
    })
    expect(useAppStore.getState().zenMode).toBe(false)
  })

  it('Meta+lowercase z does not toggle zen mode', async () => {
    useAppStore.setState({ zenMode: true })
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: false, key: 'z' })
    })
    // Should remain true — lowercase 'z' is not handled
    expect(useAppStore.getState().zenMode).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. Escape with no active tab should not crash
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Escape with no active tab', () => {
  it('Escape with no tabs and no active tab does not throw', async () => {
    useAppStore.setState({ isLoading: false, activeTabId: null, tabs: [] })
    await renderApp()
    expect(() =>
      fireEvent.keyDown(window, { key: 'Escape' })
    ).not.toThrow()
  })

  it('Escape while loading calls abort', async () => {
    useAppStore.setState({ isLoading: true })
    await renderApp()
    // Should not throw
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. Input guard: Meta+P blocked when textarea focused
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Meta+P blocked when textarea focused', () => {
  it('Meta+P does not open quick file open when textarea is focused', async () => {
    await renderApp()

    const textarea = document.createElement('textarea')
    textarea.setAttribute('data-testid', 'guard-textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    await act(async () => {
      fireEvent.keyDown(textarea, { metaKey: true, key: 'p' })
    })

    // Should NOT have opened quick file open
    expect(
      screen.queryByPlaceholderText('No folder open')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('Search files by name…')
    ).not.toBeInTheDocument()

    document.body.removeChild(textarea)
  })

  it('Ctrl+P does not open quick file open when textarea is focused', async () => {
    await renderApp()

    const textarea = document.createElement('textarea')
    textarea.setAttribute('data-testid', 'guard-textarea-ctrl')
    document.body.appendChild(textarea)
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    await act(async () => {
      fireEvent.keyDown(textarea, { ctrlKey: true, key: 'p' })
    })

    expect(
      screen.queryByPlaceholderText('No folder open')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('Search files by name…')
    ).not.toBeInTheDocument()

    document.body.removeChild(textarea)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. Input guard: Meta+Shift+F blocked when input focused
// ─────────────────────────────────────────────────────────────────────────────
describe('Keyboard shortcuts — Meta+Shift+F blocked when input focused', () => {
  it('Meta+Shift+F does not open search when input is focused', async () => {
    await renderApp()

    const input = document.createElement('input')
    input.setAttribute('data-testid', 'guard-input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    await act(async () => {
      fireEvent.keyDown(input, { metaKey: true, shiftKey: true, key: 'F' })
    })

    expect(
      screen.queryByPlaceholderText('Search across all sessions…')
    ).not.toBeInTheDocument()

    document.body.removeChild(input)
  })

  it('Ctrl+Shift+F does not open search when input is focused', async () => {
    await renderApp()

    const input = document.createElement('input')
    input.setAttribute('data-testid', 'guard-input-ctrl')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    await act(async () => {
      fireEvent.keyDown(input, { ctrlKey: true, shiftKey: true, key: 'F' })
    })

    expect(
      screen.queryByPlaceholderText('Search across all sessions…')
    ).not.toBeInTheDocument()

    document.body.removeChild(input)
  })
})
