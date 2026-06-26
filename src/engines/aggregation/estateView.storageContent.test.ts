import { describe, expect, it } from 'vitest'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, mib } from '@/engines/units'
import type { ProxmoxStorageContentRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { buildEstateView, EMPTY_VIEW } from './estateView'

const TODAY = new Date('2026-06-23T00:00:00Z')

const minimalSnapshot = (content: ProxmoxStorageContentRow[]): Snapshot => ({
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
  proxmoxSnapshots: [],
  proxmoxStorageContent: content,
  proxmoxHaResources: [],
  proxmoxHaStatus: [],
  proxmoxBackupJobs: [],
  parseErrors: [],
})

describe('buildEstateView — storageContent slice', () => {
  it('EMPTY_VIEW carries a zeroed storageContent', () => {
    expect(EMPTY_VIEW.storageContent).toEqual({
      byContent: [],
      byStorage: [],
      backups: {
        rows: [],
        count: 0,
        guestsCovered: 0,
        totalSizeMib: 0,
        newestAgeDays: null,
        oldestAgeDays: null,
      },
      totalSizeMib: 0,
      fileCount: 0,
    })
  })

  it('composes storage-content health from merged rows', () => {
    const content: ProxmoxStorageContentRow[] = [
      {
        node: 'n1',
        storage: 'DATA',
        content: 'images',
        fileName: 'a.qcow2',
        format: 'qcow2',
        sizeMib: mib(2048),
        usagePercent: 0.1,
        guestId: '100',
        guestName: 'A',
        creationSerial: null,
      },
    ]
    const snap = minimalSnapshot(content)
    const view = buildEstateView(mergeSnapshotsToEstate([snap]), [snap], 'active', TODAY)
    expect(view.storageContent.fileCount).toBe(1)
    expect(view.storageContent.totalSizeMib).toBe(2048)
    expect(view.storageContent.byContent[0]?.content).toBe('images')
  })
})
