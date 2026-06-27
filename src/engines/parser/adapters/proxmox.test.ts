import { aggregateHostsPerCluster } from '@/engines/aggregation/perCluster'
import { cores, mhz, mib, sockets } from '@/engines/units'
import type { ParsedSheet } from '../parseXlsx'
import {
  adaptProxmox,
  adaptProxmoxGuests,
  adaptProxmoxNodes,
  adaptProxmoxRrdGuests,
  adaptProxmoxRrdNodeSeries,
  adaptProxmoxRrdNodes,
  adaptProxmoxRrdStorage,
  adaptProxmoxStorages,
  adaptProxmoxUsage,
  extractClusterName,
} from './proxmox'

const sheet = (headers: string[], rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Cluster',
  headers,
  rows,
  cells: [],
})

it('extracts the cluster name from row 0', () => {
  expect(extractClusterName(sheet(['Id', 'Name', 'Type'], [{ Name: 'pve-prod' }]))).toBe('pve-prod')
})

it('returns empty string when absent', () => {
  expect(extractClusterName(undefined)).toBe('')
  expect(extractClusterName(sheet(['Id'], [{}]))).toBe('')
})

it('maps a Node row to NodeRow with GiB→MiB memory', () => {
  const s: ParsedSheet = {
    name: 'Nodes',
    headers: [
      'Node',
      'Cpu Sockets',
      'Cpu Cores',
      'Cpu Mhz',
      'Memory Size GB',
      'Memory Usage %',
      'Cpu Model',
      'Pve Version',
    ],
    rows: [
      {
        Node: 'pve1',
        'Cpu Sockets': 1,
        'Cpu Cores': 4,
        'Cpu Mhz': 2400,
        'Memory Size GB': 24,
        'Memory Usage %': 50,
        'Cpu Model': 'EPYC',
        'Pve Version': '8.2',
      },
    ],
    cells: [],
  }
  const hosts = adaptProxmoxNodes(s, 'pve-prod')
  expect(hosts).toHaveLength(1)
  const h = hosts[0]
  if (!h) throw new Error('Expected host to be defined')
  expect(h.hostName).toBe('pve1')
  expect(h.cluster).toBe('pve-prod')
  expect(h.cores).toBe(cores(4))
  expect(h.sockets).toBe(sockets(1))
  expect(h.speedMhz).toBe(mhz(2400))
  expect(h.memoryMib).toBe(mib(24576))
  expect(h.ramRatio).toBeCloseTo(0.5)
  expect(h.cpuRatio).toBe(0)
  expect(h.esxVersion).toBe('8.2')
})

const vms: ParsedSheet = {
  name: 'VMs',
  headers: [
    'Name',
    'Node',
    'Vm Id',
    'Cores',
    'Sockets',
    'Memory Size GB',
    'Status',
    'Is Template',
    'Os Name',
    'Os Version',
    'Disk Size GB',
    'Disk Usage GB',
  ],
  rows: [
    {
      Name: 'web01',
      Node: 'pve1',
      'Vm Id': 100,
      Cores: 2,
      Sockets: 2,
      'Memory Size GB': 8,
      Status: 'running',
      'Is Template': 'false',
      'Os Name': 'Debian',
      'Os Version': '12',
      'Disk Size GB': 50,
      'Disk Usage GB': 20,
    },
  ],
  cells: [],
}
const cts: ParsedSheet = {
  name: 'Containers',
  headers: [
    'Name',
    'Node',
    'Vm Id',
    'Cores',
    'Memory Size GB',
    'Status',
    'Os Version',
    'Disk Size GB',
    'Disk Usage GB',
  ],
  rows: [
    {
      Name: 'dns01',
      Node: 'pve1',
      'Vm Id': 104,
      Cores: 1,
      'Memory Size GB': 1,
      Status: 'stopped',
      'Os Version': 'alpine 3.19',
      'Disk Size GB': 8,
      'Disk Usage GB': 2,
    },
  ],
  cells: [],
}

it('maps VMs as qemu with vcpu = cores × sockets', () => {
  const g = adaptProxmoxGuests(vms, undefined, 'pve-prod')
  expect(g).toHaveLength(1)
  const vm = g[0]
  if (!vm) throw new Error('Expected VM to be defined')
  expect(vm.guestType).toBe('qemu')
  expect(vm.vcpu).toBe(cores(4))
  expect(vm.vramMib).toBe(mib(8192))
  expect(vm.poweredOn).toBe(true)
  expect(vm.host).toBe('pve1')
})

