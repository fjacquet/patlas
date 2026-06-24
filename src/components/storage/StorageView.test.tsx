import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { bytes, cores, mib } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'
import { StorageView } from './StorageView'

const snapshot = (): Snapshot =>
  ({
    id: 's1',
    filename: 's1.xlsx',
    fileSize: bytes(0),
    capturedAt: new Date('2026-01-01'),
    vCenterLabel: 'vc-a',
    rvtoolsVersion: '4.4.0',
    parsedAt: new Date('2026-01-02'),
    source: 'proxmox',
    viSdkUuid: null,
    vMetaData: [],
    vinfo: [
      {
        vmName: 'vm-1',
        cluster: 'CL_1',
        host: 'esx-1',
        vcpu: cores(4),
        vramMib: mib(8192),
        cpuReadinessPercent: null,
        poweredOn: true,
        powerState: 'poweredOn',
        template: false,
        osConfig: 'RHEL 8',
        osTools: '',
        vmBiosUuid: 'b1',
        vmInstanceUuid: '',
        viSdkUuid: '',
        viSdkServer: '',
        provisionedMib: mib(1000),
        inUseMib: mib(600),
        path: '[DS_A] vm-1/vm-1.vmx',
        guestType: 'qemu',
      },
    ],
    vhost: [],
    vmUsage: [],
    proxmoxSnapshots: [],
    proxmoxStorageContent: [],
    proxmoxHaResources: [],
    proxmoxHaStatus: [],
    proxmoxBackupJobs: [],
    vdatastore: [
      {
        name: 'DS_A',
        capacityMib: mib(1000),
        freeMib: mib(50),
        provisionedMib: mib(800),
        naa: null,
        type: 'vSAN',
        hosts: '2',
        clusterName: 'CL_1',
      },
    ],
    vpartition: [
      {
        vmName: 'vm-1',
        disk: '/',
        capacityMib: mib(1000),
        consumedMib: mib(990),
        freeMib: mib(10),
      },
    ],
    vnetwork: [],
    vswitch: [],
    dvswitch: [],
    dvport: [],
    parseErrors: [],
  }) satisfies Snapshot

describe('StorageView (D-05..D-08)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('renders the lens toggle, scope control and the factual threshold count line', () => {
    useSnapshotStore.getState().addSnapshot(snapshot())
    render(<StorageView />)
    expect(screen.getByText('Consumption')).not.toBeNull()
    expect(screen.getByText('Capacity')).not.toBeNull()
    expect(screen.getByText('Storage')).not.toBeNull()
    // factual alerts count line (no verdict / no colour) — default fs 90 %
    expect(screen.getByText(/partitions ≥ 90% used/)).not.toBeNull()
  })

  it('switches the lens via the toggle (aria-pressed flips)', async () => {
    useSnapshotStore.getState().addSnapshot(snapshot())
    render(<StorageView />)
    const capacity = screen.getByText('Capacity')
    expect(capacity.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(capacity)
    expect(capacity.getAttribute('aria-pressed')).toBe('true')
  })

  it('editing a threshold updates the factual count line (no second useMemo)', async () => {
    useSnapshotStore.getState().addSnapshot(snapshot())
    render(<StorageView />)
    const fs = screen.getByLabelText('Filesystem used %')
    await userEvent.clear(fs)
    await userEvent.type(fs, '50')
    expect(screen.getByText(/partitions ≥ 50% used/)).not.toBeNull()
  })
})
