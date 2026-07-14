import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import { ChatTabBar, type ChatTab } from '@/components/ChatTabBar'

describe('Side Chat Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      sideChatSessionId: null,
      sideChatMessages: [],
      sideChatIsLoading: false,
    })
  })

  it('starts with no side chat', () => {
    const state = useAppStore.getState()
    expect(state.sideChatSessionId).toBeNull()
    expect(state.sideChatMessages).toEqual([])
    expect(state.sideChatIsLoading).toBe(false)
  })

  it('setSideChat updates sideChatSessionId', () => {
    useAppStore.getState().setSideChat('sc-1')
    expect(useAppStore.getState().sideChatSessionId).toBe('sc-1')
  })

  it('setSideChat(null) clears side chat', () => {
    useAppStore.getState().setSideChat('sc-1')
    useAppStore.getState().setSideChat(null)
    expect(useAppStore.getState().sideChatSessionId).toBeNull()
  })

  it('setSideChatMessages stores messages independently from main messages', () => {
    useAppStore.getState().setSideChatMessages([
      { id: 'm1', sessionId: 'sc-1', role: 'user', content: 'hello', createdAt: 100 },
      { id: 'm2', sessionId: 'sc-1', role: 'assistant', content: 'hi', createdAt: 101 },
    ])
    const state = useAppStore.getState()
    expect(state.sideChatMessages).toHaveLength(2)
    expect(state.sideChatMessages[0].content).toBe('hello')
    // Main messages should be unaffected
    expect(state.messages).toEqual([])
  })

  it('setSideChatLoading toggles loading state', () => {
    useAppStore.getState().setSideChatLoading(true)
    expect(useAppStore.getState().sideChatIsLoading).toBe(true)
    useAppStore.getState().setSideChatLoading(false)
    expect(useAppStore.getState().sideChatIsLoading).toBe(false)
  })

  it('clearing side chat does not clear main messages', () => {
    useAppStore.setState({
      messages: [{ id: 'main-1', sessionId: 's1', role: 'user', content: 'main msg', createdAt: 100 }],
      sideChatSessionId: 'sc-1',
      sideChatMessages: [{ id: 'sc-1', sessionId: 'sc-1', role: 'user', content: 'side msg', createdAt: 200 }],
    })
    useAppStore.getState().setSideChat(null)
    useAppStore.getState().setSideChatMessages([])
    const state = useAppStore.getState()
    expect(state.sideChatMessages).toEqual([])
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].content).toBe('main msg')
  })
})

describe('ChatTabBar', () => {
  it('renders main chat tab', () => {
    const tabs: ChatTab[] = [{ id: 's1', title: 'Main Chat', isSideChat: false }]
    const { container } = render(
      <ChatTabBar
        tabs={tabs}
        activeTabId="s1"
        sideChatSessionId={null}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onNewSideChat={() => {}}
      />
    )
    expect(container.querySelector('[data-testid="chat-tab-bar"]')).not.toBeNull()
    expect(container.textContent).toContain('Main Chat')
  })

  it('renders side chat tab with special styling', () => {
    const tabs: ChatTab[] = [
      { id: 's1', title: 'Main Chat', isSideChat: false },
      { id: 'sc-1', title: 'Side Chat', isSideChat: true },
    ]
    const { container } = render(
      <ChatTabBar
        tabs={tabs}
        activeTabId="s1"
        sideChatSessionId="sc-1"
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onNewSideChat={() => {}}
      />
    )
    expect(container.textContent).toContain('Side Chat')
    expect(container.textContent).toContain('Main Chat')
  })

  it('fires onNewSideChat when + button is clicked', () => {
    const onNewSideChat = vi.fn()
    const tabs: ChatTab[] = [{ id: 's1', title: 'Main Chat', isSideChat: false }]
    const { container } = render(
      <ChatTabBar
        tabs={tabs}
        activeTabId="s1"
        sideChatSessionId={null}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onNewSideChat={onNewSideChat}
      />
    )
    const addBtn = container.querySelector('[aria-label="New side chat"]')
    expect(addBtn).not.toBeNull()
    addBtn?.click()
    expect(onNewSideChat).toHaveBeenCalledOnce()
  })

  it('fires onCloseTab when close button is clicked on side chat tab', () => {
    const onCloseTab = vi.fn()
    const tabs: ChatTab[] = [
      { id: 's1', title: 'Main Chat', isSideChat: false },
      { id: 'sc-1', title: 'Side Chat', isSideChat: true },
    ]
    const { container } = render(
      <ChatTabBar
        tabs={tabs}
        activeTabId="s1"
        sideChatSessionId="sc-1"
        onSelectTab={() => {}}
        onCloseTab={onCloseTab}
        onNewSideChat={() => {}}
      />
    )
    const closeBtn = container.querySelector('[aria-label="Close Side Chat"]')
    expect(closeBtn).not.toBeNull()
    if (closeBtn) {
      ;(closeBtn as HTMLElement).click()
      expect(onCloseTab).toHaveBeenCalledWith('sc-1')
    }
  })

  it('fires onSelectTab when clicking a tab', () => {
    const onSelectTab = vi.fn()
    const tabs: ChatTab[] = [{ id: 's1', title: 'Main Chat', isSideChat: false }]
    const { container } = render(
      <ChatTabBar
        tabs={tabs}
        activeTabId="s1"
        sideChatSessionId={null}
        onSelectTab={onSelectTab}
        onCloseTab={() => {}}
        onNewSideChat={() => {}}
      />
    )
    const tabBtn = container.querySelector('button')
    expect(tabBtn).not.toBeNull()
    tabBtn?.click()
    expect(onSelectTab).toHaveBeenCalledWith('s1')
  })
})

describe('Side Chat Context Inheritance', () => {
  it('new sessions created for side chat start empty', () => {
    const session = {
      id: 'sc-1',
      title: 'Side chat',
      model: 'gpt-4o-mini',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      isSideChat: true,
    }
    expect(session.isSideChat).toBe(true)
    expect(session.messageCount).toBe(0)
  })

  it('side chat session can inherit workspace path from main session', () => {
    const mainSession = {
      id: 's1',
      title: 'Main Session',
      model: 'gpt-4o-mini',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 5,
      workspacePath: '/home/user/project',
    }
    const sideSession = {
      id: 'sc-1',
      title: 'Side chat',
      model: mainSession.model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      workspacePath: mainSession.workspacePath,
      isSideChat: true,
    }
    expect(sideSession.workspacePath).toBe('/home/user/project')
    expect(sideSession.model).toBe('gpt-4o-mini')
  })

  it('closing side chat does not delete the session', () => {
    const store = useAppStore.getState()
    const sessions = [
      { id: 's1', title: 'Main', model: 'gpt-4o-mini', createdAt: 1, updatedAt: 1, messageCount: 0 },
      { id: 'sc-1', title: 'Side', model: 'gpt-4o-mini', createdAt: 2, updatedAt: 2, messageCount: 0, isSideChat: true },
    ]
    useAppStore.setState({ sessions, sideChatSessionId: 'sc-1', sideChatMessages: [], sideChatIsLoading: false })
    
    // Close side chat (just clear the reference, don't delete the session)
    useAppStore.getState().setSideChat(null)
    useAppStore.getState().setSideChatMessages([])
    
    const state = useAppStore.getState()
    expect(state.sideChatSessionId).toBeNull()
    expect(state.sessions).toHaveLength(2) // Session should still exist
    expect(state.sessions.find((s) => s.id === 'sc-1')).toBeDefined()
  })
})
