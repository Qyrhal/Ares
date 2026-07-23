import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickFileOpen } from '@/components/QuickFileOpen'

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  workspacePath: '/project',
  onOpenFile: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  window.electron.fs.findFiles = vi.fn().mockResolvedValue([])
})

describe('QuickFileOpen — open/close', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <QuickFileOpen {...defaultProps} open={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders overlay when open', () => {
    render(<QuickFileOpen {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search files by name…')).toBeDefined()
  })

  it('shows search input when open', () => {
    render(<QuickFileOpen {...defaultProps} />)
    const input = screen.getByPlaceholderText('Search files by name…')
    expect(input).toBeDefined()
  })
})

describe('QuickFileOpen — workspace states', () => {
  it('shows "No folder open" when workspacePath is null', () => {
    render(<QuickFileOpen {...defaultProps} workspacePath={null} />)
    expect(screen.getByText('No folder open')).toBeDefined()
  })

  it('shows empty folder prompt when no workspace', () => {
    render(<QuickFileOpen {...defaultProps} workspacePath={null} />)
    expect(screen.getByText('Open a folder to search files')).toBeDefined()
  })

  it('disables input when no workspace', () => {
    render(<QuickFileOpen {...defaultProps} workspacePath={null} />)
    const input = screen.getByPlaceholderText('No folder open')
    expect(input).toBeDisabled()
  })
})

describe('QuickFileOpen — file loading', () => {
  it('loads files when opened with workspace', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/src/main.ts',
      '/src/app.tsx',
    ])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(window.electron.fs.findFiles).toHaveBeenCalledWith('/project')
    })
  })

  it('shows loading state', async () => {
    let resolve: (v: string[]) => void
    window.electron.fs.findFiles = vi.fn().mockReturnValue(
      new Promise<string[]>((r) => { resolve = r }),
    )
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Loading files…')).toBeDefined()
    })
    resolve!([])
  })

  it('does not load files when closed', () => {
    render(<QuickFileOpen {...defaultProps} open={false} />)
    expect(window.electron.fs.findFiles).not.toHaveBeenCalled()
  })
})

describe('QuickFileOpen — file rendering', () => {
  it('renders loaded files', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/src/main.ts',
      '/src/app.tsx',
    ])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('main.ts')).toBeDefined()
      expect(screen.getByText('app.tsx')).toBeDefined()
    })
  })

  it('shows file count', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/a.ts',
      '/b.ts',
      '/c.ts',
    ])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('3 files')).toBeDefined()
    })
  })

  it('shows singular "file" for one result', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue(['/a.ts'])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('1 file')).toBeDefined()
    })
  })

  it('shows directory path for files', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/src/components/App.tsx',
    ])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('/src/components')).toBeDefined()
    })
  })
})

describe('QuickFileOpen — filtering', () => {
  it('filters files by name', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/src/main.ts',
      '/src/app.tsx',
    ])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('main.ts')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.change(input, { target: { value: 'main' } })
    expect(screen.getByText('main.ts')).toBeDefined()
    expect(screen.queryByText('app.tsx')).toBeNull()
  })

  it('shows "No files found" when query has no matches', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue(['/a.ts'])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('a.ts')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('No files found')).toBeDefined()
  })

  it('shows "No files in workspace" when empty files list and no query', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('No files in workspace')).toBeDefined()
    })
  })

  it('prioritizes name matches over path matches', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/deep/path/main.ts',
      '/other/thing.txt',
    ])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('main.ts')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.change(input, { target: { value: 'main' } })
    expect(screen.getByText('main.ts')).toBeDefined()
    expect(screen.queryByText('thing.txt')).toBeNull()
  })
})

describe('QuickFileOpen — keyboard navigation', () => {
  it('calls onClose on Escape', async () => {
    const onClose = vi.fn()
    window.electron.fs.findFiles = vi.fn().mockResolvedValue(['/a.ts'])
    render(<QuickFileOpen {...defaultProps} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('a.ts')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('opens file on Enter', async () => {
    const onOpenFile = vi.fn()
    const onClose = vi.fn()
    window.electron.fs.findFiles = vi.fn().mockResolvedValue(['/src/main.ts'])
    render(
      <QuickFileOpen
        {...defaultProps}
        onOpenFile={onOpenFile}
        onClose={onClose}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('main.ts')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onOpenFile).toHaveBeenCalledWith('/src/main.ts')
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates down with ArrowDown', async () => {
    const onOpenFile = vi.fn()
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/a.ts',
      '/b.ts',
    ])
    render(
      <QuickFileOpen
        {...defaultProps}
        onOpenFile={onOpenFile}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('a.ts')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onOpenFile).toHaveBeenCalledWith('/b.ts')
  })

  it('navigates up with ArrowUp', async () => {
    const onOpenFile = vi.fn()
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/a.ts',
      '/b.ts',
    ])
    render(
      <QuickFileOpen
        {...defaultProps}
        onOpenFile={onOpenFile}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('a.ts')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    // Go down to index 1, then back up to 0
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onOpenFile).toHaveBeenCalledWith('/a.ts')
  })

  it('does not crash when Enter pressed with no files', async () => {
    const onClose = vi.fn()
    render(<QuickFileOpen {...defaultProps} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('No files in workspace')).toBeDefined()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('QuickFileOpen — interactions', () => {
  it('closes when clicking backdrop', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <QuickFileOpen {...defaultProps} onClose={onClose} />,
    )
    await waitFor(() => {
      expect(window.electron.fs.findFiles).toHaveBeenCalled()
    })
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when clicking inside dialog', async () => {
    const onClose = vi.fn()
    render(<QuickFileOpen {...defaultProps} onClose={onClose} />)
    await waitFor(() => {
      expect(window.electron.fs.findFiles).toHaveBeenCalled()
    })
    const input = screen.getByPlaceholderText('Search files by name…')
    fireEvent.click(input)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('opens file on click', async () => {
    const onOpenFile = vi.fn()
    const onClose = vi.fn()
    window.electron.fs.findFiles = vi.fn().mockResolvedValue(['/src/main.ts'])
    render(
      <QuickFileOpen
        {...defaultProps}
        onOpenFile={onOpenFile}
        onClose={onClose}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('main.ts')).toBeDefined()
    })
    fireEvent.click(screen.getByText('main.ts'))
    expect(onOpenFile).toHaveBeenCalledWith('/src/main.ts')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('QuickFileOpen — file icons', () => {
  it('renders different file types without crashing', async () => {
    window.electron.fs.findFiles = vi.fn().mockResolvedValue([
      '/src/app.tsx',
      '/docs/readme.md',
      '/img/logo.png',
      '/styles/main.css',
      '/scripts/deploy.py',
      '/data/config.json',
      '/unknown.xyz',
    ])
    render(<QuickFileOpen {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('app.tsx')).toBeDefined()
      expect(screen.getByText('readme.md')).toBeDefined()
      expect(screen.getByText('logo.png')).toBeDefined()
      expect(screen.getByText('main.css')).toBeDefined()
      expect(screen.getByText('deploy.py')).toBeDefined()
      expect(screen.getByText('config.json')).toBeDefined()
      expect(screen.getByText('unknown.xyz')).toBeDefined()
    })
  })
})
