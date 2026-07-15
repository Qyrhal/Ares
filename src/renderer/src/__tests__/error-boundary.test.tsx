import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../components/ErrorBoundary'

function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('💥 KABOOM')
  return <div>All good</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello world</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders default error UI when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Component error')).toBeInTheDocument()
    expect(screen.getByText('💥 KABOOM')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(screen.queryByText('Component error')).not.toBeInTheDocument()
  })

  it('retry button resets error state', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Render with a throwing child to trigger error boundary
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Component error')).toBeInTheDocument()

    // Click Retry — this calls setState({ error: null }) which re-renders children
    // Since Bomb still has shouldThrow=true, it throws again, triggering the boundary again
    fireEvent.click(screen.getByText('Retry'))

    // The error boundary should catch the re-thrown error
    expect(screen.getByText('Component error')).toBeInTheDocument()
  })

  it('recovers after retry when error is fixed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Component error')).toBeInTheDocument()

    // Re-render with safe children (simulating parent fixing the issue),
    // then click Retry to clear the error and show the fixed content
    rerender(
      <ErrorBoundary>
        <div>Recovered</div>
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByText('Retry'))

    expect(screen.getByText('Recovered')).toBeInTheDocument()
    expect(screen.queryByText('Component error')).not.toBeInTheDocument()
  })

  it('does not show error UI when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
    expect(screen.queryByText('Component error')).not.toBeInTheDocument()
  })
})
