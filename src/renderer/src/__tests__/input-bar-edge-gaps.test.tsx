import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputBar } from '../components/InputBar'
import { useAppStore } from '../store/useAppStore'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderBar(props: Record<string, unknown> = {}) {
  const defaults = {
    onSend: vi.fn(),
    onCommand: vi.fn(),
    placeholder: PLACEHOLDER,
    messages: [],
    effort: 'medium',
    onEffortChange: vi.fn(),
    permissionMode: 'ask' as const,
    onPermissionModeChange: vi.fn(),
    agentMode: 'agent' as const,
    onAgentModeChange: vi.fn(),
    colorMode: 'dark' as const,
    onToggleColorMode: vi.fn(),
    replyTo: null,
    onCancelReply: vi.fn(),
    recentProjects: [],
    onSelectProject: vi.fn(),
    onOpenFinder: vi.fn(),
    pluginSkills: [],
    pluginCommands: [],
    providers: [],
    ...props,
  }
  return render(<InputBar {...defaults} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ promptHistory: [], promptHistoryIdx: -1 })
})

/** Type a slash command and click the Send button to dispatch via handleSend */
function typeAndSend(text: string) {
  const textarea = screen.getByPlaceholderText(PLACEHOLDER)
  fireEvent.change(textarea, { target: { value: text } })
  const sendBtn = screen.getByLabelText('Send message')
  fireEvent.click(sendBtn)
}

// ─── Group 1: Highlight reset on filter change ──────────────────────────────

describe('Group 1 – Highlight reset on filter change', () => {
  it('highlight resets to index 0 when filter narrows then broadens', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)

    // Helper: find the picker button that contains a given text
    const pickerBtn = (text: string) =>
      screen.getAllByText(text).find((el) => el.closest('button'))!.closest('button')!

    // Type '/clear' → picker opens, /clear is first (and only) match, highlighted
    fireEvent.change(ta, { target: { value: '/clear' } })
    expect(pickerBtn('/clear')).toHaveClass('bg-accent')

    // Narrow to '/cl' → still only /clear, highlight stays at 0
    fireEvent.change(ta, { target: { value: '/cl' } })
    expect(pickerBtn('/clear')).toHaveClass('bg-accent')

    // Broaden back to '/' → all commands, highlight at 0 = /model
    fireEvent.change(ta, { target: { value: '/' } })
    expect(pickerBtn('/model')).toHaveClass('bg-accent')
  })
})

// ─── Group 2: Disabled state guards ─────────────────────────────────────────

