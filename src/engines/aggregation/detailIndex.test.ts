import { describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import type { DatastoreAggregate } from '@/types/estate'
import type { GuestRow } from '@/types/guest'
import type { StorageRow, VmNicRow, VPartitionRow } from '@/types/snapshot'
import { buildDatastoreDetail, buildVmDetail } from './detailIndex'
import type { VsanRelinkResult } from './vsanRelink'

const dsAgg = (over: Partial<DatastoreAggregate>): DatastoreAggregate => ({
  key: 'ds-key',
  name: 'DS_A',
  type: 'vSAN',
  capacityMib: mib(1000),
  freeMib: mib(100),
  usedMib: mib(900),
  usedRatio: 0.9,
  provisionedMib: mib(800),
  overProvisionRatio: 0.8,
  sharedDuplicateCount: 1,
  ...over,
})

const dsRow = (over: Partial<StorageRow>): StorageRow => ({
  name: 'DS_A',
  capacityMib: mib(1000),
  freeMib: mib(100),
  provisionedMib: mib(800),
  naa: null,
  type: 'vSAN',
  role: 'other',
  hosts: '3',
  clusterName: '',
  ...over,
})

const NO_VSAN: VsanRelinkResult = {
  attributed: new Map(),
  shared: new Map(),
  unrelinkable: new Set(),
  datastoreVms: new Map(),
}

const vm = (over: Partial<GuestRow>): GuestRow => ({
  vmName: 'vm-1',
  cluster: 'CL_1',
  host: 'pve-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn',
  template: false,
  osConfig: 'RHEL 8',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '[DS_A] vm-1/vm-1.conf',
  ...over,
})

const part = (over: Partial<VPartitionRow>): VPartitionRow => ({
  vmName: 'vm-1',
  disk: '/',
  capacityMib: mib(1000),
  consumedMib: mib(950),
  freeMib: mib(50),
  ...over,
})

/** Two VmNicRow entries for 'vm-1' on the same bridge → deduplicate to 1 bridge entry. */
const nicRow = (over: Partial<VmNicRow>): VmNicRow => ({
  node: 'pve-1',
  vmId: '101',
  vmName: 'vm-1',
  vmType: 'qemu',
  macAddress: 'BC:24:11:AA:BB:CC',
  bridge: 'vmbr0',
  tag: null,
  model: 'virtio',
  ...over,
})

describe('buildDatastoreDetail (LC-4)', () => {
  it('projects factual metrics + VM list + numeric host count + flags', () => {
    const vsan: VsanRelinkResult = {
      ...NO_VSAN,
      datastoreVms: new Map([['DS_A', ['vm-1', 'vm-2']]]),
    }
    const out = buildDatastoreDetail(
      [dsAgg({ key: 'DS_A', name: 'DS_A', usedRatio: 0.9 })],
      [dsRow({ name: 'DS_A', naa: null, hosts: '3' })],
      vsan,
      { fsUsedPct: 90, dsUsedPct: 85, luUsedPct: 85 },
    )
    const d = out.get('DS_A')
    expect(d?.vms).toEqual(['vm-1', 'vm-2'])
    expect(d?.hostCount).toBe(3)
    expect(d?.dsFlagged).toBe(true) // 90% > 85
    expect(d?.luFlagged).toBe(true)
  })

  it('hostCount is null (em-dash) when the Hosts column is non-numeric/absent', () => {
    const out = buildDatastoreDetail(
      [dsAgg({ key: 'DS_A', name: 'DS_A' })],
      [dsRow({ naa: null, name: 'DS_A', hosts: '' })],
      NO_VSAN,
      { fsUsedPct: 90, dsUsedPct: 85, luUsedPct: 85 },
    )
    expect(out.get('DS_A')?.hostCount).toBeNull()
    expect(out.get('DS_A')?.vms).toEqual([])
  })
})

describe('buildVmDetail (LC-4)', () => {
  it('projects partitions with the factual fs flag, bridges, and the path datastore', () => {
    const out = buildVmDetail(
      {
        guests: [vm({})],
        vpartition: [
          part({ consumedMib: mib(950) }),
          part({ disk: '/var', consumedMib: mib(100) }),
        ],
        // Two NIC rows on the same bridge → deduped to 1 bridge entry.
        vmNics: [nicRow({}), nicRow({})],
      },
      { fsUsedPct: 90, dsUsedPct: 85, luUsedPct: 85 },
    )
    const d = out.get('vm-1')
    expect(d?.partitions).toHaveLength(2)
    expect(d?.partitions[0]?.flagged).toBe(true) // 95% ≥ 90
    expect(d?.partitions[1]?.flagged).toBe(false) // 10%
    expect(d?.bridges).toHaveLength(1) // deduped
    expect(d?.datastores).toEqual(['DS_A'])
    expect(d?.os).toBe('RHEL 8')
  })

  it('empty partition/bridge lists when none reference the VM (em-dash upstream)', () => {
    const out = buildVmDetail(
      { guests: [vm({ vmName: 'lonely', path: 'no-bracket' })], vpartition: [], vmNics: [] },
      { fsUsedPct: 90, dsUsedPct: 85, luUsedPct: 85 },
    )
    const d = out.get('lonely')
    expect(d?.partitions).toEqual([])
    expect(d?.bridges).toEqual([])
    expect(d?.datastores).toEqual([])
  })
})
