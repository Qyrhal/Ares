import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
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
    activeView: 'chat',
    terminalOpen: false,
    terminalKey: 0,
    tabs: [],
    activeTabId: null,
    sessions: [],
    messages: [],
    isLoading: false,
    workspacePath: null,
    fileNodes: [],
    settings: {
      apiKey: '',
      apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      themeId: 'steel',
      colorMode: 'dark',
      systemPrompt: '',
      permissionMode: 'ask',
      providers: [],
    },
  })
  vi.clearAllMocks()
})

describe('EmptyMain — rendering when no tabs open', () => {
  it('shows "Nothing open yet" when no sessions exist', async () => {
    await renderApp()
    await waitFor(() => {
      expect(screen.getByText('Nothing open yet.')).toBeInTheDocument()
    })
  })

  it('shows both action buttons', async () => {
    await renderApp()
    await waitFor(() => {
      const newSessionBtn = screen.getByText('New session')
      const openFolderBtn = screen.getByText('Open folder')
      expect(newSessionBtn).toBeInTheDocument()
      expect(openFolderBtn).toBeInTheDocument()
    })
  })
})

describe('EmptyMain — button interactions', () => {
  it('"New session" button calls db.createSession', async () => {
    const createSession = (window.electron.db as { createSession: ReturnType<typeof vi.fn> }).createSession
    createSession.mockResolvedValue({ id: 'new-s1', title: 'New session', model: 'gpt-4o-mini', created_at: Date.now(), updated_at: Date.now(), message_count: 0, is_side_chat: false })
    await renderApp()
    await waitFor(() => { expect(screen.getByText('New session')).toBeInTheDocument() })
    fireEvent.click(screen.getByText('New session'))
    await waitFor(() => expect(createSession).toHaveBeenCalled())
  })

  it('"Open folder" button calls dialog.openFolder', async () => {
    const openFolder = (window.electron.dialog as { openFolder: ReturnType<typeof vi.fn> }).openFolder
    openFolder.mockResolvedValue('/some/path')
    await renderApp()
    await waitFor(() => { expect(screen.getByText('Open folder')).toBeInTheDocument() })
    fireEvent.click(screen.getByText('Open folder'))
    await waitFor(() => expect(openFolder).toHaveBeenCalled())
  })
})

describe('EmptyMain — does not show when session exists', () => {
  it('hides EmptyMain when bootstrap loads a session', async () => {
    const session = { id: 's1', title: 'My Session', model: 'gpt-4o', created_at: 0, updated_at: 0, message_count: 0, is_side_chat: false }
    ;(window.electron.db.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue([session])
    await renderApp()
    await waitFor(() => {
      expect(screen.queryByText('Nothing open yet.')).not.toBeInTheDocument()
    })
  })
})
