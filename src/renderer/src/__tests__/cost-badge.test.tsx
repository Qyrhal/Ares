import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CostBadge, formatCost, costColor } from '../components/StatusBar'

describe('CostBadge', () => {
  describe('formatCost', () => {
    it('formats zero cost as $0.00', () => {
      expect(formatCost(0)).toBe('$0.00')
    })

    it('formats very small cost as $0.00 (below 0.01 threshold)', () => {
      expect(formatCost(0.005)).toBe('$0.00')
    })

    it('formats cost with two decimal places', () => {
      expect(formatCost(0.01)).toBe('$0.01')
      expect(formatCost(0.50)).toBe('$0.50')
      expect(formatCost(1.00)).toBe('$1.00')
      expect(formatCost(10.00)).toBe('$10.00')
    })

    it('formats large costs correctly', () => {
      expect(formatCost(123.45)).toBe('$123.45')
      expect(formatCost(999.99)).toBe('$999.99')
    })
  })

  describe('costColor', () => {
    it('returns green for cost < $0.01', () => {
      expect(costColor(0.005)).toBe('text-green-500')
      expect(costColor(0)).toBe('text-green-500')
    })

    it('returns yellow for cost < $0.10', () => {
      expect(costColor(0.01)).toBe('text-yellow-500')
      expect(costColor(0.05)).toBe('text-yellow-500')
      expect(costColor(0.09)).toBe('text-yellow-500')
    })

    it('returns orange for cost < $1.00', () => {
      expect(costColor(0.10)).toBe('text-orange-500')
      expect(costColor(0.50)).toBe('text-orange-500')
      expect(costColor(0.99)).toBe('text-orange-500')
    })

    it('returns red for cost >= $1.00', () => {
      expect(costColor(1.00)).toBe('text-red-500')
      expect(costColor(5.00)).toBe('text-red-500')
      expect(costColor(100.00)).toBe('text-red-500')
    })
  })

  describe('CostBadge rendering', () => {
    it('renders when cost is positive', () => {
      render(<CostBadge cost={0.05} />)
      expect(screen.getByText('$0.05')).toBeInTheDocument()
    })

    it('does not render when cost is 0', () => {
      const { container } = render(<CostBadge cost={0} />)
      expect(container.innerHTML).toBe('')
    })

    it('does not render when cost is negative', () => {
      const { container } = render(<CostBadge cost={-1} />)
      expect(container.innerHTML).toBe('')
    })

    it('applies green class for cheap cost', () => {
      render(<CostBadge cost={0.005} />)
      const span = screen.getByText('$0.00').closest('span')!.parentElement!
      expect(span.className).toContain('text-green-500')
    })

    it('applies yellow class for moderate cost', () => {
      render(<CostBadge cost={0.05} />)
      const span = screen.getByText('$0.05').closest('span')!.parentElement!
      expect(span.className).toContain('text-yellow-500')
    })

    it('applies orange class for higher cost', () => {
      render(<CostBadge cost={0.50} />)
      const span = screen.getByText('$0.50').closest('span')!.parentElement!
      expect(span.className).toContain('text-orange-500')
    })

    it('applies red class for expensive cost', () => {
      render(<CostBadge cost={1.50} />)
      const span = screen.getByText('$1.50').closest('span')!.parentElement!
      expect(span.className).toContain('text-red-500')
    })

    it('includes DollarSign icon', () => {
      const { container } = render(<CostBadge cost={0.25} />)
      const icon = container.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('formats large cost correctly', () => {
      render(<CostBadge cost={12.34} />)
      expect(screen.getByText('$12.34')).toBeInTheDocument()
    })
  })
})
