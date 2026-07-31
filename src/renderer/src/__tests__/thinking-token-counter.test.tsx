import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar, ThinkingBadge, estimateThinkingTokens } from '../components/StatusBar'
import type { Message } from '@/types'

vi.mock('@/lib/context', () => ({
  estimateTokens: vi.fn().mockReturnValue(0),
  contextWindow: vi.fn().mockReturnValue(128000),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const original = await importOriginal<typeof import('lucide-react')>()
  return {
    ...original,
    Loader2: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
      <svg className={className} data-testid="loader2-icon" {...props} />
    ),
  }
})

function makeAssistantMsg(thinking?: string, isStreaming = false): Message {
  return {
    id: 'm1',
    sessionId: 's1',
    role: 'assistant',
    content: '',
    thinking,
    isStreaming,
    createdAt: Date.now(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('estimateThinkingTokens', () => {
  it('returns 0 for undefined', () => {
    expect(estimateThinkingTokens(undefined)).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(estimateThinkingTokens('')).toBe(0)
  })

  it('estimates tokens using chars/4 heuristic', () => {
    // 8 chars → ceil(8/4) = 2 tokens
    expect(estimateThinkingTokens('12345678')).toBe(2)
  })

  it('rounds up fractional tokens', () => {
    // 5 chars → ceil(5/4) = 2 tokens
    expect(estimateThinkingTokens('12345')).toBe(2)
  })

  it('handles single character', () => {
    // 1 char → ceil(1/4) = 1 token
    expect(estimateThinkingTokens('a')).toBe(1)
  })

  it('handles longer text', () => {
    const text = 'Let me think about this step by step and consider all the options.'
    // 67 chars → ceil(67/4) = 17 tokens
    expect(estimateThinkingTokens(text)).toBe(17)
  })
})

describe('ThinkingBadge', () => {
  it('renders when text is provided', () => {
    render(<ThinkingBadge text="I am thinking..." />)
    expect(screen.getByText(/Thinking\.\.\./)).toBeInTheDocument()
  })

  it('shows correct token estimate', () => {
    // "I am thinking..." = 15 chars → ceil(15/4) = 4 tokens
    render(<ThinkingBadge text="I am thinking..." />)
    expect(screen.getByText(/~4 tok/)).toBeInTheDocument()
  })

  it('shows spinner icon', () => {
    const { container } = render(<ThinkingBadge text="thinking..." />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('has purple color styling', () => {
    render(<ThinkingBadge text="thinking..." />)
    const badge = screen.getByText(/Thinking\.\.\./).closest('.text-purple-400')
    expect(badge).toBeInTheDocument()
  })

  it('uses toLocaleString for large token counts', () => {
    // 10000 chars → ceil(10000/4) = 2500 tokens
    const longText = 'x'.repeat(10000)
    render(<ThinkingBadge text={longText} />)
    expect(screen.getByText(/~2,500 tok/)).toBeInTheDocument()
  })
})

describe('StatusBar with thinkingText', () => {
  const defaultProps = {
    workspacePath: '/home/user/project',
    currentModel: 'claude-3-opus',
    sessionCount: 1,
    messages: [] as Message[],
  }

  it('renders ThinkingBadge when thinkingText is provided', () => {
    render(
      <StatusBar
        {...defaultProps}
        thinkingText="Let me analyze the codebase..."
      />
    )
    expect(screen.getByText(/Thinking\.\.\./)).toBeInTheDocument()
  })

  it('does not render ThinkingBadge when thinkingText is undefined', () => {
    render(<StatusBar {...defaultProps} />)
    expect(screen.queryByText(/Thinking\.\.\./)).not.toBeInTheDocument()
  })

  it('does not render ThinkingBadge when thinkingText is empty string', () => {
    render(<StatusBar {...defaultProps} thinkingText="" />)
    expect(screen.queryByText(/Thinking\.\.\./)).not.toBeInTheDocument()
  })

  it('still renders other StatusBar elements alongside ThinkingBadge', () => {
    render(
      <StatusBar
        {...defaultProps}
        thinkingText="thinking..."
        messages={[makeAssistantMsg('thinking...', true)]}
      />
    )
    // Shows thinking badge
    expect(screen.getByText(/Thinking\.\.\./)).toBeInTheDocument()
    // Shows workspace
    expect(screen.getByText('/home/user/project')).toBeInTheDocument()
    // Shows model
    expect(screen.getByText('claude-3-opus')).toBeInTheDocument()
    // Shows session count
    expect(screen.getByText('1 session')).toBeInTheDocument()
  })
})
