import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputBar } from '@/components/InputBar'
import type { FileNode } from '@/types'

const noop = (): void => {}

const defaultFileNodes: FileNode[] = [
  { name: 'src', path: '/test/src', type: 'directory', children: [
    { name: 'index.ts', path: '/test/src/index.ts', type: 'file' },
  ]},
]

function renderInputBar(overrides: Record<string, unknown> = {}): ReturnType<typeof render> {
  return render(
    <InputBar
      onSend={noop as any}
      fileNodes={defaultFileNodes}
      currentModel="gpt-4o"
      permissionMode="ask"
      agentMode="agent"
      onAgentModeChange={noop as any}
      {...overrides}
    />
  )
}

describe('Chat Mode Toggle', () => {
  it('renders Chat and Agent toggle buttons', () => {
    renderInputBar()
    expect(screen.getByText('Chat')).toBeDefined()
    expect(screen.getByText('Agent')).toBeDefined()
  })

  it('shows Agent as active by default', () => {
    renderInputBar()
    const agentBtn = screen.getByText('Agent')
    // Agent should be active (has the primary bg class)
    expect(agentBtn.className).toContain('bg-primary')
  })

  it('shows Chat as active when agentMode is chat', () => {
    renderInputBar({ agentMode: 'chat' })
    const chatBtn = screen.getByText('Chat')
    expect(chatBtn.className).toContain('bg-teal')
  })

  it('calls onAgentModeChange with chat when Chat is clicked', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ agentMode: 'agent', onAgentModeChange })
    fireEvent.click(screen.getByText('Chat'))
    expect(onAgentModeChange).toHaveBeenCalledWith('chat')
  })

  it('calls onAgentModeChange with agent when Agent is clicked', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ agentMode: 'chat', onAgentModeChange })
    fireEvent.click(screen.getByText('Agent'))
    expect(onAgentModeChange).toHaveBeenCalledWith('agent')
  })

  it('shows permission mode alongside the toggle', () => {
    renderInputBar({ permissionMode: 'auto' })
    // Permission mode label should still be visible
    expect(screen.getByText('Auto')).toBeDefined()
  })

  it('does not break when no onAgentModeChange is provided', () => {
    renderInputBar({ onAgentModeChange: undefined })
    fireEvent.click(screen.getByText('Chat'))
    // Should not throw
  })
})