describe('Group 2 – Disabled state guards', () => {
  it('renders disabled textarea with stop button instead of send', () => {
    renderBar({ disabled: true, onCancel: vi.fn() })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    expect(ta).toBeDisabled()
    expect(screen.getByLabelText('Stop generation (Ctrl+C)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument()
  })

  it('typing in disabled textarea does not crash', () => {
    renderBar({ disabled: true, onCancel: vi.fn() })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    expect(() => {
      fireEvent.change(ta, { target: { value: 'hello' } })
    }).not.toThrow()
    expect(ta).toBeDisabled()
  })

  it('Enter when disabled does not call onSend', () => {
    const onSend = vi.fn()
    renderBar({ disabled: true, onCancel: vi.fn(), onSend })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('Shift+Enter when disabled does not crash', () => {
    const onSend = vi.fn()
    renderBar({ disabled: true, onCancel: vi.fn(), onSend })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    expect(() => {
      fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    }).not.toThrow()
    expect(onSend).not.toHaveBeenCalled()
  })
})

// ─── Group 3: Enter dispatch for additional builtin commands ─────────────────
// We use the send button (which calls handleSend) because when the picker is
// open the Enter key is intercepted by executeCommand, which only handles a
// subset of builtins. handleSend dispatches ALL /commands via onCommand.

describe('Group 3 – Builtin command dispatch via handleSend', () => {
  const commands = [
    'usage', 'changes', 'export', 'shortcuts', 'compact', 'overview',
    'rename', 'pin', 'branches', 'stage', 'debug', 'history', 'log',
    'diff', 'stash', 'recent', 'exec', 'rerun', 'fetch', 'filter',
    'sessions', 'sort', 'lint', 'fix', 'task', 'config', 'safe',
    'rewind', 'test', 'build', 'check', 'open', 'tree', 'help',
  ]

  it.each(commands)(
    '/%s dispatches onCommand("%s", "")',
    (cmd) => {
      const onCommand = vi.fn()
      renderBar({ onCommand })
      typeAndSend(`/${cmd}`)
      expect(onCommand).toHaveBeenCalledWith(cmd, '')
    },
  )
})

// ─── Group 4: Rapid mode switching ──────────────────────────────────────────

describe('Group 4 – Rapid mode switching', () => {
  it('switches from command picker to mention picker and back to command picker', () => {
    const fileNodes = [
      { name: 'test.ts', path: '/test.ts', type: 'file' as const, children: [] },
    ]
    renderBar({ fileNodes })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)

    // '/' → command picker
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    // Clear
    fireEvent.change(ta, { target: { value: '' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()

    // '@' → mention picker (not command picker)
    fireEvent.change(ta, { target: { value: '@' } })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
    expect(screen.queryByText('/model')).not.toBeInTheDocument()

    // Clear
    fireEvent.change(ta, { target: { value: '' } })
    expect(screen.queryByText('test.ts')).not.toBeInTheDocument()

    // '/' → command picker re-opens
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
  })

  it('switches from command picker to emoji picker', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)

    // '/' → command picker
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    // Clear
    fireEvent.change(ta, { target: { value: '' } })

    // ':f' → emoji picker (not command picker)
    fireEvent.change(ta, { target: { value: ':f' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    expect(screen.getByText(':fire:')).toBeInTheDocument()
  })
})

// ─── Group 5: ArrowDown/Up with empty filtered results ──────────────────────

describe('Group 5 – ArrowDown/Up with empty filtered results', () => {
  it('ArrowDown with no matching commands does not crash', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/xyz' } })
    expect(() => {
      fireEvent.keyDown(ta, { key: 'ArrowDown' })
    }).not.toThrow()
  })

  it('ArrowUp with no matching commands does not crash', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/xyz' } })
    expect(() => {
      fireEvent.keyDown(ta, { key: 'ArrowUp' })
    }).not.toThrow()
  })

  it('ArrowDown then ArrowUp with no matches keeps state consistent', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/xyz' } })
    fireEvent.keyDown(ta, { key: 'ArrowDown' })
    fireEvent.keyDown(ta, { key: 'ArrowUp' })
    // No crash — picker is still open (showCommands=true) but empty
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })
})

// ─── Group 6: Textarea value preservation ───────────────────────────────────

describe('Group 6 – Textarea value preservation', () => {
  it('plain text does not open any picker', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello world' } })
    expect(ta.value).toBe('hello world')
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('clicking Send clears the textarea', () => {
    const onSend = vi.fn()
    renderBar({ onSend })
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello world' } })
    fireEvent.click(screen.getByLabelText('Send message'))
    expect(onSend).toHaveBeenCalledWith('hello world', [], undefined)
    expect(ta.value).toBe('')
  })

  it('/clear with trailing space dispatches clear and clears textarea', () => {
    const onCommand = vi.fn()
    renderBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    // Trailing space → picker does NOT open (space in afterSlash)
    fireEvent.change(ta, { target: { value: '/clear ' } })
    // Picker is not open — /model is only in the picker, not in the textarea
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
    // Enter goes to handleSend → dispatches 'clear'
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect(ta.value).toBe('')
  })

  it('/model gpt-4o is preserved in the textarea', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '/model gpt-4o' } })
    expect(ta.value).toBe('/model gpt-4o')
  })
})

// ─── Group 7: Skill attachment via Enter key ────────────────────────────────

describe('Group 7 – Skill attachment via Enter key', () => {
  it('Enter on a skill attaches it as a chip without calling onCommand', () => {
    const onCommand = vi.fn()
    const pluginSkills = [
      { name: 'myskill', description: 'A test skill', content: 'skill content here' },
    ]
    renderBar({ onCommand, pluginSkills })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)

    // Type '/myskill' → picker opens with the skill
    fireEvent.change(ta, { target: { value: '/myskill' } })

    // Press Enter → executeCommand adds skill as chip
    fireEvent.keyDown(ta, { key: 'Enter' })

    // Skill chip is rendered
    expect(screen.getByText('myskill')).toBeInTheDocument()
    // onCommand is NOT called for skill attachment
    expect(onCommand).not.toHaveBeenCalled()
  })
})

// ─── Group 8: Emoji shortcode reflection ────────────────────────────────────

describe('Group 8 – Emoji shortcode reflection', () => {
  it(':fire shows fire option; clicking inserts 🔥', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    // Type ':fire' → emoji picker shows fire option
    fireEvent.change(ta, { target: { value: ':fire' } })
    expect(screen.getByText(':fire:')).toBeInTheDocument()

    // mouseDown on the fire button → inserts emoji
    const fireBtn = screen.getByText(':fire:').closest('button')!
    fireEvent.mouseDown(fireBtn)
    expect(ta.value).toBe('🔥')
  })

  it(':thumbsup shows thumbsup option; clicking inserts 👍', () => {
    renderBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    // Type ':thumbsup' → picker shows thumbsup
    fireEvent.change(ta, { target: { value: ':thumbsup' } })
    expect(screen.getByText(':thumbsup:')).toBeInTheDocument()

    // Select → textarea contains '👍'
    const btn = screen.getByText(':thumbsup:').closest('button')!
    fireEvent.mouseDown(btn)
    expect(ta.value).toBe('👍')
  })
})
