import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import App from '../App'

// TerminalView uses xterm.js (Canvas) which jsdom doesn't support — mock it
vi.mock('../components/TerminalView', () => ({
  TerminalView: ({ onClose }: { cwd: string | null; onClose: () => void; onNewTerminal: () => void }) => (
    <div data-testid="terminal-mock">
      <button onClick={onClose}>Close terminal</button>
    </div>
  ),
}))

// Monaco editor also uses browser APIs not available in jsdom
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-mock" />,
  Editor: () => <div data-testid="monaco-mock" />,
}))

async function renderApp() {
  let result: ReturnType<typeof render>
  await act(async () => { result = render(<App />) })
  return result!
}

describe('Keyboard shortcuts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the app without errors', async () => {
    await renderApp()
    // Title bar with ARES should be present
    expect(screen.getByText('ARES')).toBeInTheDocument()
  })

  it('⌘T opens a new session (creates a tab)', async () => {
    const { electron } = window as Window & typeof globalThis & { electron: typeof window.electron }
    const mock = electron.db as { createSession: ReturnType<typeof vi.fn> }
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 't' })
    })
    await waitFor(() => {
      expect(mock.createSession).toHaveBeenCalled()
    })
  })

  it('⌘N opens a new session', async () => {
    const mock = (window.electron.db as { createSession: ReturnType<typeof vi.fn> })
    mock.createSession.mockClear()
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'n' })
    })
    await waitFor(() => {
      expect(mock.createSession).toHaveBeenCalled()
    })
  })

  it('⌘` toggles the terminal panel', async () => {
    await renderApp()
    expect(screen.queryByTestId('terminal-mock')).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '`' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('terminal-mock')).toBeInTheDocument()
    })
    // Toggle off
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '`' })
    })
    await waitFor(() => {
      expect(screen.queryByTestId('terminal-mock')).not.toBeInTheDocument()
    })
  })
})

describe('Terminal panel', () => {
  it('terminal toggle button in activity bar opens the terminal', async () => {
    await renderApp()
    const termBtn = screen.getByTitle('Terminal (⌘`)')
    await act(async () => { fireEvent.click(termBtn) })
    await waitFor(() => {
      expect(screen.getByTestId('terminal-mock')).toBeInTheDocument()
    })
  })

  it('terminal close button hides the panel', async () => {
    await renderApp()
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: '`' })
    })
    await waitFor(() => expect(screen.getByTestId('terminal-mock')).toBeInTheDocument())
    await act(async () => {
      fireEvent.click(screen.getByText('Close terminal'))
    })
    await waitFor(() => {
      expect(screen.queryByTestId('terminal-mock')).not.toBeInTheDocument()
    })
  })
})

describe('Tab management', () => {
  it('⌘W does nothing when no tabs are open', async () => {
    await renderApp()
    // No error should be thrown
    expect(() => {
      fireEvent.keyDown(window, { metaKey: true, key: 'w' })
    }).not.toThrow()
  })
})
