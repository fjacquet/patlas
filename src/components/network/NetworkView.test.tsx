import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { bytes, cores, mib } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { NodeInterfaceRow, Snapshot, VmNicRow } from '@/types/snapshot'
import { NetworkView } from './NetworkView'

const baseVm = {
  vmName: 'vm-1',
  cluster: 'CL_1',
  host: 'pve-1',
  vcpu: cores(2),
  vramMib: mib(4096),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn' as const,
  template: false,
  osConfig: 'Debian 12',
  osTools: '',
  vmBiosUuid: 'b1',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: mib(100),
  inUseMib: mib(50),
  path: '[local] vm-1/vm-1.conf',
  guestType: 'qemu' as const,
}

const ethIface: NodeInterfaceRow = {
  node: 'pve-1',
  name: 'eth0',
  type: 'eth',
  active: true,
  autostart: true,
  method: 'manual',
  cidr: '',
  address: '',
  gateway: '',
  mtu: 1500,
  bondMode: '',
  slaves: [],
  bridgePorts: '',
  bridgeVlanAware: false,
  vlanId: null,
  vlanRawDevice: '',
  comments: '',
}

const nic: VmNicRow = {
  node: 'pve-1',
  vmId: '101',
  vmName: 'vm-1',
  vmType: 'qemu',
  macAddress: 'BC:24:11:AA:BB:CC',
  bridge: 'vmbr0',
  tag: null,
  model: 'virtio',
}

const snapshot = (withNetwork: boolean, networkSvg?: string | null): Snapshot =>
  ({
    id: 's1',
    filename: 's1.xlsx',
    fileSize: bytes(0),
    capturedAt: new Date('2026-01-01'),
    vCenterLabel: 'pve-cluster',
    rvtoolsVersion: '',
    parsedAt: new Date('2026-01-02'),
    source: 'proxmox',
    viSdkUuid: null,
    networkSvg: networkSvg ?? null,
    vMetaData: [],
    guests: [baseVm],
    nodes: [],
    storages: [],
    vpartition: [],
    nodeInterfaces: withNetwork ? [ethIface] : [],
    vmNics: withNetwork ? [nic] : [],
    parseErrors: [],
  }) as unknown as Snapshot

describe('NetworkView (P5 Proxmox)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('renders the node-interface and VM-NIC sections when network sheets are present', () => {
    useSnapshotStore.getState().addSnapshot(snapshot(true))
    render(<NetworkView />)
    expect(screen.getByText(/Node interfaces/i)).not.toBeNull()
    expect(screen.getByText(/Guest NICs/i)).not.toBeNull()
  })

  it('factual-degrades to a single line when no network sheets (no crash, no icon)', () => {
    useSnapshotStore.getState().addSnapshot(snapshot(false))
    render(<NetworkView />)
    expect(screen.getByText('Network inventory not available in this export.')).not.toBeNull()
    expect(screen.queryByText(/Node interfaces/i)).toBeNull()
  })

  it('renders <img> with svg data-URI when networkSvg is set and arrays are empty', () => {
    const svgStr = '<svg xmlns="http://www.w3.org/2000/svg"><text>topo</text></svg>'
    useSnapshotStore.getState().addSnapshot(snapshot(false, svgStr))
    render(<NetworkView />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(screen.queryByText('Network inventory not available in this export.')).toBeNull()
  })

  it('shows empty-state and no <img> when networkSvg is null and arrays are empty', () => {
    useSnapshotStore.getState().addSnapshot(snapshot(false, null))
    render(<NetworkView />)
    expect(screen.getByText('Network inventory not available in this export.')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
