import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import {
  splitModelRef, makeModelRef, displayModel,
  effectiveProviders, hasProvider, resolveProvider,
} from '@/lib/providers'
import { parseSettings } from '@/schemas'
import { contextWindow } from '@/lib/context'
import { InputBar } from '../components/InputBar'
import { SettingsPanel } from '../components/SettingsPanel'
import type { AppSettings } from '@/types'

const TWO_PROVIDERS: AppSettings = {
  apiKey: '',
  apiBaseUrl: '',
  providers: [
    { id: 'local', label: 'Local', baseUrl: 'http://localhost:11434/v1', apiKey: '' },
    { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'gsk-1' },
  ],
  defaultModel: '',
  themeId: 'steel',
  colorMode: 'dark',
  systemPrompt: '',
  permissionMode: 'ask',
}

beforeEach(() => { vi.clearAllMocks() })

describe('model refs', () => {
  it('round-trips provider::model refs', () => {
    expect(splitModelRef(makeModelRef('local', 'llama3'))).toEqual({ providerId: 'local', modelId: 'llama3' })
  })

  it('treats plain ids as provider-less', () => {
    expect(splitModelRef('gpt-4o')).toEqual({ providerId: null, modelId: 'gpt-4o' })
  })

  it('keeps slashes in model ids intact', () => {
    expect(splitModelRef('or::meta/llama-3.1-70b')).toEqual({ providerId: 'or', modelId: 'meta/llama-3.1-70b' })
  })

  it('displayModel strips the provider prefix', () => {
    expect(displayModel('local::llama3')).toBe('llama3')
    expect(displayModel('gpt-4o')).toBe('gpt-4o')
  })

  it('contextWindow accepts prefixed refs', () => {
    expect(contextWindow('local::claude-3-opus')).toBe(200000)
  })
})

describe('resolveProvider', () => {
  it('routes a prefixed ref to its provider', () => {
    const r = resolveProvider('groq::llama-3.1-70b', TWO_PROVIDERS)
    expect(r).toEqual({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'gsk-1', modelId: 'llama-3.1-70b', providerId: 'groq' })
  })

  it('falls back to the first provider for plain ids', () => {
    const r = resolveProvider('llama3', TWO_PROVIDERS)
    expect(r.baseUrl).toBe('http://localhost:11434/v1')
    expect(r.modelId).toBe('llama3')
  })

  it('falls back to the first provider for an unknown provider id', () => {
    const r = resolveProvider('gone::x', TWO_PROVIDERS)
    expect(r.baseUrl).toBe('http://localhost:11434/v1')
  })

  it('uses legacy apiBaseUrl fields when no providers configured', () => {
    const legacy = { ...TWO_PROVIDERS, providers: [], apiBaseUrl: 'http://legacy/v1', apiKey: 'k' }
    const r = resolveProvider('m', legacy)
    expect(r).toEqual({ baseUrl: 'http://legacy/v1', apiKey: 'k', modelId: 'm', providerId: 'default' })
  })

  it('hasProvider is false with nothing configured', () => {
    expect(hasProvider({ providers: [], apiBaseUrl: '', apiKey: '' })).toBe(false)
    expect(hasProvider(TWO_PROVIDERS)).toBe(true)
  })
})

describe('settings migration', () => {
  it('migrates legacy endpoint into providers[0]', () => {
    const s = parseSettings({ apiBaseUrl: 'http://localhost:1234/v1', apiKey: 'k' })
    expect(s.providers).toEqual([{ id: 'default', label: 'Default', baseUrl: 'http://localhost:1234/v1', apiKey: 'k' }])
  })

  it('leaves an existing providers list untouched', () => {
    const s = parseSettings({ apiBaseUrl: 'http://old/v1', providers: [{ id: 'a', label: 'A', baseUrl: 'http://a/v1', apiKey: '' }] })
    expect(s.providers).toHaveLength(1)
    expect(s.providers[0].id).toBe('a')
  })
})

