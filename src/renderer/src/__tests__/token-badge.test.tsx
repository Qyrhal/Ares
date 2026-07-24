import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { TokenBadge } from '../components/TokenBadge'

describe('TokenBadge', () => {
  it('renders nothing when tokens is 0', () => {
    const { container } = render(<TokenBadge tokens={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows token count', () => {
    render(<TokenBadge tokens={1500} />)
    expect(screen.getByText('1,500 tok')).toBeInTheDocument()
  })

  it('formats large token counts with commas', () => {
    render(<TokenBadge tokens={123456} />)
    expect(screen.getByText('123,456 tok')).toBeInTheDocument()
  })

  it('shows tokens per second when positive', () => {
    render(<TokenBadge tokens={1000} tokensPerSecond={42} />)
    expect(screen.getByText(/42 tok\/s/)).toBeInTheDocument()
  })

  it('hides tokens per second when zero', () => {
    render(<TokenBadge tokens={1000} tokensPerSecond={0} />)
    expect(screen.queryByText(/tok\/s/)).not.toBeInTheDocument()
  })

  it('hides tokens per second when undefined', () => {
    render(<TokenBadge tokens={1000} />)
    expect(screen.queryByText(/tok\/s/)).not.toBeInTheDocument()
  })

  it('shows duration when provided', () => {
    render(<TokenBadge tokens={1000} duration={5500} />)
    expect(screen.getByText('· 5.5s')).toBeInTheDocument()
  })

  it('shows duration of zero seconds', () => {
    render(<TokenBadge tokens={1000} duration={0} />)
    expect(screen.getByText('· 0.0s')).toBeInTheDocument()
  })

  it('shows cost when positive', () => {
    render(<TokenBadge tokens={1000} cost={0.0312} />)
    expect(screen.getByText(/0\.0312/)).toBeInTheDocument()
  })

  it('hides cost when zero', () => {
    render(<TokenBadge tokens={1000} cost={0} />)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('hides cost when undefined', () => {
    render(<TokenBadge tokens={1000} />)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('shows all segments when all props provided', () => {
    render(<TokenBadge tokens={2000} tokensPerSecond={100} duration={20000} cost={0.05} />)
    expect(screen.getByText('2,000 tok')).toBeInTheDocument()
    expect(screen.getByText(/100 tok\/s/)).toBeInTheDocument()
    expect(screen.getByText('· 20.0s')).toBeInTheDocument()
    expect(screen.getByText(/0\.0500/)).toBeInTheDocument()
  })

  it('renders with minimal props (only tokens)', () => {
    render(<TokenBadge tokens={42} />)
    expect(screen.getByText('42 tok')).toBeInTheDocument()
  })

  it('renders with tokens and duration only', () => {
    render(<TokenBadge tokens={500} duration={1234} />)
    expect(screen.getByText('500 tok')).toBeInTheDocument()
    expect(screen.getByText('· 1.2s')).toBeInTheDocument()
    expect(screen.queryByText(/tok\/s/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})
