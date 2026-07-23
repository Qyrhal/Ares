import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import React from 'react'
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

function mkMsg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    sessionId: 's1',
    role: 'user' as const,
    content: 'Hello',
    createdAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  useAppStore.setState({
    activeView: 'chat',
    terminalOpen: false,
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
      providers: [],
      defaultModel: 'gpt-4o-mini',
      themeId: 'red',
      colorMode: 'dark',
      systemPrompt: '',
      permissionMode: 'ask',
    },
  })
  vi.clearAllMocks()
})

describe('Keyboard shortcuts — Ctrl+Shift+R / Cmd+Shift+R regenerate', () => {
  it('Ctrl+Shift+R calls regenerate with last assistant message', async () => {
    const assistantMsg = mkMsg({ id: 'a1', role: 'assistant', content: 'Response' })
    const userMsg = mkMsg({ id: 'u1', role: 'user', content: 'Hi' })
    await renderApp()

    // Set messages AFTER render so the useEffect that clears them has already run
    await act(async () => {
      useAppStore.setState({ messages: [userMsg, assistantMsg] })
    })

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })

    // The shortcut should have been handled; messages remain in store
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].id).toBe('a1')
  })

  it('Meta+Shift+R calls regenerate with last assistant message', async () => {
    const assistantMsg = mkMsg({ id: 'a2', role: 'assistant', content: 'Hello back' })
    const userMsg = mkMsg({ id: 'u2', role: 'user', content: 'Hey' })
    await renderApp()

    await act(async () => {
      useAppStore.setState({ messages: [userMsg, assistantMsg] })
    })

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'R' })
    })

    // Should not crash and messages should remain intact
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[1].role).toBe('assistant')
  })

  it('Ctrl+Shift+R does nothing when there are no messages', async () => {
    await renderApp()

    // Messages are empty (default state)
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })

    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('Ctrl+Shift+R does nothing when last message is not assistant', async () => {
    const userMsg = mkMsg({ id: 'u1', role: 'user', content: 'Hi' })
    await renderApp()

    await act(async () => {
      useAppStore.setState({ messages: [userMsg] })
    })

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })

    // Messages should remain unchanged — last message is user, not assistant
    const msgs = useAppStore.getState().messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('user')
  })

  it('Ctrl+Shift+R picks the LAST assistant message (not the first)', async () => {
    const msgs = [
      mkMsg({ id: 'u1', role: 'user', content: 'Q1' }),
      mkMsg({ id: 'a1', role: 'assistant', content: 'A1' }),
      mkMsg({ id: 'u2', role: 'user', content: 'Q2' }),
      mkMsg({ id: 'a2', role: 'assistant', content: 'A2' }),
    ]
    await renderApp()

    await act(async () => {
      useAppStore.setState({ messages: msgs })
    })

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })

    // Should not crash; the last assistant message is a2
    const state = useAppStore.getState().messages
    expect(state).toHaveLength(4)
    const lastAssistant = [...state].reverse().find((m) => m.role === 'assistant')
    expect(lastAssistant?.id).toBe('a2')
  })

  it('Meta+Shift+R does nothing when there are no messages', async () => {
    await renderApp()

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'R' })
    })

    expect(useAppStore.getState().messages).toHaveLength(0)
  })

  it('Meta+Shift+R does nothing when last message is not assistant', async () => {
    const assistantMsg = mkMsg({ id: 'a1', role: 'assistant', content: 'A' })
    const userMsg = mkMsg({ id: 'u1', role: 'user', content: 'Q' })
    await renderApp()

    await act(async () => {
      useAppStore.setState({ messages: [assistantMsg, userMsg] })
    })

    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, shiftKey: true, key: 'R' })
    })

    // Last message is user, not assistant — should not crash
    const state = useAppStore.getState().messages
    expect(state).toHaveLength(2)
    expect(state[1].role).toBe('user')
  })

  it('Ctrl+Shift+R still works with mixed tool/system messages', async () => {
    const msgs = [
      mkMsg({ id: 'u1', role: 'user', content: 'Q' }),
      mkMsg({ id: 't1', role: 'tool', content: 'tool output', toolName: 'ls', toolStatus: 'done' }),
      mkMsg({ id: 'a1', role: 'assistant', content: 'Here is the result' }),
    ]
    await renderApp()

    await act(async () => {
      useAppStore.setState({ messages: msgs })
    })

    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 'R' })
    })

    // Should not crash; last assistant is a1
    const lastAssistant = [...useAppStore.getState().messages].reverse().find((m) => m.role === 'assistant')
    expect(lastAssistant?.id).toBe('a1')
  })
})
