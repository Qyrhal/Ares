import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar, BUILTIN_COMMANDS } from '../components/InputBar'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

// ─── Click outside to close command picker ──────────────────────────────────

describe('InputBar — click outside closes command picker', () => {
  it('clicking outside the picker and textarea closes the picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('clicking inside the textarea keeps the picker open', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    fireEvent.mouseDown(textarea)
    expect(screen.getByText('/model')).toBeInTheDocument()
  })
})

// ─── No-results state for filtering ────────────────────────────────────────

describe('InputBar — no-results state', () => {
  it('shows empty picker when filter matches nothing', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/zzzznonexistent' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
    expect(screen.queryByText('/help')).not.toBeInTheDocument()
  })

  it('shows all commands when filter is cleared back to /', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/zzzznonexistent' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    expect(screen.getByText('/clear')).toBeInTheDocument()
  })
})

// ─── Description-based filtering ───────────────────────────────────────────

describe('InputBar — description-based filtering', () => {
  it('filters by description text, not just name', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // "diagnostics" appears in /doctor's description
    fireEvent.change(textarea, { target: { value: '/diagnostics' } })
    expect(screen.getByText('/doctor')).toBeInTheDocument()
  })

  it('description filter does not show commands whose names/descriptions do not match', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // "diagnostics" only matches /doctor, not /model
    fireEvent.change(textarea, { target: { value: '/diagnostics' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })
})

// ─── Skill and plugin commands in picker ───────────────────────────────────

describe('InputBar — skill and plugin commands in picker', () => {
  it('shows skill commands in picker', () => {
    const skills = [{ name: 'my-skill', description: 'A custom skill', content: 'skill content' }]
    renderInputBar({ pluginSkills: skills, pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/my' } })
    expect(screen.getByText('/my-skill')).toBeInTheDocument()
  })

  it('shows plugin commands in picker', () => {
    const commands = [{ name: 'deploy', description: 'Deploy to server', argumentHint: '--env', prompt: 'Deploy {{args}}' }]
    renderInputBar({ pluginSkills: [], pluginCommands: commands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.getByText('/deploy')).toBeInTheDocument()
  })

  it('plugin command with argumentHint shows hint in picker', () => {
    const commands = [{ name: 'deploy', description: 'Deploy to server', argumentHint: '--env prod', prompt: 'Deploy {{args}}' }]
    renderInputBar({ pluginSkills: [], pluginCommands: commands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.getByText('--env prod')).toBeInTheDocument()
  })
})

// ─── Send button state ─────────────────────────────────────────────────────

describe('InputBar — send button state', () => {
  it('send button is disabled when textarea is empty and no attachments', () => {
    renderInputBar()
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).toBeDisabled()
  })

  it('send button is enabled when textarea has text', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    const sendBtn = screen.getByLabelText('Send message')
    expect(sendBtn).not.toBeDisabled()
  })

  it('shows stop button when disabled (loading state)', () => {
    renderInputBar({ disabled: true })
    expect(screen.getByLabelText('Stop generation (Ctrl+C)')).toBeInTheDocument()
  })
})

// ─── BUILTIN_COMMANDS count ────────────────────────────────────────────────

describe('InputBar — BUILTIN_COMMANDS count', () => {
  it('BUILTIN_COMMANDS has 71 entries', () => {
    expect(BUILTIN_COMMANDS.length).toBe(82)
  })

  it('all builtin commands have unique names', () => {
    const names = BUILTIN_COMMANDS.map(c => c.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('all builtin commands have non-empty descriptions', () => {
    for (const cmd of BUILTIN_COMMANDS) {
      expect(cmd.description.length).toBeGreaterThan(0)
    }
  })
})

// ─── Multiple skills can be attached ───────────────────────────────────────

describe('InputBar — multiple skill attachments', () => {
  it('can attach multiple different skills', () => {
    const skills = [
      { name: 'skill-a', description: 'Skill A', content: 'content A' },
      { name: 'skill-b', description: 'Skill B', content: 'content B' },
    ]
    renderInputBar({ pluginSkills: skills, pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Attach skill A
    fireEvent.change(textarea, { target: { value: '/skill-a' } })
    const allA = screen.getAllByText('/skill-a')
    const itemA = allA.find(el => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(itemA)

    // Attach skill B
    fireEvent.change(textarea, { target: { value: '/skill-b' } })
    const allB = screen.getAllByText('/skill-b')
    const itemB = allB.find(el => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(itemB)

    // Both chips should be visible
    expect(screen.getByText('skill-a')).toBeInTheDocument()
    expect(screen.getByText('skill-b')).toBeInTheDocument()
  })

  it('skill chip can be removed via the remove button', () => {
    const skills = [{ name: 'my-skill', description: 'A skill', content: 'content' }]
    renderInputBar({ pluginSkills: skills, pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Attach skill
    fireEvent.change(textarea, { target: { value: '/my-skill' } })
    const allMatches = screen.getAllByText('/my-skill')
    const item = allMatches.find(el => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(item)

    // Chip should appear
    expect(screen.getByText('my-skill')).toBeInTheDocument()

    // Remove it
    const removeBtn = screen.getByLabelText('Remove my-skill')
    fireEvent.click(removeBtn)

    // Chip should be gone
    expect(screen.queryByText('skill')).not.toBeInTheDocument()
  })
})
