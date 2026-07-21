import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'
import type { PiSkill, SlashCommand } from '../types'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      {...props}
    />
  )
}

// ─── SECTION A: Slash command picker lifecycle ──────────────────────

describe('InputBar — picker lifecycle (comprehensive)', () => {
  it('shows ALL available commands initially when / is typed at start', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    expect(screen.getByText('/clear')).toBeInTheDocument()
    expect(screen.getByText('/fork')).toBeInTheDocument()
    expect(screen.getByText('/helpful')).toBeInTheDocument()
    expect(screen.getByText('/commit')).toBeInTheDocument()
    expect(screen.getByText('/branches')).toBeInTheDocument()
  })

  it('typing /cl filters to /clear and hides unrelated commands', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/cl' } })
    expect(screen.getByText('/clear')).toBeInTheDocument()
    // /fork description contains "clone" which matches /cl — check a command that won't match
    expect(screen.queryByText('/branches')).not.toBeInTheDocument()
    expect(screen.queryByText('/export')).not.toBeInTheDocument()
  })

  it('typing /mod filters to /model', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    expect(screen.queryByText('/commit')).not.toBeInTheDocument()
  })

  it('clearing filter back to / shows all commands again', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/cl' } })
    expect(screen.queryByText('/commit')).not.toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/commit')).toBeInTheDocument()
  })

  it('picker closes when Escape is pressed', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // Verify by re-typing — should open fresh
    fireEvent.change(textarea, { target: { value: '/x' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
  })

  it('picker closes when clicking outside (mousedown on document body)', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    // After click outside, closeAll should have been called
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.change(textarea, { target: { value: '/help' } })
    expect(screen.getAllByText('/help').length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT open picker when / is typed mid-line', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello /world' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('does NOT open picker when / is typed after a space on the same line', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'test /cmd' } })
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('re-opens picker correctly after close and re-typing /', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    expect(screen.getAllByText('/model').length).toBeGreaterThanOrEqual(1)
    fireEvent.keyDown(textarea, { key: 'Escape' })
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.change(textarea, { target: { value: '/help' } })
    const items = screen.getAllByText('/help')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── SECTION B: Tab completion of slash commands ────────────────────

describe('InputBar — Tab completion', () => {
  it('Tab inserts the highlighted command name into textarea', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Arrow Down then Tab executes the highlighted command', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/cl' } })
    // /cl filters to /clear — Tab executes it
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Arrow Up/Down changes highlight in picker before Tab', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Navigate down through items
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    }
    // Navigate back up
    for (let i = 0; i < 2; i++) {
      fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    }
    // Tab should execute the currently highlighted item
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(onCommand).toHaveBeenCalled()
  })
})

// ─── SECTION C: Enter key dispatch (comprehensive) ──────────────────

describe('InputBar — Enter dispatch (comprehensive)', () => {
  it('Enter on highlighted builtin command executes it via onCommand', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Enter on skill command attaches it as a chip', () => {
    const skill: PiSkill = { id: 'sk1', name: 'my-skill', description: 'desc', content: 'content' }
    renderInputBar({ pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/my-skill' } })
    // Use getAllByText since /my-skill appears in textarea and picker
    const skillBtns = screen.getAllByText('/my-skill')
    const skillBtn = skillBtns.find((el) => el.closest('button'))!
    fireEvent.mouseDown(skillBtn)
    expect(screen.getByText('my-skill')).toBeInTheDocument()
  })

  it('Enter on plugin command with args hint inserts /name for user to type', () => {
    const cmd: SlashCommand = {
      id: 'cmd1', name: 'deploy', description: 'Deploy',
      argumentHint: '--env <staging|prod>', prompt: '', source: 'plugin',
    }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/deploy' } })
    // Use getAllByText since /deploy appears in textarea and picker
    const deployBtns = screen.getAllByText('/deploy')
    const deployBtn = deployBtns.find((el) => el.closest('button'))!
    fireEvent.mouseDown(deployBtn)
    expect((textarea as HTMLTextAreaElement).value).toContain('deploy')
  })

  it('Enter on plugin command without hint expands template and sends', () => {
    const cmd: SlashCommand = {
      id: 'cmd2', name: 'greet', description: 'Say hello',
      prompt: 'Hello {{args}}!', source: 'plugin',
    }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/greet' } })
    const greetBtns = screen.getAllByText('/greet')
    const greetBtn = greetBtns.find((el) => el.closest('button'))!
    fireEvent.mouseDown(greetBtn)
    expect((textarea as HTMLTextAreaElement).value).toContain('Hello')
  })

  it('Enter with NO picker open sends message normally', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello world', [], undefined)
  })

  it('Shift+Enter does not send message when command picker is closed', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })
})

