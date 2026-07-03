import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from '../components/ui/select'

const OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', group: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', group: 'OpenAI' },
  { value: 'llama3', label: 'Llama 3', group: 'Local' },
]

describe('Select — rendering', () => {
  it('shows placeholder when value is empty', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} placeholder="Pick a model…" />)
    expect(screen.getByText('Pick a model…')).toBeInTheDocument()
  })

  it('shows the selected option label', () => {
    render(<Select value="gpt-4o" onChange={vi.fn()} options={OPTIONS} />)
    expect(screen.getByText('GPT-4o')).toBeInTheDocument()
  })

  it('does not show dropdown initially', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} />)
    expect(screen.queryByText('GPT-4o Mini')).not.toBeInTheDocument()
  })
})

describe('Select — interaction', () => {
  it('opens dropdown on click', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('GPT-4o')).toBeInTheDocument()
    expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument()
  })

  it('calls onChange with correct value on item click', () => {
    const onChange = vi.fn()
    render(<Select value="" onChange={onChange} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Llama 3'))
    expect(onChange).toHaveBeenCalledWith('llama3')
  })

  it('does not open when disabled', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('GPT-4o')).not.toBeInTheDocument()
  })

  it('shows group headers when options have groups', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Local')).toBeInTheDocument()
  })

  it('closes after selecting an option', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('GPT-4o Mini'))
    // Only one button visible (the trigger) after close
    expect(screen.queryAllByRole('button')).toHaveLength(1)
  })
})

describe('Select — search', () => {
  it('filters options by search text', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} searchable />)
    fireEvent.click(screen.getByRole('button'))
    const searchInput = screen.getByPlaceholderText('Search…')
    fireEvent.change(searchInput, { target: { value: 'llama' } })
    expect(screen.getByText('Llama 3')).toBeInTheDocument()
    expect(screen.queryByText('GPT-4o')).not.toBeInTheDocument()
  })

  it('shows "No results" when search matches nothing', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} searchable />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'zzz' } })
    expect(screen.getByText('No results')).toBeInTheDocument()
  })
})
