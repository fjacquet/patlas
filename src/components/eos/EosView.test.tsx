/**
 * EosView — node section relabel (Task pB-04).
 * Asserts the node section renders with the new PVE terminology i18n keys:
 *   - heading:     eos:nodesHeading
 *   - col header:  eos:col.pveVersion
 *
 * Uses the same store-injection pattern as MonsterVmView.test.tsx / RightSizingView.test.tsx.
 * Chart mock mirrors dashboard-smoke.test.tsx (jsdom cannot render real ECharts SVG).
 */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'

vi.mock('echarts-for-react/esm/core', () => ({
  default: (props: { opts?: { renderer?: string } }) =>
    props.opts?.renderer === 'svg' ? (
      <svg data-testid="echarts-svg" />
    ) : (
      <canvas data-testid="echarts-canvas" />
    ),
}))

import { EosView } from './EosView'

const snap = (): Snapshot =>
  ({
    id: 'eos-test',
    filename: 'test.xlsx',
    fileSize: bytes(1),
    capturedAt: new Date('2026-06-01T00:00:00Z'),
    vCenterLabel: 'pve',
    rvtoolsVersion: '',
    parsedAt: new Date('2026-06-01T00:00:00Z'),
    source: 'proxmox',
    viSdkUuid: null,
    vMetaData: [],
    guests: [
      {
        vmName: 'debian-01',
        cluster: 'pve-cluster',
        host: 'pve-node-1',
        vcpu: cores(2),
        vramMib: mib(4096),
        cpuReadinessPercent: null,
        powerState: 'poweredOn' as const,
        template: false,
        poweredOn: true,
        osConfig: 'Debian 12',
        osTools: 'Debian 12',
        vmBiosUuid: '',
        vmInstanceUuid: 'vm-101',
        viSdkUuid: '',
        viSdkServer: '',
        provisionedMib: mib(20480),
        inUseMib: mib(5120),
        path: '',
        guestType: 'qemu' as const,
      },
    ],
    nodes: [
      {
        hostName: 'pve-node-1',
        cluster: 'pve-cluster',
        sockets: sockets(1),
        cores: cores(8),
        speedMhz: mhz(3200),
        memoryMib: mib(65536),
        cpuRatio: 0.2,
        ramRatio: 0.3,
        faultDomain: '',
        model: 'AMD EPYC 7302',
        vendor: 'Supermicro',
        serialNumber: 'SN12345',
        // esxVersion stores the raw parser field; EOS engine maps to pveVersion
        esxVersion: '8.2',
      },
    ],
    vmUsage: [],
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

describe('EosView — Proxmox node section labels (pB-04)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  afterEach(() => {
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty-state heading when no snapshot is loaded', () => {
    render(<EosView />)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('renders the node section heading using nodesHeading (not esxiHeading)', () => {
    useSnapshotStore.getState().addSnapshot(snap())
    render(<EosView />)
    // EN value for eos:nodesHeading
    expect(screen.getByText('Node end-of-support')).toBeInTheDocument()
  })

  it('renders the PVE version column header (col.pveVersion, not col.esxVersion)', () => {
    useSnapshotStore.getState().addSnapshot(snap())
    render(<EosView />)
    // EN value for eos:col.pveVersion
    expect(screen.getByText('PVE version')).toBeInTheDocument()
  })
})
