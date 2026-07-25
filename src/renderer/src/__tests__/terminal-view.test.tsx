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

describe('TerminalView — tab switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    el.terminal.create.mockResolvedValue('term-1')
    el.terminal.onOutput.mockReturnValue(() => {})
    el.terminal.kill = vi.fn()
    ;(globalThis as any).__terminalInstances.length = 0
  })

  it('clicking an inactive tab switches the active terminal', async () => {
    render(<TerminalView cwd="/home/user/project" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledTimes(1)
    })

    // Create second terminal
    el.terminal.create.mockResolvedValue('term-2')
    fireEvent.click(screen.getByTitle('New terminal'))
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledTimes(2)
    })

    // Both tabs should show the same label
    const tabSpans = screen.getAllByText('user/project')
    expect(tabSpans.length).toBe(2)

    // Get the tab parent divs (they have the 'group' class)
    const tab1 = tabSpans[0].closest('.group') as HTMLElement
    const tab2 = tabSpans[1].closest('.group') as HTMLElement
    expect(tab1).toBeDefined()
    expect(tab2).toBeDefined()

    // After creating second terminal, it's active (has bg-background)
    expect(tab2.className).toContain('bg-background')
    expect(tab1.className).not.toContain('bg-background')

    // Click the first tab to switch
    fireEvent.click(tab1)

    // Now first tab should be active
    await waitFor(() => {
      expect(tab1.className).toContain('bg-background')
      expect(tab2.className).not.toContain('bg-background')
    })
  })
})

describe('TerminalView — tab renaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    el.terminal.create.mockResolvedValue('term-1')
    el.terminal.onOutput.mockReturnValue(() => {})
    el.terminal.kill = vi.fn()
    ;(globalThis as any).__terminalInstances.length = 0
  })

  it('double-click to rename a tab', async () => {
    render(<TerminalView cwd="/home/user/project" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalled()
    })

    // Find the tab label span
    const tabLabel = screen.getByText('user/project')
    const tabDiv = tabLabel.closest('.group') as HTMLElement
    expect(tabDiv).toBeDefined()

    // Double-click to rename
    fireEvent.doubleClick(tabDiv)

    // The rename input should appear
    await waitFor(() => {
      const input = tabDiv.querySelector('input') as HTMLInputElement
      expect(input).toBeDefined()
      expect(input.value).toBe('user/project')
    })

    // Type a new name
    const input = tabDiv.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'my-project' } })

    // Press Enter to submit
    fireEvent.keyDown(input, { key: 'Enter' })

    // The label should be updated
    await waitFor(() => {
      expect(screen.getByText('my-project')).toBeDefined()
    })
  })
})

describe('TerminalView — search bar toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    el.terminal.create.mockResolvedValue('term-1')
    el.terminal.onOutput.mockReturnValue(() => {})
    el.terminal.kill = vi.fn()
    ;(globalThis as any).__terminalInstances.length = 0
  })

  it('toggles search bar with Ctrl+F', async () => {
    render(<TerminalView cwd="/home/user/test" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalled()
    })

    // Search bar should not be visible initially
    expect(screen.queryByPlaceholderText('Find…')).not.toBeInTheDocument()

    // Wait for TerminalInstance to mount and attach keydown listener
    await waitFor(() => {
      expect(document.querySelector('.relative.min-h-0.flex-1.overflow-hidden')).toBeInTheDocument()
    })

    // Get the containerRef element via the mock terminal instance
    const instances = (globalThis as any).__terminalInstances
    const term = instances[instances.length - 1]
    expect(term._el).toBeDefined()

    // Dispatch Ctrl+F keydown event on the containerRef element
    fireEvent.keyDown(term._el, { key: 'f', ctrlKey: true })

    // Search bar should appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Find…')).toBeInTheDocument()
    })
  })
})

describe('TerminalView — Ctrl+L clear screen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    el.terminal.create.mockResolvedValue('term-1')
    el.terminal.onOutput.mockReturnValue(() => {})
    el.terminal.kill = vi.fn()
    ;(globalThis as any).__terminalInstances.length = 0
  })

  it('Ctrl+L triggers terminal clear instead of writing to pty', async () => {
    render(<TerminalView cwd="/home/user/test" onClose={vi.fn()} />)

    // Wait for the MockTerminal instance to be created (TerminalInstance mounts)
    const instances = (globalThis as any).__terminalInstances
    await waitFor(() => {
      expect(instances.length).toBeGreaterThan(0)
    })
    const term = instances[instances.length - 1]

    // The onData callback should have been registered
    expect(term._onDataCallback).toBeDefined()

    // Clear previous write calls
    el.terminal.write.mockClear()

    // Simulate Ctrl+L by calling the onData callback with \x0c
    term._onDataCallback('\x0c')

    // The clear function should have been called on the xterm instance
    expect(term._clearCalls).toBe(1)

    // And it should NOT have written to the pty
    expect(el.terminal.write).not.toHaveBeenCalled()
  })
})

describe('TerminalView — multiple terminal lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    el.terminal.create.mockResolvedValue('term-1')
    el.terminal.onOutput.mockReturnValue(() => {})
    el.terminal.kill = vi.fn()
    ;(globalThis as any).__terminalInstances.length = 0
  })

  it('creates 3 terminals and closes the middle one', async () => {
    render(<TerminalView cwd="/home/user/project" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledTimes(1)
    })

    // Create second terminal
    el.terminal.create.mockResolvedValue('term-2')
    fireEvent.click(screen.getByTitle('New terminal'))
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledTimes(2)
    })

    // Create third terminal
    el.terminal.create.mockResolvedValue('term-3')
    fireEvent.click(screen.getByTitle('New terminal'))
    await waitFor(() => {
      expect(el.terminal.create).toHaveBeenCalledTimes(3)
    })

    // Should have 3 close buttons (one per tab)
    const closeButtons = screen.getAllByRole('button', { name: 'Close terminal' })
    expect(closeButtons.length).toBe(3)

    // Close the middle terminal (term-2)
    fireEvent.click(closeButtons[1])

    await waitFor(() => {
      expect(el.terminal.kill).toHaveBeenCalledWith('term-2')
    })

    // Only term-2 should have been killed
    expect(el.terminal.kill).toHaveBeenCalledTimes(1)

    // Should now have 2 close buttons
    const remainingCloseButtons = screen.getAllByRole('button', { name: 'Close terminal' })
    expect(remainingCloseButtons.length).toBe(2)

    // Both remaining tabs should have the same label
    const tabLabels = screen.getAllByText('user/project')
    expect(tabLabels.length).toBe(2)

    // The last remaining tab (term-3) should be active
    // (closeTerminal selects next[Math.min(idx, next.length - 1)])
    const lastTab = tabLabels[1].closest('.group') as HTMLElement
    expect(lastTab.className).toContain('bg-background')

    // The first tab should be inactive
    const firstTab = tabLabels[0].closest('.group') as HTMLElement
    expect(firstTab.className).not.toContain('bg-background')
  })
})
