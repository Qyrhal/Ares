import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { TerminalView } from '@/components/TerminalView'

const el = window.electron as Record<string, any>

beforeEach(() => {
  vi.clearAllMocks()
  el.terminal.create.mockResolvedValue('term-1')
  el.terminal.onOutput.mockReturnValue(() => {})
  el.terminal.kill = vi.fn()
})

describe('TerminalView', () => {
  it('renders with tab bar and creates terminal on mount', async () => {
    const onClose = vi.fn()
    render(<TerminalView cwd="/home/user/project" onClose={onClose} />)
    // Should create a terminal on mount
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledWith('/home/user/project')
    })
  })

  it('displays the tab label derived from cwd', async () => {
    render(<TerminalView cwd="/home/user/project" onClose={vi.fn()} />)
    await waitFor(() => {
      // tabLabel('/home/user/project') returns last 2 parts: 'user/project'
      expect(screen.getByText('user/project')).toBeDefined()
    })
  })

  it('displays "shell" as tab label for null cwd', async () => {
    render(<TerminalView cwd={null} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('shell')).toBeDefined()
    })
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<TerminalView cwd="/test" onClose={onClose} />)
    // Wait for terminal to be created and tab to appear
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalled()
    })

    // Find the close panel button (ChevronDown icon, titled "Close terminal panel")
    const closePanelBtn = screen.getByTitle('Close terminal panel')
    fireEvent.click(closePanelBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows error state when terminal create fails', async () => {
    el.terminal.create.mockRejectedValue(new Error('Failed to spawn pty'))
    render(<TerminalView cwd="/test" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Failed to spawn pty')).toBeDefined()
    })
  })

  it('shows "Starting terminal…" in empty state', async () => {
    // Don't resolve the create promise yet to test loading state
    el.terminal.create.mockReturnValue(new Promise(() => {})) // never resolves
    render(<TerminalView cwd="/test" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Starting terminal…')).toBeDefined()
    })
  })

  it('creates new terminal when clicking + button', async () => {
    el.terminal.create.mockResolvedValue('term-1')
    render(<TerminalView cwd="/project" onClose={vi.fn()} />)

    // Wait for first terminal
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledTimes(1)
    })

    // Click the new terminal button
    el.terminal.create.mockResolvedValue('term-2')
    const newTermBtn = screen.getByTitle('New terminal')
    fireEvent.click(newTermBtn)

    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledTimes(2)
      expect(el.terminal.create).toHaveBeenLastCalledWith('/project')
    })
  })

  it('closes a terminal tab via X button', async () => {
    render(<TerminalView cwd="/test" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalled()
    })

    // Find the close tab button
    const closeTabBtns = screen.getAllByRole('button')
    const closeTabBtn = closeTabBtns.find((btn) => btn.getAttribute('aria-label') === 'Close terminal')
    expect(closeTabBtn).toBeDefined()

    if (closeTabBtn) {
      fireEvent.click(closeTabBtn)
      await waitFor(() => {
        expect(el.terminal.kill).toHaveBeenCalledWith('term-1')
      })
    }
  })

  it('renders the drag resize handle', async () => {
    render(<TerminalView cwd="/test" onClose={vi.fn()} />)
    // The drag handle is a div containing GripHorizontal
    const dragHandle = document.querySelector('.cursor-row-resize')
    expect(dragHandle).toBeDefined()
  })

  it('calls onHeightChange when drag handle is used', async () => {
    const onHeightChange = vi.fn()
    render(<TerminalView cwd="/test" onClose={vi.fn()} onHeightChange={onHeightChange} />)

    // Get the drag handle
    const dragHandle = document.querySelector('.cursor-row-resize') as HTMLElement
    expect(dragHandle).toBeDefined()

    // Simulate mousedown to start resize
    fireEvent.mouseDown(dragHandle, { clientY: 200, buttons: 1 })

    // Simulate mousemove on document
    fireEvent.mouseMove(document, { clientY: 180 })

    // Simulate mouseup to end resize
    fireEvent.mouseUp(document)

    await waitFor(() => {
      expect(onHeightChange).toHaveBeenCalled()
    })
  })

  it('subscribes to terminal output on mount', async () => {
    render(<TerminalView cwd="/test" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(el.terminal.onOutput).toHaveBeenCalledTimes(1)
    })
  })

  it('cleans up terminals on unmount', async () => {
    const { unmount } = render(<TerminalView cwd="/test" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalled()
    })

    unmount()
    await waitFor(() => {
      expect(el.terminal.kill).toHaveBeenCalled()
    })
  })
})

describe('TerminalView — search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    el.terminal.create.mockResolvedValue('term-search')
    el.terminal.onOutput.mockReturnValue(() => {})
    el.terminal.kill = vi.fn()
  })

  it('search bar is hidden by default', () => {
    render(<TerminalView cwd="/test" onClose={vi.fn()} />)
    expect(screen.queryByPlaceholderText('Find…')).not.toBeInTheDocument()
  })
})
