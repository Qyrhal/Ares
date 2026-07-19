import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ChatView } from '../components/ChatView'
import { useAppStore } from '../store/useAppStore'

vi.mock('../components/MessageItem', () => ({
  MessageItem: ({ message }: { message: { content: string; role: string } }) => (
    <div data-testid="message-item">{message.content}</div>
  ),
}))

vi.mock('../components/TodoPanel', () => ({
  TodoPanel: () => <div data-testid="todo-panel" />,
}))

beforeEach(() => {
  useAppStore.setState({
    messages: [],
    isLoading: false,
    todos: undefined,
    settings: {
      apiKey: '',
      apiBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      themeId: 'red',
      systemPrompt: '',
      permissionMode: 'ask',
      providers: [],
      colorMode: 'dark',
    } as any,
    workspacePath: null,
  })
  vi.clearAllMocks()
})

describe('ChatView — empty state with capabilities', () => {
  it('renders the empty state when no messages and not loading', () => {
    render(
      <ChatView
        messages={[]}
        sessionTitle="Test Session"
        isLoading={false}
        onSuggestion={vi.fn()}
      />
    )
    expect(screen.getByText('Test Session')).toBeInTheDocument()
    expect(screen.getByText(/Start a conversation/)).toBeInTheDocument()
  })

  it('renders all 8 capability cards', () => {
    render(
      <ChatView
        messages={[]}
        sessionTitle="New Session"
        isLoading={false}
        onSuggestion={vi.fn()}
      />
    )
    const expectedLabels = [
      'Sub-agents',
      'Web Search',
      'Plan Mode',
      'Ask Questions',
      'Code Analysis',
      'File Operations',
      'Git Integration',
      'Terminal',
    ]
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('clicking a capability card calls onSuggestion with its prompt', () => {
    const onSuggestion = vi.fn()
    render(
      <ChatView
        messages={[]}
        sessionTitle="New"
        isLoading={false}
        onSuggestion={onSuggestion}
      />
    )
    fireEvent.click(screen.getByText('Sub-agents'))
    expect(onSuggestion).toHaveBeenCalledWith(
      expect.stringContaining('Spawn 3 sub-agents')
    )
  })

  it('clicking Web Search card sends web search prompt', () => {
    const onSuggestion = vi.fn()
    render(
      <ChatView
        messages={[]}
        sessionTitle="New"
        isLoading={false}
        onSuggestion={onSuggestion}
      />
    )
    fireEvent.click(screen.getByText('Web Search'))
    expect(onSuggestion).toHaveBeenCalledWith(
      expect.stringContaining('Search the web')
    )
  })

  it('does not render empty state when messages exist', () => {
    render(
      <ChatView
        messages={[
          {
            id: 'm1',
            sessionId: 's1',
            role: 'user',
            content: 'Hello',
            createdAt: Date.now(),
          },
        ]}
        sessionTitle="Chat"
        isLoading={false}
        onSuggestion={vi.fn()}
      />
    )
    expect(screen.queryByText(/Start a conversation/)).not.toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('does not render empty state when loading', () => {
    render(
      <ChatView
        messages={[]}
        sessionTitle="Chat"
        isLoading={true}
        onSuggestion={vi.fn()}
      />
    )
    expect(screen.queryByText(/Start a conversation/)).not.toBeInTheDocument()
  })

  it('renders capability badge text for each card', () => {
    render(
      <ChatView
        messages={[]}
        sessionTitle="New"
        isLoading={false}
        onSuggestion={vi.fn()}
      />
    )
    expect(screen.getByText('spawnAgent / spawnAgents')).toBeInTheDocument()
    expect(screen.getByText('webSearch')).toBeInTheDocument()
    expect(screen.getByText('setTodos')).toBeInTheDocument()
    expect(screen.getByText('askUser')).toBeInTheDocument()
    expect(screen.getByText('read / grep / bash')).toBeInTheDocument()
    expect(screen.getByText('write / edit / rename')).toBeInTheDocument()
    expect(screen.getByText('git status / log / diff')).toBeInTheDocument()
    expect(screen.getByText('bash in terminal')).toBeInTheDocument()
  })

  it('each capability card is a clickable button', () => {
    render(
      <ChatView
        messages={[]}
        sessionTitle="New"
        isLoading={false}
        onSuggestion={vi.fn()}
      />
    )
    const subAgentsBtn = screen.getByText('Sub-agents').closest('button')
    const webSearchBtn = screen.getByText('Web Search').closest('button')
    expect(subAgentsBtn).toBeTruthy()
    expect(webSearchBtn).toBeTruthy()
  })

  it('renders shimmer when isLoading and no messages', () => {
    render(
      <ChatView
        messages={[]}
        sessionTitle="Chat"
        isLoading={true}
        onSuggestion={vi.fn()}
      />
    )
    const shimmer = document.querySelector('.shimmer')
    expect(shimmer).toBeTruthy()
    expect(shimmer?.textContent).toContain('…')
  })

  it('renders message items when messages exist', () => {
    render(
      <ChatView
        messages={[
          {
            id: 'm1',
            sessionId: 's1',
            role: 'user',
            content: 'Hello world',
            createdAt: Date.now(),
          },
          {
            id: 'm2',
            sessionId: 's1',
            role: 'assistant',
            content: 'Hi there!',
            createdAt: Date.now(),
          },
        ]}
        sessionTitle="Chat"
        isLoading={false}
        onSuggestion={vi.fn()}
      />
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('shows todos panel when todos are provided', () => {
    render(
      <ChatView
        messages={[]}
        sessionTitle="Chat"
        isLoading={false}
        onSuggestion={vi.fn()}
        todos={[
          { id: 't1', sessionId: 's1', text: 'Task 1', completed: false, createdAt: Date.now() },
        ]}
      />
    )
    expect(screen.getByTestId('todo-panel')).toBeInTheDocument()
  })
})
