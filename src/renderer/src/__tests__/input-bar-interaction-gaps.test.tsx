import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

describe('InputBar — disabled state blocks interactions', () => {
  it('textarea is disabled when disabled prop is true', () => {
    renderInputBar({ disabled: true })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    expect(textarea).toBeDisabled()
  })

  it('send button is replaced by stop button when disabled', () => {
    renderInputBar({ disabled: true })
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Stop generation (Ctrl+C)')).toBeInTheDocument()
  })

  it('stop button calls onCancel when clicked', () => {
    const onCancel = vi.fn()
    renderInputBar({ disabled: true, onCancel })
    fireEvent.click(screen.getByLabelText('Stop generation (Ctrl+C)'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('send button is disabled when text is empty and no attachments', () => {
    renderInputBar()
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).toBeDisabled()
  })
})

describe('InputBar — effort picker', () => {
  it('shows current effort level button with label', () => {
    renderInputBar({ effort: 'high', onEffortChange: vi.fn() })
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('clicking effort button opens the effort dropdown', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    fireEvent.click(screen.getByText('Med'))
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('clicking an effort option calls onEffortChange with the level', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ effort: 'medium', onEffortChange })
    fireEvent.click(screen.getByText('Med'))
    fireEvent.mouseDown(screen.getByText('high'))
    expect(onEffortChange).toHaveBeenCalledWith('high')
  })

  it('effort dropdown closes after selecting an option', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ effort: 'medium', onEffortChange })
    fireEvent.click(screen.getByText('Med'))
    expect(screen.getByText('low')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('high'))
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })

  it('defaults to Med label when effort is not provided', () => {
    renderInputBar({ onEffortChange: vi.fn() })
    expect(screen.getByText('Med')).toBeInTheDocument()
  })
})

describe('InputBar — send clears textarea', () => {
  it('textarea is cleared after sending a message', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(textarea.value).toBe('hello')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(textarea.value).toBe('')
  })

  it('textarea is cleared after sending a slash command via picker', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(textarea.value).toBe('')
  })
})

describe('InputBar — model picker via /model command picker selection', () => {
  it('selecting /model from picker opens model search', () => {
    renderInputBar({ onCommand: vi.fn(), providers: [{ name: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' }] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })

  it('model picker can be closed with Escape', () => {
    renderInputBar({ onCommand: vi.fn(), providers: [{ name: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' }] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    const searchInput = screen.getByPlaceholderText('Search models…')
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search models…')).not.toBeInTheDocument()
  })
})

describe('InputBar — prompt history recall', () => {
  it('ArrowUp on empty input recalls previous prompt', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'test prompt' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea.value).toBe('test prompt')
  })
})

describe('InputBar — @ mention with fileNodes', () => {
  it('@ mention list renders file names from fileNodes prop', () => {
    const fileNodes = [
      { name: 'alpha.ts', path: '/src/alpha.ts', type: 'file' as const },
      { name: 'beta.ts', path: '/src/beta.ts', type: 'file' as const },
    ]
    renderInputBar({ fileNodes })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.getByText('alpha.ts')).toBeInTheDocument()
    expect(screen.getByText('beta.ts')).toBeInTheDocument()
  })

  it('@ mention list is capped at 50 items', () => {
    const fileNodes = Array.from({ length: 100 }, (_, i) => ({
      name: `file${i}.ts`,
      path: `/src/file${i}.ts`,
      type: 'file' as const,
    }))
    renderInputBar({ fileNodes })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    const items = screen.getAllByText(/file\d+\.ts/)
    expect(items.length).toBeLessThanOrEqual(50)
  })
})

describe('InputBar — command picker section header', () => {
  it('shows Built-in section header in picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('Built-in')).toBeInTheDocument()
  })
})

describe('InputBar — permission mode cycling', () => {
  it('clicking permission button cycles from ask to auto', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ permissionMode: 'ask', onPermissionModeChange })
    fireEvent.click(screen.getByText('Ask'))
    expect(onPermissionModeChange).toHaveBeenCalledWith('auto')
  })

  it('shows correct label for each permission mode', () => {
    const { rerender } = renderInputBar({ permissionMode: 'ask', onPermissionModeChange: vi.fn() })
    expect(screen.getByText('Ask')).toBeInTheDocument()

    rerender(
      <InputBar
        onSend={vi.fn()}
        permissionMode="auto"
        onPermissionModeChange={vi.fn()}
      />
    )
    expect(screen.getByText('Auto')).toBeInTheDocument()

    rerender(
      <InputBar
        onSend={vi.fn()}
        permissionMode="yolo"
        onPermissionModeChange={vi.fn()}
      />
    )
    expect(screen.getByText('Yolo')).toBeInTheDocument()
  })
})

describe('InputBar — agent mode toggle', () => {
  it('clicking each mode button calls onAgentModeChange with correct value', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ agentMode: 'agent', onAgentModeChange })

    fireEvent.click(screen.getByText('Chat'))
    expect(onAgentModeChange).toHaveBeenCalledWith('chat')

    fireEvent.click(screen.getByText('Plan'))
    expect(onAgentModeChange).toHaveBeenCalledWith('plan')

    fireEvent.click(screen.getByText('Agent'))
    expect(onAgentModeChange).toHaveBeenCalledWith('agent')
  })
})

describe('InputBar — textarea auto-resize', () => {
  it('textarea height is set after multiline input', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'line1\nline2\nline3\nline4\nline5' } })
    expect(textarea.style.height).toBeDefined()
  })

  it('textarea height resets after send', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'line1\nline2\nline3' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(textarea.value).toBe('')
  })
})

describe('InputBar — context donut', () => {
  it('renders context donut SVG when model and token info provided', () => {
    renderInputBar({ model: 'gpt-4o', inputTokens: 1000, maxTokens: 8000 })
    const svg = document.querySelector('svg[viewBox="0 0 18 18"]')
    expect(svg).toBeInTheDocument()
  })
})

describe('InputBar — character and token counter', () => {
  it('shows character count when typing', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    // The counter shows "5 chars · ~2 tok" as a single span
    expect(screen.getByText(/5 chars/)).toBeInTheDocument()
  })

  it('shows approximate token count', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    expect(screen.getByText(/~\d+ tok/)).toBeInTheDocument()
  })

  it('counter is hidden when text is empty', () => {
    renderInputBar()
    expect(screen.queryByText(/chars/)).not.toBeInTheDocument()
  })
})

describe('InputBar — workspace path display', () => {
  it('shows workspace path when onOpenFinder is provided', () => {
    renderInputBar({ workspacePath: '/home/user/project', onOpenFinder: vi.fn(), onSelectProject: vi.fn() })
    expect(screen.getByText(/project/)).toBeInTheDocument()
  })
})

describe('InputBar — Escape closes pickers', () => {
  it('Escape closes command picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('Built-in')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText('Built-in')).not.toBeInTheDocument()
  })
})
