import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionPrompt } from '@/components/PermissionPrompt'

describe('PermissionPrompt', () => {
  const defaultProps = {
    toolName: 'readFile',
    toolArgs: '{"path": "/test.txt"}',
    onApprove: vi.fn(),
    onDeny: vi.fn(),
  }

  it('shows tool name', () => {
    render(<PermissionPrompt {...defaultProps} />)
    expect(screen.getByText(/Allow readFile/)).toBeInTheDocument()
  })

  it('shows tool args', () => {
    render(<PermissionPrompt {...defaultProps} />)
    expect(screen.getByText(/path=.*test\.txt/)).toBeInTheDocument()
  })

  it('shows raw args when parsing fails', () => {
    render(<PermissionPrompt {...defaultProps} toolArgs="raw unparseable text" />)
    expect(screen.getByText(/raw unparseable text/)).toBeInTheDocument()
  })

  it('calls onApprove when approve clicked', async () => {
    const onApprove = vi.fn()
    render(<PermissionPrompt {...defaultProps} onApprove={onApprove} />)
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('calls onDeny when deny clicked', async () => {
    const onDeny = vi.fn()
    render(<PermissionPrompt {...defaultProps} onDeny={onDeny} />)
    await userEvent.click(screen.getByRole('button', { name: /deny/i }))
    expect(onDeny).toHaveBeenCalledTimes(1)
  })
})
