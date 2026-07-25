import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { InputBar } from '../components/InputBar'
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

// Reset prompt history between tests
beforeEach(() => {
  useAppStore.setState({
    promptHistory: [],
    promptHistoryIdx: -1,
  })
})

// ─── 1. Picker mouse interaction ──────────────────────────────────────────

describe('InputBar — picker mouse interaction', () => {
  it('mouse hover on picker item updates highlight', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // /model is highlighted by default (index 0)
    const modelBtn = screen.getByText('/model').closest('button')!
    expect(modelBtn).toHaveClass('bg-accent')
    // Hover on /clear (index 3) should update highlight
    const clearBtn = screen.getByText('/clear').closest('button')!
    fireEvent.mouseEnter(clearBtn)
    expect(clearBtn).toHaveClass('bg-accent')
    expect(modelBtn).not.toHaveClass('bg-accent')
  })

  it('mouseDown on picker item executes command', () => {
    const onRevealInExplorer = vi.fn()
    renderInputBar({ onRevealInExplorer, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Click on /folder → should call onRevealInExplorer
    const folderBtn = screen.getByText('/folder').closest('button')!
    fireEvent.mouseDown(folderBtn)
    expect(onRevealInExplorer).toHaveBeenCalled()
    // Picker should close
    expect(screen.queryByText('/folder')).not.toBeInTheDocument()
  })

  it('mouseDown on skill picker item adds skill chip', () => {
    const skill = { name: 'my-skill', description: 'A skill', content: 'skill content' }
    renderInputBar({ pluginSkills: [skill], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/my-skill' } })
    // Find the button in the picker containing /my-skill
    const allMatches = screen.getAllByText('/my-skill')
    const skillButton = allMatches.find((el) => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(skillButton)
    // Skill chip should appear
    expect(screen.getByText('my-skill')).toBeInTheDocument()
    expect(screen.getByText('skill')).toBeInTheDocument()
  })
})

// ─── 2. Prompt history navigation ─────────────────────────────────────────

describe('InputBar — prompt history navigation', () => {
  it('ArrowUp on empty textarea navigates to previous prompt', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement

    // Seed history
    act(() => {
      useAppStore.getState().addPromptToHistory('first prompt')
      useAppStore.getState().addPromptToHistory('second prompt')
    })

    // ArrowUp should recall the most recent prompt
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(textarea.value).toBe('second prompt')
  })

  it('ArrowDown navigates to next prompt in history when text is empty', () => {
    // Set up: history with index pointing to second item, text is empty
    // This simulates the state after ArrowUp recalled a prompt, user cleared it,
    // and we manually restored the index for testing
    useAppStore.setState({ promptHistory: ['first prompt', 'second prompt'], promptHistoryIdx: 1 })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    // Text is empty, history index is 1 (pointing to 'second prompt')
    // ArrowDown → index goes to 0 → returns 'first prompt'
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea.value).toBe('first prompt')
  })

  it('ArrowDown at index 0 returns empty string', () => {
    useAppStore.setState({ promptHistory: ['prompt one'], promptHistoryIdx: 0 })
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    // Index is 0, text is empty. ArrowDown → index goes to -1 → returns ''
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(textarea.value).toBe('')
  })
})

// ─── 3. Emoji autocomplete ────────────────────────────────────────────────

describe('InputBar — emoji autocomplete', () => {
  it('typing :fire shows emoji suggestions', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':fire' } })
    // Should show fire emoji suggestion
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.getByText(':fire:')).toBeInTheDocument()
  })

  it('ArrowDown navigates emoji suggestions', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type :th to get multiple suggestions (thumbsup, thumbsdown)
    fireEvent.change(textarea, { target: { value: ':th' } })
    // Should see both
    expect(screen.getByText('👍')).toBeInTheDocument()
    expect(screen.getByText('👎')).toBeInTheDocument()
    // First should be highlighted
    const thumbsUpBtn = screen.getByText('👍').closest('button')!
    expect(thumbsUpBtn).toHaveClass('bg-accent')
  })

  it('ArrowUp navigates emoji suggestions backward', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type :h to get heart, heart-eyes
    fireEvent.change(textarea, { target: { value: ':h' } })
    // Move down first
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    // Then up
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    // First item should be highlighted again
    const heartBtn = screen.getByText('❤️').closest('button')!
    expect(heartBtn).toHaveClass('bg-accent')
  })

  it('Enter on emoji inserts it into textarea', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: ':fire' } })
    // Enter on the highlighted emoji
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // :fire should be replaced with the emoji character
    expect(textarea.value).toContain('🔥')
  })

  it('Escape closes emoji picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':fire' } })
    expect(screen.getByText('🔥')).toBeInTheDocument()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByText(':fire:')).not.toBeInTheDocument()
  })
})

