import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar, BUILTIN_COMMANDS } from '../components/InputBar'
import { useAppStore } from '../store/useAppStore'
import type { SlashCommand, Message } from '../types'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

// ─── Helper to build fake messages of a given total char length ────────────
function makeMessages(totalChars: number): Message[] {
  if (totalChars === 0) return []
  return [{ id: 'm1', sessionId: 's1', role: 'user', content: 'x'.repeat(totalChars), createdAt: Date.now() }]
}

// ─── Helper: find the ContextDonut button (has an SVG with stroke-dasharray circle) ──
function findDonutButton(): HTMLButtonElement | null {
  const buttons = document.querySelectorAll('button')
  return Array.from(buttons).find((btn) =>
    btn.querySelector('svg circle[stroke-dasharray]') !== null,
  ) ?? null
}

// ─── SECTION 1: expandTemplate with $ARGUMENTS ─────────────────────────────

describe('InputBar — expandTemplate with $ARGUMENTS', () => {
  it('expands $ARGUMENTS placeholder with typed args', () => {
    const onSend = vi.fn()
    const cmd: SlashCommand = {
      id: 'c1', name: 'deploy', description: 'Deploy to env',
      prompt: 'Deploy the app to $ARGUMENTS environment now',
      source: 'plugin',
    }
    renderInputBar({ onSend, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Typing a space after /deploy closes the picker — then Enter calls handleSend
    fireEvent.change(textarea, { target: { value: '/deploy prod' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith(
      'Deploy the app to prod environment now',
      [],
      undefined,
    )
  })

  it('expands {{args}} placeholder (case-insensitive)', () => {
    const onSend = vi.fn()
    const cmd: SlashCommand = {
      id: 'c2', name: 'greet', description: 'Say hello',
      prompt: 'Hello {{args}}!',
      source: 'plugin',
    }
    renderInputBar({ onSend, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/greet world' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Hello world!', [], undefined)
  })

  it('expands {{Args}} (uppercase) via case-insensitive match', () => {
    const onSend = vi.fn()
    const cmd: SlashCommand = {
      id: 'c2b', name: 'shout', description: 'Shout',
      prompt: 'SHOUT: {{ARGS}}',
      source: 'plugin',
    }
    renderInputBar({ onSend, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/shout hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('SHOUT: hello', [], undefined)
  })

  it('expands both {{args}} and $ARGUMENTS in the same template', () => {
    const onSend = vi.fn()
    const cmd: SlashCommand = {
      id: 'c3', name: 'mixed', description: 'Mixed template',
      prompt: 'Deploy {{args}} to $ARGUMENTS',
      source: 'plugin',
    }
    renderInputBar({ onSend, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mixed staging' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Deploy staging to staging', [], undefined)
  })

  it('expands template with empty args when no args provided (space closes picker)', () => {
    const onSend = vi.fn()
    const cmd: SlashCommand = {
      id: 'c4', name: 'explain', description: 'Explain',
      prompt: 'Explain $ARGUMENTS in detail',
      source: 'plugin',
    }
    renderInputBar({ onSend, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Typing a trailing space after /explain closes the picker
    fireEvent.change(textarea, { target: { value: '/explain ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Explain  in detail', [], undefined)
  })
})

// ─── SECTION 2: Plugin command template expansion via handleSend ────────────

describe('InputBar — plugin command template expansion via handleSend', () => {
  it('expands template and sends via onSend, NOT onCommand', () => {
    const onSend = vi.fn()
    const onCommand = vi.fn()
    const cmd: SlashCommand = {
      id: 'c5', name: 'explain', description: 'Explain code',
      prompt: 'Explain the following in detail: $ARGUMENTS',
      source: 'plugin',
    }
    renderInputBar({ onSend, onCommand, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Space after /explain closes picker, then Enter calls handleSend
    fireEvent.change(textarea, { target: { value: '/explain what is this' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith(
      'Explain the following in detail: what is this',
      [],
      undefined,
    )
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('plugin command with no args expands to template with empty string', () => {
    const onSend = vi.fn()
    const cmd: SlashCommand = {
      id: 'c6', name: 'review', description: 'Code review',
      prompt: 'Review: {{args}}',
      source: 'plugin',
    }
    renderInputBar({ onSend, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Trailing space closes the picker so handleSend is called
    fireEvent.change(textarea, { target: { value: '/review ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Review: ', [], undefined)
  })

  it('builtin command still calls onCommand (not onSend) via picker Enter', () => {
    const onSend = vi.fn()
    const onCommand = vi.fn()
    renderInputBar({ onSend, onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('builtin command with args passes args to onCommand', () => {
    const onSend = vi.fn()
    const onCommand = vi.fn()
    renderInputBar({ onSend, onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Space after /model closes the picker
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
    expect(onSend).not.toHaveBeenCalled()
  })
})

// ─── SECTION 3: Prompt history full cycle ───────────────────────────────────

describe('InputBar — prompt history full cycle', () => {
  beforeEach(() => {
    useAppStore.setState({ promptHistory: [], promptHistoryIdx: -1 })
  })

  it('ArrowUp on empty textarea recalls previous prompt from history', () => {
    useAppStore.setState({
      promptHistory: ['first prompt', 'second prompt'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    expect(textarea).toHaveValue('')

    // Press ArrowUp — should recall 'first prompt' (idx goes from -1 → 0)
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('first prompt')
  })

  it('after recalling, ArrowUp does not trigger again (text is non-empty)', () => {
    useAppStore.setState({
      promptHistory: ['first', 'second', 'third'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Recall first prompt
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('first')

    // ArrowUp should NOT change text because textarea is now non-empty
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('first')
  })

  it('ArrowDown on empty textarea returns empty string (no-op)', () => {
    useAppStore.setState({
      promptHistory: ['first', 'second'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // ArrowDown when idx is -1 keeps idx at -1, returns ''
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('')
  })

  it('clearing recalled text and pressing ArrowUp re-recalls from history', () => {
    useAppStore.setState({
      promptHistory: ['first prompt'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Recall first prompt
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('first prompt')

    // Clear text (this resets promptHistoryIdx to -1 via handleChange)
    fireEvent.change(textarea, { target: { value: '' } })

    // ArrowUp should recall again from the start
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('first prompt')
  })

  it('ArrowUp does NOT trigger history when textarea has non-empty text', () => {
    useAppStore.setState({
      promptHistory: ['old prompt'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'current text' } })

    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea).toHaveValue('current text')
  })

  it('ArrowDown does NOT trigger history when textarea has non-empty text', () => {
    useAppStore.setState({
      promptHistory: ['old prompt'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'current text' } })

    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('current text')
  })

  it('ArrowUp does NOT trigger history when command picker is open', () => {
    useAppStore.setState({
      promptHistory: ['recalled'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Open picker
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    // ArrowUp navigates picker highlight, not prompt history
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(screen.getByText('/model')).toBeInTheDocument()
  })

  it('ArrowDown does NOT trigger history when command picker is open', () => {
    useAppStore.setState({
      promptHistory: ['recalled'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(screen.getByText('/model')).toBeInTheDocument()
  })

  it('Arrow keys do NOT trigger history when mention picker is open', () => {
    useAppStore.setState({
      promptHistory: ['recalled'],
      promptHistoryIdx: -1,
    })
    renderInputBar({
      fileNodes: [{ name: 'test.ts', path: '/test.ts', type: 'file', children: [] }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Open mention picker
    fireEvent.change(textarea, { target: { value: '@' } })

    // ArrowUp should navigate mention highlight, not prompt history
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(screen.getByText('test.ts')).toBeInTheDocument()
  })

  it('Arrow keys do NOT trigger history when emoji picker is open', () => {
    useAppStore.setState({
      promptHistory: ['recalled'],
      promptHistoryIdx: -1,
    })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Open emoji picker with : prefix
    fireEvent.change(textarea, { target: { value: ':heart' } })

    // ArrowUp should navigate emoji highlight, not prompt history
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    // Emoji picker should still be visible
    expect(screen.getByText(':heart:')).toBeInTheDocument()
  })
})

// ─── SECTION 4: addPromptToHistory called on send ──────────────────────────

describe('InputBar — addPromptToHistory called on send', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    useAppStore.setState({ promptHistory: [], promptHistoryIdx: -1 })
    spy = vi.spyOn(useAppStore.getState(), 'addPromptToHistory' as any)
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('calls addPromptToHistory with the original text when sending a regular message', () => {
    renderInputBar({ onSend: vi.fn() })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'my prompt' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(spy).toHaveBeenCalledWith('my prompt')
  })

  it('calls addPromptToHistory for slash builtin commands via handleSend', () => {
    // Type /clear<space> to close the picker, then Enter triggers handleSend
    renderInputBar({ onSend: vi.fn(), onCommand: vi.fn() })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    // addPromptToHistory receives the raw typed text (with trailing space)
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls[0][0]).toBe('/clear ')
  })

  it('calls addPromptToHistory for plugin commands (the original typed text)', () => {
    const cmd: SlashCommand = {
      id: 'c7', name: 'explain', description: 'Explain',
      prompt: 'Explain: $ARGUMENTS', source: 'plugin',
    }
    renderInputBar({ onSend: vi.fn(), pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/explain foo bar' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    // addPromptToHistory receives the raw typed text, not the expanded template
    expect(spy).toHaveBeenCalledWith('/explain foo bar')
  })

  it('does NOT call addPromptToHistory with empty text', () => {
    renderInputBar({ onSend: vi.fn() })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(spy).not.toHaveBeenCalled()
  })
})

// ─── SECTION 5: Builtin command count ───────────────────────────────────────

describe('InputBar — BUILTIN_COMMANDS count', () => {
  it('exports the correct number of builtin commands', () => {
    expect(BUILTIN_COMMANDS.length).toBe(32)
  })

  it('picker shows all builtin commands when / is typed with no filter', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })

    // Verify every builtin command name is visible in the picker
    for (const cmd of BUILTIN_COMMANDS) {
      const items = screen.getAllByText(`/${cmd.name}`)
      expect(items.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('all builtin commands have required fields', () => {
    for (const cmd of BUILTIN_COMMANDS) {
      expect(cmd.kind).toBe('builtin')
      expect(cmd.name).toBeTruthy()
      expect(cmd.description).toBeTruthy()
    }
  })

  it('all builtin command names are unique', () => {
    const names = BUILTIN_COMMANDS.map((c) => c.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })
})

// ─── SECTION 6: Context donut color thresholds ─────────────────────────────

describe('InputBar — ContextDonut color thresholds', () => {
  it('shows muted color when usage is below 50%', () => {
    // gpt-4 → contextWindow = 8192
    // 250 tokens used → ~3% → below 50%
    const messages = makeMessages(1000) // 1000 chars → ceil(1000/4)=250 tokens
    renderInputBar({ messages, currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    expect(donutBtn).not.toBeNull()
    expect(donutBtn!.className).toContain('text-muted-foreground')
    expect(donutBtn!.className).not.toContain('text-amber-400')
    expect(donutBtn!.className).not.toContain('text-destructive')
  })

  it('shows amber color when usage is between 50% and 80%', () => {
    // gpt-4 → contextWindow = 8192
    // 55% → need used > 4096 → need chars > 4096*4 = 16384
    const messages = makeMessages(18024) // ceil(18024/4)=4506 → 4506/8192=55%
    renderInputBar({ messages, currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    expect(donutBtn).not.toBeNull()
    expect(donutBtn!.className).toContain('text-amber-400')
    expect(donutBtn!.className).not.toContain('text-destructive')
    expect(donutBtn!.className).not.toContain('text-muted-foreground')
  })

  it('shows destructive color when usage exceeds 80%', () => {
    // gpt-4 → contextWindow = 8192
    // 85% → need used > 6553 → need chars > 6553*4 = 26212
    const messages = makeMessages(27852) // ceil(27852/4)=6963 → 6963/8192=85%
    renderInputBar({ messages, currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    expect(donutBtn).not.toBeNull()
    expect(donutBtn!.className).toContain('text-destructive')
    expect(donutBtn!.className).not.toContain('text-amber-400')
    expect(donutBtn!.className).not.toContain('text-muted-foreground')
  })

  it('shows muted color at exactly 0% usage (no messages)', () => {
    renderInputBar({ messages: [], currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    expect(donutBtn).not.toBeNull()
    expect(donutBtn!.className).toContain('text-muted-foreground')
  })

  it('clicking the donut opens a popup showing usage percentage', () => {
    // gpt-4 → contextWindow = 8192
    const messages = makeMessages(4000) // ceil(4000/4)=1000 → 1000/8192=12%
    renderInputBar({ messages, currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    expect(donutBtn).not.toBeNull()

    fireEvent.click(donutBtn!)

    expect(screen.getByText(/12% of context used/)).toBeInTheDocument()
  })
})

// ─── SECTION 7: fmtTokens formatting ───────────────────────────────────────

describe('InputBar — fmtTokens via ContextDonut popup', () => {
  it('shows number as-is when tokens < 1000', () => {
    // gpt-4 → contextWindow = 8192
    // No messages → used=0 → fmtTokens(0) = "0"
    renderInputBar({ messages: [], currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    fireEvent.click(donutBtn!)

    // Used tokens = 0 → "0", total = 8192 → "8.2k"
    expect(screen.getByText('0 / 8.2k')).toBeInTheDocument()
  })

  it('shows "Xk" when tokens >= 1000 and < 1000000', () => {
    // gpt-4 → contextWindow = 8192 → fmtTokens(8192) = "8.2k"
    const messages = makeMessages(8000) // ceil(8000/4)=2000 → fmtTokens(2000) = "2k"
    renderInputBar({ messages, currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    fireEvent.click(donutBtn!)

    expect(screen.getByText('2k / 8.2k')).toBeInTheDocument()
  })

  it('formats large token counts with "k" suffix correctly', () => {
    // claude → contextWindow = 200000 → fmtTokens(200000) = "200k"
    renderInputBar({ messages: [], currentModel: 'claude-3-opus' })

    const donutBtn = findDonutButton()
    fireEvent.click(donutBtn!)

    expect(screen.getByText('0 / 200k')).toBeInTheDocument()
  })

  it('formats mid-range values correctly (e.g., 3.1k)', () => {
    // gpt-4 → contextWindow = 8192
    const messages = makeMessages(12500) // ceil(12500/4)=3125 → fmtTokens(3125) = "3.1k"
    renderInputBar({ messages, currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    fireEvent.click(donutBtn!)

    expect(screen.getByText('3.1k / 8.2k')).toBeInTheDocument()
  })

  it('formats the "M" suffix for values >= 1,000,000', () => {
    // To hit the >= 1M branch for "used": need ceil(content.length/4) >= 1_000_000
    // → content length >= 4_000_000
    // fmtTokens(1000001) = Math.round(1000001/100000)/10 = Math.round(10.00001)/10 = 10/10 = 1 → "1M"
    const longContent = 'x'.repeat(4_000_004)
    const messages: Message[] = [
      { id: 'm1', sessionId: 's1', role: 'user', content: longContent, createdAt: Date.now() },
    ]
    renderInputBar({ messages, currentModel: 'gpt-4' })

    const donutBtn = findDonutButton()
    fireEvent.click(donutBtn!)

    // used=ceil(4000004/4)=1000001 → "1M", total=8192 → "8.2k"
    expect(screen.getByText('1M / 8.2k')).toBeInTheDocument()
  })
})
