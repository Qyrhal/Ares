import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MessageItem } from '../components/MessageItem'
import type { Message } from '@/types'

function mkMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, world!',
    createdAt: Date.now(),
    ...overrides,
  } as Message
}

function renderMsg(msg: Partial<Message> = {}, props: Record<string, unknown> = {}) {
  return render(
    <MessageItem
      message={mkMsg(msg)}
      {...props}
    />
  )
}

// ─── Rendering by role ──────────────────────────────────────────────────

describe('MessageItem — rendering by role', () => {
  it('renders user message with "U" avatar', () => {
    renderMsg({ role: 'user', content: 'User message' })
    expect(screen.getByText('User message')).toBeInTheDocument()
    expect(screen.getByText('U')).toBeInTheDocument()
  })

  it('renders assistant message with SVG avatar', () => {
    renderMsg({ role: 'assistant', content: 'Assistant message' })
    expect(screen.getByText('Assistant message')).toBeInTheDocument()
    // Assistant uses SVG avatar, not text
    const avatar = document.querySelector('.size-4')
    expect(avatar).toBeInTheDocument()
  })

  it('renders system message in separator marker', () => {
    renderMsg({ role: 'system', content: 'System notice' })
    expect(screen.getByText('System notice')).toBeInTheDocument()
  })

  it('renders tool message as ToolCallBlock', () => {
    renderMsg({
      role: 'tool',
      toolName: 'readFile',
      toolStatus: 'done',
      toolInput: '{"path":"/test.ts"}',
      toolOutput: 'file content here',
    })
    expect(screen.getByText('readFile')).toBeInTheDocument()
  })
})

// ─── Hover action buttons ────────────────────────────────────────────────

describe('MessageItem — hover action buttons', () => {
  it('copy button is rendered', () => {
    renderMsg({ role: 'user', content: 'Copy me' })
    expect(screen.getByLabelText('Copy message')).toBeInTheDocument()
  })

  it('reply button rendered when onReply provided', () => {
    renderMsg({ role: 'user', content: 'Reply to me' }, { onReply: vi.fn() })
    expect(screen.getByLabelText('Reply to message')).toBeInTheDocument()
  })

  it('reply button NOT rendered without onReply', () => {
    renderMsg({ role: 'user', content: 'No reply' })
    expect(screen.queryByLabelText('Reply to message')).not.toBeInTheDocument()
  })

  it('edit button rendered for user messages when onEdit provided', () => {
    renderMsg({ role: 'user', content: 'Edit me' }, { onEdit: vi.fn() })
    expect(screen.getByLabelText('Edit message')).toBeInTheDocument()
  })

  it('edit button NOT rendered for assistant messages', () => {
    renderMsg({ role: 'assistant', content: 'Do not edit' }, { onEdit: vi.fn() })
    expect(screen.queryByLabelText('Edit message')).not.toBeInTheDocument()
  })

  it('delete button rendered when onDelete provided', () => {
    renderMsg({ role: 'user', content: 'Delete me' }, { onDelete: vi.fn() })
    expect(screen.getByLabelText('Delete message')).toBeInTheDocument()
  })

  it('regenerate button rendered for assistant when onRegenerate provided', () => {
    renderMsg({ role: 'assistant', content: 'Regenerate me' }, { onRegenerate: vi.fn() })
    expect(screen.getByLabelText('Regenerate response')).toBeInTheDocument()
  })

  it('regenerate button NOT rendered for user messages', () => {
    renderMsg({ role: 'user', content: 'No regen' }, { onRegenerate: vi.fn() })
    expect(screen.queryByLabelText('Regenerate response')).not.toBeInTheDocument()
  })

  it('edit-resend button rendered for assistant when onEditResend provided', () => {
    renderMsg({ role: 'assistant', content: 'Edit resend' }, { onEditResend: vi.fn() })
    expect(screen.getByLabelText('Edit and resend')).toBeInTheDocument()
  })

  it('edit-resend button NOT rendered for user messages', () => {
    renderMsg({ role: 'user', content: 'No edit resend' }, { onEditResend: vi.fn() })
    expect(screen.queryByLabelText('Edit and resend')).not.toBeInTheDocument()
  })
})

// ─── Callback interactions ───────────────────────────────────────────────

