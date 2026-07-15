import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { MessageItem } from '../components/MessageItem'
import type { Message } from '@/types'

const mermaidRender = vi.fn()
const mermaidParse = vi.fn()

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: (...args: unknown[]) => mermaidParse(...args),
    render: (...args: unknown[]) => mermaidRender(...args),
  },
}))

function mkMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1', sessionId: 's1', role: 'assistant', content: '', createdAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MessageItem — mermaid diagram rendering', () => {
  it('renders a mermaid code block as a diagram once parsed and rendered successfully', async () => {
    mermaidParse.mockResolvedValue(true)
    mermaidRender.mockResolvedValue({ svg: '<svg data-testid="fake-diagram"></svg>' })

    render(<MessageItem message={mkMessage({ content: '```mermaid\ngraph TD; A-->B;\n```' })} />)

    await waitFor(() => expect(mermaidRender).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('[data-testid="fake-diagram"]')).toBeInTheDocument())
  })

  it('falls back to showing the raw source when the diagram fails to parse', async () => {
    mermaidParse.mockResolvedValue(false)

    render(<MessageItem message={mkMessage({ content: '```mermaid\nnot a real diagram\n```' })} />)

    await waitFor(() => expect(screen.getByText(/Diagram not ready yet/)).toBeInTheDocument())
    expect(screen.getByText('not a real diagram')).toBeInTheDocument()
    expect(mermaidRender).not.toHaveBeenCalled()
  })

  it('toggles between rendered preview and raw source', async () => {
    mermaidParse.mockResolvedValue(true)
    mermaidRender.mockResolvedValue({ svg: '<svg data-testid="fake-diagram"></svg>' })

    render(<MessageItem message={mkMessage({ content: '```mermaid\ngraph TD; A-->B;\n```' })} />)
    await waitFor(() => expect(document.querySelector('[data-testid="fake-diagram"]')).toBeInTheDocument())

    // Preview is the default; source is not shown
    expect(screen.queryByText('graph TD; A-->B;')).not.toBeInTheDocument()

    // Switch to code view — raw mermaid shown, diagram hidden but still mounted
    fireEvent.click(screen.getByRole('button', { name: 'Show mermaid source' }))
    expect(screen.getByText('graph TD; A-->B;')).toBeInTheDocument()
    const svgContainer = document.querySelector('[data-testid="fake-diagram"]')!.parentElement!
    expect(svgContainer.className).toContain('hidden')

    // Switch back without re-rendering mermaid
    fireEvent.click(screen.getByRole('button', { name: 'Show rendered diagram' }))
    expect(screen.queryByText('graph TD; A-->B;')).not.toBeInTheDocument()
    expect(svgContainer.className).not.toContain('hidden')
    expect(mermaidRender).toHaveBeenCalledTimes(1)
  })

  it('marks the active view with aria-pressed', async () => {
    mermaidParse.mockResolvedValue(true)
    mermaidRender.mockResolvedValue({ svg: '<svg></svg>' })

    render(<MessageItem message={mkMessage({ content: '```mermaid\ngraph TD; A-->B;\n```' })} />)
    await waitFor(() => expect(mermaidRender).toHaveBeenCalled())

    const previewBtn = screen.getByRole('button', { name: 'Show rendered diagram' })
    const codeBtn = screen.getByRole('button', { name: 'Show mermaid source' })
    expect(previewBtn).toHaveAttribute('aria-pressed', 'true')
    expect(codeBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(codeBtn)
    expect(previewBtn).toHaveAttribute('aria-pressed', 'false')
    expect(codeBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('copy button copies the mermaid source in either view', async () => {
    mermaidParse.mockResolvedValue(true)
    mermaidRender.mockResolvedValue({ svg: '<svg></svg>' })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<MessageItem message={mkMessage({ content: '```mermaid\ngraph TD; A-->B;\n```' })} />)
    await waitFor(() => expect(mermaidRender).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Show mermaid source' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy diagram source' }))
    expect(writeText).toHaveBeenCalledWith('graph TD; A-->B;')
  })

  it('does not treat a regular code block as a diagram', async () => {
    render(<MessageItem message={mkMessage({ content: '```ts\nconst x = 1\n```' })} />)
    await waitFor(() => expect(document.querySelector('code.hljs.language-ts')).toBeInTheDocument())
    expect(document.body.textContent).toContain('const x = 1')
    expect(mermaidParse).not.toHaveBeenCalled()
  })
})

describe('MessageItem — tool call elapsed counter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a live elapsed seconds counter when tool is running', () => {
    render(<MessageItem message={mkMessage({
      role: 'tool',
      toolName: 'bash',
      toolStatus: 'running',
      toolInput: '{"command": "npm test"}',
    })} />)

    // Initially 0s
    expect(screen.getByText('0s')).toBeInTheDocument()

    // Advance 3 seconds
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('3s')).toBeInTheDocument()

    // Advance 10 more seconds
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText('13s')).toBeInTheDocument()
  })

  it('shows completed tool call duration when done', () => {
    render(<MessageItem message={mkMessage({
      role: 'tool',
      toolName: 'readFile',
      toolStatus: 'done',
      toolInput: '{"path": "test.ts"}',
      duration: 2340,
    })} />)

    expect(screen.getByText('2.3s')).toBeInTheDocument()
  })

  it('shows only the tool name without elapsed or duration for an error tool call', () => {
    render(<MessageItem message={mkMessage({
      role: 'tool',
      toolName: 'bash',
      toolStatus: 'error',
      toolInput: '{"command": "invalid"}',
    })} />)

    expect(screen.getByText('bash')).toBeInTheDocument()
    expect(screen.queryByText(/^\d+(\.\d)?s$/)).not.toBeInTheDocument()
  })

  it('cleans up the interval when component unmounts', () => {
    const { unmount } = render(<MessageItem message={mkMessage({
      role: 'tool',
      toolName: 'bash',
      toolStatus: 'running',
      toolInput: '{}',
    })} />)

    expect(screen.getByText('0s')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('2s')).toBeInTheDocument()

    unmount()

    // After unmount, there should be no more re-renders — advance time and verify
    // there's no error (interval is cleared)
    act(() => { vi.advanceTimersByTime(5000) })
  })

  it('does not show duration when it is zero or undefined for done tools', () => {
    const { rerender } = render(<MessageItem message={mkMessage({
      role: 'tool',
      toolName: 'bash',
      toolStatus: 'done',
      toolInput: '{}',
      duration: 0,
    })} />)
    expect(screen.queryByText(/^\d+(\.\d)?s$/)).not.toBeInTheDocument()

    rerender(<MessageItem message={mkMessage({
      role: 'tool',
      toolName: 'bash',
      toolStatus: 'done',
      toolInput: '{}',
      duration: undefined,
    })} />)
    expect(screen.queryByText(/^\d+(\.\d)?s$/)).not.toBeInTheDocument()
  })
})
describe('MessageItem — tool call syntax highlighting', () => {
  it('shows tool input/output with highlight.js markup once expanded', () => {
    const message = mkMessage({
      role: 'tool',
      toolName: 'bash',
      toolStatus: 'done',
      toolInput: '{"command": "ls"}',
      toolOutput: 'file1.ts\nfile2.ts',
    })
    render(<MessageItem message={message} />)

    fireEvent.click(screen.getByText('bash'))

    const codeEls = document.querySelectorAll('code.hljs')
    expect(codeEls.length).toBe(2)
    expect(document.body.textContent).toContain('"command"')
    expect(document.body.textContent).toContain('file1.ts')
  })
})
