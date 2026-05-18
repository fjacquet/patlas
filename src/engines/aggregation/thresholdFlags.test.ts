import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import type { DatastoreAggregate } from '@/types/estate'
import type { VPartitionRow } from '@/types/snapshot'
import { computeThresholdFlags } from './thresholdFlags'

const part = (over: Partial<VPartitionRow>): VPartitionRow => ({
  vmName: 'vm-1',
  disk: '/',
  capacityMib: mib(1000),
  consumedMib: mib(500),
  freeMib: mib(500),
  ...over,
})

const dsAgg = (usedRatio: number, key = 'ds'): DatastoreAggregate => ({
  key,
  name: key,
  type: 'VMFS',
  capacityMib: mib(1000),
  freeMib: mib(1000 * (1 - usedRatio)),
  usedMib: mib(1000 * usedRatio),
  usedRatio,
  provisionedMib: mib(800),
  overProvisionRatio: 0.8,
  sharedDuplicateCount: 1,
})

const DEFAULTS = { fsUsedPct: 90, dsUsedPct: 85, luUsedPct: 85 }

describe('computeThresholdFlags — factual flags (D-04)', () => {
  it('flags a filesystem at/over the line and not below (≥ boundary)', () => {
    const out = computeThresholdFlags(
      [
        part({ consumedMib: mib(900) }), // exactly 90% → flagged (≥)
        part({ consumedMib: mib(899) }), // 89.9% → not flagged
      ],
      [],
      DEFAULTS,
    )
    expect(out.fsFlagged).toEqual([true, false])
    expect(out.counts.fs).toBe(1)
  })

  it('flags a datastore strictly OVER the line (> boundary), LU on its own line', () => {
    const out = computeThresholdFlags([], [dsAgg(0.85, 'exact'), dsAgg(0.86, 'over')], DEFAULTS)
    // 85% is NOT > 85 → not flagged; 86% is
    expect(out.dsFlagged).toEqual([false, true])
    expect(out.luFlagged).toEqual([false, true])
    expect(out.counts.ds).toBe(1)
    expect(out.counts.lu).toBe(1)
  })

  it('honours edited thresholds (LU line independent of datastore line)', () => {
    const out = computeThresholdFlags([], [dsAgg(0.7)], {
      fsUsedPct: 90,
      dsUsedPct: 85,
      luUsedPct: 60,
    })
    expect(out.dsFlagged).toEqual([false]) // 70% not > 85
    expect(out.luFlagged).toEqual([true]) // 70% > 60
  })

  it('guards capacityMib === 0 (no divide-by-zero, not flagged)', () => {
    const out = computeThresholdFlags(
      [part({ capacityMib: mib(0), consumedMib: mib(0) })],
      [],
      DEFAULTS,
    )
    expect(out.fsFlagged).toEqual([false])
    expect(Number.isFinite(out.counts.fs)).toBe(true)
    expect(out.counts.fs).toBe(0)
  })
})
