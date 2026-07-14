import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ActivityBar } from '@/components/ActivityBar'

describe('ActivityBar', () => {
  it('renders all activity buttons', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />
    )
    expect(screen.getByTitle('Chat')).toBeDefined()
    expect(screen.getByTitle('Explorer')).toBeDefined()
    expect(screen.getByTitle('Source Control')).toBeDefined()
    expect(screen.getByTitle('Extensions')).toBeDefined()
    expect(screen.getByTitle('Terminal (⌘` / ⌘J)')).toBeDefined()
    expect(screen.getByTitle('Settings')).toBeDefined()
  })

  it('highlights active view button', () => {
    render(
      <ActivityBar
        activeView="explorer"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />
    )
    // The Explorer button should have the active styling class
    const btn = screen.getByTitle('Explorer')
    expect(btn.className).toContain('bg-primary/15')
    expect(btn.className).toContain('text-primary')
  })

  it('does not highlight inactive view button', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />
    )
    const explorerBtn = screen.getByTitle('Explorer')
    expect(explorerBtn.className).not.toContain('bg-primary/15')
  })

  it('calls onChangeView when a view button is clicked', async () => {
    const onChangeView = vi.fn()
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={onChangeView}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />
    )
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByTitle('Explorer'))
    expect(onChangeView).toHaveBeenCalledWith('explorer')
  })

  it('calls onChangeView with settings when settings clicked', async () => {
    const onChangeView = vi.fn()
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={onChangeView}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />
    )
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByTitle('Settings'))
    expect(onChangeView).toHaveBeenCalledWith('settings')
  })

  it('highlights terminal button when terminal is open', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={true}
        onToggleTerminal={vi.fn()}
      />
    )
    const termBtn = screen.getByTitle('Terminal (⌘` / ⌘J)')
    expect(termBtn.className).toContain('bg-primary/15')
    expect(termBtn.className).toContain('text-primary')
  })

  it('does not highlight terminal button when terminal is closed', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />
    )
    const termBtn = screen.getByTitle('Terminal (⌘` / ⌘J)')
    expect(termBtn.className).not.toContain('bg-primary/15')
  })

  it('shows git badge when gitBadge > 0', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
        gitBadge={3}
      />
    )
    const sourceControlBtn = screen.getByTitle('Source Control')
    expect(sourceControlBtn.textContent).toContain('3')
  })

  it('shows agent badge when agentBadge > 0', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
        agentBadge={2}
      />
    )
    const chatBtn = screen.getByTitle('Chat')
    expect(chatBtn.textContent).toContain('2')
  })

  it('shows 99+ when badge exceeds 99', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
        gitBadge={150}
      />
    )
    const sourceControlBtn = screen.getByTitle('Source Control')
    expect(sourceControlBtn.textContent).toContain('99+')
  })

  it('calls onToggleTerminal when terminal button clicked', async () => {
    const onToggleTerminal = vi.fn()
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={onToggleTerminal}
      />
    )
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByTitle('Terminal (⌘` / ⌘J)'))
    expect(onToggleTerminal).toHaveBeenCalled()
  })
})
