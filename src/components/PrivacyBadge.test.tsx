import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { PrivacyBadge } from './PrivacyBadge'

/** Drive `navigator.onLine` for the test. */
const setOnline = (value: boolean) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

describe('PrivacyBadge', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('always shows the "no data leaves" statement', () => {
    setOnline(true)
    render(<PrivacyBadge />)
    expect(screen.getByText('No data leaves this device')).toBeInTheDocument()
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
  })

  it('surfaces the offline chip when the network is disconnected', () => {
    setOnline(false)
    render(<PrivacyBadge />)
    expect(screen.getByText('No data leaves this device')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('exposes the state through an accessible status label', () => {
    setOnline(false)
    render(<PrivacyBadge />)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'No data leaves this device — Offline',
    )
  })
})
