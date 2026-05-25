import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { type AppView, ViewToggle } from './ViewToggle'

describe('ViewToggle (10 segments incl Right-sizing + Monster VMs)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders all 10 segments', () => {
    render(<ViewToggle value="dashboard" onChange={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(10)
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
      'Monster VMs',
    ]) {
      expect(screen.getByText(label)).not.toBeNull()
    }
  })

  it('fires onChange for the Right-sizing and Monster VMs segments', async () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    await userEvent.click(screen.getByText('Right-sizing'))
    expect(onChange).toHaveBeenCalledWith('rightsizing')
    await userEvent.click(screen.getByText('Monster VMs'))
    expect(onChange).toHaveBeenCalledWith('monstervm')
  })

  it('Arrow Right wraps from the last segment (Monster VMs) back to Dashboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="monstervm" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('dashboard')
  })

  it('Arrow Left from Dashboard wraps to the last segment (Monster VMs)', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('monstervm')
  })

  it('vertical orientation (Improvement 1): same group/segments/keyboard', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} orientation="vertical" />)
    expect(screen.getByRole('group')).not.toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(10)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('inventory')
  })
})
