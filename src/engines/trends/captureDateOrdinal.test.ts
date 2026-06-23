import { describe, expect, it } from 'vitest'
import { bytes } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import { captureDateOrdinal } from './captureDateOrdinal'

// Minimal Snapshot factory — captureDateOrdinal only reads id/parsedAt/
// capturedAt; the rest is shaped to satisfy the interface (mirrors the
// estateView.test.ts partial-override factory idiom).
const snap = (over: Partial<Snapshot> & { id: string }): Snapshot => ({
  filename: `${over.id}.xlsx`,
  fileSize: bytes(1024),
  capturedAt: new Date('2026-01-01T00:00:00Z'),
  vCenterLabel: 'vc',
  rvtoolsVersion: '4.4',
  parsedAt: new Date('2026-01-01T00:00:00Z'),
  source: 'proxmox',
  viSdkUuid: null,
  vMetaData: [],
  vinfo: [],
  vhost: [],
  vmUsage: [],
  proxmoxSnapshots: [],
  proxmoxStorageContent: [],
  vdatastore: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  parseErrors: [],
  ...over,
})

describe('captureDateOrdinal', () => {
  it('returns a stable load order: ascending parsedAt, tiebroken by id', () => {
    const out = captureDateOrdinal([
      snap({ id: 'c', parsedAt: new Date('2026-03-01') }),
      snap({ id: 'a', parsedAt: new Date('2026-01-01') }),
      snap({ id: 'b', parsedAt: new Date('2026-01-01') }), // same parsedAt as a → id tiebreak
    ])
    expect(out.loadOrder.get('a')).toBe(0)
    expect(out.loadOrder.get('b')).toBe(1)
    expect(out.loadOrder.get('c')).toBe(2)
  })

  it('distinct real capture dates: no ordinal assigned, orderInferred false', () => {
    const out = captureDateOrdinal([
      snap({ id: 'a', capturedAt: new Date('2026-01-31'), parsedAt: new Date('2026-02-01') }),
      snap({ id: 'b', capturedAt: new Date('2026-02-28'), parsedAt: new Date('2026-03-01') }),
    ])
    expect(out.ordinal.get('a')).toBeNull()
    expect(out.ordinal.get('b')).toBeNull()
    expect(out.orderInferred).toBe(false)
  })

  it('same calendar day with real dates: each still gets a deterministic load-order index, no ordinal', () => {
    const out = captureDateOrdinal([
      snap({ id: 'y', capturedAt: new Date('2026-02-15'), parsedAt: new Date('2026-02-16') }),
      snap({ id: 'x', capturedAt: new Date('2026-02-15'), parsedAt: new Date('2026-02-15') }),
    ])
    expect(out.loadOrder.get('x')).toBe(0)
    expect(out.loadOrder.get('y')).toBe(1)
    // Real (determinable) dates → Task 2 spatially merges same-day points;
    // the helper does not fabricate an ordinal here.
    expect(out.ordinal.get('x')).toBeNull()
    expect(out.ordinal.get('y')).toBeNull()
    expect(out.orderInferred).toBe(false)
  })

  it('undeterminable capture date (epoch fallback): gets an ordinal and orderInferred is true', () => {
    const out = captureDateOrdinal([
      snap({ id: 'real', capturedAt: new Date('2026-01-31'), parsedAt: new Date('2026-02-01') }),
      snap({ id: 'epoch', capturedAt: new Date(0), parsedAt: new Date('2026-02-02') }),
      snap({ id: 'nan', capturedAt: new Date('not-a-date'), parsedAt: new Date('2026-02-03') }),
    ])
    expect(out.ordinal.get('real')).toBeNull()
    expect(out.ordinal.get('epoch')).toBe(out.loadOrder.get('epoch'))
    expect(out.ordinal.get('nan')).toBe(out.loadOrder.get('nan'))
    expect(out.orderInferred).toBe(true)
  })

  it('is pure: repeat calls deeply equal; input array not mutated', () => {
    const input = [
      snap({ id: 'b', parsedAt: new Date('2026-02-01') }),
      snap({ id: 'a', parsedAt: new Date('2026-01-01') }),
    ]
    const snapshot = input.map((s) => s.id)
    const a = captureDateOrdinal(input)
    const b = captureDateOrdinal(input)
    expect([...a.loadOrder.entries()]).toEqual([...b.loadOrder.entries()])
    expect([...a.ordinal.entries()]).toEqual([...b.ordinal.entries()])
    expect(a.orderInferred).toBe(b.orderInferred)
    expect(input.map((s) => s.id)).toEqual(snapshot) // not reordered in place
  })
})