describe('InputBar model picker across providers', () => {
  it('fetches from every provider and stores prefixed refs', async () => {
    const fetchModels = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 'llama3' }] })
      .mockResolvedValueOnce({ data: [{ id: 'mixtral' }] })
    window.electron.ext.fetchModels = fetchModels
    const onCommand = vi.fn()

    render(<InputBar onSend={vi.fn()} onCommand={onCommand} providers={TWO_PROVIDERS.providers} currentModel="local::llama3" />)
    fireEvent.click(screen.getByTitle('Change model'))

    await waitFor(() => expect(fetchModels).toHaveBeenCalledTimes(2))
    expect(fetchModels).toHaveBeenCalledWith('http://localhost:11434/v1', '')
    expect(fetchModels).toHaveBeenCalledWith('https://api.groq.com/openai/v1', 'gsk-1')

    // Grouped by provider label
    expect(await screen.findByText('Local')).toBeInTheDocument()
    expect(screen.getByText('Groq')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText('mixtral'))
    expect(onCommand).toHaveBeenCalledWith('model', 'groq::mixtral')
  })

  it('shows the bare model name in the chip for prefixed refs', () => {
    render(<InputBar onSend={vi.fn()} providers={TWO_PROVIDERS.providers} currentModel="groq::llama-3.1-70b" />)
    expect(screen.getByText('llama-3.1-70b')).toBeInTheDocument()
  })

  it('keeps working with only the legacy endpoint props', async () => {
    const fetchModels = vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4o' }] })
    window.electron.ext.fetchModels = fetchModels
    const onCommand = vi.fn()

    render(<InputBar onSend={vi.fn()} onCommand={onCommand} apiBaseUrl="http://x/v1" apiKey="k" />)
    fireEvent.click(screen.getByTitle('Change model'))

    await waitFor(() => expect(fetchModels).toHaveBeenCalledWith('http://x/v1', 'k'))
    fireEvent.mouseDown(await screen.findByText('gpt-4o'))
    // Single provider → plain model id, no prefix
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })
})

describe('SettingsPanel provider management', () => {
  const BASE: AppSettings = { ...TWO_PROVIDERS, providers: [] }

  it('adds a provider from a preset chip', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SettingsPanel settings={BASE} onSave={onSave} sessionCount={0} onDeleteAllSessions={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ollama' }))
    expect(screen.getByDisplayValue('Ollama')).toBeInTheDocument()
    expect(screen.getByDisplayValue('http://localhost:11434/v1')).toBeInTheDocument()

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        providers: [expect.objectContaining({ id: 'ollama', baseUrl: 'http://localhost:11434/v1' })],
      }))
    }, { timeout: 3000 })
  })

  it('supports multiple providers side by side with unique ids', () => {
    render(<SettingsPanel settings={BASE} onSave={vi.fn()} sessionCount={0} onDeleteAllSessions={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ollama' }))
    fireEvent.click(screen.getByRole('button', { name: 'Groq' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ollama' }))

    expect(screen.getAllByDisplayValue('Ollama')).toHaveLength(2)
    expect(screen.getByDisplayValue('Groq')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/base URL$/)).toHaveLength(3)
  })

  it('removes a provider', () => {
    render(<SettingsPanel settings={TWO_PROVIDERS} onSave={vi.fn()} sessionCount={0} onDeleteAllSessions={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Local' }))
    expect(screen.queryByDisplayValue('http://localhost:11434/v1')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('https://api.groq.com/openai/v1')).toBeInTheDocument()
  })

  it('renders the legacy endpoint as an editable provider card', () => {
    render(
      <SettingsPanel
        settings={{ ...BASE, apiBaseUrl: 'http://localhost:1234/v1', apiKey: 'old' }}
        onSave={vi.fn()}
        sessionCount={0}
        onDeleteAllSessions={vi.fn()}
      />
    )
    expect(screen.getByDisplayValue('Default')).toBeInTheDocument()
    expect(screen.getByDisplayValue('http://localhost:1234/v1')).toBeInTheDocument()
  })
})
