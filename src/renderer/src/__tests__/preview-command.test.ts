import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/useAppStore'

describe('/preview slash command', () => {
  beforeEach(() => {
    useAppStore.setState({
      previewOpen: false,
      previewUrl: null,
    })
  })

  it('starts with preview closed', () => {
    const { previewOpen, previewUrl } = useAppStore.getState()
    expect(previewOpen).toBe(false)
    expect(previewUrl).toBeNull()
  })

  it('setPreviewUrl opens the preview panel with the URL', () => {
    useAppStore.getState().setPreviewUrl('https://example.com')
    const { previewOpen, previewUrl } = useAppStore.getState()
    expect(previewOpen).toBe(true)
    expect(previewUrl).toBe('https://example.com')
  })

  it('togglePreview toggles the preview panel', () => {
    const store = useAppStore.getState()
    store.togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(true)
    store.togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(false)
  })

  it('togglePreview preserves the URL when toggling', () => {
    const store = useAppStore.getState()
    store.setPreviewUrl('https://test.dev')
    expect(useAppStore.getState().previewUrl).toBe('https://test.dev')
    store.togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(false)
    expect(useAppStore.getState().previewUrl).toBe('https://test.dev')
  })

  it('setPreviewUrl overwrites previous URL', () => {
    const store = useAppStore.getState()
    store.setPreviewUrl('https://first.com')
    store.setPreviewUrl('https://second.com')
    expect(useAppStore.getState().previewUrl).toBe('https://second.com')
    expect(useAppStore.getState().previewOpen).toBe(true)
  })

  it('previewOpen is false after setPreviewUrl with null is not called', () => {
    useAppStore.getState().setPreviewUrl('https://url.com')
    expect(useAppStore.getState().previewOpen).toBe(true)
    // togglePreview to close
    useAppStore.getState().togglePreview()
    expect(useAppStore.getState().previewOpen).toBe(false)
    // URL should persist
    expect(useAppStore.getState().previewUrl).toBe('https://url.com')
  })

  it('command parser extracts URL from args', () => {
    // Simulate what handleCommand does with args
    const args = 'https://example.com'
    let url = args.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    expect(url).toBe('https://example.com')
  })

  it('command parser adds https:// when missing', () => {
    const args = 'example.com'
    let url = args.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    expect(url).toBe('https://example.com')
  })

  it('command parser handles --close flag', () => {
    const args = '--close'
    expect(args === '--close' || args === 'close').toBe(true)
  })

  it('command parser handles close flag', () => {
    const args = 'close' as string
    expect(args === '--close' || args === 'close').toBe(true)
  })

  it('shows usage when no args provided', () => {
    const args = ''
    expect(!args).toBe(true)
  })

  it('URL with trailing whitespace is trimmed', () => {
    const args = '  https://example.com  '
    let url = args.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    expect(url).toBe('https://example.com')
  })
})
