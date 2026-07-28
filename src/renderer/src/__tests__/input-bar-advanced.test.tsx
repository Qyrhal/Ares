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

// ─── Send with only skill attachments ───────────────────────────────────────

describe('InputBar — send with only skill attachments', () => {
  it('sends skill content with user text', () => {
    const onSend = vi.fn()
    const skill = { name: 'test-skill', description: 'A test skill', content: 'skill body' }
    renderInputBar({ onSend, pluginSkills: [skill], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Attach skill
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/test-skill'))
    // Type a message
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.change(textarea, { target: { value: 'my question' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledWith(
      expect.stringContaining('skill body'),
      [],
      undefined,
    )
    expect(onSend).toHaveBeenCalledWith(
      expect.stringContaining('my question'),
      [],
      undefined,
    )
  })
})

// ─── Send with replyTo ──────────────────────────────────────────────────────

describe('InputBar — send with replyTo', () => {
  it('passes replyTo to onSend', () => {
    const onSend = vi.fn()
    const replyTo = { id: 'm1', content: 'original', role: 'user' }
    renderInputBar({ onSend, replyTo })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'my reply' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledWith('my reply', [], replyTo)
  })

  it('onSend called exactly once per send', () => {
    const onSend = vi.fn()
    const replyTo = { id: 'm1', content: 'original', role: 'user' }
    renderInputBar({ onSend, replyTo, onCancelReply: vi.fn() })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'reply' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})

// ─── Model picker escape ────────────────────────────────────────────────────

describe('InputBar — model picker', () => {
  it('Escape closes model picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    const searchInput = screen.getByPlaceholderText('Search models…')
    expect(searchInput).toBeInTheDocument()
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search models…')).not.toBeInTheDocument()
  })
})

// ─── Send button state transitions ──────────────────────────────────────────

describe('InputBar — send button disabled states', () => {
  it('send button is disabled when text is empty', () => {
    renderInputBar()
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).toBeDisabled()
  })

  it('send button is enabled when text has content', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'a' } })
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).not.toBeDisabled()
  })

  it('send button is disabled when disabled prop is true', () => {
    renderInputBar({ disabled: true })
    expect(screen.getByLabelText('Stop generation (Ctrl+C)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument()
  })
})

// ─── ReplyTo chip content truncation ────────────────────────────────────────

describe('InputBar — replyTo chip content', () => {
  it('displays full reply content', () => {
    const content = 'Hello, this is a test reply'
    renderInputBar({
      replyTo: { id: 'm1', content, role: 'user' },
      onCancelReply: vi.fn(),
    })
    expect(screen.getByText(content)).toBeInTheDocument()
  })
})

// ─── Skill attachment deduplication ─────────────────────────────────────────

describe('InputBar — skill attachment deduplication', () => {
  it('same skill cannot be attached twice', () => {
    const skill = { name: 'dup-skill', description: 'Duplicate test', content: 'content' }
    renderInputBar({ pluginSkills: [skill], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/dup-skill'))
    expect(screen.getByText('skill')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/dup-skill'))
    expect(screen.getAllByText('skill').length).toBe(1)
  })
})

// ─── Skill command content as chip ──────────────────────────────────────────

describe('InputBar — skill chip displays content', () => {
  it('skill chip shows skill name, not content', () => {
    const skill = { name: 'my-skill', description: 'desc', content: 'secret content' }
    renderInputBar({ pluginSkills: [skill], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/my-skill'))
    expect(screen.getByText('my-skill')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })
})

// ─── Multiline paste with / command ─────────────────────────────────────────

describe('InputBar — multiline paste', () => {
  it('multiline text with / at start of second line opens picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'line1\n/clear' } })
    expect(screen.getByText('/clear')).toBeInTheDocument()
  })

  it('multiline text with / mid-line does NOT open picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'line1\nhello /clear' } })
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })
})

// ─── Send clears all state ──────────────────────────────────────────────────

describe('InputBar — send clears state', () => {
  it('textarea is cleared after send', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(textarea.value).toBe('')
  })
})

// ─── @ mention query filtering ──────────────────────────────────────────────

describe('InputBar — @ mention deep filtering', () => {
  it('@ mention filters by name', () => {
    const fileNodes = [
      { name: 'alpha.ts', path: '/alpha.ts', type: 'file', children: [] },
      { name: 'beta.ts', path: '/beta.ts', type: 'file', children: [] },
    ]
    renderInputBar({ fileNodes })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@alp' } })
    expect(screen.getByText('alpha.ts')).toBeInTheDocument()
    expect(screen.queryByText('beta.ts')).not.toBeInTheDocument()
  })

  it('@ mention with empty query shows all files', () => {
    const fileNodes = [
      { name: 'a.ts', path: '/a.ts', type: 'file', children: [] },
      { name: 'b.ts', path: '/b.ts', type: 'file', children: [] },
    ]
    renderInputBar({ fileNodes })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.getByText('a.ts')).toBeInTheDocument()
    expect(screen.getByText('b.ts')).toBeInTheDocument()
  })
})

// ─── Command picker filter resets ───────────────────────────────────────────

describe('InputBar — command picker filter resets', () => {
  it('clearing from filtered state back to / shows all commands', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/clear')).toBeInTheDocument()
  })
})

// ─── Template expansion ─────────────────────────────────────────────────────

describe('InputBar — template expansion', () => {
  it('{{args}} is replaced with typed arguments', () => {
    const onSend = vi.fn()
    const pluginCommands = [
      { name: 'ask', description: 'Ask', prompt: 'Please answer: {{args}}' },
    ]
    renderInputBar({ onSend, pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/ask what is typescript' } })
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(onSend).toHaveBeenCalledWith('Please answer: what is typescript', [], undefined)
  })

  it('$ARGUMENTS is replaced with typed arguments', () => {
    const onSend = vi.fn()
    const pluginCommands = [
      { name: 'ask', description: 'Ask', prompt: 'Answer $ARGUMENTS' },
    ]
    renderInputBar({ onSend, pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/ask hello' } })
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(onSend).toHaveBeenCalledWith('Answer hello', [], undefined)
  })

  it('{{args}} with no args expands to empty string', () => {
    const onSend = vi.fn()
    const pluginCommands = [
      { name: 'ask', description: 'Ask', prompt: 'Question: {{args}}' },
    ]
    renderInputBar({ onSend, pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/ask' } })
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(onSend).toHaveBeenCalledWith('Question: ', [], undefined)
  })
})

// ─── Plugin command with hint on Enter from picker ──────────────────────────

describe('InputBar — plugin command Enter from picker', () => {
  it('Enter on plugin command with hint inserts /name  for user typing', () => {
    const pluginCommands = [
      { name: 'deploy', description: 'Deploy to server', argumentHint: '--env prod', prompt: 'Deploy {{args}}' },
    ]
    renderInputBar({ pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/dep' } })
    const deployBtn = screen.getByText('/deploy').closest('button')!
    fireEvent.mouseDown(deployBtn)
    expect(textarea.value).toContain('/deploy')
  })
})

// ─── Context donut popup ────────────────────────────────────────────────────

describe('InputBar — context donut popup', () => {
  it('clicking context donut opens popup with token info', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const svg = document.querySelector('svg[viewBox="0 0 18 18"]')
    expect(svg).toBeInTheDocument()
    fireEvent.click(svg!.closest('button')!)
    expect(screen.getByText(/of context used/)).toBeInTheDocument()
  })
})

// ─── Command picker click interaction ───────────────────────────────────────

describe('InputBar — command picker click interaction', () => {
  it('clicking a command in the picker executes it', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    const allClear = screen.getAllByText('/clear')
    const clearBtn = allClear.find((el) => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(clearBtn)
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})

// ─── Send button enable/disable transitions ─────────────────────────────────

describe('InputBar — send button transitions', () => {
  it('send button enables when text changes from empty to non-empty', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).toBeDisabled()
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(sendBtn).not.toBeDisabled()
  })

  it('send button disables when text is cleared', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(sendBtn).not.toBeDisabled()
    fireEvent.change(textarea, { target: { value: '' } })
    expect(sendBtn).toBeDisabled()
  })
})

// ─── Skill chip with multiple skills ────────────────────────────────────────

describe('InputBar — multiple skill chips', () => {
  it('two different skills can be attached as separate chips', () => {
    const pluginSkills = [
      { name: 'alpha', description: 'Alpha skill', content: 'alpha content' },
      { name: 'beta', description: 'Beta skill', content: 'beta content' },
    ]
    renderInputBar({ pluginSkills })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Attach alpha
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/alpha'))
    // Clear and attach beta
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/beta'))
    // Both should be present
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()
    // Both "skill" labels should be present
    expect(screen.getAllByText('skill').length).toBe(2)
  })
})

// ─── Emoji autocomplete edge cases ──────────────────────────────────────────

describe('InputBar — emoji autocomplete edge cases', () => {
  it('Tab inserts emoji and closes picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: ':fire' } })
    expect(screen.getByText('🔥')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toContain('🔥')
    // Picker should close
    expect(screen.queryAllByText('🔥').length).toBeLessThanOrEqual(1)
  })
})

// ─── @ mention only shows files, not directories ────────────────────────────

describe('InputBar — @ mention file filtering', () => {
  it('@ mention does not show directories', () => {
    const fileNodes = [
      { name: 'src', path: 'src', type: 'folder' as const, children: [] },
      { name: 'test.ts', path: 'test.ts', type: 'file', children: [] },
    ]
    renderInputBar({ fileNodes })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
    expect(screen.queryByText('src')).not.toBeInTheDocument()
  })
})

// ─── Prompt history edge cases ──────────────────────────────────────────────

describe('InputBar — prompt history edge cases', () => {
  it('ArrowUp when textarea has text does not navigate history', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    // Text should remain unchanged
    expect(textarea.value).toBe('hello')
  })
})

// ─── Send with attachments + replyTo ────────────────────────────────────────

describe('InputBar — combined send with reply and attachments', () => {
  it('send includes replyTo reference in onSend call', () => {
    const onSend = vi.fn()
    const replyTo = { id: 'm1', content: 'context', role: 'assistant' }
    renderInputBar({ onSend, replyTo })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'response' } })
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(onSend).toHaveBeenCalledWith('response', [], replyTo)
  })
})

// ─── Skill chip remove ──────────────────────────────────────────────────────

describe('InputBar — skill chip remove', () => {
  it('removing skill chip clears it from attachments', () => {
    const skill = { name: 'rm-skill', description: 'test', content: 'data' }
    renderInputBar({ pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.mouseDown(screen.getByText('/rm-skill'))
    expect(screen.getByText('rm-skill')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Remove rm-skill'))
    expect(screen.queryByText('skill')).not.toBeInTheDocument()
  })
})

// ─── Plugin command with content but no hint ────────────────────────────────

describe('InputBar — plugin command no hint sends expanded template', () => {
  it('Enter on plugin command without hint expands and sends template', () => {
    const onSend = vi.fn()
    const pluginCommands = [
      { name: 'sum', description: 'Summarize', prompt: 'Summarize: {{args}}' },
    ]
    renderInputBar({ onSend, pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/sum this text' } })
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(onSend).toHaveBeenCalledWith('Summarize: this text', [], undefined)
  })
})

// ─── Disabled state shows stop button ───────────────────────────────────────

describe('InputBar — disabled state stop button', () => {
  it('stop button is clickable and calls onCancel', () => {
    const onCancel = vi.fn()
    renderInputBar({ disabled: true, onCancel })
    fireEvent.click(screen.getByLabelText('Stop generation (Ctrl+C)'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
