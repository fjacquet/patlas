import { describe, expect, it } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { buildEstateView, EMPTY_VIEW } from './estateView'

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
  vmName: 'vm',
  cluster: 'C1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  osConfig: 'Ubuntu Linux (64-bit)',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  ...over,
})

// ~50/50 powered-on fixture (Critical-6 / ROADMAP success #2/#6).
const snapshot = (): Snapshot => ({
  id: 's1',
  filename: 'fixture.xlsx',
  fileSize: bytes(1024),
  capturedAt: new Date('2026-01-01'),
  vCenterLabel: 'vc',
  rvtoolsVersion: '4.4',
  parsedAt: new Date('2026-01-02'),
  source: 'rvtools',
  viSdkUuid: null,
  vhost: [host({})],
  vinfo: [
    vm({ vmName: 'on-1', poweredOn: true, osConfig: 'Microsoft Windows Server 2019' }),
    vm({ vmName: 'on-2', poweredOn: true, osConfig: 'Ubuntu Linux (64-bit)' }),
    vm({ vmName: 'off-1', poweredOn: false, osConfig: 'FreeBSD 13' }),
    vm({ vmName: 'off-2', poweredOn: false, osConfig: 'Red Hat Enterprise Linux' }),
  ],
  vdatastore: [
    {
      name: 'ds-A',
      capacityMib: mib(1000),
      freeMib: mib(400),
      provisionedMib: mib(800),
      naa: 'naa.s',
      type: 'VMFS',
      clusterName: 'C1',
    },
    {
      name: 'ds-A-clusterview',
      capacityMib: mib(1000),
      freeMib: mib(400),
      provisionedMib: mib(800),
      naa: 'naa.s',
      type: 'VMFS',
      clusterName: 'C1',
    },
    {
      name: 'ds-B',
      capacityMib: mib(500),
      freeMib: mib(100),
      provisionedMib: mib(450),
      naa: 'naa.t',
      type: 'NFS',
      clusterName: '',
    },
  ],
  vpartition: [],
  parseErrors: [],
})

describe('buildEstateView', () => {
  it('returns a populated EstateView with trends:null and the mode echoed', () => {
    const view = buildEstateView(snapshot(), 'active')
    expect(view.clusters.length).toBeGreaterThan(0)
    expect(view.hosts.length).toBe(1)
    expect(view.accountingMode).toBe('active')
    expect(view.trends).toBeNull()
    // OS breakdown — global, `other` always present.
    expect(view.osBreakdown.windows).toBe(1)
    expect(view.osBreakdown.linux).toBe(2) // ubuntu + rhel
    expect(view.osBreakdown.other).toBe(1) // freebsd
    expect(view.vmsByCluster.get('C1')?.windows).toBe(1)
  })

  it('NAA-dedupes datastores (no shared-LUN double-count, Moderate-11)', () => {
    const view = buildEstateView(snapshot(), 'active')
    expect(view.datastores).toHaveLength(2) // naa.s + naa.t
    expect(view.globals.datastoreCount).toBe(2)
    // Shared LUN counted once: 1000 + 500, NOT 1000 + 1000 + 500.
    expect(view.globals.totalStorageMib as number).toBe(1500)
  })

  it('attributes datastores per cluster (NAA-deduped within cluster); empty clusterName not mis-attributed', () => {
    const view = buildEstateView(snapshot(), 'active')
    const c1 = view.clusters.find((c) => c.cluster === 'C1')
    // naa.s appears twice in C1 → deduped to 1; naa.t has empty
    // clusterName → NOT attributed to C1.
    expect(c1?.datastoreCount).toBe(1)
    // Global count unchanged: still NAA-deduped estate-wide (naa.s + naa.t).
    expect(view.globals.datastoreCount).toBe(2)
  })

  it('renders the em-dash sentinel (datastoreCount null) only when vDatastore is absent', () => {
    const snap = snapshot()
    snap.vdatastore = []
    const view = buildEstateView(snap, 'active')
    for (const c of view.clusters) expect(c.datastoreCount).toBeNull()
    expect(view.globals.datastoreCount).toBe(0)
  })

  it('the three accounting modes produce three DISTINCT global totals (Critical-6)', () => {
    const cfg = buildEstateView(snapshot(), 'configured').globals.vcpuAllocated as number
    const act = buildEstateView(snapshot(), 'active').globals.vcpuAllocated as number
    const sto = buildEstateView(snapshot(), 'storage-realistic').globals.vcpuAllocated as number
    // configured = all 4 VMs × 4 = 16; active/storage-realistic = 2 on × 4 = 8
    expect(cfg).toBe(16)
    expect(act).toBe(8)
    // configured differs from active; storage-realistic ≠ configured.
    expect(cfg).not.toBe(act)
    expect(sto).not.toBe(cfg)
    expect(new Set([cfg, act, sto]).size).toBeGreaterThanOrEqual(2)
  })

  it('EMPTY_VIEW is a frozen, valid, empty shape', () => {
    expect(Object.isFrozen(EMPTY_VIEW)).toBe(true)
    expect(EMPTY_VIEW.clusters).toEqual([])
    expect(EMPTY_VIEW.globals.clusterCount).toBe(0)
    expect(EMPTY_VIEW.trends).toBeNull()
    expect(EMPTY_VIEW.osBreakdown.other).toBe(0)
  })
})
