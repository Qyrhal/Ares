import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AgentQuestionCard } from '../components/AgentQuestionCard'

const singleQ = [
  { header: 'Framework', question: 'Which framework do you prefer?', options: ['React', 'Vue', 'Svelte'] },
]

const multiQ = [
  { header: 'Features', question: 'Select features:', options: ['Auth', 'Cache', 'Logging'], multiSelect: true },
]

const noOptionsQ = [
  { header: 'Name', question: 'What should the project be called?' },
]

const twoQuestions = [
  { header: 'Framework', question: 'Which framework?', options: ['React', 'Vue'] },
  { header: 'Language', question: 'Which language?', options: ['TypeScript', 'JavaScript'] },
]

describe('AgentQuestionCard', () => {
  // 1. Renders question header and text
  it('renders question header badge and question text', () => {
    render(<AgentQuestionCard questions={singleQ} onSubmit={vi.fn()} />)
    expect(screen.getByText('Agent has questions')).toBeInTheDocument()
    expect(screen.getByText('Framework')).toBeInTheDocument()
    expect(screen.getByText('Which framework do you prefer?')).toBeInTheDocument()
  })

  // 2. Renders option pills
  it('renders option pill buttons for each option', () => {
    render(<AgentQuestionCard questions={singleQ} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'React' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Svelte' })).toBeInTheDocument()
  })

  // 3. Single-select: clicking option selects it, clicking another replaces it
  it('single-select: clicking an option selects it, clicking another replaces it', () => {
    render(<AgentQuestionCard questions={singleQ} onSubmit={vi.fn()} />)
    const reactBtn = screen.getByRole('button', { name: 'React' })
    const vueBtn = screen.getByRole('button', { name: 'Vue' })

    fireEvent.click(reactBtn)
    // After clicking React, submit should be enabled (has answer)
    expect(screen.getByRole('button', { name: /Submit/ })).not.toHaveAttribute('disabled')

    // Click Vue to replace
    fireEvent.click(vueBtn)
    // Submit still enabled
    expect(screen.getByRole('button', { name: /Submit/ })).not.toHaveAttribute('disabled')
  })

  // 4. Single-select: clicking same option deselects it
  it('single-select: clicking the same option again deselects it', () => {
    render(<AgentQuestionCard questions={singleQ} onSubmit={vi.fn()} />)
    const reactBtn = screen.getByRole('button', { name: 'React' })

    fireEvent.click(reactBtn)
    expect(screen.getByRole('button', { name: /Submit/ })).not.toHaveAttribute('disabled')

    fireEvent.click(reactBtn)
    // Deselected, no text, submit should be disabled
    expect(screen.getByRole('button', { name: /Submit/ })).toHaveAttribute('disabled')
  })

  // 5. Multi-select: clicking options toggles each independently
  it('multi-select: clicking options toggles each independently', () => {
    render(<AgentQuestionCard questions={multiQ} onSubmit={vi.fn()} />)
    const authBtn = screen.getByRole('button', { name: 'Auth' })
    const cacheBtn = screen.getByRole('button', { name: 'Cache' })
    const loggingBtn = screen.getByRole('button', { name: 'Logging' })

    // Select Auth
    fireEvent.click(authBtn)
    expect(screen.getByRole('button', { name: /Submit/ })).not.toHaveAttribute('disabled')

    // Select Cache (Auth still selected)
    fireEvent.click(cacheBtn)

    // Toggle Auth off (Cache still selected)
    fireEvent.click(authBtn)

    // Toggle Cache off (nothing selected)
    fireEvent.click(cacheBtn)

    // Should be disabled now
    expect(screen.getByRole('button', { name: /Submit/ })).toHaveAttribute('disabled')

    // Select Logging back
    fireEvent.click(loggingBtn)
    expect(screen.getByRole('button', { name: /Submit/ })).not.toHaveAttribute('disabled')
  })

  // 6. Submit button disabled when no answers selected
  it('submit button is disabled when no answers are selected', () => {
    render(<AgentQuestionCard questions={singleQ} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Submit/ })).toHaveAttribute('disabled')
  })

  // 7. Submit button enabled when all questions have answers
  it('submit button is enabled when all questions have answers', () => {
    render(<AgentQuestionCard questions={twoQuestions} onSubmit={vi.fn()} />)

    // Initially disabled
    expect(screen.getByRole('button', { name: /Submit/ })).toHaveAttribute('disabled')

    // Answer first question
    fireEvent.click(screen.getByRole('button', { name: 'React' }))
    // Still disabled (second question unanswered)
    expect(screen.getByRole('button', { name: /Submit/ })).toHaveAttribute('disabled')

    // Answer second question
    fireEvent.click(screen.getByRole('button', { name: 'TypeScript' }))
    // Now enabled
    expect(screen.getByRole('button', { name: /Submit/ })).not.toHaveAttribute('disabled')
  })

  // 8. Submit calls onSubmit with correct answers keyed by header
  it('submit calls onSubmit with correct answers keyed by header', () => {
    const onSubmit = vi.fn()
    render(<AgentQuestionCard questions={singleQ} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'React' }))
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))

    expect(onSubmit).toHaveBeenCalledWith({ Framework: 'React' })
  })

  it('submit combines selected options and custom text', () => {
    const onSubmit = vi.fn()
    render(<AgentQuestionCard questions={multiQ} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Auth' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cache' }))

    const input = screen.getByPlaceholderText('Or type a custom answer…')
    fireEvent.change(input, { target: { value: 'Monitoring' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))

    expect(onSubmit).toHaveBeenCalledWith({ Features: 'Auth, Cache, Monitoring' })
  })

  // 9. Custom text input contributes to answer
  it('custom text input contributes to the answer', () => {
    const onSubmit = vi.fn()
    render(<AgentQuestionCard questions={noOptionsQ} onSubmit={onSubmit} />)

    const input = screen.getByPlaceholderText('Your answer…')
    fireEvent.change(input, { target: { value: 'MyProject' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))

    expect(onSubmit).toHaveBeenCalledWith({ Name: 'MyProject' })
  })

  // 10. Enter in text input triggers submit
  it('pressing Enter in text input triggers submit', () => {
    const onSubmit = vi.fn()
    render(<AgentQuestionCard questions={noOptionsQ} onSubmit={onSubmit} />)

    const input = screen.getByPlaceholderText('Your answer…')
    fireEvent.change(input, { target: { value: 'EnterTest' } })

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledWith({ Name: 'EnterTest' })
  })

  it('Enter with shift key does NOT trigger submit', () => {
    const onSubmit = vi.fn()
    render(<AgentQuestionCard questions={noOptionsQ} onSubmit={onSubmit} />)

    const input = screen.getByPlaceholderText('Your answer…')
    fireEvent.change(input, { target: { value: 'ShiftEnterTest' } })

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  // 11. Multiple questions each need their own answer
  it('multiple questions each require their own answer before submit', () => {
    const onSubmit = vi.fn()
    render(<AgentQuestionCard questions={twoQuestions} onSubmit={onSubmit} />)

    // Only answer first question
    fireEvent.click(screen.getByRole('button', { name: 'React' }))

    // Try submitting — button is disabled so clicking won't fire
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))
    expect(onSubmit).not.toHaveBeenCalled()

    // Answer second question
    fireEvent.click(screen.getByRole('button', { name: 'TypeScript' }))

    // Now submit works
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      Framework: 'React',
      Language: 'TypeScript',
    })
  })

  // 12. Renders empty state when no questions
  it('renders without crashing when no questions provided', () => {
    render(<AgentQuestionCard questions={[]} onSubmit={vi.fn()} />)
    // Header still shown
    expect(screen.getByText('Agent has questions')).toBeInTheDocument()
    // No question sections rendered
    expect(screen.queryAllByRole('button', { name: 'React' })).toHaveLength(0)
  })

  // Additional: single-select submit with correct key
  it('submit with multi-select sends comma-separated selections', () => {
    const onSubmit = vi.fn()
    render(<AgentQuestionCard questions={multiQ} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Auth' }))
    fireEvent.click(screen.getByRole('button', { name: 'Logging' }))
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))

    expect(onSubmit).toHaveBeenCalledWith({ Features: 'Auth, Logging' })
  })

  // Additional: placeholder text differs when options present vs absent
  it('shows different placeholder text based on whether options exist', () => {
    render(<AgentQuestionCard questions={singleQ} onSubmit={vi.fn()} />)
    expect(screen.getByPlaceholderText('Or type a custom answer…')).toBeInTheDocument()

    render(<AgentQuestionCard questions={noOptionsQ} onSubmit={vi.fn()} />)
    expect(screen.getByPlaceholderText('Your answer…')).toBeInTheDocument()
  })
})
