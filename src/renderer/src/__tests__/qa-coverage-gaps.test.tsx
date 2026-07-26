import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'
import { useAppStore } from '@/store/useAppStore'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

beforeEach(() => {
  useAppStore.setState({
    sessions: [], messages: [], todos: [], tabs: [],
    activeTabId: null, activeView: 'chat', sessionGroups: [],
    sideChatMessages: [], sideChatSessionId: null, sideChatIsLoading: false,
    isLoading: false, workspacePath: null, fileNodes: [],
    lastDeletedMessage: null, promptHistory: [], promptHistoryIdx: -1,
    settings: {
      apiKey: '', apiBaseUrl: 'https://api.openai.com/v1',
      providers: [], defaultModel: 'gpt-4o-mini', themeId: 'steel',
      colorMode: 'dark', systemPrompt: '', permissionMode: 'ask',
    },
  })
  vi.clearAllMocks()
})

// ─── Session switching while command picker is open ────────────────────────

describe('InputBar — session switching while picker is open', () => {
  it('picker is closed on unmount (new session)', () => {
    const { unmount } = renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/' } })
    // /model appears in picker button (1 element in popover)
    expect(screen.getByText('/model')).toBeInTheDocument()

    unmount()

    // After remount, no picker open
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    expect(pickerBtns.length).toBe(0)
  })

  it('clearing text closes the picker', () => {
    renderInputBar({ onSend: vi.fn(), pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })

    // Picker button /clear is in the popover
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    const clearBtns = Array.from(pickerBtns).filter(b => b.textContent?.includes('/clear'))
    expect(clearBtns.length).toBeGreaterThanOrEqual(1)

    fireEvent.change(textarea, { target: { value: '' } })

    // No picker button should contain /clear after clearing
    const pickerBtns2 = document.querySelectorAll('[class*="popover"] button')
    const clearBtns2 = Array.from(pickerBtns2).filter(b => b.textContent?.includes('/clear'))
    expect(clearBtns2).toHaveLength(0)
  })
})

// ─── Error handling in command dispatch ────────────────────────────────────

describe('InputBar — error handling in command dispatch', () => {
  it('unknown slash command dispatches without crash', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/nonexistent' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('nonexistent', '')
  })

  it('empty / command does not crash', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/' } })
    expect(() => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    }).not.toThrow()
  })

  it('onSend is called correctly for regular messages', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello', [], undefined)
  })
})

// ─── Pasting text with / at start ─────────────────────────────────────────

describe('InputBar — pasting text with / at start', () => {
  it('text with / followed by space does not open picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    expect(pickerBtns).toHaveLength(0)
  })

  it('text with / on second line opens picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: 'hello\n/clear' } })
    // /clear button appears in the picker popover
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    const clearBtns = Array.from(pickerBtns).filter(b => b.textContent?.includes('/clear'))
    expect(clearBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('text with / after space does not open picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: 'use /model for this' } })
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    expect(pickerBtns).toHaveLength(0)
  })
})

// ─── Rapid state transitions ──────────────────────────────────────────────

describe('InputBar — rapid state transitions', () => {
  it('rapid open/close/reopen picker cycle does not crash', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    expect(() => {
      for (let i = 0; i < 5; i++) {
        fireEvent.change(textarea, { target: { value: '/' } })
        fireEvent.keyDown(textarea, { key: 'Escape' })
        fireEvent.change(textarea, { target: { value: '' } })
      }
    }).not.toThrow()

    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    expect(pickerBtns).toHaveLength(0)
  })

  it('rapid typing and backspace through command names does not crash', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    expect(() => {
      fireEvent.change(textarea, { target: { value: '/c' } })
      fireEvent.change(textarea, { target: { value: '/cl' } })
      fireEvent.change(textarea, { target: { value: '/cle' } })
      fireEvent.change(textarea, { target: { value: '/clear' } })
      fireEvent.change(textarea, { target: { value: '/cle' } })
      fireEvent.change(textarea, { target: { value: '/cl' } })
      fireEvent.change(textarea, { target: { value: '/c' } })
      fireEvent.change(textarea, { target: { value: '/' } })
      fireEvent.change(textarea, { target: { value: '' } })
    }).not.toThrow()
  })

  it('switching between / commands and @ mentions rapidly does not crash', () => {
    const fileNodes = [
      { name: 'test.ts', path: '/test.ts', type: 'file', children: [] },
    ]
    renderInputBar({ fileNodes, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    expect(() => {
      fireEvent.change(textarea, { target: { value: '/' } })
      fireEvent.change(textarea, { target: { value: '@' } })
      fireEvent.change(textarea, { target: { value: '/' } })
      fireEvent.change(textarea, { target: { value: '' } })
    }).not.toThrow()
  })
})

// ─── Picker keyboard navigation edge cases ────────────────────────────────

