import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'
import { HostsView } from './HostsView'

const snapshot = (): Snapshot =>
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
    vMetaData: [],
    vinfo: [
      {
        vmName: 'vm-1',
        cluster: 'CL_1',
        host: 'esx-1',
        vcpu: cores(2),
        vramMib: mib(4096),
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
        provisionedMib: mib(100),
        inUseMib: mib(50),
        path: '[DS_A] vm-1/vm-1.vmx',
      },
    ],
    vhost: [
      {
        hostName: 'esx-1',
        cluster: 'CL_1',
        sockets: sockets(2),
        cores: cores(24),
        speedMhz: mhz(2600),
        memoryMib: mib(262_144),
        cpuRatio: 0.3,
        ramRatio: 0.5,
        faultDomain: '',
        model: 'PowerEdge',
        vendor: 'Dell',
        esxVersion: '8.0.0',
      },
    ],
    vdatastore: [],
    vpartition: [],
    vnetwork: [],
    vswitch: [
      { host: 'esx-1', cluster: 'CL_1', switch: 'vSwitch0', ports: 128, freePorts: 96, mtu: 1500 },
    ],
    dvswitch: [],
    dvport: [],
    parseErrors: [],
  }) as unknown as Snapshot

describe('HostsView — ESX detail drill (LC-4, D-06)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('clicking a host name drills into the screen-fit ESX detail', async () => {
    useSnapshotStore.getState().addSnapshot(snapshot())
    render(<HostsView />)
    await userEvent.click(screen.getByRole('button', { name: 'esx-1' }))
    // EsxDetail renders: title + the per-host switch + back affordance.
    expect(screen.getByText(/ESX — esx-1/)).not.toBeNull()
    expect(screen.getByText('vSwitch0')).not.toBeNull()
    expect(screen.getByText(/Back/)).not.toBeNull()
  })
})
