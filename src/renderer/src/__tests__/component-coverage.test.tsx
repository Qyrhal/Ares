import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useAppStore } from '@/store/useAppStore'
import { StatusBar } from '../components/StatusBar'
import { ActivityBar } from '../components/ActivityBar'
import { CommitDetail } from '../components/CommitDetail'
import { FileEditor } from '../components/FileEditor'
import { ErrorBoundary } from '../components/ErrorBoundary'

const el = window.electron as any

// ── StatusBar ────────────────────────────────────────────────────────────────

describe('StatusBar — smoke render', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] })
    el.checkpoint.list.mockResolvedValue([])
    el.mcp.status.mockResolvedValue([])
  })

  it('renders without crashing', () => {
    render(
      <StatusBar
        workspacePath={null}
        currentModel=""
        sessionCount={0}
      />,
    )
  })

  it('shows model name when provided', () => {
    render(
      <StatusBar
        workspacePath={null}
        currentModel="gpt-4o"
        sessionCount={1}
      />,
    )
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
  })

  it('shows session count', () => {
    render(
      <StatusBar
        workspacePath={null}
        currentModel=""
        sessionCount={3}
      />,
    )
    expect(screen.getByText(/3 sessions/)).toBeInTheDocument()
  })

  it('shows singular session for count of 1', () => {
    render(
      <StatusBar
        workspacePath={null}
        currentModel=""
        sessionCount={1}
      />,
    )
    expect(screen.getByText(/1 session$/)).toBeInTheDocument()
  })

  it('shows context usage when messages provided', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, sessionId: 's1', role: 'user' as const,
      content: 'x'.repeat(500), createdAt: 0,
    }))
    render(
      <StatusBar
        workspacePath={null}
        currentModel="gpt-4o"
        sessionCount={1}
        messages={msgs}
      />,
    )
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
  })

  it('renders with workspace path', () => {
    render(
      <StatusBar
        workspacePath="/home/user/project"
        currentModel="claude-3"
        sessionCount={2}
      />,
    )
    expect(screen.getByText('claude-3')).toBeInTheDocument()
  })
})

// ── ActivityBar ──────────────────────────────────────────────────────────────

