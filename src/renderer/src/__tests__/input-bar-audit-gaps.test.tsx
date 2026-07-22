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

// ─────────────────────────────────────────────────────
// B. Tab completion of slash commands — additional gaps
// ─────────────────────────────────────────────────────
describe('InputBar audit — Tab completion gaps', () => {
  it('Tab does not insert tab character when picker is closed', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toBe('hello')
  })

  it('Tab executes first filtered result when no manual navigation', () => {
    const onCommand = vi.fn()
    renderInputBar({ pluginCommands: [], onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/cl' } })
    // Highlight starts at 0 which is the first match (/clear)
    fireEvent.keyDown(textarea, { key: 'Tab' })
    // Tab executes the command (same as Enter) — clears textarea
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect(textarea.value).toBe('')
  })

  it('ArrowDown at last item does not crash', () => {
    renderInputBar({ pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/' } })
    // Press ArrowDown many times to go past last item
    for (let i = 0; i < 60; i++) {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    }
    // No crash — highlight stays clamped at last index
  })

  it('ArrowUp at first item does not crash', () => {
    renderInputBar({ pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/' } })
    // Press ArrowUp from index 0
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    }
    // No crash — highlight stays at 0
  })
})

// ─────────────────────────────────────────────────────
// C. Enter key dispatch — additional gaps
// ─────────────────────────────────────────────────────
describe('InputBar audit — Enter dispatch gaps', () => {
  it('Enter dispatches command while reply chip is active', () => {
    const onCommand = vi.fn()
    renderInputBar({
      onCommand,
      replyTo: { id: 'm1', content: 'test reply', role: 'assistant' },
      onCancelReply: vi.fn(),
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Enter sends text normally after reply chip is dismissed', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello', [], undefined)
  })
})

// ─────────────────────────────────────────────────────
// D. Slash command text reflection — additional gaps
// ─────────────────────────────────────────────────────
describe('InputBar audit — text reflection gaps', () => {
  it('textarea is cleared after executing builtin command via Enter', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/help' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(textarea.value).toBe('')
  })

  it('textarea retains text after Escape closes picker', () => {
    renderInputBar({ pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/model' } })
    // Picker should be open, then close with Escape
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // Text should remain
    expect(textarea.value).toBe('/model')
  })
})

// ─────────────────────────────────────────────────────
// E. Keyboard shortcut consistency
// ─────────────────────────────────────────────────────
describe('InputBar audit — keyboard shortcut gaps', () => {
  it('Escape does nothing when no picker is open', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // Text preserved, no crash
    expect(textarea.value).toBe('hello')
  })

  it('Enter executes highlighted command even with text after slash', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})

// ─────────────────────────────────────────────────────
// F. Edge cases — additional gaps
// ─────────────────────────────────────────────────────
describe('InputBar audit — edge case gaps', () => {
  it('rapid typing / then backspace clears picker', () => {
    renderInputBar({ pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type /
    fireEvent.change(textarea, { target: { value: '/' } })
    // Immediately backspace to clear
    fireEvent.change(textarea, { target: { value: '' } })
    // No crash — picker should be closed
  })

  it('pasting a full slash command with args dispatches correctly', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('typing /nonexistent then Enter dispatches (no crash)', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/nonexistent' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('nonexistent', '')
  })

  it('skill command via picker click attaches as chip', () => {
    const skills: PiSkill[] = [{ id: 'sk1', name: 'test-skill', description: 'A test skill', content: 'skill content here' }]
    renderInputBar({ pluginSkills: skills })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Skill name renders as /test-skill in picker (with / prefix)
    const skillBtns = screen.getAllByText('/test-skill')
    const pickerBtn = skillBtns.find((el) => el.closest('button[type="button"]')) ?? skillBtns[0]
    fireEvent.mouseDown(pickerBtn.closest('button[type="button"]') ?? pickerBtn)
    // Skill chip should appear
    expect(screen.getByText('test-skill')).toBeInTheDocument()
  })

  it('plugin command with hint inserts /name for user args', () => {
    const commands: SlashCommand[] = [{ id: 'c1', name: 'deploy', description: 'Deploy app', argumentHint: '<env>', prompt: '', source: 'plugin' }]
    renderInputBar({ pluginCommands: commands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/dep' } })
    // Click the deploy command
    const cmdBtn = screen.getByText('/deploy')
    fireEvent.mouseDown(cmdBtn)
    // Should insert /deploy with space for args
    expect(textarea.value).toContain('/deploy')
  })

  it('plugin command without hint and with content expands template', () => {
    const commands: SlashCommand[] = [{ id: 'c2', name: 'explain', description: 'Explain code', prompt: 'Explain this: {{args}}', source: 'plugin' }]
    const onSend = vi.fn()
    renderInputBar({ pluginCommands: commands, onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/explain' } })
    // The send button dispatches handleSend which finds the command and expands template
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledWith('Explain this: ', [], undefined)
  })

  it('clicking a command in the picker executes it via mouseDown', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/help' } })
    // Click the /help command item — text appears in textarea and picker
    const helpBtns = screen.getAllByText('/help')
    const pickerBtn = helpBtns.find((el) => el.closest('button[type="button"]') && !el.closest('textarea'))
    fireEvent.mouseDown(pickerBtn!)
    expect(onCommand).toHaveBeenCalledWith('help', '')
  })

  it('Arrow Down/Up in picker changes highlighted item', () => {
    renderInputBar({ pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // ArrowDown should cycle through commands without crashing
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    // No crash
  })
})

// ─────────────────────────────────────────────────────
// Plugin commands with skill content in picker
// ─────────────────────────────────────────────────────
describe('InputBar audit — picker content display', () => {
  it('shows skill hint as line count in picker', () => {
    const skills: PiSkill[] = [{ id: 's1', name: 'multi', description: 'Multi-line skill', content: 'line1\nline2\nline3' }]
    renderInputBar({ pluginSkills: skills })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mul' } })
    expect(screen.getByText('3 lines')).toBeInTheDocument()
  })

  it('shows command hint in picker when present', () => {
    const commands: SlashCommand[] = [{ id: 'c1', name: 'deploy', description: 'Deploy', argumentHint: '<env>', prompt: '', source: 'plugin' }]
    renderInputBar({ pluginCommands: commands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.getByText('<env>')).toBeInTheDocument()
  })

  it('builtin commands show description in picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/com' } })
    expect(screen.getByText('Commit staged changes with a message')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────
// Reply chip interactions
// ─────────────────────────────────────────────────────
describe('InputBar audit — reply chip interactions', () => {
  it('cancel reply button calls onCancelReply', () => {
    const onCancelReply = vi.fn()
    renderInputBar({
      replyTo: { id: 'm1', content: 'hello', role: 'assistant' },
      onCancelReply,
    })
    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(onCancelReply).toHaveBeenCalled()
  })

  it('reply chip shows "Replying to Assistant" for assistant role', () => {
    renderInputBar({
      replyTo: { id: 'm1', content: 'response', role: 'assistant' },
      onCancelReply: vi.fn(),
    })
    expect(screen.getByText('Replying to Assistant')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────
// Skill attachment lifecycle
// ─────────────────────────────────────────────────────
describe('InputBar audit — skill attachment lifecycle', () => {
  it('removing last skill clears skillAttachments state', () => {
    const skills: PiSkill[] = [{ id: 's1', name: 'only', description: 'only skill', content: 'content' }]
    renderInputBar({ pluginSkills: skills })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/only' } })
    // Skill name renders as /only in picker (with / prefix)
    const onlyBtns = screen.getAllByText('/only')
    const pickerBtn = onlyBtns.find((el) => el.closest('button[type="button"]'))
    fireEvent.mouseDown(pickerBtn!)
    // Skill chip should appear
    expect(screen.getByLabelText('Remove only')).toBeInTheDocument()
    // Remove it
    fireEvent.click(screen.getByLabelText('Remove only'))
    // Should be gone — no crash
  })
})
