import { mapColumns } from './columnMap'
import { GUEST_COLS, NODE_COLS, STORAGE_COLS } from './proxmoxColumns'

it('maps Proxmox Node headers', () => {
  const cols = mapColumns(
    ['Node', 'Cpu Sockets', 'Cpu Cores', 'Cpu Mhz', 'Memory Size GB'],
    NODE_COLS,
  )
  expect(cols.node).toBe('Node')
  expect(cols.sockets).toBe('Cpu Sockets')
  expect(cols.memoryGib).toBe('Memory Size GB')
})

it('maps Proxmox guest headers including usage %', () => {
  const cols = mapColumns(
    ['Name', 'Node', 'Cores', 'Sockets', 'Memory Size GB', 'Status', 'Cpu Usage %'],
    GUEST_COLS,
  )
  expect(cols.vmName).toBe('Name')
  expect(cols.status).toBe('Status')
  expect(cols.cpuUsagePct).toBe('Cpu Usage %')
})

it('maps Proxmox storage headers', () => {
  const cols = mapColumns(
    ['Storage', 'Plugin Type', 'Disk Size GB', 'Disk Usage GB', 'Shared'],
    STORAGE_COLS,
  )
  expect(cols.name).toBe('Storage')
  expect(cols.capacityGib).toBe('Disk Size GB')
})