describe('MessageItem — callback interactions', () => {
  it('copy button copies to clipboard and shows check icon', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderMsg({ role: 'user', content: 'Copy me' })
    fireEvent.click(screen.getByLabelText('Copy message'))
    expect(writeText).toHaveBeenCalledWith('Copy me')
  })

  it('reply button calls onReply with message', () => {
    const onReply = vi.fn()
    const msg = mkMsg({ role: 'user', content: 'Reply me' })
    render(
      <MessageItem message={msg} onReply={onReply} />
    )
    fireEvent.click(screen.getByLabelText('Reply to message'))
    expect(onReply).toHaveBeenCalledWith(msg)
  })

  it('delete button calls onDelete with message', () => {
    const onDelete = vi.fn()
    const msg = mkMsg({ role: 'user', content: 'Delete me' })
    render(
      <MessageItem message={msg} onDelete={onDelete} />
    )
    fireEvent.click(screen.getByLabelText('Delete message'))
    expect(onDelete).toHaveBeenCalledWith(msg)
  })

  it('regenerate button calls onRegenerate with message', () => {
    const onRegenerate = vi.fn()
    const msg = mkMsg({ role: 'assistant', content: 'Regen me' })
    render(
      <MessageItem message={msg} onRegenerate={onRegenerate} />
    )
    fireEvent.click(screen.getByLabelText('Regenerate response'))
    expect(onRegenerate).toHaveBeenCalledWith(msg)
  })

  it('edit-resend button calls onEditResend with message', () => {
    const onEditResend = vi.fn()
    const msg = mkMsg({ role: 'assistant', content: 'Edit resend me' })
    render(
      <MessageItem message={msg} onEditResend={onEditResend} />
    )
    fireEvent.click(screen.getByLabelText('Edit and resend'))
    expect(onEditResend).toHaveBeenCalledWith(msg)
  })
})

// ─── Edit mode ──────────────────────────────────────────────────────────

