import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import type { AccountingMode } from '@/types/estate'
import { AccountingModeToggle } from './AccountingModeToggle'

describe('AccountingModeToggle (DSH-06 — controlled segmented aria-pressed)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 3 segments with the accessible group name', () => {
    render(<AccountingModeToggle value="active" onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Accounting mode' })
    expect(group).not.toBeNull()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(screen.getByText('Configured')).not.toBeNull()
    expect(screen.getByText('Active')).not.toBeNull()
    expect(screen.getByText('Storage-realistic')).not.toBeNull()
  })

  it('marks aria-pressed true on the value and false on the others', () => {
    render(<AccountingModeToggle value="active" onChange={() => {}} />)
    expect(screen.getByText('Active').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Configured').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Storage-realistic').getAttribute('aria-pressed')).toBe('false')
  })

  it('fires onChange with the clicked mode', async () => {
    const onChange = vi.fn<(m: AccountingMode) => void>()
    render(<AccountingModeToggle value="active" onChange={onChange} />)
    await userEvent.click(screen.getByText('Configured'))
    expect(onChange).toHaveBeenCalledWith('configured')
    await userEvent.click(screen.getByText('Storage-realistic'))
    expect(onChange).toHaveBeenCalledWith('storage-realistic')
  })

  it('Arrow Right moves selection forward (active → storage-realistic)', () => {
    const onChange = vi.fn<(m: AccountingMode) => void>()
    render(<AccountingModeToggle value="active" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('storage-realistic')
  })

  it('Arrow Left wraps backward (configured → storage-realistic)', () => {
    const onChange = vi.fn<(m: AccountingMode) => void>()
    render(<AccountingModeToggle value="configured" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('storage-realistic')
  })

  it('exposes a factual (non-editorial) description per mode via title', () => {
    render(<AccountingModeToggle value="active" onChange={() => {}} />)
    const configured = screen.getByText('Configured')
    const title = configured.getAttribute('title') ?? ''
    expect(title.length).toBeGreaterThan(0)
    expect(title).not.toMatch(/recommend|should|good|bad|healthy/i)
  })
})