it('maps Containers as lxc with sockets defaulting to 1', () => {
  const g = adaptProxmoxGuests(undefined, cts, 'pve-prod')
  const ct = g[0]
  if (!ct) throw new Error('Expected container to be defined')
  expect(ct.guestType).toBe('lxc')
  expect(ct.vcpu).toBe(cores(1))
  expect(ct.powerState).toBe('poweredOff')
  expect(ct.osTools).toBe('alpine 3.19')
})

it('concatenates both sheets', () => {
  expect(adaptProxmoxGuests(vms, cts, 'pve-prod')).toHaveLength(2)
})

it('maps Storage row with free = size − usage', () => {
  const s: ParsedSheet = {
    name: 'Storages',
    headers: ['Node', 'Storage', 'Plugin Type', 'Disk Size GB', 'Disk Usage GB', 'Shared'],
    rows: [
      {
        Node: 'pve1',
        Storage: 'local-lvm',
        'Plugin Type': 'lvmthin',
        'Disk Size GB': 100,
        'Disk Usage GB': 40,
        Shared: 'false',
      },
    ],
    cells: [],
  }
  const [d] = adaptProxmoxStorages(s)
  if (!d) throw new Error('Expected datastore to be defined')
  expect(d.name).toBe('local-lvm')
  expect(d.type).toBe('lvmthin')
  expect(d.capacityMib).toBe(mib(102400))
  expect(d.freeMib).toBe(mib(61440))
})

it('maps native usage % to vmUsage (null when absent)', () => {
  const vms_usage: ParsedSheet = {
    name: 'VMs',
    headers: ['Name', 'Vm Id', 'Memory Usage GB', 'Cpu Usage %'],
    rows: [{ Name: 'web01', 'Vm Id': 100, 'Memory Usage GB': 4, 'Cpu Usage %': '' }],
    cells: [],
  }
  const [u] = adaptProxmoxUsage(vms_usage, undefined, 'pve-prod')
  if (!u) throw new Error('Expected usage row to be defined')
  expect(u.vmName).toBe('web01')
  expect(u.consumedMib).toBe(mib(4096))
  expect(u.cpuUsageMhz).toBeNull()
})

it('assembles a bundle from a workbook (Nodes + VMs required)', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Cluster', {
    name: 'Cluster',
    headers: ['Name'],
    rows: [{ Name: 'pve-prod' }],
    cells: [],
  })
  wb.sheets.set('Nodes', {
    name: 'Nodes',
    headers: ['Node', 'Cpu Cores', 'Memory Size GB'],
    rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Memory Size GB': 24 }],
    cells: [],
  })
  wb.sheets.set('VMs', {
    name: 'VMs',
    headers: ['Name', 'Node', 'Vm Id', 'Cores', 'Sockets', 'Memory Size GB', 'Status'],
    rows: [
      {
        Name: 'web01',
        Node: 'pve1',
        'Vm Id': 100,
        Cores: 2,
        Sockets: 1,
        'Memory Size GB': 8,
        Status: 'running',
      },
    ],
    cells: [],
  })
  const b = adaptProxmox(wb)
  expect(b.clusterName).toBe('pve-prod')
  expect(b.nodes).toHaveLength(1)
  expect(b.guests).toHaveLength(1)
  expect(b.guests[0]?.cluster).toBe('pve-prod')
})

it('throws a ParseError when the Nodes sheet is missing', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('VMs', { name: 'VMs', headers: ['Name'], rows: [], cells: [] })
  expect(() => adaptProxmox(wb)).toThrow(/Nodes/)
})

it('throws a ParseError when both VMs and Containers sheets are missing', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Nodes', {
    name: 'Nodes',
    headers: ['Node', 'Cpu Cores', 'Memory Size GB'],
    rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Memory Size GB': 24 }],
    cells: [],
  })
  expect(() => adaptProxmox(wb)).toThrow(/VMs|Containers/)
})

it('falls back to first node hostname as cluster name when no Cluster sheet is present', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Nodes', {
    name: 'Nodes',
    headers: ['Node', 'Cpu Cores', 'Memory Size GB'],
    rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Memory Size GB': 24 }],
    cells: [],
  })
  wb.sheets.set('VMs', {
    name: 'VMs',
    headers: ['Name', 'Node', 'Vm Id', 'Cores', 'Sockets', 'Memory Size GB', 'Status'],
    rows: [
      {
        Name: 'web01',
        Node: 'pve1',
        'Vm Id': 100,
        Cores: 2,
        Sockets: 1,
        'Memory Size GB': 8,
        Status: 'running',
      },
    ],
    cells: [],
  })
  const b = adaptProxmox(wb)
  // When no Cluster sheet: derive cluster name from first node hostname (not 'proxmox').
  expect(b.clusterName).toBe('pve1')
  expect(b.nodes[0]?.cluster).toBe('pve1')
  expect(b.guests[0]?.cluster).toBe('pve1')
})

