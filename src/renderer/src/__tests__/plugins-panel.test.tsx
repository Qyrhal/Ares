import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PluginsPanel } from '@/components/PluginsPanel'

const el = window.electron as Record<string, any>

beforeEach(() => {
  vi.clearAllMocks()
  el.agentConfig.get.mockResolvedValue({ skills: [], extensions: [], mcpServers: [], commands: [] })
})

describe('PluginsPanel', () => {
  it('renders empty MCP servers section', async () => {
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(screen.getByText(/MCP Servers/)).toBeDefined()
    })
    expect(screen.getByText('No MCP servers')).toBeDefined()
  })

  it('renders empty Extensions section', async () => {
    render(<PluginsPanel />)
    await waitFor(() => {
      const extHeadings = screen.getAllByText(/Extensions/)
      expect(extHeadings.length).toBeGreaterThan(0)
    })
    expect(screen.getByText('No extensions')).toBeDefined()
  })

  it('loads config on mount', async () => {
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(el.agentConfig.get).toHaveBeenCalledTimes(1)
    })
  })

  it('adds an MCP server', async () => {
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No MCP servers')).toBeDefined()
    })

    fireEvent.click(screen.getAllByText('Add server')[0])
    await waitFor(() => {
      expect(el.agentConfig.set).toHaveBeenCalledTimes(1)
    })
    const config = el.agentConfig.set.mock.calls[0][0]
    expect(config.mcpServers).toHaveLength(1)
    expect(config.mcpServers[0].name).toBe('New server')
    expect(config.mcpServers[0].command).toBe('npx')
    expect(config.mcpServers[0].enabled).toBe(true)
  })

  it('adds an MCP server from empty state button', async () => {
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No MCP servers')).toBeDefined()
    })

    // The empty state has an "Add" button
    const addBtns = screen.getAllByText('Add')
    fireEvent.click(addBtns[0])
    await waitFor(() => {
      expect(el.agentConfig.set).toHaveBeenCalled()
    })
  })

  it('renders existing MCP servers', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], extensions: [], commands: [],
      mcpServers: [{ id: 'm1', name: 'Filesystem', command: 'npx', args: ['-y', 'mcp-server'], env: {}, enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(screen.getByText('Filesystem')).toBeDefined()
    })
    expect(screen.getByText(/npx -y mcp-server/)).toBeDefined()
  })

  it('expands and collapses MCP server row', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], extensions: [], commands: [],
      mcpServers: [{ id: 'm1', name: 'TestServer', command: 'npx', args: [], env: {}, enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => expect(screen.getByText('TestServer')).toBeDefined())

    // Expand
    fireEvent.click(screen.getByText('TestServer'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('TestServer')).toBeDefined()
    })

    // Collapse
    fireEvent.click(screen.getByText('TestServer'))
    await waitFor(() => {
      expect(screen.queryByDisplayValue('TestServer')).toBeNull()
    })
  })

  it('edits MCP server name', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], extensions: [], commands: [],
      mcpServers: [{ id: 'm1', name: 'OldName', command: 'npx', args: [], env: {}, enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => expect(screen.getByText('OldName')).toBeDefined())

    fireEvent.click(screen.getByText('OldName'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('OldName')).toBeDefined()
    })

    const nameInput = screen.getByDisplayValue('OldName')
    fireEvent.change(nameInput, { target: { value: 'NewName' } })

    await waitFor(() => {
      const config = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      const server = config.mcpServers[0]
      expect(server.name).toBe('NewName')
    })
  })

  it('deletes MCP server', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], extensions: [], commands: [],
      mcpServers: [{ id: 'm1', name: 'ToDelete', command: 'npx', args: [], env: {}, enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => expect(screen.getByText('ToDelete')).toBeDefined())

    // Find the delete button (the last button in the closed row, has Trash2 icon)
    const row = screen.getByText('ToDelete').closest('.rounded-xl')
    const deleteBtn = row?.querySelector('button:last-of-type')
    if (deleteBtn) fireEvent.click(deleteBtn)

    await waitFor(() => {
      const config = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(config.mcpServers).toHaveLength(0)
    })
  })

  it('adds an extension', async () => {
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No extensions')).toBeDefined()
    })

    // Click "Add extension" button
    const addExtBtns = screen.getAllByText('Add extension')
    fireEvent.click(addExtBtns[0])

    await waitFor(() => {
      expect(el.agentConfig.set).toHaveBeenCalled()
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(lastCall.extensions).toHaveLength(1)
      expect(lastCall.extensions[0].name).toBe('New extension')
    })
  })

  it('renders existing extensions', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], commands: [],
      mcpServers: [],
      extensions: [{ id: 'e1', name: 'MyExt', path: '/path/to/ext.js', enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(screen.getByText('MyExt')).toBeDefined()
    })
    expect(screen.getByText(/\/path\/to\/ext.js/)).toBeDefined()
  })

  it('deletes extension', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], commands: [],
      mcpServers: [],
      extensions: [{ id: 'e1', name: 'ExtToDel', path: '/test.js', enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => expect(screen.getByText('ExtToDel')).toBeDefined())

    const row = screen.getByText('ExtToDel').closest('.rounded-xl')
    const deleteBtn = row?.querySelector('button:last-of-type')
    if (deleteBtn) fireEvent.click(deleteBtn)

    await waitFor(() => {
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(lastCall.extensions).toHaveLength(0)
    })
  })

  it('shows saved indicator after config mutation', async () => {
    render(<PluginsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No MCP servers')).toBeDefined()
    })

    const addBtns = screen.getAllByText('Add server')
    fireEvent.click(addBtns[0])

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeDefined()
    })
  })

  it('toggles MCP server enable/disable', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], extensions: [], commands: [],
      mcpServers: [{ id: 'm1', name: 'ToggleTest', command: 'npx', args: [], env: {}, enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => expect(screen.getByTitle('Disable')).toBeDefined())

    fireEvent.click(screen.getByTitle('Disable'))
    await waitFor(() => {
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(lastCall.mcpServers[0].enabled).toBe(false)
    })
  })

  it('toggles extension enable/disable', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [], commands: [],
      mcpServers: [],
      extensions: [{ id: 'e1', name: 'ExtToggle', path: '/test.js', enabled: true }],
    })
    render(<PluginsPanel />)
    await waitFor(() => expect(screen.getByTitle('Disable')).toBeDefined())

    // There are two disable buttons (mcp server none, extension one) — click the visible one
    const disableBtns = screen.getAllByTitle('Disable')
    fireEvent.click(disableBtns[disableBtns.length - 1])

    await waitFor(() => {
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(lastCall.extensions[0].enabled).toBe(false)
    })
  })
})
