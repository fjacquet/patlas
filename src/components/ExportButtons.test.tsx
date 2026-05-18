import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'

const run = vi.fn()
let busyState = false
vi.mock('@/hooks/useExport', () => ({
  useExport: () => ({ run, busy: busyState }),
}))

import { ExportButtons } from './ExportButtons'

describe('ExportButtons', () => {
  beforeEach(async () => {
    busyState = false
    run.mockReset()
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the two header buttons with EN labels + ARIA, reusing the shipped group idiom', () => {
    const { container } = render(<ExportButtons />)
    expect(screen.getByRole('button', { name: /self-contained HTML file/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /PPTX deck/i })).not.toBeNull()
    expect(screen.getByText('Export HTML')).not.toBeNull()
    expect(screen.getByText('Export PPTX')).not.toBeNull()
    // reuses the shipped fieldset group idiom (not a bespoke control)
    expect(container.querySelector('fieldset.rounded-md.border')).not.toBeNull()
  })

  it('localizes labels to FR', async () => {
    await i18n.changeLanguage('fr')
    render(<ExportButtons />)
    expect(screen.getByText('Exporter HTML')).not.toBeNull()
    expect(screen.getByText('Exporter PPTX')).not.toBeNull()
  })

  it('busy disables BOTH buttons (one synthesis at a time, no modal)', () => {
    busyState = true
    render(<ExportButtons />)
    for (const b of screen.getAllByRole('button')) {
      expect((b as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
