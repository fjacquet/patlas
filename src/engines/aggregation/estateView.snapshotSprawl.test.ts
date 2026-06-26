import { describe, expect, it } from 'vitest'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, mib } from '@/engines/units'
import type { ProxmoxSnapshotRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { buildEstateView, EMPTY_VIEW } from './estateView'

const TODAY = new Date('2026-06-23T00:00:00Z')

const minimalSnapshot = (snaps: ProxmoxSnapshotRow[]): Snapshot => ({
  id: 's1',
  filename: 'r.xlsx',
  fileSize: bytes(0),
  capturedAt: TODAY,
  vCenterLabel: 'proxmox',
  rvtoolsVersion: '',
  parsedAt: TODAY,
  source: 'proxmox',
  viSdkUuid: null,
  vMetaData: [],
  guests: [],
  nodes: [],
  vmUsage: [],
  storages: [],
  vpartition: [],
  nodeInterfaces: [],

  vmNics: [],
  proxmoxSnapshots: snaps,
  proxmoxStorageContent: [],
  proxmoxHaResources: [],
  proxmoxHaStatus: [],
  proxmoxBackupJobs: [],
  parseErrors: [],
})

describe('buildEstateView — snapshotSprawl slice', () => {
  it('EMPTY_VIEW carries a zeroed snapshotSprawl', () => {
    expect(EMPTY_VIEW.snapshotSprawl).toEqual({
      rows: [],
      count: 0,
      guestsWithSnapshots: 0,
      totalSizeMib: 0,
      oldestAgeDays: null,
    })
  })

  it('composes sprawl from merged.proxmoxSnapshots, excluding the current marker', () => {
    const snaps: ProxmoxSnapshotRow[] = [
      {
        node: 'n1',
        guestId: '100',
        guestName: 'A',
        guestType: 'qemu',
        name: 'current',
        parent: 'no-parent',
        dateSerial: null,
        includeRam: false,
        sizeMib: mib(0),
      },
      {
        node: 'n1',
        guestId: '100',
        guestName: 'A',
        guestType: 'qemu',
        name: 'real',
        parent: 'no-parent',
        dateSerial: 46100,
        includeRam: true,
        sizeMib: mib(2048),
      },
    ]
    const snap = minimalSnapshot(snaps)
    const view = buildEstateView(mergeSnapshotsToEstate([snap]), [snap], 'active', TODAY)
    expect(view.snapshotSprawl.count).toBe(1)
    expect(view.snapshotSprawl.totalSizeMib).toBe(2048)
    expect(view.snapshotSprawl.rows[0]?.name).toBe('real')
  })
})
