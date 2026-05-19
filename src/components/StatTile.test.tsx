import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatTile } from './StatTile'

describe('StatTile', () => {
  it('renders label, value, and optional sub', () => {
    render(<StatTile label="vCPU" value="2,836" sub="planned lens" />)
    expect(screen.getByText('vCPU')).not.toBeNull()
    expect(screen.getByText('2,836')).not.toBeNull()
    expect(screen.getByText('planned lens')).not.toBeNull()
  })

  it('keeps the value as the label element nextElementSibling (smoke-test contract)', () => {
    render(<StatTile icon={<svg aria-hidden="true" />} label="vCPU" value="2,836" />)
    const label = screen.getByText('vCPU')
    expect(label.nextElementSibling?.textContent).toBe('2,836')
  })

  it('applies the semantic accent class', () => {
    const { container } = render(<StatTile label="Avg CPU %" value="47.6 %" accent="high" />)
    expect(container.querySelector('.border-t-util-high')).not.toBeNull()
  })
})
