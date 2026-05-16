import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import { first } from '@/test/arrays'
import type { VHostRow } from '@/types/vhost'
import { aggregateHostsPerCluster } from './perCluster'

const host = (over: Partial<VHostRow>): VHostRow => ({
  hostName: 'esx-1',
  cluster: 'C1',
  sockets: sockets(2),
  cores: cores(12),
  speedMhz: mhz(2600),
  memoryMib: mib(262_144),
  cpuRatio: 0.3,
  ramRatio: 0.5,
  ...over,
})

describe('aggregateHostsPerCluster', () => {
  it('capacity-weighted mean CPU ratio (ADR-0011) on a 2-host cluster', () => {
    const hosts: VHostRow[] = [
      host({ hostName: 'a', cores: cores(10), speedMhz: mhz(2000), cpuRatio: 0.2 }),
      host({ hostName: 'b', cores: cores(20), speedMhz: mhz(2000), cpuRatio: 0.5 }),
    ]
    const c = first(aggregateHostsPerCluster(hosts))
    // physical = (10·2000 + 20·2000)/1000 = 60 GHz
    // consumed = (10·2000·0.2 + 20·2000·0.5)/1000 = 4 + 20 = 24 GHz
    expect(c.physicalGhz as number).toBeCloseTo(60)
    expect(c.consumedGhz as number).toBeCloseTo(24)
    expect(c.meanCpuRatio).toBeCloseTo(24 / 60) // 0.4, capacity-weighted
  })

  it('uses memoryMib (the Phase-1 rename), not memoryMb', () => {
    const c = first(aggregateHostsPerCluster([host({ memoryMib: mib(100_000), ramRatio: 0.25 })]))
    expect(c.physicalRamMib as number).toBe(100_000)
    expect(c.consumedRamMib as number).toBeCloseTo(25_000)
  })

  it('drops hosts whose cluster is empty', () => {
    const out = aggregateHostsPerCluster([host({ cluster: '' }), host({ cluster: 'C2' })])
    expect(out.map((c) => c.cluster)).toEqual(['C2'])
  })

  it('falls back to mean(ramRatio) when physicalRamMib is 0', () => {
    const c = first(
      aggregateHostsPerCluster([
        host({ hostName: 'a', memoryMib: mib(0), ramRatio: 0.2 }),
        host({ hostName: 'b', memoryMib: mib(0), ramRatio: 0.6 }),
      ]),
    )
    expect(c.meanRamRatio).toBeCloseTo(0.4)
  })
})
