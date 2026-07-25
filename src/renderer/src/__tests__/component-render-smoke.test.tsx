import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenuOverlay } from '../components/ContextMenuOverlay'
import { LargeFileBanner } from '../components/LargeFileBanner'
import { ModelHoverCard } from '../components/ModelHoverCard'
import { PlanPreview } from '../components/PlanPreview'
import { SideChatInput } from '../components/SideChatInput'

// ─────────────────────────────────────────────────────────────────────────────
// EmptyMain — defined inside App.tsx (not exported), so we render it through
// the App component and assert its "Nothing open yet." text appears.
// ─────────────────────────────────────────────────────────────────────────────
describe('EmptyMain — renders without crashing', () => {
  it('shows "Nothing open yet" when no sessions exist', async () => {
    const { default: App } = await import('../App')
    const { act } = await import('@testing-library/react')
    let result: ReturnType<typeof render>
    await act(async () => { result = render(<App />) })
    const { getByText } = result!
    expect(getByText('Nothing open yet.')).toBeInTheDocument()
    expect(getByText('New session')).toBeInTheDocument()
    expect(getByText('Open folder')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ContextMenuOverlay
// ─────────────────────────────────────────────────────────────────────────────
describe('ContextMenuOverlay — smoke render', () => {
  const items = [
    { id: 'cut', label: 'Cut', action: vi.fn() },
    { id: 'copy', label: 'Copy', action: vi.fn(), shortcut: 'Ctrl+C' },
  ]

  it('renders menu items when open', () => {
    render(
      <ContextMenuOverlay x={50} y={100} items={items} open={true} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Cut')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('returns null when closed', () => {
    const { container } = render(
      <ContextMenuOverlay x={0} y={0} items={items} open={false} onClose={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LargeFileBanner
// ─────────────────────────────────────────────────────────────────────────────
describe('LargeFileBanner — smoke render', () => {
  it('renders with filename prop and shows buttons', () => {
    render(
      <LargeFileBanner
        fileName="large-dataset.json"
        fileSize={5_242_880}
        onOpen={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Large file detected')).toBeInTheDocument()
    expect(screen.getByText(/large-dataset\.json/)).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Open anyway')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ModelHoverCard
// ─────────────────────────────────────────────────────────────────────────────
describe('ModelHoverCard — smoke render', () => {
  it('renders children', () => {
    render(
      <ModelHoverCard modelId="gpt-4o">
        <span>GPT-4o</span>
      </ModelHoverCard>,
    )
    expect(screen.getByText('GPT-4o')).toBeInTheDocument()
  })

  it('shows model name and provider on hover', async () => {
    const { act } = await import('@testing-library/react')
    render(
      <ModelHoverCard modelId="claude-sonnet-4-20250514">
        <span>Sonnet</span>
      </ModelHoverCard>,
    )
    fireEvent.mouseOver(screen.getByText('Sonnet'))
    await act(async () => { await new Promise((r) => setTimeout(r, 500)) })
    expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PlanPreview
// ─────────────────────────────────────────────────────────────────────────────
describe('PlanPreview — smoke render', () => {
  it('renders plan content and action buttons', () => {
    render(
      <PlanPreview
        content="Step 1: Analyze code\nStep 2: Refactor module"
        onApprove={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Agent Plan')).toBeInTheDocument()
    expect(screen.getByText(/Step 1/)).toBeInTheDocument()
    expect(screen.getByText(/Step 2/)).toBeInTheDocument()
    expect(screen.getByText('Execute this plan')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SideChatInput
// ─────────────────────────────────────────────────────────────────────────────
describe('SideChatInput — smoke render', () => {
  it('renders textarea with placeholder', () => {
    render(<SideChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole('textbox', { name: /side chat message/i })
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('placeholder', 'Ask side chat…')
  })

  it('renders with custom placeholder', () => {
    render(<SideChatInput onSend={vi.fn()} placeholder="Type here…" />)
    const textarea = screen.getByRole('textbox', { name: /side chat message/i })
    expect(textarea).toHaveAttribute('placeholder', 'Type here…')
  })
})
