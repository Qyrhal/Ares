import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

/** Build a ClipboardEvent-like object with image file items */
function createImageClipboardData(
  mimeType = 'image/png',
  content = new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
) {
  const blob = new Blob([content], { type: mimeType })
  const file = new File([blob], 'pasted.png', { type: mimeType })

  const item = {
    kind: 'file' as const,
    type: mimeType,
    getAsFile: () => file,
    getAsString: () => null,
    webkitGetAsEntry: () => null,
    mozGetAsEntry: () => null,
    exposeConnectable: () => null,
  }

  return {
    items: [item],
    files: [file],
    types: ['Files'],
    getData: () => '',
    setData: () => {},
    clearData: () => {},
    dropEffect: 'none' as const,
    effectAllowed: 'uninitialized' as const,
  }
}

/** Build a ClipboardEvent-like object with text only (no images) */
function createTextClipboardData(text = 'hello world') {
  const item = {
    kind: 'string' as const,
    type: 'text/plain',
    getAsFile: () => null,
    getAsString: (cb: (s: string) => void) => cb(text),
    webkitGetAsEntry: () => null,
    mozGetAsEntry: () => null,
    exposeConnectable: () => null,
  }

  return {
    items: [item],
    files: [],
    types: ['text/plain'],
    getData: () => text,
    setData: () => {},
    clearData: () => {},
    dropEffect: 'none' as const,
    effectAllowed: 'uninitialized' as const,
  }
}

describe('InputBar — clipboard image paste', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })

  afterEach(() => {
    dateNowSpy.mockRestore()
  })

  it('creates attachment when pasting an image', async () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    await act(async () => {
      fireEvent.paste(textarea, { clipboardData: createImageClipboardData() })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('pasted-image-1700000000000.png')).toBeInTheDocument()
  })

  it('does not create attachment when pasting text', async () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    await act(async () => {
      fireEvent.paste(textarea, { clipboardData: createTextClipboardData() })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.queryByText(/pasted-image/)).not.toBeInTheDocument()
  })

  it('extracts correct file type from pasted image', async () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    await act(async () => {
      fireEvent.paste(textarea, {
        clipboardData: createImageClipboardData('image/jpeg', new Uint8Array([0xff, 0xd8])),
      })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('pasted-image-1700000000000.jpeg')).toBeInTheDocument()
  })

  it('generates timestamped filename', async () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    await act(async () => {
      fireEvent.paste(textarea, { clipboardData: createImageClipboardData() })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('pasted-image-1700000000000.png')).toBeInTheDocument()
  })

  it('accumulates attachments across multiple paste events', async () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    await act(async () => {
      fireEvent.paste(textarea, { clipboardData: createImageClipboardData('image/png') })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('pasted-image-1700000000000.png')).toBeInTheDocument()

    await act(async () => {
      fireEvent.paste(textarea, {
        clipboardData: createImageClipboardData('image/jpeg', new Uint8Array([0xff, 0xd8])),
      })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('pasted-image-1700000000000.png')).toBeInTheDocument()
    expect(screen.getByText('pasted-image-1700000000000.jpeg')).toBeInTheDocument()
  })

  it('handles only first image when paste contains multiple images', async () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    const blob1 = new Blob([new Uint8Array([0x89])], { type: 'image/png' })
    const file1 = new File([blob1], 'pasted.png', { type: 'image/png' })
    const blob2 = new Blob([new Uint8Array([0xff])], { type: 'image/gif' })
    const file2 = new File([blob2], 'pasted.gif', { type: 'image/gif' })

    const clipboardData = {
      items: [
        {
          kind: 'file' as const,
          type: 'image/png',
          getAsFile: () => file1,
          getAsString: () => null,
          webkitGetAsEntry: () => null,
          mozGetAsEntry: () => null,
          exposeConnectable: () => null,
        },
        {
          kind: 'file' as const,
          type: 'image/gif',
          getAsFile: () => file2,
          getAsString: () => null,
          webkitGetAsEntry: () => null,
          mozGetAsEntry: () => null,
          exposeConnectable: () => null,
        },
      ],
      files: [file1, file2],
      types: ['Files'],
      getData: () => '',
      setData: () => {},
      clearData: () => {},
      dropEffect: 'none' as const,
      effectAllowed: 'uninitialized' as const,
    }

    await act(async () => {
      fireEvent.paste(textarea, { clipboardData })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('pasted-image-1700000000000.png')).toBeInTheDocument()
    expect(screen.queryByText(/\.gif/)).not.toBeInTheDocument()
  })

  it('pasted image attachment is sent with the message', async () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    await act(async () => {
      fireEvent.paste(textarea, { clipboardData: createImageClipboardData() })
      await new Promise((r) => setTimeout(r, 50))
    })

    fireEvent.change(textarea, { target: { value: 'look at this image' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalled()
    const callArgs = (onSend as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[0]).toBe('look at this image')
    expect(callArgs[1]).toHaveLength(1)
    expect(callArgs[1][0].type).toBe('image/png')
    expect(callArgs[1][0].dataUrl).toMatch(/^data:image\/png;base64,/)
  })
})
