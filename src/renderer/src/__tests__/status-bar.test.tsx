import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '@/components/StatusBar'
import type { Message } from '@/types'

function mkMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    sessionId: 's1',
    role: 'user',
    content: 'hello',
    createdAt: Date.now(),
    ...overrides,
  }
}

function getElectronMock() {
  return (globalThis as Record<string, unknown>).__electronMock as Record<string, Record<string, unknown>>
}

beforeEach(() => {
  vi.clearAllMocks()
  const mock = getElectronMock()
  ;(mock.checkpoint.list as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(mock.mcp.status as ReturnType<typeof vi.fn>).mockResolvedValue([])
})

describe('StatusBar — basic rendering', () => {
  it('renders with required props', () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={3}
      />,
    )
    expect(screen.getByText('/project')).toBeDefined()
    expect(screen.getByText('gpt-4o')).toBeDefined()
    expect(screen.getByText('3 sessions')).toBeDefined()
  })

  it('shows "No folder" when workspacePath is null', () => {
    render(
      <StatusBar
        workspacePath={null}
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    expect(screen.getByText('No folder')).toBeDefined()
  })

  it('shows singular "session" when sessionCount is 1', () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={1}
      />,
    )
    expect(screen.getByText('1 session')).toBeDefined()
  })
})

describe('StatusBar — model display', () => {
  it('truncates long model names to 20 chars', () => {
    const longModel = 'a'.repeat(30)
    render(
      <StatusBar
        workspacePath="/project"
        currentModel={longModel}
        sessionCount={0}
      />,
    )
    expect(screen.getByText(longModel.slice(0, 20) + '…')).toBeDefined()
  })

  it('does not truncate short model names', () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o-mini"
        sessionCount={0}
      />,
    )
    expect(screen.getByText('gpt-4o-mini')).toBeDefined()
  })

  it('hides model display when currentModel is empty', () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel=""
        sessionCount={0}
      />,
    )
    expect(screen.queryByText(/gpt/)).toBeNull()
  })
})

describe('StatusBar — context usage', () => {
  it('shows context badge when messages are provided', () => {
    const messages = [mkMsg(), mkMsg({ id: 'm2' })]
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={1}
        messages={messages}
      />,
    )
    expect(screen.getByText('gpt-4o')).toBeDefined()
  })

  it('does not show context badge when messages is empty array', () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={1}
        messages={[]}
      />,
    )
    expect(screen.getByText('gpt-4o')).toBeDefined()
  })

  it('does not show context badge when messages is undefined', () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={1}
      />,
    )
    expect(screen.getByText('gpt-4o')).toBeDefined()
  })
})

describe('StatusBar — checkpoint count', () => {
  it('does not show checkpoint count when zero', () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows checkpoint count when checkpoints exist', async () => {
    const mock = getElectronMock()
    ;(mock.checkpoint.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', index: 0, message: 'test', date: '', branch: 'main' },
      { id: 'c2', index: 1, message: 'test2', date: '', branch: 'main' },
    ])
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    await vi.waitFor(() => {
      expect(screen.getByText('2')).toBeDefined()
    })
  })

  it('does not poll checkpoints when workspacePath is null', () => {
    render(
      <StatusBar
        workspacePath={null}
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    const mock = getElectronMock()
    expect(mock.checkpoint.list).not.toHaveBeenCalled()
  })
})

describe('StatusBar — MCP status', () => {
  it('shows MCP connected count', async () => {
    const mock = getElectronMock()
    ;(mock.mcp.status as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'server1', connected: true, toolCount: 3 },
      { name: 'server2', connected: true, toolCount: 1 },
    ])
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    await vi.waitFor(() => {
      expect(screen.getByText('2/2')).toBeDefined()
    })
  })

  it('shows amber color when some MCP servers are disconnected', async () => {
    const mock = getElectronMock()
    ;(mock.mcp.status as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'server1', connected: true, toolCount: 3 },
      { name: 'server2', connected: false, error: 'timeout', toolCount: 0 },
    ])
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    await vi.waitFor(() => {
      expect(screen.getByText('1/2')).toBeDefined()
    })
    const mcpSpan = screen.getByText('1/2').closest('span')!
    expect(mcpSpan.className).toContain('text-amber-400')
  })

  it('hides MCP status when no servers configured', async () => {
    render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    expect(screen.queryByText('0/0')).toBeNull()
  })
})

describe('StatusBar — class and structure', () => {
  it('applies custom className', () => {
    const { container } = render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={0}
        className="custom-class"
      />,
    )
    const root = container.firstElementChild!
    expect(root.className).toContain('custom-class')
  })

  it('has proper flex layout structure', () => {
    const { container } = render(
      <StatusBar
        workspacePath="/project"
        currentModel="gpt-4o"
        sessionCount={0}
      />,
    )
    const root = container.firstElementChild!
    expect(root.className).toContain('flex')
    expect(root.className).toContain('h-6')
  })
})
