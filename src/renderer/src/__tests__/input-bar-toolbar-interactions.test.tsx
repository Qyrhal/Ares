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

// ─── Context donut ─────────────────────────────────────────────────────────

describe('InputBar — context donut', () => {
  it('renders context donut SVG element', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const svg = document.querySelector('svg[viewBox="0 0 18 18"]')
    expect(svg).toBeTruthy()
  })

  it('clicking context donut opens popover with token info', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const svg = document.querySelector('svg[viewBox="0 0 18 18"]')!
    fireEvent.click(svg.closest('button')!)
    expect(screen.getByText(/\d+ \/ \d+/)).toBeInTheDocument()
  })

  it('clicking donut again closes the popover', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const btn = document.querySelector('svg[viewBox="0 0 18 18"]')!.closest('button')!
    fireEvent.click(btn)
    expect(screen.getByText(/\d+ \/ \d+/)).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument()
  })

  it('shows percentage used in popover', () => {
    renderInputBar({ currentModel: 'gpt-4o', messages: [] })
    const btn = document.querySelector('svg[viewBox="0 0 18 18"]')!.closest('button')!
    fireEvent.click(btn)
    expect(screen.getByText(/% of context used/)).toBeInTheDocument()
  })
})

// ─── Color mode toggle ─────────────────────────────────────────────────────

