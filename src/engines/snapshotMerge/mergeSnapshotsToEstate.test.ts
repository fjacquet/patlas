import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import type {
  ProxmoxSnapshotRow,
  ProxmoxStorageContentRow,
  Snapshot,
  VHostRow,
  VInfoRow,
} from '@/types'
import { mergeSnapshotsToEstate } from './mergeSnapshotsToEstate'

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
  osConfig: 'Ubuntu Linux (64-bit)',
  osTools: '',
  vmBiosUuid: 'uuid-1',
  vmInstanceUuid: '',
  viSdkUuid: 'vc-a',
  viSdkServer: 'vc-a.local',
  guestType: 'qemu',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '',
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
  serialNumber: '',
  esxVersion: '',
  ...over,
})

const snap = (over: Partial<Snapshot>): Snapshot => ({
  id: 's1',
  filename: 'f.xlsx',
  fileSize: 1024 as Snapshot['fileSize'],
  capturedAt: new Date('2026-01-01'),
  vCenterLabel: 'snap-label',
  rvtoolsVersion: '4.7.1.4',
  parsedAt: new Date('2026-01-02'),
  source: 'proxmox',
  viSdkUuid: 'vc-a',
  vMetaData: [],
  vinfo: [],
  vhost: [],
  vmUsage: [],
  proxmoxSnapshots: [],
  proxmoxStorageContent: [],
  vdatastore: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  parseErrors: [],
  ...over,
})