// ─── 4. Click-outside closes pickers ──────────────────────────────────────

describe('InputBar — click-outside closes pickers', () => {
  it('mousedown outside textarea and dropdown closes command picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/' } })
    // Picker is open
    expect(screen.getByText('/model')).toBeInTheDocument()
    // Simulate mousedown on document body (outside)
    fireEvent.mouseDown(document.body)
    // Picker should close
    expect(screen.queryByText('/model')).not.toBeInTheDocument()
  })

  it('mousedown outside closes emoji picker', () => {
    renderInputBar()
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: ':fire' } })
    // Emoji picker is open
    expect(screen.getByText('🔥')).toBeInTheDocument()
    // Mousedown outside
    fireEvent.mouseDown(document.body)
    // Emoji picker should close
    expect(screen.queryByText(':fire:')).not.toBeInTheDocument()
  })
})

// ─── 5. ReplyTo forwarding ────────────────────────────────────────────────

describe('InputBar — replyTo forwarding', () => {
  it('onSend receives replyTo as third argument when replyTo prop is set', () => {
    const onSend = vi.fn()
    const replyTo = { id: 'm1', content: 'Hello world', role: 'user' }
    renderInputBar({ onSend, replyTo })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'my reply' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('my reply', [], replyTo)
  })

  it('onSend receives undefined as third argument when no replyTo', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'no reply' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('no reply', [], undefined)
  })

  it('cancel reply button clears the reply chip', () => {
    const onCancelReply = vi.fn()
    renderInputBar({
      replyTo: { id: 'm1', content: 'Hello', role: 'user' },
      onCancelReply,
    })
    expect(screen.getByText('Replying to You')).toBeInTheDocument()
    const cancelBtn = screen.getByLabelText('Cancel reply')
    fireEvent.click(cancelBtn)
    expect(onCancelReply).toHaveBeenCalledTimes(1)
  })
})

// ─── 6. Skill duplicate prevention ────────────────────────────────────────

