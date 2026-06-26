import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { type AppView, ViewToggle } from './ViewToggle'

describe('ViewToggle (15 segments incl Node Headroom + Storage Growth + Right-sizing + Monster Guests + Snapshot Sprawl + Storage Content + Cluster Health)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders all 15 segments', () => {
    render(<ViewToggle value="dashboard" onChange={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(15)
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

  it('Arrow Right wraps from the last segment (Cluster Health) back to Dashboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="clusterhealth" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('dashboard')
  })

  it('Arrow Left from Dashboard wraps to the last segment (Cluster Health)', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('clusterhealth')
  })

  it('vertical orientation (Improvement 1): same group/segments/keyboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} orientation="vertical" />)
    expect(screen.getByRole('group')).not.toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(15)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('inventory')
  })
})