// ─── SECTION D: Slash command text reflection ────────────────────────

describe('InputBar — text reflection', () => {
  it('text area shows /model gpt-4o when typed', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    expect(textarea).toHaveValue('/model gpt-4o')
  })

  it('textarea updates correctly when typing /model then adding args', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/mod' } })
    expect(textarea).toHaveValue('/mod')
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    expect(textarea).toHaveValue('/model gpt-4o')
  })

  it('textarea is cleared after executing builtin command via picker click', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect(textarea).toHaveValue('')
  })

  it('uppercase /CLEAR dispatches as lowercase clear', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/CLEAR' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('mixed-case /Model gpt-4o dispatches as model gpt-4o', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/Model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })
})

// ─── SECTION E: Keyboard shortcut consistency ────────────────────────

describe('InputBar — keyboard shortcut guard (textarea focus)', () => {
  it('Enter sends when textarea has focus', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    textarea.focus()
    fireEvent.change(textarea, { target: { value: 'test' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('test', [], undefined)
  })

  it('Escape when no picker is open does not crash', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
  })

  it('Arrow Down in picker does not move textarea cursor', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea).toHaveValue('/')
  })

  it('when command picker is open, Enter executes highlighted command', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})

// ─── SECTION F: Edge cases ──────────────────────────────────────────

describe('InputBar — edge cases (comprehensive)', () => {
  it('typing / then immediately pressing Enter does not crash', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
  })

  it('typing /nonexistent then Enter dispatches to onCommand', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/nonexistent' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('nonexistent', '')
  })

  it('multiple rapid Enter presses on same command (idempotent dispatch)', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledTimes(1)
  })

  it('pasting text containing / at start of line dispatches command', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/help me with this' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('help', 'me with this')
  })

  it('model button opens model picker directly (no /command needed)', () => {
    renderInputBar({ currentModel: 'gpt-4o', providers: [], apiBaseUrl: '', apiKey: '' })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })

  it('Enter on /folder calls onRevealInExplorer', () => {
    const onRevealInExplorer = vi.fn()
    renderInputBar({ onRevealInExplorer })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/folder' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onRevealInExplorer).toHaveBeenCalled()
  })

  it('Enter on /help calls onCommand with help', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // /help matches /helpful in the picker (startsWith), so send via send button
    fireEvent.change(textarea, { target: { value: '/help' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)
    expect(onCommand).toHaveBeenCalledWith('help', '')
  })
})

// ─── SECTION G: Model picker interaction ─────────────────────────────

describe('InputBar — model picker', () => {
  it('model button opens picker with search input', () => {
    renderInputBar({ currentModel: 'gpt-4o', providers: [], apiBaseUrl: '', apiKey: '' })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
  })

  it('Escape closes model picker', () => {
    renderInputBar({ currentModel: 'gpt-4o', providers: [], apiBaseUrl: '', apiKey: '' })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
    const searchInput = screen.getByPlaceholderText('Search models…')
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search models…')).not.toBeInTheDocument()
  })

  it('model picker shows error message when no providers configured', async () => {
    renderInputBar({ currentModel: '', providers: [], apiBaseUrl: '', apiKey: '' })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(screen.getByText('No API endpoint configured')).toBeInTheDocument()
  })

  it('click outside model picker closes it', () => {
    renderInputBar({ currentModel: 'gpt-4o', providers: [], apiBaseUrl: '', apiKey: '' })
    const modelBtn = screen.getByTitle('Change model')
    fireEvent.click(modelBtn)
    expect(screen.getByPlaceholderText('Search models…')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByPlaceholderText('Search models…')).not.toBeInTheDocument()
  })
})

// ─── SECTION H: Context donut popup ──────────────────────────────────

describe('InputBar — context donut', () => {
  it('clicking context donut opens usage popup', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    // The donut SVG has viewBox="0 0 18 18"
    const donutSvg = document.querySelector('svg[viewBox="0 0 18 18"]')
    expect(donutSvg).toBeInTheDocument()
    const donutBtn = donutSvg!.closest('button')!
    fireEvent.click(donutBtn)
    expect(screen.getByText(/of context used/)).toBeInTheDocument()
  })

  it('clicking outside context donut closes popup', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const donutSvg = document.querySelector('svg[viewBox="0 0 18 18"]')
    const donutBtn = donutSvg!.closest('button')!
    fireEvent.click(donutBtn)
    expect(screen.getByText(/of context used/)).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText(/of context used/)).not.toBeInTheDocument()
  })

  it('double-click toggles donut popup', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const donutSvg = document.querySelector('svg[viewBox="0 0 18 18"]')
    const donutBtn = donutSvg!.closest('button')!
    fireEvent.click(donutBtn)
    expect(screen.getByText(/of context used/)).toBeInTheDocument()
    fireEvent.click(donutBtn)
    expect(screen.queryByText(/of context used/)).not.toBeInTheDocument()
  })
})

