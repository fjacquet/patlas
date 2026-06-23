import { cores, mhz, mib, sockets } from '@/engines/units'
import type { ParsedSheet } from '../parseXlsx'
import { adaptProxmoxNodes, extractClusterName } from './proxmox'

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
