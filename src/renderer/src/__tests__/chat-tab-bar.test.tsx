import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChatTabBar } from '@/components/ChatTabBar'

function mkTab(id: string, title: string, isSideChat = false) {
  return { id, title, isSideChat }
}

describe('ChatTabBar', () => {
  const defaultProps = {
    tabs: [],
    activeTabId: null,
    sideChatSessionId: null,
    onSelectTab: vi.fn(),
    onCloseTab: vi.fn(),
    onNewSideChat: vi.fn(),
  }

  it('renders plus button for new side chat', () => {
    render(<ChatTabBar {...defaultProps} />)
    const btn = screen.getByLabelText('New side chat')
    expect(btn).toBeDefined()
  })

  it('renders all tabs', () => {
    const tabs = [mkTab('s1', 'Chat 1'), mkTab('s2', 'Chat 2')]
    render(<ChatTabBar {...defaultProps} tabs={tabs} />)
    expect(screen.getByText('Chat 1')).toBeDefined()
    expect(screen.getByText('Chat 2')).toBeDefined()
  })

  it('highlights the active tab', () => {
    const tabs = [mkTab('s1', 'First'), mkTab('s2', 'Second')]
    render(<ChatTabBar {...defaultProps} tabs={tabs} activeTabId="s1" />)
    const btn = screen.getByText('First').closest('button')
    expect(btn?.className).toContain('surface-raised')
  })

  it('does not highlight the active tab when it is the side chat', () => {
    const tabs = [mkTab('s1', 'Main'), mkTab('sc1', 'Side', true)]
    render(<ChatTabBar {...defaultProps} tabs={tabs} activeTabId="s1" sideChatSessionId="sc1" />)
    const sideBtn = screen.getByText('↳ Side').closest('button')
    // Side chat tab should not have 'surface-raised' (only has bg-primary/5)
    expect(sideBtn?.className).not.toContain('surface-raised')
  })

  it('renders side chat tabs with panel icon and prefix', () => {
    const tabs = [mkTab('s1', 'Main'), mkTab('sc1', 'SideChat', true)]
    render(<ChatTabBar {...defaultProps} tabs={tabs} sideChatSessionId="sc1" />)
    // Side chat tab gets PanelRight icon — close button is nested inside it
    const closeBtn = screen.getByLabelText('Close SideChat')
    const tabBtn = closeBtn.parentElement
    expect(tabBtn?.querySelector('.lucide-panel-right')).toBeDefined()
    // Main tab gets MessageSquare icon
    const mainClose = screen.getByLabelText('Close Main')
    const mainBtn = mainClose.parentElement
    expect(mainBtn?.querySelector('.lucide-message-square')).toBeDefined()
  })

  it('calls onSelectTab when a tab is clicked', async () => {
    const onSelectTab = vi.fn()
    const tabs = [mkTab('s1', 'My Chat')]
    render(<ChatTabBar {...defaultProps} tabs={tabs} onSelectTab={onSelectTab} />)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText('My Chat'))
    expect(onSelectTab).toHaveBeenCalledWith('s1')
  })

  it('calls onNewSideChat when plus button clicked', async () => {
    const onNewSideChat = vi.fn()
    render(<ChatTabBar {...defaultProps} onNewSideChat={onNewSideChat} />)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByLabelText('New side chat'))
    expect(onNewSideChat).toHaveBeenCalledTimes(1)
  })

  it('calls onCloseTab when close button clicked', async () => {
    const onCloseTab = vi.fn()
    const tabs = [mkTab('s1', 'Close Me')]
    render(<ChatTabBar {...defaultProps} tabs={tabs} onCloseTab={onCloseTab} />)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByLabelText('Close Close Me'))
    expect(onCloseTab).toHaveBeenCalledWith('s1')
  })
})