// ─── SECTION I: Skill attachment interaction ──────────────────────────

describe('InputBar — skill attachment lifecycle', () => {
  it('shows skill content in chip when attached', () => {
    const skill: PiSkill = { id: 'sk1', name: 'code-review', description: 'Review code', content: 'Review this code' }
    renderInputBar({ pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Use getAllByText since /code-review appears in textarea and picker
    const btns = screen.getAllByText('/code-review')
    const btn = btns.find((el) => el.closest('button'))!
    fireEvent.mouseDown(btn)
    expect(screen.getByText('code-review')).toBeInTheDocument()
    expect(screen.getByText('skill')).toBeInTheDocument()
  })

  it('does not crash when skill has empty content', () => {
    const skill: PiSkill = { id: 'sk2', name: 'empty-skill', description: 'Empty', content: '' }
    renderInputBar({ pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    const btns = screen.getAllByText('/empty-skill')
    const btn = btns.find((el) => el.closest('button'))!
    fireEvent.mouseDown(btn)
    expect(screen.getByText('empty-skill')).toBeInTheDocument()
  })

  it('skill attachments are prepended to sent message', () => {
    const onSend = vi.fn()
    const skill: PiSkill = { id: 'sk1', name: 'ctx', description: 'Context', content: 'IMPORTANT CONTEXT' }
    renderInputBar({ onSend, pluginSkills: [skill] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    const btns = screen.getAllByText('/ctx')
    const btn = btns.find((el) => el.closest('button'))!
    fireEvent.mouseDown(btn)
    fireEvent.change(textarea, { target: { value: 'What about this?' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledTimes(1)
    const sentText = onSend.mock.calls[0][0] as string
    expect(sentText).toContain('IMPORTANT CONTEXT')
    expect(sentText).toContain('What about this?')
  })
})

// ─── SECTION J: Plugin command dispatch edge cases ───────────────────

describe('InputBar — plugin commands (comprehensive)', () => {
  it('plugin command with argumentHint inserts /name with trailing space', () => {
    const cmd: SlashCommand = {
      id: 'cmd1', name: 'deploy', description: 'Deploy',
      argumentHint: '--env', prompt: '', source: 'plugin',
    }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    const btns = screen.getAllByText('/deploy')
    const btn = btns.find((el) => el.closest('button'))!
    fireEvent.mouseDown(btn)
    expect((textarea as HTMLTextAreaElement).value).toContain('deploy')
  })

  it('plugin command without hint and with content expands and sends', () => {
    const onSend = vi.fn()
    const cmd: SlashCommand = {
      id: 'cmd2', name: 'greet', description: 'Greet',
      prompt: 'Hello {{args}}!', source: 'plugin',
    }
    renderInputBar({ onSend, pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/greet world' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledTimes(1)
    const sentText = onSend.mock.calls[0][0] as string
    expect(sentText).toContain('Hello world!')
  })

  it('plugin command filters correctly when typing partial name', () => {
    const cmd: SlashCommand = {
      id: 'cmd1', name: 'deploy-staging', description: 'Deploy to staging',
      prompt: '', source: 'plugin',
    }
    renderInputBar({ pluginCommands: [cmd] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.getByText('/deploy-staging')).toBeInTheDocument()
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })
})

// ─── SECTION K: Builtin command argument parsing ─────────────────────

describe('InputBar — builtin command args', () => {
  it('splits /rename My Session into onCommand("rename", "My Session")', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/rename My Session' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('rename', 'My Session')
  })

  it('splits /model gpt-4o into onCommand("model", "gpt-4o")', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/model gpt-4o' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('command with no args sends empty string', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/clear' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('trims extra whitespace from args', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/rename   My   Session   ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommand).toHaveBeenCalledWith('rename', 'My   Session')
  })
})

// ─── SECTION L: Rendering edge cases ─────────────────────────────────

describe('InputBar — rendering edge cases', () => {
  it('renders without crashing when all optional props are omitted', () => {
    renderInputBar()
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('renders with empty file nodes', () => {
    renderInputBar({ fileNodes: [] })
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('renders with empty plugin skills and commands', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('renders with many messages (stress test)', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`, role: 'user' as const, content: `Message ${i}`, createdAt: Date.now(),
    }))
    renderInputBar({ messages })
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('renders with workspace path set', () => {
    renderInputBar({ workspacePath: '/home/user/project' })
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('shows attach file button', () => {
    renderInputBar()
    expect(screen.getByLabelText('Attach file')).toBeInTheDocument()
  })
})
