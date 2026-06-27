import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import enPptx from '../i18n/locales/en/pptx.json'
import enProtection from '../i18n/locales/en/protection.json'
import enReport from '../i18n/locales/en/report.json'
import { buildExportStrings, exportFilename } from './useExport'

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

describe('buildExportStrings', () => {
  const bag = buildExportStrings(
    enReport as Record<string, unknown>,
    enPptx as Record<string, unknown>,
    enProtection as Record<string, unknown>,
  )

  it('resolves Protection slide/report labels from the protection namespace', () => {
    // Before this change only `report` + `pptx` were merged into the export
    // bag, so every `protection.*` lookup in the PPTX slides AND the HTML report
    // fell back to English in every locale. They must now resolve.
    expect(bag['protection.fsFill.heading']).toBe('Filesystem fill')
    expect(bag['protection.fsFill.col.node']).toBe('Node')
    expect(bag['protection.backupCoverage.heading']).toBe('Backup coverage')
    expect(bag['protection.backupCoverage.uncovered.heading']).toBe('VMs without successful backup')
    expect(bag['protection.diskHygiene.heading']).toBe('Disk hygiene')
  })

  it('still resolves report and pptx keys', () => {
    expect(bag['overview.vms']).toBe('Guests') // pptx namespace, unchanged
  })

  it('merges report, then protection (prefixed), then pptx — pptx wins on overlap', () => {
    const out = buildExportStrings(
      { a: 'from-report' },
      { protection: { x: 'from-pptx' } },
      { x: 'from-protection' },
    )
    expect(out.a).toBe('from-report')
    expect(out['protection.x']).toBe('from-pptx') // pptx merged last → wins
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
