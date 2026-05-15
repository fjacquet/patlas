import { describe, expect, it } from 'vitest'
import type { VInfoRow } from '@/types'
import { inferCaptureDate, inferRvtoolsVersion, inferVCenterLabel } from './captureDate'
import type { ParsedWorkbook } from './parseXlsx'

const emptySheets: ParsedWorkbook = { sheets: new Map() }

const withMetaData = (rows: { Property: string; Value: string }[]): ParsedWorkbook => ({
  sheets: new Map([
    [
      'vMetaData',
      {
        name: 'vMetaData',
        headers: ['Property', 'Value'],
        rows: rows as unknown as Record<string, unknown>[],
      },
    ],
  ]),
})

const withVInfoHeaders = (headers: string[]): ParsedWorkbook => ({
  sheets: new Map([['vInfo', { name: 'vInfo', headers, rows: [] }]]),
})

const MTIME = 1_700_000_000_000 // 2023-11-14T22:13:20Z

describe('inferCaptureDate', () => {
  it('prefers the explicit date over everything else', () => {
    const explicit = new Date('2020-01-01T00:00:00Z')
    expect(
      inferCaptureDate('RVTools_export_all_2026-01-07_10.23.35.xlsx', MTIME, emptySheets, explicit),
    ).toBe(explicit)
  })

  it('extracts the ISO date+time from the filename', () => {
    const d = inferCaptureDate('RVTools_export_all_2026-01-07_10.23.35.xlsx', MTIME, emptySheets)
    expect(d.toISOString()).toBe('2026-01-07T10:23:35.000Z')
  })

  it('extracts a date-only filename stamp (midnight UTC)', () => {
    const d = inferCaptureDate('snap-2026-04-17.xlsx', MTIME, emptySheets)
    expect(d.toISOString()).toBe('2026-04-17T00:00:00.000Z')
  })

  it('falls back to vMetaData Exported Timestamp when filename has no ISO date', () => {
    const sheets = withMetaData([
      { Property: 'RVTools Version', Value: '4.4.0' },
      { Property: 'Exported Timestamp', Value: '2025-12-31T08:30:00Z' },
    ])
    const d = inferCaptureDate('no-iso-date.xlsx', MTIME, sheets)
    expect(d.toISOString()).toBe('2025-12-31T08:30:00.000Z')
  })

  it('falls back to mtime when neither filename nor vMetaData yields a date', () => {
    const d = inferCaptureDate('no-iso-date.xlsx', MTIME, emptySheets)
    expect(d.getTime()).toBe(MTIME)
  })

  it('falls back to mtime when the filename ISO stamp is invalid', () => {
    const d = inferCaptureDate('bad-2026-13-45.xlsx', MTIME, emptySheets)
    expect(d.getTime()).toBe(MTIME)
  })
})

describe('inferVCenterLabel', () => {
  const row = (viSdkServer: string): VInfoRow => ({ viSdkServer }) as unknown as VInfoRow

  it('returns the first non-empty viSdkServer from vinfo', () => {
    expect(inferVCenterLabel([row(''), row('vcenter.prod.local')], 'f.xlsx')).toBe(
      'vcenter.prod.local',
    )
  })

  it('falls back to the filename stem with the RVTools_export prefix stripped', () => {
    expect(inferVCenterLabel([row('')], 'RVTools_export_all_2026-01-07_MOM-vCenter.xlsx')).toBe(
      '2026-01-07_MOM-vCenter',
    )
  })

  it('returns the raw filename when nothing else is available', () => {
    expect(inferVCenterLabel([], 'estate.xlsx')).toBe('estate')
  })
})

describe('inferRvtoolsVersion', () => {
  it('reads the RVTools Version from vMetaData', () => {
    const sheets = withMetaData([{ Property: 'RVTools Version', Value: '4.4.0' }])
    expect(inferRvtoolsVersion(sheets)).toBe('4.4.0')
  })

  it('sniffs 4.0+ from the "Virtual machine tags" marker column', () => {
    expect(inferRvtoolsVersion(withVInfoHeaders(['VM', 'Virtual machine tags']))).toBe('4.0+')
  })

  it('sniffs 3.11+ from the "Creation date" marker column', () => {
    expect(inferRvtoolsVersion(withVInfoHeaders(['VM', 'Creation date']))).toBe('3.11+')
  })

  it('returns "unknown" when no signal is present', () => {
    expect(inferRvtoolsVersion(withVInfoHeaders(['VM', 'Host']))).toBe('unknown')
    expect(inferRvtoolsVersion(emptySheets)).toBe('unknown')
  })
})
