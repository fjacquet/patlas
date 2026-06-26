import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'
import { RightSizingView } from './RightSizingView'

/** A one-VM snapshot whose usage triggers oversized (CPU+mem) AND stressed
 *  (balloon + CPU-ready): cpu 300/(4·2200)=3.4% ≤10; active 1024/8192=12.5%
 *  ≤20; balloon 64>0; ready 7>5. */
const snap = (): Snapshot =>
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
    guests: [
      {
        vmName: 'web01',
        cluster: 'C1',
        host: 'h1',
        vcpu: cores(4),
        vramMib: mib(8192),
        cpuReadinessPercent: 7,
        powerState: 'poweredOn',
        template: false,
        poweredOn: true,
        osConfig: '',
        osTools: '',
        vmBiosUuid: '',
        vmInstanceUuid: 'i1',
        viSdkUuid: '',
        viSdkServer: '',
        guestType: 'qemu',
        provisionedMib: mib(0),
        inUseMib: mib(0),
        path: '',
      },
    ],
    nodes: [
      {
        hostName: 'h1',
        cluster: 'C1',
        sockets: sockets(2),
        cores: cores(16),
        speedMhz: mhz(2200),
        memoryMib: mib(262_144),
        cpuRatio: 0.1,
        ramRatio: 0.1,
        faultDomain: '',
        model: '',
        vendor: '',
        serialNumber: '',
        esxVersion: '',
      },
    ],
    vmUsage: [
      {
        vmName: 'web01',
        cluster: 'C1',
        vmBiosUuid: '',
        vmInstanceUuid: 'i1',
        activeMib: mib(1024),
        consumedMib: mib(2048),
        balloonedMib: mib(64),
        swappedMib: mib(0),
        cpuUsageMhz: mhz(300),
      },
    ],
    proxmoxSnapshots: [],
    proxmoxStorageContent: [],
    proxmoxHaResources: [],
    proxmoxHaStatus: [],
    proxmoxBackupJobs: [],
    storages: [],
    vpartition: [],
    nodeInterfaces: [],

    vmNics: [],
    parseErrors: [],
  }) as Snapshot

describe('RightSizingView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })
  afterEach(() => {
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty-state when no usage data is loaded', () => {
    render(<RightSizingView />)
    expect(screen.getByText(/no usage data/i)).toBeInTheDocument()
  })

  it('renders the flagged VM and category counts when usage data is present', () => {
    useSnapshotStore.getState().addSnapshot(snap())
    render(<RightSizingView />)
    expect(screen.getByText('web01')).toBeInTheDocument()
    // The CPU-util cell shows ~3.4 % (powered-on, max-of-1 reading).
    expect(screen.getByText('3.4 %')).toBeInTheDocument()
  })

  it('editing the CPU-oversize threshold updates the store', async () => {
    useSnapshotStore.getState().addSnapshot(snap())
    render(<RightSizingView />)
    const input = screen.getByLabelText(/CPU oversize/i)
    await userEvent.clear(input)
    await userEvent.type(input, '5')
    expect(useSnapshotStore.getState().sizingThresholds.cpuOversizePct).toBe(5)
  })
})
