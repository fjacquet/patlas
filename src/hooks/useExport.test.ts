import { describe, expect, it } from 'vitest'
import { exportFilename } from './useExport'

describe('exportFilename — D-05 / T-10-19', () => {
  const date = new Date('2026-05-18T10:00:00Z')

  it('single snapshot: vatlas_{sanitized vCenter}_{ISO}.{ext}', () => {
    expect(exportFilename('spvspherevc11', 1, date, 'html')).toBe(
      'vatlas_spvspherevc11_2026-05-18.html',
    )
    expect(exportFilename('spvspherevc11', 1, date, 'pptx')).toBe(
      'vatlas_spvspherevc11_2026-05-18.pptx',
    )
  })

  it('>1 snapshot collapses to "multi"', () => {
    expect(exportFilename('anything', 3, date, 'html')).toBe('vatlas_multi_2026-05-18.html')
  })

  it('sanitizes path-traversal / unsafe chars to underscore', () => {
    expect(exportFilename('../etc/passwd', 1, date, 'html')).toBe(
      'vatlas____etc_passwd_2026-05-18.html',
    )
    expect(exportFilename('a b/c:d*e', 1, date, 'pptx')).toBe('vatlas_a_b_c_d_e_2026-05-18.pptx')
  })

  it('empty label falls back to "estate"', () => {
    expect(exportFilename('', 1, date, 'html')).toBe('vatlas_estate_2026-05-18.html')
  })

  it('caps the sanitized label at 64 chars', () => {
    const long = 'x'.repeat(200)
    const f = exportFilename(long, 1, date, 'html')
    expect(f).toBe(`vatlas_${'x'.repeat(64)}_2026-05-18.html`)
  })
})
