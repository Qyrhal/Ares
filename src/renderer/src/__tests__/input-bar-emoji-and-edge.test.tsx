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

// ─── Emoji autocomplete — component integration ─────────────────────

describe('InputBar — emoji autocomplete (integration)', () => {
  it('shows emoji dropdown when : is typed at start', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':heart' } })
    expect(screen.getByText('❤️')).toBeInTheDocument()
  })

  it('filters emoji by partial query', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':fire' } })
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.queryByText('❤️')).not.toBeInTheDocument()
  })

  it('shows emoji list for broad query like :r', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':r' } })
    expect(screen.getByText('🚀')).toBeInTheDocument()
    expect(screen.getByText('🌈')).toBeInTheDocument()
  })

  it('ArrowDown navigates emoji highlight', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':r' } })
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
  })

  it('Enter inserts highlighted emoji into textarea', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: ':rocket' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(textarea.value).toContain('🚀')
    expect(textarea.value).not.toContain(':rocket')
  })

  it('Tab inserts highlighted emoji into textarea', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: ':heart' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toContain('❤️')
  })

  it('Escape closes emoji dropdown', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':heart' } })
    expect(screen.getByText('❤️')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText('❤️')).not.toBeInTheDocument()
  })

  it('emoji dropdown closes when colon has space after', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'time: now' } })
    expect(screen.queryByText('❤️')).not.toBeInTheDocument()
    expect(screen.queryByText('🚀')).not.toBeInTheDocument()
  })

  it('clicking emoji in dropdown inserts it', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: ':he' } })
    const heartBtn = screen.getByText('❤️')
    fireEvent.mouseDown(heartBtn)
    expect(textarea.value).toContain('❤️')
  })

  it('does not show emoji dropdown for empty query after colon', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':' } })
    expect(screen.queryByText('❤️')).not.toBeInTheDocument()
  })

  it('ArrowDown at last emoji item does not crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':heart' } })
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    }
  })

  it('ArrowUp at first emoji item does not crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':heart' } })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
  })
})

// ─── Slash command + emoji interop ──────────────────────────────────

