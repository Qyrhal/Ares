import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act, waitFor } from '@testing-library/react'
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

const el = () => (window as unknown as { electron: Record<string, unknown> }).electron

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

describe('Keyboard shortcuts — Ctrl+N creates new session', () => {
  it('Ctrl+N creates a new session tab', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'n' })
    })
    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.tabs.length).toBeGreaterThanOrEqual(1)
      expect(state.activeTabId).not.toBeNull()
    })
  })

  it('Meta+N creates a new session tab (macOS)', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'n' })
    })
    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.tabs.length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('Keyboard shortcuts — Ctrl+T creates new session', () => {
  it('Ctrl+T creates a new session tab', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 't' })
    })
    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.tabs.length).toBeGreaterThanOrEqual(1)
      expect(state.activeTabId).not.toBeNull()
    })
  })

  it('Meta+T creates a new session tab (macOS)', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 't' })
    })
    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.tabs.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('Ctrl+N does not fire when a textarea is focused', async () => {
    await renderApp()
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()

    await act(async () => {
      fireEvent.keyDown(ta, { ctrlKey: true, key: 'n' })
    })

    const state = useAppStore.getState()
    expect(state.tabs.length).toBe(0)
    document.body.removeChild(ta)
  })
})

describe('Keyboard shortcuts — Ctrl+C triggers abort when loading', () => {
  it('Ctrl+C calls pi.abort when isLoading is true', async () => {
    await renderApp()

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().tabs.length).toBeGreaterThanOrEqual(1)
    })

    await act(async () => {
      useAppStore.setState({ isLoading: true })
    })

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' })
    })

    await waitFor(() => {
      const pi = el().pi as { abort: ReturnType<typeof vi.fn> }
      expect(pi.abort).toHaveBeenCalled()
    })
  })

  it('Ctrl+C does NOT call pi.abort when isLoading is false', async () => {
    await renderApp()

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().tabs.length).toBeGreaterThanOrEqual(1)
    })

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' })
    })

    const pi = el().pi as { abort: ReturnType<typeof vi.fn> }
    expect(pi.abort).not.toHaveBeenCalled()
  })
})

describe('Keyboard shortcuts — Escape triggers abort when loading', () => {
  it('Escape calls pi.abort when isLoading is true', async () => {
    await renderApp()

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().tabs.length).toBeGreaterThanOrEqual(1)
    })

    await act(async () => {
      useAppStore.setState({ isLoading: true })
    })

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    await waitFor(() => {
      const pi = el().pi as { abort: ReturnType<typeof vi.fn> }
      expect(pi.abort).toHaveBeenCalled()
    })
  })
})

describe('Keyboard shortcuts — Escape closes active tab when not loading', () => {
  it('Escape closes the active tab', async () => {
    await renderApp()

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(useAppStore.getState().tabs.length).toBeGreaterThanOrEqual(1)
    })

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.tabs.length).toBe(0)
    }, { timeout: 2000 })
  })
})
