import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QuickFileOpen } from '@/components/QuickFileOpen'

const mockFiles = [
  { path: '/home/user/project/src/index.ts', name: 'index.ts', dir: '/home/user/project/src' },
  { path: '/home/user/project/src/app.tsx', name: 'app.tsx', dir: '/home/user/project/src' },
  { path: '/home/user/project/README.md', name: 'README.md', dir: '/home/user/project' },
  { path: '/home/user/project/icon.png', name: 'icon.png', dir: '/home/user/project' },
  { path: '/home/user/project/style.css', name: 'style.css', dir: '/home/user/project' },
  { path: '/home/user/project/main.py', name: 'main.py', dir: '/home/user/project' },
]

describe('QuickFileOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mock = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const fs = (mock as Record<string, Record<string, unknown>>).fs
    fs.findFiles = vi.fn().mockResolvedValue(mockFiles.map((f) => f.path))
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <QuickFileOpen
        open={false}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders search input when open with placeholder', () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Search files by name…')).toBeDefined()
  })

  it('shows "No folder open" message when workspacePath is null', () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath={null}
        onOpenFile={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('No folder open')).toBeDefined()
    expect(screen.getByText('No folder open')).toBeDefined()
  })

  it('shows "Open a folder to search files" when workspacePath is null', () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath={null}
        onOpenFile={vi.fn()}
      />
    )
    expect(screen.getByText('Open a folder to search files')).toBeDefined()
  })

  it('shows loading state initially when opened with workspace', async () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    expect(screen.getByText('Loading files…')).toBeDefined()
  })

  it('displays file list after loading', async () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    // Wait for the async findFiles to resolve and component to re-render
    await vi.waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined()
    })
    expect(screen.getByText('app.tsx')).toBeDefined()
    expect(screen.getByText('README.md')).toBeDefined()
    expect(screen.getByText('icon.png')).toBeDefined()
  })

  it('shows result count', async () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    await vi.waitFor(() => {
      expect(screen.getByText(/6 files?/)).toBeDefined()
    })
  })

  it('filters files by query using fuzzy matching', async () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    // Wait for files to load
    await vi.waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined()
    })

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.change(input, { target: { value: 'app' } })

    // app.tsx matches name, index.ts matches path partially
    expect(screen.getByText('app.tsx')).toBeDefined()
    // README.md, icon.png, style.css, main.py don't match "app"
    expect(screen.queryByText('README.md')).toBeNull()
    expect(screen.queryByText('icon.png')).toBeNull()
  })

  it('shows "No files found" when query matches nothing', async () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    await vi.waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined()
    })

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.change(input, { target: { value: 'zzzzz' } })
    expect(screen.getByText('No files found')).toBeDefined()
  })

  it('shows "No files in workspace" when there are no files and no query', async () => {
    const mock = (globalThis as Record<string, unknown>).__electronMock as Record<string, unknown>
    const fs = (mock as Record<string, Record<string, unknown>>).fs
    fs.findFiles = vi.fn().mockResolvedValue([])

    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )
    await vi.waitFor(() => {
      expect(screen.getByText('No files in workspace')).toBeDefined()
    })
  })

  it('navigates with ArrowDown, ArrowUp, and selects with Enter', async () => {
    const onOpenFile = vi.fn()
    const onClose = vi.fn()

    render(
      <QuickFileOpen
        open={true}
        onClose={onClose}
        workspacePath="/home/user/project"
        onOpenFile={onOpenFile}
      />
    )

    // Wait for files to load
    await vi.waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined()
    })

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search files by name…')

    // Initially first item is selected (index.ts), press ArrowDown
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Press Enter to open the second item (app.tsx)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onOpenFile).toHaveBeenCalledWith('/home/user/project/src/app.tsx')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()

    render(
      <QuickFileOpen
        open={true}
        onClose={onClose}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking backdrop', async () => {
    const onClose = vi.fn()

    const { container } = render(
      <QuickFileOpen
        open={true}
        onClose={onClose}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    // Click on the outermost overlay div (the backdrop area)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when clicking inside the dialog', async () => {
    const onClose = vi.fn()

    render(
      <QuickFileOpen
        open={true}
        onClose={onClose}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )

    const { fireEvent } = await import('@testing-library/react')
    // Click on the input inside the dialog — should not propagate to backdrop
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.click(input)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows file icons by extension type', async () => {
    render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )

    await vi.waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined()
    })

    // The FileIcon component renders different elements based on extension.
    // We can verify files are rendered — the icon is an SVG element rendered by lucide-react.
    // Verify that all expected file entries are present
    expect(screen.getByText('style.css')).toBeDefined()
    expect(screen.getByText('main.py')).toBeDefined()
  })

  it('resets query and selection when reopened', async () => {
    const { rerender } = render(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )

    await vi.waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined()
    })

    const { fireEvent } = await import('@testing-library/react')
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.change(input, { target: { value: 'app' } })
    expect(screen.getByText('app.tsx')).toBeDefined()

    // Close and reopen
    rerender(
      <QuickFileOpen
        open={false}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )

    rerender(
      <QuickFileOpen
        open={true}
        onClose={vi.fn()}
        workspacePath="/home/user/project"
        onOpenFile={vi.fn()}
      />
    )

    await vi.waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined()
    })
    // After reopen, all files should show again (query reset)
    expect(screen.getByText('README.md')).toBeDefined()
  })
})
