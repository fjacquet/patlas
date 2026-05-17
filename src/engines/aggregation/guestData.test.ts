import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import type { VInfoRow, VPartitionRow } from '@/types'
import { aggregateGuestData } from './guestData'

const part = (over: Partial<VPartitionRow>): VPartitionRow => ({
  vmName: 'vm-a',
  disk: 'C:\\',
  capacityMib: mib(100),
  consumedMib: mib(40),
  freeMib: mib(60),
  ...over,
})

const vm = (vmName: string, cluster: string): VInfoRow =>
  ({ vmName, cluster }) as unknown as VInfoRow

describe('aggregateGuestData (P5)', () => {
  it('no vPartition → estate null (factual, never invented 0)', () => {
    const r = aggregateGuestData([], [vm('vm-a', 'C1')])
    expect(r.estate).toBeNull()
    expect(r.byCluster.size).toBe(0)
  })

  it('sums estate + per-cluster from real partitions', () => {
    const r = aggregateGuestData(
      [
        part({ vmName: 'a', capacityMib: mib(100), consumedMib: mib(40) }),
        part({ vmName: 'a', disk: 'D:\\', capacityMib: mib(50), consumedMib: mib(10) }),
        part({ vmName: 'b', capacityMib: mib(200), consumedMib: mib(150) }),
      ],
      [vm('a', 'C1'), vm('b', 'C2')],
    )
    expect(r.estate?.capacityMib as number).toBe(350)
    expect(r.estate?.consumedMib as number).toBe(200)
    expect(r.byCluster.get('C1')?.consumedMib as number).toBe(50)
    expect(r.byCluster.get('C2')?.consumedMib as number).toBe(150)
  })

  it('a partition whose VM is unmatched still counts estate-wide, not per-cluster', () => {
    const r = aggregateGuestData([part({ vmName: 'ghost', consumedMib: mib(7) })], [vm('a', 'C1')])
    expect(r.estate?.consumedMib as number).toBe(7)
    expect(r.byCluster.size).toBe(0)
  })
})
