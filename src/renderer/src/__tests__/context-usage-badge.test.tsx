import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContextUsageBadge } from '../components/ContextUsageBadge'
import type { Message } from '@/types'

vi.mock('@/lib/context', () => ({
  estimateTokens: vi.fn(),
  contextWindow: vi.fn(),
}))

import { estimateTokens, contextWindow } from '@/lib/context'

const mockEstimateTokens = vi.mocked(estimateTokens)
const mockContextWindow = vi.mocked(contextWindow)

function makeMsg(): Message {
  return { id: 'm1', sessionId: 's1', role: 'user', content: 'x', createdAt: Date.now() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockContextWindow.mockReturnValue(128000)
})

describe('ContextUsageBadge', () => {
  it('renders "Ctx" text', () => {
    mockEstimateTokens.mockReturnValue(0)
    render(<ContextUsageBadge messages={[]} model="gpt-4o" />)
    expect(screen.getByText(/Ctx/)).toBeInTheDocument()
  })

  it('shows 0% for empty messages', () => {
    mockEstimateTokens.mockReturnValue(0)
    render(<ContextUsageBadge messages={[]} model="gpt-4o" />)
    expect(screen.getByText('Ctx 0%')).toBeInTheDocument()
  })

  it('shows correct percentage for low utilization', () => {
    mockEstimateTokens.mockReturnValue(12800)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    expect(screen.getByText('Ctx 10%')).toBeInTheDocument()
  })

  it('shows correct percentage for 50-75% utilization', () => {
    mockEstimateTokens.mockReturnValue(83200)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    expect(screen.getByText('Ctx 65%')).toBeInTheDocument()
  })

  it('shows correct percentage for 75-90% utilization', () => {
    mockEstimateTokens.mockReturnValue(108800)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    expect(screen.getByText('Ctx 85%')).toBeInTheDocument()
  })

  it('shows correct percentage for > 90% utilization', () => {
    mockEstimateTokens.mockReturnValue(120000)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    expect(screen.getByText('Ctx 94%')).toBeInTheDocument()
  })

  it('clamps at 100% for over-utilization', () => {
    mockEstimateTokens.mockReturnValue(200000)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    expect(screen.getByText('Ctx 100%')).toBeInTheDocument()
  })

  it('renders progress bar with correct width', () => {
    mockEstimateTokens.mockReturnValue(64000)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    const bar = document.querySelector('[style*="width"]') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.style.width).toBe('50%')
  })

  it('applies green bar color for < 50%', () => {
    mockEstimateTokens.mockReturnValue(10000)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    const bar = document.querySelector('[style*="width"]') as HTMLElement
    expect(bar.className).toContain('bg-green-500')
  })

  it('applies yellow bar color for 50-75%', () => {
    mockEstimateTokens.mockReturnValue(83200)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    const bar = document.querySelector('[style*="width"]') as HTMLElement
    expect(bar.className).toContain('bg-yellow-500')
  })

  it('applies orange bar color for 75-90%', () => {
    mockEstimateTokens.mockReturnValue(108800)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    const bar = document.querySelector('[style*="width"]') as HTMLElement
    expect(bar.className).toContain('bg-orange-500')
  })

  it('applies red bar color for > 90%', () => {
    mockEstimateTokens.mockReturnValue(120000)
    render(<ContextUsageBadge messages={[makeMsg()]} model="gpt-4o" />)
    const bar = document.querySelector('[style*="width"]') as HTMLElement
    expect(bar.className).toContain('bg-red-500')
  })
})
