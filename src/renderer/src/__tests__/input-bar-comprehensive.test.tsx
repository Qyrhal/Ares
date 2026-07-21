import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'
import type { PiSkill, SlashCommand } from '../types'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

describe('InputBar — rendering', () => {
  it('renders textarea and send button', () => {
    renderInputBar()
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })

  it('shows placeholder prop override', () => {
    renderInputBar({ placeholder: 'Type a message…' })
    expect(screen.getByPlaceholderText('Type a message…')).toBeInTheDocument()
  })

  it('shows reply chip when replyTo is set', () => {
    renderInputBar({
      replyTo: { id: 'm1', content: 'Hello world', role: 'user' },
      onCancelReply: vi.fn(),
    })
    expect(screen.getByText('Replying to You')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('disables textarea when disabled prop is set', () => {
    renderInputBar({ disabled: true })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    expect(textarea).toBeDisabled()
  })

  it('shows cancel button when disabled (loading state)', () => {
    renderInputBar({ disabled: true })
    expect(screen.getByLabelText('Stop generation (Ctrl+C)')).toBeInTheDocument()
  })
})

describe('InputBar — send interaction', () => {
  it('calls onSend when Enter is pressed', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello', [], undefined)
  })

  it('does not call onSend with empty text', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('inserts newline on Shift+Enter', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'line1' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('InputBar — attachments', () => {
  it('shows file input for attachments', () => {
    renderInputBar()
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })
})

describe('InputBar — slash commands', () => {
  it('shows command list when / is typed at line start', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
  })

  it('filters commands as user types', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/cl' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('passes lowercased cmdName for uppercase slash commands', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/CLEAR' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('passes lowercased cmdName for mixed-case slash commands', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/Model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('shows /helpful in the command picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/helpful' } })
    const items = screen.getAllByText('/helpful')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('shows /not-helpful in the command picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/not' } })
    expect(screen.getByText('/not-helpful')).toBeInTheDocument()
  })

  it('calls onCommand with helpful when /helpful is entered', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/helpful' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('helpful', '')
  })

  it('calls onCommand with not-helpful when /not-helpful is entered', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/not-helpful' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('not-helpful', '')
  })

  it('shows /pr in the command picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/pr' } })
    const items = screen.getAllByText('/pr')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onCommand with pr when /pr is entered', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/pr' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('pr', '')
  })
})

describe('InputBar — slash command picker lifecycle', () => {
  it('shows all available commands initially when / is typed', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    expect(screen.getByText('/clear')).toBeInTheDocument()
    expect(screen.getByText('/fork')).toBeInTheDocument()
    expect(screen.getByText('/commit')).toBeInTheDocument()
  })

  it('filters to matching commands when typing after /', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/commit')).not.toBeInTheDocument()
  })

  it('shows all commands again when filter is cleared back to /', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    expect(screen.queryByText('/commit')).not.toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/commit')).toBeInTheDocument()
  })

  it('does NOT open picker when / is typed mid-line', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello /world' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('does NOT open picker when / is typed after a space on the same line', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'test /cmd' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('closes picker when Escape is pressed', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
  })

  it('re-opens picker correctly after being closed and re-typing /', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getAllByText('/model').length).toBeGreaterThanOrEqual(1)
    fireEvent.keyDown(textarea, { key: 'Escape' })
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.change(textarea, { target: { value: '/help' } })
    const items = screen.getAllByText('/help')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('opens picker for commands on subsequent lines', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello\n/mod' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
  })
})

describe('InputBar — keyboard navigation in picker', () => {
  it('Arrow Down moves highlight down in picker without crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
  })

  it('Arrow Up moves highlight up in picker without crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
  })

  it('Enter on highlighted command executes it', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Tab on highlighted command executes it', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})

describe('InputBar — slash command dispatch', () => {
  it('dispatches /clear as onCommand clear', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('dispatches /fork as onCommand fork', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/fork' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('fork', '')
  })

  it('dispatches /commit via send button', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/commit' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('commit', '')
  })

  it('dispatches /rename with args', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/rename My Session' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('rename', 'My Session')
  })

  it('dispatches /model with args', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('sends message normally when no / at start', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello world', [], undefined)
  })
})