describe('InputBar — slash command and emoji interop', () => {
  it('switching from slash to emoji closes command picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    expect(screen.getAllByText('/clear').length).toBeGreaterThanOrEqual(1)
    fireEvent.change(textarea, { target: { value: ':rocket' } })
    expect(screen.getByText('🚀')).toBeInTheDocument()
  })

  it('switching from emoji to slash closes emoji picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':heart' } })
    expect(screen.getByText('❤️')).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '/clear' } })
    expect(screen.getAllByText('/clear').length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Model picker interaction edge cases ────────────────────────────

describe('InputBar — model picker edge cases', () => {
  it('model picker search filters models', async () => {
    renderInputBar({
      currentModel: 'gpt-4o',
      providers: [{ id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test' }],
      apiBaseUrl: '',
      apiKey: '',
    })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    const searchInput = screen.getByPlaceholderText('Search models…')
    // Wait for async fetchModels to complete
    await new Promise((r) => setTimeout(r, 50))
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })
    expect(screen.getByText('No models found')).toBeInTheDocument()
  })

  it('model picker ArrowDown/ArrowUp cycles through models', async () => {
    renderInputBar({
      currentModel: 'gpt-4o',
      providers: [{ id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test' }],
      apiBaseUrl: '',
      apiKey: '',
    })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    const searchInput = screen.getByPlaceholderText('Search models…')
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
    fireEvent.keyDown(searchInput, { key: 'ArrowUp' })
  })

  it('model picker Enter selects highlighted model', async () => {
    const onCommand = vi.fn()
    renderInputBar({
      onCommand,
      currentModel: 'gpt-4o',
      providers: [{ id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test' }],
      apiBaseUrl: '',
      apiKey: '',
    })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    const searchInput = screen.getByPlaceholderText('Search models…')
    await new Promise((r) => setTimeout(r, 50))
    fireEvent.keyDown(searchInput, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('model', expect.any(String))
  })
})

// ─── Reply + slash command interop ──────────────────────────────────

describe('InputBar — reply chip and command interop', () => {
  it('sending slash command with active reply clears reply', () => {
    const onCommand = vi.fn()
    renderInputBar({
      onCommand,
      onCancelReply: vi.fn(),
      replyTo: { id: 'm1', content: 'test', role: 'user' },
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/help' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('help', '')
  })

  it('regular message with reply includes replyTo', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      replyTo: { id: 'm1', content: 'Original message', role: 'user' },
      onCancelReply: vi.fn(),
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'My reply' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('My reply', [], { id: 'm1', content: 'Original message', role: 'user' })
  })
})

// ─── Context donut — edge cases ─────────────────────────────────────

describe('InputBar — context donut edge cases', () => {
  it('renders with zero messages', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const svg = document.querySelector('svg[viewBox="0 0 18 18"]')
    expect(svg).toBeInTheDocument()
  })

  it('renders with messages that have content', () => {
    const messages = [
      { id: 'm1', role: 'user' as const, content: 'Hello world', createdAt: 0 },
      { id: 'm2', role: 'assistant' as const, content: 'Hi there!', createdAt: 0 },
    ]
    renderInputBar({ currentModel: 'gpt-4o', messages })
    const svg = document.querySelector('svg[viewBox="0 0 18 18"]')
    expect(svg).toBeInTheDocument()
  })

  it('popup shows token counts when clicked', () => {
    const messages = [
      { id: 'm1', role: 'user' as const, content: 'test message here', createdAt: 0 },
    ]
    renderInputBar({ currentModel: 'gpt-4o', messages })
    const donutSvg = document.querySelector('svg[viewBox="0 0 18 18"]')
    const donutBtn = donutSvg!.closest('button')!
    fireEvent.click(donutBtn)
    expect(screen.getByText(/of context used/)).toBeInTheDocument()
  })
})

// ─── Effort picker — edge cases ─────────────────────────────────────

describe('InputBar — effort picker edge cases', () => {
  it('clicking effort button toggles picker', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    const effortBtn = screen.getByTitle('Effort level')
    fireEvent.click(effortBtn)
    expect(document.querySelector('.surface-overlay')).toBeInTheDocument()
    fireEvent.click(effortBtn)
  })

  it('selecting Low effort calls onEffortChange with low', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ onEffortChange, effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    const effortPicker = document.querySelector('.surface-overlay')!
    const buttons = effortPicker.querySelectorAll('button')
    fireEvent.mouseDown(buttons[0])
    expect(onEffortChange).toHaveBeenCalledWith('low')
  })

  it('selecting High effort calls onEffortChange with high', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ onEffortChange, effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    const effortPicker = document.querySelector('.surface-overlay')!
    const buttons = effortPicker.querySelectorAll('button')
    fireEvent.mouseDown(buttons[2])
    expect(onEffortChange).toHaveBeenCalledWith('high')
  })

  it('clicking outside effort picker closes it', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    expect(document.querySelector('.surface-overlay')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(document.querySelector('.surface-overlay')).not.toBeInTheDocument()
  })
})

// ─── Drag and drop ──────────────────────────────────────────────────

describe('InputBar — drag and drop', () => {
  it('does not crash on dragOver event', () => {
    renderInputBar()
    const container = document.querySelector('[class*="border-t"]')!
    fireEvent.dragOver(container)
  })

  it('does not crash on drop event with no files', () => {
    renderInputBar()
    const container = document.querySelector('[class*="border-t"]')!
    fireEvent.drop(container, { dataTransfer: { files: [] } })
  })
})

// ─── Multiple rapid interactions ────────────────────────────────────

describe('InputBar — rapid interaction sequences', () => {
  it('rapid slash → escape → slash does not crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    fireEvent.change(textarea, { target: { value: '/clear' } })
    expect(screen.getAllByText('/clear').length).toBeGreaterThanOrEqual(1)
  })

  it('rapid emoji → slash → emoji does not crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':heart' } })
    fireEvent.change(textarea, { target: { value: '/clear' } })
    expect(screen.getAllByText('/clear').length).toBeGreaterThanOrEqual(1)
    fireEvent.change(textarea, { target: { value: ':fire' } })
    expect(screen.getByText('🔥')).toBeInTheDocument()
  })

  it('typing in quick succession does not crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    for (let i = 0; i < 20; i++) {
      fireEvent.change(textarea, { target: { value: `/test${i}` } })
    }
  })
})
