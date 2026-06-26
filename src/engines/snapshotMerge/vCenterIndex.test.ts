import { describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import type { GuestRow, Snapshot } from '@/types'
import { buildVCenterIndex } from './vCenterIndex'

const vm = (over: Partial<GuestRow>): GuestRow => ({
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
  vmBiosUuid: 'uuid-default',
  vmInstanceUuid: '',
  viSdkUuid: 'vc-a',
  viSdkServer: 'vc-a.local',
  guestType: 'qemu',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '',
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
  guests: [],
  nodes: [],
  vmUsage: [],
  proxmoxSnapshots: [],
  proxmoxStorageContent: [],
  proxmoxHaResources: [],
  proxmoxHaStatus: [],
  proxmoxBackupJobs: [],
  storages: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  parseErrors: [],
  ...over,
})

describe('buildVCenterIndex', () => {
  it('groups rows by ROW viSdkUuid, never by snapshot id (Pitfall 1)', () => {
    // ONE snapshot, 3 distinct viSdkUuid (the allvCenters single-workbook shape)
    const s = snap({
      vMetaData: [
        { server: 'vc11.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
        { server: 'vc13.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
        { server: 'vc14.local', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
      ],
      guests: [
        vm({ vmName: 'a', viSdkUuid: 'vc11', viSdkServer: 'vc11.local', cluster: 'CL_11' }),
        vm({ vmName: 'b', viSdkUuid: 'vc13', viSdkServer: 'vc13.local', cluster: 'CL_13' }),
        vm({ vmName: 'c', viSdkUuid: 'vc14', viSdkServer: 'vc14.local', cluster: 'CL_14' }),
        vm({ vmName: 'd', viSdkUuid: 'vc11', viSdkServer: 'vc11.local', cluster: 'CL_11' }),
      ],
    })
    const idx = buildVCenterIndex([s])
    expect(idx.size).toBe(3)
    expect(idx.get('vc11')?.vmCount).toBe(2)
    expect(idx.get('vc13')?.vmCount).toBe(1)
    expect(idx.get('vc11')?.clusters.has('CL_11')).toBe(true)
  })

  it('label resolves vMetaData Server (matched by snapshot order) first', () => {
    const s = snap({
      viSdkUuid: 'vc-x',
      vMetaData: [
        { server: 'meta-vc.example', rvtoolsVersion: '4.7.1.4', exportedTimestamp: null },
      ],
      guests: [vm({ viSdkUuid: 'vc-x', viSdkServer: 'row-server.local' })],
    })
    const idx = buildVCenterIndex([s])
    expect(idx.get('vc-x')?.label).toBe('meta-vc.example')
  })

  it('label falls back to row viSdkServer, then snapshot vCenterLabel', () => {
    const s = snap({
      viSdkUuid: 'vc-y',
      vMetaData: [],
      vCenterLabel: 'snap-fallback',
      guests: [
        vm({ vmName: 'a', viSdkUuid: 'vc-y', viSdkServer: 'row.server' }),
        vm({ vmName: 'b', viSdkUuid: 'vc-z', viSdkServer: '' }),
      ],
    })
    const idx = buildVCenterIndex([s])
    expect(idx.get('vc-y')?.label).toBe('row.server')
    expect(idx.get('vc-z')?.label).toBe('snap-fallback')
  })

  it('vCenter count across N separately-dropped snapshots = distinct viSdkUuid', () => {
    const s1 = snap({ id: 's1', viSdkUuid: 'vc-1', guests: [vm({ viSdkUuid: 'vc-1' })] })
    const s2 = snap({ id: 's2', viSdkUuid: 'vc-2', guests: [vm({ viSdkUuid: 'vc-2' })] })
    const idx = buildVCenterIndex([s1, s2])
    expect(idx.size).toBe(2)
  })
})
