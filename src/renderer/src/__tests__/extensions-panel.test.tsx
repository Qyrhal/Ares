import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ExtensionsPanel } from '../components/ExtensionsPanel'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExtensionsPanel', () => {
  it('shows Skills content by default', async () => {
    await act(async () => { render(<ExtensionsPanel />) })
    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to Plugins & MCPs content when that sub-tab is clicked', async () => {
    await act(async () => { render(<ExtensionsPanel />) })
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Plugins & MCPs' })) })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plugins & MCPs' })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Skills' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Plugins & MCPs' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'false')
  })

  it('switches to Hooks content when that sub-tab is clicked', async () => {
    await act(async () => { render(<ExtensionsPanel />) })
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Hooks' })) })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hooks' })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Skills' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Hooks' })).toHaveAttribute('aria-selected', 'true')
  })
})
