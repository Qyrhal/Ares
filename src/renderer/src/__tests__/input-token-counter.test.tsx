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

describe('InputBar — token counter', () => {
  it('renders counter when text is non-empty', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(screen.getByText('5 chars · ~2 tok')).toBeInTheDocument()
  })

  it('hides counter when text is empty', () => {
    renderInputBar()
    const { container } = renderInputBar()
    const counter = container.querySelector('span.font-mono')
    expect(counter).toBeNull()
  })

  it('shows correct character count', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    expect(screen.getByText('11 chars · ~3 tok')).toBeInTheDocument()
  })

  it('shows estimated token count using char/4 heuristic', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'abcdefgh' } })
    expect(screen.getByText('8 chars · ~2 tok')).toBeInTheDocument()
  })

  it('formats correctly (e.g. 42 chars · ~11 tok)', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    const input = 'The quick brown fox jumps over the lazy dog'
    fireEvent.change(textarea, { target: { value: input } })
    expect(screen.getByText(`${input.length} chars · ~${Math.ceil(input.length / 4)} tok`)).toBeInTheDocument()
  })

  it('updates counter as user types', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'a' } })
    expect(screen.getByText('1 chars · ~1 tok')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'ab' } })
    expect(screen.getByText('2 chars · ~1 tok')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'abc' } })
    expect(screen.getByText('3 chars · ~1 tok')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'abcd' } })
    expect(screen.getByText('4 chars · ~1 tok')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'abcde' } })
    expect(screen.getByText('5 chars · ~2 tok')).toBeInTheDocument()
  })

  it('counter disappears when text is cleared', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(screen.getByText('5 chars · ~2 tok')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '' } })
    const { container } = document.body.parentElement ? { container: document.body } : { container: document.body }
    const counters = container.querySelectorAll('span.font-mono')
    const visible = Array.from(counters).filter(el => el.textContent?.includes('chars'))
    expect(visible.length).toBe(0)
  })
})
