import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'
import { NetworkView } from './NetworkView'

const baseVm = {
  vmName: 'vm-1',
  cluster: 'CL_1',
  host: 'esx-1',
  vcpu: cores(2),
  vramMib: mib(4096),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn' as const,
  template: false,
  osConfig: 'RHEL 8',
  osTools: '',
  vmBiosUuid: 'b1',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: mib(100),
  inUseMib: mib(50),
  path: '[DS_A] vm-1/vm-1.vmx',
}

const snapshot = (withNetwork: boolean, networkSvg?: string | null): Snapshot =>
  ({
    id: 's1',
    filename: 's1.xlsx',
    fileSize: 0,
    capturedAt: new Date('2026-01-01'),
    vCenterLabel: 'vc-a',
    rvtoolsVersion: '4.4.0',
    parsedAt: new Date('2026-01-02'),
    source: 'proxmox',
    viSdkUuid: null,
    networkSvg: networkSvg ?? null,
    vMetaData: [],
    guests: [baseVm],
    nodes: [],
    storages: [],
    vpartition: [],
    vnetwork: withNetwork
      ? [
          {
            vm: 'vm-1',
            network: 'PG-Prod',
            switch: 'vSwitch0',
            adapter: 'vmxnet3',
            connected: 'True',
            cluster: 'CL_1',
            host: 'esx-1',
          },
        ]
      : [],
    vswitch: withNetwork
      ? [
          {
            host: 'esx-1',
            cluster: 'CL_1',
            switch: 'vSwitch0',
            ports: 128,
            freePorts: 96,
            mtu: 1500,
          },
        ]
      : [],
    dvswitch: withNetwork
      ? [
          {
            switch: 'DVS-1',
            name: 'prod-dvs',
            version: '8.0.0',
            hostMembers: 'esx-1',
            ports: 512,
            vms: 40,
            maxMtu: 9000,
          },
        ]
      : [],
    dvport: [],
    parseErrors: [],
  }) as unknown as Snapshot

describe('NetworkView (LC-3)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('renders the three network sections when network sheets are present', () => {
    useSnapshotStore.getState().addSnapshot(snapshot(true))
    render(<NetworkView />)
    expect(screen.getByText(/Standard switches/)).not.toBeNull()
    expect(screen.getByText(/Distributed switches/)).not.toBeNull()
    expect(screen.getByText(/Guest portgroups/)).not.toBeNull()
  })

  it('factual-degrades to a single line when no network sheets (no crash, no icon)', () => {
    useSnapshotStore.getState().addSnapshot(snapshot(false))
    render(<NetworkView />)
    expect(screen.getByText('Network inventory not available in this export.')).not.toBeNull()
    expect(screen.queryByText(/Standard switches/)).toBeNull()
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
