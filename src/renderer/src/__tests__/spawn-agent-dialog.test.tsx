import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpawnAgentDialog } from '../components/SpawnAgentDialog'

const DEFAULT_PROPS = {
  onSpawn: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SpawnAgentDialog — rendering', () => {
  it('renders the dialog heading', () => {
    render(<SpawnAgentDialog {...DEFAULT_PROPS} />)
    expect(screen.getByText('Spawn Sub-Agent')).toBeInTheDocument()
  })

  it('renders the task textarea', () => {
    render(<SpawnAgentDialog {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText('Describe what this agent should do…')).toBeInTheDocument()
  })

  it('renders the optional agent name input', () => {
    render(<SpawnAgentDialog {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText('Auto-generated from task')).toBeInTheDocument()
  })

  it('renders Spawn Agent submit button', () => {
    render(<SpawnAgentDialog {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: 'Spawn Agent' })).toBeInTheDocument()
  })

  it('Spawn Agent button is disabled when task is empty', () => {
    render(<SpawnAgentDialog {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: 'Spawn Agent' })
    expect(btn).toBeDisabled()
  })

  it('Spawn Agent button becomes enabled when task has content', () => {
    render(<SpawnAgentDialog {...DEFAULT_PROPS} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: 'Write unit tests' },
    })
    expect(screen.getByRole('button', { name: 'Spawn Agent' })).not.toBeDisabled()
  })
})

describe('SpawnAgentDialog — submission', () => {
  it('calls onSpawn with task and auto-generated title', () => {
    const onSpawn = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onSpawn={onSpawn} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: 'Fix the failing tests' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Spawn Agent' }))
    expect(onSpawn).toHaveBeenCalledWith('Fix the failing tests', 'Agent: Fix the failing tests')
  })

  it('uses custom title when provided', () => {
    const onSpawn = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onSpawn={onSpawn} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: 'Some task' },
    })
    fireEvent.change(screen.getByPlaceholderText('Auto-generated from task'), {
      target: { value: 'My Custom Agent' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Spawn Agent' }))
    expect(onSpawn).toHaveBeenCalledWith('Some task', 'My Custom Agent')
  })

  it('truncates auto-generated title at 40 chars with ellipsis', () => {
    const onSpawn = vi.fn()
    const longTask = 'A'.repeat(50)
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onSpawn={onSpawn} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: longTask },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Spawn Agent' }))
    expect(onSpawn).toHaveBeenCalledWith(longTask, `Agent: ${'A'.repeat(40)}…`)
  })

  it('trims whitespace from task before spawning', () => {
    const onSpawn = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onSpawn={onSpawn} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: '  Trimmed task  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Spawn Agent' }))
    expect(onSpawn).toHaveBeenCalledWith('Trimmed task', 'Agent: Trimmed task')
  })

  it('does not call onSpawn when task is only whitespace', () => {
    const onSpawn = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onSpawn={onSpawn} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Spawn Agent' }))
    expect(onSpawn).not.toHaveBeenCalled()
  })
})

describe('SpawnAgentDialog — dismissal', () => {
  it('calls onClose when Cancel button clicked', () => {
    const onClose = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onClose={onClose} />)
    // The X button has an svg child and no label; find by class/proximity
    const closeButtons = screen.getAllByRole('button').filter((b) =>
      !b.textContent && b.querySelector('svg')
    )
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape pressed in textarea', () => {
    const onClose = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText('Describe what this agent should do…'), {
      key: 'Escape',
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('submits on Cmd+Enter in textarea', () => {
    const onSpawn = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onSpawn={onSpawn} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: 'Quick task' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Describe what this agent should do…'), {
      key: 'Enter',
      metaKey: true,
    })
    expect(onSpawn).toHaveBeenCalledWith('Quick task', 'Agent: Quick task')
  })

  it('submits on Ctrl+Enter in textarea', () => {
    const onSpawn = vi.fn()
    render(<SpawnAgentDialog {...DEFAULT_PROPS} onSpawn={onSpawn} />)
    fireEvent.change(screen.getByPlaceholderText('Describe what this agent should do…'), {
      target: { value: 'Another task' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Describe what this agent should do…'), {
      key: 'Enter',
      ctrlKey: true,
    })
    expect(onSpawn).toHaveBeenCalledWith('Another task', 'Agent: Another task')
  })
})
