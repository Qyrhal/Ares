import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FileEditor } from '@/components/FileEditor'

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, language }: { value: string; onChange: (v: string | undefined) => void; language: string }) => (
    <div data-testid="monaco-editor" data-language={language} data-value={value}>
      <textarea
        data-testid="editor-textarea"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
  Editor: ({ value, onChange, language }: { value: string; onChange: (v: string | undefined) => void; language: string }) => (
    <div data-testid="monaco-editor" data-language={language} data-value={value}>
      <textarea
        data-testid="editor-textarea"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}))

const el = window.electron as any

beforeEach(() => {
  vi.clearAllMocks()
  el.fs.readFile.mockResolvedValue('hello world')
  el.fs.writeFile.mockResolvedValue(undefined)
  el.fs.delete.mockResolvedValue(undefined)
  el.fs.readDir.mockResolvedValue([])
  ;(window as any).confirm = vi.fn(() => true)
})

describe('FileEditor', () => {
  it('renders loading spinner before file is read', async () => {
    // Delay the promise so we see the loading state
    el.fs.readFile.mockImplementation(() => new Promise(() => {}))
    render(<FileEditor path="/test/file.ts" />)
    // The Loader2 icon renders as an SVG inside a flex container
    const container = document.querySelector('.flex.flex-1.items-center.justify-center')
    expect(container).toBeTruthy()
  })

  it('renders file path in header after loading', async () => {
    render(<FileEditor path="/project/src/app.ts" />)
    await waitFor(() => {
      expect(screen.getByText('/project/src/app.ts')).toBeInTheDocument()
    })
  })

  it('renders Monaco editor with file content', async () => {
    render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
  })

  it('shows content from readFile', async () => {
    el.fs.readFile.mockResolvedValue('file content')
    render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-value', 'file content')
    })
  })

  it('detects TypeScript from .tsx extension', async () => {
    render(<FileEditor path="/test/component.tsx" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'typescript')
    })
  })

  it('detects Python from .py extension', async () => {
    render(<FileEditor path="/test/script.py" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'python')
    })
  })

  it('detects JSON from .json extension', async () => {
    render(<FileEditor path="/test/data.json" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'json')
    })
  })

  it('uses plaintext for unknown extensions', async () => {
    render(<FileEditor path="/test/unknown.xyz" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'plaintext')
    })
  })

  it('shows error message when file read fails', async () => {
    el.fs.readFile.mockRejectedValue(new Error('Permission denied'))
    render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(screen.getByText('// Error reading file')).toBeInTheDocument()
    })
  })

  it('copy path button invokes clipboard API', async () => {
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })
    render(<FileEditor path="/project/src/app.ts" />)
    await waitFor(() => {
      expect(screen.getByTitle('Copy path')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTitle('Copy path'))
    expect(writeText).toHaveBeenCalledWith('/project/src/app.ts')
  })

  it('duplicate creates file copy with -copy suffix', async () => {
    el.fs.readFile.mockResolvedValue('file content')
    render(<FileEditor path="/project/src/app.ts" />)
    await waitFor(() => {
      expect(screen.getByTitle('Duplicate')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTitle('Duplicate'))
    expect(el.fs.writeFile).toHaveBeenCalledWith('/project/src/app-copy.ts', 'file content')
  })

  it('duplicate handles extensionless files', async () => {
    el.fs.readFile.mockResolvedValue('content')
    render(<FileEditor path="/project/Makefile" />)
    await waitFor(() => {
      expect(screen.getByTitle('Duplicate')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTitle('Duplicate'))
    expect(el.fs.writeFile).toHaveBeenCalledWith('/project/Makefile-copy', 'content')
  })

  it('delete button prompts and deletes file', async () => {
    render(<FileEditor path="/project/src/app.ts" />)
    await waitFor(() => {
      expect(screen.getByTitle('Delete file')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTitle('Delete file'))
    expect(window.confirm).toHaveBeenCalled()
    expect(el.fs.delete).toHaveBeenCalledWith('/project/src/app.ts')
  })

  it('delete does not delete when cancelled', async () => {
    ;(window.confirm as any).mockReturnValue(false)
    render(<FileEditor path="/project/src/app.ts" />)
    await waitFor(() => {
      expect(screen.getByTitle('Delete file')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTitle('Delete file'))
    expect(el.fs.delete).not.toHaveBeenCalled()
  })

  it('calls onClose after delete', async () => {
    const onClose = vi.fn()
    render(<FileEditor path="/test/file.ts" onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByTitle('Delete file')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTitle('Delete file'))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('/test/file.ts')
    })
  })

  it('shows unsaved badge after edit', async () => {
    render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
    const textarea = screen.getByTestId('editor-textarea')
    fireEvent.change(textarea, { target: { value: 'modified content' } })
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })

  it('calls onDirtyChange when content changes', async () => {
    const onDirty = vi.fn()
    render(<FileEditor path="/test/file.ts" onDirtyChange={onDirty} />)
    await waitFor(() => {
      expect(screen.getByTestId('editor-textarea')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('editor-textarea'), { target: { value: 'modified' } })
    expect(onDirty).toHaveBeenCalledWith(true)
  })

  it('saves on Cmd+S', async () => {
    render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('editor-textarea'), { target: { value: 'updated' } })
    fireEvent.keyDown(window, { metaKey: true, key: 's' })
    expect(el.fs.writeFile).toHaveBeenCalledWith('/test/file.ts', 'updated')
  })

  it('saves on Ctrl+S (cross-platform)', async () => {
    render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('editor-textarea'), { target: { value: 'updated' } })
    fireEvent.keyDown(window, { ctrlKey: true, key: 's' })
    expect(el.fs.writeFile).toHaveBeenCalledWith('/test/file.ts', 'updated')
  })

  it('does not save on plain S key', async () => {
    render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('editor-textarea'), { target: { value: 'updated' } })
    fireEvent.keyDown(window, { key: 's' })
    expect(el.fs.writeFile).not.toHaveBeenCalled()
  })

  it('reloads content when path changes', async () => {
    const { rerender } = render(<FileEditor path="/test/file.ts" />)
    await waitFor(() => {
      expect(el.fs.readFile).toHaveBeenCalledWith('/test/file.ts')
    })
    const callCount = el.fs.readFile.mock.calls.length
    rerender(<FileEditor path="/test/other.ts" />)
    await waitFor(() => {
      expect(el.fs.readFile.mock.calls.length).toBeGreaterThan(callCount)
    })
    expect(el.fs.readFile).toHaveBeenCalledWith('/test/other.ts')
  })
})
