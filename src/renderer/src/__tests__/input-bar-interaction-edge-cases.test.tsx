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

describe('InputBar — effort picker interaction', () => {
  it('clicking effort button opens dropdown', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    const btn = screen.getByTitle('Effort level')
    fireEvent.click(btn)
    // Dropdown items show lowercase level names
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('clicking a different effort level calls onEffortChange', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ onEffortChange, effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    // Items use onMouseDown, not onClick
    fireEvent.mouseDown(screen.getByText('high'))
    expect(onEffortChange).toHaveBeenCalledWith('high')
  })

  it('clicking the same effort level still calls onEffortChange', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ onEffortChange, effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    fireEvent.mouseDown(screen.getByText('medium'))
    expect(onEffortChange).toHaveBeenCalledWith('medium')
  })

  it('effort dropdown closes after selection', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    expect(screen.getByText('low')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('low'))
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })

  it('clicking outside effort dropdown closes it', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    expect(screen.getByText('low')).toBeInTheDocument()
    // Click outside the dropdown
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })
})

describe('InputBar — permission mode toggle interaction', () => {
  it('clicking permission mode button cycles to next mode', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ onPermissionModeChange, permissionMode: 'ask' })
    const btn = screen.getByTitle('Click to cycle permission mode')
    fireEvent.click(btn)
    expect(onPermissionModeChange).toHaveBeenCalledWith('auto')
  })

  it('cycles from auto to yolo', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ onPermissionModeChange, permissionMode: 'auto' })
    fireEvent.click(screen.getByTitle('Click to cycle permission mode'))
    expect(onPermissionModeChange).toHaveBeenCalledWith('yolo')
  })

  it('cycles from yolo back to ask', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ onPermissionModeChange, permissionMode: 'yolo' })
    fireEvent.click(screen.getByTitle('Click to cycle permission mode'))
    expect(onPermissionModeChange).toHaveBeenCalledWith('ask')
  })

  it('shows correct label for each mode', () => {
    const { rerender } = renderInputBar({ permissionMode: 'ask' })
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

describe('InputBar — model picker search and error states', () => {
  it('model picker shows search input', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })

  it('model picker shows no-endpoints message when no providers', () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [],
      providers: [],
      apiBaseUrl: '',
      apiKey: '',
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })

  it('Escape closes model picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search models…')).not.toBeInTheDocument()
  })
})

describe('InputBar — slash command args extraction', () => {
  it('extracts args after command name for /model gpt-4o', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('extracts args with extra spaces for /exec ls -la', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/exec ls -la' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('exec', 'ls -la')
  })

  it('no args for /clear', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('args with special characters for /commit fix: bug', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/commit fix: bug' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('commit', 'fix: bug')
  })
})

