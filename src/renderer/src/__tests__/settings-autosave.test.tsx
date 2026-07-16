import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../components/SettingsPanel'
import { AppSettings } from '@/types'

const BASE_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseUrl: '',
  providers: [],
  defaultModel: '',
  themeId: 'red',
  colorMode: 'dark',
  systemPrompt: '',
  permissionMode: 'ask',
}

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.classList.remove('light')
})

describe('SettingsPanel — autosave', () => {
  it('has no manual save button', () => {
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={vi.fn()} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument()
  })

  it('autosaves after editing the system prompt, without any button press', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={onSave} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )

    fireEvent.change(screen.getByPlaceholderText('You are a helpful coding assistant...'), {
      target: { value: 'Be terse.' },
    })

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ systemPrompt: 'Be terse.' }))
    }, { timeout: 3000 })
  })

  it('shows the saved indicator after autosave completes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={onSave} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )

    fireEvent.change(screen.getByPlaceholderText('You are a helpful coding assistant...'), {
      target: { value: 'x' },
    })

    expect(await screen.findByText('Saving…')).toBeInTheDocument()
    expect(await screen.findByText('Saved', undefined, { timeout: 3000 })).toBeInTheDocument()
  })

  it('debounces rapid edits into a single save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={onSave} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )

    const input = screen.getByPlaceholderText('You are a helpful coding assistant...')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ab' } })
    fireEvent.change(input, { target: { value: 'abc' } })

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ systemPrompt: 'abc' }))
  })

  it('does not save when nothing changed', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={onSave} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )
    await new Promise((r) => setTimeout(r, 900))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('autosaves permission mode changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={onSave} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: /YOLO/ }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ permissionMode: 'yolo' }))
    }, { timeout: 3000 })
  })
})

describe('SettingsPanel — appearance', () => {
  it('shows dark and light colour mode options', () => {
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={vi.fn()} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /Light/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dark/ })).toBeInTheDocument()
  })

  it('applies light mode immediately and autosaves it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SettingsPanel settings={BASE_SETTINGS} onSave={onSave} sessionCount={0} onDeleteAllSessions={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: /Light/ }))
    expect(document.documentElement.classList.contains('light')).toBe(true)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ colorMode: 'light' }))
    }, { timeout: 3000 })
  })

  it('switching back to dark removes the light class', () => {
    render(
      <SettingsPanel
        settings={{ ...BASE_SETTINGS, colorMode: 'light' }}
        onSave={vi.fn()}
        sessionCount={0}
        onDeleteAllSessions={vi.fn()}
      />
    )
    document.documentElement.classList.add('light')
    fireEvent.click(screen.getByRole('button', { name: /Dark/ }))
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})
