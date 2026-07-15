import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SkillsPanel } from '@/components/SkillsPanel'

const el = window.electron as Record<string, any>

beforeEach(() => {
  vi.clearAllMocks()
  el.agentConfig.get.mockResolvedValue({ skills: [], extensions: [], mcpServers: [] })
})

describe('SkillsPanel', () => {
  it('renders empty state when no skills', async () => {
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No skills yet')).toBeDefined()
    })
  })

  it('loads config on mount', async () => {
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(el.agentConfig.get).toHaveBeenCalledTimes(1)
    })
  })

  it('adds a skill via New skill button', async () => {
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No skills yet')).toBeDefined()
    })

    fireEvent.click(screen.getByText('New skill'))
    await waitFor(() => {
      expect(el.agentConfig.set).toHaveBeenCalledTimes(1)
    })
    const config = el.agentConfig.set.mock.calls[0][0]
    expect(config.skills).toHaveLength(1)
    expect(config.skills[0].name).toBe('New skill')
    expect(config.skills[0].description).toBe('')
  })

  it('adds a skill from empty state button', async () => {
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(screen.getByText('Create your first skill')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Create your first skill'))
    await waitFor(() => {
      expect(el.agentConfig.set).toHaveBeenCalledTimes(1)
    })
    const config = el.agentConfig.set.mock.calls[0][0]
    expect(config.skills).toHaveLength(1)
  })

  it('renders existing skills', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'CodeReview', description: 'Review code', content: '# Code Review\nCheck for bugs.' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(screen.getByText('CodeReview')).toBeDefined()
    })
    expect(screen.getByText('Review code')).toBeDefined()
  })

  it('shows line count for skill content', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'BigSkill', description: '', content: 'line1\nline2\nline3' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(screen.getByText('3 lines')).toBeDefined()
    })
  })

  it('shows "empty" for zero-length content', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'EmptySkill', description: '', content: '' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(screen.getByText('empty')).toBeDefined()
    })
  })

  it('expands and collapses skill row', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'ExpandTest', description: '', content: 'content' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)
    await waitFor(() => expect(screen.getByText('ExpandTest')).toBeDefined())

    // Expand
    fireEvent.click(screen.getByText('ExpandTest'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('ExpandTest')).toBeDefined()
    })

    // Collapse
    fireEvent.click(screen.getByText('ExpandTest'))
    await waitFor(() => {
      expect(screen.queryByDisplayValue('ExpandTest')).toBeNull()
    })
  })

  it('edits skill name', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'OldName', description: '', content: '' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)
    await waitFor(() => expect(screen.getByText('OldName')).toBeDefined())

    fireEvent.click(screen.getByText('OldName'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('OldName')).toBeDefined()
    })

    const nameInput = screen.getByDisplayValue('OldName')
    fireEvent.change(nameInput, { target: { value: 'NewSkillName' } })

    await waitFor(() => {
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      const skill = lastCall.skills[0]
      expect(skill.name).toBe('NewSkillName')
    })
  })

  it('edits skill description', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'DescEdit', description: '', content: '' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)

    await waitFor(() => expect(screen.getByText('DescEdit')).toBeDefined())
    fireEvent.click(screen.getByText('DescEdit'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Short description of this skill')).toBeDefined()
    })

    const descInput = screen.getByPlaceholderText('Short description of this skill')
    fireEvent.change(descInput, { target: { value: 'New description' } })

    await waitFor(() => {
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(lastCall.skills[0].description).toBe('New description')
    })
  })

  it('edits skill content', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'ContentEdit', description: '', content: 'old content' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)

    await waitFor(() => expect(screen.getByText('ContentEdit')).toBeDefined())
    fireEvent.click(screen.getByText('ContentEdit'))

    const textarea = await screen.findByPlaceholderText(/Describe the skill/)
    fireEvent.change(textarea, { target: { value: '# New content' } })

    await waitFor(() => {
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(lastCall.skills[0].content).toBe('# New content')
    })
  })

  it('deletes a skill', async () => {
    el.agentConfig.get.mockResolvedValue({
      skills: [{ id: 's1', name: 'ToDelete', description: '', content: '' }],
      extensions: [], mcpServers: [],
    })
    render(<SkillsPanel />)
    await waitFor(() => expect(screen.getByText('ToDelete')).toBeDefined())

    const row = screen.getByText('ToDelete').closest('.rounded-xl')
    const deleteBtn = row?.querySelector('button:last-of-type')
    if (deleteBtn) fireEvent.click(deleteBtn)

    await waitFor(() => {
      const lastCall = el.agentConfig.set.mock.calls[el.agentConfig.set.mock.calls.length - 1][0]
      expect(lastCall.skills).toHaveLength(0)
    })
  })

  it('shows saved indicator after mutation', async () => {
    render(<SkillsPanel />)
    await waitFor(() => {
      expect(screen.getByText('No skills yet')).toBeDefined()
    })

    fireEvent.click(screen.getByText('New skill'))

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeDefined()
    })
  })
})