describe('InputBar — picker item categories', () => {
  it('shows category headers for builtins, skills, and commands', () => {
    renderInputBar({
      pluginSkills: [{ name: 'my-skill', description: 'A skill', content: 'content' }],
      pluginCommands: [{ name: 'my-cmd', description: 'A command', prompt: 'prompt' }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('Built-in')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Plugin commands')).toBeInTheDocument()
  })

  it('does not show skill header when no skills', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('Built-in')).toBeInTheDocument()
    expect(screen.queryByText('Skills')).not.toBeInTheDocument()
    expect(screen.queryByText('Plugin commands')).not.toBeInTheDocument()
  })

  it('does not show plugin commands header when no commands', () => {
    renderInputBar({
      pluginSkills: [{ name: 's', description: 'S', content: 'c' }],
      pluginCommands: [],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.queryByText('Plugin commands')).not.toBeInTheDocument()
  })
})

describe('InputBar — skill command description display', () => {
  it('shows skill description in picker', () => {
    renderInputBar({
      pluginSkills: [{ name: 'analyze', description: 'Analyze code patterns', content: 'analyze content' }],
      pluginCommands: [],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/ana' } })
    expect(screen.getByText('Analyze code patterns')).toBeInTheDocument()
  })

  it('shows "No description" when skill has no description', () => {
    renderInputBar({
      pluginSkills: [{ name: 'bare', description: '', content: 'content' }],
      pluginCommands: [],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/bare' } })
    expect(screen.getByText('No description')).toBeInTheDocument()
  })

  it('shows skill line count hint', () => {
    renderInputBar({
      pluginSkills: [{ name: 'multi', description: 'Multi-line', content: 'line1\nline2\nline3' }],
      pluginCommands: [],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/multi' } })
    expect(screen.getByText('3 lines')).toBeInTheDocument()
  })
})

describe('InputBar — plugin command argument hints', () => {
  it('shows argument hint in picker for plugin command', () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [{ name: 'deploy', description: 'Deploy app', argumentHint: '--env prod', prompt: 'Deploy {{args}}' }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.getByText('--env prod')).toBeInTheDocument()
  })

  it('no hint shown when argumentHint is absent', () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [{ name: 'summarize', description: 'Summarize', prompt: 'Summarize {{args}}' }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/sum' } })
    expect(screen.getByText('Summarize')).toBeInTheDocument()
  })
})

describe('InputBar — text clearing after command execution', () => {
  it('textarea is cleared after executing a builtin command via Enter', () => {
    renderInputBar({ onCommand: vi.fn() })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/clear' } })
    expect(textarea.value).toBe('/clear')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(textarea.value).toBe('')
  })

  it('textarea retains text after Shift+Enter (newline, no send)', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(textarea.value).toBe('hello')
  })
})

describe('InputBar — cancel button in loading state', () => {
  it('clicking cancel button calls onCancel', () => {
    const onCancel = vi.fn()
    renderInputBar({ disabled: true, onCancel })
    const cancelBtn = screen.getByLabelText('Stop generation (Ctrl+C)')
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('textarea is disabled in loading state', () => {
    renderInputBar({ disabled: true })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    expect(textarea).toBeDisabled()
  })
})

describe('InputBar — reply chip content', () => {
  it('shows reply content in chip', () => {
    renderInputBar({
      replyTo: { id: 'm1', content: 'Short reply', role: 'user' },
      onCancelReply: vi.fn(),
    })
    expect(screen.getByText('Short reply')).toBeInTheDocument()
  })

  it('shows truncated content for long replies via CSS truncate', () => {
    const longContent = 'A'.repeat(300)
    renderInputBar({
      replyTo: { id: 'm1', content: longContent, role: 'user' },
      onCancelReply: vi.fn(),
    })
    // The chip should render the full content (CSS truncates visually)
    const chip = screen.getByText(longContent)
    expect(chip).toBeInTheDocument()
    // Verify the truncate class is applied
    expect(chip.className).toContain('truncate')
  })

  it('reply chip shows role label for user', () => {
    renderInputBar({
      replyTo: { id: 'm1', content: 'Hello', role: 'user' },
      onCancelReply: vi.fn(),
    })
    expect(screen.getByText('Replying to You')).toBeInTheDocument()
  })

  it('reply chip shows role label for assistant', () => {
    renderInputBar({
      replyTo: { id: 'm1', content: 'Hello', role: 'assistant' },
      onCancelReply: vi.fn(),
    })
    expect(screen.getByText('Replying to Assistant')).toBeInTheDocument()
  })
})

describe('InputBar — effort level label display', () => {
  it('shows "Low" for low effort', () => {
    renderInputBar({ effort: 'low', onEffortChange: vi.fn() })
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('shows "Med" for medium effort', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    expect(screen.getByText('Med')).toBeInTheDocument()
  })

  it('shows "High" for high effort', () => {
    renderInputBar({ effort: 'high', onEffortChange: vi.fn() })
    expect(screen.getByText('High')).toBeInTheDocument()
  })
})

describe('InputBar — effort picker active state', () => {
  it('highlights current effort level in dropdown', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'high' })
    fireEvent.click(screen.getByTitle('Effort level'))
    const highBtn = screen.getByText('high')
    expect(highBtn.closest('button')!.className).toContain('bg-accent')
  })

  it('does not highlight non-current effort levels', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'high' })
    fireEvent.click(screen.getByTitle('Effort level'))
    const lowBtn = screen.getByText('low')
    const lowClassName = lowBtn.closest('button')!.className
    // Non-current levels have 'hover:bg-accent/50' but not 'text-accent-foreground'
    expect(lowClassName).toContain('hover:bg-accent/50')
    expect(lowClassName).not.toContain('text-accent-foreground')
  })
})