// ── RRD Nodes CPU fix (P3) ───────────────────────────────────────────────────

const rrdNodesSheet = (rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'RRD Nodes',
  headers: ['Node', 'Time Date', 'Cpu Usage %', 'Memory Usage %'],
  rows,
  cells: [],
})

it('adaptProxmoxRrdNodes: returns empty map for undefined sheet', () => {
  expect(adaptProxmoxRrdNodes(undefined).size).toBe(0)
})

it('adaptProxmoxRrdNodes: picks the LATEST sample per node', () => {
  const map = adaptProxmoxRrdNodes(
    rrdNodesSheet([
      { Node: 'pve1', 'Time Date': '2024-01-01 00:00:00', 'Cpu Usage %': 0.05 },
      { Node: 'pve1', 'Time Date': '2024-01-01 01:00:00', 'Cpu Usage %': 0.15 },
      { Node: 'pve1', 'Time Date': '2024-01-01 00:30:00', 'Cpu Usage %': 0.32 },
    ]),
  )
  // latest timestamp wins → 01:00:00 → 0.15
  expect(map.get('pve1')).toBeCloseTo(0.15)
})

it('adaptProxmoxRrdNodes: skips rows with missing Cpu Usage %', () => {
  const map = adaptProxmoxRrdNodes(
    rrdNodesSheet([{ Node: 'pve1', 'Time Date': '2024-01-01 00:00:00', 'Cpu Usage %': '' }]),
  )
  expect(map.size).toBe(0)
})

// ── P8 Pack A — full RRD time-series parsing ─────────────────────────────────

const rrdNodeSeriesSheet = (rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'RRD Nodes',
  headers: [
    'Node',
    'Time Date',
    'Cpu Usage %',
    'Memory Usage %',
    'Io Wait %',
    'Loadavg',
    'Net In MB',
    'Net Out MB',
    'Psi Mem Some %',
  ],
  rows,
  cells: [],
})

it('adaptProxmoxRrdNodeSeries: returns [] for an absent sheet', () => {
  expect(adaptProxmoxRrdNodeSeries(undefined)).toEqual([])
})

it('adaptProxmoxRrdNodeSeries: parses the full series with a numeric serial', () => {
  const series = adaptProxmoxRrdNodeSeries(
    rrdNodeSeriesSheet([
      {
        Node: 'pve1',
        'Time Date': 46198.25,
        'Cpu Usage %': 0.27,
        'Memory Usage %': 0.32,
        'Io Wait %': 0.001,
        Loadavg: 1.6,
        'Net In MB': 2.5,
        'Net Out MB': 2.1,
        'Psi Mem Some %': 0,
      },
    ]),
  )
  expect(series).toHaveLength(1)
  expect(series[0]).toMatchObject({
    node: 'pve1',
    timeSerial: 46198.25,
    cpuRatio: 0.27,
    memRatio: 0.32,
    loadavg: 1.6,
    netInMb: 2.5,
  })
})

it('adaptProxmoxRrdStorage: parses node/storage capacity samples', () => {
  const sheet2: ParsedSheet = {
    name: 'RRD Storage',
    headers: ['Node', 'Storage', 'Time Date', 'Size GB', 'Used GB', 'Usage %'],
    rows: [
      {
        Node: 'pve1',
        Storage: 'local',
        'Time Date': 46198.25,
        'Size GB': 95.6,
        'Used GB': 29.5,
        'Usage %': 0.308,
      },
      { Node: '', Storage: '', 'Time Date': 46198.25, 'Size GB': 1, 'Used GB': 1, 'Usage %': 0 }, // skipped
    ],
    cells: [],
  }
  const rows = adaptProxmoxRrdStorage(sheet2)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    node: 'pve1',
    storage: 'local',
    usedGib: 29.5,
    usageRatio: 0.308,
  })
})

it('adaptProxmoxRrdGuests: degrades to [] when the sheet is absent', () => {
  expect(adaptProxmoxRrdGuests(undefined)).toEqual([])
})

it('adaptProxmoxNodes: cpuRatio comes from RRD map (non-zero)', () => {
  const s: ParsedSheet = {
    name: 'Nodes',
    headers: ['Node', 'Cpu Sockets', 'Cpu Cores', 'Cpu Mhz', 'Memory Size GB', 'Memory Usage %'],
    rows: [
      {
        Node: 'pve1',
        'Cpu Sockets': 1,
        'Cpu Cores': 4,
        'Cpu Mhz': 2400,
        'Memory Size GB': 16,
        'Memory Usage %': 40,
      },
    ],
    cells: [],
  }
  const rrdMap = new Map([['pve1', 0.22]])
  const [h] = adaptProxmoxNodes(s, 'pve-prod', rrdMap)
  if (!h) throw new Error('Expected host')
  expect(h.cpuRatio).toBeCloseTo(0.22)
})