describe('InputBar — color mode toggle', () => {
  it('shows sun icon for dark mode', () => {
    renderInputBar({ colorMode: 'dark', onToggleColorMode: vi.fn() })
    expect(screen.getByTitle('Switch to light mode')).toBeInTheDocument()
  })

  it('shows moon icon for light mode', () => {
    renderInputBar({ colorMode: 'light', onToggleColorMode: vi.fn() })
    expect(screen.getByTitle('Switch to dark mode')).toBeInTheDocument()
  })

  it('calls onToggleColorMode when clicked', () => {
    const onToggle = vi.fn()
    renderInputBar({ colorMode: 'dark', onToggleColorMode: onToggle })
    fireEvent.click(screen.getByTitle('Switch to light mode'))
    expect(onToggle).toHaveBeenCalled()
  })

  it('does not render toggle when onToggleColorMode is absent', () => {
    renderInputBar({ colorMode: 'dark' })
    expect(screen.queryByTitle('Switch to light mode')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Switch to dark mode')).not.toBeInTheDocument()
  })
})

// ─── Agent mode toggle ─────────────────────────────────────────────────────

describe('InputBar — agent mode toggle', () => {
  it('renders all three mode buttons', () => {
    renderInputBar({ agentMode: 'agent', onAgentModeChange: vi.fn() })
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
  })

  it('calls onAgentModeChange with "chat" when Chat clicked', () => {
    const onChange = vi.fn()
    renderInputBar({ agentMode: 'agent', onAgentModeChange: onChange })
    fireEvent.click(screen.getByText('Chat'))
    expect(onChange).toHaveBeenCalledWith('chat')
  })

  it('calls onAgentModeChange with "plan" when Plan clicked', () => {
    const onChange = vi.fn()
    renderInputBar({ agentMode: 'agent', onAgentModeChange: onChange })
    fireEvent.click(screen.getByText('Plan'))
    expect(onChange).toHaveBeenCalledWith('plan')
  })

  it('calls onAgentModeChange with "agent" when Agent clicked', () => {
    const onChange = vi.fn()
    renderInputBar({ agentMode: 'chat', onAgentModeChange: onChange })
    fireEvent.click(screen.getByText('Agent'))
    expect(onChange).toHaveBeenCalledWith('agent')
  })
})

// ─── Permission mode cycling ───────────────────────────────────────────────

describe('InputBar — permission mode cycling', () => {
  it('cycles from ask to auto', () => {
    const onChange = vi.fn()
    renderInputBar({ permissionMode: 'ask', onPermissionModeChange: onChange })
    fireEvent.click(screen.getByTitle('Click to cycle permission mode'))
    expect(onChange).toHaveBeenCalledWith('auto')
  })

  it('cycles from auto to yolo', () => {
    const onChange = vi.fn()
    renderInputBar({ permissionMode: 'auto', onPermissionModeChange: onChange })
    fireEvent.click(screen.getByTitle('Click to cycle permission mode'))
    expect(onChange).toHaveBeenCalledWith('yolo')
  })

  it('cycles from yolo back to ask', () => {
    const onChange = vi.fn()
    renderInputBar({ permissionMode: 'yolo', onPermissionModeChange: onChange })
    fireEvent.click(screen.getByTitle('Click to cycle permission mode'))
    expect(onChange).toHaveBeenCalledWith('ask')
  })

  it('shows correct label for each mode', () => {
    const { rerender } = renderInputBar({ permissionMode: 'ask', onPermissionModeChange: vi.fn() })
    expect(screen.getByText('Ask')).toBeInTheDocument()
    rerender(<InputBar onSend={vi.fn()} permissionMode="auto" onPermissionModeChange={vi.fn()} />)
    expect(screen.getByText('Auto')).toBeInTheDocument()
    rerender(<InputBar onSend={vi.fn()} permissionMode="yolo" onPermissionModeChange={vi.fn()} />)
    expect(screen.getByText('Yolo')).toBeInTheDocument()
  })
})

// ─── Skill attachment send flow ────────────────────────────────────────────

describe('InputBar — skill attachment send flow', () => {
  it('skill content is prepended to message text on send', () => {
    const onSend = vi.fn()
    const skill = { name: 'test-skill', description: 'A test skill', content: 'Skill content here' }
    renderInputBar({ onSend, pluginSkills: [skill], pluginCommands: [] })

    // Attach skill via picker
    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: '/test-skill' } })
    const pickerBtns = document.querySelectorAll('[class*="popover"] button')
    const skillBtn = Array.from(pickerBtns).find(b => b.textContent?.includes('/test-skill'))
    fireEvent.mouseDown(skillBtn!)

    // Type a question
    fireEvent.change(textarea, { target: { value: 'What is this?' } })
    const sendBtn = screen.getByLabelText('Send message')
    fireEvent.click(sendBtn)

    expect(onSend).toHaveBeenCalled()
    const sentText = onSend.mock.calls[0][0]
    expect(sentText).toContain('Skill content here')
    expect(sentText).toContain('What is this?')
  })

  it('multiple skills are all included in send', () => {
    const onSend = vi.fn()
    const skills = [
      { name: 'skill-a', description: 'Skill A', content: 'Content A' },
      { name: 'skill-b', description: 'Skill B', content: 'Content B' },
    ]
    renderInputBar({ onSend, pluginSkills: skills, pluginCommands: [] })

    const textarea = screen.getByPlaceholderText(PLACEHOLDER)

    // Attach skill A
    fireEvent.change(textarea, { target: { value: '/skill-a' } })
    let pickerBtns = document.querySelectorAll('[class*="popover"] button')
    let btn = Array.from(pickerBtns).find(b => b.textContent?.includes('/skill-a'))
    fireEvent.mouseDown(btn!)

    // Attach skill B
    fireEvent.change(textarea, { target: { value: '/skill-b' } })
    pickerBtns = document.querySelectorAll('[class*="popover"] button')
    btn = Array.from(pickerBtns).find(b => b.textContent?.includes('/skill-b'))
    fireEvent.mouseDown(btn!)

    fireEvent.change(textarea, { target: { value: 'question' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    const sentText = onSend.mock.calls[0][0]
    expect(sentText).toContain('Content A')
    expect(sentText).toContain('Content B')
    expect(sentText).toContain('question')
  })
})

// ─── Attachment send flow ──────────────────────────────────────────────────

describe('InputBar — attachment send flow', () => {
  it('attachments are passed to onSend', () => {
    const onSend = vi.fn()
    renderInputBar({ onSend })

    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'check this file' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(onSend).toHaveBeenCalledWith('check this file', [], undefined)
  })
})

// ─── Reply-to send flow ────────────────────────────────────────────────────

describe('InputBar — reply-to send flow', () => {
  it('replyTo is passed to onSend when sending', () => {
    const onSend = vi.fn()
    const replyTo = { id: 'msg1', content: 'Previous message', role: 'user' }
    renderInputBar({ onSend, replyTo, onCancelReply: vi.fn() })

    const textarea = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(textarea, { target: { value: 'reply text' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(onSend).toHaveBeenCalledWith('reply text', [], replyTo)
  })

  it('onCancelReply clears the reply chip', () => {
    const onCancelReply = vi.fn()
    const replyTo = { id: 'msg1', content: 'Previous message', role: 'assistant' }
    renderInputBar({ replyTo, onCancelReply })

    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(onCancelReply).toHaveBeenCalled()
  })
})

// ─── Effort picker edge cases ──────────────────────────────────────────────

describe('InputBar — effort picker edge cases', () => {
  it('effort dropdown shows all three levels', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('clicking outside effort dropdown closes it', () => {
    renderInputBar({ onEffortChange: vi.fn(), effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    expect(screen.getByText('low')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })

  it('effort level selection closes dropdown', () => {
    const onChange = vi.fn()
    renderInputBar({ onEffortChange: onChange, effort: 'medium' })
    fireEvent.click(screen.getByTitle('Effort level'))
    fireEvent.mouseDown(screen.getByText('high'))
    expect(onChange).toHaveBeenCalledWith('high')
    expect(screen.queryByText('low')).not.toBeInTheDocument()
  })
})

// ─── Model chip ────────────────────────────────────────────────────────────

describe('InputBar — model chip', () => {
  it('displays current model name', () => {
    renderInputBar({ currentModel: 'gpt-4o' })
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
  })

  it('displays "No model" when model is empty', () => {
    renderInputBar({ currentModel: '' })
    expect(screen.getByText('No model')).toBeInTheDocument()
  })

  it('truncates long model names', () => {
    renderInputBar({ currentModel: 'very-long-model-name-that-should-be-truncated' })
    const modelBtn = screen.getByTitle('Change model')
    expect(modelBtn.querySelector('.truncate')).toBeTruthy()
  })
})
