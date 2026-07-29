import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      pluginSkills={[]}
      pluginCommands={[]}
      {...props}
    />
  )
}

// ─── Effort picker click-outside dismiss ────────────────────────────────────

describe('InputBar — effort picker click-outside dismiss', () => {
  it('clicking outside effort picker closes it', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    const effortBtn = screen.getByText('Med')
    fireEvent.click(effortBtn)
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('low')).not.toBeInTheDocument()
    expect(screen.queryByText('high')).not.toBeInTheDocument()
  })

  it('clicking the effort button toggles the picker open', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    const effortBtn = screen.getByText('Med')
    // Closed initially
    expect(screen.queryByText('low')).not.toBeInTheDocument()
    // Open
    fireEvent.click(effortBtn)
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    // Clicking button again closes it
    fireEvent.click(effortBtn)
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })

  it('selecting an effort option calls onEffortChange and closes picker', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ effort: 'medium', onEffortChange })
    fireEvent.click(screen.getByText('Med'))
    expect(screen.getByText('low')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText('high'))
    expect(onEffortChange).toHaveBeenCalledWith('high')
    // Picker closes after selection (onMouseDown handler calls setShowEffortPicker(false))
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })

  it('clicking outside closes effort picker even when command picker is also open', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    fireEvent.click(screen.getByText('Med'))
    expect(screen.getByText('low')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })
})

// ─── Effort picker Escape key ──────────────────────────────────────────────

describe('InputBar — effort picker Escape key', () => {
  it('Escape does NOT close effort picker (no Escape handler on effort ref)', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    fireEvent.click(screen.getByText('Med'))
    expect(screen.getByText('low')).toBeInTheDocument()

    // The effort picker has no Escape handler — only click-outside dismisses it
    fireEvent.keyDown(screen.getByText('Med'), { key: 'Escape' })
    expect(screen.getByText('low')).toBeInTheDocument()
  })
})

// ─── Model picker click-outside dismiss ─────────────────────────────────────

describe('InputBar — model picker click-outside dismiss', () => {
  it('model picker opens when /model Enter is pressed', async () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [],
      currentModel: 'gpt-4o',
      providers: [{ id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test' }],
      apiBaseUrl: '',
      apiKey: 'test',
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })

  it('clicking outside model picker closes it', async () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [],
      currentModel: 'gpt-4o',
      providers: [{ id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test' }],
      apiBaseUrl: '',
      apiKey: 'test',
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByPlaceholderText('Search models…')).not.toBeInTheDocument()
  })

  it('clicking inside model search input keeps it open', async () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [],
      currentModel: 'gpt-4o',
      providers: [{ id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test' }],
      apiBaseUrl: '',
      apiKey: 'test',
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model' } })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })
    const searchInput = screen.getByPlaceholderText('Search models…')
    expect(searchInput).toBeInTheDocument()

    fireEvent.mouseDown(searchInput)
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })
})

// ─── Picker interaction edge cases ──────────────────────────────────────────

describe('InputBar — picker interaction edge cases', () => {
  it('opening effort picker after closing command picker works', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.queryByText('/model')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Med'))
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('effort picker and command picker can both be open simultaneously', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    fireEvent.click(screen.getByText('Med'))
    expect(screen.getByText('low')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.queryByText('/model')).toBeInTheDocument()
  })
})
