import { describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import type { GuestRow } from '@/types/guest'
import type { StorageRow } from '@/types/snapshot'
import { storageByX } from './storageByX'
import type { VsanRelinkResult } from './vsanRelink'

const vm = (over: Partial<GuestRow>): GuestRow => ({
  vmName: 'vm-1',
  cluster: 'CL_1',
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
  provisionedMib: mib(1000),
  inUseMib: mib(600),
  path: '',
  ...over,
})

const ds = (over: Partial<StorageRow>): StorageRow => ({
  name: 'DS_X',
  capacityMib: mib(1000),
  freeMib: mib(400),
  provisionedMib: mib(600),
  naa: null,
  type: 'VMFS',
  role: 'other',
  hosts: '1',
  clusterName: 'CL_1',
  ...over,
})

const NO_VSAN: VsanRelinkResult = {
  attributed: new Map(),
  shared: new Map(),
  unrelinkable: new Set(),
  datastoreVms: new Map(),
}

describe('storageByX — two lenses, reconcile to estate (D-07/D-08)', () => {
  it('consumption sums per cluster reconcile to the estate total', () => {
    const out = storageByX(
      {
        guests: [
          vm({ vmName: 'a', cluster: 'CL_1', provisionedMib: mib(1000), inUseMib: mib(600) }),
          vm({ vmName: 'b', cluster: 'CL_2', provisionedMib: mib(500), inUseMib: mib(200) }),
        ],
        storages: [],
      },
      'active',
      NO_VSAN,
    )
    const sumProv = out.byCluster.reduce((a, g) => a + (g.provisionedMib as number), 0)
    const sumUsed = out.byCluster.reduce((a, g) => a + (g.inUseMib as number), 0)
    expect(sumProv).toBe(out.estate.provisionedMib as number)
    expect(sumUsed).toBe(out.estate.inUseMib as number)
    expect(out.estate.provisionedMib as number).toBe(1500)
    expect(out.estate.inUseMib as number).toBe(800)
  })

  it('a shared LUN (same NAA, 2 rows) is counted once — no double-count', () => {
    const out = storageByX(
      {
        guests: [],
        storages: [
          ds({ name: 'view-a', naa: 'naa.shared', capacityMib: mib(1000), freeMib: mib(250) }),
          ds({ name: 'view-b', naa: 'naa.shared', capacityMib: mib(1000), freeMib: mib(250) }),
        ],
      },
      'active',
      NO_VSAN,
    )
    expect(out.capacityByDatastore).toHaveLength(1)
    expect(out.estate.capacityMib as number).toBe(1000)
    expect(out.estate.usedMib as number).toBe(750)
  })

  it('configured mode keeps powered-off VMs; active excludes them', () => {
    const vinfo = [
      vm({ vmName: 'on', poweredOn: true, provisionedMib: mib(100) }),
      vm({ vmName: 'off', poweredOn: false, powerState: 'poweredOff', provisionedMib: mib(900) }),
    ]
    const cfg = storageByX({ guests: vinfo, storages: [] }, 'configured', NO_VSAN)
    const act = storageByX({ guests: vinfo, storages: [] }, 'active', NO_VSAN)
    expect(cfg.estate.provisionedMib as number).toBe(1000)
    expect(act.estate.provisionedMib as number).toBe(100)
  })

  it('per-cluster capacity uses the vSAN relink for blank-cluster datastores', () => {
    const vsan: VsanRelinkResult = {
      attributed: new Map([['BLANK_DS', 'CL_RELINKED']]),
      shared: new Map(),
      unrelinkable: new Set(),
      datastoreVms: new Map(),
    }
    const out = storageByX(
      {
        guests: [],
        storages: [ds({ name: 'BLANK_DS', naa: null, clusterName: '', capacityMib: mib(2000) })],
      },
      'active',
      vsan,
    )
    const relinked = out.capacityByCluster.find((c) => c.key === 'CL_RELINKED')
    expect(relinked?.capacityMib as number).toBe(2000)
  })

  it('a shared-LUN / unrelinkable blank-cluster datastore is excluded from per-cluster capacity but stays in estate', () => {
    const vsan: VsanRelinkResult = {
      attributed: new Map(),
      shared: new Map([['SHARED_DS', 3]]),
      unrelinkable: new Set(),
      datastoreVms: new Map(),
    }
    const out = storageByX(
      {
        guests: [],
        storages: [ds({ name: 'SHARED_DS', naa: null, clusterName: '', capacityMib: mib(5000) })],
      },
      'active',
      vsan,
    )
    expect(out.capacityByCluster).toHaveLength(0)
    expect(out.estate.capacityMib as number).toBe(5000)
  })
})
