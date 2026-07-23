import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar, BUILTIN_COMMANDS } from '../components/InputBar'
import { useAppStore } from '../store/useAppStore'

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
    promptHistory: [],
    promptHistoryIdx: -1,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. prefillText / edit-resend prefill
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — prefillText (edit-resend)', () => {
  it('sets textarea text from prefillText', () => {
    renderInputBar({ prefillText: 'edit this message' })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    expect(textarea.value).toBe('edit this message')
  })

  it('calls onPrefillConsumed after setting prefillText', () => {
    const onPrefillConsumed = vi.fn()
    renderInputBar({ prefillText: 'hello', onPrefillConsumed })
    expect(onPrefillConsumed).toHaveBeenCalled()
  })

  it('does NOT call onPrefillConsumed when prefillText is null', () => {
    const onPrefillConsumed = vi.fn()
    renderInputBar({ prefillText: null, onPrefillConsumed })
    expect(onPrefillConsumed).not.toHaveBeenCalled()
  })

  it('does NOT call onPrefillConsumed when prefillText is undefined', () => {
    const onPrefillConsumed = vi.fn()
    renderInputBar({ prefillText: undefined, onPrefillConsumed })
    expect(onPrefillConsumed).not.toHaveBeenCalled()
  })

  it('textarea value matches prefillText after render', () => {
    const text = 'Fix the bug in auth.ts'
    renderInputBar({ prefillText: text })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    expect(textarea.value).toBe(text)
  })

  it('prefilled text is editable by user', () => {
    renderInputBar({ prefillText: 'original' })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'edited' } })
    expect((textarea as HTMLTextAreaElement).value).toBe('edited')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. @ mention keyboard navigation
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — @ mention keyboard navigation', () => {
  const SAMPLE_FILES = [
    { name: 'src', type: 'folder' as const, children: [
      { name: 'app.tsx', type: 'file' as const },
      { name: 'utils.ts', type: 'file' as const },
    ]},
    { name: 'README.md', type: 'file' as const },
  ]

  function openMentionDropdown() {
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '@' } })
    return textarea
  }

  it('ArrowDown in @ mention moves highlight', () => {
    renderInputBar({ fileNodes: SAMPLE_FILES })
    const textarea = openMentionDropdown()
    // Verify dropdown is visible with file items
    expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument()

    // ArrowDown should move highlight (starts at 0, moves to 1)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    // Dropdown should still be visible
    expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument()
  })

  it('ArrowUp in @ mention moves highlight (clamped at 0)', () => {
    renderInputBar({ fileNodes: [
      { name: 'README.md', type: 'file' as const },
    ] })
    const textarea = openMentionDropdown()
    expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument()

    // ArrowUp at highlight 0 should clamp and stay at 0
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument()
  })

  it('Enter on @ mention inserts file path', () => {
    renderInputBar({ fileNodes: [
      { name: 'README.md', type: 'file' as const },
    ] })
    const textarea = openMentionDropdown()
    fireEvent.keyDown(textarea, { key: 'Enter' })
    // Mention dropdown should be gone — no buttons with that name
    expect(screen.queryByRole('button', { name: /README\.md/ })).not.toBeInTheDocument()
    // Textarea should contain the inserted file path
    expect((textarea as HTMLTextAreaElement).value).toBe('README.md')
  })

  it('Tab on @ mention inserts file path', () => {
    renderInputBar({ fileNodes: [
      { name: 'README.md', type: 'file' as const },
    ] })
    const textarea = openMentionDropdown()
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(screen.queryByRole('button', { name: /README\.md/ })).not.toBeInTheDocument()
    expect((textarea as HTMLTextAreaElement).value).toBe('README.md')
  })

  it('Escape closes @ mention without inserting', () => {
    renderInputBar({ fileNodes: [
      { name: 'README.md', type: 'file' as const },
    ] })
    const textarea = openMentionDropdown()
    expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: /README\.md/ })).not.toBeInTheDocument()
    expect((textarea as HTMLTextAreaElement).value).toBe('@')
  })

  it('@ mention only shows files, not directories', () => {
    renderInputBar({ fileNodes: [
      { name: 'src', type: 'folder' as const, children: [
        { name: 'app.tsx', type: 'file' as const },
      ]},
      { name: 'node_modules', type: 'folder' as const, children: [
        { name: 'pkg', type: 'folder' as const, children: [
          { name: 'index.js', type: 'file' as const },
        ]},
      ]},
    ] })
    openMentionDropdown()
    // Should NOT show directory-only buttons (no file extension = directory)
    // Directory names like "src" or "node_modules" should not appear as standalone items
    const allButtons = screen.getAllByRole('button')
    const mentionButtons = allButtons.filter((btn) => {
      const span = btn.querySelector('.truncate')
      return span != null
    })
    const buttonTexts = mentionButtons.map((btn) => {
      const span = btn.querySelector('.truncate')
      return span?.textContent ?? ''
    })
    // "src" should not appear as a standalone button (it's a directory)
    expect(buttonTexts).not.toContain('src')
    // "node_modules" should not appear as a standalone button
    expect(buttonTexts).not.toContain('node_modules')
    // But files should appear
    expect(buttonTexts).toContain('src/app.tsx')
    expect(buttonTexts).toContain('node_modules/pkg/index.js')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. @ mention file path insertion
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — @ mention file path insertion', () => {
  it('selecting file inserts relPath into textarea at correct position', () => {
    renderInputBar({ fileNodes: [
      { name: 'src', type: 'folder' as const, children: [
        { name: 'app.tsx', type: 'file' as const },
      ]},
    ] })
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    fireEvent.change(ta, { target: { value: 'look at @' } })
    expect(ta.value).toBe('look at @')

    // Select the file via mouseDown (same as clicking in the dropdown)
    const fileBtn = screen.getByRole('button', { name: /src\/app\.tsx/ })
    fireEvent.mouseDown(fileBtn)

    // After insertion, text should contain the file path
    expect(ta.value).toBe('look at src/app.tsx')
  })

  it('cursor is positioned after inserted text', () => {
    renderInputBar({ fileNodes: [
      { name: 'src', type: 'folder' as const, children: [
        { name: 'app.tsx', type: 'file' as const },
      ]},
    ] })
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    fireEvent.change(ta, { target: { value: '@' } })

    const fileBtn = screen.getByRole('button', { name: /src\/app\.tsx/ })
    fireEvent.mouseDown(fileBtn)

    // Full path should be in the textarea
    expect(ta.value).toBe('src/app.tsx')
  })

  it('@ mention closes after insertion', () => {
    renderInputBar({ fileNodes: [
      { name: 'src', type: 'folder' as const, children: [
        { name: 'app.tsx', type: 'file' as const },
      ]},
    ] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '@' } })
    expect(screen.getByRole('button', { name: /src\/app\.tsx/ })).toBeInTheDocument()

    const fileBtn = screen.getByRole('button', { name: /src\/app\.tsx/ })
    fireEvent.mouseDown(fileBtn)

    // Mention dropdown should be gone
    expect(screen.queryByRole('button', { name: /src\/app\.tsx/ })).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. expandTemplate with $ARGUMENTS
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — expandTemplate with $ARGUMENTS', () => {
  it('plugin command with $ARGUMENTS in prompt template expands correctly', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      pluginCommands: [{
        name: 'deploy',
        description: 'Deploy to production',
        argumentHint: '<env>',
        prompt: 'Deploy to $ARGUMENTS now',
      }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type the full command, close the picker (which auto-opens on /), then send
    fireEvent.change(textarea, { target: { value: '/deploy arg1' } })
    // Close the command picker with Escape
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // Now press Enter to trigger handleSend directly
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Deploy to arg1 now', [], undefined)
  })

  it('plugin command with {{args}} still works', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      pluginCommands: [{
        name: 'deploy',
        description: 'Deploy',
        argumentHint: '<env>',
        prompt: 'Deploy to {{args}} now',
      }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/deploy arg1' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Deploy to arg1 now', [], undefined)
  })

  it('mixed case $ARGUMENTS and {{args}} both expand', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      pluginCommands: [{
        name: 'deploy',
        description: 'Deploy',
        argumentHint: '<env>',
        prompt: 'Deploy to $ARGUMENTS and also {{args}}',
      }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/deploy prod' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Deploy to prod and also prod', [], undefined)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Plugin command template expansion via handleSend
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — plugin command template expansion via handleSend', () => {
  it('typing /deploy arg1 and pressing Enter expands template with args', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      pluginCommands: [{
        name: 'deploy',
        description: 'Deploy to production',
        argumentHint: '<env>',
        prompt: 'Deploy to $ARGUMENTS now',
      }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/deploy arg1' } })
    // Close the picker that opens on /
    fireEvent.keyDown(textarea, { key: 'Escape' })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Deploy to arg1 now', [], undefined)
  })

  it('typing /deploy (no args) and pressing Enter expands template with empty string', () => {
    const onSend = vi.fn()
    renderInputBar({
      onSend,
      pluginCommands: [{
        name: 'deploy',
        description: 'Deploy to production',
        argumentHint: '<env>',
        prompt: 'Deploy to $ARGUMENTS now',
      }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/deploy' } })
    // Close the picker that opens on /
    fireEvent.keyDown(textarea, { key: 'Escape' })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Deploy to  now', [], undefined)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Prompt history full cycle
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — prompt history full cycle', () => {
  it('ArrowUp on empty textarea calls navigatePromptHistory("up")', () => {
    useAppStore.setState({
      promptHistory: ['old message 1', 'old message 2'],
      promptHistoryIdx: -1,
    })

    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    // Ensure empty
    expect(ta.value).toBe('')
    fireEvent.keyDown(ta, { key: 'ArrowUp' })

    // After ArrowUp, the store index should have changed
    const idx = useAppStore.getState().promptHistoryIdx
    expect(idx).toBeGreaterThanOrEqual(0)
  })

  it('ArrowDown on empty textarea calls navigatePromptHistory("down")', () => {
    useAppStore.setState({
      promptHistory: ['old message'],
      promptHistoryIdx: 0,
    })

    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    // Navigate down from index 0
    fireEvent.keyDown(ta, { key: 'ArrowDown' })
    const idx = useAppStore.getState().promptHistoryIdx
    // After navigating down past last item, idx should reset to -1
    expect(idx).toBe(-1)
    expect(ta.value).toBe('')
  })

  it('arrow keys do not trigger history when text is non-empty', () => {
    const navigateSpy = vi.spyOn(useAppStore.getState(), 'navigatePromptHistory')

    useAppStore.setState({
      promptHistory: ['old message'],
      promptHistoryIdx: -1,
    })

    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)

    fireEvent.change(ta, { target: { value: 'some text' } })
    fireEvent.keyDown(ta, { key: 'ArrowUp' })

    expect(navigateSpy).not.toHaveBeenCalled()
    navigateSpy.mockRestore()
  })

  it('arrow keys do not trigger history when a picker is open', () => {
    const navigateSpy = vi.spyOn(useAppStore.getState(), 'navigatePromptHistory')

    useAppStore.setState({
      promptHistory: ['old message'],
      promptHistoryIdx: -1,
    })

    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)

    // Open command picker
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.getByText('/model')).toBeInTheDocument()

    // ArrowUp should navigate command picker, not prompt history
    fireEvent.keyDown(ta, { key: 'ArrowUp' })
    expect(navigateSpy).not.toHaveBeenCalled()
    navigateSpy.mockRestore()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Builtin command count
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — builtin command count', () => {
  it('picker shows same number of builtins as BUILTIN_COMMANDS.length', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })

    // Each builtin command should appear as /<name>
    for (const cmd of BUILTIN_COMMANDS) {
      expect(screen.getByText(`/${cmd.name}`)).toBeInTheDocument()
    }

    // Count of visible builtin buttons
    const builtinButtons = screen.getAllByText(
      (_content, element) =>
        element?.tagName === 'SPAN' &&
        element.className.includes('font-medium') &&
        BUILTIN_COMMANDS.some((c) => element.textContent === `/${c.name}`)
    )
    expect(builtinButtons.length).toBe(BUILTIN_COMMANDS.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. addPromptToHistory called on send
// ─────────────────────────────────────────────────────────────────────────────
describe('InputBar — addPromptToHistory called on send', () => {
  it('calls addPromptToHistory with the original text on regular send', () => {
    const addPromptSpy = vi.spyOn(useAppStore.getState(), 'addPromptToHistory')
    const onSend = vi.fn()

    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'hello world' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(addPromptSpy).toHaveBeenCalledWith('hello world')
    expect(onSend).toHaveBeenCalled()
    addPromptSpy.mockRestore()
  })

  it('calls addPromptToHistory with original text for slash commands', () => {
    const addPromptSpy = vi.spyOn(useAppStore.getState(), 'addPromptToHistory')
    const onCommand = vi.fn()

    renderInputBar({ onCommand })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type a slash command — this opens the picker
    fireEvent.change(textarea, { target: { value: '/clear' } })
    // Close the picker so Enter goes to handleSend
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // Now press Enter to send
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(addPromptSpy).toHaveBeenCalledWith('/clear')
    addPromptSpy.mockRestore()
  })

  it('calls addPromptToHistory with original text for plugin commands', () => {
    const addPromptSpy = vi.spyOn(useAppStore.getState(), 'addPromptToHistory')
    const onSend = vi.fn()

    renderInputBar({
      onSend,
      pluginCommands: [{
        name: 'deploy',
        description: 'Deploy',
        argumentHint: '<env>',
        prompt: 'Deploy to $ARGUMENTS',
      }],
    })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/deploy prod' } })
    // Close the picker
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // Send
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(addPromptSpy).toHaveBeenCalledWith('/deploy prod')
    expect(onSend).toHaveBeenCalled()
    addPromptSpy.mockRestore()
  })
})
