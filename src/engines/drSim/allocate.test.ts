import { describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import type { ClusterAggregate } from '@/types/estate'
import { survivorVerdict } from './allocate'

type V = Pick<
  ClusterAggregate,
  'vcpuAllocated' | 'vramAllocatedMib' | 'capacityVcpu' | 'capacityRamMib'
>
const c = (over: Partial<V>): V => ({
  vcpuAllocated: cores(40),
  vramAllocatedMib: mib(40),
  capacityVcpu: cores(100),
  capacityRamMib: mib(100),
  ...over,
})

describe('survivorVerdict — factual band + worse-of (DRS-06)', () => {
  it('absorbs when ≤ 80% of capacity on both resources', () => {
    expect(survivorVerdict(c({ vcpuAllocated: cores(80), vramAllocatedMib: mib(80) }))).toBe(
      'absorbs',
    )
  })

  it('tight when between 80% and 100% capacity', () => {
    expect(survivorVerdict(c({ vcpuAllocated: cores(90) }))).toBe('tight')
    expect(survivorVerdict(c({ vcpuAllocated: cores(100) }))).toBe('tight')
  })

  it('overflows above capacity', () => {
    expect(survivorVerdict(c({ vcpuAllocated: cores(101) }))).toBe('overflows')
  })

  it('reports the WORSE of CPU and RAM (RAM tight, CPU absorbs → tight)', () => {
    expect(survivorVerdict(c({ vcpuAllocated: cores(10), vramAllocatedMib: mib(95) }))).toBe(
      'tight',
    )
    expect(survivorVerdict(c({ vcpuAllocated: cores(200), vramAllocatedMib: mib(1) }))).toBe(
      'overflows',
    )
  })

  it('zero-capacity is degenerate: any allocation overflows, none absorbs', () => {
    expect(survivorVerdict(c({ capacityVcpu: cores(0), vcpuAllocated: cores(1) }))).toBe(
      'overflows',
    )
    expect(
      survivorVerdict(
        c({
          capacityVcpu: cores(0),
          vcpuAllocated: cores(0),
          capacityRamMib: mib(0),
          vramAllocatedMib: mib(0),
        }),
      ),
    ).toBe('absorbs')
  })
})