describe('InputBar — picker keyboard navigation edge cases', () => {
  it('Enter on filtered command dispatches via send button', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Filter to /help
    fireEvent.change(textarea, { target: { value: '/help' } })
    // /help appears as picker button
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    const helpBtns = Array.from(pickerBtns).filter(b => b.textContent?.includes('/help'))
    expect(helpBtns.length).toBeGreaterThanOrEqual(1)

    // Send via send button — dispatches onCommand
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('help', '')
  })

  it('Tab on filtered plugin command inserts command name', () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [
        { name: 'deploy', description: 'Deploy', argumentHint: '--env', prompt: 'Deploy {{args}}' },
      ],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.getByText('/deploy')).toBeInTheDocument()

    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toContain('/deploy')
  })

  it('ArrowUp from first item stays at first', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/' } })
    const modelBtn = screen.getByText('/model').closest('button')!
    expect(modelBtn).toHaveClass('bg-accent')

    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(modelBtn).toHaveClass('bg-accent')
  })

  it('ArrowDown from last item stays at last', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/' } })

    // Navigate to /help (last builtin at index 59)
    for (let i = 0; i < 59; i++) {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    }
    const helpBtn = screen.getByText('/help').closest('button')!
    expect(helpBtn).toHaveClass('bg-accent')

    // One more stays at last
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(helpBtn).toHaveClass('bg-accent')
  })
})

// ─── Skill attachment edge cases ──────────────────────────────────────────

describe('InputBar — skill attachment edge cases', () => {
  it('duplicate skill selection is ignored', () => {
    const skill = { name: 'test-skill', description: 'A skill', content: 'content' }
    renderInputBar({ pluginSkills: [skill], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Select skill once
    fireEvent.change(textarea, { target: { value: '/test-skill' } })
    // Find the skill in the picker popover
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    const skillBtn = Array.from(pickerBtns).find(b => b.textContent?.includes('/test-skill'))
    fireEvent.mouseDown(skillBtn!)
    expect(screen.getByText('test-skill')).toBeInTheDocument()

    // Try to select same skill again
    fireEvent.change(textarea, { target: { value: '/test-skill' } })
    const pickerBtns2 = document.querySelectorAll('[class*="popover"] button')
    const skillBtn2 = Array.from(pickerBtns2).find(b => b.textContent?.includes('/test-skill'))
    if (skillBtn2) {
      fireEvent.mouseDown(skillBtn2)
    }

    // Only one skill chip 'skill' label should exist
    const skillLabels = screen.getAllByText('skill')
    expect(skillLabels.length).toBe(1)
  })

  it('empty skill content is handled gracefully', () => {
    const skill = { name: 'empty-skill', description: 'Empty', content: '' }
    const onSend = vi.fn()
    renderInputBar({ onSend, pluginSkills: [skill], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/empty-skill' } })
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    const skillBtn = Array.from(pickerBtns).find(b => b.textContent?.includes('/empty-skill'))
    fireEvent.mouseDown(skillBtn!)

    fireEvent.change(textarea, { target: { value: 'my question' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)

    expect(onSend).toHaveBeenCalled()
  })
})

// ─── Plugin command template expansion edge cases ─────────────────────────

describe('InputBar — plugin command template expansion', () => {
  it('template with both {{args}} and $ARGUMENTS', () => {
    const onSend = vi.fn()
    const pluginCommands = [
      { name: 'run', description: 'Run', prompt: 'Run {{args}} using $ARGUMENTS' },
    ]
    renderInputBar({ onSend, pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/run test.js' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)

    expect(onSend).toHaveBeenCalledWith(
      'Run test.js using test.js',
      [],
      undefined,
    )
  })

  it('template with no placeholders sends raw', () => {
    const onSend = vi.fn()
    const pluginCommands = [
      { name: 'ping', description: 'Ping', prompt: 'PONG!' },
    ]
    renderInputBar({ onSend, pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/ping' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)

    expect(onSend).toHaveBeenCalledWith('PONG!', [], undefined)
  })

  it('plugin command with args inserts /name for user to type', () => {
    renderInputBar({
      pluginSkills: [],
      pluginCommands: [
        { name: 'deploy', description: 'Deploy', argumentHint: '--env', prompt: 'Deploy {{args}}' },
      ],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '/deploy' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toContain('/deploy')
    expect(textarea.value).toContain(' ')
  })
})

// ─── Emoji autocomplete edge cases ────────────────────────────────────────

describe('InputBar — emoji autocomplete edge cases', () => {
  it('colon at start shows emoji picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':heart' } })
    expect(screen.getByText('❤️')).toBeInTheDocument()
  })

  it('colon anywhere triggers emoji picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello:heart' } })
    expect(screen.getByText('❤️')).toBeInTheDocument()
  })

  it('colon with no emoji matches shows nothing', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':zzzzz' } })
    expect(screen.queryByText('❤️')).not.toBeInTheDocument()
  })
})
