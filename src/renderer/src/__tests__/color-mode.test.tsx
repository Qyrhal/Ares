import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { applyColorMode } from '@/lib/theme'
import { parseSettings } from '@/schemas'
import { InputBar } from '../components/InputBar'

beforeEach(() => {
  document.documentElement.classList.remove('light')
})

describe('applyColorMode', () => {
  it('adds the light class for light mode', () => {
    applyColorMode('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('removes the light class for dark mode', () => {
    document.documentElement.classList.add('light')
    applyColorMode('dark')
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})

describe('settings schema colorMode', () => {
  it('defaults colorMode to dark for old stored settings', () => {
    const s = parseSettings({ apiKey: '', apiBaseUrl: '', defaultModel: '', themeId: 'red', systemPrompt: '', permissionMode: 'ask' })
    expect(s.colorMode).toBe('dark')
  })

  it('preserves a stored light colorMode', () => {
    const s = parseSettings({ colorMode: 'light' })
    expect(s.colorMode).toBe('light')
  })

  it('rejects invalid colorMode values', () => {
    expect(() => parseSettings({ colorMode: 'sepia' })).toThrow()
  })
})

describe('InputBar colour mode toggle', () => {
  it('shows a light-mode toggle when in dark mode', () => {
    render(<InputBar onSend={vi.fn()} colorMode="dark" onToggleColorMode={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })

  it('shows a dark-mode toggle when in light mode', () => {
    render(<InputBar onSend={vi.fn()} colorMode="light" onToggleColorMode={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
  })

  it('calls onToggleColorMode when clicked', () => {
    const toggle = vi.fn()
    render(<InputBar onSend={vi.fn()} colorMode="dark" onToggleColorMode={toggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('renders no toggle when onToggleColorMode is not provided', () => {
    render(<InputBar onSend={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument()
  })
})
