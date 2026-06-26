import { describe, expect, it } from 'vitest'
import type { RrdStorageRow } from '@/types/snapshot'
import { computeRrdStorageGrowth } from './rrdStorageGrowth'

const sample = (over: Partial<RrdStorageRow>): RrdStorageRow => ({
  node: 'pve1',
  storage: 'local',
  timeSerial: 46198,
  sizeGib: 200,
  usedGib: 0,
  usageRatio: 0,
  ...over,
})

// One growing storage (10 GiB/day, large serials to exercise x-centring) and
// one flat storage. The growing one fills in (200-120)/10 = 8 days.
const rows: RrdStorageRow[] = [
  sample({ storage: 'data', timeSerial: 46198, usedGib: 100, usageRatio: 0.5 }),
  sample({ storage: 'data', timeSerial: 46199, usedGib: 110, usageRatio: 0.55 }),
  sample({ storage: 'data', timeSerial: 46200, usedGib: 120, usageRatio: 0.6 }),
  sample({ storage: 'local', timeSerial: 46198, sizeGib: 100, usedGib: 50, usageRatio: 0.5 }),
  sample({ storage: 'local', timeSerial: 46199, sizeGib: 100, usedGib: 50, usageRatio: 0.5 }),
  sample({ storage: 'local', timeSerial: 46200, sizeGib: 100, usedGib: 50, usageRatio: 0.5 }),
]

describe('computeRrdStorageGrowth', () => {
  it('returns the empty result for no samples', () => {
    const r = computeRrdStorageGrowth([])
    expect(r.hasData).toBe(false)
    expect(r.rows).toHaveLength(0)
    expect(r.soonestDaysToFull).toBeNull()
  })

  it('derives growth rate and projects days-to-full from the latest sample', () => {
    const r = computeRrdStorageGrowth(rows)
    expect(r.hasData).toBe(true)
    const data = r.rows.find((x) => x.storage === 'data')
    expect(data?.growthGibPerDay).toBeCloseTo(10)
    expect(data?.usedGib).toBe(120) // latest (max-serial) sample
    expect(data?.daysToFull).toBeCloseTo(8) // (200 - 120) / 10
    expect(data?.sampleCount).toBe(3)
  })

  it('reports null days-to-full for a flat (non-growing) storage', () => {
    const r = computeRrdStorageGrowth(rows)
    const local = r.rows.find((x) => x.storage === 'local')
    expect(local?.growthGibPerDay).toBeCloseTo(0)
    expect(local?.daysToFull).toBeNull()
  })

  it('caps absurd horizons (noise-level slope) to a null projection', () => {
    // Grows 0.001 GiB/day toward a 1000 GiB cap from 100 used → ~900k days
    // (~2465 years) — beyond the ~100-year horizon ⇒ not projectable.
    const slow: RrdStorageRow[] = [
      sample({ storage: 'slow', timeSerial: 0, sizeGib: 1000, usedGib: 100 }),
      sample({ storage: 'slow', timeSerial: 1, sizeGib: 1000, usedGib: 100.001 }),
      sample({ storage: 'slow', timeSerial: 2, sizeGib: 1000, usedGib: 100.002 }),
    ]
    const r = computeRrdStorageGrowth(slow)
    const row = r.rows.find((x) => x.storage === 'slow')
    expect(row?.growthGibPerDay).toBeGreaterThan(0)
    expect(row?.daysToFull).toBeNull()
    expect(r.soonestDaysToFull).toBeNull()
  })

  it('sorts soonest-to-full first and exposes the soonest + window span', () => {
    const r = computeRrdStorageGrowth(rows)
    expect(r.rows[0]?.storage).toBe('data') // projectable, sinks the null one
    expect(r.soonestDaysToFull).toBeCloseTo(8)
    expect(r.windowDays).toBeCloseTo(2) // 46200 - 46198
  })
})
