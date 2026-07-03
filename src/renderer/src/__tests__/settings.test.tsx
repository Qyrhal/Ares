import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SettingsPanel } from '../components/SettingsPanel'
import { AppSettings } from '@/types'

const BASE_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseUrl: '',
  defaultModel: '',
  themeId: 'red',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SettingsPanel', () => {
  it('auto-fetches models when base URL is set on mount', async () => {
    const mockModels = { data: [{ id: 'gpt-4' }, { id: 'gpt-4o' }] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModels),
    } as Response)

    render(
      <SettingsPanel
        settings={{ ...BASE_SETTINGS, apiBaseUrl: 'http://localhost:11434/v1' }}
        onSave={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/models',
        expect.any(Object)
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Connected · 2 models available')).toBeInTheDocument()
    })
  })

  it('shows error when endpoint is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'))

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
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

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

  it('does not fetch when base URL is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(
      <SettingsPanel
        settings={BASE_SETTINGS}
        onSave={vi.fn()}
      />
    )

    // Wait a bit for any potential effect to fire
    await new Promise((r) => setTimeout(r, 100))

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
