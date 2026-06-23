import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bytes, mib } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'
import { SnapshotSprawlView } from './SnapshotSprawlView'

const MIB_PER_GIB = 1024

const snap = (proxmoxSnapshots: Snapshot['proxmoxSnapshots'] = []): Snapshot =>
  ({
    id: 'a',
    filename: 'a.xlsx',
    fileSize: bytes(1),
    capturedAt: new Date('2026-01-01'),
    vCenterLabel: 'vc',
    rvtoolsVersion: '4.7.1.4',
    parsedAt: new Date('2026-01-02'),
    source: 'proxmox',
    viSdkUuid: null,
    vMetaData: [],
    vinfo: [],
    vhost: [],
    vmUsage: [],
    proxmoxSnapshots,
    proxmoxStorageContent: [],
    vdatastore: [],
    vpartition: [],
    vnetwork: [],
    vswitch: [],
    dvswitch: [],
    dvport: [],
    parseErrors: [],
  }) as Snapshot

const checkpoint = (
  guestName: string,
  sizeMib: number,
  ageDays = 10,
): Snapshot['proxmoxSnapshots'][number] => ({
  guestName,
  guestId: guestName,
  guestType: 'qemu',
  node: 'node1',
  name: `snap-${guestName}`,
  parent: 'no-parent',
  // Excel serial for 2026-01-01 minus ageDays
  dateSerial: 46023 - ageDays,
  sizeMib: mib(sizeMib),
  includeRam: false,
})

describe('SnapshotSprawlView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })
  afterEach(() => {
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty-state when no snapshot is loaded', () => {
    render(<SnapshotSprawlView />)
    expect(screen.getByText(/no snapshot loaded/i)).toBeInTheDocument()
  })

  it('shows the none-message when snapshot has no checkpoints', () => {
    useSnapshotStore.getState().addSnapshot(snap())
    render(<SnapshotSprawlView />)
    expect(screen.getByText(/no checkpoints found/i)).toBeInTheDocument()
  })

  it('lists checkpoint rows when present', () => {
    useSnapshotStore
      .getState()
      .addSnapshot(
        snap([checkpoint('guest-01', MIB_PER_GIB), checkpoint('guest-02', MIB_PER_GIB * 2)]),
      )
    render(<SnapshotSprawlView />)
    expect(screen.getByText('guest-01')).toBeInTheDocument()
    expect(screen.getByText('guest-02')).toBeInTheDocument()
  })

  it('shows KPI tile for checkpoint count', () => {
    useSnapshotStore.getState().addSnapshot(snap([checkpoint('guest-01', MIB_PER_GIB)]))
    render(<SnapshotSprawlView />)
    const tiles = screen.getAllByText(/checkpoints/i)
    expect(tiles.length).toBeGreaterThan(0)
  })
})
