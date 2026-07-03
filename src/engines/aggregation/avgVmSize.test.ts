import { describe, expect, it } from 'vitest'
import { type Cores, cores, type MiB, mib } from '@/engines/units'
import type { GuestRow } from '@/types/guest'
import { computeAvgVmSize, emptyAvgVmSize } from './avgVmSize'

const vm = (over: Partial<GuestRow> = {}): GuestRow => ({
  vmName: 'vm',
  cluster: 'C1',
  host: 'h1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  powerState: 'poweredOn',
  template: false,
  poweredOn: true,
  osConfig: '',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(0),
  inUseMib: mib(0),
  path: '',
  ...over,
})

describe('computeAvgVmSize', () => {
  it('computes mean and median over an odd-sized population', () => {
    const res = computeAvgVmSize(
      [
        vm({ vmName: 'a', vcpu: cores(2), vramMib: mib(1000), provisionedMib: mib(100) }),
        vm({ vmName: 'b', vcpu: cores(4), vramMib: mib(2000), provisionedMib: mib(200) }),
        vm({ vmName: 'c', vcpu: cores(6), vramMib: mib(3000), provisionedMib: mib(300) }),
      ],
      'configured',
    )
    expect(res.vmCount).toBe(3)
    expect(res.vcpu.mean).toBe(4)
    expect(res.vcpu.median).toBe(4)
    expect(res.vramMib.mean).toBe(2000)
    expect(res.vramMib.median).toBe(2000)
    expect(res.provisionedMib.mean).toBe(200)
    expect(res.provisionedMib.median).toBe(200)
  })

  it('computes the median as the mean of the two middle values for an even-sized population', () => {
    const res = computeAvgVmSize(
      [
        vm({ vmName: 'a', vcpu: cores(2) }),
        vm({ vmName: 'b', vcpu: cores(4) }),
        vm({ vmName: 'c', vcpu: cores(6) }),
        vm({ vmName: 'd', vcpu: cores(8) }),
      ],
      'configured',
    )
    expect(res.vmCount).toBe(4)
    expect(res.vcpu.median).toBe(5)
    expect(res.vcpu.mean).toBe(5)
  })

  it('median is order-independent (sorts before pairing the middle values)', () => {
    const res = computeAvgVmSize(
      [
        vm({ vmName: 'a', vcpu: cores(8) }),
        vm({ vmName: 'b', vcpu: cores(2) }),
        vm({ vmName: 'c', vcpu: cores(6) }),
        vm({ vmName: 'd', vcpu: cores(4) }),
      ],
      'configured',
    )
    expect(res.vcpu.median).toBe(5)
  })

  it('configured mode counts powered-off VMs', () => {
    const res = computeAvgVmSize(
      [
        vm({ vmName: 'on', vcpu: cores(4), poweredOn: true }),
        vm({ vmName: 'off', vcpu: cores(8), poweredOn: false, powerState: 'poweredOff' }),
      ],
      'configured',
    )
    expect(res.vmCount).toBe(2)
    expect(res.vcpu.mean).toBe(6)
  })

  it('active mode excludes powered-off VMs', () => {
    const res = computeAvgVmSize(
      [
        vm({ vmName: 'on', vcpu: cores(4), poweredOn: true }),
        vm({ vmName: 'off', vcpu: cores(8), poweredOn: false, powerState: 'poweredOff' }),
      ],
      'active',
    )
    expect(res.vmCount).toBe(1)
    expect(res.vcpu.mean).toBe(4)
  })

  it('returns the frozen empty constant for empty input', () => {
    const res = computeAvgVmSize([], 'configured')
    expect(res).toEqual(emptyAvgVmSize)
  })

  it('returns the frozen empty constant when active mode filters the population to empty', () => {
    const res = computeAvgVmSize(
      [vm({ vmName: 'off', poweredOn: false, powerState: 'poweredOff' })],
      'active',
    )
    expect(res).toEqual(emptyAvgVmSize)
  })

  it('preserves branded units on the result', () => {
    const res = computeAvgVmSize([vm()], 'configured')
    const vcpuMean: Cores = res.vcpu.mean
    const vcpuMedian: Cores = res.vcpu.median
    const vramMean: MiB = res.vramMib.mean
    const vramMedian: MiB = res.vramMib.median
    const provMean: MiB = res.provisionedMib.mean
    const provMedian: MiB = res.provisionedMib.median
    expect([vcpuMean, vcpuMedian, vramMean, vramMedian, provMean, provMedian]).toEqual([
      4, 4, 8192, 8192, 0, 0,
    ])
  })
})

describe('emptyAvgVmSize', () => {
  it('is frozen and all-zero', () => {
    expect(Object.isFrozen(emptyAvgVmSize)).toBe(true)
    expect(emptyAvgVmSize).toEqual({
      vmCount: 0,
      vcpu: { mean: cores(0), median: cores(0) },
      vramMib: { mean: mib(0), median: mib(0) },
      provisionedMib: { mean: mib(0), median: mib(0) },
    })
  })
})