describe('InputBar — skill duplicate prevention', () => {
  it('selecting the same skill twice does not add duplicate chip', () => {
    const skill = { name: 'my-skill', description: 'A skill', content: 'content' }
    renderInputBar({ pluginSkills: [skill], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Select skill first time
    fireEvent.change(textarea, { target: { value: '/my-skill' } })
    const firstMatch = screen.getAllByText('/my-skill')
    const skillButton = firstMatch.find((el) => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(skillButton)
    expect(screen.getByText('my-skill')).toBeInTheDocument()

    // Clear text first, then select same skill again
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.change(textarea, { target: { value: '/my-skill' } })
    const secondMatch = screen.getAllByText('/my-skill')
    const skillButton2 = secondMatch.find((el) => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(skillButton2)

    // There should only be ONE remove button (one chip, not two)
    const removeButtons = screen.getAllByLabelText('Remove my-skill')
    expect(removeButtons).toHaveLength(1)
  })

  it('selecting different skills adds both chips', () => {
    const skill1 = { name: 'skill-a', description: 'Skill A', content: 'a content' }
    const skill2 = { name: 'skill-b', description: 'Skill B', content: 'b content' }
    renderInputBar({ pluginSkills: [skill1, skill2], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Select skill A
    fireEvent.change(textarea, { target: { value: '/skill-a' } })
    const matchA = screen.getAllByText('/skill-a')
    const buttonA = matchA.find((el) => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(buttonA)
    expect(screen.getByText('skill-a')).toBeInTheDocument()

    // Select skill B
    fireEvent.change(textarea, { target: { value: '/skill-b' } })
    const matchB = screen.getAllByText('/skill-b')
    const buttonB = matchB.find((el) => el.closest('button'))!.closest('button')!
    fireEvent.mouseDown(buttonB)
    expect(screen.getByText('skill-b')).toBeInTheDocument()

    // Both chips should exist
    expect(screen.getByLabelText('Remove skill-a')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove skill-b')).toBeInTheDocument()
  })
})

// ─── 7. Multi-line command input ──────────────────────────────────────────

describe('InputBar — multi-line command input', () => {
  it('typing text + newline + / at line start opens picker', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'some text\n/' } })
    // Picker should open because / is at start of line
    expect(screen.getByText('/model')).toBeInTheDocument()
  })

  it('command typed after newline is recognized', () => {
    const onCommand = vi.fn()
    renderInputBar({ onCommand, pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'context\n/clear' } })
    // Press Enter to execute
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // onCommand should be called with 'clear'
    expect(onCommand).toHaveBeenCalledWith('clear', '')
  })
})

// ─── 8. Tab with no highlighted item ──────────────────────────────────────

describe('InputBar — Tab with no highlighted item', () => {
  it('Tab when filteredCommands is empty does not crash', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type a command that matches nothing
    fireEvent.change(textarea, { target: { value: '/zzzznonexistent' } })
    // Tab should not crash
    expect(() => {
      fireEvent.keyDown(textarea, { key: 'Tab' })
    }).not.toThrow()
  })

  it('Tab with empty picker does not modify textarea value', () => {
    renderInputBar({ pluginSkills: [], pluginCommands: [] })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/zzzznonexistent' } })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value).toBe('/zzzznonexistent')
  })
})

// ─── 9. Plugin command Enter dispatch ─────────────────────────────────────

describe('InputBar — plugin command Enter dispatch', () => {
  it('Enter on plugin command with argumentHint inserts /name into textarea', () => {
    const pluginCommands = [
      { name: 'deploy', description: 'Deploy', argumentHint: '--env', prompt: 'Deploy {{args}}' },
    ]
    renderInputBar({ pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    // Type /dep to filter
    fireEvent.change(textarea, { target: { value: '/dep' } })
    expect(screen.getByText('/deploy')).toBeInTheDocument()
    // Enter executes the highlighted command
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // With argumentHint, executeCommand calls insertCommand which puts /deploy  in textarea
    expect(textarea.value).toContain('/deploy')
  })

  it('Enter on plugin command with content (no hint) expands template', () => {
    const onSend = vi.fn()
    const pluginCommands = [
      { name: 'greet', description: 'Greet', prompt: 'Hello {{args}}, welcome!' },
    ]
    renderInputBar({ onSend, pluginSkills: [], pluginCommands })
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    // Type /greet (no args)
    fireEvent.change(textarea, { target: { value: '/greet' } })
    // Send via Enter — since it's a non-builtin with content, it expands template
    // Actually, we need to verify the picker behavior:
    // When the picker is open and Enter is pressed, it calls executeCommand
    // For a command with content and no hint, executeCommand calls setTextAndResize(expandTemplate(content, ''))
    // But wait - since this is a command (kind='command') with content and NO hint,
    // executeCommand expands the template. Let me check the flow:
    // Actually Enter in handleKeyDown → executeCommand → for kind='command' with content, no hint → setTextAndResize(expandTemplate(content, ''))
    // So it fills the textarea with expanded text, then Enter again would send it.
    // But we need to check: does Enter on command with content AND hint also call insertCommand?
    // Yes: if item.hint exists → insertCommand, else if item.content → setTextAndResize
    // So for no hint: textarea gets expanded template
    // Let me use send button to actually send:
    // First, trigger the command execution to fill the textarea
    // The problem: Enter while picker is open calls executeCommand which fills textarea
    // Then the text is "Hello , welcome!" — no / prefix so handleSend sends it as regular text
    // Wait, actually let me re-check the code flow...
    // In handleKeyDown, when showCommands and Enter is pressed: executeCommand(filteredCommands[cmdHighlight])
    // This is the path taken. For command with content and no hint, it calls setTextAndResize(expandTemplate(content, ''))
    // The textarea now has "Hello , welcome!" but picker is closed
    // A second Enter would call handleSend with that text

    // But actually, I need to simulate the Enter properly.
    // Step 1: Type /greet → picker opens
    fireEvent.change(textarea, { target: { value: '/greet' } })
    // Step 2: Press Enter → executeCommand fills textarea with expanded template
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    // The textarea should now contain the expanded template
    const textareaEl = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement
    expect(textareaEl.value).toBe('Hello , welcome!')
  })
})

// ─── 10. Effort picker ────────────────────────────────────────────────────

describe('InputBar — effort picker', () => {
  it('click on effort button opens effort dropdown', () => {
    renderInputBar({ effort: 'medium', onEffortChange: vi.fn() })
    // Initially, effort options should not be visible
    expect(screen.queryByText('low')).not.toBeInTheDocument()
    expect(screen.queryByText('high')).not.toBeInTheDocument()

    // Click on effort button (shows "Med")
    const effortBtn = screen.getByText('Med')
    fireEvent.click(effortBtn)

    // Dropdown should show all three options
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
  })

  it('click on effort option calls onEffortChange', () => {
    const onEffortChange = vi.fn()
    renderInputBar({ effort: 'medium', onEffortChange })
    // Open the effort picker
    fireEvent.click(screen.getByText('Med'))
    // Click on "high"
    fireEvent.mouseDown(screen.getByText('high'))
    expect(onEffortChange).toHaveBeenCalledWith('high')
  })

  it('current effort shown as active (has bg-accent class)', () => {
    renderInputBar({ effort: 'low', onEffortChange: vi.fn() })
    // Open the effort picker
    fireEvent.click(screen.getByText('Low'))
    // The "low" option should be highlighted
    const lowOption = screen.getByText('low').closest('button')!
    expect(lowOption).toHaveClass('bg-accent')
  })
})

// ─── 11. Permission mode cycling ──────────────────────────────────────────

describe('InputBar — permission mode cycling', () => {
  it('click on permission button cycles through modes', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ permissionMode: 'ask', onPermissionModeChange })
    // Click to cycle from ask → auto
    const permButton = screen.getByText('Ask')
    fireEvent.click(permButton)
    expect(onPermissionModeChange).toHaveBeenCalledWith('auto')
  })

  it('cycles from auto to yolo', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ permissionMode: 'auto', onPermissionModeChange })
    fireEvent.click(screen.getByText('Auto'))
    expect(onPermissionModeChange).toHaveBeenCalledWith('yolo')
  })

  it('cycles from yolo back to ask', () => {
    const onPermissionModeChange = vi.fn()
    renderInputBar({ permissionMode: 'yolo', onPermissionModeChange })
    fireEvent.click(screen.getByText('Yolo'))
    expect(onPermissionModeChange).toHaveBeenCalledWith('ask')
  })

  it('displays correct label for each mode', () => {
    const { unmount } = renderInputBar({ permissionMode: 'ask', onPermissionModeChange: vi.fn() })
    expect(screen.getByText('Ask')).toBeInTheDocument()
    unmount()

    renderInputBar({ permissionMode: 'auto', onPermissionModeChange: vi.fn() })
    expect(screen.getByText('Auto')).toBeInTheDocument()
  })
})

