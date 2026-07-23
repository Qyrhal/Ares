import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar, BUILTIN_COMMANDS } from '../components/InputBar'

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
    // Should show stop/cancel button instead of send
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
    // Command dropdown should appear — commands are rendered with / prefix
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
    // Text appears in both textarea and picker item
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
    // Text appears in both textarea and picker item
    const items = screen.getAllByText('/pr')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onCommand with pr when /pr is entered', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/pr' } })
    // Click the send button to trigger handleSend
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('pr', '')
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

describe('InputBar — slash command picker lifecycle', () => {
  it('shows all builtin commands in picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    for (const cmd of BUILTIN_COMMANDS) {
      expect(screen.queryByText(`/${cmd.name}`)).toBeInTheDocument()
    }
  })

  it('shows builtins, skills, and plugin commands together', () => {
    renderInputBar({
      pluginSkills: [{ name: 'test-skill', description: 'A test skill', content: 'skill content' }],
      pluginCommands: [{ name: 'deploy', description: 'Deploy to server', argumentHint: '--env', prompt: 'Deploy {{args}}' }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Builtins
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    // Skill
    expect(screen.queryByText('/test-skill')).toBeInTheDocument()
    // Plugin command
    expect(screen.queryByText('/deploy')).toBeInTheDocument()
  })

  it('filters to /clear when typing /cl', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/cl' } })
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.queryByText('/help')).not.toBeInTheDocument()
  })

  it('filters to /model when typing /mod', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
    expect(screen.queryByText('/help')).not.toBeInTheDocument()
  })

  it('shows all commands again when filter is cleared back to /', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/cl' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    // Clear filter back to just /
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    expect(screen.queryByText('/help')).toBeInTheDocument()
  })

  it('closes picker when Escape is pressed', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })

  it('does not open picker when / is typed mid-line', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello/' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })

  it('does not open picker when / is typed after a space on same line', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello /' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })

  it('re-opens picker after being closed and re-typing /', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Open picker
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    // Close picker
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    // Clear and re-type /
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).toBeInTheDocument()
  })
})

describe('InputBar — tab completion', () => {
  const pluginCommands = [
    { name: 'deploy', description: 'Deploy to server', argumentHint: '--env prod', prompt: 'Deploy {{args}}' },
  ]

  it('Tab inserts highlighted command name into textarea', () => {
    renderInputBar({ pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    // Type /dep to filter to just the deploy command
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.queryByText('/deploy')).toBeInTheDocument()
    // Tab to complete
    fireEvent.keyDown(textarea, { key: 'Tab' })
    // executeCommand → insertCommand preserves typed prefix → '/dep/deploy '
    expect(textarea.value).toBe('/dep/deploy ')
  })

  it('textarea contains /commandname with trailing space after Tab', () => {
    renderInputBar({ pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/dep' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toBe('/dep/deploy ')
  })

  it('picker is closed after Tab completion', () => {
    renderInputBar({ pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.queryByText('/deploy')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Tab' })
    // After insertCommand, closeCommands is called → picker closed
    expect(screen.queryByText('/deploy')).not.toBeInTheDocument()
  })

  it('Arrow Down then Tab executes highlighted command', () => {
    const onRevealInExplorer = vi.fn()
    renderInputBar({ pluginSkills: [], pluginCommands: [], onRevealInExplorer })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Open picker with just /
    fireEvent.change(textarea, { target: { value: '/' } })
    // Highlight starts at 0 (/model). ArrowDown → highlight at 1 (/folder)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    // Tab executes highlighted command (/folder → calls onRevealInExplorer)
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onRevealInExplorer).toHaveBeenCalled()
  })

  it('Arrow Up clamps highlight at 0', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Default highlight is 0. ArrowUp should clamp at 0
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    // Picker should still be open with /model as first item
    expect(screen.queryByText('/model')).toBeInTheDocument()
  })
})

describe('InputBar — enter key dispatch', () => {
  it('Enter on /clear calls onCommand("clear", "")', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Enter with no picker open sends message normally', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type non-slash text → picker stays closed
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello world', [], undefined)
  })

  it('Shift+Enter inserts newline, never sends or triggers command', () => {
    const onSend = vi.fn()
    const onCommand = vi.fn()
    renderInputBar({ onSend, onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type non-slash text so picker stays closed
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    expect(onCommand).not.toHaveBeenCalled()
  })
})

describe('InputBar — slash command text reflection', () => {
  it('textarea shows exactly what user typed for /model gpt-4o', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    expect(textarea.value).toBe('/model gpt-4o')
  })

  it('uppercase /CLEAR dispatches as onCommand("clear", "")', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/CLEAR' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('mixed-case /Model gpt-4o dispatches as onCommand("model", "gpt-4o")', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/Model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })
})

describe('InputBar — edge cases', () => {
  it('typing / then pressing Enter does not crash', () => {
    const onCommand = vi.fn()
    const onSend = vi.fn()
    renderInputBar({ onCommand, onSend, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Picker is open with all commands; Enter executes the first (highlight=0 → /model)
    expect(() => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    }).not.toThrow()
  })

  it('typing /nonexistent then Enter does not crash', () => {
    const onCommand = vi.fn()
    const onSend = vi.fn()
    renderInputBar({ onCommand, onSend, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/nonexistent' } })
    expect(() => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    }).not.toThrow()
    // Falls through to handleSend which dispatches onCommand
    expect(onCommand).toHaveBeenCalledWith('nonexistent', '')
  })

  it('multiple rapid Enter presses on same command do not crash', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    expect(() => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    }).not.toThrow()
    // First Enter executes /clear, subsequent Enters operate on cleared text
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})