describe('InputBar — skill command attachment', () => {
  it('attaches skill as chip when selected from picker', () => {
    const skill: PiSkill = { id: 'sk1', name: 'test-skill', description: 'A test skill', content: 'skill content here' }
    renderInputBar({ pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    const skillBtn = screen.getByText('/test-skill')
    fireEvent.mouseDown(skillBtn)
    expect(screen.getByText('test-skill')).toBeInTheDocument()
  })

  it('removes skill chip when X is clicked', () => {
    const skill: PiSkill = { id: 'sk2', name: 'my-skill', description: 'desc', content: 'content' }
    renderInputBar({ pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/my-skill'))
    const removeBtn = screen.getByLabelText('Remove my-skill')
    fireEvent.click(removeBtn)
    expect(screen.queryByText('my-skill')).not.toBeInTheDocument()
  })
})

describe('InputBar — plugin command dispatch', () => {
  it('inserts /name for plugin command with hint', () => {
    const cmd: SlashCommand = { id: 'cmd1', name: 'deploy', description: 'Deploy to cloud', argumentHint: '--env <staging|prod>', prompt: '', source: 'plugin' }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/deploy'))
    expect((textarea as HTMLTextAreaElement).value).toContain('deploy')
  })

  it('expands template for plugin command without hint that has content', () => {
    const cmd: SlashCommand = { id: 'cmd2', name: 'greet', description: 'Say hello', prompt: 'Hello {{args}}!', source: 'plugin' }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/greet'))
    expect((textarea as HTMLTextAreaElement).value).toContain('Hello')
  })
})

describe('InputBar — @ mentions', () => {
  it('shows file list when @ is typed', () => {
    renderInputBar({
      fileNodes: [
        { name: 'test.ts', path: '/test.ts', type: 'file', children: [] },
      ],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
  })

  it('filters files by query after @', () => {
    renderInputBar({
      fileNodes: [
        { name: 'test.ts', path: '/test.ts', type: 'file', children: [] },
        { name: 'utils.ts', path: '/utils.ts', type: 'file', children: [] },
      ],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@test' } })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
    expect(screen.queryByText('utils.ts')).not.toBeInTheDocument()
  })
})

describe('InputBar — effort levels', () => {
  it('shows effort picker button', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    expect(screen.getByText('Med')).toBeInTheDocument()
  })
})

describe('InputBar — permission mode', () => {
  it('shows permission mode toggle', () => {
    renderInputBar({ onPermissionModeChange: vi.fn(), permissionMode: 'ask' })
    expect(screen.getByText('Ask')).toBeInTheDocument()
  })
})

describe('InputBar — send with slash command text', () => {
  it('clears textarea after sending a builtin command via send button', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect(textarea).toHaveValue('')
  })

  it('trims whitespace from sent messages', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '  hello  ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello', [], undefined)
  })

  it('does not send only whitespace', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('InputBar — reply to', () => {
  it('shows "Replying to Assistant" for assistant role', () => {
    renderInputBar({
      replyTo: { id: 'm1', content: 'Sure thing!', role: 'assistant' },
      onCancelReply: vi.fn(),
    })
    expect(screen.getByText('Replying to Assistant')).toBeInTheDocument()
    expect(screen.getByText('Sure thing!')).toBeInTheDocument()
  })

  it('calls onCancelReply when cancel button is clicked', () => {
    const onCancelReply = vi.fn()
    renderInputBar({
      replyTo: { id: 'm1', content: 'test', role: 'user' },
      onCancelReply,
    })
    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(onCancelReply).toHaveBeenCalled()
  })
})

describe('InputBar — model context badge', () => {
  it('renders with current model', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })
})
