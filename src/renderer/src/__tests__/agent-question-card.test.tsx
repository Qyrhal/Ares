import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentQuestionCard } from '@/components/AgentQuestionCard'
import type { AgentQuestion } from '@/types'

describe('AgentQuestionCard', () => {
  const onSubmit = vi.fn()

  beforeEach(() => {
    onSubmit.mockClear()
  })

  it('shows "Agent has questions" label', () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'What is your name?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    expect(screen.getByText('Agent has questions')).toBeInTheDocument()
  })

  it('shows question header and text', () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'What is your name?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    expect(screen.getByText('Q1')).toBeInTheDocument()
    expect(screen.getByText('What is your name?')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'What is your name?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    const btn = screen.getByRole('button', { name: /submit/i })
    expect(btn).toBeInTheDocument()
  })

  it('submit button is disabled when no answer provided', () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'What is your name?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('submit button is disabled when only some questions answered', async () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'First?' },
      { header: 'Q2', question: 'Second?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(2)
    // Answer only the first question
    await userEvent.type(inputs[0], 'Answer 1')
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('calls onSubmit with text answers when submit clicked', async () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'What is your name?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByRole('textbox'), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ Q1: 'Alice' })
  })

  it('calls onSubmit with selected options', async () => {
    const questions: AgentQuestion[] = [
      {
        header: 'Q1',
        question: 'Choose one?',
        options: ['Option A', 'Option B'],
        multiSelect: false,
      },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: /Option A/ }))
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledWith({ Q1: 'Option A' })
  })

  it('calls onSubmit with multi-select options', async () => {
    const questions: AgentQuestion[] = [
      {
        header: 'Q1',
        question: 'Pick any',
        options: ['A', 'B', 'C'],
        multiSelect: true,
      },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledWith({ Q1: 'A, C' })
  })

  it('calls onSubmit with both selected options and custom text', async () => {
    const questions: AgentQuestion[] = [
      {
        header: 'Q1',
        question: 'Pick or type',
        options: ['Option A', 'Option B'],
        multiSelect: true,
      },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: /Option A/ }))
    await userEvent.type(screen.getByRole('textbox'), 'Custom answer')
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledWith({ Q1: 'Option A, Custom answer' })
  })

  it('shows options as buttons', () => {
    const questions: AgentQuestion[] = [
      {
        header: 'Q1',
        question: 'Choose?',
        options: ['Opt1', 'Opt2'],
      },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: 'Opt1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Opt2' })).toBeInTheDocument()
  })

  it('shows text input with placeholder for custom answer when options exist', () => {
    const questions: AgentQuestion[] = [
      {
        header: 'Q1',
        question: 'Choose?',
        options: ['Opt1'],
      },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    expect(screen.getByPlaceholderText(/Or type a custom answer/)).toBeInTheDocument()
  })

  it('shows text input with generic placeholder when no options', () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'Your answer?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    expect(screen.getByPlaceholderText(/Your answer/)).toBeInTheDocument()
  })

  it('does not call onSubmit when submit is clicked without answering', () => {
    const questions: AgentQuestion[] = [
      { header: 'Q1', question: 'What is your name?' },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    screen.getByRole('button', { name: /submit/i }).click()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('handles multiple questions with mixed inputs', async () => {
    const questions: AgentQuestion[] = [
      {
        header: 'Q1',
        question: 'Pick?',
        options: ['A', 'B'],
      },
      {
        header: 'Q2',
        question: 'Type?',
        options: ['X', 'Y'],
      },
    ]
    render(<AgentQuestionCard questions={questions} onSubmit={onSubmit} />)
    const optionButtons = screen.getAllByRole('button')
    // Click option A for first question
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    // Type in second question's input
    const textboxes = screen.getAllByRole('textbox')
    await userEvent.type(textboxes[1], 'My custom')
    // Click submit
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ Q1: 'A', Q2: 'My custom' })
  })
})
