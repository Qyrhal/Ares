import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { TabBar } from '../components/TabBar'
import type { Tab } from '@/types'

const sessionTab: Tab = { type: 'session', id: 's1', title: 'My Session' }
const fileTab: Tab = { type: 'file', path: '/src/app.tsx', name: 'app.tsx', isDirty: false }
const dirtyFileTab: Tab = { type: 'file', path: '/src/index.ts', name: 'index.ts', isDirty: true }

describe('TabBar — isolated unit tests', () => {
  it('renders the tab bar container', () => {
    render(
      <TabBar tabs={[]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
  })

  it('renders new session button', () => {
    render(
      <TabBar tabs={[]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    expect(screen.getByLabelText('New session')).toBeInTheDocument()
  })

  it('calls onNewSession when new session button is clicked', () => {
    const onNewSession = vi.fn()
    render(
      <TabBar tabs={[]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={onNewSession} />
    )
    fireEvent.click(screen.getByLabelText('New session'))
    expect(onNewSession).toHaveBeenCalledTimes(1)
  })

  it('renders session tab with title', () => {
    render(
      <TabBar tabs={[sessionTab]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    expect(screen.getByText('My Session')).toBeInTheDocument()
  })

  it('renders file tab with name', () => {
    render(
      <TabBar tabs={[fileTab]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    expect(screen.getByText('app.tsx')).toBeInTheDocument()
  })

  it('calls onSelectTab with session id when session tab is clicked', () => {
    const onSelectTab = vi.fn()
    render(
      <TabBar tabs={[sessionTab]} activeTabId={null} onSelectTab={onSelectTab} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    fireEvent.click(screen.getByText('My Session'))
    expect(onSelectTab).toHaveBeenCalledWith('s1')
  })

  it('calls onSelectTab with file path when file tab is clicked', () => {
    const onSelectTab = vi.fn()
    render(
      <TabBar tabs={[fileTab]} activeTabId={null} onSelectTab={onSelectTab} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    fireEvent.click(screen.getByText('app.tsx'))
    expect(onSelectTab).toHaveBeenCalledWith('/src/app.tsx')
  })

  it('active tab gets surface-raised class', () => {
    render(
      <TabBar tabs={[sessionTab]} activeTabId="s1" onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    const tabBtn = screen.getByText('My Session').closest('button')!
    expect(tabBtn.className).toContain('surface-raised')
  })

  it('inactive tab does not have surface-raised class', () => {
    render(
      <TabBar tabs={[sessionTab]} activeTabId="other" onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    const tabBtn = screen.getByText('My Session').closest('button')!
    expect(tabBtn.className).not.toContain('surface-raised')
  })

  it('active tab shows primary top bar indicator', () => {
    const { container } = render(
      <TabBar tabs={[sessionTab]} activeTabId="s1" onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    const indicator = container.querySelector('[class*="bg-primary"][class*="h-\\[2px\\]"]')
    expect(indicator).toBeInTheDocument()
  })

  it('shows dirty indicator for dirty file tabs', () => {
    const { container } = render(
      <TabBar tabs={[dirtyFileTab]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    const dirtyDot = container.querySelector('[class*="bg-amber-400"]')
    expect(dirtyDot).toBeInTheDocument()
  })

  it('does NOT show dirty indicator for clean file tabs', () => {
    const { container } = render(
      <TabBar tabs={[fileTab]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    const dirtyDot = container.querySelector('[class*="bg-amber-400"]')
    expect(dirtyDot).not.toBeInTheDocument()
  })

  it('does NOT show dirty indicator for session tabs', () => {
    const { container } = render(
      <TabBar tabs={[sessionTab]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    const dirtyDot = container.querySelector('[class*="bg-amber-400"]')
    expect(dirtyDot).not.toBeInTheDocument()
  })

  it('close button calls onCloseTab with correct id', () => {
    const onCloseTab = vi.fn()
    render(
      <TabBar tabs={[sessionTab]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={onCloseTab} onNewSession={vi.fn()} />
    )
    const closeBtn = screen.getByLabelText('Close tab')
    fireEvent.click(closeBtn)
    expect(onCloseTab).toHaveBeenCalledWith('s1')
  })

  it('close button does not trigger onSelectTab (stopPropagation)', () => {
    const onSelectTab = vi.fn()
    const onCloseTab = vi.fn()
    render(
      <TabBar tabs={[sessionTab]} activeTabId={null} onSelectTab={onSelectTab} onCloseTab={onCloseTab} onNewSession={vi.fn()} />
    )
    const closeBtn = screen.getByLabelText('Close tab')
    fireEvent.click(closeBtn)
    expect(onSelectTab).not.toHaveBeenCalled()
    expect(onCloseTab).toHaveBeenCalledWith('s1')
  })

  it('truncates long tab labels', () => {
    const longTab: Tab = { type: 'session', id: 's2', title: 'A very long session name that should be truncated' }
    render(
      <TabBar tabs={[longTab]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    // The title should be truncated to 20 chars by the truncate() utility + '…'
    const labelEl = screen.getByText('A very long session …')
    expect(labelEl).toBeInTheDocument()
  })

  it('renders multiple tabs', () => {
    render(
      <TabBar
        tabs={[sessionTab, fileTab]}
        activeTabId={null}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onNewSession={vi.fn()}
      />
    )
    expect(screen.getByText('My Session')).toBeInTheDocument()
    expect(screen.getByText('app.tsx')).toBeInTheDocument()
  })

  it('renders with empty tabs array', () => {
    render(
      <TabBar tabs={[]} activeTabId={null} onSelectTab={vi.fn()} onCloseTab={vi.fn()} onNewSession={vi.fn()} />
    )
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
    expect(screen.queryByLabelText('Close tab')).not.toBeInTheDocument()
  })
})
