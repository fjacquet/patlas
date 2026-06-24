import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { exportFilename } from './useExport'

describe('exportFilename', () => {
  it('uses the patlas_ prefix (not vatlas)', () => {
    const name = exportFilename('pve-prod', 1, new Date('2026-06-24T00:00:00Z'), 'pptx')
    expect(name).toBe('patlas_pve-prod_2026-06-24.pptx')
    expect(name).not.toContain('vatlas')
  })

  it('uses multi for >1 snapshot', () => {
    expect(exportFilename('ignored', 3, new Date('2026-06-24T00:00:00Z'), 'html')).toBe(
      'patlas_multi_2026-06-24.html',
    )
  })

  it('sanitizes path-traversal / unsafe chars to underscore', () => {
    const date = new Date('2026-05-18T10:00:00Z')
    expect(exportFilename('../etc/passwd', 1, date, 'html')).toBe(
      'patlas____etc_passwd_2026-05-18.html',
    )
    expect(exportFilename('a b/c:d*e', 1, date, 'pptx')).toBe('patlas_a_b_c_d_e_2026-05-18.pptx')
  })

  it('empty label falls back to "estate"', () => {
    const date = new Date('2026-05-18T10:00:00Z')
    expect(exportFilename('', 1, date, 'html')).toBe('patlas_estate_2026-05-18.html')
  })

  it('caps the sanitized label at 64 chars', () => {
    const date = new Date('2026-05-18T10:00:00Z')
    const long = 'x'.repeat(200)
    const f = exportFilename(long, 1, date, 'html')
    expect(f).toBe(`patlas_${'x'.repeat(64)}_2026-05-18.html`)
  })
})

describe('no user-facing legacy brand string', () => {
  const token = ['v', 'atlas'].join('') // assembled so this test file is not a self-match
  const files = [
    'src/hooks/useExport.ts',
    'src/components/inventory/DataTable.tsx',
    'src/engines/export/pptx/slides/titleSlide.ts',
  ]
  for (const f of files) {
    it(`${f} contains no legacy product name`, () => {
      expect(readFileSync(f, 'utf8')).not.toContain(token)
    })
  }
})