describe('ActivityBar — smoke render', () => {
  it('renders all view buttons', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />,
    )
    expect(screen.getByTitle('Chat')).toBeInTheDocument()
    expect(screen.getByTitle('Explorer')).toBeInTheDocument()
    expect(screen.getByTitle('Source Control')).toBeInTheDocument()
    expect(screen.getByTitle('Extensions')).toBeInTheDocument()
    expect(screen.getByTitle('Settings')).toBeInTheDocument()
  })

  it('calls onChangeView when a view button is clicked', () => {
    const onChangeView = vi.fn()
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={onChangeView}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTitle('Explorer'))
    expect(onChangeView).toHaveBeenCalledWith('explorer')
  })

  it('calls onToggleTerminal when terminal button is clicked', () => {
    const onToggleTerminal = vi.fn()
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={onToggleTerminal}
      />,
    )
    fireEvent.click(screen.getByTitle(/Terminal/))
    expect(onToggleTerminal).toHaveBeenCalledTimes(1)
  })

  it('shows git badge when count > 0', () => {
    render(
      <ActivityBar
        activeView="git"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
        gitBadge={5}
      />,
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows agent badge when count > 0', () => {
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
        agentBadge={3}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows 99+ for badges over 99', () => {
    render(
      <ActivityBar
        activeView="git"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
        gitBadge={150}
      />,
    )
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('does not show badge when count is 0', () => {
    const { container } = render(
      <ActivityBar
        activeView="chat"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
        gitBadge={0}
      />,
    )
    const badgeEls = container.querySelectorAll('.rounded-full')
    expect(badgeEls.length).toBe(0)
  })

  it('highlights the active view button', () => {
    render(
      <ActivityBar
        activeView="git"
        onChangeView={vi.fn()}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />,
    )
    const gitBtn = screen.getByTitle('Source Control')
    expect(gitBtn.className).toContain('bg-primary/15')
  })

  it('clicking settings button calls onChangeView with settings', () => {
    const onChangeView = vi.fn()
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={onChangeView}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTitle('Settings'))
    expect(onChangeView).toHaveBeenCalledWith('settings')
  })

  it('clicking each view button calls onChangeView with correct view', () => {
    const onChangeView = vi.fn()
    render(
      <ActivityBar
        activeView="chat"
        onChangeView={onChangeView}
        terminalOpen={false}
        onToggleTerminal={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTitle('Chat'))
    expect(onChangeView).toHaveBeenCalledWith('chat')
    fireEvent.click(screen.getByTitle('Extensions'))
    expect(onChangeView).toHaveBeenCalledWith('extensions')
  })
})

// ── CommitDetail ─────────────────────────────────────────────────────────────

describe('CommitDetail — smoke render', () => {
  beforeEach(() => {
    useAppStore.setState({ commits: [], activeCommit: null })
  })

  it('returns null when no active commit', () => {
    const { container } = render(<CommitDetail />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when activeCommit does not match any commit', () => {
    useAppStore.setState({
      commits: [{ hash: 'abc', shortHash: 'abc', parents: [], author: 'me', date: '2024-01-01', message: 'Init' }],
      activeCommit: 'nonexistent',
    })
    const { container } = render(<CommitDetail />)
    expect(container.innerHTML).toBe('')
  })

  it('renders commit details when active commit is set', () => {
    useAppStore.setState({
      commits: [{
        hash: 'abc123def456',
        shortHash: 'abc123d',
        parents: ['parent123456'],
        author: 'Test Author',
        date: '2024-06-15T10:30:00Z',
        message: 'feat: add new feature',
      }],
      activeCommit: 'abc123def456',
    })
    render(<CommitDetail />)
    // Message appears in both header and body
    expect(screen.getAllByText('feat: add new feature').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('abc123d')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })

  it('close button calls setActiveCommit(null)', () => {
    useAppStore.setState({
      commits: [{
        hash: 'abc123', shortHash: 'abc123', parents: [],
        author: 'me', date: '2024-01-01', message: 'test',
      }],
      activeCommit: 'abc123',
    })
    render(<CommitDetail />)
    const closeBtn = screen.getByRole('button')
    fireEvent.click(closeBtn)
    expect(useAppStore.getState().activeCommit).toBeNull()
  })

  it('renders parents when present', () => {
    useAppStore.setState({
      commits: [{
        hash: 'abc123', shortHash: 'abc123',
        parents: ['def456789012', '789abc012345'],
        author: 'me', date: '2024-01-01', message: 'merge',
      }],
      activeCommit: 'abc123',
    })
    render(<CommitDetail />)
    expect(screen.getByText('def4567')).toBeInTheDocument()
    expect(screen.getByText('789abc0')).toBeInTheDocument()
  })

  it('hides parents section when parents array is empty', () => {
    useAppStore.setState({
      commits: [{
        hash: 'abc123', shortHash: 'abc123', parents: [],
        author: 'me', date: '2024-01-01', message: 'initial',
      }],
      activeCommit: 'abc123',
    })
    render(<CommitDetail />)
    expect(screen.queryByText('Parents:')).not.toBeInTheDocument()
  })
})

// ── FileEditor ───────────────────────────────────────────────────────────────

describe('FileEditor — smoke render', () => {
  beforeEach(() => {
    el.fs.readFile.mockResolvedValue('const x = 1\n')
    el.fs.writeFile.mockResolvedValue(undefined)
  })

  it('renders loading state initially (spinner visible)', () => {
    const { container } = render(<FileEditor path="/src/test.ts" />)
    // Loading state shows a Loader2 spinner with animate-spin class
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders file content after loading', async () => {
    el.fs.readFile.mockResolvedValue('hello world')
    const { container } = render(<FileEditor path="/src/test.ts" />)
    await vi.waitFor(() => {
      // Spinner disappears once content loads
      expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
    })
  })

  it('shows error content when readFile fails', async () => {
    el.fs.readFile.mockRejectedValue(new Error('ENOENT'))
    const { container } = render(<FileEditor path="/missing.ts" />)
    await vi.waitFor(() => {
      // After error, spinner is gone and content is set to '// Error reading file'
      expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
    })
  })

  it('shows file path in toolbar after loading', async () => {
    el.fs.readFile.mockResolvedValue('content')
    render(<FileEditor path="/src/App.tsx" />)
    await vi.waitFor(() => {
      expect(screen.getByText(/App\.tsx/)).toBeInTheDocument()
    })
  })

  it('renders toolbar buttons after loading', async () => {
    el.fs.readFile.mockResolvedValue('content')
    render(<FileEditor path="/src/index.ts" />)
    await vi.waitFor(() => {
      expect(screen.getByTitle('Copy path')).toBeInTheDocument()
      expect(screen.getByTitle('Delete file')).toBeInTheDocument()
    })
  })
})

// ── ErrorBoundary ────────────────────────────────────────────────────────────

describe('ErrorBoundary — smoke render', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders default error UI when child throws', () => {
    const ThrowingChild = () => {
      throw new Error('Test error message')
    }
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Component error')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('renders custom fallback when provided and child throws', () => {
    const ThrowingChild = () => {
      throw new Error('boom')
    }
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(screen.queryByText('Component error')).not.toBeInTheDocument()
  })

  it('Retry button clears error and re-renders children', () => {
    let shouldThrow = true
    const ConditionalChild = () => {
      if (shouldThrow) throw new Error('conditional error')
      return <div>Recovered</div>
    }
    render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Component error')).toBeInTheDocument()

    // Fix the error condition before clicking retry
    shouldThrow = false
    fireEvent.click(screen.getByText('Retry'))
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('does not render children after error until retry', () => {
    const ThrowingChild = () => {
      throw new Error('fail')
    }
    render(
      <ErrorBoundary>
        <ThrowingChild />
        <div>Second child</div>
      </ErrorBoundary>,
    )
    expect(screen.queryByText('Second child')).not.toBeInTheDocument()
    expect(screen.getByText('Component error')).toBeInTheDocument()
  })
})
