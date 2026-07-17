import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../components/SettingsPanel'
import { AppSettings } from '@/types'

const BASE_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseUrl: '',
  providers: [],
  defaultModel: '',
  themeId: 'red',
  systemPrompt: '',
  permissionMode: 'ask',
  maxSubagentSpawns: 200,
  maxWebSearches: 200,
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
        sessionCount={0}
        onDeleteAllSessions={vi.fn()}
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
        sessionCount={0}
        onDeleteAllSessions={vi.fn()}
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
        sessionCount={0}
        onDeleteAllSessions={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Test your endpoint/)).toBeInTheDocument()
    })
  })

  it('shows the injected agent protocol', () => {
    render(
      <SettingsPanel
        settings={BASE_SETTINGS}
        onSave={vi.fn()}
        sessionCount={0}
        onDeleteAllSessions={vi.fn()}
      />
    )

    expect(screen.getByText(/Ares Agent Protocol/)).toBeInTheDocument()
    expect(screen.getByText(/setTodos/)).toBeInTheDocument()
    expect(screen.getByText(/spawnAgents/)).toBeInTheDocument()
    expect(screen.getByText(/notifyComplete/)).toBeInTheDocument()
    expect(screen.getByText(/webSearch/)).toBeInTheDocument()
  })

  it('shows system prompt textarea', () => {
    render(
      <SettingsPanel
        settings={BASE_SETTINGS}
        onSave={vi.fn()}
        sessionCount={0}
        onDeleteAllSessions={vi.fn()}
      />
    )

    expect(screen.getByPlaceholderText('You are a helpful coding assistant...')).toBeInTheDocument()
  })
})

describe('SettingsPanel — delete all sessions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the session count in the delete-all description', () => {
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={vi.fn()} sessionCount={3} onDeleteAllSessions={vi.fn()} />
    )
    expect(screen.getByText(/Permanently deletes all 3 sessions/)).toBeInTheDocument()
  })

  it('disables the delete-all button when there are no sessions', () => {
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={vi.fn()} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /Delete all/ })).toBeDisabled()
  })

  it('does not call onDeleteAllSessions when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDeleteAllSessions = vi.fn()
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={vi.fn()} sessionCount={2} onDeleteAllSessions={onDeleteAllSessions} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Delete all/ }))
    expect(window.confirm).toHaveBeenCalledWith('Delete all 2 sessions? This cannot be undone.')
    expect(onDeleteAllSessions).not.toHaveBeenCalled()
  })

  it('calls onDeleteAllSessions when the confirmation is accepted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDeleteAllSessions = vi.fn().mockResolvedValue(undefined)
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={vi.fn()} sessionCount={5} onDeleteAllSessions={onDeleteAllSessions} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Delete all/ }))
    await waitFor(() => expect(onDeleteAllSessions).toHaveBeenCalledTimes(1))
  })
})
