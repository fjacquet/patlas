import { describe, expect, it } from 'vitest'
import type { MergedEstate } from '@/engines/snapshotMerge'
import { cores, mhz, mib, sockets } from '@/engines/units'
import type { DrScenario } from '@/types/estate'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { runScenario } from './runScenario'

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
  vmName: 'vm',
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
  viSdkUuid: 'vc-a',
  viSdkServer: 'vc-a.local',
  provisionedMib: mib(0),
  inUseMib: mib(0),
  ...over,
})

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
  model: '',
  vendor: '',
  esxVersion: '',
  ...over,
})

const estate = (vinfo: VInfoRow[], vhost: VHostRow[]): MergedEstate => ({
  vinfo,
  vhost,
  vdatastore: [],
  vpartition: [],
  vcenters: [],
})

const SCN = (over: Partial<DrScenario>): DrScenario => ({
  failedHosts: new Set(),
  failedSites: new Set(),
  ...over,
})

const OPTS = {
  mode: 'active' as const,
  stretchedClusters: new Set<string>(),
  allocRatios: { cpuRatio: 4, ramRatio: 1 },
}

describe('runScenario — DR what-if (DRX-02..05, two-mode physical-impact)', () => {
  it('empty scenario → null (no failed component)', () => {
    const m = estate([vm({})], [host({})])
    expect(runScenario(m, SCN({}), OPTS)).toBeNull()
  })

  it('server-loss removes the failed host + its VMs; physical impact = before−after', () => {
    const m = estate(
      [
        vm({ vmName: 'a', host: 'esx-1', cluster: 'C1' }),
        vm({ vmName: 'b', host: 'esx-2', cluster: 'C1' }),
      ],
      [host({ hostName: 'esx-1', cluster: 'C1' }), host({ hostName: 'esx-2', cluster: 'C1' })],
    )
    const r = runScenario(m, SCN({ failedHosts: new Set(['esx-1']) }), OPTS)
    expect(r).not.toBeNull()
    expect(r?.mode).toBe('server')
    // Two identical 12-core / 2600 MHz hosts; losing one removes exactly
    // one host's PHYSICAL capacity (cores + GHz + RAM), never vCPU.
    // physicalGhz = cores × speedGHz = 12 × 2.6 = 31.2 GHz.
    expect(r?.physicalCpuRemovedCores as number).toBe(12)
    expect(r?.physicalCpuRemovedGhz as number).toBeCloseTo(31.2, 5)
    expect(r?.physicalRamRemovedMib as number).toBe(262_144)
    // Survivor estate keeps exactly the second host's physical cores.
    expect(r?.after.physicalCores as number).toBe(12)
  })

  it('site-loss removes every host whose faultDomain ∈ failedSites + their VMs', () => {
    const m = estate(
      [
        vm({ vmName: 'a', cluster: 'STR', host: 'sa' }),
        vm({ vmName: 'b', cluster: 'STR', host: 'sb' }),
      ],
      [
        host({ hostName: 'sa', cluster: 'STR', faultDomain: 'Site A' }),
        host({ hostName: 'sb', cluster: 'STR', faultDomain: 'Site B' }),
      ],
    )
    const r = runScenario(m, SCN({ failedSites: new Set(['Site A']) }), OPTS)
    expect(r?.mode).toBe('site')
    // Host on Site A removed → its physical cores leave the estate.
    expect(r?.physicalCpuRemovedCores as number).toBe(12)
    expect(r?.after.physicalCores as number).toBe(12) // only Site B host left
  })

  it('site-loss with no fault-domain metadata removes nothing (symmetric, factual)', () => {
    // Hosts carry no faultDomain (''), so no host matches a named site —
    // the symmetric/no-metadata case stays factual: nothing removed.
    const m = estate(
      [vm({ vmName: 'a', host: 'h1', cluster: 'C1' })],
      [host({ hostName: 'h1', cluster: 'C1', faultDomain: '' })],
    )
    const r = runScenario(m, SCN({ failedSites: new Set(['Site A']) }), OPTS)
    expect(r?.mode).toBe('site')
    expect(r?.physicalCpuRemovedCores as number).toBe(0)
    expect(r?.after.physicalCores as number).toBe(r?.before.physicalCores as number)
  })

  it('physical impact is GHz/cores/RAM (branded), never vCPU', () => {
    const m = estate(
      [
        vm({ vmName: 'a', host: 'esx-1', cluster: 'C1', vcpu: cores(64) }),
        vm({ vmName: 'b', host: 'esx-2', cluster: 'C1', vcpu: cores(1) }),
      ],
      [
        host({ hostName: 'esx-1', cluster: 'C1', cores: cores(20), speedMhz: mhz(3000) }),
        host({ hostName: 'esx-2', cluster: 'C1', cores: cores(20), speedMhz: mhz(3000) }),
      ],
    )
    const r = runScenario(m, SCN({ failedHosts: new Set(['esx-1']) }), OPTS)
    // Impact tracks the HOST'S physical resources (20 cores / 60 GHz),
    // NOT the 64 vCPU the failed host's VM had allocated.
    expect(r?.physicalCpuRemovedCores as number).toBe(20)
    expect(r?.physicalCpuRemovedGhz as number).toBeCloseTo(60, 5)
    // The result exposes no vCPU evacuee field at all.
    expect(r).not.toHaveProperty('evacueeVcpu')
    expect(r).not.toHaveProperty('evacueeVramMib')
  })

  it('no confidence field on the result', () => {
    const m = estate(
      [
        vm({ vmName: 'a', host: 'esx-1', cluster: 'C1' }),
        vm({ vmName: 'b', host: 'esx-2', cluster: 'C1' }),
      ],
      [host({ hostName: 'esx-1', cluster: 'C1' }), host({ hostName: 'esx-2', cluster: 'C1' })],
    )
    const r = runScenario(m, SCN({ failedHosts: new Set(['esx-1']) }), OPTS)
    expect(r).not.toBeNull()
    expect(r).not.toHaveProperty('confidence')
  })

  it('does NOT mutate the merged estate', () => {
    const vinfo = [vm({ host: 'esx-1' }), vm({ vmName: 'b', host: 'esx-2' })]
    const m = estate(vinfo, [host({ hostName: 'esx-1' }), host({ hostName: 'esx-2' })])
    runScenario(m, SCN({ failedHosts: new Set(['esx-1']) }), OPTS)
    expect(m.vinfo).toHaveLength(2)
    expect(m.vhost).toHaveLength(2)
  })

  it('a stretched survivor subtracts its per-site reservation (04-02 flows through)', () => {
    const m = estate(
      [
        vm({ vmName: 'a', cluster: 'STR', host: 'sa', vcpu: cores(4) }),
        vm({ vmName: 'd', cluster: 'DEAD', host: 'da' }),
      ],
      [
        host({ hostName: 'sa', cluster: 'STR', faultDomain: 'A' }),
        host({ hostName: 'sb', cluster: 'STR', faultDomain: 'B' }),
        host({ hostName: 'da', cluster: 'DEAD' }),
      ],
    )
    const plain = runScenario(m, SCN({ failedHosts: new Set(['da']) }), OPTS)
    const stretched = runScenario(m, SCN({ failedHosts: new Set(['da']) }), {
      ...OPTS,
      stretchedClusters: new Set(['STR']),
    })
    // Same survivors, but the stretched run reserves capacity → lower
    // available GHz on the survivor than the non-stretched run.
    expect(stretched?.after.availableGhz as number).toBeLessThan(
      plain?.after.availableGhz as number,
    )
  })

  it('emits the reservation-vs-capacity caveat key as keys-only (no free text)', () => {
    const m = estate(
      [vm({ cluster: 'STR', host: 'h' }), vm({ vmName: 'x', cluster: 'D', host: 'd' })],
      [host({ hostName: 'h', cluster: 'STR' }), host({ hostName: 'd', cluster: 'D' })],
    )
    const r = runScenario(m, SCN({ failedHosts: new Set(['d']) }), {
      ...OPTS,
      stretchedClusters: new Set(['STR']),
    })
    expect(Array.isArray(r?.caveats)).toBe(true)
    for (const k of r?.caveats ?? []) expect(k.startsWith('caveats.')).toBe(true)
  })

  it('combined server + site loss removes the union of failed hosts', () => {
    const m = estate(
      [
        vm({ vmName: 'a', host: 'h-a', cluster: 'C1' }),
        vm({ vmName: 'b', host: 'h-b', cluster: 'C1' }),
        vm({ vmName: 'c', host: 'h-c', cluster: 'C1' }),
      ],
      [
        host({ hostName: 'h-a', cluster: 'C1', faultDomain: 'Site A' }),
        host({ hostName: 'h-b', cluster: 'C1', faultDomain: 'Site B' }),
        host({ hostName: 'h-c', cluster: 'C1', faultDomain: 'Site B' }),
      ],
    )
    // Server loss = h-b explicitly; Site loss = Site A (→ h-a). Union of
    // removed hosts is {h-a, h-b}; only h-c (Site B) survives.
    const r = runScenario(
      m,
      SCN({ failedHosts: new Set(['h-b']), failedSites: new Set(['Site A']) }),
      OPTS,
    )
    expect(r?.mode).toBe('site') // failedSites non-empty ▷ site
    expect(r?.after.physicalCores as number).toBe(12) // one surviving host
  })
})
