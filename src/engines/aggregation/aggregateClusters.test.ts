import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import { first } from '@/test/arrays'
import type { GuestRow } from '@/types/guest'
import type { NodeRow } from '@/types/node'
import { aggregateClusters } from './aggregateClusters'

const host = (over: Partial<NodeRow>): NodeRow => ({
  hostName: 'esx-1',
  cluster: 'C1',
  sockets: sockets(2),
  cores: cores(12),
  speedMhz: mhz(2600),
  memoryMib: mib(262_144),
  cpuRatio: 0.3,
  ramRatio: 0.5,
  faultDomain: '',
  model: '',
  vendor: '',
  serialNumber: '',
  esxVersion: '',
  ...over,
})

const vm = (over: Partial<GuestRow>): GuestRow => ({
  vmName: 'vm-1',
  cluster: 'C1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn',
  template: false,
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

describe('aggregateClusters', () => {
  it('vcpuPerPcpu uses PHYSICAL cores, not threads (Moderate-4)', () => {
    // 1 host, 12 physical cores; 6 VMs × 4 vCPU = 24 vCPU.
    // vcpuPerPcpu = 24 / 12 = 2.0 — divided by physical cores.
    // There is structurally no threads field on NodeRow to mis-use.
    const vhost = [host({ cores: cores(12) })]
    const vinfo = Array.from({ length: 6 }, (_, i) => vm({ vmName: `v${i}`, vcpu: cores(4) }))
    const c = first(aggregateClusters({ guests: vinfo, nodes: vhost, mode: 'active' }))
    expect(c.physicalCores as number).toBe(12)
    expect(c.usablePhysicalCores as number).toBe(12)
    expect(c.vcpuPerPcpu).toBeCloseTo(2.0)
  })

  it('no DR reservation: availableGhz = physicalGhz - consumedGhz', () => {
    const c = first(
      aggregateClusters({
        guests: [vm({})],
        nodes: [host({})],
        mode: 'active',
      }),
    )
    const physical = c.physicalGhz as number
    const consumed = c.consumedGhz as number
    const available = c.availableGhz as number
    expect(available).toBeCloseTo(physical - consumed)
    expect(c.usablePhysicalCores as number).toBe(c.physicalCores as number)
  })

  // ── ALC-04: the slider changes the verdict ONLY, never vcpuPerPcpu ────
  it('allocRatios changes capacity/headroom but vcpuPerPcpu is INVARIANT (ALC-04)', () => {
    const vinfo = Array.from({ length: 6 }, (_, i) => vm({ vmName: `v${i}`, vcpu: cores(4) }))
    const vhost = [host({ cores: cores(12) })]
    const at4 = first(
      aggregateClusters({
        guests: vinfo,
        nodes: vhost,
        mode: 'active',
        allocRatios: { cpuRatio: 4, ramRatio: 1 },
      }),
    )
    const at8 = first(
      aggregateClusters({
        guests: vinfo,
        nodes: vhost,
        mode: 'active',
        allocRatios: { cpuRatio: 8, ramRatio: 1 },
      }),
    )
    // vcpuPerPcpu is physical-core based (24 vCPU / 12 cores = 2) and does
    // NOT move with the slider — the guard against threads-based regression.
    expect(at4.vcpuPerPcpu).toBeCloseTo(2)
    expect(at8.vcpuPerPcpu).toBe(at4.vcpuPerPcpu)
    // capacityVcpu = usablePhysicalCores × cpuRatio → DOES scale.
    expect(at4.capacityVcpu as number).toBeCloseTo(12 * 4)
    expect(at8.capacityVcpu as number).toBeCloseTo(12 * 8)
  })

  it('defaults to 4:1 / 1:1 when allocRatios is omitted (ALC-02)', () => {
    const c = first(
      aggregateClusters({
        guests: [vm({})],
        nodes: [host({ cores: cores(12), memoryMib: mib(100) })],
        mode: 'active',
      }),
    )
    expect(c.capacityVcpu as number).toBeCloseTo(12 * 4)
    expect(c.capacityRamMib as number).toBeCloseTo(100 * 1)
  })

  it('sorts clusters stably by localeCompare', () => {
    const out = aggregateClusters({
      guests: [vm({ cluster: 'Zeta' }), vm({ cluster: 'alpha' })],
      nodes: [host({ cluster: 'Zeta' }), host({ cluster: 'alpha', hostName: 'esx-2' })],
      mode: 'active',
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
        guests: vinfo,
        nodes: [host({})],
        mode: 'configured',
      }),
    )
    const act = first(
      aggregateClusters({
        guests: vinfo,
        nodes: [host({})],
        mode: 'active',
      }),
    )
    expect(cfg.vcpuAllocated as number).toBe(12)
    expect(act.vcpuAllocated as number).toBe(4)
  })
})
