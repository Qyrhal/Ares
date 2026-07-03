import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import App from '../App'
import { useAppStore } from '../store/useAppStore'

vi.mock('../components/TerminalView', () => ({
  TerminalView: () => <div data-testid="terminal-mock" />,
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
    workspacePath: null, fileNodes: [],
    settings: { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', themeId: 'red' },
  })
  vi.clearAllMocks()
})

function mockTwoSessions(): {
  getSessions: ReturnType<typeof vi.fn>
  createSession: ReturnType<typeof vi.fn>
  deleteSession: ReturnType<typeof vi.fn>
} {
  const mocks = {
    getSessions: vi.fn().mockResolvedValue([
      { id: 's1', title: 'Session One', model: 'gpt-4o-mini', created_at: 100, updated_at: 100, message_count: 0 },
      { id: 's2', title: 'Session Two', model: 'gpt-4o-mini', created_at: 200, updated_at: 200, message_count: 0 },
    ]),
    createSession: vi.fn().mockResolvedValue({ id: 's3', title: 'New session', model: 'gpt-4o-mini', created_at: Date.now(), updated_at: Date.now(), message_count: 0 }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  }
  Object.assign(window.electron.db, mocks)
  return mocks
}

describe('TabBar', () => {
  it('renders the tab bar with a new-session button when no tabs exist', async () => {
    await renderApp()
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
    expect(screen.getByTitle('New session')).toBeInTheDocument()
  })

  it('renders session tab loaded from bootstrap', async () => {
    mockTwoSessions()
    await renderApp()
    const tabBar = screen.getByTestId('tab-bar')
    await waitFor(() => {
      expect(within(tabBar).getByText('Session One')).toBeInTheDocument()
    })
  })

  it('closing a session tab deletes the session and removes it from the sidebar', async () => {
    const { deleteSession } = mockTwoSessions()
    await renderApp()
    const tabBar = screen.getByTestId('tab-bar')
    await waitFor(() => {
      expect(within(tabBar).getByText('Session One')).toBeInTheDocument()
    })

    // Bootstrap only opens sessions[0] as a tab. Manually add Session Two.
    act(() => {
      useAppStore.setState({
        tabs: [
          { type: 'session' as const, id: 's1', title: 'Session One' },
          { type: 'session' as const, id: 's2', title: 'Session Two' },
        ],
        activeTabId: 's1',
      })
    })

    const closeBtns = within(tabBar).getAllByLabelText('Close tab')
    expect(closeBtns.length).toBe(2)

    await act(async () => { fireEvent.click(closeBtns[0]) })

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('s1')
    })

    expect(within(tabBar).queryByText('Session One')).not.toBeInTheDocument()
    expect(within(tabBar).getByText('Session Two')).toBeInTheDocument()
  })

  it('Cmd+W deletes a session tab', async () => {
    const { deleteSession } = mockTwoSessions()
    await renderApp()
    const tabBar = screen.getByTestId('tab-bar')
    await waitFor(() => {
      expect(within(tabBar).getByText('Session One')).toBeInTheDocument()
    })

    await act(async () => { fireEvent.keyDown(window, { metaKey: true, key: 'w' }) })

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('s1')
    })
  })

  it('new-session button calls createSession and adds the tab', async () => {
    const { createSession } = mockTwoSessions()
    await renderApp()
    const tabBar = screen.getByTestId('tab-bar')
    await waitFor(() => {
      expect(within(tabBar).getByText('Session One')).toBeInTheDocument()
    })

    await act(async () => { fireEvent.click(screen.getByTitle('New session')) })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
    })
  })

  it('closing a file tab does not call deleteSession', async () => {
    // Set deleteSession mock but keep getSessions returning [] (default)
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.electron.db, { deleteSession })
    // Set createSession mock so new-session shortcut doesn't crash
    Object.assign(window.electron.db, { createSession: vi.fn().mockResolvedValue({ id: 's99', title: 'x', model: 'gpt-4o-mini', created_at: Date.now(), updated_at: Date.now(), message_count: 0 }) })

    await renderApp()

    // After bootstrap (no sessions), add a file tab manually
    await waitFor(() => {
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
    })
    act(() => {
      useAppStore.setState({
        tabs: [{ type: 'file' as const, path: '/f.ts', name: 'f.ts', isDirty: false }],
        activeTabId: '/f.ts',
      })
    })

    const tabBar = screen.getByTestId('tab-bar')
    await waitFor(() => {
      expect(within(tabBar).getByText('f.ts')).toBeInTheDocument()
    })

    const closeBtn = within(tabBar).getByLabelText('Close tab')
    await act(async () => { fireEvent.click(closeBtn) })

    expect(deleteSession).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(within(tabBar).queryByText('f.ts')).not.toBeInTheDocument()
    })
  })
})
