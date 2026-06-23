import { cores, mhz, mib, sockets } from '@/engines/units'
import type { ParsedSheet } from '../parseXlsx'
import {
  adaptProxmox,
  adaptProxmoxGuests,
  adaptProxmoxNodes,
  adaptProxmoxStorages,
  adaptProxmoxUsage,
  extractClusterName,
} from './proxmox'

const sheet = (headers: string[], rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Cluster',
  headers,
  rows,
})

it('extracts the cluster name from row 0', () => {
  expect(extractClusterName(sheet(['Id', 'Name', 'Type'], [{ Name: 'pve-prod' }]))).toBe('pve-prod')
})

it('returns empty string when absent', () => {
  expect(extractClusterName(undefined)).toBe('')
  expect(extractClusterName(sheet(['Id'], [{}]))).toBe('')
})

it('maps a Node row to VHostRow with GiB→MiB memory', () => {
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
  }
  const [u] = adaptProxmoxUsage(vms_usage, undefined, 'pve-prod')
  if (!u) throw new Error('Expected usage row to be defined')
  expect(u.vmName).toBe('web01')
  expect(u.consumedMib).toBe(mib(4096))
  expect(u.cpuUsageMhz).toBeNull()
})

it('assembles a bundle from a workbook (Nodes + VMs required)', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Cluster', { name: 'Cluster', headers: ['Name'], rows: [{ Name: 'pve-prod' }] })
  wb.sheets.set('Nodes', {
    name: 'Nodes',
    headers: ['Node', 'Cpu Cores', 'Memory Size GB'],
    rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Memory Size GB': 24 }],
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
  })
  const b = adaptProxmox(wb)
  expect(b.clusterName).toBe('pve-prod')
  expect(b.vhost).toHaveLength(1)
  expect(b.vinfo).toHaveLength(1)
  expect(b.vinfo[0]?.cluster).toBe('pve-prod')
})

it('throws a ParseError when the Nodes sheet is missing', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('VMs', { name: 'VMs', headers: ['Name'], rows: [] })
  expect(() => adaptProxmox(wb)).toThrow(/Nodes/)
})

it('throws a ParseError when both VMs and Containers sheets are missing', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Nodes', {
    name: 'Nodes',
    headers: ['Node', 'Cpu Cores', 'Memory Size GB'],
    rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Memory Size GB': 24 }],
  })
  expect(() => adaptProxmox(wb)).toThrow(/VMs|Containers/)
})

it('falls back to "proxmox" cluster name when no Cluster sheet is present', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Nodes', {
    name: 'Nodes',
    headers: ['Node', 'Cpu Cores', 'Memory Size GB'],
    rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Memory Size GB': 24 }],
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
  })
  const b = adaptProxmox(wb)
  expect(b.clusterName).toBe('proxmox')
  expect(b.vhost[0]?.cluster).toBe('proxmox')
  expect(b.vinfo[0]?.cluster).toBe('proxmox')
})
