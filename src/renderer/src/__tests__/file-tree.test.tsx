import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileTree, FileTreeProps } from '../components/FileTree'
import { FileNode } from '../types'

const FOLDER: FileNode = { name: 'src', path: '/project/src', type: 'directory', children: [] }
const FILE: FileNode = { name: 'index.ts', path: '/project/index.ts', type: 'file' }
const WORKSPACE = '/project'

function makeProps(overrides: Partial<FileTreeProps> = {}): FileTreeProps {
  return {
    nodes: [],
    workspacePath: WORKSPACE,
    onOpenFile: vi.fn(),
    onOpenFolder: vi.fn(),
    onCreateFile: vi.fn().mockResolvedValue(undefined),
    onCreateFolder: vi.fn().mockResolvedValue(undefined),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('FileTree — no workspace', () => {
  it('shows "No folder open" message', () => {
    render(<FileTree {...makeProps({ workspacePath: null })} />)
    expect(screen.getByText('No folder open')).toBeInTheDocument()
  })

  it('renders "Open folder" button', () => {
    const onOpenFolder = vi.fn()
    render(<FileTree {...makeProps({ workspacePath: null, onOpenFolder })} />)
    fireEvent.click(screen.getByText('Open folder'))
    expect(onOpenFolder).toHaveBeenCalledOnce()
  })
})

describe('FileTree — with workspace', () => {
  it('shows workspace name in header', () => {
    render(<FileTree {...makeProps()} />)
    expect(screen.getByText('project')).toBeInTheDocument()
  })

  it('shows "Empty folder" when no nodes', () => {
    render(<FileTree {...makeProps()} />)
    expect(screen.getByText('Empty folder')).toBeInTheDocument()
  })

  it('renders file and folder nodes', () => {
    render(<FileTree {...makeProps({ nodes: [FOLDER, FILE] })} />)
    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByText('index.ts')).toBeInTheDocument()
  })

  it('calls onOpenFile when a file is clicked', () => {
    const onOpenFile = vi.fn()
    render(<FileTree {...makeProps({ nodes: [FILE], onOpenFile })} />)
    fireEvent.click(screen.getByText('index.ts'))
    expect(onOpenFile).toHaveBeenCalledWith(FILE)
  })
})

describe('FileTree — new file / folder buttons (header)', () => {
  it('shows inline input when "New file" header button is clicked', () => {
    render(<FileTree {...makeProps()} />)
    fireEvent.click(screen.getByTitle('New file'))
    expect(screen.getByPlaceholderText('filename.tsx')).toBeInTheDocument()
  })

  it('shows inline input when "New folder" header button is clicked', () => {
    render(<FileTree {...makeProps()} />)
    fireEvent.click(screen.getByTitle('New folder'))
    expect(screen.getByPlaceholderText('folder name')).toBeInTheDocument()
  })

  it('calls onCreateFile on Enter', () => {
    const onCreateFile = vi.fn().mockResolvedValue(undefined)
    render(<FileTree {...makeProps({ onCreateFile })} />)
    fireEvent.click(screen.getByTitle('New file'))
    const input = screen.getByPlaceholderText('filename.tsx')
    fireEvent.change(input, { target: { value: 'app.tsx' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreateFile).toHaveBeenCalledWith(WORKSPACE, 'app.tsx')
  })

  it('cancels inline input on Escape', () => {
    render(<FileTree {...makeProps()} />)
    fireEvent.click(screen.getByTitle('New file'))
    const input = screen.getByPlaceholderText('filename.tsx')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('filename.tsx')).not.toBeInTheDocument()
  })

  it('does not call onCreateFile when input is empty + Enter', () => {
    const onCreateFile = vi.fn()
    render(<FileTree {...makeProps({ onCreateFile })} />)
    fireEvent.click(screen.getByTitle('New file'))
    fireEvent.keyDown(screen.getByPlaceholderText('filename.tsx'), { key: 'Enter' })
    expect(onCreateFile).not.toHaveBeenCalled()
  })
})

describe('FileTree — context menu', () => {
  it('shows context menu on right-click of a file node', () => {
    render(<FileTree {...makeProps({ nodes: [FILE] })} />)
    fireEvent.contextMenu(screen.getByText('index.ts'))
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('shows New file + New folder for a directory', () => {
    render(<FileTree {...makeProps({ nodes: [FOLDER] })} />)
    fireEvent.contextMenu(screen.getByText('src'))
    expect(screen.getByText('New file')).toBeInTheDocument()
    expect(screen.getByText('New folder')).toBeInTheDocument()
  })

  it('context menu "Open" calls onOpenFile', () => {
    const onOpenFile = vi.fn()
    render(<FileTree {...makeProps({ nodes: [FILE], onOpenFile })} />)
    fireEvent.contextMenu(screen.getByText('index.ts'))
    fireEvent.click(screen.getByText('Open'))
    expect(onOpenFile).toHaveBeenCalledWith(FILE)
  })

  it('context menu "Rename" shows inline rename input', () => {
    render(<FileTree {...makeProps({ nodes: [FILE] })} />)
    fireEvent.contextMenu(screen.getByText('index.ts'))
    fireEvent.click(screen.getByText('Rename'))
    // Input should appear pre-filled with the current name
    const input = screen.getByDisplayValue('index.ts')
    expect(input).toBeInTheDocument()
  })

  it('context menu "Rename" calls onRename on Enter', () => {
    const onRename = vi.fn().mockResolvedValue(undefined)
    render(<FileTree {...makeProps({ nodes: [FILE], onRename })} />)
    fireEvent.contextMenu(screen.getByText('index.ts'))
    fireEvent.click(screen.getByText('Rename'))
    const input = screen.getByDisplayValue('index.ts')
    fireEvent.change(input, { target: { value: 'renamed.ts' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('/project/index.ts', 'renamed.ts')
  })

  it('dismisses context menu on Escape', () => {
    render(<FileTree {...makeProps({ nodes: [FILE] })} />)
    fireEvent.contextMenu(screen.getByText('index.ts'))
    expect(screen.getByText('Open')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Open')).not.toBeInTheDocument()
  })
})

describe('FileTree — inline rename via hover button', () => {
  it('shows rename input when Rename hover button clicked', () => {
    render(<FileTree {...makeProps({ nodes: [FILE] })} />)
    // Hover buttons are hidden until hover; we can still query them
    const renameBtn = screen.getByTitle('Rename')
    fireEvent.click(renameBtn)
    expect(screen.getByDisplayValue('index.ts')).toBeInTheDocument()
  })
})
