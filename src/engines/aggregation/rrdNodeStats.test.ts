import { describe, expect, it } from 'vitest'
import type { RrdNodeRow } from '@/types/snapshot'
import { computeRrdNodeStats, EMPTY_RRD_HEADROOM } from './rrdNodeStats'

const sample = (over: Partial<RrdNodeRow>): RrdNodeRow => ({
  node: 'pve1',
  timeSerial: 100,
  cpuRatio: 0,
  memRatio: 0,
  ioWaitRatio: 0,
  loadavg: 0,
  netInMb: 0,
  netOutMb: 0,
  psiMemSomeRatio: 0,
  ...over,
})

// Two nodes, three timestamps each, all sampled at the SAME serials so the
// estate timeline collapses each timestamp into one averaged point.
const rows: RrdNodeRow[] = [
  sample({ node: 'A', timeSerial: 100, cpuRatio: 0.1, memRatio: 0.4, netInMb: 1 }),
  sample({ node: 'A', timeSerial: 101, cpuRatio: 0.2, memRatio: 0.5, netInMb: 2 }),
  sample({
    node: 'A',
    timeSerial: 102,
    cpuRatio: 0.3,
    memRatio: 0.6,
    netInMb: 3,
    ioWaitRatio: 0.05,
  }),
  sample({ node: 'B', timeSerial: 100, cpuRatio: 0.2, memRatio: 0.1, netInMb: 10 }),
  sample({ node: 'B', timeSerial: 101, cpuRatio: 0.4, memRatio: 0.2, netInMb: 20 }),
  sample({
    node: 'B',
    timeSerial: 102,
    cpuRatio: 0.6,
    memRatio: 0.3,
    netInMb: 30,
    psiMemSomeRatio: 0.02,
  }),
]

describe('computeRrdNodeStats', () => {
  it('returns the frozen empty result for no samples', () => {
    const r = computeRrdNodeStats([])
    expect(r).toBe(EMPTY_RRD_HEADROOM)
    expect(r.hasData).toBe(false)
    expect(r.windowStartSerial).toBeNull()
  })

  it('computes per-node peak / avg / p95 for CPU and memory', () => {
    const { perNode } = computeRrdNodeStats(rows)
    // Sorted by cpuPeak desc → B (0.6) first, A (0.3) second.
    expect(perNode.map((n) => n.node)).toEqual(['B', 'A'])
    const a = perNode.find((n) => n.node === 'A')
    expect(a?.cpuPeak).toBeCloseTo(0.3)
    expect(a?.cpuAvg).toBeCloseTo(0.2)
    expect(a?.cpuP95).toBeCloseTo(0.3) // nearest-rank over 3 samples = max
    expect(a?.memPeak).toBeCloseTo(0.6)
    expect(a?.memAvg).toBeCloseTo(0.5)
    expect(a?.sampleCount).toBe(3)
    const b = perNode.find((n) => n.node === 'B')
    expect(b?.cpuPeak).toBeCloseTo(0.6)
    expect(b?.psiMemPeak).toBeCloseTo(0.02)
  })

  it('computes estate-wide peak/avg across all samples', () => {
    const { estate, hasData } = computeRrdNodeStats(rows)
    expect(hasData).toBe(true)
    expect(estate.cpuPeak).toBeCloseTo(0.6)
    expect(estate.cpuAvg).toBeCloseTo(0.3) // 1.8 / 6
    expect(estate.memPeak).toBeCloseTo(0.6)
    expect(estate.memAvg).toBeCloseTo(0.35) // 2.1 / 6
    expect(estate.ioWaitPeak).toBeCloseTo(0.05)
    expect(estate.psiMemPeak).toBeCloseTo(0.02)
  })

  it('collapses same-timestamp samples into one averaged timeline point and sums net', () => {
    const { timeline, windowStartSerial, windowEndSerial } = computeRrdNodeStats(rows)
    expect(timeline).toHaveLength(3)
    expect(timeline.map((p) => p.timeSerial)).toEqual([100, 101, 102])
    expect(timeline[0]?.cpuAvg).toBeCloseTo(0.15) // (0.1 + 0.2) / 2
    expect(timeline[0]?.memAvg).toBeCloseTo(0.25) // (0.4 + 0.1) / 2
    expect(timeline[0]?.netInMb).toBeCloseTo(11) // 1 + 10 (summed)
    expect(windowStartSerial).toBe(100)
    expect(windowEndSerial).toBe(102)
  })
})
