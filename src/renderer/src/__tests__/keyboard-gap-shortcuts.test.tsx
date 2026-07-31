import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act, waitFor } from '@testing-library/react'
import App from '../App'
import { useAppStore } from '../store/useAppStore'
import type { Message } from '../types'

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

function createMessage(overrides: Partial<Message> & { role: Message['role'] }): Message {
  return {
    id: crypto.randomUUID(),
    sessionId: 's1',
    content: 'Hello from assistant',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as Message
}

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
    zenMode: false, sidebarVisible: true,
    workspacePath: null, fileNodes: [], settings: {
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

describe('Keyboard shortcuts — Cmd/Ctrl+B toggles sidebar', () => {
  it('⌘B hides sidebar when visible', async () => {
    await renderApp()
    useAppStore.setState({ sidebarVisible: true })
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'b' })
    })
    expect(useAppStore.getState().sidebarVisible).toBe(false)
  })

  it('⌘B shows sidebar when hidden', async () => {
    await renderApp()
    useAppStore.setState({ sidebarVisible: false })
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'b' })
    })
    expect(useAppStore.getState().sidebarVisible).toBe(true)
  })

  it('Ctrl+B also toggles sidebar (Windows/Linux fallback)', async () => {
    await renderApp()
    useAppStore.setState({ sidebarVisible: true })
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'b' })
    })
    expect(useAppStore.getState().sidebarVisible).toBe(false)
  })
})

describe('Keyboard shortcuts — Cmd/Ctrl+Shift+C copies last response', () => {
  it('⌘Shift+C copies last assistant message to clipboard', async () => {
    await renderApp()
    const msg = createMessage({ role: 'assistant', content: 'Hello from assistant' })
    useAppStore.setState({ messages: [msg] })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: writeTextSpy } })

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'C' })
    })

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith('Hello from assistant')
    })
  })

  it('⌘Shift+C does nothing when no assistant messages exist', async () => {
    await renderApp()
    useAppStore.setState({ messages: [] })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: writeTextSpy } })

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'C' })
    })

    expect(writeTextSpy).not.toHaveBeenCalled()
  })

  it('⌘Shift+C copies the LAST assistant message, not the first', async () => {
    await renderApp()
    const messages = [
      createMessage({ id: 'm1', role: 'assistant', content: 'first' }),
      createMessage({ id: 'm2', role: 'user', content: 'user msg' }),
      createMessage({ id: 'm3', role: 'assistant', content: 'second' }),
    ]
    useAppStore.setState({ messages })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: writeTextSpy } })

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'C' })
    })

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith('second')
    })
  })
})

describe('Keyboard shortcuts — Cmd/Ctrl+Z file undo', () => {
  it('⌘Z calls el.fs.undo()', async () => {
    await renderApp()
    const undoSpy = vi.fn()
    ;(window.electron as any).fs.undo = undoSpy

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'z' })
    })

    expect(undoSpy).toHaveBeenCalled()
  })

  it('Ctrl+Z also calls el.fs.undo()', async () => {
    await renderApp()
    const undoSpy = vi.fn()
    ;(window.electron as any).fs.undo = undoSpy

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })
    })

    expect(undoSpy).toHaveBeenCalled()
  })

  it('⌘Shift+Z does NOT call undo (it toggles zen mode)', async () => {
    await renderApp()
    const undoSpy = vi.fn()
    ;(window.electron as any).fs.undo = undoSpy
    useAppStore.setState({ zenMode: false })

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'Z' })
    })

    expect(undoSpy).not.toHaveBeenCalled()
    expect(useAppStore.getState().zenMode).toBe(true)
  })
})

describe('Keyboard shortcuts — Cmd/Ctrl+Y file redo', () => {
  it('⌘Y calls el.fs.redo()', async () => {
    await renderApp()
    const redoSpy = vi.fn()
    ;(window.electron as any).fs.redo = redoSpy

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: 'y' })
    })

    expect(redoSpy).toHaveBeenCalled()
  })

  it('Ctrl+Y also calls el.fs.redo()', async () => {
    await renderApp()
    const redoSpy = vi.fn()
    ;(window.electron as any).fs.redo = redoSpy

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'y' })
    })

    expect(redoSpy).toHaveBeenCalled()
  })
})
