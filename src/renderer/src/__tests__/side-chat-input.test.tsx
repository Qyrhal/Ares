import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SideChatInput } from '../components/SideChatInput'

describe('SideChatInput', () => {
  it('renders a textarea and a send button', () => {
    render(<SideChatInput onSend={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Side chat message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send side chat message' })).toBeInTheDocument()
  })

  it('disables send when text is empty', () => {
    render(<SideChatInput onSend={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Send side chat message' })).toBeDisabled()
  })

  it('sends on button click and clears the textarea', () => {
    const onSend = vi.fn()
    render(<SideChatInput onSend={onSend} />)
    const ta = screen.getByRole('textbox', { name: 'Side chat message' })
    fireEvent.change(ta, { target: { value: 'hello side chat' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send side chat message' }))
    expect(onSend).toHaveBeenCalledWith('hello side chat')
    expect(ta).toHaveValue('')
  })

  it('sends on Enter, keeps text on Shift+Enter', () => {
    const onSend = vi.fn()
    render(<SideChatInput onSend={onSend} />)
    const ta = screen.getByRole('textbox', { name: 'Side chat message' })

    fireEvent.change(ta, { target: { value: 'multi\nline' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()

    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('multi\nline')
  })

  it('trims whitespace and refuses whitespace-only sends', () => {
    const onSend = vi.fn()
    render(<SideChatInput onSend={onSend} />)
    const ta = screen.getByRole('textbox', { name: 'Side chat message' })
    fireEvent.change(ta, { target: { value: '   ' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()

    fireEvent.change(ta, { target: { value: '  hi  ' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hi')
  })

  it('shows a stop button instead of send while loading', () => {
    const onCancel = vi.fn()
    render(<SideChatInput onSend={vi.fn()} disabled onCancel={onCancel} />)
    expect(screen.queryByRole('button', { name: 'Send side chat message' })).not.toBeInTheDocument()
    const stop = screen.getByRole('button', { name: 'Stop generation' })
    fireEvent.click(stop)
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not send while disabled', () => {
    const onSend = vi.fn()
    render(<SideChatInput onSend={onSend} disabled onCancel={vi.fn()} />)
    const ta = screen.getByRole('textbox', { name: 'Side chat message' })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('uses the provided placeholder', () => {
    render(<SideChatInput onSend={vi.fn()} placeholder="Ask gpt-4o…" />)
    expect(screen.getByPlaceholderText('Ask gpt-4o…')).toBeInTheDocument()
  })
})
