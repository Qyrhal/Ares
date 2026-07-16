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
  })

  it('cycles back to Skills when clicking Plugins then Skills again', async () => {
    await act(async () => { render(<ExtensionsPanel />) })

    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Plugins & MCPs' })) })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plugins & MCPs' })).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Skills' })) })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the active tab when re-rendered', async () => {
    const { rerender } = await act(async () => render(<ExtensionsPanel />)) as any

    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Hooks' })) })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hooks' })).toBeInTheDocument())

    // Re-render with same component
    await act(async () => { rerender(<ExtensionsPanel />) })
    expect(screen.getByRole('heading', { name: 'Hooks' })).toBeInTheDocument()
  })

  it('renders all three navigation tabs', () => {
    render(<ExtensionsPanel />)
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Plugins & MCPs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Hooks' })).toBeInTheDocument()
  })
})
