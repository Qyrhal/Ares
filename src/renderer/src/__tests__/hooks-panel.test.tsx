import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HooksPanel } from '@/components/HooksPanel'

const el = window.electron as Record<string, any>

beforeEach(() => {
  vi.clearAllMocks()
  el.hooks.get.mockResolvedValue([])
})

describe('HooksPanel', () => {
  it('renders empty state when no hooks', async () => {
    render(<HooksPanel />)
    await waitFor(() => {
      expect(screen.getByText('No hooks yet')).toBeDefined()
    })
  })

  it('calls hooks.get on mount', async () => {
    render(<HooksPanel />)
    await waitFor(() => {
      expect(el.hooks.get).toHaveBeenCalledTimes(1)
    })
  })

  it('adds a hook when clicking Add hook', async () => {
    render(<HooksPanel />)
    await waitFor(() => {
      expect(screen.getByText('No hooks yet')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Add hook'))
    await waitFor(() => {
      expect(el.hooks.set).toHaveBeenCalledTimes(1)
    })
    const setCall = el.hooks.set.mock.calls[0][0]
    expect(setCall).toHaveLength(1)
    expect(setCall[0].event).toBe('preTool')
    expect(setCall[0].action).toBe('script')
    expect(setCall[0].enabled).toBe(true)
  })

  it('renders hooks from the API', async () => {
    el.hooks.get.mockResolvedValue([
      { id: 'h1', event: 'preSend', action: 'webhook', target: 'https://example.com', enabled: true },
    ])
    render(<HooksPanel />)
    await waitFor(() => {
      expect(screen.getAllByText(/webhook/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/preSend/).length).toBeGreaterThan(0)
    })
  })

  it('expands a hook row on click, collapses on second click', async () => {
    el.hooks.get.mockResolvedValue([
      { id: 'h1', event: 'preTool', action: 'script', target: '/path/to/script.sh', enabled: true },
    ])
    render(<HooksPanel />)

    // Find the hook row by its content text and click to expand
    const hookText = await screen.findByText(/preTool.*script/)
    expect(hookText).toBeDefined()
    const row = hookText.closest('[class*="cursor-pointer"]')
    expect(row).toBeDefined()
    if (row) fireEvent.click(row)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Before tool execution')).toBeDefined()
    })

    // Click again to collapse — the row is still findable
    if (row) fireEvent.click(row)
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Before tool execution')).toBeNull()
    })
  })

  it('deletes a hook via trash button', async () => {
    el.hooks.get.mockResolvedValue([
      { id: 'h1', event: 'preTool', action: 'script', target: '', enabled: true },
    ])
    render(<HooksPanel />)

    await waitFor(() => {
      expect(screen.getByText(/preTool/)).toBeDefined()
    })

    // Click all trash buttons (the last one is the remove)
    const trashButtons = screen.getAllByRole('button')
    const removeBtn = trashButtons.find((btn) =>
      btn.innerHTML.includes('Trash2') || btn.querySelector('.lucide-trash2')
    )
    // Simpler: find the delete button via title or role
    const allButtons = screen.getAllByRole('button')
    // The last button in each row is the trash icon
    // Try to find by looking at the parent
    const deleteBtn = allButtons.find((b) => b.className.includes('destructive'))
    if (deleteBtn) {
      fireEvent.click(deleteBtn)
    } else {
      // Fallback: click buttons in reverse looking for the one that triggers delete
      const row = screen.getByText(/preTool/).closest('.rounded-xl')
      if (row) {
        const btns = row.querySelectorAll('button')
        const del = btns[btns.length - 1]
        if (del) fireEvent.click(del)
      }
    }

    await waitFor(() => {
      expect(el.hooks.set).toHaveBeenCalled()
      const calls = el.hooks.set.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall).toHaveLength(0)
    })
  })

  it('toggles hook enable/disable', async () => {
    el.hooks.get.mockResolvedValue([
      { id: 'h1', event: 'preTool', action: 'script', target: '', enabled: true },
    ])
    render(<HooksPanel />)

    await waitFor(() => {
      expect(screen.getByTitle('Disable')).toBeDefined()
    })

    fireEvent.click(screen.getByTitle('Disable'))

    await waitFor(() => {
      const lastCall = el.hooks.set.mock.calls[el.hooks.set.mock.calls.length - 1][0]
      expect(lastCall[0].enabled).toBe(false)
    })
  })

  it('shows saved indicator after mutation', async () => {
    el.hooks.get.mockResolvedValue([])
    render(<HooksPanel />)

    await waitFor(() => {
      expect(screen.getByText('No hooks yet')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Add hook'))

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeDefined()
    })
  })

  it('renders hook row with description', async () => {
    el.hooks.get.mockResolvedValue([
      { id: 'h1', event: 'preTool', action: 'script', target: '', enabled: true, description: 'My custom hook' },
    ])
    render(<HooksPanel />)
    await waitFor(() => {
      expect(screen.getByText('My custom hook')).toBeDefined()
    })
  })

  it('updates hook event via select when expanded', async () => {
    el.hooks.get.mockResolvedValue([
      { id: 'h1', event: 'preTool', action: 'script', target: '', enabled: true },
    ])
    render(<HooksPanel />)

    // Find and click the hook row to expand
    const hookText = await screen.findByText(/preTool.*script/)
    const row = hookText.closest('[class*="cursor-pointer"]')
    expect(row).toBeDefined()
    if (row) fireEvent.click(row)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Before tool execution')).toBeDefined()
    })

    // Change event
    const select = screen.getByDisplayValue('Before tool execution')
    fireEvent.change(select, { target: { value: 'postTool' } })

    await waitFor(() => {
      const lastCall = el.hooks.set.mock.calls[el.hooks.set.mock.calls.length - 1][0]
      const updated = lastCall.find((h: any) => h.id === 'h1')
      expect(updated?.event).toBe('postTool')
    })
  })

  it('updates target input when expanded', async () => {
    el.hooks.get.mockResolvedValue([
      { id: 'h1', event: 'postSend', action: 'webhook', target: '', enabled: true },
    ])
    render(<HooksPanel />)

    const hookText = await screen.findByText(/postSend.*webhook/)
    const row = hookText.closest('[class*="cursor-pointer"]')
    expect(row).toBeDefined()
    if (row) fireEvent.click(row)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('https://example.com/hook')).toBeDefined()
    })

    const targetInput = screen.getByPlaceholderText('https://example.com/hook')
    fireEvent.change(targetInput, { target: { value: 'https://my-webhook.com' } })

    await waitFor(() => {
      const lastCall = el.hooks.set.mock.calls[el.hooks.set.mock.calls.length - 1][0]
      const updated = lastCall.find((h: any) => h.id === 'h1')
      expect(updated?.target).toBe('https://my-webhook.com')
    })
  })

  it('adds hook from the empty state button', async () => {
    render(<HooksPanel />)
    await waitFor(() => {
      expect(screen.getByText('Add your first hook')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Add your first hook'))
    await waitFor(() => {
      expect(el.hooks.set).toHaveBeenCalled()
      const setCall = el.hooks.set.mock.calls[0][0]
      expect(setCall).toHaveLength(1)
    })
  })
})
