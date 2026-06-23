import { describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import { first } from '@/test/arrays'
import type { VInfoRow } from '@/types/vinfo'
import { aggregateVmsPerCluster, readinessStats, topReadinessVmsByCluster } from './vinfoMerge'

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
  vmName: 'vm-1',
  cluster: 'C1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn',
  template: false,
  osConfig: 'Ubuntu Linux (64-bit)',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '',
  ...over,
})

describe('readinessStats (ADR-0012)', () => {
  it('arithmetic mean, reduce-not-spread max, count > 5 %', () => {
    const rows = [
      vm({ cpuReadinessPercent: 2 }),
      vm({ cpuReadinessPercent: 8 }),
      vm({ cpuReadinessPercent: 20 }),
    ]
    const s = readinessStats(rows)
    expect(s.mean).toBeCloseTo(10)
    expect(s.max).toBe(20)
    expect(s.countAboveWarning).toBe(2) // 8 and 20 exceed 5
    expect(s.available).toBe(true)
  })

  it('returns null mean + available=false when no VM reports (never 0)', () => {
    const s = readinessStats([vm({ cpuReadinessPercent: null })])
    expect(s.mean).toBeNull()
    expect(s.max).toBeNull()
    expect(s.available).toBe(false)
  })

  it('is always powered-on-only — a powered-off VM has no CPU Ready', () => {
    const s = readinessStats([vm({ poweredOn: false, cpuReadinessPercent: 99 })])
    expect(s.available).toBe(false)
  })
})

describe('aggregateVmsPerCluster — accounting modes (Critical-6)', () => {
  const rows = [
    vm({ vmName: 'on', poweredOn: true, vcpu: cores(4), vramMib: mib(8192) }),
    vm({ vmName: 'off', poweredOn: false, vcpu: cores(2), vramMib: mib(4096) }),
  ]

  it('configured keeps powered-off VMs in vCPU/vRAM sums', () => {
    const c = first(aggregateVmsPerCluster(rows, 'configured'))
    expect(c.vmCount).toBe(2)
    expect(c.vcpuAllocated as number).toBe(6)
    expect(c.vramAllocatedMib as number).toBe(12_288)
  })

  it('active excludes powered-off VMs', () => {
    const c = first(aggregateVmsPerCluster(rows, 'active'))
    expect(c.vmCount).toBe(1)
    expect(c.vcpuAllocated as number).toBe(4)
  })

  it('readinessStats is mode-independent (always powered-on-only)', () => {
    const withReady = [
      vm({ vmName: 'on', poweredOn: true, cpuReadinessPercent: 12 }),
      vm({ vmName: 'off', poweredOn: false, cpuReadinessPercent: 99 }),
    ]
    const cfg = first(aggregateVmsPerCluster(withReady, 'configured'))
    const act = first(aggregateVmsPerCluster(withReady, 'active'))
    expect(cfg.meanCpuReadinessPercent).toBeCloseTo(12)
    expect(act.meanCpuReadinessPercent).toBeCloseTo(12)
  })
})

describe('topReadinessVmsByCluster', () => {
  it('sorts reporters desc and caps at topN', () => {
    const rows = [
      vm({ vmName: 'lo', cpuReadinessPercent: 3 }),
      vm({ vmName: 'hi', cpuReadinessPercent: 30 }),
      vm({ vmName: 'mid', cpuReadinessPercent: 15 }),
    ]
    const top = topReadinessVmsByCluster(rows, 2).get('C1')
    expect(top?.map((t) => t.vmName)).toEqual(['hi', 'mid'])
  })
})
