import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { LargeFileBanner } from '@/components/LargeFileBanner'

describe('LargeFileBanner', () => {
  it('renders file name and size', () => {
    render(<LargeFileBanner fileName="big.ts" fileSize={1048576} onOpen={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Large file detected')).toBeDefined()
    expect(screen.getByText(/big.ts/)).toBeDefined()
    expect(screen.getByText(/1.0 MB/)).toBeDefined()
  })

  it('shows formatted size for KB', () => {
    render(<LargeFileBanner fileName="medium.js" fileSize={2048} onOpen={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/2.0 KB/)).toBeDefined()
  })

  it('shows formatted size for bytes', () => {
    render(<LargeFileBanner fileName="small.css" fileSize={500} onOpen={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/500 B/)).toBeDefined()
  })

  it('renders Cancel and Open buttons', () => {
    render(<LargeFileBanner fileName="test.ts" fileSize={1000} onOpen={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Cancel')).toBeDefined()
    expect(screen.getByText('Open anyway')).toBeDefined()
  })

  it('calls onOpen when Open button clicked', async () => {
    const onOpen = vi.fn()
    render(<LargeFileBanner fileName="test.ts" fileSize={1000} onOpen={onOpen} onCancel={vi.fn()} />)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText('Open anyway'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel button clicked', async () => {
    const onCancel = vi.fn()
    render(<LargeFileBanner fileName="test.ts" fileSize={1000} onOpen={vi.fn()} onCancel={onCancel} />)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
