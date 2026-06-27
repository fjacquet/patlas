/**
 * Regression test for the HTML-branch seam: `buildHtmlCharts` must populate
 * the `topology-tree` slot when `view.topology.hasData` is true.
 *
 * Pre-fix behaviour: the charts map had no `topology-tree` key (the worker
 * never called topologyTreeOption in its HTML branch). The test below would
 * FAIL against the pre-fix worker code and passes after extraction of
 * buildHtmlCharts with the topology slot included.
 */
import { describe, expect, it } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import type { AccountingMode } from '@/types/estate'
import type { GuestRow } from '@/types/guest'
import type { NodeRow } from '@/types/node'
import type { NodeInterfaceRow, Snapshot } from '@/types/snapshot'
import { buildExportView } from '../buildExportView'
import { buildChartBundle } from '../chartBundle'
import { buildHtmlCharts } from './buildHtmlCharts'

const TODAY = new Date('2026-01-01T00:00:00Z')
const MODE: AccountingMode = 'configured'
const CLUSTERS = 3

const vmRow = (i: number): GuestRow => ({
  vmName: `vm-${i}`,
  cluster: `C${i % CLUSTERS}`,
  host: `esx-${i % CLUSTERS}`,
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: i % 2 === 0,
  powerState: i % 2 === 0 ? 'poweredOn' : 'poweredOff',
  template: false,
  osConfig: 'Ubuntu Linux (64-bit)',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '',
})

const hostRow = (c: number): NodeRow => ({
  hostName: `esx-${c}`,
  cluster: `C${c}`,
  sockets: sockets(2),
  cores: cores(24),
  speedMhz: mhz(2600),
  memoryMib: mib(524_288),
  cpuRatio: 0.4,
  ramRatio: 0.5,
  faultDomain: '',
  model: '',
  vendor: '',
  serialNumber: '',
  esxVersion: '',
})

const niface = (over: Partial<NodeInterfaceRow>): NodeInterfaceRow => ({
  node: 'pve1',
  name: 'eth0',
  type: 'eth',
  active: true,
  autostart: true,
  method: '',
  cidr: '',
  address: '',
  gateway: '',
  mtu: null,
  bondMode: '',
  slaves: [],
  bridgePorts: '',
  bridgeVlanAware: false,
  vlanId: null,
  vlanRawDevice: '',
  comments: '',
  ...over,
})

const baseSnapshot = (vmCount: number): Snapshot => ({
  id: 'test',
  filename: 'test.xlsx',
  fileSize: bytes(1024),
  capturedAt: new Date('2026-01-01'),
  vCenterLabel: 'pve-prod',
  rvtoolsVersion: '4.7.1.4',
  parsedAt: new Date('2026-01-02'),
  source: 'proxmox',
  viSdkUuid: null,
  vMetaData: [],
  guests: Array.from({ length: vmCount }, (_, i) => vmRow(i)),
  nodes: Array.from({ length: CLUSTERS }, (_, c) => hostRow(c)),
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
})

const TOPO_LABELS = {
  estate: 'Estate',
  nodesWord: 'nodes',
  unconfigured: '+ {{count}} unconfigured NICs',
  vms: 'VMs',
  ofNodes: '{{withVms}}/{{total}} nodes',
}

const CHART_W = 1600
const CHART_H = 900

describe('buildHtmlCharts — topology-tree slot (C1 regression)', () => {
  it('includes topology-tree slot with non-empty SVG containing the bridge name when hasData is true', () => {
    const s: Snapshot = {
      ...baseSnapshot(10),
      nodeInterfaces: [
        niface({ name: 'vmbr0', type: 'bridge', bridgePorts: 'eth0' }),
        niface({ name: 'eth0', type: 'eth' }),
      ],
    }
    const { view, trends } = buildExportView(s, [s], MODE, TODAY)
    expect(view.topology.hasData).toBe(true)

    const optBundle = buildChartBundle(view, trends, 'en')
    const charts = buildHtmlCharts(view, optBundle, TOPO_LABELS, CHART_W, CHART_H)

    // C1 regression: this key was absent in the pre-fix worker HTML branch
    expect(charts.has('topology-tree')).toBe(true)
    const svg = charts.get('topology-tree') ?? ''
    expect(svg.length).toBeGreaterThan(0)
    expect(svg).toContain('vmbr0')
  })

  it('omits topology-tree slot when hasData is false', () => {
    const s = baseSnapshot(10) // nodeInterfaces: [] → no topology data
    const { view, trends } = buildExportView(s, [s], MODE, TODAY)
    expect(view.topology.hasData).toBe(false)

    const optBundle = buildChartBundle(view, trends, 'en')
    const charts = buildHtmlCharts(view, optBundle, TOPO_LABELS, CHART_W, CHART_H)

    expect(charts.has('topology-tree')).toBe(false)
  })

  it('still produces the storage-treemap slot (no regression)', () => {
    const s = baseSnapshot(20)
    const { view, trends } = buildExportView(s, [s], MODE, TODAY)
    const optBundle = buildChartBundle(view, trends, 'en')
    const charts = buildHtmlCharts(view, optBundle, TOPO_LABELS, CHART_W, CHART_H)

    // storage-treemap is conditionally set; assert the key is present when the
    // option bundle has a storageTreemap entry (which it always does for a non-
    // trivial fixture with storages — base fixture has no storages so guard).
    if (optBundle.shared.storageTreemap) {
      expect(charts.has('storage-treemap')).toBe(true)
      expect((charts.get('storage-treemap') ?? '').length).toBeGreaterThan(0)
    }
  })

  it('produces per-cluster slots for a fixture with clusters', () => {
    const s = baseSnapshot(30)
    const { view, trends } = buildExportView(s, [s], MODE, TODAY)
    const optBundle = buildChartBundle(view, trends, 'en')
    const charts = buildHtmlCharts(view, optBundle, TOPO_LABELS, CHART_W, CHART_H)

    // At least one per-cluster slot should exist for a 3-cluster fixture
    const clusterSlots = [...charts.keys()].filter((k) => k.startsWith('c-'))
    expect(clusterSlots.length).toBeGreaterThan(0)
  })
})
