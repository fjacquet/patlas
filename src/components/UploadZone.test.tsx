import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { UploadZone } from './UploadZone'

const file = (name: string): File => new File(['x'], name, { type: 'application/octet-stream' })

const fileInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('file input not found')
  return input
}

describe('UploadZone accept filter', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('accepts a Proxmox .zip bundle (the regression: it was filtered out)', () => {
    const onFiles = vi.fn()
    const { container } = render(<UploadZone onFiles={onFiles} />)
    fireEvent.change(fileInput(container), { target: { files: [file('Report_20260623_093049.zip')] } })
    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0]?.[0]?.[0]?.name).toBe('Report_20260623_093049.zip')
  })

  it('still accepts a bare .xlsx', () => {
    const onFiles = vi.fn()
    const { container } = render(<UploadZone onFiles={onFiles} />)
    fireEvent.change(fileInput(container), { target: { files: [file('report.xlsx')] } })
    expect(onFiles).toHaveBeenCalledTimes(1)
  })

  it('filters out unsupported formats (no onFiles call)', () => {
    const onFiles = vi.fn()
    const { container } = render(<UploadZone onFiles={onFiles} />)
    fireEvent.change(fileInput(container), { target: { files: [file('notes.txt')] } })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('keeps only the supported files from a mixed selection', () => {
    const onFiles = vi.fn()
    const { container } = render(<UploadZone onFiles={onFiles} />)
    fireEvent.change(fileInput(container), {
      target: { files: [file('a.zip'), file('b.txt'), file('c.xlsx')] },
    })
    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0]?.[0]?.map((f: File) => f.name)).toEqual(['a.zip', 'c.xlsx'])
  })

  it('exposes both extensions on the input accept attribute', () => {
    const { container } = render(<UploadZone onFiles={() => {}} />)
    expect(fileInput(container).getAttribute('accept')).toBe('.zip,.xlsx')
  })
})