it('cluster avgCpuPct is non-zero when nodes have RRD-derived cpuRatio', () => {
  const nodes = [
    {
      hostName: 'pve1',
      cluster: 'pve-prod',
      sockets: sockets(1),
      cores: cores(8),
      speedMhz: mhz(2400),
      memoryMib: mib(32768),
      cpuRatio: 0.18, // from RRD
      ramRatio: 0.4,
      faultDomain: '',
      model: '',
      vendor: '',
      serialNumber: '',
      esxVersion: '8.2',
    },
  ]
  const [c] = aggregateHostsPerCluster(nodes)
  if (!c) throw new Error('Expected cluster stat')
  // meanCpuRatio = consumed/physical; consumed = 8*2400*0.18 → physical=8*2400 → ratio=0.18
  expect(c.meanCpuRatio).toBeCloseTo(0.18)
  expect(c.meanCpuRatio).toBeGreaterThan(0)
})

it('adaptProxmoxUsage: derives cpuUsageMhz from cpuUsagePct × vcpu × coreMhz', () => {
  const vmsSheet: ParsedSheet = {
    name: 'VMs',
    headers: ['Name', 'Node', 'Vm Id', 'Cores', 'Sockets', 'Memory Usage GB', 'Cpu Usage %'],
    rows: [
      {
        Name: 'web01',
        Node: 'pve1',
        'Vm Id': 100,
        Cores: 2,
        Sockets: 1,
        'Memory Usage GB': 4,
        'Cpu Usage %': 0.15,
      },
    ],
    cells: [],
  }
  const nodeSpeedByName = new Map([['pve1', 2400]])
  const [u] = adaptProxmoxUsage(vmsSheet, undefined, 'pve-prod', nodeSpeedByName)
  if (!u) throw new Error('Expected usage row')
  // cpuUsageMhz = 0.15 × 2 vcpu × 2400 MHz = 720 MHz
  expect(u.cpuUsageMhz).toBeCloseTo(720)
  expect(u.cpuUsageMhz).not.toBeNull()
})

it('adaptProxmoxUsage: cpuUsageMhz is null when node speed is unknown', () => {
  const vmsSheet: ParsedSheet = {
    name: 'VMs',
    headers: ['Name', 'Node', 'Vm Id', 'Cores', 'Sockets', 'Cpu Usage %'],
    rows: [
      {
        Name: 'web01',
        Node: 'unknown-node',
        'Vm Id': 100,
        Cores: 2,
        Sockets: 1,
        'Cpu Usage %': 0.15,
      },
    ],
    cells: [],
  }
  // empty nodeSpeedByName → coreMhz undefined → null
  const [u] = adaptProxmoxUsage(vmsSheet, undefined, 'pve-prod')
  if (!u) throw new Error('Expected usage row')
  expect(u.cpuUsageMhz).toBeNull()
})

it('adaptProxmox: wires RRD Nodes into node cpuRatio end-to-end', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Nodes', {
    name: 'Nodes',
    headers: ['Node', 'Cpu Cores', 'Cpu Mhz', 'Memory Size GB'],
    rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Cpu Mhz': 2400, 'Memory Size GB': 16 }],
    cells: [],
  })
  wb.sheets.set('VMs', {
    name: 'VMs',
    headers: [
      'Name',
      'Node',
      'Vm Id',
      'Cores',
      'Sockets',
      'Memory Size GB',
      'Status',
      'Cpu Usage %',
    ],
    rows: [
      {
        Name: 'web01',
        Node: 'pve1',
        'Vm Id': 100,
        Cores: 2,
        Sockets: 1,
        'Memory Size GB': 8,
        Status: 'running',
        'Cpu Usage %': 0.2,
      },
    ],
    cells: [],
  })
  wb.sheets.set('RRD Nodes', {
    name: 'RRD Nodes',
    headers: ['Node', 'Time Date', 'Cpu Usage %'],
    rows: [{ Node: 'pve1', 'Time Date': '2024-01-01 12:00:00', 'Cpu Usage %': 0.25 }],
    cells: [],
  })
  const b = adaptProxmox(wb)
  // node cpuRatio from RRD (0.25, not 0)
  expect(b.nodes[0]?.cpuRatio).toBeCloseTo(0.25)
  // VM cpuUsageMhz derived: 0.20 × 2 × 2400 = 960 MHz
  expect(b.vmUsage[0]?.cpuUsageMhz).toBeCloseTo(960)
})
