import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { StatusBar } from '@/components/StatusBar'

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(
      <StatusBar workspacePath={null} currentModel="gpt-4o" sessionCount={0} />
    )
    expect(container).toBeDefined()
  })

  it('shows workspace path when provided', () => {
    render(
      <StatusBar workspacePath="/home/user/project" currentModel="gpt-4o" sessionCount={2} />
    )
    expect(screen.getByText('/home/user/project')).toBeDefined()
  })

  it('shows "No folder" when workspacePath is null', () => {
    render(
      <StatusBar workspacePath={null} currentModel="gpt-4o" sessionCount={0} />
    )
    expect(screen.getByText('No folder')).toBeDefined()
  })

  it('shows current model name', () => {
    render(
      <StatusBar workspacePath={null} currentModel="claude-3-opus" sessionCount={0} />
    )
    expect(screen.getByText('claude-3-opus')).toBeDefined()
  })

  it('truncates long model names', () => {
    render(
      <StatusBar workspacePath={null} currentModel="very-long-model-name-that-exceeds-twenty-chars" sessionCount={0} />
    )
    expect(screen.getByText(/very-long-model/)).toBeDefined()
    expect(screen.getByText(/…/)).toBeDefined()
  })

  it('shows session count', () => {
    const { container } = render(
      <StatusBar workspacePath={null} currentModel="gpt-4o" sessionCount={5} />
    )
    const sessionSpan = container.querySelector('.shrink-0:last-child')
    expect(sessionSpan?.textContent).toContain('5')
  })

  it('shows singular session count', () => {
    const { container } = render(
      <StatusBar workspacePath={null} currentModel="gpt-4o" sessionCount={1} />
    )
    const sessionSpan = container.querySelector('.shrink-0:last-child')
    expect(sessionSpan?.textContent).toContain('1')
  })

  it('polls checkpoint count when workspacePath is set', () => {
    const el = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const checkpoint = (el as Record<string, Record<string, unknown>>).checkpoint
    checkpoint.list = vi.fn().mockResolvedValue([{ id: 'stash@{0}', index: 0, message: 'cp1', date: '', branch: 'main' }])

    render(
      <StatusBar workspacePath="/project" currentModel="gpt-4o" sessionCount={0} />
    )
    expect(checkpoint.list).toHaveBeenCalledWith('/project')
  })

  it('skips checkpoint poll when workspacePath is null', () => {
    const el = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const checkpoint = (el as Record<string, Record<string, unknown>>).checkpoint
    checkpoint.list = vi.fn()

    render(
      <StatusBar workspacePath={null} currentModel="gpt-4o" sessionCount={0} />
    )
    expect(checkpoint.list).not.toHaveBeenCalled()
  })

  it('shows MCP status when connected', async () => {
    const el = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const mcp = (el as Record<string, Record<string, unknown>>).mcp
    mcp.status = vi.fn().mockResolvedValue([
      { name: 'server1', connected: true, toolCount: 3 },
      { name: 'server2', connected: true, toolCount: 2 },
    ])

    render(
      <StatusBar workspacePath={null} currentModel="gpt-4o" sessionCount={0} />
    )
    await waitFor(() => {
      expect(screen.getByText('2/2')).toBeDefined()
    })
  })

  it('shows MCP status when partially connected', async () => {
    const el = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const mcp = (el as Record<string, Record<string, unknown>>).mcp
    mcp.status = vi.fn().mockResolvedValue([
      { name: 'server1', connected: true, toolCount: 3 },
      { name: 'server2', connected: false, toolCount: 0, error: 'timeout' },
    ])

    render(
      <StatusBar workspacePath={null} currentModel="gpt-4o" sessionCount={0} />
    )
    await waitFor(() => {
      expect(screen.getByText('1/2')).toBeDefined()
    })
  })
})
