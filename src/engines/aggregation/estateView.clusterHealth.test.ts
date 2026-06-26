import { describe, expect, it } from 'vitest'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes } from '@/engines/units'
import type { ProxmoxHaStatusRow, Snapshot } from '@/types/snapshot'
import { buildEstateView, EMPTY_VIEW } from './estateView'

const TODAY = new Date('2026-06-23T00:00:00Z')

const minimalSnapshot = (haStatus: ProxmoxHaStatusRow[]): Snapshot => ({
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
  proxmoxStorageContent: [],
  proxmoxHaResources: [],
  proxmoxHaStatus: haStatus,
  proxmoxBackupJobs: [],
  parseErrors: [],
})

describe('buildEstateView — clusterHealth slice', () => {
  it('EMPTY_VIEW carries a zeroed clusterHealth', () => {
    expect(EMPTY_VIEW.clusterHealth).toEqual({
      ha: { resources: [], managedCount: 0, quorumStatus: null, fencingStatus: null, services: [] },
      backups: { jobs: [], jobCount: 0, enabledCount: 0, guestsCovered: 0 },
    })
  })

  it('composes cluster health from merged HA status rows', () => {
    const haStatus: ProxmoxHaStatusRow[] = [
      {
        id: 'quorum-1',
        type: 'quorum',
        status: 'OK',
        node: 'pve1',
        sid: '',
        state: '',
        crmState: '',
        requestState: '',
        quorate: 'X',
      },
    ]
    const snap = minimalSnapshot(haStatus)
    const view = buildEstateView(mergeSnapshotsToEstate([snap]), [snap], 'active', TODAY)
    expect(view.clusterHealth.ha.quorumStatus).toBe('OK')
  })
})
