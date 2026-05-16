import { describe, expect, it } from 'vitest'
import { cores, ghz, mib } from '@/engines/units'
import type { ClusterAggregate } from '@/types/estate'
import { aggregateGlobals, emptySummary } from './globals'

const cluster = (over: Partial<ClusterAggregate>): ClusterAggregate => ({
  cluster: 'C1',
  hostCount: 2,
  vmCount: 10,
  physicalCores: cores(24),
  usablePhysicalCores: cores(24),
  vcpuPerPcpu: 0,
  physicalGhz: ghz(60),
  consumedGhz: ghz(24),
  availableGhz: ghz(36),
  physicalRamMib: mib(524_288),
  consumedRamMib: mib(262_144),
  drReservedRamMib: mib(0),
  availableRamMib: mib(262_144),
  meanCpuRatio: 0.4,
  maxCpuRatio: 0.5,
  minCpuRatio: 0.3,
  meanRamRatio: 0.5,
  maxRamRatio: 0.6,
  minRamRatio: 0.4,
  vcpuAllocated: cores(48),
  vramAllocatedMib: mib(196_608),
  mhzPerVcpu: 500,
  stretched: false,
  drReservedGhz: ghz(0),
  meanCpuReadinessPercent: null,
  maxCpuReadinessPercent: null,
  vmsAboveReadinessWarning: 0,
  readinessAvailable: false,
  ...over,
})

describe('aggregateGlobals', () => {
  it('sums every cluster field', () => {
    const g = aggregateGlobals([
      cluster({ cluster: 'A', hostCount: 2, vmCount: 10, vcpuAllocated: cores(48) }),
      cluster({ cluster: 'B', hostCount: 3, vmCount: 5, vcpuAllocated: cores(20) }),
    ])
    expect(g.clusterCount).toBe(2)
    expect(g.hostCount).toBe(5)
    expect(g.vmCount).toBe(15)
    expect(g.vcpuAllocated as number).toBe(68)
    expect(g.physicalGhz as number).toBe(120)
  })

  it('emptySummary is frozen with the null-not-zero readiness contract', () => {
    expect(Object.isFrozen(emptySummary)).toBe(true)
    expect(emptySummary.vmsAboveReadinessWarning).toBeNull()
    expect(emptySummary.datastoreCount).toBe(0)
    expect(emptySummary.totalStorageMib as number).toBe(0)
  })

  it('carries datastoreCount / totalStorageMib through (DSH-02)', () => {
    const g = aggregateGlobals([cluster({})], 7, mib(999))
    expect(g.datastoreCount).toBe(7)
    expect(g.totalStorageMib as number).toBe(999)
  })

  it('empty estate returns the frozen empty summary with datastore totals', () => {
    const g = aggregateGlobals([], 3, mib(100))
    expect(g.clusterCount).toBe(0)
    expect(g.datastoreCount).toBe(3)
    expect(g.totalStorageMib as number).toBe(100)
  })
})
