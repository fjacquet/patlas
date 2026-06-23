import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { bytes, mib } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ProxmoxStorageContentRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { StorageContentView } from './StorageContentView'

const snapshot = (content: ProxmoxStorageContentRow[]): Snapshot =>
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
    vinfo: [],
    vhost: [],
    vmUsage: [],
    vdatastore: [],
    vpartition: [],
    vnetwork: [],
    vswitch: [],
    dvswitch: [],
    dvport: [],
    proxmoxSnapshots: [],
    proxmoxStorageContent: content,
    parseErrors: [],
  }) satisfies Snapshot

const imageRow: ProxmoxStorageContentRow = {
  node: 'n1',
  storage: 'DATA',
  content: 'images',
  fileName: '100/d.qcow2',
  format: 'qcow2',
  sizeMib: mib(2048),
  usagePercent: 0.1,
  guestId: '100',
  guestName: 'Debian',
  creationSerial: null,
}

describe('StorageContentView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty state when no snapshot is loaded', () => {
    render(<StorageContentView />)
    expect(screen.getByText('No report loaded')).not.toBeNull()
  })

  it('renders the content-type breakdown row', () => {
    useSnapshotStore.getState().addSnapshot(snapshot([imageRow]))
    render(<StorageContentView />)
    expect(screen.getByText('By content type')).not.toBeNull()
    expect(screen.getAllByText('images').length).toBeGreaterThan(0)
  })

  it('shows the no-backups message when no backup files exist', () => {
    useSnapshotStore.getState().addSnapshot(snapshot([imageRow]))
    render(<StorageContentView />)
    expect(screen.getByText('No backup files found on this estate.')).not.toBeNull()
  })
})
