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
  faultDomain: '',
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

  it('applies the 50 % stretched-cluster DR reservation (ADR-0007) when flagged', () => {
    // The stretched math is dormant in Phase 2 (callers pass an empty
    // set) but ports INTACT for Phase 4 — exercise it directly so the
    // DR-factor branches are regression-covered (threat T-02-06).
    // 1 host: 12 cores × 2600 MHz = 31.2 GHz physical.
    const c = first(
      aggregateClusters({
        vinfo: [vm({ cluster: 'STR', vcpu: cores(4) })],
        vhost: [host({ cluster: 'STR', cores: cores(12), speedMhz: mhz(2600), cpuRatio: 0.25 })],
        mode: 'active',
        stretchedClusters: new Set(['STR']),
      }),
    )
    expect(c.stretched).toBe(true)
    const physical = 31.2
    expect(c.physicalGhz as number).toBeCloseTo(physical)
    expect(c.drReservedGhz as number).toBeCloseTo(0.5 * physical)
    // available = physical − consumed − drReserved.
    const consumed = physical * 0.25
    expect(c.availableGhz as number).toBeCloseTo(physical - consumed - 0.5 * physical)
    // DR factor doubles the utilization ratios (physical / (physical/2) = 2).
    expect(c.meanCpuRatio).toBeCloseTo(0.25 * 2)
    // usablePhysicalCores halved → vcpuPerPcpu doubles vs non-stretched.
    expect(c.usablePhysicalCores as number).toBeCloseTo(6)
    expect(c.vcpuPerPcpu).toBeCloseTo(4 / 6)
    // RAM DR reservation on the host memory.
    const ram = 262_144
    expect(c.drReservedRamMib as number).toBeCloseTo(0.5 * ram)
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
