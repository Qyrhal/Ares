import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { useAppStore } from '@/store/useAppStore'
import { PreviewPanel } from '@/components/PreviewPanel'

beforeEach(() => {
  useAppStore.setState({
    previewOpen: false,
    previewUrl: null,
  })
})

describe('PreviewPanel — closed state', () => {
  it('returns null when previewOpen is false', () => {
    const { container } = render(<PreviewPanel />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when previewOpen is true but previewUrl is null', () => {
    useAppStore.setState({ previewOpen: true, previewUrl: null })
    const { container } = render(<PreviewPanel />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when previewUrl is set but previewOpen is false', () => {
    useAppStore.setState({ previewOpen: false, previewUrl: 'https://example.com' })
    const { container } = render(<PreviewPanel />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PreviewPanel — open state', () => {
  beforeEach(() => {
    useAppStore.setState({ previewOpen: true, previewUrl: 'https://example.com' })
  })

  it('renders the navigation bar when open', () => {
    render(<PreviewPanel />)
    expect(screen.getByTitle('Back')).toBeInTheDocument()
    expect(screen.getByTitle('Forward')).toBeInTheDocument()
    expect(screen.getByTitle('Refresh')).toBeInTheDocument()
    expect(screen.getByTitle('Close preview')).toBeInTheDocument()
    expect(screen.getByTitle('Open in external browser')).toBeInTheDocument()
  })

  it('renders the URL input with the current URL', () => {
    render(<PreviewPanel />)
    const urlInput = screen.getByPlaceholderText('Enter URL...') as HTMLInputElement
    expect(urlInput.value).toBe('https://example.com')
  })

  it('renders a webview element with src', () => {
    render(<PreviewPanel />)
    const webview = document.querySelector('webview')
    expect(webview).toBeInTheDocument()
    expect(webview?.getAttribute('src')).toBe('https://example.com')
  })

  it('close button calls togglePreview', () => {
    render(<PreviewPanel />)
    fireEvent.click(screen.getByTitle('Close preview'))
    expect(useAppStore.getState().previewOpen).toBe(false)
  })

  it('URL input is editable', () => {
    render(<PreviewPanel />)
    const urlInput = screen.getByPlaceholderText('Enter URL...') as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: 'https://new-url.com' } })
    expect(urlInput.value).toBe('https://new-url.com')
  })
})

describe('PreviewPanel — URL updates from store', () => {
  it('updates URL input when previewUrl changes in store', () => {
    useAppStore.setState({ previewOpen: true, previewUrl: 'https://first.com' })
    const { rerender } = render(<PreviewPanel />)
    expect((screen.getByPlaceholderText('Enter URL...') as HTMLInputElement).value).toBe('https://first.com')

    useAppStore.setState({ previewUrl: 'https://second.com' })
    rerender(<PreviewPanel />)
    expect((screen.getByPlaceholderText('Enter URL...') as HTMLInputElement).value).toBe('https://second.com')
  })
})

describe('PreviewPanel — loading bar', () => {
  it('does not show loading bar initially', () => {
    useAppStore.setState({ previewOpen: true, previewUrl: 'https://example.com' })
    render(<PreviewPanel />)
    // Loading bar has animate-pulse class
    expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })
})

describe('PreviewPanel — back/forward buttons', () => {
  it('back button is disabled initially (canGoBack is false)', () => {
    useAppStore.setState({ previewOpen: true, previewUrl: 'https://example.com' })
    render(<PreviewPanel />)
    const backBtn = screen.getByTitle('Back')
    expect(backBtn).toBeDisabled()
  })

  it('forward button is disabled initially (canGoForward is false)', () => {
    useAppStore.setState({ previewOpen: true, previewUrl: 'https://example.com' })
    render(<PreviewPanel />)
    const fwdBtn = screen.getByTitle('Forward')
    expect(fwdBtn).toBeDisabled()
  })
})

describe('PreviewPanel — open/close lifecycle', () => {
  it('opening and closing renders then hides the panel', () => {
    const { container } = render(<PreviewPanel />)
    // Initially closed
    expect(container.innerHTML).toBe('')

    // Open
    useAppStore.setState({ previewOpen: true, previewUrl: 'https://example.com' })
    const { container: container2 } = render(<PreviewPanel />)
    expect(container2.querySelector('[title="Close preview"]')).toBeInTheDocument()

    // Close via store
    useAppStore.setState({ previewOpen: false })
    const { container: container3 } = render(<PreviewPanel />)
    expect(container3.innerHTML).toBe('')
  })
})
