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
  // Reset Zustand store to initial state between tests
  useAppStore.setState({
    activeView: 'chat', terminalOpen: false, terminalKey: 0,
    tabs: [], activeTabId: null,
    sessions: [], messages: [], isLoading: false,
    workspacePath: null, fileNodes: [],
    settings: { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', themeId: 'red' },
  })
  vi.clearAllMocks()
})

describe('Keyboard shortcuts', () => {
  it('renders the app without errors', async () => {
    await renderApp()
    expect(screen.getByText('ARES')).toBeInTheDocument()
  })

  it('⌘T creates a new session', async () => {
    const createSession = (window.electron.db as { createSession: ReturnType<typeof vi.fn> }).createSession
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 't' }) })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
  })

  it('⌘N creates a new session', async () => {
    const createSession = (window.electron.db as { createSession: ReturnType<typeof vi.fn> }).createSession
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 'n' }) })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
  })

  it('⌘` toggles the terminal panel on', async () => {
    await renderApp()
    expect(screen.queryByTestId('terminal-mock')).not.toBeInTheDocument()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
    await waitFor(() => expect(screen.getByTestId('terminal-mock')).toBeInTheDocument())
  })

  it('⌘` toggles the terminal panel off', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
    await waitFor(() => expect(screen.getByTestId('terminal-mock')).toBeInTheDocument())
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
    await waitFor(() => expect(screen.queryByTestId('terminal-mock')).not.toBeInTheDocument())
  })

  it('⌘W does nothing when no tabs are open', async () => {
    await renderApp()
    expect(() => fireEvent.keyDown(window, { metaKey: true, key: 'w' })).not.toThrow()
  })
})

describe('selectTab — sidebar sync (bug fix)', () => {
  it('switching to a session tab updates activeView to chat', () => {
    const session = { id: 's1', type: 'session' as const, title: 'Test' }
    useAppStore.setState({
      tabs: [session, { type: 'file' as const, path: '/f.ts', name: 'f.ts', isDirty: false }],
      activeTabId: '/f.ts',
      activeView: 'explorer',
    })
    useAppStore.getState().selectTab('s1')
    expect(useAppStore.getState().activeView).toBe('chat')
  })

  it('switching to a file tab does not change activeView', () => {
    const session = { id: 's1', type: 'session' as const, title: 'Test' }
    useAppStore.setState({
      tabs: [session, { type: 'file' as const, path: '/f.ts', name: 'f.ts', isDirty: false }],
      activeTabId: 's1',
      activeView: 'chat',
    })
    useAppStore.getState().selectTab('/f.ts')
    expect(useAppStore.getState().activeView).toBe('chat')
    expect(useAppStore.getState().activeTabId).toBe('/f.ts')
  })
})

describe('Terminal panel', () => {
  it('activity bar terminal button opens the terminal', async () => {
    await renderApp()
    const termBtn = screen.getByTitle('Terminal (⌘`)')
    await act(async () => { fireEvent.click(termBtn) })
    await waitFor(() => expect(screen.getByTestId('terminal-mock')).toBeInTheDocument())
  })

  it('terminal close button hides the panel', async () => {
    await renderApp()
    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: '`' }) })
    await waitFor(() => expect(screen.getByTestId('terminal-mock')).toBeInTheDocument())
    await act(async () => { fireEvent.click(screen.getByText('Close terminal')) })
    await waitFor(() => expect(screen.queryByTestId('terminal-mock')).not.toBeInTheDocument())
  })
})
