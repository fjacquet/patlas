import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import type { ProxmoxSnapshotRow } from '@/types/snapshot'
import { computeSnapshotSprawl, excelSerialToUnixMs } from './snapshotSprawl'

const row = (over: Partial<ProxmoxSnapshotRow>): ProxmoxSnapshotRow => ({
  node: 'n1',
  guestId: '100',
  guestName: 'Debian',
  guestType: 'qemu',
  name: 'snap',
  parent: 'no-parent',
  dateSerial: null,
  includeRam: false,
  sizeMib: mib(0),
  ...over,
})

// 2026-06-23 is Excel serial 46196 (days since 1899-12-30).
const TODAY = new Date('2026-06-23T00:00:00Z')

describe('excelSerialToUnixMs', () => {
  it('maps the Excel epoch offset (25569 = 1970-01-01)', () => {
    expect(excelSerialToUnixMs(25569)).toBe(0)
  })
})

describe('computeSnapshotSprawl', () => {
  it('is empty for no rows', () => {
    const s = computeSnapshotSprawl([], TODAY)
    expect(s).toEqual({
      rows: [],
      count: 0,
      guestsWithSnapshots: 0,
      totalSizeMib: 0,
      oldestAgeDays: null,
    })
  })

  it('excludes the current live-state marker from sprawl', () => {
    const s = computeSnapshotSprawl(
      [row({ name: 'current' }), row({ name: 'real', guestId: '100' })],
      TODAY,
    )
    expect(s.count).toBe(1)
    expect(s.rows[0]?.name).toBe('real')
  })

  it('counts distinct guests, sums size, and reports oldest age (oldest first)', () => {
    const s = computeSnapshotSprawl(
      [
        row({ guestId: '100', name: 'old', dateSerial: 46100, sizeMib: mib(1024) }), // ~96d
        row({ guestId: '100', name: 'new', dateSerial: 46190, sizeMib: mib(512) }), //  ~6d
        row({ guestId: '200', name: 'x', dateSerial: null, sizeMib: mib(256) }),
      ],
      TODAY,
    )
    expect(s.count).toBe(3)
    expect(s.guestsWithSnapshots).toBe(2)
    expect(s.totalSizeMib).toBe(1792)
    expect(s.oldestAgeDays).toBe(96)
    // oldest first; null age sorts last.
    expect(s.rows.map((r) => r.name)).toEqual(['old', 'new', 'x'])
    expect(s.rows[2]?.ageDays).toBeNull()
  })
})
