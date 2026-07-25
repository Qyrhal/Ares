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

  it('shows tool args displayed in the UI', () => {
    render(<PermissionPrompt {...defaultProps} />)
    expect(screen.getByText(/path/)).toBeInTheDocument()
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

  it('shows multiple arguments when toolArgs has multiple keys', () => {
    render(
      <PermissionPrompt
        {...defaultProps}
        toolArgs='{"path": "/test.txt", "recursive": true}'
      />
    )
    expect(screen.getByText(/path/)).toBeInTheDocument()
    expect(screen.getByText(/recursive/)).toBeInTheDocument()
  })

  it('handles empty arguments gracefully', () => {
    render(<PermissionPrompt {...defaultProps} toolArgs="{}" />)
    expect(screen.getByText(/Allow readFile/)).toBeInTheDocument()
  })

  it('displays tooltip-like description for known tools', () => {
    render(<PermissionPrompt {...defaultProps} toolName="writeFile" />)
    expect(screen.getByText(/Allow writeFile/)).toBeInTheDocument()
  })

  it('calls onApprove when Enter key is pressed on the prompt', async () => {
    const onApprove = vi.fn()
    render(<PermissionPrompt {...defaultProps} onApprove={onApprove} />)
    const region = screen.getByRole('region')
    region.focus()
    await userEvent.keyboard('{Enter}')
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('calls onDeny when Escape key is pressed on the prompt', async () => {
    const onDeny = vi.fn()
    render(<PermissionPrompt {...defaultProps} onDeny={onDeny} />)
    const region = screen.getByRole('region')
    region.focus()
    await userEvent.keyboard('{Escape}')
    expect(onDeny).toHaveBeenCalledTimes(1)
  })

  it('truncates long raw args at 100 characters', () => {
    const longArg = 'x'.repeat(150)
    render(<PermissionPrompt {...defaultProps} toolArgs={longArg} />)
    const displayed = screen.getByText(longArg.slice(0, 100))
    expect(displayed).toBeInTheDocument()
    expect(screen.queryByText(longArg)).not.toBeInTheDocument()
  })

  it('has correct accessibility labels and roles', () => {
    render(<PermissionPrompt {...defaultProps} />)
    expect(screen.getByRole('region')).toHaveAttribute(
      'aria-label',
      'Permission request for readFile'
    )
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument()
  })
})
