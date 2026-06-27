import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { bytes } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ProxmoxBackupJobRow, ProxmoxHaResourceRow, ProxmoxHaStatusRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { ClusterHealthView } from './ClusterHealthView'

const snapshot = (
  haResources: ProxmoxHaResourceRow[],
  haStatus: ProxmoxHaStatusRow[],
  backupJobs: ProxmoxBackupJobRow[],
): Snapshot =>
  ({
    id: 's1',
    filename: 's1.xlsx',
    fileSize: bytes(0),
    capturedAt: new Date('2026-06-23'),
    vCenterLabel: 'proxmox',
    rvtoolsVersion: '',
    parsedAt: new Date('2026-06-23'),
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
    proxmoxHaResources: haResources,
    proxmoxHaStatus: haStatus,
    proxmoxBackupJobs: backupJobs,
    parseErrors: [],
  }) satisfies Snapshot

const quorumStatusRow: ProxmoxHaStatusRow = {
  id: 'quorum-1',
  type: 'quorum',
  status: 'OK',
  node: 'pve1',
  sid: '',
  state: '',
  crmState: '',
  requestState: '',
  quorate: 'X',
}

const haResourceRow: ProxmoxHaResourceRow = {
  sid: 'vm:100',
  type: 'vm',
  state: 'started',
  group: 'grp1',
  failback: 'yes',
  maxRestart: 1,
  maxRelocate: 1,
  comment: '',
}

describe('ClusterHealthView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty state when no snapshot is loaded', () => {
    render(<ClusterHealthView />)
    expect(screen.getByText('No report loaded')).not.toBeNull()
  })

  it('renders the quorum KPI value and empty messages when resources/jobs are absent', () => {
    useSnapshotStore.getState().addSnapshot(snapshot([], [quorumStatusRow], []))
    render(<ClusterHealthView />)
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0)
    expect(screen.getByText('No guests are managed by HA.')).not.toBeNull()
    expect(screen.getByText('No backup jobs are scheduled.')).not.toBeNull()
  })

  it('resolves table headers to labels, not raw col.* keys (DataTable inventory ns)', () => {
    useSnapshotStore.getState().addSnapshot(snapshot([haResourceRow], [], []))
    render(<ClusterHealthView />)
    expect(screen.getAllByText('Service ID').length).toBeGreaterThan(0)
    expect(screen.queryByText('col.sid')).toBeNull()
  })
})
