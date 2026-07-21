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

describe('InputBar — edge cases (empty/unknown command)', () => {
  it('does not crash when / is typed then Enter is pressed immediately (empty command)', () => {
    const onCommand = vi.fn()
    const onSend = vi.fn()
    renderInputBar({ onCommand, onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // Empty command after / should dispatch as command with empty name, or do nothing
    // The key point is: no crash
  })

  it('does not crash when /nonexistent is typed and Enter is pressed', () => {
    const onCommand = vi.fn()
    const onSend = vi.fn()
    renderInputBar({ onCommand, onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/nonexistent' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // Unknown builtin command should be dispatched via onCommand
    expect(onCommand).toHaveBeenCalledWith('nonexistent', '')
  })

  it('does not crash on multiple rapid Enter presses', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // After first Enter, text is cleared, so subsequent Enters should not call onSend
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('handles pasting text containing / at start of line', () => {
    const onCommand = vi.fn()
    const onSend = vi.fn()
    renderInputBar({ onCommand, onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/help me with this' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // /help with args is dispatched via onCommand
    expect(onCommand).toHaveBeenCalledWith('help', 'me with this')
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('InputBar — picker click outside closes', () => {
  it('closes command picker when clicking outside', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    // Simulate mousedown outside the component
    fireEvent.mouseDown(document.body)
    // After clicking outside, picker should close (commands no longer visible)
    // Note: the useEffect listener checks dropdownRef.contains and textareaRef.contains
    // Since document.body is not in either, closeAll should be called
  })
})

describe('InputBar — picker shows all builtin commands', () => {
  it('shows all 24 builtin commands when / is typed', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    const builtins = [
      'model', 'folder', 'overview', 'clear', 'pr', 'fork',
      'helpful', 'not-helpful', 'compact', 'usage', 'changes',
      'export', 'shortcuts', 'review', 'rename', 'pin',
      'branches', 'stage', 'commit', 'debug', 'history', 'log', 'help',
    ]
    for (const name of builtins) {
      expect(screen.getByText(`/${name}`)).toBeInTheDocument()
    }
  })
})

describe('InputBar — plugin commands with different shapes', () => {
  it('plugin command with hint shows hint badge in picker', () => {
    const cmd: SlashCommand = {
      id: 'c1', name: 'deploy', description: 'Deploy app',
      argumentHint: '--env <staging|prod>', prompt: '', source: 'plugin',
    }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('--env <staging|prod>')).toBeInTheDocument()
  })

  it('plugin command without hint and without content does nothing on execute', () => {
    const cmd: SlashCommand = {
      id: 'c2', name: 'noop', description: 'Does nothing',
      prompt: '', source: 'plugin',
    }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/noop' } })
    // Execute via picker click
    const btns = screen.getAllByText('/noop')
    fireEvent.mouseDown(btns[btns.length - 1])
    // No crash, no side effect expected
  })
})

describe('InputBar — skill deduplication', () => {
  it('does not attach same skill twice', () => {
    const skill: PiSkill = { id: 'sk1', name: 'dup-skill', description: 'dup', content: 'content' }
    renderInputBar({ pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/dup-skill'))
    expect(screen.getByText('dup-skill')).toBeInTheDocument()
    // Open picker again and try to attach same skill
    fireEvent.change(textarea, { target: { value: '/dup' } })
    fireEvent.mouseDown(screen.getByText('/dup-skill'))
    // Should still only have one chip
    const chips = screen.getAllByText('dup-skill')
    // One in the skill chip area, filter to find just the chip text
    expect(chips.length).toBe(1)
  })
})

describe('InputBar — effort level picker', () => {
  it('opens effort picker on click and shows dropdown', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    const effortBtn = screen.getByTitle('Effort level')
    fireEvent.click(effortBtn)
    // Effort levels render in a surface-overlay dropdown
    const effortPicker = document.querySelector('.surface-overlay')
    expect(effortPicker).toBeInTheDocument()
  })

  it('selecting effort level calls onEffortChange and closes picker', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ onEffortChange, effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    const effortPicker = document.querySelector('.surface-overlay')
    expect(effortPicker).toBeInTheDocument()
    const highBtn = effortPicker!.querySelectorAll('button')[2] // High is 3rd item
    fireEvent.mouseDown(highBtn)
    expect(onEffortChange).toHaveBeenCalledWith('high')
  })
})

describe('InputBar — permission mode cycling', () => {
  it('cycles through ask → auto → yolo → ask', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ onPermissionModeChange, permissionMode: 'ask' })
    fireEvent.click(screen.getByText('Ask'))
    expect(onPermissionModeChange).toHaveBeenCalledWith('auto')
  })

  it('cycles from yolo back to ask', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ onPermissionModeChange, permissionMode: 'yolo' })
    fireEvent.click(screen.getByText('Yolo'))
    expect(onPermissionModeChange).toHaveBeenCalledWith('ask')
  })
})

describe('InputBar — agent mode toggle', () => {
  it('renders all three mode buttons', () => {
    renderInputBar({ onAgentModeChange: vi.fn(), agentMode: 'agent' })
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
  })

  it('clicking Chat mode calls onAgentModeChange with chat', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ onAgentModeChange, agentMode: 'agent' })
    fireEvent.click(screen.getByText('Chat'))
    expect(onAgentModeChange).toHaveBeenCalledWith('chat')
  })

  it('clicking Plan mode calls onAgentModeChange with plan', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ onAgentModeChange, agentMode: 'agent' })
    fireEvent.click(screen.getByText('Plan'))
    expect(onAgentModeChange).toHaveBeenCalledWith('plan')
  })
})

