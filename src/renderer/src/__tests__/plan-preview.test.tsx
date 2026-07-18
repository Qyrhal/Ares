import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanPreview } from '../components/PlanPreview'

describe('PlanPreview', () => {
  it('renders the plan content', () => {
    const planContent = '1. Analyze the codebase\n2. Implement the feature\n3. Write tests'
    render(<PlanPreview content={planContent} onApprove={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('Agent Plan')).toBeInTheDocument()
    expect(screen.getByText(/1. Analyze the codebase/)).toBeInTheDocument()
    expect(screen.getByText(/2. Implement the feature/)).toBeInTheDocument()
    expect(screen.getByText(/3. Write tests/)).toBeInTheDocument()
  })

  it('fires the approve callback when "Execute this plan" is clicked', () => {
    const onApprove = vi.fn()
    render(<PlanPreview content="Test plan" onApprove={onApprove} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByText('Execute this plan'))
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('fires the cancel callback when "Cancel" is clicked', () => {
    const onCancel = vi.fn()
    render(<PlanPreview content="Test plan" onApprove={vi.fn()} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('displays multi-line plan content correctly', () => {
    const planContent = '## Plan\n\n- Step 1\n- Step 2\n- Step 3'
    render(<PlanPreview content={planContent} onApprove={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText(/## Plan/)).toBeInTheDocument()
    expect(screen.getByText(/- Step 1/)).toBeInTheDocument()
    expect(screen.getByText(/- Step 2/)).toBeInTheDocument()
    expect(screen.getByText(/- Step 3/)).toBeInTheDocument()
  })

  it('shows the correct heading with icon', () => {
    render(<PlanPreview content="Test" onApprove={vi.fn()} onCancel={vi.fn()} />)

    const heading = screen.getByText('Agent Plan')
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('text-xs', 'font-semibold', 'text-foreground')
  })
})
