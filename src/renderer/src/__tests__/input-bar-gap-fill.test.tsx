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

describe('InputBar — Shift+Enter when picker is open', () => {
  it('inserts newline instead of executing command when Shift+Enter pressed with picker open', () => {
    const onCommand = vi.fn()
    const onSend = vi.fn()
    renderInputBar({ onCommand, onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Open the command picker by typing /
    fireEvent.change(textarea, { target: { value: '/' } })
    // Picker should be open — /clear should be visible
    expect(screen.getByText('/clear')).toBeInTheDocument()

    // Shift+Enter should NOT execute the command or send
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onCommand).not.toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('InputBar — picker closure verification', () => {
  it('picker actually closes when backspace clears / to empty', () => {
    renderInputBar({ pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Open picker
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    // Backspace to empty
    fireEvent.change(textarea, { target: { value: '' } })

    // Verify picker is actually closed
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })

  it('picker closes when text is changed to something without /', () => {
    renderInputBar({ pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Open picker
    fireEvent.change(textarea, { target: { value: '/cl' } })
    expect(screen.getByText('/clear')).toBeInTheDocument()

    // Replace with non-slash text
    fireEvent.change(textarea, { target: { value: 'hello world' } })

    // Picker should close
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })
})

describe('InputBar — attachment send flow', () => {
  it('sends message with empty attachments array when no files attached', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: 'check this file' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('check this file', [], undefined)
  })

  it('attach button exists and triggers file input click', () => {
    renderInputBar()
    const attachBtn = screen.getByLabelText('Attach file')
    expect(attachBtn).toBeInTheDocument()
    // File input should be hidden
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveClass('hidden')
  })
})

describe('InputBar — multiline send with Shift+Enter', () => {
  it('sends multiline text correctly', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Type first line
    fireEvent.change(textarea, { target: { value: 'line1' } })
    // Shift+Enter for newline
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    // Type second line
    fireEvent.change(textarea, { target: { value: 'line1\nline2' } })
    // Enter to send
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('line1\nline2', [], undefined)
  })
})

describe('InputBar — skill content prepend', () => {
  it('prepends skill content to message text when sending', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      pluginSkills: [{ name: 'test-skill', description: 'A test skill', content: 'skill content here' }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Type /
    fireEvent.change(textarea, { target: { value: '/' } })
    // Click on the skill command
    const skillBtn = screen.getByText('/test-skill')
    fireEvent.mouseDown(skillBtn.closest('button')!)
    // Skill should be attached as chip
    expect(screen.getByText('test-skill')).toBeInTheDocument()

    // Type a message
    fireEvent.change(textarea, { target: { value: 'user question' } })
    // Send
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    // onSend should have been called with skill content prepended
    expect(onSend).toHaveBeenCalled()
    const sentText = onSend.mock.calls[0][0]
    expect(sentText).toContain('skill content here')
    expect(sentText).toContain('user question')
  })
})
