import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import { first } from '@/test/arrays'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { aggregateClusters } from './aggregateClusters'

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

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
  vmName: 'vm-1',
  cluster: 'C1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  osConfig: '',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: mib(0),
  inUseMib: mib(0),
  ...over,
})

describe('aggregateClusters', () => {
  it('vcpuPerPcpu uses PHYSICAL cores, not threads (Moderate-4)', () => {
    // 1 host, 12 physical cores; 6 VMs × 4 vCPU = 24 vCPU.
    // vcpuPerPcpu = 24 / 12 = 2.0 — divided by physical cores.
    // There is structurally no threads field on VHostRow to mis-use.
    const vhost = [host({ cores: cores(12) })]
    const vinfo = Array.from({ length: 6 }, (_, i) => vm({ vmName: `v${i}`, vcpu: cores(4) }))
    const c = first(
      aggregateClusters({ vinfo, vhost, mode: 'active', stretchedClusters: new Set() }),
    )
    expect(c.physicalCores as number).toBe(12)
    expect(c.usablePhysicalCores as number).toBe(12)
    expect(c.vcpuPerPcpu).toBeCloseTo(2.0)
  })

  it('stretched DR math is dormant with an empty stretchedClusters set', () => {
    const c = first(
      aggregateClusters({
        vinfo: [vm({})],
        vhost: [host({})],
        mode: 'active',
        stretchedClusters: new Set(),
      }),
    )
    expect(c.stretched).toBe(false)
    expect(c.drReservedGhz as number).toBe(0)
    expect(c.drReservedRamMib as number).toBe(0)
  })

  it('sorts clusters stably by localeCompare', () => {
    const out = aggregateClusters({
      vinfo: [vm({ cluster: 'Zeta' }), vm({ cluster: 'alpha' })],
      vhost: [host({ cluster: 'Zeta' }), host({ cluster: 'alpha', hostName: 'esx-2' })],
      mode: 'active',
      stretchedClusters: new Set(),
    })
    expect(out.map((c) => c.cluster)).toEqual(['alpha', 'Zeta'])
  })

  it('threads accounting mode into the VM rollup', () => {
    const vinfo = [
      vm({ vmName: 'on', poweredOn: true, vcpu: cores(4) }),
      vm({ vmName: 'off', poweredOn: false, vcpu: cores(8) }),
    ]
    const cfg = first(
      aggregateClusters({
        vinfo,
        vhost: [host({})],
        mode: 'configured',
        stretchedClusters: new Set(),
      }),
    )
    const act = first(
      aggregateClusters({
        vinfo,
        vhost: [host({})],
        mode: 'active',
        stretchedClusters: new Set(),
      }),
    )
    expect(cfg.vcpuAllocated as number).toBe(12)
    expect(act.vcpuAllocated as number).toBe(4)
  })
})
