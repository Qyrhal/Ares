import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Tooltip } from '@/components/ui/tooltip'

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    expect(screen.getByText('Hover me')).toBeDefined()
  })

  it('shows tooltip content on hover', async () => {
    render(
      <Tooltip content="tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    const btn = screen.getByText('Hover me')
    // Initially hidden
    expect(screen.queryByText('tooltip text')).toBeNull()
    // Trigger hover via React fireEvent
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.mouseEnter(btn)
    // Wait for the delay
    await new Promise((r) => setTimeout(r, 350))
    // Tooltip should be visible now
    const tooltip = screen.queryByText('tooltip text')
    expect(tooltip).not.toBeNull()
  })

  it('hides tooltip on mouse leave', async () => {
    render(
      <Tooltip content="tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    const btn = screen.getByText('Hover me')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.mouseEnter(btn)
    await new Promise((r) => setTimeout(r, 350))
    fireEvent.mouseLeave(btn)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('tooltip text')).toBeNull()
  })
})
