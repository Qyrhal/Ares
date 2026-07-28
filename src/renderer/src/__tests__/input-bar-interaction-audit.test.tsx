import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InputBar, BUILTIN_COMMANDS } from '../components/InputBar'

const PLACEHOLDER = 'Ask anything… (@ to mention files, / for commands)'

function renderInputBar(props: Record<string, unknown> = {}) {
  return render(
    <InputBar
      onSend={vi.fn()}
      pluginSkills={[]}
      pluginCommands={[]}
      {...props}
    />
  )
}

describe('InputBar — interaction audit: picker lifecycle', () => {
  it('picker does not open when / is typed in the middle of existing text', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: 'hello ' } })
    fireEvent.change(ta, { target: { value: 'hello /' } })
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })

  it('picker opens when / is at the very start of the textarea', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    expect(screen.queryByText('/model')).toBeInTheDocument()
  })

  it('typing / then backspace clears the picker', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    fireEvent.change(ta, { target: { value: '' } })
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })

  it('Escape closes picker without clearing the typed text', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    fireEvent.keyDown(ta, { key: 'Escape' })
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
    expect((ta as HTMLTextAreaElement).value).toBe('/')
  })

  it('clicking a command in the picker fires executeCommand via mouseDown', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/clear' } })
    // Use getAllByText since textarea also contains '/clear'
    const items = screen.getAllByText('/clear')
    // The picker item is a button, the textarea is a textarea
    const pickerItem = items.find((el) => el.tagName === 'SPAN' || el.closest('button'))
    expect(pickerItem).toBeDefined()
    fireEvent.mouseDown(pickerItem!)
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})

describe('InputBar — interaction audit: tab completion', () => {
  it('Tab on builtin /clear executes it (clears textarea and calls onCommand)', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/clear' } })
    fireEvent.keyDown(ta, { key: 'Tab' })
    // Builtin commands are executed, not inserted with trailing space
    expect(onCommand).toHaveBeenCalledWith('clear', '')
    expect((ta as HTMLTextAreaElement).value).toBe('')
  })

  it('Tab with no items highlighted (empty filter) does not crash', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/zzzzz' } })
    fireEvent.keyDown(ta, { key: 'Tab' })
    expect((ta as HTMLTextAreaElement).value).toBe('/zzzzz')
  })
})

describe('InputBar — interaction audit: enter key dispatch', () => {
  it('Enter on highlighted builtin command calls onCommand', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/clear' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('Enter with args passes args through', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/model gpt-4o' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('Shift+Enter always inserts newline, never sends', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('Enter sends message when no picker is open', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: 'hello world' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).toHaveBeenCalled()
  })

  it('typing /nonexistent then Enter dispatches to onCommand (no crash)', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/nonexistent' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('nonexistent', '')
  })

  it('Enter on builtin /helpful calls onCommand with helpful', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/helpful' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('helpful', '')
  })
})

describe('InputBar — interaction audit: text reflection', () => {
  it('textarea shows exactly what user types', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/model gpt-4o' } })
    expect((ta as HTMLTextAreaElement).value).toBe('/model gpt-4o')
  })

  it('uppercase command is lowercased in dispatch', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/CLEAR' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })

  it('mixed-case command with args dispatches correctly', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/Model gpt-4o' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('model', 'gpt-4o')
  })

  it('command with slash args preserves full arg string', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/grep pattern --ext ts' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith('grep', 'pattern --ext ts')
  })
})

describe('InputBar — interaction audit: edge cases', () => {
  it('Enter with empty textarea does nothing', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('Tab when picker is closed does not crash', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Tab' })
    expect((ta as HTMLTextAreaElement).value).toBe('hello')
  })

  it('skill command via picker click attaches as chip', () => {
    const pluginSkills = [{ name: 'test-skill', content: 'skill content here' }]
    renderInputBar({ pluginSkills })
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/test-skill' } })
    // Use getAllByText since textarea also contains the text
    const items = screen.getAllByText('/test-skill')
    const pickerItem = items.find((el) => el.tagName === 'SPAN' || el.closest('button'))
    expect(pickerItem).toBeDefined()
    fireEvent.mouseDown(pickerItem!)
    // Chip should appear (without the slash)
    expect(screen.getByText('test-skill')).toBeInTheDocument()
  })

})

describe('InputBar — interaction audit: keyboard navigation', () => {
  it('Escape closes picker when it is open', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.queryByText('/clear')).toBeInTheDocument()
    fireEvent.keyDown(ta, { key: 'Escape' })
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })

  it('Escape does nothing when no picker is open', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Escape' })
    expect((ta as HTMLTextAreaElement).value).toBe('hello')
  })

  it('ArrowDown/ArrowUp in picker do not crash', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/' } })
    // Navigate through items without crashing
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(ta, { key: 'ArrowDown' })
    }
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(ta, { key: 'ArrowUp' })
    }
    // Picker should still be visible
    expect(screen.queryByText('/clear')).toBeInTheDocument()
  })
})

describe('InputBar — interaction audit: picker rendering', () => {
  it('all builtin commands appear in the picker', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/' } })
    for (const cmd of BUILTIN_COMMANDS) {
      expect(screen.queryByText(`/${cmd.name}`)).toBeInTheDocument()
    }
  })

  it('builtin commands show their description', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.getByText(/List or change the model/)).toBeInTheDocument()
    expect(screen.getByText(/Clear messages/)).toBeInTheDocument()
  })

  it('builtin commands have required fields', () => {
    for (const cmd of BUILTIN_COMMANDS) {
      expect(cmd.kind).toBe('builtin')
      expect(typeof cmd.name).toBe('string')
      expect(cmd.name.length).toBeGreaterThan(0)
      expect(typeof cmd.description).toBe('string')
      expect(cmd.description.length).toBeGreaterThan(0)
    }
  })

  it('BUILTIN_COMMANDS array is non-empty and names are unique', () => {
    expect(BUILTIN_COMMANDS.length).toBeGreaterThan(0)
    const names = BUILTIN_COMMANDS.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('InputBar — interaction audit: multiline and newline handling', () => {
  it('typing / after a space does NOT open picker', () => {
    renderInputBar()
    const ta = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(ta, { target: { value: 'text /command' } })
    expect(screen.queryByText('/clear')).not.toBeInTheDocument()
  })
})
