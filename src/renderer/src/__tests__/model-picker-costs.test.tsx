import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

async function openModelPicker(extraModels: { id: string }[] = []) {
  const defaultModels = [
    { id: 'gpt-4o' },
    { id: 'gpt-4o-mini' },
    { id: 'claude-3-opus' },
    { id: 'claude-3-haiku' },
    { id: 'unknown-model' },
    ...extraModels,
  ]
  const fetchModels = vi.fn().mockResolvedValue({ data: defaultModels })
  window.electron.ext.fetchModels = fetchModels

  renderInputBar({
    onCommand: vi.fn(),
    providers: [{ id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test' }],
    apiBaseUrl: '',
    apiKey: 'test',
  })

  const textarea = screen.getByPlaceholderText(PLACEHOLDER)
  fireEvent.change(textarea, { target: { value: '/model' } })
  await act(async () => {
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
  })
  await waitFor(() => {
    expect(screen.queryByText('gpt-4o')).toBeInTheDocument()
  })
  return textarea
}

describe('Model picker — cost estimates and context window', () => {
  it('renders cost estimate per 1K tokens for known models', async () => {
    await openModelPicker()
    // gpt-4o pricing: input: 0.005, output: 0.015
    // The cost is rendered as $0.005/$0.015 in a font-mono span
    const gpt4oBtn = screen.getByText('gpt-4o').closest('button')!
    expect(gpt4oBtn.textContent).toContain('$0.005/$0.015')
  })

  it('renders context window size for known models', async () => {
    await openModelPicker()
    // gpt-4o: 128K, claude-3-opus: 200K
    const gpt4oBtn = screen.getByText('gpt-4o').closest('button')!
    expect(gpt4oBtn.textContent).toContain('128K')

    const claudeBtn = screen.getByText('claude-3-opus').closest('button')!
    expect(claudeBtn.textContent).toContain('200K')
  })

  it('renders context window even when model has no pricing', async () => {
    await openModelPicker()
    // unknown-model has no pricing but still gets a context window
    const unknownBtn = screen.getByText('unknown-model').closest('button')!
    // Should have context window badge (default 128K) but no cost
    expect(unknownBtn.textContent).toContain('128K')
    // No cost pattern like $X.XXX/$X.XXX
    expect(unknownBtn.textContent).not.toMatch(/\$\d/)
  })

  it('does not render cost for unknown models', async () => {
    await openModelPicker()
    const unknownBtn = screen.getByText('unknown-model').closest('button')!
    // Should NOT contain a price like $0.00
    expect(unknownBtn.textContent).not.toMatch(/\$\d+\.\d+\/\$\d+\.\d+/)
  })

  it('search filters by provider name', async () => {
    await openModelPicker()
    const searchInput = screen.getByPlaceholderText('Search models…')
    fireEvent.change(searchInput, { target: { value: 'claude' } })
    // claude models should appear
    await waitFor(() => {
      expect(screen.getByText('claude-3-opus')).toBeInTheDocument()
      expect(screen.getByText('claude-3-haiku')).toBeInTheDocument()
    })
    // gpt models should NOT appear
    expect(screen.queryByText('gpt-4o')).not.toBeInTheDocument()
    expect(screen.queryByText('gpt-4o-mini')).not.toBeInTheDocument()
  })

  it('search filters by cost range (input cost)', async () => {
    await openModelPicker()
    const searchInput = screen.getByPlaceholderText('Search models…')
    // gpt-4o-mini has input cost 0.00015
    fireEvent.change(searchInput, { target: { value: '0.00015' } })
    await waitFor(() => {
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    })
    // Other models should not appear (they don't have 0.00015 as input or output cost)
    expect(screen.queryByText('gpt-4o')).not.toBeInTheDocument()
    expect(screen.queryByText('claude-3-opus')).not.toBeInTheDocument()
  })

  it('context window is formatted correctly for 1M+ models', async () => {
    await openModelPicker([{ id: 'gemini-2.5-pro' }])
    const geminiBtn = screen.getByText('gemini-2.5-pro').closest('button')!
    // gemini-2.5-pro has 1048576 tokens → 1048576/1000000 = ~1.0M
    expect(geminiBtn.textContent).toContain('M')
  })
})
