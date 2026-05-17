import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { type AppView, ViewToggle } from './ViewToggle'

describe('ViewToggle (P9 — 8 segments incl Storage + Network)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders all 8 segments including Storage and Network', () => {
    render(<ViewToggle value="dashboard" onChange={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(8)
    for (const label of [
      'Dashboard',
      'Inventory',
      'Hosts',
      'Planning',
      'OS end-of-support',
      'Trends',
      'Storage',
      'Network',
    ]) {
      expect(screen.getByText(label)).not.toBeNull()
    }
  })

  it('fires onChange for the new Storage and Network segments', async () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    await userEvent.click(screen.getByText('Storage'))
    expect(onChange).toHaveBeenCalledWith('storage')
    await userEvent.click(screen.getByText('Network'))
    expect(onChange).toHaveBeenCalledWith('network')
  })

  it('Arrow Right wraps from Network back to Dashboard (8-segment wraparound)', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="network" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('dashboard')
  })

  it('Arrow Left from Dashboard wraps to Network', () => {
    const onChange = vi.fn<(v: AppView) => void>()
    render(<ViewToggle value="dashboard" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('network')
  })
})
