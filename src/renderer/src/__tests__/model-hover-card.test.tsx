import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ModelHoverCard } from '../components/ModelHoverCard'

// Helper: hover and wait for the 400ms tooltip delay
async function hoverAndWait(el: HTMLElement): Promise<void> {
  fireEvent.mouseOver(el)
  await act(async () => { await new Promise((r) => setTimeout(r, 500)) })
}

describe('ModelHoverCard', () => {
  // ── Basic rendering ────────────────────────────────────────────────────────

  it('renders children', () => {
    render(<ModelHoverCard modelId="gpt-4o"><span>GPT-4o</span></ModelHoverCard>)
    expect(screen.getByText('GPT-4o')).toBeInTheDocument()
  })

  it('wraps children without breaking layout', () => {
    const { container } = render(
      <ModelHoverCard modelId="gpt-4o">
        <span className="test-child">Model name</span>
      </ModelHoverCard>
    )
    expect(container.querySelector('.test-child')).toBeInTheDocument()
  })

  // ── Known model info on hover ──────────────────────────────────────────────

  it('shows provider name for known model', async () => {
    render(<ModelHoverCard modelId="gpt-4o"><span>GPT-4o</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('GPT-4o'))
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
  })

  it('shows context window size', async () => {
    render(<ModelHoverCard modelId="claude-sonnet-4-20250514"><span>Sonnet</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('Sonnet'))
    expect(screen.getByText('200K context')).toBeInTheDocument()
  })

  it('shows model category', async () => {
    render(<ModelHoverCard modelId="gpt-4o-mini"><span>Mini</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('Mini'))
    expect(screen.getByText('Fast')).toBeInTheDocument()
  })

  it('shows capability badges', async () => {
    render(<ModelHoverCard modelId="gpt-4o"><span>GPT-4o</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('GPT-4o'))
    // Check at least one capability badge exists
    const badges = screen.getAllByTestId('model-capability')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  // ── Unknown model ──────────────────────────────────────────────────────────

  it('falls back to model ID for unknown models', async () => {
    render(<ModelHoverCard modelId="custom-model-xyz"><span>Custom</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('Custom'))
    // The model ID appears in the fallback text
    expect(screen.getByText(/Model ID:/)).toBeInTheDocument()
  })

  it('does not crash with empty model ID', () => {
    render(<ModelHoverCard modelId=""><span>Empty</span></ModelHoverCard>)
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })

  // ── Tooltip timing ─────────────────────────────────────────────────────────

  it('does not show tooltip before 400ms delay', async () => {
    render(<ModelHoverCard modelId="gpt-4o"><span>GPT-4o</span></ModelHoverCard>)
    fireEvent.mouseOver(screen.getByText('GPT-4o'))
    // Wait only 200ms — not long enough
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', async () => {
    render(<ModelHoverCard modelId="gpt-4o"><span>GPT-4o</span></ModelHoverCard>)
    const el = screen.getByText('GPT-4o')
    await hoverAndWait(el)
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    fireEvent.mouseOut(el)
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument()
  })

  // ── Model registry ─────────────────────────────────────────────────────────

  it('resolves known model IDs to display name', async () => {
    render(<ModelHoverCard modelId="deepseek-v4-flash"><span>DS</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('DS'))
    expect(screen.getByText('DeepSeek')).toBeInTheDocument()
  })

  it('resolves GPT-4.1 with 1M context', async () => {
    render(<ModelHoverCard modelId="gpt-4.1"><span>G</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('G'))
    expect(screen.getByText('1M context')).toBeInTheDocument()
  })

  it('shows reasoning capability for o3', async () => {
    render(<ModelHoverCard modelId="o3"><span>O3</span></ModelHoverCard>)
    await hoverAndWait(screen.getByText('O3'))
    const badges = screen.getAllByTestId('model-capability')
    const capTexts = badges.map((b) => b.textContent)
    expect(capTexts).toContain('reasoning')
  })
})
