import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { type AppView, ViewToggle } from './ViewToggle'

describe('ViewToggle (17 segments incl Node Headroom + Storage Growth + Right-sizing + Monster Guests + Snapshot Sprawl + Storage Content + Cluster Health + Protection + Governance)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders all 17 segments', () => {
    render(<ViewToggle value="dashboard" onChange={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(17)
    for (const label of [
      'Dashboard',
      'Inventory',
      'Nodes',
      'Node Headroom',
      'Planning',
      'OS end-of-support',
      'Trends',
      'Storage',
      'Storage Growth',
      'Network',
      'Right-sizing',
      'Monster Guests',
      'Snapshot Sprawl',
      'Storage Content',
      'Cluster Health',
      'Protection',
      'Governance',
    ]) {
      expect(screen.getByText(label)).not.toBeNull()
    }
  })

  it('fires onChange for the Right-sizing and Monster Guests segments', async () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    await userEvent.click(screen.getByText('Right-sizing'))
    expect(onChange).toHaveBeenCalledWith('rightsizing')
    await userEvent.click(screen.getByText('Monster Guests'))
    expect(onChange).toHaveBeenCalledWith('monstervm')
  })

  it('Arrow Right wraps from the last segment (Governance) back to Dashboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="governance" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('dashboard')
  })

  it('Arrow Left from Dashboard wraps to the last segment (Governance)', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('governance')
  })

  it('vertical orientation (Improvement 1): same group/segments/keyboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} orientation="vertical" />)
    expect(screen.getByRole('group')).not.toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(17)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('inventory')
  })
})
