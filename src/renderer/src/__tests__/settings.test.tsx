import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SettingsPanel } from '../components/SettingsPanel'
import { AppSettings } from '@/types'

const BASE_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseUrl: '',
  defaultModel: '',
  themeId: 'red',
  systemPrompt: '',
  permissionMode: 'ask',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SettingsPanel', () => {
  it('auto-fetches models when base URL is set on mount', async () => {
    window.electron.ext.fetchModels = vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4' }, { id: 'gpt-4o' }] })

    render(
      <SettingsPanel
        settings={{ ...BASE_SETTINGS, apiBaseUrl: 'http://localhost:11434/v1' }}
        onSave={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(window.electron.ext.fetchModels).toHaveBeenCalledWith(
        'http://localhost:11434/v1',
        '',
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Connected · 2 models available')).toBeInTheDocument()
    })
  })

  it('shows error when endpoint is unreachable', async () => {
    window.electron.ext.fetchModels = vi.fn().mockRejectedValue(new Error('fetch failed'))

    render(
      <SettingsPanel
        settings={{ ...BASE_SETTINGS, apiBaseUrl: 'http://localhost:9999/v1' }}
        onSave={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('fetch failed')).toBeInTheDocument()
    })
  })

  it('shows model hint instead of dropdown when no models fetched', async () => {
    window.electron.ext.fetchModels = vi.fn().mockRejectedValue(new Error('offline'))

    render(
      <SettingsPanel
        settings={{ ...BASE_SETTINGS, apiBaseUrl: 'http://localhost:9999/v1' }}
        onSave={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Test your endpoint/)).toBeInTheDocument()
    })
  })

  it('shows skill prompt section', () => {
    render(
      <SettingsPanel
        settings={BASE_SETTINGS}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByText(/readFile/)).toBeInTheDocument()
    expect(screen.getByText(/writeFile/)).toBeInTheDocument()
    expect(screen.getByText(/editFile/)).toBeInTheDocument()
    expect(screen.getByText(/createFile/)).toBeInTheDocument()
    expect(screen.getByText(/listFiles/)).toBeInTheDocument()
  })

  it('shows system prompt textarea', () => {
    render(
      <SettingsPanel
        settings={BASE_SETTINGS}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByPlaceholderText('You are a helpful coding assistant...')).toBeInTheDocument()
  })
})