describe('mergeSnapshotsToEstate — PRIMARY: N separately-dropped files', () => {
  it('merges 2 snapshots, suffixes a colliding cluster on BOTH vinfo+vhost, VM total = sum', () => {
    const a = snap({
      id: 'a',
      viSdkUuid: 'vc-a',
      vMetaData: [{ server: 'vc-a.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null }],
      vinfo: [
        vm({ vmName: 'a1', viSdkUuid: 'vc-a', cluster: 'CL_WRK_PFLEX', vmBiosUuid: 'a1' }),
        vm({ vmName: 'a2', viSdkUuid: 'vc-a', cluster: 'CL_WRK_PFLEX', vmBiosUuid: 'a2' }),
      ],
      vhost: [host({ hostName: 'esx-a', cluster: 'CL_WRK_PFLEX', faultDomain: '' })],
    })
    const b = snap({
      id: 'b',
      viSdkUuid: 'vc-b',
      vMetaData: [{ server: 'vc-b.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null }],
      vinfo: [vm({ vmName: 'b1', viSdkUuid: 'vc-b', cluster: 'CL_WRK_PFLEX', vmBiosUuid: 'b1' })],
      vhost: [host({ hostName: 'esx-b', cluster: 'CL_WRK_PFLEX' })],
    })

    const merged = mergeSnapshotsToEstate([a, b])

    expect(merged.vinfo).toHaveLength(3) // 2 + 1, no double-count
    expect(merged.vcenters).toHaveLength(2)
    // Colliding cluster suffixed with the vCenter label on BOTH row sets.
    const clusters = new Set(merged.vinfo.map((r) => r.cluster))
    expect(clusters.has('CL_WRK_PFLEX (vc-a.local)')).toBe(true)
    expect(clusters.has('CL_WRK_PFLEX (vc-b.local)')).toBe(true)
    expect(clusters.has('CL_WRK_PFLEX')).toBe(false)
    const hostClusters = new Set(merged.vhost.map((r) => r.cluster))
    expect(hostClusters.has('CL_WRK_PFLEX (vc-a.local)')).toBe(true)
    expect(hostClusters.has('CL_WRK_PFLEX (vc-b.local)')).toBe(true)
  })

  it('does NOT mutate input snapshots', () => {
    const a = snap({
      id: 'a',
      viSdkUuid: 'vc-a',
      vinfo: [vm({ vmName: 'a1', viSdkUuid: 'vc-a', cluster: 'SHARED', vmBiosUuid: 'a1' })],
      vhost: [host({ cluster: 'SHARED' })],
    })
    const b = snap({
      id: 'b',
      viSdkUuid: 'vc-b',
      vinfo: [vm({ vmName: 'b1', viSdkUuid: 'vc-b', cluster: 'SHARED', vmBiosUuid: 'b1' })],
      vhost: [host({ cluster: 'SHARED' })],
    })
    mergeSnapshotsToEstate([a, b])
    expect(a.vinfo[0]?.cluster).toBe('SHARED')
    expect(b.vhost[0]?.cluster).toBe('SHARED')
  })

  it('non-colliding clusters pass through as the SAME object reference', () => {
    const a = snap({
      id: 'a',
      viSdkUuid: 'vc-a',
      vinfo: [vm({ vmName: 'a1', viSdkUuid: 'vc-a', cluster: 'ONLY_A', vmBiosUuid: 'a1' })],
      vhost: [host({ cluster: 'ONLY_A' })],
    })
    const merged = mergeSnapshotsToEstate([a])
    expect(merged.vinfo[0]).toBe(a.vinfo[0])
    expect(merged.vhost[0]).toBe(a.vhost[0])
  })
})

describe('mergeSnapshotsToEstate — ADDITIONAL: ONE workbook with 3 vCenters', () => {
  it('yields 3 vcenters and the same row-keyed merge as 3 files', () => {
    const oneWorkbook = snap({
      id: 'all',
      viSdkUuid: 'vc11',
      vMetaData: [
        { server: 'vc11.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
        { server: 'vc13.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
        { server: 'vc14.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
      ],
      vinfo: [
        vm({ vmName: 'a', viSdkUuid: 'vc11', cluster: 'CL_11', vmBiosUuid: 'a' }),
        vm({ vmName: 'b', viSdkUuid: 'vc13', cluster: 'CL_13', vmBiosUuid: 'b' }),
        vm({ vmName: 'c', viSdkUuid: 'vc14', cluster: 'CL_14', vmBiosUuid: 'c' }),
      ],
      vhost: [
        host({ hostName: 'h11', cluster: 'CL_11' }),
        host({ hostName: 'h13', cluster: 'CL_13' }),
        host({ hostName: 'h14', cluster: 'CL_14' }),
      ],
    })
    const merged = mergeSnapshotsToEstate([oneWorkbook])
    expect(merged.vcenters).toHaveLength(3)
    expect(merged.vinfo).toHaveLength(3)
  })

  it('suffixes a name colliding ACROSS viSdkUuid inside one workbook', () => {
    const w = snap({
      id: 'w',
      viSdkUuid: 'vc11',
      vMetaData: [
        { server: 'vc11.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
        { server: 'vc14.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
      ],
      vinfo: [
        vm({ vmName: 'a', viSdkUuid: 'vc11', cluster: 'CL', vmBiosUuid: 'a' }),
        vm({ vmName: 'b', viSdkUuid: 'vc14', cluster: 'CL', vmBiosUuid: 'b' }),
      ],
      vhost: [host({ hostName: 'h11', cluster: 'CL' }), host({ hostName: 'h14', cluster: 'CL' })],
    })
    const merged = mergeSnapshotsToEstate([w])
    const clusters = new Set(merged.vinfo.map((r) => r.cluster))
    expect(clusters.has('CL (vc11.local)')).toBe(true)
    expect(clusters.has('CL (vc14.local)')).toBe(true)
  })
})

describe('mergeSnapshotsToEstate — VM dedupe (MVC-03 / vMotion)', () => {
  it('keeps a vMotioned VM (same vmBiosUuid under 2 viSdkUuid) exactly once', () => {
    const a = snap({
      id: 'a',
      viSdkUuid: 'vc-a',
      vinfo: [vm({ vmName: 'mover', viSdkUuid: 'vc-a', cluster: 'CA', vmBiosUuid: 'shared-uuid' })],
      vhost: [host({ cluster: 'CA' })],
    })
    const b = snap({
      id: 'b',
      viSdkUuid: 'vc-b',
      vinfo: [vm({ vmName: 'mover', viSdkUuid: 'vc-b', cluster: 'CB', vmBiosUuid: 'shared-uuid' })],
      vhost: [host({ cluster: 'CB' })],
    })
    const merged = mergeSnapshotsToEstate([a, b])
    expect(merged.vinfo).toHaveLength(1) // deduped, first occurrence wins
    expect(merged.vinfo[0]?.cluster).toBe('CA')
  })

  it('blank vmBiosUuid falls back to (viSdkUuid, vmName, cluster) — distinct VMs kept', () => {
    const a = snap({
      id: 'a',
      viSdkUuid: 'vc-a',
      vinfo: [
        vm({ vmName: 'no-uuid', viSdkUuid: 'vc-a', cluster: 'CA', vmBiosUuid: '' }),
        vm({ vmName: 'no-uuid', viSdkUuid: 'vc-b', cluster: 'CB', vmBiosUuid: '' }),
      ],
      vhost: [host({ cluster: 'CA' }), host({ cluster: 'CB' })],
    })
    const merged = mergeSnapshotsToEstate([a])
    // Different (viSdkUuid, vmName, cluster) ⇒ two distinct VMs, NOT collapsed.
    expect(merged.vinfo).toHaveLength(2)
  })

  it('blank vmBiosUuid with identical fallback key collapses to one', () => {
    const a = snap({
      id: 'a',
      viSdkUuid: 'vc-a',
      vinfo: [
        vm({ vmName: 'dup', viSdkUuid: 'vc-a', cluster: 'CA', vmBiosUuid: '' }),
        vm({ vmName: 'dup', viSdkUuid: 'vc-a', cluster: 'CA', vmBiosUuid: '' }),
      ],
      vhost: [host({ cluster: 'CA' })],
    })
    const merged = mergeSnapshotsToEstate([a])
    expect(merged.vinfo).toHaveLength(1)
  })
})

describe('mergeSnapshotsToEstate — empty / degenerate', () => {
  it('empty selection ⇒ empty bundle', () => {
    const merged = mergeSnapshotsToEstate([])
    expect(merged.vinfo).toHaveLength(0)
    expect(merged.vhost).toHaveLength(0)
    expect(merged.vdatastore).toHaveLength(0)
    expect(merged.vcenters).toHaveLength(0)
  })

  it('a single single-vCenter snapshot is the degenerate pass-through', () => {
    const a = snap({
      id: 'a',
      viSdkUuid: 'vc-a',
      vinfo: [vm({ vmName: 'a1', viSdkUuid: 'vc-a', cluster: 'CA', vmBiosUuid: 'a1' })],
      vhost: [host({ cluster: 'CA' })],
      vdatastore: [],
    })
    const merged = mergeSnapshotsToEstate([a])
    expect(merged.vinfo).toHaveLength(1)
    expect(merged.vcenters).toHaveLength(1)
    expect(merged.vinfo[0]).toBe(a.vinfo[0]) // no collision ⇒ same ref
  })
})

describe('mergeSnapshotsToEstate — proxmoxSnapshots concatenation', () => {
  const pxSnap = (over: Partial<ProxmoxSnapshotRow>): ProxmoxSnapshotRow => ({
    node: 'pve1',
    guestId: '100',
    guestName: 'vm-test',
    guestType: 'qemu',
    name: 'snap1',
    parent: 'no-parent',
    dateSerial: 45000,
    includeRam: false,
    sizeMib: mib(1024),
    ...over,
  })

  it('concatenates proxmoxSnapshots from two snapshots', () => {
    const a = snap({ id: 'a', proxmoxSnapshots: [pxSnap({ name: 'snap-a' })] })
    const b = snap({
      id: 'b',
      proxmoxSnapshots: [pxSnap({ name: 'snap-b' }), pxSnap({ name: 'snap-c' })],
    })
    const merged = mergeSnapshotsToEstate([a, b])
    expect(merged.proxmoxSnapshots).toHaveLength(3)
    expect(merged.proxmoxSnapshots.map((r) => r.name)).toEqual(['snap-a', 'snap-b', 'snap-c'])
  })

  it('empty selection yields empty proxmoxSnapshots', () => {
    expect(mergeSnapshotsToEstate([]).proxmoxSnapshots).toHaveLength(0)
  })

  it('is resilient to a missing proxmoxSnapshots field (??[])', () => {
    const a = snap({ id: 'a', proxmoxSnapshots: undefined as unknown as ProxmoxSnapshotRow[] })
    const merged = mergeSnapshotsToEstate([a])
    expect(merged.proxmoxSnapshots).toHaveLength(0)
  })
})

describe('mergeSnapshotsToEstate — proxmoxStorageContent concatenation', () => {
  const sc = (over: Partial<ProxmoxStorageContentRow>): ProxmoxStorageContentRow => ({
    node: 'pve1',
    storage: 'local',
    content: 'images',
    fileName: 'vm-100-disk-0.qcow2',
    format: 'qcow2',
    sizeMib: mib(10_240),
    usagePercent: 42,
    guestId: '100',
    guestName: 'vm-test',
    creationSerial: 45000,
    ...over,
  })

  it('concatenates proxmoxStorageContent from two snapshots', () => {
    const a = snap({ id: 'a', proxmoxStorageContent: [sc({ fileName: 'disk-a.qcow2' })] })
    const b = snap({
      id: 'b',
      proxmoxStorageContent: [sc({ fileName: 'disk-b.qcow2' }), sc({ fileName: 'disk-c.qcow2' })],
    })
    const merged = mergeSnapshotsToEstate([a, b])
    expect(merged.proxmoxStorageContent).toHaveLength(3)
    expect(merged.proxmoxStorageContent.map((r) => r.fileName)).toEqual([
      'disk-a.qcow2',
      'disk-b.qcow2',
      'disk-c.qcow2',
    ])
  })

  it('empty selection yields empty proxmoxStorageContent', () => {
    expect(mergeSnapshotsToEstate([]).proxmoxStorageContent).toHaveLength(0)
  })

  it('is resilient to a missing proxmoxStorageContent field (??[])', () => {
    const a = snap({
      id: 'a',
      proxmoxStorageContent: undefined as unknown as ProxmoxStorageContentRow[],
    })
    const merged = mergeSnapshotsToEstate([a])
    expect(merged.proxmoxStorageContent).toHaveLength(0)
  })
})
