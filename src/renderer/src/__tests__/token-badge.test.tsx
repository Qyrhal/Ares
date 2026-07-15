import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { TokenBadge } from '@/components/TokenBadge'

describe('TokenBadge', () => {
  it('renders token count', () => {
    render(<TokenBadge tokens={150} />)
    expect(screen.getByText('150 tok')).toBeDefined()
  })

  it('renders tokens per second', () => {
    render(<TokenBadge tokens={100} tokensPerSecond={25} />)
    expect(screen.getByText('· 25 tok/s')).toBeDefined()
  })

  it('renders duration', () => {
    render(<TokenBadge tokens={200} duration={3000} />)
    expect(screen.getByText('· 3.0s')).toBeDefined()
  })

  it('renders cost', () => {
    render(<TokenBadge tokens={500} cost={0.0025} />)
    expect(screen.getByText('· $0.0025')).toBeDefined()
  })

  it('renders all stats together', () => {
    render(<TokenBadge tokens={1000} tokensPerSecond={50} duration={5000} cost={0.01} />)
    expect(screen.getByText('1,000 tok')).toBeDefined()
    expect(screen.getByText('· 50 tok/s')).toBeDefined()
    expect(screen.getByText('· 5.0s')).toBeDefined()
    expect(screen.getByText('· $0.0100')).toBeDefined()
  })

  it('renders nothing when tokens is 0', () => {
    const { container } = render(<TokenBadge tokens={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('hides tok/s when tokensPerSecond is 0', () => {
    render(<TokenBadge tokens={100} tokensPerSecond={0} />)
    expect(screen.getByText('100 tok')).toBeDefined()
    expect(screen.queryByText('tok/s')).toBeNull()
  })

  it('hides cost when cost is 0', () => {
    render(<TokenBadge tokens={100} cost={0} />)
    expect(screen.getByText('100 tok')).toBeDefined()
    expect(screen.queryByText('$')).toBeNull()
  })

  it('shows duration even when 0', () => {
    render(<TokenBadge tokens={100} duration={0} />)
    expect(screen.getByText('· 0.0s')).toBeDefined()
  })

  it('formats large token counts with locale separator', () => {
    render(<TokenBadge tokens={1234567} />)
    expect(screen.getByText(/1,234,567 tok/)).toBeDefined()
  })

  it('handles zero tok/s gracefully when duration is set', () => {
    render(<TokenBadge tokens={50} tokensPerSecond={0} duration={2000} />)
    expect(screen.getByText('50 tok')).toBeDefined()
    expect(screen.getByText('· 2.0s')).toBeDefined()
    expect(screen.queryByText('tok/s')).toBeNull()
  })
})
