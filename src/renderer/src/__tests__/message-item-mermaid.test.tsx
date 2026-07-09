import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  it('does not treat a regular code block as a diagram', async () => {
    render(<MessageItem message={mkMessage({ content: '```ts\nconst x = 1\n```' })} />)
    await waitFor(() => expect(document.querySelector('code.hljs.language-ts')).toBeInTheDocument())
    expect(document.body.textContent).toContain('const x = 1')
    expect(mermaidParse).not.toHaveBeenCalled()
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
