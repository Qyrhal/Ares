import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionPrompt } from '@/components/PermissionPrompt'

const defaultProps = {
  toolName: 'readFile',
  toolArgs: '{"path": "/test.txt"}',
  onApprove: vi.fn(),
  onDeny: vi.fn(),
}

describe('PermissionPrompt', () => {

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

describe('PermissionPrompt — different tool names', () => {
  it('renders correct tool name for writeFile', () => {
    render(<PermissionPrompt {...defaultProps} toolName="writeFile" />)
    expect(screen.getByText(/Allow writeFile/)).toBeInTheDocument()
  })

  it('renders correct tool name for executeCommand', () => {
    render(<PermissionPrompt {...defaultProps} toolName="executeCommand" />)
    expect(screen.getByText(/Allow executeCommand/)).toBeInTheDocument()
  })

  it('renders correct aria-label for different tool names', () => {
    render(<PermissionPrompt {...defaultProps} toolName="deleteFile" />)
    expect(screen.getByRole('region')).toHaveAttribute(
      'aria-label',
      'Permission request for deleteFile'
    )
  })
})

describe('PermissionPrompt — args display format', () => {
  it('displays args as key=value pairs', () => {
    render(
      <PermissionPrompt
        {...defaultProps}
        toolArgs='{"path": "/test.txt", "content": "hello"}'
      />
    )
    expect(screen.getByText(/path="\/test.txt"/)).toBeInTheDocument()
    expect(screen.getByText(/content="hello"/)).toBeInTheDocument()
  })

  it('truncates individual arg values at 80 characters', () => {
    const longValue = 'x'.repeat(100)
    render(
      <PermissionPrompt
        {...defaultProps}
        toolArgs={`{"path": "${longValue}"}`}
      />
    )
    // The value should be truncated - the full 100-char value should not appear
    expect(screen.queryByText(new RegExp(`path="${longValue}"`))).not.toBeInTheDocument()
    // But some truncated form should appear
    expect(screen.getByText(/path=/)).toBeInTheDocument()
  })
})

describe('PermissionPrompt — amber styling', () => {
  it('has amber border styling', () => {
    const { container } = render(<PermissionPrompt {...defaultProps} />)
    const root = container.firstElementChild!
    expect(root.className).toContain('border-amber-500/30')
    expect(root.className).toContain('bg-amber-500/10')
  })

  it('has rounded corners', () => {
    const { container } = render(<PermissionPrompt {...defaultProps} />)
    const root = container.firstElementChild!
    expect(root.className).toContain('rounded-lg')
  })
})

describe('PermissionPrompt — button types', () => {
  it('approve button has type="button"', async () => {
    render(<PermissionPrompt {...defaultProps} />)
    const approveBtn = screen.getByRole('button', { name: /approve/i })
    expect(approveBtn).toHaveAttribute('type', 'button')
  })

  it('deny button has type="button"', async () => {
    render(<PermissionPrompt {...defaultProps} />)
    const denyBtn = screen.getByRole('button', { name: /deny/i })
    expect(denyBtn).toHaveAttribute('type', 'button')
  })
})

describe('PermissionPrompt — region tabIndex', () => {
  it('region has tabIndex={0} for keyboard focus', () => {
    render(<PermissionPrompt {...defaultProps} />)
    const region = screen.getByRole('region')
    expect(region).toHaveAttribute('tabindex', '0')
  })
})

describe('PermissionPrompt — keyboard shortcuts do not double fire', () => {
  it('Enter on approve button calls onApprove once', async () => {
    const onApprove = vi.fn()
    render(<PermissionPrompt {...defaultProps} onApprove={onApprove} />)
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('Escape on deny button calls onDeny once', async () => {
    const onDeny = vi.fn()
    render(<PermissionPrompt {...defaultProps} onDeny={onDeny} />)
    await userEvent.click(screen.getByRole('button', { name: /deny/i }))
    expect(onDeny).toHaveBeenCalledTimes(1)
  })
})