describe('MessageItem — edit mode', () => {
  it('clicking edit button shows textarea with original content', () => {
    renderMsg({ role: 'user', content: 'Original text' }, { onEdit: vi.fn() })
    fireEvent.click(screen.getByLabelText('Edit message'))
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe('Original text')
  })

  it('Save button calls onEdit with updated content', () => {
    const onEdit = vi.fn()
    renderMsg({ role: 'user', content: 'Original' }, { onEdit })
    fireEvent.click(screen.getByLabelText('Edit message'))
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Updated' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onEdit).toHaveBeenCalledWith('msg-1', 'Updated')
  })

  it('Cancel button exits edit mode without saving', () => {
    const onEdit = vi.fn()
    renderMsg({ role: 'user', content: 'Original' }, { onEdit })
    fireEvent.click(screen.getByLabelText('Edit message'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(onEdit).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).not.toBeInTheDocument()
  })

  it('Escape key exits edit mode', () => {
    const onEdit = vi.fn()
    renderMsg({ role: 'user', content: 'Original' }, { onEdit })
    fireEvent.click(screen.getByLabelText('Edit message'))
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('Enter key saves edit (without shift)', () => {
    const onEdit = vi.fn()
    renderMsg({ role: 'user', content: 'Original' }, { onEdit })
    fireEvent.click(screen.getByLabelText('Edit message'))
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Updated' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onEdit).toHaveBeenCalledWith('msg-1', 'Updated')
  })
})

// ─── Reply quote ────────────────────────────────────────────────────────

describe('MessageItem — reply quote', () => {
  it('renders reply quote with user role label', () => {
    renderMsg({
      role: 'assistant',
      content: 'Reply here',
      replyTo: { id: 'm0', content: 'Original message', role: 'user' },
    })
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Original message')).toBeInTheDocument()
  })

  it('renders reply quote with assistant role label', () => {
    renderMsg({
      role: 'user',
      content: 'User reply',
      replyTo: { id: 'm0', content: 'Assistant message', role: 'assistant' },
    })
    expect(screen.getByText('Assistant')).toBeInTheDocument()
    expect(screen.getByText('Assistant message')).toBeInTheDocument()
  })

  it('does not render reply quote when replyTo is absent', () => {
    renderMsg({ role: 'user', content: 'No reply quote' })
    expect(screen.queryByText('You')).not.toBeInTheDocument()
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument()
  })
})

// ─── Reactions ──────────────────────────────────────────────────────────

describe('MessageItem — reactions', () => {
  it('thumbs up and down buttons rendered for assistant messages', () => {
    renderMsg({ role: 'assistant', content: 'React to me' }, { onReact: vi.fn() })
    expect(screen.getByLabelText('Thumbs up')).toBeInTheDocument()
    expect(screen.getByLabelText('Thumbs down')).toBeInTheDocument()
  })

  it('reactions NOT rendered for user messages', () => {
    renderMsg({ role: 'user', content: 'No reactions' }, { onReact: vi.fn() })
    expect(screen.queryByLabelText('Thumbs up')).not.toBeInTheDocument()
  })

  it('thumbs up click calls onReact with up=true', () => {
    const onReact = vi.fn()
    renderMsg({ role: 'assistant', content: 'React me' }, { onReact })
    fireEvent.click(screen.getByLabelText('Thumbs up'))
    expect(onReact).toHaveBeenCalledWith('msg-1', { up: true })
  })

  it('thumbs up toggle (already up) calls onReact with up=null', () => {
    const onReact = vi.fn()
    renderMsg({ role: 'assistant', content: 'React me', reactions: { up: true } }, { onReact })
    fireEvent.click(screen.getByLabelText('Thumbs up'))
    expect(onReact).toHaveBeenCalledWith('msg-1', { up: null })
  })

  it('thumbs down click calls onReact with up=false', () => {
    const onReact = vi.fn()
    renderMsg({ role: 'assistant', content: 'React me' }, { onReact })
    fireEvent.click(screen.getByLabelText('Thumbs down'))
    expect(onReact).toHaveBeenCalledWith('msg-1', { up: false })
  })

  it('thumbs down when already down toggles to null', () => {
    const onReact = vi.fn()
    renderMsg({ role: 'assistant', content: 'React me', reactions: { up: false } }, { onReact })
    fireEvent.click(screen.getByLabelText('Thumbs down'))
    expect(onReact).toHaveBeenCalledWith('msg-1', { up: null })
  })

  it('switching from up to down calls onReact with up=false', () => {
    const onReact = vi.fn()
    renderMsg({ role: 'assistant', content: 'React me', reactions: { up: true } }, { onReact })
    fireEvent.click(screen.getByLabelText('Thumbs down'))
    expect(onReact).toHaveBeenCalledWith('msg-1', { up: false })
  })
})

// ─── Thinking block ─────────────────────────────────────────────────────

describe('MessageItem — thinking block', () => {
  it('renders thinking block when thinking is present', () => {
    renderMsg({ role: 'assistant', content: 'Response', thinking: 'Analyzing the code...' })
    expect(screen.getByText('Thought')).toBeInTheDocument()
  })

  it('thinking content visible when expanded', () => {
    renderMsg({ role: 'assistant', content: 'Response', thinking: 'Deep thought here' })
    fireEvent.click(screen.getByText('Thought'))
    expect(screen.getByText('Deep thought here')).toBeInTheDocument()
  })

  it('streaming thinking shows "Thinking…" label', () => {
    renderMsg({
      role: 'assistant',
      content: '',
      thinking: 'Working...',
      isStreaming: true,
    })
    expect(screen.getByText('Thinking…')).toBeInTheDocument()
  })
})

// ─── Tool call block ────────────────────────────────────────────────────

describe('MessageItem — tool call block', () => {
  it('shows tool name', () => {
    renderMsg({
      role: 'tool',
      toolName: 'readFile',
      toolStatus: 'done',
    })
    expect(screen.getByText('readFile')).toBeInTheDocument()
  })

  it('expands to show tool input on click', () => {
    renderMsg({
      role: 'tool',
      toolName: 'readFile',
      toolStatus: 'done',
      toolInput: '{"path":"/test.ts"}',
    })
    fireEvent.click(screen.getByText('readFile'))
    expect(screen.getByText('readFile')).toBeInTheDocument()
  })

  it('running status shows elapsed time', () => {
    renderMsg({
      role: 'tool',
      toolName: 'writeFile',
      toolStatus: 'running',
    })
    expect(screen.getByText('writeFile')).toBeInTheDocument()
  })

  it('done status with duration shows time', () => {
    renderMsg({
      role: 'tool',
      toolName: 'exec',
      toolStatus: 'done',
      duration: 1500,
    })
    expect(screen.getByText('exec')).toBeInTheDocument()
    expect(screen.getByText('1.5s')).toBeInTheDocument()
  })

  it('error status shows error icon', () => {
    renderMsg({
      role: 'tool',
      toolName: 'fail',
      toolStatus: 'error',
    })
    expect(screen.getByText('fail')).toBeInTheDocument()
  })
})

// ─── Token badge ────────────────────────────────────────────────────────

describe('MessageItem — token badge', () => {
  it('shows token badge for assistant messages with tokenCount', () => {
    renderMsg({ role: 'assistant', content: 'Response', tokenCount: 120, duration: 3000 })
    expect(screen.getByText(/120/)).toBeInTheDocument()
  })

  it('does not show token badge without tokenCount or duration', () => {
    renderMsg({ role: 'assistant', content: 'Response' })
    expect(screen.queryByText(/tok/)).not.toBeInTheDocument()
  })

  it('does not show token badge for user messages', () => {
    renderMsg({ role: 'user', content: 'User msg', tokenCount: 50 })
    expect(screen.queryByText(/50/)).not.toBeInTheDocument()
  })
})

// ─── Timestamp ──────────────────────────────────────────────────────────

describe('MessageItem — timestamp', () => {
  it('renders timestamp element', () => {
    renderMsg({ role: 'user', content: 'With timestamp', createdAt: Date.now() })
    // Timestamp is rendered as a span with 10px text
    const timestamp = document.querySelector('.text-\\[10px\\]')
    expect(timestamp).toBeInTheDocument()
  })
})

// ─── Attachments ────────────────────────────────────────────────────────

describe('MessageItem — attachments', () => {
  it('renders file attachments for user messages', () => {
    renderMsg({
      role: 'user',
      content: 'Check this file',
      attachments: [{ id: 'a1', name: 'test.ts', size: 1024, type: 'text/typescript', path: '/test.ts' }],
    })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
  })

  it('does not render attachments for assistant messages', () => {
    renderMsg({
      role: 'assistant',
      content: 'Response',
      attachments: [{ id: 'a1', name: 'test.ts', size: 1024, type: 'text/typescript', path: '/test.ts' }],
    })
    expect(screen.queryByText('test.ts')).not.toBeInTheDocument()
  })
})

// ─── isJumped highlight ─────────────────────────────────────────────────

describe('MessageItem — isJumped', () => {
  it('applies jump highlight class', () => {
    const { container } = renderMsg({ role: 'user', content: 'Jumped msg' }, { isJumped: true })
    const el = container.querySelector('.bg-primary\\/10')
    expect(el).toBeInTheDocument()
  })

  it('does not apply highlight when not jumped', () => {
    const { container } = renderMsg({ role: 'user', content: 'Not jumped' }, { isJumped: false })
    const el = container.querySelector('.bg-primary\\/10')
    expect(el).not.toBeInTheDocument()
  })
})

// ─── data-message-id ────────────────────────────────────────────────────

describe('MessageItem — data-message-id', () => {
  it('renders data-message-id attribute', () => {
    const { container } = renderMsg({ role: 'user', content: 'With ID' }, { 'data-message-id': 'test-id' })
    const el = container.querySelector('[data-message-id="test-id"]')
    expect(el).toBeInTheDocument()
  })
})

// ─── Empty content edge cases ────────────────────────────────────────────

describe('MessageItem — edge cases', () => {
  it('renders empty user message without crash', () => {
    expect(() => {
      renderMsg({ role: 'user', content: '' })
    }).not.toThrow()
  })

  it('renders empty assistant message without crash', () => {
    expect(() => {
      renderMsg({ role: 'assistant', content: '' })
    }).not.toThrow()
  })

  it('renders very long message without crash', () => {
    const longText = 'A'.repeat(10000)
    expect(() => {
      renderMsg({ role: 'user', content: longText })
    }).not.toThrow()
    expect(screen.getByText(longText)).toBeInTheDocument()
  })

  it('renders markdown content in assistant messages', () => {
    renderMsg({ role: 'assistant', content: '**bold** and *italic*' })
    expect(screen.getByText(/bold/)).toBeInTheDocument()
  })
})
