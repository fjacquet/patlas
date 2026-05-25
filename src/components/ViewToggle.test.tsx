import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { type AppView, ViewToggle } from './ViewToggle'

describe('ViewToggle (9 segments incl Right-sizing)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders all 9 segments including Storage, Network and Right-sizing', () => {
    render(<ViewToggle value="dashboard" onChange={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(9)
    for (const label of [
      'Dashboard',
      'Inventory',
      'Hosts',
      'Planning',
      'OS end-of-support',
      'Trends',
      'Storage',
      'Network',
      'Right-sizing',
    ]) {
      expect(screen.getByText(label)).not.toBeNull()
    }
  })

  it('fires onChange for the Storage, Network and Right-sizing segments', async () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    await userEvent.click(screen.getByText('Storage'))
    expect(onChange).toHaveBeenCalledWith('storage')
    await userEvent.click(screen.getByText('Network'))
    expect(onChange).toHaveBeenCalledWith('network')
    await userEvent.click(screen.getByText('Right-sizing'))
    expect(onChange).toHaveBeenCalledWith('rightsizing')
  })

  it('Arrow Right wraps from the last segment (Right-sizing) back to Dashboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="rightsizing" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('dashboard')
  })

  it('Arrow Left from Dashboard wraps to the last segment (Right-sizing)', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('rightsizing')
  })

  it('vertical orientation (Improvement 1): same group/segments/keyboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} orientation="vertical" />)
    expect(screen.getByRole('group')).not.toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(9)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('inventory')
  })
})
