import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'
import { MonsterVmView } from './MonsterVmView'

const vm = (name: string, vcpu: number, vramMib: number) => ({
  vmName: name,
  cluster: 'C1',
  host: 'h1',
  vcpu: cores(vcpu),
  vramMib: mib(vramMib),
  cpuReadinessPercent: null,
  powerState: 'poweredOn' as const,
  template: false,
  poweredOn: true,
  osConfig: '',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: name,
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(0),
  inUseMib: mib(0),
  path: '',
})

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
    vinfo: [vm('small-01', 4, 8192), vm('monster-01', 32, 16384)],
    vhost: [
      {
        hostName: 'h1',
        cluster: 'C1',
        sockets: sockets(2),
        cores: cores(48),
        speedMhz: mhz(2600),
        memoryMib: mib(1_048_576),
        cpuRatio: 0.3,
        ramRatio: 0.4,
        faultDomain: '',
        model: '',
        vendor: '',
        serialNumber: '',
        esxVersion: '',
      },
    ],
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
  }) as Snapshot

describe('MonsterVmView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })
  afterEach(() => {
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty-state when no snapshot is loaded', () => {
    render(<MonsterVmView />)
    expect(screen.getByText(/no snapshot loaded/i)).toBeInTheDocument()
  })

  it('lists only the monster VM (vCPU ≥ 16 default) and not the small one', () => {
    useSnapshotStore.getState().addSnapshot(snap())
    render(<MonsterVmView />)
    expect(screen.getByText('monster-01')).toBeInTheDocument()
    expect(screen.queryByText('small-01')).toBeNull()
  })

  it('editing the vCPU line updates the store', async () => {
    useSnapshotStore.getState().addSnapshot(snap())
    render(<MonsterVmView />)
    const input = screen.getByLabelText(/vCPU/i)
    await userEvent.clear(input)
    await userEvent.type(input, '8')
    expect(useSnapshotStore.getState().monsterThresholds.minVcpu).toBe(8)
  })
})