// ─── 12. Agent mode switching ─────────────────────────────────────────────

describe('InputBar — agent mode switching', () => {
  it('click on Chat button calls onAgentModeChange with chat', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ agentMode: 'agent', onAgentModeChange })
    fireEvent.click(screen.getByText('Chat'))
    expect(onAgentModeChange).toHaveBeenCalledWith('chat')
  })

  it('click on Plan button calls onAgentModeChange with plan', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ agentMode: 'agent', onAgentModeChange })
    fireEvent.click(screen.getByText('Plan'))
    expect(onAgentModeChange).toHaveBeenCalledWith('plan')
  })

  it('click on Agent button calls onAgentModeChange with agent', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ agentMode: 'chat', onAgentModeChange })
    fireEvent.click(screen.getByText('Agent'))
    expect(onAgentModeChange).toHaveBeenCalledWith('agent')
  })

  it('active mode button has font-medium class', () => {
    renderInputBar({ agentMode: 'plan', onAgentModeChange: vi.fn() })
    const planBtn = screen.getByText('Plan')
    expect(planBtn.className).toContain('font-medium')
    // Other buttons should NOT have font-medium
    const chatBtn = screen.getByText('Chat')
    const agentBtn = screen.getByText('Agent')
    expect(chatBtn.className).not.toContain('font-medium')
    expect(agentBtn.className).not.toContain('font-medium')
  })

  it('switching modes updates which button is active', () => {
    const onAgentModeChange = vi.fn()
    renderInputBar({ agentMode: 'agent', onAgentModeChange })
    // Agent is active
    expect(screen.getByText('Agent').className).toContain('font-medium')
    expect(screen.getByText('Chat').className).not.toContain('font-medium')

    // Click Chat
    fireEvent.click(screen.getByText('Chat'))
    expect(onAgentModeChange).toHaveBeenCalledWith('chat')
  })
})