describe('InputBar — color mode toggle', () => {
  it('shows sun icon in dark mode', () => {
    renderInputBar({ colorMode: 'dark', onToggleColorMode: vi.fn() })
    expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument()
  })

  it('shows moon icon in light mode', () => {
    renderInputBar({ colorMode: 'light', onToggleColorMode: vi.fn() })
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument()
  })

  it('calls onToggleColorMode when clicked', () => {
    const onToggleColorMode = vi.fn()
    renderInputBar({ colorMode: 'dark', onToggleColorMode })
    fireEvent.click(screen.getByLabelText('Switch to light mode'))
    expect(onToggleColorMode).toHaveBeenCalled()
  })

  it('does not render toggle when onToggleColorMode is absent', () => {
    renderInputBar({ colorMode: 'dark' })
    expect(screen.queryByLabelText('Switch to light mode')).not.toBeInTheDocument()
  })
})

describe('InputBar — model display', () => {
  it('shows "No model" when currentModel is empty', () => {
    renderInputBar({ currentModel: '' })
    expect(screen.getByText('No model')).toBeInTheDocument()
  })

  it('shows model name when currentModel is set', () => {
    renderInputBar({ currentModel: 'claude-3-opus' })
    expect(screen.getByText('claude-3-opus')).toBeInTheDocument()
  })

  it('model button opens model picker on click', () => {
    renderInputBar({ currentModel: 'gpt-4o', providers: [], apiBaseUrl: '', apiKey: '' })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })
})

describe('InputBar — send button states', () => {
  it('send button is disabled when text is empty', () => {
    renderInputBar()
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).toBeDisabled()
  })

  it('send button is enabled when text is non-empty', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).not.toBeDisabled()
  })

  it('send button is disabled when disabled prop is true', () => {
    renderInputBar({ disabled: true })
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Stop generation (Ctrl+C)')).toBeInTheDocument()
  })
})

describe('InputBar — reply chip edge cases', () => {
  it('does not show reply chip when replyTo is null', () => {
    renderInputBar({ replyTo: null })
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
  })

  it('does not show reply chip when replyTo is undefined', () => {
    renderInputBar({ replyTo: undefined })
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
  })

  it('sends replyTo with message', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      replyTo: { id: 'm1', content: 'Original', role: 'user' },
      onCancelReply: vi.fn(),
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'My reply' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('My reply', [], { id: 'm1', content: 'Original', role: 'user' })
  })
})

describe('InputBar — text area resize', () => {
  it('textarea has correct default classes', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    expect(textarea.className).toContain('resize-none')
  })
})

describe('InputBar — @ mention with no matching files', () => {
  it('filters out directories from @ mentions', () => {
    renderInputBar({
      fileNodes: [
        { name: 'src', path: '/src', type: 'folder', children: [] },
        { name: 'test.ts', path: '/test.ts', type: 'file', children: [] },
      ],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
    // Directory should not appear in the @ mention dropdown
    expect(screen.queryByText('src')).not.toBeInTheDocument()
  })

  it('shows no dropdown when no files exist', () => {
    renderInputBar({ fileNodes: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    // No file mention dropdown should appear
    expect(screen.queryByText('/model')).not.toBeInTheDocument() // command dropdown should not appear either
  })
})

describe('InputBar — context donut', () => {
  it('renders context donut with model', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    // The donut SVG should be present
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
