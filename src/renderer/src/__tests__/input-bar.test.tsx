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
